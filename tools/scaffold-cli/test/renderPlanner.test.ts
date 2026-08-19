import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planRender } from '../src/renderPlanner.js';

const fx = (name: string) => readFileSync(join(__dirname, 'fixtures/render', name), 'utf8');
const ok = (p: ReturnType<typeof planRender>) => {
  if (!p.ok) throw new Error('expected ok plan, got conflicts: ' + JSON.stringify(p.conflicts));
  return p;
};

describe('planRender existence pass', () => {
  it('enable staging adds staging-db before production-db and staging-server before production-server', () => {
    const out = ok(planRender(fx('base.yaml'), { staging: true, jobs: false })).output;
    expect(out.indexOf('name: staging-db')).toBeGreaterThan(-1);
    expect(out.indexOf('name: staging-db')).toBeLessThan(out.indexOf('name: production-db'));
    expect(out.indexOf('name: staging-server')).toBeLessThan(out.indexOf('name: production-server'));
    expect(out).not.toContain('name: staging-worker'); // jobs off
    expect(out).not.toContain('REDIS_URL');
  });

  it('is idempotent: re-running enable staging is a byte no-op', () => {
    const once = ok(planRender(fx('base.yaml'), { staging: true, jobs: false })).output;
    const twice = planRender(once, { staging: true, jobs: false });
    expect(twice.ok).toBe(true);
    if (twice.ok) {
      expect(twice.changed).toBe(false);
      expect(twice.output).toBe(once);
    }
  });

  it('enable jobs adds keyvalue first, production-worker, and REDIS_URL into production server+worker', () => {
    const out = ok(planRender(fx('base.yaml'), { staging: false, jobs: true })).output;
    expect(out.indexOf('name: keyvalue')).toBeGreaterThan(-1);
    expect(out.indexOf('type: keyvalue')).toBeLessThan(out.indexOf('name: production-server'));
    expect(out).toContain('name: production-worker');
    expect(out).toContain('ipAllowList: []');
    // REDIS_URL present in both server and worker (2 occurrences)
    expect(out.match(/key: REDIS_URL/g)?.length).toBe(2);
    // positioned before fromGroup within the server block
    const serverSlice = out.slice(out.indexOf('name: production-server'), out.indexOf('name: production-worker'));
    expect(serverSlice.indexOf('REDIS_URL')).toBeLessThan(serverSlice.indexOf('fromGroup: production'));
  });
});

describe('planRender conflict detection', () => {
  it('fails with a diff when an owned block was incompatibly hand-edited, mutating nothing', () => {
    const once = ok(planRender(fx('base.yaml'), { staging: true, jobs: false })).output;
    const mangled = once.replace('dockerCommand: node dist/server.js\n    preDeployCommand: node dist/scripts/predeployMigrate.js', 'dockerCommand: node dist/HACKED.js');
    // re-plan against the mangled staging-server
    const p = planRender(mangled, { staging: true, jobs: false });
    expect(p.ok).toBe(false);
    if (!p.ok) {
      expect(p.conflicts[0].block).toContain('staging-server');
      expect(p.conflicts[0].diff).toContain('HACKED');
    }
  });
});

describe('planRender order independence', () => {
  it('staging-then-jobs equals jobs-then-staging', () => {
    const s = ok(planRender(fx('base.yaml'), { staging: true, jobs: false })).output;
    const sThenJ = ok(planRender(s, { staging: true, jobs: true })).output;
    const j = ok(planRender(fx('base.yaml'), { staging: false, jobs: true })).output;
    const jThenS = ok(planRender(j, { staging: true, jobs: true })).output;
    expect(sThenJ).toBe(jThenS);
  });

  it('the converged output has staging-worker with REDIS_URL (4 REDIS_URL occurrences)', () => {
    const s = ok(planRender(fx('base.yaml'), { staging: true, jobs: false })).output;
    const both = ok(planRender(s, { staging: true, jobs: true })).output;
    expect(both).toContain('name: staging-worker');
    expect(both.match(/key: REDIS_URL/g)?.length).toBe(4); // staging+prod server+worker
  });
});

describe('planRender golden fixtures', () => {
  it('matches the committed golden files byte-for-byte', () => {
    expect(ok(planRender(fx('base.yaml'), { staging: true, jobs: false })).output).toBe(fx('staging.yaml'));
    expect(ok(planRender(fx('base.yaml'), { staging: false, jobs: true })).output).toBe(fx('jobs.yaml'));
    const s = ok(planRender(fx('base.yaml'), { staging: true, jobs: false })).output;
    expect(ok(planRender(s, { staging: true, jobs: true })).output).toBe(fx('staging-jobs.yaml'));
  });
});

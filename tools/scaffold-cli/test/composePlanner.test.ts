import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planCompose } from '../src/composePlanner.js';

const fx = (n: string) => readFileSync(join(__dirname, 'fixtures/compose', n), 'utf8');

describe('planCompose', () => {
  it('jobs off is a no-op', () => {
    const p = planCompose(fx('base.yaml'), { staging: false, jobs: false });
    expect(p.ok && p.changed).toBe(false);
  });

  it('jobs on adds redis and worker services', () => {
    const p = planCompose(fx('base.yaml'), { staging: false, jobs: true });
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.output).toContain('redis:');
      expect(p.output).toContain('image: "redis:alpine"');
      expect(p.output).toContain('worker:');
      expect(p.output).toContain('command: ["npm", "run", "worker"]');
      expect(p.output).toContain('REDIS_URL: redis://redis:6379');
    }
  });

  it('does not reformat unowned lines (only adds redis+worker blocks)', () => {
    const p = planCompose(fx('base.yaml'), { staging: false, jobs: true });
    if (!p.ok) throw new Error('unexpected conflict: ' + JSON.stringify(p.conflicts));
    // These pre-existing flow sequences must round-trip byte-identical, not gain
    // yaml's default inner padding (`[ 'a', 'b' ]`) — the planner must only touch
    // the blocks it owns (redis/worker), never reformat unrelated services.
    expect(p.output).toContain(
      "test: ['CMD-SHELL', 'pg_isready', '-u', 'postgres', '-d', 'serverdev']",
    );
    expect(p.output).toContain("command: ['npm', 'run', 'dev']");
    expect(p.output).toContain("command: ['npm', 'run', 'migrate:all']");
  });

  it('is idempotent', () => {
    const once = planCompose(fx('base.yaml'), { staging: false, jobs: true });
    if (!once.ok) throw new Error('unexpected conflict');
    const twice = planCompose(once.output, { staging: false, jobs: true });
    expect(twice.ok && twice.changed).toBe(false);
    if (twice.ok) expect(twice.output).toBe(once.output);
  });

  it('conflicts when an owned worker was hand-edited', () => {
    const once = planCompose(fx('base.yaml'), { staging: false, jobs: true });
    if (!once.ok) throw new Error('unexpected');
    const mangled = once.output.replace('npm", "run", "worker"', 'npm", "run", "HACKED"');
    const p = planCompose(mangled, { staging: false, jobs: true });
    expect(p.ok).toBe(false);
  });

  it('matches the committed golden fixture byte-for-byte', () => {
    const p = planCompose(fx('base.yaml'), { staging: false, jobs: true });
    if (!p.ok) throw new Error('unexpected conflict: ' + JSON.stringify(p.conflicts));
    expect(p.output).toBe(fx('jobs.yaml'));
  });
});

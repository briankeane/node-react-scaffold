import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planDomain } from '../src/domainPlanner.js';
import { planRender } from '../src/renderPlanner.js';

const REPO = join(__dirname, '../../..');
const base = () => readFileSync(join(REPO, 'render.yaml'), 'utf8');
// A render.yaml with staging present, for the staging-env cases.
const withStaging = () => {
  const p = planRender(base(), { staging: true, jobs: false });
  if (!p.ok) throw new Error('expected ok');
  return p.output;
};

describe('planDomain', () => {
  it('adds domains: [d] to the production-server when absent', () => {
    const r = planDomain(base(), { env: 'production', domain: 'api.example.com' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.changed).toBe(true);
      expect(r.output).toMatch(/name: production-server[\s\S]*domains:\n {6}- api\.example\.com/);
    }
  });

  it('is idempotent for the same domain', () => {
    const once = planDomain(base(), { env: 'production', domain: 'api.example.com' });
    if (!once.ok) throw new Error('expected ok');
    const twice = planDomain(once.output, { env: 'production', domain: 'api.example.com' });
    expect(twice.ok).toBe(true);
    if (twice.ok) {
      expect(twice.changed).toBe(false);
      expect(twice.output).toBe(once.output);
    }
  });

  it('replaces a different single domain and reports the change', () => {
    const first = planDomain(base(), { env: 'production', domain: 'old.example.com' });
    if (!first.ok) throw new Error('expected ok');
    const second = planDomain(first.output, { env: 'production', domain: 'new.example.com' });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.changed).toBe(true);
      expect(second.output).toContain('- new.example.com');
      expect(second.output).not.toContain('- old.example.com');
      expect(second.warnings?.join(' ')).toMatch(/old\.example\.com -> new\.example\.com/);
    }
  });

  it('targets the staging-server when --env staging', () => {
    const r = planDomain(withStaging(), { env: 'staging', domain: 'api-staging.example.com' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const stagingSlice = r.output.slice(
        r.output.indexOf('name: staging-server'),
        r.output.indexOf('name: production-server'),
      );
      expect(stagingSlice).toContain('- api-staging.example.com');
    }
  });

  it('conflicts on a hand-managed multi-domain list', () => {
    const first = planDomain(base(), { env: 'production', domain: 'a.example.com' });
    if (!first.ok) throw new Error('expected ok');
    const multi = first.output.replace('- a.example.com', '- a.example.com\n      - b.example.com');
    const r = planDomain(multi, { env: 'production', domain: 'c.example.com' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.conflicts[0].block).toContain('production-server');
  });

  it('conflicts when the target env server is missing', () => {
    const r = planDomain(base(), { env: 'staging', domain: 'api-staging.example.com' });
    expect(r.ok).toBe(false); // base render.yaml is production-only
  });

  it('conflicts on a single non-scalar (object-shaped) domains entry', () => {
    const first = planDomain(base(), { env: 'production', domain: 'a.example.com' });
    if (!first.ok) throw new Error('expected ok');
    // replace the scalar entry with a map-shaped one (hand-authored)
    const objShaped = first.output.replace('- a.example.com', '- name: a.example.com\n        enabled: true');
    const r = planDomain(objShaped, { env: 'production', domain: 'b.example.com' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.conflicts[0].diff).toMatch(/non-scalar/);
  });

  it('preserves the surrounding comments (comment-preserving patch)', () => {
    const r = planDomain(base(), { env: 'production', domain: 'api.example.com' });
    if (!r.ok) throw new Error('expected ok');
    expect(r.output).toContain('# Production Blueprint.');
    expect(r.output).toContain('# Remaining secrets (e.g. JWT_SECRET) live in the `production` env group.');
  });
});

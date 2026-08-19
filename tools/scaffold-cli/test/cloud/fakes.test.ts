import { describe, it, expect } from 'vitest';
import { FakeRender, FakeGitHub, FakeNetlify } from '../../src/cloud/clients/fakes.js';
import { RetryableError } from '../../src/cloud/clients/types.js';

describe('FakeRender', () => {
  it('creates + lists env groups by name with their var keys', async () => {
    const r = new FakeRender();
    const g = await r.createEnvGroup('production', { JWT_SECRET: 'x' });
    const groups = await r.listEnvGroups();
    expect(groups.map((x) => x.name)).toContain('production');
    expect(groups[0].varKeys).toContain('JWT_SECRET');
    await r.addEnvGroupVars(g.id, { EXTRA: 'y' });
    expect((await r.listEnvGroups())[0].varKeys).toEqual(['JWT_SECRET', 'EXTRA']);
  });

  it('failNext throws the queued error once, then succeeds', async () => {
    const r = new FakeRender();
    r.failNext('listServices', new RetryableError('flaky'));
    await expect(r.listServices()).rejects.toBeInstanceOf(RetryableError);
    await expect(r.listServices()).resolves.toEqual([]); // recovers
  });

  it('seeds services and returns copies (no external mutation)', async () => {
    const r = new FakeRender({ services: [{ id: 'srv-1', name: 'production-server', type: 'web' }] });
    const list = await r.listServices();
    list[0].name = 'mutated';
    expect((await r.listServices())[0].name).toBe('production-server');
  });
});

describe('FakeGitHub', () => {
  it('tracks secrets set (idempotent) and flips visibility', async () => {
    const gh = new FakeGitHub({ visibility: 'private' });
    await gh.setSecret('RENDER_API_KEY', 'k');
    await gh.setSecret('RENDER_API_KEY', 'k'); // idempotent
    expect(await gh.listSecrets()).toEqual(['RENDER_API_KEY']);
    await gh.setPackagePublic();
    expect(await gh.packageVisibility()).toBe('public');
  });

  it('imageExists checks seeded image:tag set', async () => {
    const gh = new FakeGitHub({ images: ['ghcr.io/acme/app:production'] });
    expect(await gh.imageExists('ghcr.io/acme/app', 'production')).toBe(true);
    expect(await gh.imageExists('ghcr.io/acme/app', 'staging')).toBe(false);
  });
});

describe('FakeNetlify', () => {
  it('finds seeded sites, creates new ones, records env', async () => {
    const nf = new FakeNetlify({ sites: [{ id: 'site-x', name: 'app-production', accountSlug: 'acme-team' }] });
    expect((await nf.findSite('app-production'))?.id).toBe('site-x');
    expect(await nf.findSite('app-staging')).toBeUndefined();
    const created = await nf.createSite('app-staging', await nf.accountSlug());
    await nf.setSiteEnv(created.id, 'VITE_SERVER_BASE_URL', 'https://x.onrender.com');
    expect(nf.siteEnv.get(created.id)?.VITE_SERVER_BASE_URL).toBe('https://x.onrender.com');
  });
});

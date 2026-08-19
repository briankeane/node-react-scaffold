import { describe, it, expect } from 'vitest';
import { runSteps } from '../../src/cloud/orchestrator.js';
import { buildSteps, requiredSecrets, expectedServices, ghcrPackageName } from '../../src/cloud/steps.js';
import { FakeRender, FakeGitHub, FakeNetlify } from '../../src/cloud/clients/fakes.js';
import type { CloudContext, Env, IO, Mode } from '../../src/cloud/types.js';
import type { RenderService } from '../../src/cloud/clients/types.js';

class FakeIO implements IO {
  lines: string[] = [];
  answers: boolean[];
  constructor(answers: boolean[] = []) {
    this.answers = answers;
  }
  print(msg: string): void {
    this.lines.push(msg);
  }
  async confirm(): Promise<boolean> {
    return this.answers.length ? (this.answers.shift() as boolean) : true;
  }
  async poll<T>(fn: () => Promise<T | undefined>, attempts: number): Promise<T | undefined> {
    for (let i = 0; i < attempts; i++) {
      const v = await fn();
      if (v !== undefined) return v;
    }
    return undefined;
  }
}

interface Opts {
  mode?: Mode;
  envs?: Env[];
  jobs?: boolean;
  render?: FakeRender;
  github?: FakeGitHub;
  netlify?: FakeNetlify;
  io?: FakeIO;
  netlifyAuthToken?: string;
}

// A fully-provisioned production-server service (blueprint already synced).
const prodServer = (): RenderService => ({
  id: 'srv-prod-web',
  name: 'production-server',
  type: 'web',
  imagePath: 'ghcr.io/acme/app:production',
  url: 'https://app.onrender.com',
});

function mkCtx(o: Opts = {}): { ctx: CloudContext; io: FakeIO; render: FakeRender; github: FakeGitHub; netlify: FakeNetlify } {
  const io = o.io ?? new FakeIO();
  const render = o.render ?? new FakeRender();
  const github = o.github ?? new FakeGitHub({ repo: { owner: 'acme', name: 'app' }, images: ['ghcr.io/acme/app:production'] });
  const netlify = o.netlify ?? new FakeNetlify();
  const ctx: CloudContext = {
    rootDir: '/tmp/does-not-exist',
    mode: o.mode ?? 'interactive',
    envs: o.envs ?? ['production'],
    jobs: o.jobs ?? false,
    repo: { owner: 'acme', name: 'app', image: 'ghcr.io/acme/app' },
    tokens: { renderApiKey: 'rk', netlifyAuthToken: 'netlifyAuthToken' in o ? o.netlifyAuthToken : 'nt' },
    render,
    github,
    netlify,
    io,
  };
  return { ctx, io, render, github, netlify };
}

describe('setup cloud steps', () => {
  it('full run (blueprint already synced): applies gates, creates env group, sites, secrets; exit 0', async () => {
    const { ctx, render, github, netlify } = mkCtx({ render: new FakeRender({ services: [prodServer()] }) });
    const code = await runSteps(ctx, buildSteps());
    expect(code).toBe(0);
    // env group created with JWT_SECRET
    expect(render.envGroups.find((g) => g.name === 'production')?.varKeys).toContain('JWT_SECRET');
    // GHCR made public
    expect(github.visibility).toBe('public');
    // netlify site created + origin set
    const site = netlify.sites.find((s) => s.name === 'app-production');
    expect(site).toBeDefined();
    expect(netlify.siteEnv.get(site!.id)?.VITE_SERVER_BASE_URL).toBe('https://app.onrender.com');
    // all required secrets set
    for (const s of requiredSecrets(ctx)) expect(github.secrets).toContain(s);
  });

  it('resume (everything present): no mutations, all steps skip, exit 0', async () => {
    const render = new FakeRender({
      services: [prodServer()],
      envGroups: [{ id: 'evg-1', name: 'production', varKeys: ['JWT_SECRET'] }],
    });
    const github = new FakeGitHub({
      repo: { owner: 'acme', name: 'app' },
      images: ['ghcr.io/acme/app:production'],
      visibility: 'public',
      secrets: ['RENDER_API_KEY', 'NETLIFY_AUTH_TOKEN', 'RENDER_PRODUCTION_SERVICE_ID', 'NETLIFY_PRODUCTION_SITE_ID'],
    });
    const netlify = new FakeNetlify({ sites: [{ id: 'site-1', name: 'app-production', accountSlug: 'acme-team' }] });
    const { ctx, io } = mkCtx({ render, github, netlify });
    const code = await runSteps(ctx, buildSteps());
    expect(code).toBe(0);
    // no mutating calls anywhere
    expect(render.calls).not.toContain('createEnvGroup');
    expect(render.calls).not.toContain('addEnvGroupVars');
    expect(github.calls).not.toContain('setPackagePublic');
    expect(github.calls).not.toContain('setSecret');
    expect(netlify.calls).not.toContain('createSite');
    expect(io.lines.filter((l) => l.startsWith('skip')).length).toBeGreaterThanOrEqual(5);
  });

  it('--plan (fresh, blueprint not synced): mutates nothing, previews resources incl. paid-infra note, exit 0', async () => {
    const { ctx, io, render, github, netlify } = mkCtx({ mode: 'plan' });
    const code = await runSteps(ctx, buildSteps());
    expect(code).toBe(0);
    expect(render.calls).not.toContain('createEnvGroup');
    expect(github.calls).not.toContain('setPackagePublic');
    expect(github.calls).not.toContain('setSecret');
    expect(netlify.calls).not.toContain('createSite');
    const out = io.lines.join('\n');
    expect(out).toMatch(/GATE \(public exposure\)/);
    expect(out).toMatch(/monthly cost/);
    expect(out).toMatch(/VITE_SERVER_BASE_URL/);
  });

  it('--yes with blueprint pending: stops at the manual step with exit 4 (gates already applied)', async () => {
    const { ctx, github } = mkCtx({ mode: 'yes' }); // no services seeded
    const code = await runSteps(ctx, buildSteps());
    expect(code).toBe(4);
    // ghcr-visibility gate ran before the manual step under --yes
    expect(github.visibility).toBe('public');
  });

  it('scope conflict (worker typed as web) returns exit 3', async () => {
    const render = new FakeRender({
      services: [
        prodServer(),
        { id: 'srv-bad', name: 'production-worker', type: 'web', imagePath: 'ghcr.io/acme/app:production' },
      ],
    });
    const { ctx } = mkCtx({ jobs: true, render });
    const code = await runSteps(ctx, buildSteps());
    expect(code).toBe(3);
  });

  it('existing JWT_SECRET is never rotated (env-groups satisfied)', async () => {
    const render = new FakeRender({
      services: [prodServer()],
      envGroups: [{ id: 'evg-1', name: 'production', varKeys: ['JWT_SECRET'] }],
    });
    const { ctx } = mkCtx({ render });
    await runSteps(ctx, buildSteps());
    expect(render.calls).not.toContain('createEnvGroup');
    expect(render.calls).not.toContain('addEnvGroupVars');
  });

  it('missing NETLIFY_AUTH_TOKEN when a netlify secret must be set returns exit 3', async () => {
    const { ctx } = mkCtx({ render: new FakeRender({ services: [prodServer()] }), netlifyAuthToken: undefined });
    // netlifyAuthToken undefined; NETLIFY_AUTH_TOKEN secret is missing -> conflict in github-secrets
    const code = await runSteps(ctx, buildSteps());
    expect(code).toBe(3);
  });
});

describe('step pure helpers', () => {
  it('requiredSecrets covers envs + jobs', () => {
    const base = mkCtx({ envs: ['production'], jobs: false }).ctx;
    expect(requiredSecrets(base)).toEqual([
      'RENDER_API_KEY',
      'NETLIFY_AUTH_TOKEN',
      'RENDER_PRODUCTION_SERVICE_ID',
      'NETLIFY_PRODUCTION_SITE_ID',
    ]);
    const both = mkCtx({ envs: ['production', 'staging'], jobs: true }).ctx;
    expect(requiredSecrets(both)).toContain('RENDER_STAGING_WORKER_SERVICE_ID');
    expect(requiredSecrets(both)).toContain('RENDER_PRODUCTION_WORKER_SERVICE_ID');
  });

  it('expectedServices includes workers only when jobs enabled', () => {
    expect(expectedServices(mkCtx({ jobs: false }).ctx).map((s) => s.name)).toEqual(['production-server']);
    expect(expectedServices(mkCtx({ envs: ['production', 'staging'], jobs: true }).ctx).map((s) => s.name)).toEqual([
      'production-server',
      'production-worker',
      'staging-server',
      'staging-worker',
    ]);
  });

  it('ghcrPackageName lowercases the repo name', () => {
    expect(ghcrPackageName('MyApp')).toBe('myapp');
  });
});

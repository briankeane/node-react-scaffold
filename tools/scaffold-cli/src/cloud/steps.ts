import type { Step, CloudContext, CheckResult, Env } from './types.js';
import type { RenderService } from './clients/types.js';
import { AuthError, ConflictError, RetryableError } from './clients/types.js';
import { strongSecret } from './secret.js';
import { loadConfig } from '../config.js';

// ---- pure naming / scope helpers (exported for unit tests) ----

// The image tag for an env matches the env name (:production / :staging).
export const envTag = (env: Env): string => env;
export const serverName = (env: Env): string => `${env}-server`;
export const workerName = (env: Env): string => `${env}-worker`;
export const siteName = (repo: string, env: Env): string => `${repo}-${env}`;
// GHCR container package is named after the repo, lowercased.
export const ghcrPackageName = (repo: string): string => repo.toLowerCase();

// A Render service's imagePath belongs to this repo iff its repository component
// equals ctx.repo.image exactly — either the bare image or image followed by a
// `:tag`. Substring matching would wrongly accept ghcr.io/acme/app-preview for
// ghcr.io/acme/app, binding an unrelated service's ID into this repo's secrets.
export function imageMatches(imagePath: string, image: string): boolean {
  return imagePath === image || imagePath.startsWith(`${image}:`);
}

// The GitHub Actions secrets required for the enabled envs + features.
export function requiredSecrets(ctx: CloudContext): string[] {
  const out = ['RENDER_API_KEY', 'NETLIFY_AUTH_TOKEN'];
  for (const env of ctx.envs) {
    const E = env.toUpperCase();
    out.push(`RENDER_${E}_SERVICE_ID`);
    if (ctx.jobs) out.push(`RENDER_${E}_WORKER_SERVICE_ID`);
    out.push(`NETLIFY_${E}_SITE_ID`);
  }
  return out;
}

// The Render services whose IDs we read back, with their expected type.
export function expectedServices(ctx: CloudContext): Array<{ name: string; type: 'web' | 'worker' }> {
  const out: Array<{ name: string; type: 'web' | 'worker' }> = [];
  for (const env of ctx.envs) {
    out.push({ name: serverName(env), type: 'web' });
    if (ctx.jobs) out.push({ name: workerName(env), type: 'worker' });
  }
  return out;
}

const satisfied = (detail: string, data?: Record<string, unknown>): CheckResult => ({
  state: 'satisfied',
  detail,
  data,
});
const needs = (detail: string, data?: Record<string, unknown>): CheckResult => ({
  state: 'needs_action',
  detail,
  data,
});

// Resolve expected services from a fresh listServices, scope-validating name+type
// (+ image path when Render reports it). Returns a name->id map, or throws a
// ConflictError on a scope mismatch. Missing services => the `missing` list.
async function resolveServices(
  ctx: CloudContext,
): Promise<{ ids: Record<string, string>; missing: string[] }> {
  const all = await ctx.render.listServices();
  const byName = new Map<string, RenderService>(all.map((s) => [s.name, s]));
  const ids: Record<string, string> = {};
  const missing: string[] = [];
  for (const { name, type } of expectedServices(ctx)) {
    const svc = byName.get(name);
    if (!svc) {
      missing.push(name);
      continue;
    }
    if (svc.type !== type) {
      throw new ConflictError(`Render service "${name}" is type ${svc.type}, expected ${type}`);
    }
    if (svc.imagePath && !imageMatches(svc.imagePath, ctx.repo.image)) {
      throw new ConflictError(
        `Render service "${name}" pulls ${svc.imagePath}, expected image ${ctx.repo.image} (wrong repo/scope)`,
      );
    }
    ids[name] = svc.id;
  }
  return { ids, missing };
}

// ---- steps ----

// 1. Preflight: prerequisites the CLI cannot fix. Signals exit 2 via AuthError.
function preflight(): Step {
  return {
    name: 'preflight',
    kind: 'auto',
    async check(ctx): Promise<CheckResult> {
      if (!ctx.tokens.renderApiKey) throw new AuthError('RENDER_API_KEY is not set in the environment');
      if (!(await ctx.github.authStatus())) throw new AuthError('gh is not authenticated (run: gh auth login)');
      if (!(await ctx.netlify.loginStatus())) throw new AuthError('netlify is not authenticated (run: netlify login)');
      return satisfied('gh + netlify authenticated, RENDER_API_KEY present');
    },
    preview: () => 'preflight',
    async apply(): Promise<void> {},
  };
}

// 2. First image in GHCR: the Blueprint sync needs a pullable image. Unmet => conflict.
function firstImage(): Step {
  return {
    name: 'first-image',
    kind: 'auto',
    async check(ctx): Promise<CheckResult> {
      const missing: string[] = [];
      for (const env of ctx.envs) {
        if (!(await ctx.github.imageExists(ctx.repo.image, envTag(env)))) {
          missing.push(`${ctx.repo.image}:${envTag(env)}`);
        }
      }
      if (missing.length) {
        return {
          state: 'conflict',
          detail:
            `no image in GHCR yet: ${missing.join(', ')}. Push the branch (main -> :production, ` +
            `develop -> :staging) or run \`gh workflow run\` to build the first image, then re-run.`,
        };
      }
      return satisfied('first image present in GHCR');
    },
    preview: () => 'first-image',
    async apply(): Promise<void> {},
  };
}

// 3. [GATE] GHCR package public so Render can pull the image.
function ghcrVisibility(): Step {
  return {
    name: 'ghcr-visibility',
    kind: 'gate',
    async check(ctx): Promise<CheckResult> {
      const pkg = ghcrPackageName(ctx.repo.name);
      const vis = await ctx.github.packageVisibility(pkg);
      if (vis === 'public') return satisfied(`GHCR package ${pkg} already public`);
      return needs(`GHCR package ${pkg} is ${vis}`);
    },
    preview(ctx): string {
      const pkg = ghcrPackageName(ctx.repo.name);
      return (
        `GATE (public exposure): make GHCR package "${pkg}" PUBLIC so Render can pull the image. ` +
        `The package becomes world-readable (no cost). Alternative: attach a Render registry credential instead.`
      );
    },
    async apply(ctx): Promise<void> {
      await ctx.github.setPackagePublic(ghcrPackageName(ctx.repo.name));
    },
  };
}

// 4. Render env group(s) with a generated JWT_SECRET. Never rotate an existing one.
function envGroups(): Step {
  return {
    name: 'env-groups',
    kind: 'auto',
    async check(ctx): Promise<CheckResult> {
      const groups = await ctx.render.listEnvGroups();
      const pending: string[] = [];
      for (const env of ctx.envs) {
        const g = groups.find((x) => x.name === env);
        if (!g) pending.push(`create ${env}`);
        else if (!g.varKeys.includes('JWT_SECRET')) pending.push(`add JWT_SECRET to ${env}`);
      }
      if (!pending.length) return satisfied('env groups present with JWT_SECRET');
      return needs(pending.join('; '));
    },
    preview(ctx): string {
      return `Create/patch Render env group(s) for ${ctx.envs.join(', ')} with a generated JWT_SECRET (env groups are free).`;
    },
    async apply(ctx): Promise<void> {
      const groups = await ctx.render.listEnvGroups();
      for (const env of ctx.envs) {
        const g = groups.find((x) => x.name === env);
        if (!g) {
          await ctx.render.createEnvGroup(env, { JWT_SECRET: strongSecret() });
        } else if (!g.varKeys.includes('JWT_SECRET')) {
          await ctx.render.addEnvGroupVars(g.id, { JWT_SECRET: strongSecret() });
        }
      }
    },
  };
}

// 5. [MANUAL] The one unavoidable dashboard click: New Blueprint Instance sync.
function blueprintSync(): Step {
  return {
    name: 'blueprint-sync',
    kind: 'manual',
    async check(ctx): Promise<CheckResult> {
      const { ids, missing } = await resolveServices(ctx); // throws ConflictError on mismatch
      if (!missing.length) return satisfied('Blueprint services present', ids);
      return needs(`missing services: ${missing.join(', ')}`);
    },
    preview(ctx): string {
      return (
        'MANUAL — the one unavoidable click. In the Render dashboard:\n' +
        '  1. Blueprints -> New Blueprint Instance -> connect this repo -> select render.yaml\n' +
        '  2. Review the plan (this creates the paid Postgres DB' +
        (ctx.jobs ? ' + keyvalue' : '') +
        ' + services — Render shows the monthly cost here, the gate for the infra itself)\n' +
        '  3. Apply the sync, then return here.\n' +
        '  Deep link: https://dashboard.render.com/blueprints'
      );
    },
    async apply(): Promise<void> {},
  };
}

// 6. Read back + scope-validate service IDs (checkpoint; conflict on mismatch).
function readServiceIds(): Step {
  return {
    name: 'read-service-ids',
    kind: 'auto',
    async check(ctx): Promise<CheckResult> {
      // resolveServices throws ConflictError on a scope/type mismatch (surfaced as
      // exit 3 even under --plan). Missing services => needs_action, so --plan on an
      // un-synced blueprint still reports cleanly instead of failing.
      const { ids, missing } = await resolveServices(ctx);
      if (missing.length) return needs(`will read service IDs once present: ${missing.join(', ')}`);
      return satisfied(`service IDs: ${Object.entries(ids).map(([n, i]) => `${n}=${i}`).join(', ')}`, ids);
    },
    preview: () => 'read-service-ids: read back + scope-validate Render service IDs',
    async apply(): Promise<void> {},
  };
}

// 7. [GATE] Create Netlify site(s) + set VITE_SERVER_BASE_URL to each env's origin.
function netlifySites(): Step {
  return {
    name: 'netlify-sites',
    kind: 'gate',
    async check(ctx): Promise<CheckResult> {
      const slug = await ctx.netlify.accountSlug();
      const pending: string[] = [];
      for (const env of ctx.envs) {
        const site = await ctx.netlify.findSite(siteName(ctx.repo.name, env));
        if (!site) {
          pending.push(`create ${siteName(ctx.repo.name, env)}`);
          continue;
        }
        if (site.accountSlug !== slug) {
          return {
            state: 'conflict',
            detail: `Netlify site ${site.name} exists under account ${site.accountSlug}, expected ${slug}`,
          };
        }
        // A prior run may have created the site but failed before setting the env
        // (e.g. the Render URL wasn't live yet). Verify VITE_SERVER_BASE_URL is
        // actually set so we don't skip it on resume.
        const url = await ctx.netlify.getSiteEnv(site.id, 'VITE_SERVER_BASE_URL');
        if (!url) pending.push(`set VITE_SERVER_BASE_URL on ${siteName(ctx.repo.name, env)}`);
      }
      if (!pending.length) return satisfied('Netlify site(s) present with VITE_SERVER_BASE_URL');
      return needs(pending.join('; '));
    },
    preview(ctx): string {
      const names = ctx.envs.map((e) => siteName(ctx.repo.name, e)).join(', ');
      return (
        `GATE (creates resources): create Netlify site(s) ${names} and set VITE_SERVER_BASE_URL to each ` +
        `env's Render server origin (sets the origin; does not verify reachability). Sites are free on the starter tier.`
      );
    },
    async apply(ctx): Promise<void> {
      const slug = await ctx.netlify.accountSlug();
      const services = await ctx.render.listServices();
      for (const env of ctx.envs) {
        let site = await ctx.netlify.findSite(siteName(ctx.repo.name, env));
        if (!site) site = await ctx.netlify.createSite(siteName(ctx.repo.name, env), slug);
        const server = services.find((s) => s.name === serverName(env));
        if (!server?.url) {
          throw new RetryableError(`Render ${serverName(env)} URL not available yet`);
        }
        await ctx.netlify.setSiteEnv(site.id, 'VITE_SERVER_BASE_URL', server.url);
      }
    },
  };
}

// 8. GitHub Actions secrets (set only the missing ones).
function githubSecrets(): Step {
  return {
    name: 'github-secrets',
    kind: 'auto',
    async check(ctx): Promise<CheckResult> {
      const have = new Set(await ctx.github.listSecrets());
      const missing = requiredSecrets(ctx).filter((s) => !have.has(s));
      if (!missing.length) return satisfied('all GitHub secrets present');
      return needs(`set: ${missing.join(', ')}`);
    },
    preview(ctx): string {
      return `Set GitHub Actions secrets (${requiredSecrets(ctx).join(', ')}); only missing ones are written.`;
    },
    async apply(ctx): Promise<void> {
      const have = new Set(await ctx.github.listSecrets());
      const { ids } = await resolveServices(ctx);
      const slug = await ctx.netlify.accountSlug();

      const values: Record<string, string | undefined> = { RENDER_API_KEY: ctx.tokens.renderApiKey };
      if (!have.has('NETLIFY_AUTH_TOKEN')) {
        if (!ctx.tokens.netlifyAuthToken) {
          throw new ConflictError('NETLIFY_AUTH_TOKEN is not set in the environment');
        }
        values.NETLIFY_AUTH_TOKEN = ctx.tokens.netlifyAuthToken;
      }
      for (const env of ctx.envs) {
        const E = env.toUpperCase();
        values[`RENDER_${E}_SERVICE_ID`] = ids[serverName(env)];
        if (ctx.jobs) values[`RENDER_${E}_WORKER_SERVICE_ID`] = ids[workerName(env)];
        const site = await ctx.netlify.findSite(siteName(ctx.repo.name, env));
        if (!site) throw new ConflictError(`Netlify site ${siteName(ctx.repo.name, env)} not found`);
        values[`NETLIFY_${E}_SITE_ID`] = site.id;
        if (slug && site.accountSlug !== slug) {
          throw new ConflictError(`Netlify site ${site.name} under wrong account ${site.accountSlug}`);
        }
      }

      for (const name of requiredSecrets(ctx)) {
        if (have.has(name)) continue;
        const value = values[name];
        if (value == null) throw new ConflictError(`cannot resolve a value for secret ${name}`);
        await ctx.github.setSecret(name, value);
      }
    },
  };
}

// 9. Summary + next steps.
function summary(): Step {
  return {
    name: 'summary',
    kind: 'auto',
    async check(): Promise<CheckResult> {
      return needs('print summary');
    },
    preview(ctx): string {
      const lines = [
        `Cloud setup summary: envs=[${ctx.envs.join(', ')}], jobs=${ctx.jobs}`,
        'Secrets and Netlify sites are configured; deploys run from GitHub Actions.',
      ];
      let customDomain = false;
      try {
        customDomain = loadConfig(ctx.rootDir).features.customDomain;
      } catch {
        // config not readable from this rootDir in a synthetic run; skip DNS note
      }
      if (customDomain) {
        lines.push('Next: add the CNAME record(s) for your custom domain (see README > Custom Domain Setup).');
      }
      return lines.join('\n');
    },
    async apply(): Promise<void> {},
  };
}

// The ordered setup-cloud steps. netlify-sites runs before github-secrets so the
// site IDs exist when the secrets step reads them back.
export function buildSteps(): Step[] {
  return [
    preflight(),
    firstImage(),
    ghcrVisibility(),
    envGroups(),
    blueprintSync(),
    readServiceIds(),
    netlifySites(),
    githubSecrets(),
    summary(),
  ];
}

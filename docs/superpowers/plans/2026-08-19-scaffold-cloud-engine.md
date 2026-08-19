# Scaffold Cloud Engine (PR3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the deterministic cloud-provisioning engine to the scaffold CLI — `setup local`, `setup cloud`, and an `enable-domain` patcher — with CLI-owned confirmation gates on paid/irreversible actions, plus the two required PR2 fixes (per-env keyvalue, one-pass provisioning of every enabled env).

**Architecture:** Extend the merged PR2 CLI in `tools/scaffold-cli/` (pure planners + transactional apply). `enable-domain` is a pure-file patcher in the exact PR2 shape (local IaC only). `setup cloud` is a separate orchestrator over an ordered list of **Steps**; each Step exposes `check()` (read-only state probe) + `preview()` (cost/impact text) + `apply()` (mutation). Every cloud API/CLI touch goes through an injected client interface (`RenderClient`/`GitHubClient`/`NetlifyClient`) so all logic is unit-tested against in-memory fakes with zero live calls. The manual "New Blueprint Instance" dashboard click is modeled as a `manual` Step whose `check()` reads back the expected services.

**Tech Stack:** TypeScript (ESM, `tsx` runtime), `yaml` (comment-preserving), Vitest, Node `fetch` for the Render REST API, `gh` CLI + `netlify` CLI shelled out via `node:child_process` `execFile`.

**Spec:** `docs/superpowers/specs/2026-08-18-scaffold-deploy-and-setup-design.md` (decisions 3, 5, 6) — recovered via `git show ad671e7:docs/superpowers/specs/2026-08-18-scaffold-deploy-and-setup-design.md`. PR2 plan: `docs/superpowers/plans/2026-08-18-scaffold-optionality-core.md`. This plan also folds in a Codex architecture consult (2026-08-19) that sharpened step statuses, the exit-code contract, typed client errors, and scope-validated name matching.

## Global Constraints

- **Node ≥ 20**, ESM (`"type": "module"`); imports use `.js` extensions in TS source (matches PR2). Runtime is `tsx`.
- **NEVER use an MCP server.** The CLI must run in plain CI/shell. Cloud access is Render REST API (`fetch`, `RENDER_API_KEY` from env), `gh` CLI, `netlify` CLI only.
- **Render stays Blueprint-canonical.** The CLI never imperatively creates the DB/keyvalue/services. `render.yaml` owns topology; the one manual step is the dashboard Blueprint sync. The Render API is used only for operational reads/writes (list services, env groups, secrets values), never to create Blueprint topology.
- **Gates owned by the CLI, not an LLM.** Every paid/irreversible/exposing action prints a preview + requires confirmation. Three modes: `--plan` (dry-run, mutate nothing), interactive confirm (default), `--yes` (skip prompts — for the later skills path after user approval).
- **Idempotent + resumable.** Re-running `setup cloud` detects existing state (Render list by name+type, `gh secret list`, `netlify` site lookup) and continues without double-creating.
- **Match external resources by name AND scope**, never bare name: service name + type (+ image path when available); Netlify site name + account slug; GitHub secrets are repo-scoped via `gh` in the current repo.
- **Keep `NODE_ENV=production`** in every Render env (staging included). Isolation comes from separate resources, not `NODE_ENV`.
- **Repo hygiene:** never stage regenerated build artifacts (`client/vite.config.js`, `*.tsbuildinfo`). Stage only intentional files.
- **No `lengua` / `briankeane` / lengua-domain leaks** in any committed file.
- Prettier + lint clean (`make prettier-all`, `make lint-server`, `make lint-client`); `make test-scaffold-cli` green; existing server/client builds+tests stay green.

## Exit-code contract (all CLI commands)

| Code | Meaning |
| ---- | ------- |
| `0`  | Completed successfully, OR `--plan` produced a clean plan, OR user declined a gate and we stopped cleanly |
| `1`  | Operational / retryable external failure after retries exhausted |
| `2`  | Usage / config error (bad flags, missing `scaffold.config.json`, missing `RENDER_API_KEY`) |
| `3`  | Conflict / unsafe state (hand-edited owned block, name/type mismatch, ambiguous external state) |
| `4`  | Manual action required (Blueprint sync pending under `--yes`, or interactive poll timed out) |

## Locked interfaces (referenced by tasks; define once, reuse everywhere)

`src/cloud/types.ts`:

```ts
export type Env = 'production' | 'staging';
export type Mode = 'plan' | 'interactive' | 'yes';
export type StepKind = 'auto' | 'gate' | 'manual';
export type CheckState = 'satisfied' | 'needs_action' | 'conflict' | 'retryable_error';

export interface CheckResult {
  state: CheckState;
  detail: string;                      // human + machine readable reason
  data?: Record<string, unknown>;      // e.g. discovered { 'production-server': 'srv-...' }
}

export interface Step {
  name: string;
  kind: StepKind;
  check(ctx: CloudContext): Promise<CheckResult>;
  preview(ctx: CloudContext, r: CheckResult): string;   // cost/impact, printed in --plan and before a gate
  apply(ctx: CloudContext, r: CheckResult): Promise<void>;
}

export interface IO {
  print(msg: string): void;
  confirm(prompt: string): Promise<boolean>;
  // poll fn until it returns a defined value or attempts exhausted; returns undefined on timeout
  poll<T>(fn: () => Promise<T | undefined>, attempts: number, delayMs: number): Promise<T | undefined>;
}

export interface CloudContext {
  rootDir: string;
  mode: Mode;
  envs: Env[];                         // ['production', ...('staging' if enabled)]
  jobs: boolean;
  repo: { owner: string; name: string; image: string }; // image = lowercased ghcr.io/<owner>/<repo>
  render: RenderClient;
  github: GitHubClient;
  netlify: NetlifyClient;
  io: IO;
}
```

`src/cloud/clients/types.ts` (client interfaces + typed errors):

```ts
export class AuthError extends Error {}       // 401/403/not logged in
export class NotFoundError extends Error {}   // 404
export class ConflictError extends Error {}   // 409 / name collision / ambiguous
export class RetryableError extends Error {}  // 429/5xx/network reset
export class ToolError extends Error {}        // malformed CLI/API output

export interface RenderService {
  id: string;
  name: string;
  type: 'web' | 'worker' | 'keyvalue' | 'pserv' | 'cron';
  imagePath?: string;   // e.g. ghcr.io/org/repo:production
  url?: string;         // onrender.com URL for web services
}
export interface EnvGroup { id: string; name: string; varKeys: string[]; }

export interface RenderClient {
  listServices(): Promise<RenderService[]>;
  listEnvGroups(): Promise<EnvGroup[]>;
  createEnvGroup(name: string, vars: Record<string, string>): Promise<EnvGroup>;
  addEnvGroupVars(groupId: string, vars: Record<string, string>): Promise<void>;
}

export interface GitHubClient {
  authStatus(): Promise<boolean>;
  currentRepo(): Promise<{ owner: string; name: string }>;
  packageVisibility(pkg: string): Promise<'public' | 'private' | 'unknown'>;
  setPackagePublic(pkg: string): Promise<void>;
  imageExists(image: string, tag: string): Promise<boolean>;
  listSecrets(): Promise<string[]>;
  setSecret(name: string, value: string): Promise<void>;
}

export interface NetlifySite { id: string; name: string; accountSlug: string; }
export interface NetlifyClient {
  loginStatus(): Promise<boolean>;
  accountSlug(): Promise<string>;
  findSite(name: string): Promise<NetlifySite | undefined>;
  createSite(name: string, accountSlug: string): Promise<NetlifySite>;
  setSiteEnv(siteId: string, key: string, value: string): Promise<void>;
}
```

## File structure

- `src/config.ts` — **modify**: extend `customDomain` writer helper + a domain-value helper. `customDomain` stays a boolean in `scaffold.config.json`; `enable-domain` is its sole writer.
- `src/templates.ts` — **modify**: replace shared `KEYVALUE`/`REDIS_URL_ITEM` with per-env `productionKv`/`stagingKv` + a `redisUrlItem(env)` factory; add a `domainsField(domain)` fragment helper.
- `src/renderPlanner.ts` — **modify**: per-env keyvalue existence + per-env `REDIS_URL` wiring; new `SERVICE_ORDER`.
- `src/domainPlanner.ts` — **create**: pure `planDomain(currentYaml, { env, domain })` patcher.
- `src/commands.ts` — **modify**: add `enableDomain(rootDir, { env, domain })`.
- `src/cli.ts` — **modify**: route `enable-domain`, `setup` (local|cloud) with `--plan`/`--yes`/`--env` flag parsing; map thrown errors → exit codes.
- `src/setupLocal.ts` — **create**: docker preflight + drive `make install`/`make launch`.
- `src/cloud/types.ts` — **create**: `Step`/`CloudContext`/`IO`/`Env`/`Mode` (above).
- `src/cloud/clients/types.ts` — **create**: client interfaces + typed errors (above).
- `src/cloud/clients/render.ts`, `github.ts`, `netlify.ts` — **create**: real impls (fetch/execFile). Pure helpers (image-path derivation, response parsing) unit-tested; thin I/O uncovered.
- `src/cloud/clients/fakes.ts` — **create**: in-memory fakes implementing the interfaces, for tests.
- `src/cloud/orchestrator.ts` — **create**: `runSteps(ctx, steps): Promise<number>` (returns exit code) + gate/mode/retry logic.
- `src/cloud/steps.ts` — **create**: the ordered `setup cloud` steps.
- `src/setupCloud.ts` — **create**: builds `CloudContext`, wires real clients, calls `runSteps`.
- `test/*` — new vitest files per unit; `test/fixtures/render/domain*.yaml` + updated `jobs.yaml`/`staging-jobs.yaml` goldens.
- `Makefile` — **modify**: `setup-local`, `setup-cloud`, `enable-domain` targets + `.PHONY`.
- `README.md` — **modify**: Cloud setup runbook + `enable-domain` under "Optional deploy features".
- `package.json` — **modify**: npm scripts for the new subcommands.

---

## Task 1: Per-env keyvalue (PR2 fix) — templates, planner, goldens

**Files:**
- Modify: `tools/scaffold-cli/src/templates.ts`
- Modify: `tools/scaffold-cli/src/renderPlanner.ts`
- Modify: `tools/scaffold-cli/test/fixtures/render/jobs.yaml`, `staging-jobs.yaml`
- Test: `tools/scaffold-cli/test/renderPlanner.test.ts`, `test/commands.test.ts` (convergence)

**Interfaces:**
- Consumes: PR2 `planRender(currentYaml, desired)`, `Desired = { staging, jobs }`.
- Produces: unchanged `planRender` signature; new template exports `PRODUCTION_KV`, `STAGING_KV`, `redisUrlItem(env: 'production'|'staging'): string`. Removes `KEYVALUE`, `REDIS_URL_ITEM`.

Rationale (Codex-confirmed): staging + production both run `NODE_ENV=production`, so a shared `keyvalue` means shared BullMQ queues → cross-contamination. One keyvalue per enabled env (`production-kv`, `staging-kv`), each env's `REDIS_URL` wired to its own kv. No migration path needed: PR2 (shared keyvalue) has not shipped in a release — PR2+PR3 merge together before release, so the base `render.yaml` never contains a `keyvalue` block in the wild.

- [ ] **Step 1: Update the failing golden expectations first (they encode the desired output).** Rewrite `test/fixtures/render/jobs.yaml` so the keyvalue block is `name: production-kv` and the `production-server`/`production-worker` `REDIS_URL` items reference `name: production-kv`. Rewrite `staging-jobs.yaml` so there are **two** keyvalue services (`production-kv`, `staging-kv`) and each env's server+worker `REDIS_URL` points at its own `<env>-kv`. Canonical service order: `production-kv, staging-kv, staging-server, staging-worker, production-server, production-worker`.

- [ ] **Step 2: Run render planner tests to verify they fail**

Run: `cd tools/scaffold-cli && npx vitest run test/renderPlanner.test.ts test/commands.test.ts`
Expected: FAIL — planner still emits shared `keyvalue`.

- [ ] **Step 3: Update `templates.ts`**

```ts
function kv(name: string): string {
  return `- type: keyvalue
  name: ${name}
  plan: starter
  region: ohio
  ipAllowList: []
`;
}
export const PRODUCTION_KV = kv('production-kv');
export const STAGING_KV = kv('staging-kv');

// REDIS_URL wired to the env's OWN keyvalue (per-env isolation).
export function redisUrlItem(env: 'production' | 'staging'): string {
  return `- key: REDIS_URL
  fromService:
    name: ${env}-kv
    type: keyvalue
    property: connectionString
`;
}
```

Delete `KEYVALUE` and `REDIS_URL_ITEM`.

- [ ] **Step 4: Update `renderPlanner.ts`**

New order + per-env kv existence pass, and per-env REDIS wiring:

```ts
const SERVICE_ORDER = [
  'production-kv', 'staging-kv',
  'staging-server', 'staging-worker',
  'production-server', 'production-worker',
];
```

In `planRender`, replace the single-keyvalue reconcile with per-env:

```ts
if (desired.jobs) {
  changed = reconcileBlock(services, SERVICE_ORDER, PRODUCTION_KV, conflicts) || changed;
  if (desired.staging)
    changed = reconcileBlock(services, SERVICE_ORDER, STAGING_KV, conflicts) || changed;
}
```

In the REDIS_URL pass, build the redis node per env (parametrize `ensureRedisUrl` to take the fragment):

```ts
if (desired.jobs) {
  const envs: Array<'production' | 'staging'> = ['production', ...(desired.staging ? ['staging'] as const : [])];
  for (const env of envs) {
    for (const role of ['server', 'worker'] as const) {
      const svc = findByName(services, `${env}-${role}`);
      if (!svc) { warnings.push(`warning: jobs enabled but no ${env}-${role} found in render.yaml; REDIS_URL not wired`); continue; }
      changed = ensureRedisUrl(svc, redisUrlItem(env), conflicts) || changed;
    }
  }
}
```

Update `ensureRedisUrl(map, fragment, conflicts)` to accept the fragment and parse it via the existing `templateNode`. Keep `withoutRedis` (comparison stays REDIS-agnostic).

- [ ] **Step 5: Run planner + convergence tests to verify pass**

Run: `cd tools/scaffold-cli && npx vitest run`
Expected: PASS — `jobs.yaml`/`staging-jobs.yaml` byte-match; both feature orders converge; idempotency holds.

- [ ] **Step 6: Commit**

```bash
git add tools/scaffold-cli/src/templates.ts tools/scaffold-cli/src/renderPlanner.ts tools/scaffold-cli/test/fixtures/render/jobs.yaml tools/scaffold-cli/test/fixtures/render/staging-jobs.yaml
git commit -m "fix: per-env keyvalue so staging/production BullMQ queues never share Redis"
```

---

## Task 2: `enable-domain` planner (pure, comment-preserving, replace-on-different)

**Files:**
- Create: `tools/scaffold-cli/src/domainPlanner.ts`
- Modify: `tools/scaffold-cli/src/templates.ts` (add `domainsField`)
- Test: `tools/scaffold-cli/test/domainPlanner.test.ts`
- Test fixtures: `test/fixtures/render/domain-production.yaml` (golden)

**Interfaces:**
- Consumes: `parseDoc`, `stringifyDoc`, `structurallyEqual`, `unifiedDiff` from `yamlUtil`; `Plan`/`Conflict` from `config`.
- Produces: `planDomain(currentYaml: string, opts: { env: Env; domain: string }): Plan`.

Semantics (Codex-confirmed replace-on-different): locate the `<env>-server` service. Manage a single scaffold-owned `domains:` list on it:
- no `domains:` field → add `domains: [<domain>]` (insert after `healthCheckPath`, before `envVars`).
- `domains: [<domain>]` (same single value) → no-op (`changed=false`).
- `domains: [<other>]` (different single value) → **replace** with `[<domain>]`, warning `domain changed: <other> -> <domain>`.
- `domains:` with >1 entry, or not a list, or `<env>-server` missing → **conflict** with diff (can't safely reconcile a hand-managed multi-domain setup).

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planDomain } from '../src/domainPlanner.js';

const REPO = join(__dirname, '../../..');
const base = () => readFileSync(join(REPO, 'render.yaml'), 'utf8');

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
    expect(twice.ok && twice.changed).toBe(false);
    if (twice.ok) expect(twice.output).toBe(once.output);
  });

  it('replaces a different single domain and reports the change', () => {
    const first = planDomain(base(), { env: 'production', domain: 'old.example.com' });
    if (!first.ok) throw new Error('expected ok');
    const second = planDomain(first.output, { env: 'production', domain: 'new.example.com' });
    expect(second.ok && second.changed).toBe(true);
    if (second.ok) {
      expect(second.output).toContain('- new.example.com');
      expect(second.output).not.toContain('- old.example.com');
      expect(second.warnings?.join(' ')).toMatch(/old\.example\.com -> new\.example\.com/);
    }
  });

  it('conflicts on a hand-managed multi-domain list', () => {
    const first = planDomain(base(), { env: 'production', domain: 'a.example.com' });
    if (!first.ok) throw new Error('expected ok');
    const multi = first.output.replace('- a.example.com', '- a.example.com\n      - b.example.com');
    const r = planDomain(multi, { env: 'production', domain: 'c.example.com' });
    expect(r.ok).toBe(false);
  });

  it('conflicts when the target env server is missing', () => {
    const r = planDomain(base(), { env: 'staging', domain: 'api-staging.example.com' });
    expect(r.ok).toBe(false); // base render.yaml is production-only
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd tools/scaffold-cli && npx vitest run test/domainPlanner.test.ts`
Expected: FAIL — `planDomain` not defined.

- [ ] **Step 3: Implement `domainPlanner.ts`**

```ts
import { YAMLSeq, YAMLMap, isSeq, Scalar } from 'yaml';
import { parseDoc, stringifyDoc, unifiedDiff } from './yamlUtil.js';
import type { Plan, Conflict } from './config.js';
import type { Env } from './cloud/types.js';

function findByName(seq: YAMLSeq, name: string): YAMLMap | undefined {
  return seq.items.find((it) => it instanceof YAMLMap && it.get('name') === name) as YAMLMap | undefined;
}

export function planDomain(currentYaml: string, opts: { env: Env; domain: string }): Plan {
  const doc = parseDoc(currentYaml, 'render.yaml');
  const services = doc.get('services') as YAMLSeq;
  const svc = findByName(services, `${opts.env}-server`);
  const conflicts: Conflict[] = [];
  const warnings: string[] = [];

  if (!svc) {
    return { ok: false, conflicts: [{
      block: `services: ${opts.env}-server`,
      diff: `no ${opts.env}-server service found in render.yaml; enable the ${opts.env} env first`,
    }] };
  }

  const existing = svc.get('domains') as unknown;
  if (existing == null) {
    const seq = new YAMLSeq();
    seq.add(new Scalar(opts.domain));
    // insert after healthCheckPath, before envVars (deterministic position)
    const idx = svc.items.findIndex((p) => String((p.key as Scalar).value) === 'envVars');
    const pair = doc.createPair('domains', seq);
    if (idx === -1) svc.items.push(pair); else svc.items.splice(idx, 0, pair);
    return { ok: true, output: stringifyDoc(doc), changed: true, warnings };
  }

  if (!isSeq(existing) || existing.items.length !== 1) {
    conflicts.push({
      block: `services: ${opts.env}-server.domains`,
      diff: `domains: is hand-managed (expected a single scaffold-owned entry, found ` +
        `${isSeq(existing) ? existing.items.length + ' entries' : 'a non-list value'}). ` +
        `Edit render.yaml manually and re-run.`,
    });
    return { ok: false, conflicts };
  }

  const current = String((existing.items[0] as Scalar).value);
  if (current === opts.domain) return { ok: true, output: stringifyDoc(doc), changed: false, warnings };

  (existing.items[0] as Scalar).value = opts.domain;
  warnings.push(`domain changed: ${current} -> ${opts.domain}`);
  return { ok: true, output: stringifyDoc(doc), changed: true, warnings };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd tools/scaffold-cli && npx vitest run test/domainPlanner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/scaffold-cli/src/domainPlanner.ts tools/scaffold-cli/test/domainPlanner.test.ts
git commit -m "feat: enable-domain planner (replace-on-different, fail-loud on multi-domain)"
```

---

## Task 3: `enable-domain` command + CLI + Makefile

**Files:**
- Modify: `tools/scaffold-cli/src/commands.ts`, `src/cli.ts`, `package.json`
- Modify: `Makefile`
- Test: `tools/scaffold-cli/test/commands.test.ts`

**Interfaces:**
- Consumes: `planDomain`, `loadConfig`, `commitWrites`.
- Produces: `enableDomain(rootDir: string, opts: { env: Env; domain: string }): number` (exit code). `customDomain` flag flips to `true`; prints generic CNAME target + record type.

- [ ] **Step 1: Write failing e2e test**

```ts
import { enableDomain } from '../src/commands.js';
// freshRoot() from existing helper

it('enable-domain patches production-server, flips flag, is idempotent', () => {
  const d = freshRoot();
  expect(enableDomain(d, { env: 'production', domain: 'api.example.com' })).toBe(0);
  expect(cfg(d).customDomain).toBe(true);
  expect(readFileSync(join(d, 'render.yaml'), 'utf8')).toContain('- api.example.com');
  const snap = readFileSync(join(d, 'render.yaml'), 'utf8');
  expect(enableDomain(d, { env: 'production', domain: 'api.example.com' })).toBe(0);
  expect(readFileSync(join(d, 'render.yaml'), 'utf8')).toBe(snap); // idempotent
});

it('enable-domain fails loud (exit 3) on a hand-mangled multi-domain list, mutates nothing', () => {
  const d = freshRoot();
  enableDomain(d, { env: 'production', domain: 'a.example.com' });
  const before = readFileSync(join(d, 'render.yaml'), 'utf8').replace('- a.example.com', '- a.example.com\n      - b.example.com');
  writeFileSync(join(d, 'render.yaml'), before);
  expect(enableDomain(d, { env: 'production', domain: 'c.example.com' })).toBe(3);
  expect(readFileSync(join(d, 'render.yaml'), 'utf8')).toBe(before);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd tools/scaffold-cli && npx vitest run test/commands.test.ts`
Expected: FAIL — `enableDomain` not defined.

- [ ] **Step 3: Implement `enableDomain` in `commands.ts`**

```ts
export function enableDomain(rootDir: string, opts: { env: Env; domain: string }): number {
  const config = loadConfig(rootDir);
  const render = planDomain(readFileSync(join(rootDir, RENDER), 'utf8'), opts);
  if (!render.ok) {
    printConflicts('enable-domain', render.conflicts);
    return 3;
  }
  const writes: FileWrite[] = [];
  if (render.changed) writes.push({ path: join(rootDir, RENDER), content: render.output });
  commitWrites(rootDir, writes, { features: { ...config.features, customDomain: true } });
  for (const w of render.warnings ?? []) console.error(w);
  console.log(`Custom domain enabled for ${opts.env}: ${opts.domain}`);
  console.log(`DNS: add a CNAME record for your subdomain -> <your-${opts.env}-server>.onrender.com`);
  console.log(`(Cloudflare users: set the record to DNS only / grey cloud.)`);
  return 0;
}
```

Note: `printConflicts` returns void; the caller returns `3` (was `1` in PR2 — PR2 commands still return `1`, that is fine; new commands adopt the exit-code contract). Do not change PR2 `enableStaging`/`enableJobs` return values in this task.

- [ ] **Step 4: Wire `cli.ts`** — parse `enable-domain <domain> [--env production|staging]`, default env `production`, validate env ∈ {production, staging} (else exit 2), map `ConfigError`/parse errors → exit 2/1 as today. Add `package.json` script `"enable-domain": "tsx src/cli.ts enable-domain"`.

- [ ] **Step 5: Add Makefile target**

```make
enable-domain: scaffold-cli-deps
	cd tools/scaffold-cli && npm run enable-domain -- $(DOMAIN) $(if $(ENV),--env $(ENV),)
```

Add `enable-domain` to `.PHONY`. Document `make enable-domain DOMAIN=api.example.com [ENV=staging]`.

- [ ] **Step 6: Run + commit**

Run: `cd tools/scaffold-cli && npx vitest run`
Expected: PASS.

```bash
git add tools/scaffold-cli/src/commands.ts tools/scaffold-cli/src/cli.ts tools/scaffold-cli/package.json tools/scaffold-cli/test/commands.test.ts Makefile
git commit -m "feat: enable-domain command + make target"
```

---

## Task 4: Cloud client interfaces, typed errors, in-memory fakes

**Files:**
- Create: `src/cloud/types.ts`, `src/cloud/clients/types.ts`, `src/cloud/clients/fakes.ts`
- Test: `test/cloud/fakes.test.ts`

**Interfaces:** exactly as in "Locked interfaces" above. Fakes are deterministic, seedable, and record calls.

- [ ] **Step 1: Write `types.ts` + `clients/types.ts`** verbatim from the Locked interfaces section.

- [ ] **Step 2: Write failing fakes test**

```ts
import { describe, it, expect } from 'vitest';
import { FakeRender, FakeGitHub, FakeNetlify } from '../../src/cloud/clients/fakes.js';

describe('fakes', () => {
  it('render fake creates + lists env groups idempotently by name', async () => {
    const r = new FakeRender({ services: [], envGroups: [] });
    await r.createEnvGroup('production', { JWT_SECRET: 'x' });
    const groups = await r.listEnvGroups();
    expect(groups.map((g) => g.name)).toContain('production');
    expect(groups[0].varKeys).toContain('JWT_SECRET');
  });

  it('github fake tracks secrets set', async () => {
    const gh = new FakeGitHub({ repo: { owner: 'o', name: 'r' }, secrets: [], visibility: 'private' });
    await gh.setSecret('RENDER_API_KEY', 'k');
    expect(await gh.listSecrets()).toContain('RENDER_API_KEY');
  });
});
```

- [ ] **Step 3: Implement `fakes.ts`** — `FakeRender`, `FakeGitHub`, `FakeNetlify` with constructor-seeded state (services, envGroups, secrets, visibility, sites, accountSlug, imagesPresent). Each method mutates in-memory state and can be told to throw a typed error (e.g. `throwOn: { setSecret: new RetryableError('flaky') }`) to test retry/resume.

- [ ] **Step 4: Run + commit**

Run: `cd tools/scaffold-cli && npx vitest run test/cloud/fakes.test.ts`
Expected: PASS.

```bash
git add tools/scaffold-cli/src/cloud/types.ts tools/scaffold-cli/src/cloud/clients/types.ts tools/scaffold-cli/src/cloud/clients/fakes.ts tools/scaffold-cli/test/cloud/fakes.test.ts
git commit -m "feat: cloud client interfaces, typed errors, in-memory fakes"
```

---

## Task 5: Orchestrator (gate/mode/retry logic + exit codes)

**Files:**
- Create: `src/cloud/orchestrator.ts`
- Test: `test/cloud/orchestrator.test.ts`

**Interfaces:**
- Consumes: `Step`, `CloudContext`, `CheckResult`, `IO`, `Mode`.
- Produces: `runSteps(ctx: CloudContext, steps: Step[]): Promise<number>` (exit code per the contract). Retries `retryable_error` up to 3× (no real sleep in tests — retry immediately; delay only in the real IO).

Per-step algorithm:
1. `r = await step.check(ctx)`.
2. `conflict` → `io.print` detail, return `3`.
3. `retryable_error` → retry `check` up to 3×; still failing → return `1`.
4. `satisfied` → `io.print("skip (already done): <name>")`, continue.
5. `needs_action`:
   - `io.print(step.preview(ctx, r))`.
   - `mode==='plan'` → continue (record, mutate nothing).
   - `kind==='manual'`:
     - `mode==='yes'` → print instructions, return `4`.
     - interactive → `io.poll(() => probeSatisfied, ...)`; satisfied → continue; timeout → return `4`.
   - `kind==='gate'`:
     - `mode==='yes'` → `apply`.
     - interactive → `io.confirm(...)`; yes → `apply`; no → `io.print("stopped at your request; re-run to continue")`, return `0`.
   - `kind==='auto'` → `apply`.
6. After all steps: return `0`.

- [ ] **Step 1: Write failing tests** covering: `--plan` calls no `apply` (spy) and returns 0; a `conflict` step returns 3; a `gate` step under `--yes` applies; a `gate` step declined interactively returns 0 and stops; a `manual` step under `--yes` returns 4; a `retryable_error` that clears on 2nd check proceeds; a persistent `retryable_error` returns 1. Use a `FakeIO` (`confirm` returns a queued answer, `poll` runs fn N times).

```ts
it('--plan mutates nothing and returns 0', async () => {
  const applied: string[] = [];
  const steps = [mkStep('a', 'needs_action', 'gate', () => applied.push('a'))];
  const code = await runSteps(ctx({ mode: 'plan' }), steps);
  expect(code).toBe(0);
  expect(applied).toEqual([]);
});
```

- [ ] **Step 2: Run to verify fail** → `runSteps` undefined.
- [ ] **Step 3: Implement `orchestrator.ts`** per the algorithm.
- [ ] **Step 4: Run to verify pass.**
- [ ] **Step 5: Commit** `feat: setup-cloud orchestrator with gate/mode/retry + exit codes`.

---

## Task 6: `setup cloud` steps (each check/preview/apply)

**Files:**
- Create: `src/cloud/steps.ts`
- Test: `test/cloud/steps.test.ts`

**Interfaces:**
- Consumes: `CloudContext`, clients, `Step`.
- Produces: `buildSteps(ctx): Step[]` — the ordered list.

Ordered steps (each with the sharp check-state defaults Codex gave):

1. **preflight** (`auto`): `check` = `gh.authStatus()` && `netlify.loginStatus()` && `RENDER_API_KEY` present. Missing → `conflict` with exact remediation (these are prerequisites the CLI cannot fix). No `apply`.
2. **first-image** (`auto`): `check` = `github.imageExists(ctx.repo.image, env-tag)` for each env. Absent → `conflict` (`state: conflict`) with remediation: "push `main` (and `develop` if staging) or run `gh workflow run` to build the first image, then re-run." No `apply`.
3. **ghcr-visibility** (`gate` — public exposure): `check` = `github.packageVisibility(repo)`; `public` → satisfied; `private`/`unknown` → needs_action. `preview` = "Make GHCR package `<repo>` PUBLIC so Render can pull the image (or attach a Render registry credential instead)." `apply` = `github.setPackagePublic(repo)`.
4. **env-groups** (`auto`): for each env, `check` = env group exists (by name) with `JWT_SECRET` key present → satisfied; exists-but-missing-`JWT_SECRET` → needs_action (add only the missing var); absent → needs_action (create). Never rotate an existing `JWT_SECRET`. `apply` = `createEnvGroup(env, { JWT_SECRET: strongSecret() })` or `addEnvGroupVars`. `strongSecret()` = 48 random bytes base64url via `node:crypto`.
5. **blueprint-sync** (`manual`): `check` = for each env, expected services exist **and match type** (`<env>-server` web, `<env>-worker` worker if jobs); all present → satisfied (stash discovered IDs in `data`); some present with **wrong type / mismatched image path** → conflict; none/partial present → needs_action (manual). `preview` = exact dashboard steps + deep link `https://dashboard.render.com/blueprints` + "Render shows DB/keyvalue/service cost here — this is the paid-infra gate." `apply` = no-op (human acts); orchestrator handles polling/exit-4.
6. **read-service-ids** (`auto`): `check` = re-list services, scope-validate name+type (+image path contains `ctx.repo.image`); build `{ '<env>-server': id, '<env>-worker': id }` in `data`. Mismatch → conflict. This step has no mutation; it hydrates context for step 7.
7. **github-secrets** (`auto`): `check` = `gh.listSecrets()`; compute the required set from envs+jobs (`RENDER_API_KEY`, `RENDER_<ENV>_SERVICE_ID`, `RENDER_<ENV>_WORKER_SERVICE_ID` when jobs, `NETLIFY_AUTH_TOKEN`, `NETLIFY_<ENV>_SITE_ID`); all present → satisfied; any missing → needs_action (set only missing). `apply` = `setSecret` for each missing. `RENDER_API_KEY`/`NETLIFY_AUTH_TOKEN` values come from env (prompt if interactive & missing; under `--yes` require env, else conflict). Service-ID values come from step 6 `data`; site IDs from step 8 `data` (so ordering: sites before secrets OR secrets step reads netlify site ids from context — see note).
8. **netlify-sites** (`gate` — creates resources): for each env, `check` = `netlify.findSite('<project>-<env>')` scoped to `netlify.accountSlug()`; found → satisfied (stash id); found under a different account → conflict; absent → needs_action. `preview` = "Create Netlify site `<project>-<env>` and set `VITE_SERVER_BASE_URL` to the Render <env> server origin (sets the origin; does not verify reachability)." `apply` = `createSite` then `setSiteEnv(id, 'VITE_SERVER_BASE_URL', renderUrl)`.
9. **summary** (`auto`): prints created/skipped, secrets set, next steps (DNS if `customDomain`). Always `satisfied` after a full pass; `preview`/`apply` no-op.

**Ordering note:** netlify-sites (8) must run before github-secrets sets `NETLIFY_*_SITE_ID`. Reorder so netlify-sites precedes github-secrets, OR have the secrets step depend on netlify data already in context. Chosen: order = preflight, first-image, ghcr-visibility, env-groups, blueprint-sync, read-service-ids, **netlify-sites**, github-secrets, summary. (Update the numbering in code accordingly.)

- [ ] **Step 1: Write failing tests** against fakes:
  - Full fresh run (interactive, all `confirm`→yes): every gate applies; secrets set; returns 0.
  - Re-run with everything seeded present: every step prints "skip (already done)"; no `apply` mutates; returns 0 (resumability).
  - `--plan` with fresh state: nothing mutates on any fake; returns 0; preview text includes each resource + the paid-infra note.
  - `--yes` with services NOT yet present (blueprint pending): returns 4 at blueprint-sync.
  - Services present but `production-worker` has type `web` (mismatch): returns 3 (conflict) at read-service-ids.
  - Env group exists with `JWT_SECRET`: env-groups is `satisfied` (no rotation — assert the fake's stored secret value is unchanged).
- [ ] **Step 2: Run to verify fail.**
- [ ] **Step 3: Implement `steps.ts` + `strongSecret()`** (in a small `src/cloud/secret.ts`, tested for length/charset).
- [ ] **Step 4: Run to verify pass.**
- [ ] **Step 5: Commit** `feat: setup-cloud steps (idempotent, scope-validated, gated)`.

---

## Task 7: `setup cloud` real clients + entrypoint + CLI + Makefile

**Files:**
- Create: `src/cloud/clients/render.ts`, `github.ts`, `netlify.ts`, `src/setupCloud.ts`
- Modify: `src/cli.ts`, `package.json`, `Makefile`
- Test: `test/cloud/clients.pure.test.ts` (pure helpers only)

**Interfaces:**
- Produces: `setupCloud(rootDir, { mode, envFromFlag }): Promise<number>` — builds real clients, `CloudContext`, calls `runSteps`. Real IO: `print`→stdout, `confirm`→stdin y/n, `poll`→real delay.

- [ ] **Step 1: Pure-helper tests** (the only client logic worth unit-testing without live calls):
  - `deriveImage(owner, repo)` lowercases to `ghcr.io/<owner>/<repo>`.
  - Render `parseServices(json)` maps API shape → `RenderService[]` (name, type, imagePath, url).
  - `classifyHttp(status)` → `AuthError|NotFoundError|ConflictError|RetryableError|undefined`.
- [ ] **Step 2: Run to verify fail.**
- [ ] **Step 3: Implement real clients.** `render.ts` uses `fetch` with `Authorization: Bearer ${RENDER_API_KEY}`, pagination on `/v1/services?limit=...`, `classifyHttp` on non-2xx. `github.ts` shells `gh` (`gh api`, `gh secret set`, `gh api --method PUT .../packages/container/<pkg>/visibility`), `imageExists` via `gh api` GET on the package version/tags (or `docker manifest`), `currentRepo` via `gh repo view --json`. `netlify.ts` shells `netlify api`/`sites:create`/`env:set`. All shell calls via `execFile` (array args, no shell string interpolation) → typed errors on failure. Keep GHCR package resolution (owner type, lowercase, package name) in a small tested helper `ghcrPackageName(repo)`.
- [ ] **Step 4: Implement `setupCloud.ts` + wire `cli.ts`** — `setup local|cloud`, flags `--plan`, `--yes`, `--env`; mutually-exclusive `--plan`/`--yes` (else exit 2). Map thrown typed errors → exit codes (AuthError/config → 2, RetryableError exhausted → 1, ConflictError → 3). Add `package.json` scripts + `Makefile` `setup-cloud` target (passes `PLAN=1`→`--plan`, `YES=1`→`--yes`).
- [ ] **Step 5: Run + `make build`-equivalent typecheck** (`cd tools/scaffold-cli && npx tsc --noEmit`).
- [ ] **Step 6: Commit** `feat: setup cloud entrypoint + real Render/gh/netlify clients`.

---

## Task 8: `setup local`

**Files:**
- Create: `src/setupLocal.ts`
- Modify: `src/cli.ts`, `package.json`, `Makefile`
- Test: `test/setupLocal.test.ts`

**Interfaces:**
- Produces: `setupLocal(rootDir, { run }): number` where `run(cmd: string[]) => { code: number }` is injected (so tests don't run docker/make). Real impl uses `execFileSync` inheriting stdio.

Behavior: preflight `docker info` (via injected `run`) → if non-zero, print "Docker isn't running — start Docker Desktop and re-run", exit 2. Then print the plan and run `make install` then `make launch` (or print next steps). Keep it thin — most logic is already in bash/Make.

- [ ] **Step 1: Failing test** — injected `run` records commands; docker-down → exit 2 and no `make` calls; docker-up → runs `docker info`, `make install`, `make launch` in order, exit 0.
- [ ] **Step 2: Verify fail. Step 3: Implement. Step 4: Verify pass.**
- [ ] **Step 5: Add `setup-local` Makefile target + `package.json` script. Commit** `feat: setup local (docker preflight + bootstrap)`.

---

## Task 9: README runbook + docs + final gates

**Files:**
- Modify: `README.md`, `tools/scaffold-cli/src/templates.ts` (KEYVALUE comment cleanup if any stale "PR3" note remains)

- [ ] **Step 1: README "Cloud setup" runbook** — prerequisites (`gh`, `netlify`, `RENDER_API_KEY`), the `setup cloud` flow with the three modes, the one manual Blueprint step (what it is, why it's manual), the full secret list, and DNS/Cloudflare grey-cloud gotcha. Cross-link the exit-code contract.
- [ ] **Step 2: Update "Optional deploy features"** — add `make enable-domain DOMAIN=... [ENV=...]`; note the per-env keyvalue change (`enable-jobs` now provisions `production-kv` + `staging-kv`); document that local compose stays single-redis on purpose (one dev box, no env split, so no cross-contamination risk locally).
- [ ] **Step 3: Remove the stale "NOTE for PR3" comment** in `templates.ts` now that per-env kv landed.
- [ ] **Step 4: Full gate run**

```bash
make prettier-all
make test-scaffold-cli
make build-server && make lint-server && make test-server
make lint-client && make test-client
cd tools/scaffold-cli && npx tsc --noEmit
```

Expected: all green; `git status` shows only intentional files (no `client/vite.config.js`, no `*.tsbuildinfo`).

- [ ] **Step 5: Commit** `docs: cloud setup runbook + enable-domain + per-env keyvalue notes`.

---

## Self-review notes (coverage against spec + brief)

- Per-env keyvalue (brief fix 1) → Task 1. Staging one-pass provisioning (brief fix 2) → Task 6 (env-groups + blueprint-sync + secrets iterate `ctx.envs`).
- `setup local` → Task 8; `setup cloud` (resumable, gated, `--plan`/`--yes`) → Tasks 4–7; `enable-domain` → Tasks 2–3.
- Gates owned by CLI → orchestrator (Task 5) + gate steps (Task 6). No MCP anywhere. Render Blueprint-canonical → blueprint-sync is `manual`, CLI only reads back.
- Tests mock/inject all network clients (Task 4 fakes) → resumability, `--plan`, gate/`--yes` all asserted against fakes (Task 6). Domain planner idempotent/conflict/comment-preserving (Task 2). Per-env kv goldens + convergence (Task 1).
- Acceptance criteria (brief): `--plan` mutates nothing (Task 6 test); per-env kv goldens + both orders converge (Task 1); `enable-domain` idempotent + fail-loud + flips flag (Task 3); no lengua/briankeane leaks (Global Constraints + Task 9 gate).
- Out of scope (not built here): the `/setup` + `/enable-*` skills, `disable-*`, automating the Blueprint click or registrar DNS.

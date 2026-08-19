# Scaffold Optionality Core (PR2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a committed `scaffold.config.json` single source of truth, slim the base scaffold to production-only, and build a deterministic TypeScript CLI whose idempotent `enable-staging` / `enable-jobs` patchers reconstruct staging and background-jobs infrastructure by comment-preserving YAML patching.

**Architecture:** A host-run `tsx` CLI in `tools/scaffold-cli/` (its own package, no build step, vitest tests). Each command is a thin `main()` over **pure planners** that take current file text + a desired-feature set and return either a patched string or a conflict verdict. The render.yaml planner is a **reconciler**: it drives the parsed YAML document toward a canonical desired graph, inserting scaffold-owned blocks at fixed canonical positions and injecting the `REDIS_URL` field into each enabled env. Because every planner is a pure function of `(currentText, {staging, jobs})` and the desired set fully captures both flags, `enable-staging → enable-jobs` and `enable-jobs → enable-staging` converge to byte-identical files. Writes are transactional: compute all patches, abort with a diff on any conflict (mutate nothing), otherwise write all files and flip the config flag last.

**Tech Stack:** TypeScript, `tsx` (run), `vitest` (test), the `yaml` package's Document/AST API (comment-preserving parse/edit/stringify), Make targets for the repo's "everything via make" convention.

**Spec:** `docs/superpowers/specs/2026-08-18-scaffold-deploy-and-setup-design.md` (decisions 1, 2, 6 and "Base-scaffold defaults" govern). The spec is not currently in the working tree — retrieve it with `git show ad671e7:docs/superpowers/specs/2026-08-18-scaffold-deploy-and-setup-design.md` if needed. This plan also implements the PR2 brief in `.context/attachments/Vu6Pvf/pasted_text_2026-08-18_19-52-50.txt`.

## Global Constraints

- **`scaffold.config.json` at repo root is the single source of truth** for `{ staging, jobs, customDomain }`. Never infer a feature from which files exist or which secrets are set.
- **Enable = idempotent structural patching, not regeneration.** Re-running an enable is a byte-level no-op. If a scaffold-owned block was incompatibly hand-edited, **fail with a diff and mutate nothing** (exit non-zero).
- **No idle worker.** Base ships no worker service and no Redis/keyvalue. The worker is deployed only when `jobs` is enabled.
- **Ownership boundary (from architecture review):** *inserted* resources (`staging-db`, `staging-server`, `staging-worker`, `production-worker`, `keyvalue`) are fully owned. Inside the *pre-existing* base `production-server` block, own **only** the `REDIS_URL` envVar entry — never the whole block, or ordinary user edits become false conflicts.
- **Canonical ordering (makes both enable orders converge):** `databases`: `staging-db`, `production-db`. `services`: `keyvalue`, `staging-server`, `staging-worker`, `production-server`, `production-worker`. Owned blocks are inserted before the first existing block whose canonical rank is higher.
- **`REDIS_URL` envVar position:** always after the `DATABASE_URL` entry and before the `fromGroup` entry, in every enabled env's **server and worker**.
- **Render specifics:** `keyvalue` blocks require `ipAllowList` in Blueprints; `fromService` requires `name` + `type: keyvalue` + `property: connectionString`. `autoDeployTrigger` value stays the quoted string `"off"`; `PORT` stays the quoted string `"10020"`. Do not normalize these scalar shapes.
- **Cloud provisioning, `setup local`/`setup cloud`, `enable domain`, `disable-*`, and all `/setup`/`/enable-*` skills are PR3 — do NOT build them.** A short "Optional features" README stub is fine.
- **Repo hygiene:** the client commits build artifacts (`client/vite.config.js`, `*.tsbuildinfo`). Never let the CLI or tests stage regenerated artifacts. `git add` only intentional files; never `git add -A`.
- **No `lengua` / `briankeane` / lengua-domain leaks** in any committed file.

---

## Pre-step: branch

- [ ] Create the PR2 branch off develop:

```bash
git fetch origin
git checkout -b briankeane/scaffold-optionality-core origin/develop
```

(The current workspace branch `briankeane/scaffold-deploy-harden` already equals develop after PR1 #33 merged; do not rename it — create the new branch.)

---

## File Structure

Created:
- `scaffold.config.json` — root config, all features false.
- `tools/scaffold-cli/package.json`, `tsconfig.json`, `vitest.config.ts`, `package-lock.json` — self-contained CLI package.
- `tools/scaffold-cli/src/config.ts` — load + validate `scaffold.config.json`.
- `tools/scaffold-cli/src/yamlUtil.ts` — shared `yaml` helpers (parse Document, structural-equality compare, unified diff).
- `tools/scaffold-cli/src/templates.ts` — the exact owned-block YAML template strings + the `deploy-staging.yml` template.
- `tools/scaffold-cli/src/renderPlanner.ts` — the render.yaml reconciler (pure).
- `tools/scaffold-cli/src/composePlanner.ts` — the docker-compose.yaml patcher (pure).
- `tools/scaffold-cli/src/workflowPlanner.ts` — the `deploy-staging.yml` whole-file add/remove (pure).
- `tools/scaffold-cli/src/apply.ts` — transactional writer + config flip.
- `tools/scaffold-cli/src/commands.ts` — `enableStaging` / `enableJobs` orchestration over the planners.
- `tools/scaffold-cli/src/cli.ts` — argv dispatch entry point.
- `tools/scaffold-cli/test/*.test.ts` + `tools/scaffold-cli/test/fixtures/**` — golden + structural tests.

Modified:
- `render.yaml` — slim to production-only (relocate the hard-won comments onto `production-server`).
- `docker-compose.yaml` — drop the `worker` service and the commented `redis` block.
- `Makefile` — add `enable-staging`, `enable-jobs`, `test-scaffold-cli` targets; extend `.PHONY`.
- `README.md` — short "Optional features" stub.

Removed:
- `.github/workflows/deploy-staging.yml` — base ships production-only; `enable-staging` recreates it from the template.

**Interface contract (types every task shares):**

```typescript
// config.ts
export interface ScaffoldConfig {
  features: { staging: boolean; jobs: boolean; customDomain: boolean };
}
export function loadConfig(rootDir: string): ScaffoldConfig; // throws ConfigError on bad/missing
export class ConfigError extends Error {}

// the desired-feature set that fully determines every planner's output
export interface Desired { staging: boolean; jobs: boolean }

// renderPlanner.ts / composePlanner.ts
export interface Conflict { block: string; diff: string }
export type Plan =
  | { ok: true; output: string; changed: boolean }
  | { ok: false; conflicts: Conflict[] };
export function planRender(currentYaml: string, desired: Desired): Plan;
export function planCompose(currentYaml: string, desired: Desired): Plan;

// workflowPlanner.ts (deploy-staging.yml is whole-file, not AST-patched)
export type WorkflowPlan =
  | { action: 'create'; content: string }
  | { action: 'none' };
export function planStagingWorkflow(exists: boolean, currentContent: string | null, desiredStaging: boolean): WorkflowPlan;
// exists && content !== template && desiredStaging  -> conflict is surfaced by returning
//   { action: 'create', content: template } only when absent; when present-and-different, throw a ConflictError carrying a diff.
```

---

### Task 1: Slim the base scaffold + add `scaffold.config.json`

**Files:**
- Create: `scaffold.config.json`
- Modify: `render.yaml` (replace entire file)
- Modify: `docker-compose.yaml:1-6,45-63` (remove commented redis + worker service)
- Remove: `.github/workflows/deploy-staging.yml`
- Test: none yet (CLI tests arrive in Task 2+); this task's gate is "server build/test still green and files match the oracle below".

**Interfaces:**
- Produces: the base `render.yaml`, `docker-compose.yaml`, `scaffold.config.json` that every later task's fixtures and planners consume as the "all features off" starting point.

- [ ] **Step 1: Write `scaffold.config.json`**

```json
{
  "features": {
    "staging": false,
    "jobs": false,
    "customDomain": false
  }
}
```

- [ ] **Step 2: Replace `render.yaml` with the production-only base** (relocating the `dockerCommand` and `preDeployCommand` explanatory comments — which today live only on the staging block — onto `production-server` so the base keeps the knowledge):

```yaml
# Production Blueprint. Pushes to `main` deploy production. Each push builds a
# Docker image, pushes it to GHCR, and deploys it here.
#
# Services are `runtime: image` — they only PULL the tag, they never build. Deploys
# are triggered by the GitHub Actions workflows via the Render API after a verified
# image push, so `autoDeployTrigger: off` (Render must not also deploy on git commit).
#
# The image URLs below use a placeholder `ghcr.io/YOUR_ORG/YOUR_REPO` path. Replace
# `YOUR_ORG/YOUR_REPO` (lowercase) with your GitHub owner/repo. The CI workflows push
# a moving `:production` tag plus an immutable `:<git-sha>` tag; the deploy is pinned
# to the SHA via the Render API.
#
# Staging and background jobs (Redis + worker) are optional and OFF by default. Add
# them with `make enable-staging` / `make enable-jobs` (see README "Optional features").
#
# Bootstrap order matters — see the "Deploying to Render" runbook in README.md.
databases:
  - name: production-db
    plan: basic-256mb
    region: ohio

services:
  - type: web
    name: production-server
    runtime: image
    image:
      url: ghcr.io/YOUR_ORG/YOUR_REPO:production
    region: ohio
    plan: starter
    # image services use dockerCommand (NOT startCommand — that field is ignored for
    # runtime: image). Use the FULL command: Render does not reliably pass the Docker
    # Command as an arg to the image ENTRYPOINT, so bare `web`/`worker` tokens fail.
    dockerCommand: node dist/server.js
    # Render runs preDeployCommand as a single bare command with NO shell, so a
    # `checkEnv && migrate` chain silently skips the migrate. The whole sequence
    # (validate env, then migrate, non-zero exit on failure) lives in one Node script.
    preDeployCommand: node dist/scripts/predeployMigrate.js
    autoDeployTrigger: "off"
    healthCheckPath: /v1/healthCheck
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "10020"
      - key: DATABASE_URL
        fromDatabase:
          name: production-db
          property: connectionString
      # Remaining secrets (e.g. JWT_SECRET) live in the `production` env group.
      - fromGroup: production
```

- [ ] **Step 3: Slim `docker-compose.yaml`** — delete the commented `redis` block (current lines 1-6) and the entire `worker:` service (current lines 45-63). Leave `postgres`, `server`, `migrate`, `client` untouched. The resulting top of file is:

```yaml
services:
  postgres:
    user: postgres
```

and there is no `worker:` service between `server:` and `migrate:`.

- [ ] **Step 4: Remove the staging workflow**

```bash
git rm .github/workflows/deploy-staging.yml
```

- [ ] **Step 5: Verify the server is unaffected**

Run: `make build-server && make lint-server && make test-server`
Expected: all green (this task only touched deploy/compose/config, not server source).

- [ ] **Step 6: Sanity-check no leaks and worker source is retained**

Run: `grep -rniE 'lengua|briankeane' render.yaml docker-compose.yaml scaffold.config.json; ls server/src/worker.ts server/src/scripts/startWorker.ts`
Expected: no grep matches; both worker source files still present.

- [ ] **Step 7: Commit**

```bash
git add scaffold.config.json render.yaml docker-compose.yaml
git rm .github/workflows/deploy-staging.yml
git commit -m "feat: slim scaffold to production-only base + add scaffold.config.json"
```

---

### Task 2: CLI package skeleton + config loader/validator

**Files:**
- Create: `tools/scaffold-cli/package.json`, `tools/scaffold-cli/tsconfig.json`, `tools/scaffold-cli/vitest.config.ts`
- Create: `tools/scaffold-cli/src/config.ts`
- Test: `tools/scaffold-cli/test/config.test.ts`
- Modify: `Makefile` (add `test-scaffold-cli`)

**Interfaces:**
- Produces: `loadConfig(rootDir): ScaffoldConfig`, `ConfigError`, `ScaffoldConfig`, `Desired` (consumed by every later task).

- [ ] **Step 1: Write `tools/scaffold-cli/package.json`**

```json
{
  "name": "@scaffold/cli",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "enable-staging": "tsx src/cli.ts enable-staging",
    "enable-jobs": "tsx src/cli.ts enable-jobs",
    "test": "vitest run"
  },
  "dependencies": {
    "yaml": "^2.6.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `tools/scaffold-cli/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Write `tools/scaffold-cli/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Install and pin the lockfile**

Run: `cd tools/scaffold-cli && npm install`
Expected: creates `node_modules` + `package-lock.json`. (`node_modules/` is already gitignored at repo root; the lockfile is committed.)

- [ ] **Step 5: Write the failing config test** — `tools/scaffold-cli/test/config.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, ConfigError } from '../src/config.js';

function tmpRoot(json: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'scaffold-cfg-'));
  if (json !== null) writeFileSync(join(dir, 'scaffold.config.json'), json);
  return dir;
}

describe('loadConfig', () => {
  it('loads a valid all-false config', () => {
    const dir = tmpRoot('{"features":{"staging":false,"jobs":false,"customDomain":false}}');
    expect(loadConfig(dir).features).toEqual({ staging: false, jobs: false, customDomain: false });
  });

  it('throws ConfigError when the file is missing', () => {
    const dir = tmpRoot(null);
    expect(() => loadConfig(dir)).toThrow(ConfigError);
  });

  it('throws ConfigError on invalid JSON', () => {
    const dir = tmpRoot('{ not json');
    expect(() => loadConfig(dir)).toThrow(ConfigError);
  });

  it('throws ConfigError when a feature flag is missing', () => {
    const dir = tmpRoot('{"features":{"staging":true}}');
    expect(() => loadConfig(dir)).toThrow(/jobs/);
  });

  it('throws ConfigError when a feature flag is not a boolean', () => {
    const dir = tmpRoot('{"features":{"staging":"yes","jobs":false,"customDomain":false}}');
    expect(() => loadConfig(dir)).toThrow(/staging/);
  });
});
```

- [ ] **Step 6: Run it red**

Run: `cd tools/scaffold-cli && npx vitest run test/config.test.ts`
Expected: FAIL (`config.js` not found).

- [ ] **Step 7: Implement `tools/scaffold-cli/src/config.ts`**

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ScaffoldConfig {
  features: { staging: boolean; jobs: boolean; customDomain: boolean };
}

export interface Desired {
  staging: boolean;
  jobs: boolean;
}

export class ConfigError extends Error {}

const FLAGS = ['staging', 'jobs', 'customDomain'] as const;

export function configPath(rootDir: string): string {
  return join(rootDir, 'scaffold.config.json');
}

export function loadConfig(rootDir: string): ScaffoldConfig {
  const path = configPath(rootDir);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new ConfigError(`scaffold.config.json not found at ${path}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(`scaffold.config.json is not valid JSON: ${(err as Error).message}`);
  }

  const features = (parsed as { features?: unknown }).features;
  if (features == null || typeof features !== 'object') {
    throw new ConfigError('scaffold.config.json must have a "features" object');
  }

  for (const flag of FLAGS) {
    const value = (features as Record<string, unknown>)[flag];
    if (typeof value !== 'boolean') {
      throw new ConfigError(`scaffold.config.json: features.${flag} must be a boolean`);
    }
  }

  return { features: { ...(features as ScaffoldConfig['features']) } };
}
```

- [ ] **Step 8: Run it green**

Run: `cd tools/scaffold-cli && npx vitest run test/config.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 9: Add the Makefile target** — insert after `test-client:` and add to `.PHONY`:

```make
test-scaffold-cli:
	cd tools/scaffold-cli && npm run test
```

- [ ] **Step 10: Commit**

```bash
git add tools/scaffold-cli/package.json tools/scaffold-cli/package-lock.json tools/scaffold-cli/tsconfig.json tools/scaffold-cli/vitest.config.ts tools/scaffold-cli/src/config.ts tools/scaffold-cli/test/config.test.ts Makefile
git commit -m "feat: scaffold-cli package skeleton + config validator"
```

---

### Task 3: YAML utilities + owned-block templates

**Files:**
- Create: `tools/scaffold-cli/src/yamlUtil.ts`
- Create: `tools/scaffold-cli/src/templates.ts`
- Test: `tools/scaffold-cli/test/yamlUtil.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseDoc(text)`, `stringifyDoc(doc)`, `structurallyEqual(a, b)`, `unifiedDiff(expected, actual, label)` (consumed by `renderPlanner`, `composePlanner`); and the template strings `STAGING_DB`, `STAGING_SERVER`, `STAGING_WORKER`, `PRODUCTION_WORKER`, `KEYVALUE`, `redisUrlEnvItem()`, `composeRedisService()`, `composeWorkerService()`, `DEPLOY_STAGING_WORKFLOW`.

- [ ] **Step 1: Write the failing test** — `tools/scaffold-cli/test/yamlUtil.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseDoc, stringifyDoc, structurallyEqual, unifiedDiff } from '../src/yamlUtil.js';

describe('structurallyEqual', () => {
  it('ignores comments, quote style, and key order', () => {
    const a = parseDoc('a: 1\n# comment\nb: "two"\n').get('a');
    const b = parseDoc('a: 1\n').get('a');
    expect(structurallyEqual(a, b)).toBe(true);
  });

  it('treats a quoted string and a number as different (no scalar coercion)', () => {
    const doc = parseDoc('x: "10020"\ny: 10020\n');
    expect(structurallyEqual(doc.get('x', true), doc.get('y', true))).toBe(false);
  });

  it('detects a changed value as unequal', () => {
    const a = parseDoc('k: node dist/server.js\n').get('k');
    const b = parseDoc('k: node dist/hacked.js\n').get('k');
    expect(structurallyEqual(a, b)).toBe(false);
  });
});

describe('stringifyDoc round-trip', () => {
  it('preserves a leading comment', () => {
    const text = '# hello\nfoo: bar\n';
    expect(stringifyDoc(parseDoc(text))).toContain('# hello');
  });
});

describe('unifiedDiff', () => {
  it('produces a readable diff with the label', () => {
    const d = unifiedDiff('a: 1\n', 'a: 2\n', 'production-server');
    expect(d).toContain('production-server');
    expect(d).toMatch(/-.*a: 1/);
    expect(d).toMatch(/\+.*a: 2/);
  });
});
```

- [ ] **Step 2: Run it red**

Run: `cd tools/scaffold-cli && npx vitest run test/yamlUtil.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `tools/scaffold-cli/src/yamlUtil.ts`**

```typescript
import { parseDocument, Document, isNode } from 'yaml';

export function parseDoc(text: string): Document.Parsed {
  return parseDocument(text, { keepSourceTokens: false });
}

// Deterministic stringify. `yaml` preserves comments and existing quote styles by
// default; keep line width unlimited so long image URLs / commands don't wrap.
export function stringifyDoc(doc: Document): string {
  return doc.toString({ lineWidth: 0 });
}

// Structural equality that ignores comments, anchors, and key order, but does NOT
// coerce scalar types: the quoted string "10020" and the number 10020 differ, and
// the quoted "off" and boolean false differ. Achieved by comparing the plain JS
// value of each node with types preserved (yaml keeps "10020" a string, 10020 a
// number), recursing structurally for maps/seqs.
export function structurallyEqual(a: unknown, b: unknown): boolean {
  const av = isNode(a) ? (a as any).toJSON() : a;
  const bv = isNode(b) ? (b as any).toJSON() : b;
  return deepEqualTyped(av, bv);
}

function deepEqualTyped(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqualTyped(x, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    if (ak.length !== bk.length || !ak.every((k, i) => k === bk[i])) return false;
    return ak.every((k) =>
      deepEqualTyped((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

// Minimal line-based unified diff for conflict messages (no external dep).
export function unifiedDiff(expected: string, actual: string, label: string): string {
  const e = expected.split('\n');
  const a = actual.split('\n');
  const out = [`--- expected (scaffold-owned: ${label})`, `+++ actual (in file)`];
  const max = Math.max(e.length, a.length);
  for (let i = 0; i < max; i++) {
    if (e[i] === a[i]) {
      if (e[i] !== undefined) out.push(`  ${e[i]}`);
    } else {
      if (e[i] !== undefined) out.push(`- ${e[i]}`);
      if (a[i] !== undefined) out.push(`+ ${a[i]}`);
    }
  }
  return out.join('\n');
}
```

- [ ] **Step 4: Run it green**

Run: `cd tools/scaffold-cli && npx vitest run test/yamlUtil.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `tools/scaffold-cli/src/templates.ts`** — the exact YAML for every owned block. Comments on inserted blocks are carried by parsing these template strings as documents and splicing their nodes (Task 4).

```typescript
// Each template is a top-level YAML fragment. renderPlanner parses it and lifts the
// single node it contains, so comments attached in the template travel with the node.

export const STAGING_DB = `- name: staging-db
  plan: basic-256mb
  region: ohio
`;

export const STAGING_SERVER = `- type: web
  name: staging-server
  runtime: image
  image:
    url: ghcr.io/YOUR_ORG/YOUR_REPO:staging
  region: ohio
  plan: starter
  dockerCommand: node dist/server.js
  preDeployCommand: node dist/scripts/predeployMigrate.js
  autoDeployTrigger: "off"
  healthCheckPath: /v1/healthCheck
  envVars:
    - key: NODE_ENV
      value: production
    - key: PORT
      value: "10020"
    - key: DATABASE_URL
      fromDatabase:
        name: staging-db
        property: connectionString
    # Remaining secrets (e.g. JWT_SECRET) live in the \`staging\` env group.
    - fromGroup: staging
`;

// Workers own their env wiring except REDIS_URL, which the jobs feature injects.
export const STAGING_WORKER = `- type: worker
  name: staging-worker
  runtime: image
  image:
    url: ghcr.io/YOUR_ORG/YOUR_REPO:staging
  region: ohio
  plan: starter
  dockerCommand: node dist/worker.js
  # The web service owns DB migrations (predeployMigrate.js). The worker only
  # validates env so it fails fast on bad config without racing that migration.
  preDeployCommand: node dist/scripts/checkEnv.js
  autoDeployTrigger: "off"
  envVars:
    - key: NODE_ENV
      value: production
    - key: PORT
      value: "10020"
    - key: DATABASE_URL
      fromDatabase:
        name: staging-db
        property: connectionString
    - fromGroup: staging
`;

export const PRODUCTION_WORKER = `- type: worker
  name: production-worker
  runtime: image
  image:
    url: ghcr.io/YOUR_ORG/YOUR_REPO:production
  region: ohio
  plan: starter
  dockerCommand: node dist/worker.js
  # The web service owns DB migrations (predeployMigrate.js). The worker only
  # validates env so it fails fast on bad config without racing that migration.
  preDeployCommand: node dist/scripts/checkEnv.js
  autoDeployTrigger: "off"
  envVars:
    - key: NODE_ENV
      value: production
    - key: PORT
      value: "10020"
    - key: DATABASE_URL
      fromDatabase:
        name: production-db
        property: connectionString
    - fromGroup: production
`;

// Single shared Key Value. ipAllowList is REQUIRED by Render's Blueprint spec;
// [] means internal-only (no public access). NOTE for PR3: staging + production
// share one Redis here (per the brief's single-keyvalue design) — revisit isolation
// during cloud provisioning.
export const KEYVALUE = `- type: keyvalue
  name: keyvalue
  plan: starter
  region: ohio
  ipAllowList: []
`;

// The REDIS_URL envVar item injected into each enabled env's server + worker,
// positioned after DATABASE_URL and before fromGroup.
export const REDIS_URL_ITEM = `- key: REDIS_URL
  fromService:
    name: keyvalue
    type: keyvalue
    property: connectionString
`;

// docker-compose additions (jobs). worker mirrors the existing server service shape.
export const COMPOSE_REDIS = `image: "redis:alpine"
ports:
  - "127.0.0.1:\${REDIS_PORT:-6379}:6379"
`;

export const COMPOSE_WORKER = `build:
  context: ./server
  dockerfile: Dockerfile
ports:
  - "127.0.0.1:\${WORKER_PORT:-10030}:10030"
expose:
  - 9229
volumes:
  - type: bind
    source: ./server
    target: /usr/src/app
  - /usr/src/app/node_modules
depends_on:
  - postgres
  - migrate
env_file:
  - ./server/.env
environment:
  REDIS_URL: redis://redis:6379
command: ["npm", "run", "worker"]
`;
```

- [ ] **Step 6: Commit**

```bash
git add tools/scaffold-cli/src/yamlUtil.ts tools/scaffold-cli/src/templates.ts tools/scaffold-cli/test/yamlUtil.test.ts
git commit -m "feat: yaml utilities + owned-block templates for scaffold-cli"
```

Note: `DEPLOY_STAGING_WORKFLOW` (whole-file `deploy-staging.yml` content) is added in Task 6, where its exact bytes are the oracle.

---

### Task 4: render.yaml reconciler (`planRender`)

**Files:**
- Create: `tools/scaffold-cli/src/renderPlanner.ts`
- Test: `tools/scaffold-cli/test/renderPlanner.test.ts`
- Create fixtures: `tools/scaffold-cli/test/fixtures/render/base.yaml` (copy of the Task-1 base `render.yaml`), `.../staging.yaml`, `.../jobs.yaml`, `.../staging-jobs.yaml`.

**Interfaces:**
- Consumes: `yamlUtil`, `templates`, `Desired`.
- Produces: `planRender(currentYaml, desired): Plan`.

**Reconciler design (pure):** parse the current document. Compute, from `desired`, the set of owned blocks that should exist and inject `REDIS_URL` where required, in two passes:

1. **Existence pass (databases, then services):** for each owned block name that `desired` requires (`staging-db` if `desired.staging`; `keyvalue` + `production-worker` if `desired.jobs`; `staging-server` if `desired.staging`; `staging-worker` if `desired.staging && desired.jobs`): if a block with that `name` is absent, splice the template node in at its **canonical position**; if present, compare it structurally against its template **ignoring any `REDIS_URL` envVar item** (that field is owned by the jobs feature, not this block) — equal ⇒ no-op, different ⇒ conflict.
2. **REDIS_URL pass:** only when `desired.jobs`. For each enabled env (`production` always; `staging` if `desired.staging`), for both that env's `*-server` and `*-worker`, ensure a `REDIS_URL` item exists in `envVars` positioned after `DATABASE_URL` / before `fromGroup`: absent ⇒ insert; present-and-equal ⇒ no-op; present-and-different ⇒ conflict.

Canonical index insertion: define `SERVICE_ORDER = ['keyvalue','staging-server','staging-worker','production-server','production-worker']` and `DB_ORDER = ['staging-db','production-db']`. To insert a block, find the first existing sibling whose canonical rank is greater than the new block's rank and splice before it (else push to end).

- [ ] **Step 1: Create the base fixture**

```bash
mkdir -p tools/scaffold-cli/test/fixtures/render
cp render.yaml tools/scaffold-cli/test/fixtures/render/base.yaml
```

- [ ] **Step 2: Write the failing existence/idempotency test** — `tools/scaffold-cli/test/renderPlanner.test.ts`

```typescript
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
    const mangled = once.replace('dockerCommand: node dist/server.js\n  preDeployCommand: node dist/scripts/predeployMigrate.js', 'dockerCommand: node dist/HACKED.js');
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
```

- [ ] **Step 3: Run it red**

Run: `cd tools/scaffold-cli && npx vitest run test/renderPlanner.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `tools/scaffold-cli/src/renderPlanner.ts`**

```typescript
import { YAMLSeq, YAMLMap, isMap, isSeq } from 'yaml';
import { parseDoc, stringifyDoc, structurallyEqual, unifiedDiff } from './yamlUtil.js';
import {
  STAGING_DB, STAGING_SERVER, STAGING_WORKER, PRODUCTION_WORKER, KEYVALUE, REDIS_URL_ITEM,
} from './templates.js';
import type { Desired, Plan, Conflict } from './config.js';

const DB_ORDER = ['staging-db', 'production-db'];
const SERVICE_ORDER = ['keyvalue', 'staging-server', 'staging-worker', 'production-server', 'production-worker'];

// Parse a one-item template fragment and return its single node.
function templateNode(fragment: string) {
  const seq = parseDoc(fragment).contents as YAMLSeq;
  return seq.items[0];
}

function nameOf(node: unknown): string | undefined {
  return isMap(node) ? (node.get('name') as string | undefined) : undefined;
}

function findByName(seq: YAMLSeq, name: string): YAMLMap | undefined {
  return seq.items.find((it) => nameOf(it) === name) as YAMLMap | undefined;
}

function insertCanonical(seq: YAMLSeq, order: string[], node: YAMLMap): void {
  const rank = order.indexOf(nameOf(node)!);
  const idx = seq.items.findIndex((it) => {
    const r = order.indexOf(nameOf(it) ?? '');
    return r > rank;
  });
  if (idx === -1) seq.items.push(node);
  else seq.items.splice(idx, 0, node);
}

// A copy of `map` with any REDIS_URL envVar item removed, for template comparison
// (REDIS_URL is owned by the jobs feature, not by the service block itself).
function withoutRedis(map: YAMLMap): unknown {
  const json = map.toJSON() as { envVars?: Array<Record<string, unknown>> };
  if (json.envVars) json.envVars = json.envVars.filter((e) => e.key !== 'REDIS_URL');
  return json;
}

function reconcileBlock(
  seq: YAMLSeq, order: string[], fragment: string, conflicts: Conflict[],
): boolean {
  const node = templateNode(fragment) as YAMLMap;
  const name = nameOf(node)!;
  const existing = findByName(seq, name);
  if (!existing) {
    insertCanonical(seq, order, node);
    return true;
  }
  // Compare ignoring REDIS_URL on both sides.
  if (!structurallyEqual(withoutRedis(existing), withoutRedis(node))) {
    conflicts.push({
      block: `services/databases: ${name}`,
      diff: unifiedDiff(stringifyOne(node), stringifyOne(existing), name),
    });
  }
  return false;
}

function stringifyOne(node: unknown): string {
  const seq = new YAMLSeq();
  (seq.items as unknown[]).push(node);
  const doc = parseDoc('');
  doc.contents = seq;
  return stringifyDoc(doc);
}

// Insert REDIS_URL into a server/worker map's envVars after DATABASE_URL, before fromGroup.
function ensureRedisUrl(map: YAMLMap | undefined, conflicts: Conflict[]): boolean {
  if (!map) return false;
  const envVars = map.get('envVars') as YAMLSeq | undefined;
  if (!isSeq(envVars)) return false;
  const redisNode = templateNode(REDIS_URL_ITEM) as YAMLMap;
  const existing = envVars.items.find(
    (it) => isMap(it) && it.get('key') === 'REDIS_URL',
  ) as YAMLMap | undefined;
  if (existing) {
    if (!structurallyEqual(existing.toJSON(), redisNode.toJSON())) {
      conflicts.push({
        block: `${map.get('name')}: REDIS_URL`,
        diff: unifiedDiff(stringifyOne(redisNode), stringifyOne(existing), 'REDIS_URL'),
      });
    }
    return false;
  }
  const groupIdx = envVars.items.findIndex((it) => isMap(it) && it.has('fromGroup'));
  if (groupIdx === -1) envVars.items.push(redisNode);
  else envVars.items.splice(groupIdx, 0, redisNode);
  return true;
}

export function planRender(currentYaml: string, desired: Desired): Plan {
  const doc = parseDoc(currentYaml);
  const dbs = doc.get('databases') as YAMLSeq;
  const services = doc.get('services') as YAMLSeq;
  const conflicts: Conflict[] = [];
  let changed = false;

  // Existence pass
  if (desired.staging) changed = reconcileBlock(dbs, DB_ORDER, STAGING_DB, conflicts) || changed;
  if (desired.jobs) changed = reconcileBlock(services, SERVICE_ORDER, KEYVALUE, conflicts) || changed;
  if (desired.staging) changed = reconcileBlock(services, SERVICE_ORDER, STAGING_SERVER, conflicts) || changed;
  if (desired.staging && desired.jobs) changed = reconcileBlock(services, SERVICE_ORDER, STAGING_WORKER, conflicts) || changed;
  if (desired.jobs) changed = reconcileBlock(services, SERVICE_ORDER, PRODUCTION_WORKER, conflicts) || changed;

  // REDIS_URL pass
  if (desired.jobs) {
    const envs = ['production', ...(desired.staging ? ['staging'] : [])];
    for (const env of envs) {
      changed = ensureRedisUrl(findByName(services, `${env}-server`), conflicts) || changed;
      changed = ensureRedisUrl(findByName(services, `${env}-worker`), conflicts) || changed;
    }
  }

  if (conflicts.length > 0) return { ok: false, conflicts };
  return { ok: true, output: stringifyDoc(doc), changed };
}
```

Note: move the `Conflict` and `Plan` type exports into `config.ts` (or a shared `types.ts`) so both planners import them; adjust the import in Step 4 accordingly if you keep them in a separate file.

- [ ] **Step 5: Run it green**

Run: `cd tools/scaffold-cli && npx vitest run test/renderPlanner.test.ts`
Expected: PASS. If the canonical-position or REDIS_URL-position assertions fail, fix the planner (not the test) until green.

- [ ] **Step 6: Freeze the golden output fixtures** (generate from the now-green planner, eyeball them, commit as the oracle):

```bash
cd tools/scaffold-cli
npx tsx -e "import {planRender} from './src/renderPlanner.js';import {readFileSync,writeFileSync} from 'node:fs';const b=readFileSync('test/fixtures/render/base.yaml','utf8');const w=(f,d)=>{const p=planRender(b,d);if(!p.ok)throw new Error(f);writeFileSync('test/fixtures/render/'+f,p.output)};w('staging.yaml',{staging:true,jobs:false});w('jobs.yaml',{staging:false,jobs:true});const s=planRender(b,{staging:true,jobs:false});w('staging-jobs.yaml',{staging:true,jobs:true});"
```

Read each generated fixture and confirm: comments preserved, `autoDeployTrigger: "off"` and `PORT: "10020"` still quoted, `ipAllowList: []` present, `REDIS_URL` before `fromGroup`. Then add a golden assertion to the test:

```typescript
it('matches the committed golden files byte-for-byte', () => {
  expect(ok(planRender(fx('base.yaml'), { staging: true, jobs: false })).output).toBe(fx('staging.yaml'));
  expect(ok(planRender(fx('base.yaml'), { staging: false, jobs: true })).output).toBe(fx('jobs.yaml'));
  const s = ok(planRender(fx('base.yaml'), { staging: true, jobs: false })).output;
  expect(ok(planRender(s, { staging: true, jobs: true })).output).toBe(fx('staging-jobs.yaml'));
});
```

- [ ] **Step 7: Run green + commit**

```bash
cd tools/scaffold-cli && npx vitest run test/renderPlanner.test.ts
cd ../.. && git add tools/scaffold-cli/src/renderPlanner.ts tools/scaffold-cli/test/renderPlanner.test.ts tools/scaffold-cli/test/fixtures/render
git commit -m "feat: render.yaml reconciler with canonical ordering, idempotency, conflict diffs"
```

---

### Task 5: docker-compose patcher (`planCompose`)

**Files:**
- Create: `tools/scaffold-cli/src/composePlanner.ts`
- Test: `tools/scaffold-cli/test/composePlanner.test.ts`
- Create fixtures: `tools/scaffold-cli/test/fixtures/compose/base.yaml` (copy of slimmed `docker-compose.yaml`), `.../jobs.yaml`.

**Interfaces:**
- Consumes: `yamlUtil`, `templates`, `Desired`.
- Produces: `planCompose(currentYaml, desired): Plan`. Only `desired.jobs` matters (staging does not change compose). Adds a `redis` service and a `worker` service (owned blocks keyed by service name under the `services` map). Idempotent; conflict if a present `redis`/`worker` differs from template.

- [ ] **Step 1: Create the base fixture**

```bash
mkdir -p tools/scaffold-cli/test/fixtures/compose
cp docker-compose.yaml tools/scaffold-cli/test/fixtures/compose/base.yaml
```

- [ ] **Step 2: Write the failing test** — `tools/scaffold-cli/test/composePlanner.test.ts`

```typescript
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
      expect(p.output).toContain("command: [\"npm\", \"run\", \"worker\"]");
      expect(p.output).toContain('REDIS_URL: redis://redis:6379');
    }
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
});
```

- [ ] **Step 3: Run red, implement `composePlanner.ts`, run green.** Implementation mirrors `renderPlanner` but simpler — `services` is a **map** (not a seq), so insert keyed nodes. Insert `worker` after `server`, `redis` at the top of the services map (order is cosmetic for compose; pick one and keep it fixed for idempotency). Build each service node from `parseDoc('key:\n' + indentedTemplate)` or by assigning a parsed map. Compare an existing `redis`/`worker` structurally against its template; conflict ⇒ diff.

```typescript
import { YAMLMap, isMap } from 'yaml';
import { parseDoc, stringifyDoc, structurallyEqual, unifiedDiff } from './yamlUtil.js';
import { COMPOSE_REDIS, COMPOSE_WORKER } from './templates.js';
import type { Desired, Plan, Conflict } from './config.js';

function serviceNode(fragment: string): YAMLMap {
  return parseDoc(fragment).contents as YAMLMap;
}

function reconcileService(
  services: YAMLMap, key: string, fragment: string, conflicts: Conflict[], afterKey?: string,
): boolean {
  const node = serviceNode(fragment);
  if (services.has(key)) {
    const existing = services.get(key) as YAMLMap;
    if (!structurallyEqual(existing.toJSON(), node.toJSON())) {
      conflicts.push({ block: `compose: ${key}`, diff: unifiedDiff(stringifyDoc(makeDoc(node)), stringifyDoc(makeDoc(existing)), key) });
    }
    return false;
  }
  // insert (optionally after a given key for readable output)
  const pair = services.createPair(key, node);
  if (afterKey && services.has(afterKey)) {
    const idx = services.items.findIndex((p) => String((p.key as any).value ?? p.key) === afterKey);
    services.items.splice(idx + 1, 0, pair);
  } else {
    services.items.unshift(pair);
  }
  return true;
}

function makeDoc(node: unknown) {
  const d = parseDoc('');
  d.contents = node as any;
  return d;
}

export function planCompose(currentYaml: string, desired: Desired): Plan {
  const doc = parseDoc(currentYaml);
  const services = doc.get('services') as YAMLMap;
  const conflicts: Conflict[] = [];
  let changed = false;
  if (desired.jobs) {
    changed = reconcileService(services, 'redis', COMPOSE_REDIS, conflicts) || changed;
    changed = reconcileService(services, 'worker', COMPOSE_WORKER, conflicts, 'server') || changed;
  }
  if (conflicts.length > 0) return { ok: false, conflicts };
  return { ok: true, output: stringifyDoc(doc), changed };
}
```

Verify `createPair`/`items.splice` produces the intended layout; adjust the insertion helper if the `yaml` version's map-pair API differs. Freeze `fixtures/compose/jobs.yaml` from the green planner (same generate-and-eyeball flow as Task 4 Step 6) and add a byte-equal golden assertion.

- [ ] **Step 4: Commit**

```bash
git add tools/scaffold-cli/src/composePlanner.ts tools/scaffold-cli/test/composePlanner.test.ts tools/scaffold-cli/test/fixtures/compose
git commit -m "feat: docker-compose jobs patcher (redis + worker services)"
```

---

### Task 6: deploy-staging.yml whole-file writer (`planStagingWorkflow`)

**Files:**
- Modify: `tools/scaffold-cli/src/templates.ts` (add `DEPLOY_STAGING_WORKFLOW`)
- Create: `tools/scaffold-cli/src/workflowPlanner.ts`
- Test: `tools/scaffold-cli/test/workflowPlanner.test.ts`
- Create fixture: `tools/scaffold-cli/test/fixtures/deploy-staging.yml`

**Interfaces:**
- Consumes: `templates`.
- Produces: `planStagingWorkflow(exists, currentContent, desiredStaging): WorkflowPlan`, `WorkflowConflictError`.

The `deploy-staging.yml` content is PR1's exact job graph on the `develop` branch. Its bytes are the oracle — recover them from git and embed verbatim.

- [ ] **Step 1: Recover PR1's staging workflow bytes**

```bash
git show ad671e7^:.github/workflows/deploy-staging.yml > /dev/null 2>&1 || true
git log --oneline -- .github/workflows/deploy-staging.yml   # find the commit that had it
git show <sha>:.github/workflows/deploy-staging.yml > tools/scaffold-cli/test/fixtures/deploy-staging.yml
```

(Its content is the `deploy-staging.yml` that existed on this branch before Task 1 removed it — the file read at plan time: `name: Deploy Staging`, `on: push: branches: [develop]`, the `concurrency: group: deploy-staging`, the standalone `image-name` job consumed via `needs`, `check-render`, `build-and-push-image` building `-t "$IMAGE:staging"`, and `deploy-to-render` with the `deploy_and_wait` function deploying `staging-server` + optional `staging-worker`.) Embed those exact bytes as `DEPLOY_STAGING_WORKFLOW` in `templates.ts`, and make the fixture identical.

- [ ] **Step 2: Write the failing test** — `tools/scaffold-cli/test/workflowPlanner.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planStagingWorkflow, WorkflowConflictError } from '../src/workflowPlanner.js';
import { DEPLOY_STAGING_WORKFLOW } from '../src/templates.js';

const golden = readFileSync(join(__dirname, 'fixtures/deploy-staging.yml'), 'utf8');

describe('planStagingWorkflow', () => {
  it('template equals the committed PR1 job graph exactly', () => {
    expect(DEPLOY_STAGING_WORKFLOW).toBe(golden);
  });
  it('creates the file when absent', () => {
    const p = planStagingWorkflow(false, null, true);
    expect(p.action).toBe('create');
    if (p.action === 'create') expect(p.content).toBe(golden);
  });
  it('is a no-op when present and identical', () => {
    expect(planStagingWorkflow(true, golden, true).action).toBe('none');
  });
  it('throws a conflict when present but hand-edited', () => {
    expect(() => planStagingWorkflow(true, golden.replace('Deploy Staging', 'Hacked'), true)).toThrow(WorkflowConflictError);
  });
});
```

- [ ] **Step 3: Implement `workflowPlanner.ts`**, run red→green:

```typescript
import { DEPLOY_STAGING_WORKFLOW } from './templates.js';
import { unifiedDiff } from './yamlUtil.js';

export type WorkflowPlan = { action: 'create'; content: string } | { action: 'none' };

export class WorkflowConflictError extends Error {
  constructor(public diff: string) { super('deploy-staging.yml was hand-edited; refusing to clobber'); }
}

export function planStagingWorkflow(
  exists: boolean, currentContent: string | null, desiredStaging: boolean,
): WorkflowPlan {
  if (!desiredStaging) return { action: 'none' };
  if (!exists) return { action: 'create', content: DEPLOY_STAGING_WORKFLOW };
  if (currentContent === DEPLOY_STAGING_WORKFLOW) return { action: 'none' };
  throw new WorkflowConflictError(unifiedDiff(DEPLOY_STAGING_WORKFLOW, currentContent ?? '', 'deploy-staging.yml'));
}
```

- [ ] **Step 4: Commit**

```bash
git add tools/scaffold-cli/src/templates.ts tools/scaffold-cli/src/workflowPlanner.ts tools/scaffold-cli/test/workflowPlanner.test.ts tools/scaffold-cli/test/fixtures/deploy-staging.yml
git commit -m "feat: deploy-staging.yml whole-file writer with conflict detection"
```

---

### Task 7: transactional apply + command orchestration + CLI entry + Makefile + README

**Files:**
- Create: `tools/scaffold-cli/src/apply.ts`, `tools/scaffold-cli/src/commands.ts`, `tools/scaffold-cli/src/cli.ts`
- Test: `tools/scaffold-cli/test/commands.test.ts`
- Modify: `Makefile` (add `enable-staging`, `enable-jobs`), `README.md` (Optional features stub)

**Interfaces:**
- Consumes: all planners + `loadConfig`.
- Produces: `enableStaging(rootDir)`, `enableJobs(rootDir)` (each returns an exit code; 0 success, 1 conflict), CLI dispatch.

**Transactional rule (from architecture review):** compute every patch first; if any planner returns conflicts, print all diffs, write nothing, exit 1. Only when all clean: write each changed file, then flip the config flag **last** (write `scaffold.config.json` after the infra files so a crash never leaves the flag true with un-patched files).

- [ ] **Step 1: Write the failing end-to-end test** — `tools/scaffold-cli/test/commands.test.ts`. It copies the three real base files into a temp dir and runs the commands against it.

```typescript
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enableStaging, enableJobs } from '../src/commands.js';

const REPO = join(__dirname, '../../..'); // repo root

function freshRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scaffold-e2e-'));
  cpSync(join(REPO, 'render.yaml'), join(dir, 'render.yaml'));
  cpSync(join(REPO, 'docker-compose.yaml'), join(dir, 'docker-compose.yaml'));
  cpSync(join(REPO, 'scaffold.config.json'), join(dir, 'scaffold.config.json'));
  mkdirSync(join(dir, '.github/workflows'), { recursive: true });
  return dir;
}
const cfg = (d: string) => JSON.parse(readFileSync(join(d, 'scaffold.config.json'), 'utf8')).features;

describe('enable commands', () => {
  it('enable-staging flips the flag, adds workflow + staging blocks, is idempotent', () => {
    const d = freshRoot();
    expect(enableStaging(d)).toBe(0);
    expect(cfg(d).staging).toBe(true);
    expect(existsSync(join(d, '.github/workflows/deploy-staging.yml'))).toBe(true);
    expect(readFileSync(join(d, 'render.yaml'), 'utf8')).toContain('name: staging-server');
    const snapshot = readFileSync(join(d, 'render.yaml'), 'utf8');
    expect(enableStaging(d)).toBe(0); // idempotent
    expect(readFileSync(join(d, 'render.yaml'), 'utf8')).toBe(snapshot);
  });

  it('both orders converge to identical render.yaml + compose + config', () => {
    const a = freshRoot();
    enableStaging(a); enableJobs(a);
    const b = freshRoot();
    enableJobs(b); enableStaging(b);
    expect(readFileSync(join(a, 'render.yaml'), 'utf8')).toBe(readFileSync(join(b, 'render.yaml'), 'utf8'));
    expect(readFileSync(join(a, 'docker-compose.yaml'), 'utf8')).toBe(readFileSync(join(b, 'docker-compose.yaml'), 'utf8'));
    expect(cfg(a)).toEqual(cfg(b));
    expect(cfg(a)).toEqual({ staging: true, jobs: true, customDomain: false });
  });

  it('a conflict aborts with exit 1 and mutates nothing (flag stays, files unchanged)', () => {
    const d = freshRoot();
    enableStaging(d);
    const before = readFileSync(join(d, 'render.yaml'), 'utf8');
    // hand-mangle the owned staging-server block
    writeFileSync(join(d, 'render.yaml'), before.replace('node dist/server.js', 'node dist/HACKED.js'));
    const mangled = readFileSync(join(d, 'render.yaml'), 'utf8');
    const codeBefore = cfg(d).jobs;
    expect(enableJobs(d)).toBe(1);
    expect(readFileSync(join(d, 'render.yaml'), 'utf8')).toBe(mangled); // untouched
    expect(cfg(d).jobs).toBe(codeBefore); // flag not flipped
  });
});
```

- [ ] **Step 2: Run red, implement `apply.ts` + `commands.ts` + `cli.ts`, run green.**

`apply.ts`:

```typescript
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, configPath, type ScaffoldConfig } from './config.js';

export interface FileWrite { path: string; content: string }

// Write infra files first, config flag last.
export function commitWrites(rootDir: string, writes: FileWrite[], nextConfig: ScaffoldConfig): void {
  for (const w of writes) writeFileSync(w.path, w.content);
  writeFileSync(configPath(rootDir), JSON.stringify(nextConfig, null, 2) + '\n');
}
```

`commands.ts` (shows `enableStaging`; `enableJobs` is symmetric — render + compose + flag `jobs`):

```typescript
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './config.js';
import { planRender } from './renderPlanner.js';
import { planCompose } from './composePlanner.js';
import { planStagingWorkflow, WorkflowConflictError } from './workflowPlanner.js';
import { DEPLOY_STAGING_WORKFLOW } from './templates.js';
import { commitWrites, type FileWrite } from './apply.js';

const RENDER = 'render.yaml';
const COMPOSE = 'docker-compose.yaml';
const WORKFLOW = '.github/workflows/deploy-staging.yml';

function printConflicts(label: string, conflicts: { block: string; diff: string }[]): void {
  console.error(`\n${label} would clobber hand-edited scaffold-owned block(s). Aborting; nothing was changed.\n`);
  for (const c of conflicts) console.error(`  [${c.block}]\n${c.diff}\n`);
}

export function enableStaging(rootDir: string): number {
  const config = loadConfig(rootDir);
  const desired = { staging: true, jobs: config.features.jobs };
  const writes: FileWrite[] = [];

  const render = planRender(readFileSync(join(rootDir, RENDER), 'utf8'), desired);
  if (!render.ok) { printConflicts('enable-staging', render.conflicts); return 1; }
  if (render.changed) writes.push({ path: join(rootDir, RENDER), content: render.output });

  const wfPath = join(rootDir, WORKFLOW);
  try {
    const exists = existsSync(wfPath);
    const wf = planStagingWorkflow(exists, exists ? readFileSync(wfPath, 'utf8') : null, true);
    if (wf.action === 'create') writes.push({ path: wfPath, content: wf.content });
  } catch (err) {
    if (err instanceof WorkflowConflictError) { printConflicts('enable-staging', [{ block: WORKFLOW, diff: err.diff }]); return 1; }
    throw err;
  }

  commitWrites(rootDir, writes, { features: { ...config.features, staging: true } });
  console.log('Staging enabled.');
  return 0;
}

export function enableJobs(rootDir: string): number {
  const config = loadConfig(rootDir);
  const desired = { staging: config.features.staging, jobs: true };
  const writes: FileWrite[] = [];

  const render = planRender(readFileSync(join(rootDir, RENDER), 'utf8'), desired);
  if (!render.ok) { printConflicts('enable-jobs', render.conflicts); return 1; }
  if (render.changed) writes.push({ path: join(rootDir, RENDER), content: render.output });

  const compose = planCompose(readFileSync(join(rootDir, COMPOSE), 'utf8'), desired);
  if (!compose.ok) { printConflicts('enable-jobs', compose.conflicts); return 1; }
  if (compose.changed) writes.push({ path: join(rootDir, COMPOSE), content: compose.output });

  commitWrites(rootDir, writes, { features: { ...config.features, jobs: true } });
  console.log('Background jobs enabled.');
  return 0;
}
```

`cli.ts`:

```typescript
import { enableStaging, enableJobs } from './commands.js';

const cmd = process.argv[2];
const rootDir = process.cwd(); // make runs from repo root
const table: Record<string, (r: string) => number> = { 'enable-staging': enableStaging, 'enable-jobs': enableJobs };
const fn = table[cmd];
if (!fn) {
  console.error(`Usage: scaffold-cli <enable-staging|enable-jobs>`);
  process.exit(2);
}
process.exit(fn(rootDir));
```

- [ ] **Step 3: Add Makefile targets** (host-run tsx; the CLI is meta-tooling, not a container app) after `test-scaffold-cli:` and extend `.PHONY`:

```make
enable-staging:
	cd tools/scaffold-cli && npm run enable-staging

enable-jobs:
	cd tools/scaffold-cli && npm run enable-jobs
```

- [ ] **Step 4: Add the README "Optional features" stub** (short; full runbooks are PR3). Append a section:

```markdown
## Optional features

New projects start production-only. `scaffold.config.json` at the repo root is the
single source of truth for which optional features are on:

    { "features": { "staging": false, "jobs": false, "customDomain": false } }

Add features later with idempotent one-shot commands (safe to re-run):

- `make enable-staging` — adds a staging database + server on Render and the
  `deploy-staging.yml` workflow (deploys on pushes to `develop`).
- `make enable-jobs` — adds background jobs: a Redis (Key Value) service and a
  worker for every enabled environment, wiring `REDIS_URL` into each.

Each command patches the relevant scaffold-owned blocks in `render.yaml`,
`docker-compose.yaml`, and the workflow(s), and flips the flag in
`scaffold.config.json`. If you have hand-edited a scaffold-owned block in a way the
patcher can't reconcile, it aborts with a diff and changes nothing.
```

- [ ] **Step 5: Run the whole CLI suite green + commit**

```bash
cd tools/scaffold-cli && npm run test
cd ../.. && git add tools/scaffold-cli/src/apply.ts tools/scaffold-cli/src/commands.ts tools/scaffold-cli/src/cli.ts tools/scaffold-cli/test/commands.test.ts Makefile README.md
git commit -m "feat: enable-staging / enable-jobs commands with transactional apply + make targets"
```

---

### Task 8: Full acceptance verification

**Files:** none (verification only).

- [ ] **Step 1: Fresh-clone base assertions**

Run:
```bash
grep -c 'name: staging' render.yaml   # expect 0
grep -c 'name: production-server' render.yaml  # expect 1
test ! -f .github/workflows/deploy-staging.yml && echo "no staging workflow OK"
grep -Eic 'worker|redis' docker-compose.yaml   # expect 0
cat scaffold.config.json   # all false
```
Expected: 0 staging refs, 1 production-server, no staging workflow, 0 worker/redis in compose, all-false config.

- [ ] **Step 2: Live round-trip on the real repo (throwaway, both orders)** — verify the CLI mutates the real files as expected, then restore:

```bash
git stash --include-untracked --quiet 2>/dev/null || true   # ensure clean
make enable-staging && make enable-jobs
grep -c 'key: REDIS_URL' render.yaml    # expect 4 (staging+prod server+worker)
grep -c 'ipAllowList' render.yaml       # expect 1
test -f .github/workflows/deploy-staging.yml && echo "staging workflow created OK"
grep -Eic 'worker:|redis:' docker-compose.yaml  # expect >=2
make enable-staging && make enable-jobs # re-run: must be a no-op
git diff --stat                          # second run changed nothing new
git checkout -- render.yaml docker-compose.yaml scaffold.config.json && rm -f .github/workflows/deploy-staging.yml
```
Expected: 4 REDIS_URL, 1 ipAllowList, workflow present, worker+redis in compose; the second `make enable-*` produces no further diff; repo restored to base afterward.

- [ ] **Step 3: Gates**

Run: `make build-server && make lint-server && make test-server && make test-client && make lint-client && make test-scaffold-cli`
Expected: all green.

- [ ] **Step 4: Prettier + leak scan + intentional-staging only**

Run: `make prettier-all; grep -rniE 'lengua|briankeane' render.yaml docker-compose.yaml scaffold.config.json tools/scaffold-cli README.md; git status`
Expected: no leaks; `git status` shows only intentional files (no `client/vite.config.js` / `*.tsbuildinfo` regenerated artifacts staged — if prettier touched artifacts, do not stage them).

- [ ] **Step 5: Codex adversarial pass on the final diff**

Run `/codex review` then `/codex challenge` (session `.context/codex-session-id` has the PR2 architecture context). Fix everything surfaced; re-run if fixes were non-trivial.

- [ ] **Step 6: Open the PR**

```bash
gh pr create --base develop --title "PR2: scaffold optionality core (scaffold.config.json + enable-staging/enable-jobs)" --body "<summary>"
```
Then run `/fix-review`; re-run after any push. Do not trigger a Greptile re-review at confidence ≥ 4/5.

---

## Self-Review (completed during planning)

- **Spec coverage:** decision 1 (single source of truth) → Task 1 config + `loadConfig`; decision 2 (idempotent patching, fail-with-diff) → Tasks 4–7 planners + conflict tests; decision 6 (no idle worker) → Task 1 slim + Task 5 jobs-gated worker. "Base-scaffold defaults" → Task 1 exact base files. Brief target states (base / enable-staging / enable-jobs), cross-feature ordering, all five required test kinds, Makefile targets, README stub, acceptance criteria → Tasks 1–8.
- **Type consistency:** `Desired`, `Plan`, `Conflict`, `ScaffoldConfig` are defined in `config.ts` and imported everywhere; planner signatures (`planRender`/`planCompose` → `Plan`, `planStagingWorkflow` → `WorkflowPlan`) match their call sites in `commands.ts`.
- **Known implementation risks to watch (verify against the installed `yaml` version during coding, do not assume):** (1) the exact map-pair insertion API in `composePlanner` (`createPair`/`items.splice`); (2) `toString({ lineWidth: 0 })` not re-wrapping or re-quoting existing scalars — if it does, freeze goldens from actual output and keep templates matching; (3) splicing a template node built by `parseDocument` into another document — if comment attachment is lost, build the node in the same doc via `doc.createNode` and set `commentBefore`. These are the pieces most likely to need a second attempt; stop and reassess after 3 tries per the global 3-attempt rule.

# Scaffold Deploy Hardening + One-Command Setup — Design

**Date:** 2026-08-18
**Branch:** `briankeane/lengua-scaffold-improvements`
**Status:** Design (awaiting review)

## Problem

`node-react-scaffold` is a reusable monorepo starter (Node/TS/Express/Sequelize/Postgres
server → Docker image on Render; React/Vite client → Netlify; CI in GitHub Actions).
Standing up a new project from it — especially deployment — is painful and manual. The
downstream project `lengua` hardened the deploy path in production and proved a set of
fixes we want to fold back in. We also want new projects to reach a running local stack
and a working cloud deploy with as few manual steps as possible.

Two goals:

1. **Port lengua's proven infra improvements** into the scaffold, reconciled with the
   scaffold's staging+production model.
2. **A setup system** that stands up the whole stack (local dev + optional cloud
   provisioning) with minimal clicks — deterministic TypeScript wherever possible
   (~90% TS / ~10% LLM).

Two cross-cutting constraints, decided with the user:

- **Staging is optional.** A project opts in or out up front, and can add staging
  **later** via a one-shot idempotent command.
- **Background jobs (Redis + worker) are optional** the same way, off by default.

## Key Decisions (validated against an independent architecture review)

1. **Single source of truth = committed `scaffold.config.json`.** Feature state
   (`staging`, `jobs`, `customDomain`) lives in one committed file, not inferred from
   "which files exist" or "which secrets are set." Secrets are deployment credentials,
   not architecture; inferring features from them spreads implicit state and rots.

2. **"Add later" = idempotent structural patching, not regeneration.** Enable commands
   edit **named, scaffold-owned blocks** inside `render.yaml` / workflows / compose using
   YAML-aware parsing. If a user has incompatibly hand-edited an owned block, the patcher
   **fails with a diff** rather than clobbering. Files are not disposable generated output
   after project creation.

3. **Render is Blueprint-canonical.** `render.yaml` is the committed IaC source of truth
   for Render topology. The single unavoidable manual step is the first "New Blueprint
   Instance" click in the Render dashboard (Render has no public API to create a Blueprint
   instance from a repo). The Render API is used only for **operational** actions: trigger
   a deploy pinned to an image, poll to `live`, fetch service IDs, set env-group values.
   Not for owning topology.

4. **Production builds its own immutable image.** Every push builds and pushes
   `:<git-sha>` (plus a moving `:production` tag) and deploys **pinned to the SHA**.
   Production never depends on staging existing. "Must have flowed through staging" — if
   wanted — becomes an optional **policy gate**, never a topology dependency. This is what
   makes staging genuinely optional.

5. **The LLM never owns policy gates.** Paid/irreversible actions (create a Postgres,
   expose a Redis, create Netlify sites) are gated by the **TS CLI**, which prints the
   cost/impact and requires confirmation. The LLM only: interprets ambiguous setup intent,
   explains registrar-specific DNS steps, and diagnoses failures from logs.

6. **No idle worker.** The optional unit is **"background jobs" = Redis keyvalue + worker
   service, together.** The base scaffold ships neither. (Today the scaffold ships a worker
   with Redis commented out — a paid, confusing no-op.)

### Base-scaffold defaults

`{ "features": { "staging": false, "jobs": false, "customDomain": false } }`

Production is always present. The committed base `render.yaml` therefore declares: the
managed Postgres DB + `production-server` only. No worker, no keyvalue, no staging.
Enabling a feature patches the relevant blocks in.

## Universal improvements to port (apply regardless of optionality)

From lengua, these are strict improvements and land first:

- **`server/src/scripts/predeployMigrate.ts`** — single Node entrypoint for Render's
  `preDeployCommand` (validate env, then migrate, non-zero exit on failure). Fixes the
  real bug that Render runs `preDeployCommand` with **no shell**, so `checkEnv && migrate`
  silently skipped the migration.
- **`render.yaml`**: `dockerCommand` (not `startCommand`, ignored for `runtime: image`);
  `autoDeployTrigger: "off"` (correct field); DB declared in-Blueprint with `DATABASE_URL`
  wired via `fromDatabase`; `PORT`/`NODE_ENV` inline; secrets via an env group; the
  hard-won explanatory comments.
- **Deploy workflow**: build the image in CI from `server/Dockerfile.production` using the
  built-in `GITHUB_TOKEN` (no GHCR PAT); push `:<git-sha>` + `:production`; deploy pinned
  to the SHA via Render API `imageUrl`; robust `deploy_and_wait` polling that catches
  `pre_deploy_failed`; `concurrency` group to serialize deploys.
- **`netlify.toml`** — client build config (base `client/`, SPA redirect, Node pin,
  `VITE_SERVER_BASE_URL`).
- **`scripts/set-ports.sh`** — cross-platform `sed` fix (BSD vs GNU in-place flag differ),
  Redis port allocation, container-PORT-is-constant fix + comments.
- **`.conductor/settings.toml`** — committed Conductor defaults (setup/archive/run) for
  one-click workspace bring-up.
- **README** — Render + Netlify runbooks (initial setup order, deploy, rollback, custom
  domain, Cloudflare grey-cloud gotcha).

## Architecture

### Feature config
`scaffold.config.json` at repo root. Read by every TS generator/patcher. Schema
validated in TS. Committed and reviewed like any code.

### Setup CLI (`scripts/setup/`, TypeScript)
Deterministic, unit-testable. Commands:

- `setup local` — copy env files, allocate ports (`set-ports.sh`), build + start compose.
  Wraps existing scripts; leans on `.conductor/settings.toml` for the one-click path.
- `setup cloud` — provision the cloud path with CLI-owned confirmation gates:
  create/verify the Render env group + push first image; pause at the single Render
  dashboard Blueprint click with exact instructions and a deep link; resume and read
  service IDs via the Render API; create Netlify site(s); set all GitHub Actions secrets
  via `gh secret set`; set GHCR package visibility via `gh api`.
- `enable staging` / `enable jobs` / `enable domain` — idempotent patchers that mutate
  named owned-blocks in `render.yaml`, the workflow(s), and `docker-compose.yaml`, and
  flip the flag in `scaffold.config.json`. Re-running is a no-op. Conflicting hand-edits
  fail loudly with a diff.

Each command is a thin `main()` over pure functions (patch planners, API clients,
templaters) so the logic is tested without hitting real services (inject the API clients).

### Skills (thin LLM wrappers)
`/setup`, `/enable-staging`, `/enable-jobs`, `/enable-domain`. Each: collects the few
ambiguous inputs, invokes the corresponding TS command, interprets failures, and walks the
user through the genuinely manual bits (Render Blueprint click, DNS records). No
determinism lives in the skill.

### Deploy workflows
- `deploy-production.yml` — always: lint/test → build+push `:<sha>`/`:production` →
  (if `RENDER_API_KEY`) deploy pinned to `:<sha>`, poll to live. Serialized via
  `concurrency`.
- `deploy-staging.yml` — present only when `staging` is enabled (patched in by
  `enable staging`); same build-its-own-image shape on the `develop` branch.
- Client Netlify deploy job mirrors this (production always; staging when enabled).

## Delivery — multi-PR, fresh context per PR

Each PR is independently shippable and gets its own implementation plan.

- **PR1 — Harden + decouple.** Port the universal improvements above into the *current*
  staging+production model. Convert production to build-its-own-image (drop
  promote-from-staging). No feature-flag system yet. Pure hardening; safe to ship alone.
- **PR2 — Optionality core.** Add `scaffold.config.json` + the TS setup CLI skeleton +
  idempotent `enable staging` / `enable jobs` patchers. Slim the base scaffold to defaults
  (production-only, no worker). Unit tests for patchers (idempotency, conflict-fails-loud).
- **PR3 — Cloud provisioning + skills.** `setup cloud`, `enable domain`, the `/setup` and
  `/enable-*` skills, Render/Netlify/GitHub automation with confirmation gates, README
  runbooks.

Detailed implementation planning starts with **PR1** via the writing-plans skill.

## Testing strategy

- **TS CLI:** unit tests for config validation, patch planners (apply twice = stable;
  conflicting edit = error-with-diff), and templaters. API clients mocked/injected.
- **Deploy workflows:** validated by the existing CI on a throwaway branch; the
  `check-render` gate keeps them safe before Render exists (lint/test still run).
- **Patchers:** golden-file tests — base `render.yaml` + `enable jobs` → expected output;
  re-run → identical.

## Out of scope (YAGNI)

- Turning the setup system into a general IaC/Terraform tool.
- Multi-cloud or non-Render/Netlify targets.
- Automating the one Render Blueprint dashboard click or registrar DNS entry (both stay
  guided-manual).
- Removing features once enabled (`disable *`) — not needed yet.

## Open questions

- Whether PR2 and PR3 should merge if PR2 proves thin. Decide when PR1 lands.
- Exact `scaffold.config.json` schema for `customDomain` (single vs per-env domains).

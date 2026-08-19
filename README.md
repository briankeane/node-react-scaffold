# Node/React Scaffold

A production-ready full-stack TypeScript starter with authentication, protected routes, and AI-assisted development built in.

## What's Included

### Authentication (ready to use)

- **Server**: `POST /v1/auth/signup`, `/login`, `/google` endpoints returning `{ user, token }`
- **Client**: Login/signup pages, protected routes, AuthContext, JWT token management
- **Security**: Password hashing (bcrypt), JWT authentication, role-based access control

### Server

- Express 5 with TypeScript
- PostgreSQL with Sequelize ORM and migrations
- OpenAPI 3.0 documentation (ReDoc + Swagger)
- BullMQ background worker with cron scheduling (optional Redis)
- Mocha + Chai + Supertest integration tests

### Client

- React 18 with Vite and TypeScript
- React Router with protected routes
- Axios API service layer with JWT interceptor
- Vitest + React Testing Library

### Infrastructure

- Docker Compose for local development
- Automatic port management (multiple instances supported)
- Render for staging and production hosting
- GitHub Actions CI/CD pipeline (build, test, deploy to Render)
- GitHub Actions release PR automation
- Claude Code skills for AI-assisted development

## Quick Start

```bash
git clone <repository-url>
cd node-react-scaffold

# Optional: rename the project
./scripts/init-project.sh

# Install and launch
make install
make launch
```

`make install` copies env files, finds open ports, and builds Docker images.

Once running:

- Frontend: http://localhost:3000
- Backend API: http://localhost:10020
- API docs: http://localhost:10020/docs

## Optional Features

### Redis & BullMQ Job Queues

Background job processing is built in but off by default — new projects don't run
Redis or a worker. Turn it on with `make enable-jobs`, which adds the Redis and
worker services to `docker-compose.yaml` (and `render.yaml`) and wires `REDIS_URL`
into the server and worker. See [Optional deploy features](#optional-deploy-features) below.

### Google OAuth

The `/v1/auth/google` endpoint is wired up. To enable it:

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add `GOOGLE_CLIENT_ID` to `server/.env`
3. Add the Google sign-in button to your login page

### Metrics & Monitoring

The worker service supports cron-based jobs out of the box. Add monitoring by:

1. Adding a health check endpoint for your monitoring service
2. Configuring alerts on the `/v1/health-check` endpoint

## Prerequisites

- Docker and Docker Compose
- Node.js 22.15.0 and npm 10.9.2 (matches Docker images; consider using nvm)

## Port Management

The project uses `PORT_OFFSET` (in `.env`) to avoid port conflicts when running multiple instances. Each instance offsets all ports by this value (in increments of 100). Run `make find-open-ports` to auto-detect an available offset.

| Service      | Base Port | With PORT_OFFSET=100 |
| ------------ | --------- | -------------------- |
| Client       | 3000      | 3100                 |
| Client HMR   | 3010      | 3110                 |
| Server       | 10020     | 10120                |
| Server Debug | 9229      | 9329                 |
| PostgreSQL   | 5432      | 5532                 |
| Worker       | 10030     | 10130                |

## Environment Files

| File               | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `.env`             | Root config (COMPOSE_PROJECT_NAME, PORT_OFFSET)  |
| `server/.env`      | Server runtime config (JWT_SECRET, DATABASE_URL) |
| `server/.env-test` | Test database config (auto-created)              |
| `client/.env`      | Client config (API base URL)                     |

## Claude Code Skills

This project includes [Claude Code](https://claude.ai/claude-code) skills for AI-assisted development:

| Command            | Description                                                               |
| ------------------ | ------------------------------------------------------------------------- |
| `/create-model`    | Create a Sequelize model with migration, types, and tests (TDD)           |
| `/create-endpoint` | Create a REST API endpoint with integration tests and OpenAPI docs        |
| `/create-lib`      | Create library functions with TDD, one function at a time                 |
| `/create-feature`  | Create a client feature (service + context + page + route)                |
| `/diagnose-flaky`  | Step-by-step flaky test diagnosis                                         |
| `/deploy`          | Interactive deployment setup (Render, Cloudflare, GitHub Actions, Google OAuth) |

Skills live in `.claude/skills/` and teach Claude the project's conventions so it generates code that matches existing patterns.

## Make Targets

### Core

| Target                 | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `make install`         | Set up env files, find ports, build Docker images |
| `make launch`          | Start all services (foreground)                   |
| `make launch-detached` | Start all services (background)                   |
| `make terminate`       | Stop all services                                 |
| `make restart`         | Stop and restart all services                     |

### Testing

| Target                                 | Description                       |
| -------------------------------------- | --------------------------------- |
| `make test-server`                     | Run all server tests              |
| `make test-server-file GREP="pattern"` | Run tests matching a grep pattern |
| `make test-client`                     | Run client tests                  |

### Code Quality

| Target              | Description                           |
| ------------------- | ------------------------------------- |
| `make lint-server`  | Lint server (ESLint + Prettier check) |
| `make lint-client`  | Lint client                           |
| `make prettier-all` | Auto-format everything                |

### Build & Database

| Target                                   | Description                               |
| ---------------------------------------- | ----------------------------------------- |
| `make build-server`                      | Compile TypeScript                        |
| `make build-client`                      | Build production client bundle            |
| `make migrate`                           | Run database migrations                   |
| `make migrate-all`                       | Run migrations for dev and test databases |
| `make generate-migration NAME=add-table` | Generate a new migration file             |

### Logs

| Target             | Description               |
| ------------------ | ------------------------- |
| `make logs`        | Follow all container logs |
| `make logs-server` | Follow server logs        |
| `make logs-client` | Follow client logs        |

## Project Structure

```
├── .claude/
│   └── skills/              # Claude Code skills
├── .github/
│   └── workflows/           # CI/CD pipelines (GitHub Actions)
├── client/
│   └── src/
│       ├── Components/      # Reusable React components
│       ├── Contexts/        # React context providers (AuthContext)
│       ├── Pages/           # Page components (Login, Signup, Dashboard)
│       ├── Routes/          # React Router config, ProtectedRoute
│       ├── Services/        # API client services (authService, apiClient)
│       └── test/            # Test setup and helpers
├── scripts/
│   ├── init-project.sh      # Project renaming script
│   └── set-ports.sh         # Port auto-detection
├── server/
│   └── src/
│       ├── api/             # REST endpoints (auth, healthCheck)
│       ├── config/          # Environment and app configuration
│       ├── db/              # Sequelize models, migrations
│       ├── docs/            # OpenAPI/Swagger setup
│       ├── lib/             # Business logic libraries
│       ├── middleware/       # Express middleware (error handler)
│       ├── queue/           # BullMQ queue infrastructure (optional Redis)
│       └── test/            # Test setup, helpers, data generators
├── docker-compose.yaml
├── Makefile
└── README.md
```

## API Documentation

Available at:

- `/docs` — Interactive ReDoc UI
- `/swagger.json` — Raw OpenAPI spec

Each endpoint module has a co-located `.api.docs.yaml` file. See `server/src/api/auth/` for the reference pattern.

## Deploying to Render

### Overview

Hosting is on [Render](https://render.com) with two environments: **staging** (deploys
from `develop`) and **production** (deploys from `main`). Each environment builds its own
Docker image — production does **not** depend on staging existing.

The deploy is driven by GitHub Actions (`.github/workflows/deploy-staging.yml` and
`deploy-production.yml`), not by Render building from git — the Render services are
`runtime: image` and only *pull* the tag.

**Pipeline flow (per branch):**

1. Lint + test (server and client)
2. Build `server/Dockerfile.production`, push `ghcr.io/<owner>/<repo>` with a moving
   `:staging` / `:production` tag **and** an immutable `:<git-sha>` tag (the image path is
   lowercased automatically for GHCR)
3. Call the Render API to deploy the environment's server **pinned to the `:<git-sha>`
   image** (deterministic — can't race another push), poll until it's `live`
4. Same for the environment's worker (also polled to `live`, skipped if its worker
   service-ID secret is unset)

If `RENDER_API_KEY` is not configured as a GitHub secret, the deploy jobs skip themselves
automatically (lint/test **and** the image build still run), so the pipeline is safe before
Render exists.

### Initial Render Setup (order matters)

The Blueprint references the `:staging` / `:production` image tags, and Render verifies
image access when it creates image-backed services — so each image and its pull access
must exist **before** the first Blueprint sync. Do this once per environment (staging from
`develop`, production from `main`).

1. **Update `render.yaml`** — Replace `YOUR_ORG/YOUR_REPO` with your GitHub owner and repo
   name, **lowercased** (e.g. `ghcr.io/myorg/myapp:production`). The CI workflows lowercase
   the path they build/push, so keep the Blueprint consistent with them.

2. **Push the branch once** so the workflow builds and pushes the first image
   (`develop` → `:staging`, `main` → `:production`). The build authenticates to GHCR with
   the built-in `GITHUB_TOKEN` (no personal PAT required) and always runs on push; the
   Render deploy step skips itself until `RENDER_API_KEY` exists.

3. **Give Render pull access to the image** — either:
   - make the GHCR package **public** (GitHub → your profile → Packages → your repo →
     Package settings → Change visibility → Public), **or**
   - create a Render **registry credential** for GHCR (Render → Account Settings →
     Registry Credentials) and attach it to the image services when creating them.

4. **Create the env var groups** in the Render dashboard for **secrets only**:
   - `staging` — `JWT_SECRET` (and any other secrets your app needs)
   - `production` — same keys, production values

   `DATABASE_URL`, `NODE_ENV`, and `PORT` are **not** set here — the Blueprint wires
   `DATABASE_URL` from the managed database and sets `NODE_ENV`/`PORT` inline.

5. **Create the Blueprint** — Render Dashboard → **Blueprints** → **New Blueprint
   Instance** → connect this repo and select `render.yaml`. By default `render.yaml`
   is production-only, so Render provisions just the `production-db` Postgres
   database and the `production-server` service. Run `make enable-staging` and/or
   `make enable-jobs` first (see [Optional deploy features](#optional-deploy-features)) to add the
   `staging-db`/`staging-server` and the `staging-worker`/`production-worker`
   services to `render.yaml` before creating (or syncing) the Blueprint. (If an image
   is private, select the registry credential when prompted.)

6. **Note the service IDs** (the `srv-xxxxx` value in each service's Settings URL).

7. **Add the Render deploy secrets** to GitHub (Settings → Secrets → Actions):
   - `RENDER_API_KEY` — from Render Account Settings → API Keys
   - `RENDER_STAGING_SERVICE_ID` — the `staging-server` service ID
   - `RENDER_STAGING_WORKER_SERVICE_ID` — the `staging-worker` service ID (optional)
   - `RENDER_PRODUCTION_SERVICE_ID` — the `production-server` service ID
   - `RENDER_PRODUCTION_WORKER_SERVICE_ID` — the `production-worker` service ID (optional)

> **No GHCR PAT needed.** The old `GHCR_TOKEN` / `GHCR_USERNAME` secrets are no longer
> required — the workflows push to GHCR with the built-in `GITHUB_TOKEN`. Remove them if
> they were set for an earlier version of this scaffold.

### Deploying to Staging

Merge a PR into `develop` (or push to `develop`). The workflow builds and pushes the
`:staging` + `:<git-sha>` images, then triggers the Render deploy pinned to the SHA and
polls to `live`.

### Deploying to Production

Merge `develop` into `main` (or push to `main`). The workflow builds and pushes the
`:production` + `:<git-sha>` images, then triggers the Render deploy pinned to the SHA and
polls to `live`. On each deploy Render runs the `preDeployCommand`
(`predeployMigrate.js` on the web service — validate env, then run migrations) before
cutting traffic to the new container, and the `/v1/healthCheck` health check gates the
rollout. A failed migration fails the deploy closed, so traffic never moves to an
un-migrated schema.

### Rollback

Each deploy also pushed a `:<git-sha>` image tag. To roll back, redeploy a previous image
from the Render dashboard (Deploys → pick an earlier deploy → Redeploy), or re-point the
service at an older `:<git-sha>` tag.

### Release Workflow

To create a release PR from `develop` to `main`:

1. Go to GitHub Actions -> "Create Release PR" -> Run workflow
2. Choose version bump type (patch/minor/major) and enter a release title
3. A PR is auto-created with the version bump and commit summary

### Custom Domain Setup

To point a custom domain at your Render services:

1. **Add the domain in Render** — Go to your service's **Settings → Custom Domains** and add the domain (e.g. `api.example.com`). Render provisions a TLS certificate automatically.

2. **Create a CNAME record** with your DNS provider pointing the subdomain to your Render service hostname:

   | Subdomain       | Type  | Target                                  |
   | --------------- | ----- | --------------------------------------- |
   | `api-staging`   | CNAME | `myapp-staging-server.onrender.com`     |
   | `api`           | CNAME | `myapp-production-server.onrender.com`  |

3. **Wait for DNS propagation** and verify the domain is active in Render's Custom Domains panel.

> **Cloudflare users:** CNAME records **must** be set to **DNS only** (grey cloud icon), not Proxied (orange cloud). Proxied mode causes **Cloudflare Error 1000** ("DNS points to prohibited IP") because Render's origin IPs are on Cloudflare's network. Render handles TLS automatically, so Cloudflare's proxy is not needed.

### Production Docker Image

To build the production image locally for testing:

```bash
cd server
docker build -f Dockerfile.production -t myapp:local .
docker run -p 10020:10020 --env-file .env myapp:local
```

## Client Deployment (Netlify)

### netlify.toml

The scaffold includes a `netlify.toml` in the repo root that configures the build: base directory `client/`, build command `npm run build`, publish directory `dist`, and a SPA catch-all redirect. This is picked up automatically by Netlify.

### Create Netlify Sites

Two sites are needed — staging and production. Run these commands from the project root after logging in with `npx netlify login`:

```bash
npx netlify sites:create --name <project>-staging --account-slug <your-account-slug>
npx netlify sites:create --name <project>-production --account-slug <your-account-slug>
```

> **Note:** To find your account slug, run `npx netlify api listAccountsForUser` and look for the `slug` field (it may differ from the team display name).

### Create a Netlify Personal Access Token

Go to https://app.netlify.com/user/applications#personal-access-tokens and create a token for CI use.

### GitHub Secrets

Add these three secrets to the GitHub repo (Settings → Secrets → Actions):

| Secret                       | Value                                              |
| ---------------------------- | -------------------------------------------------- |
| `NETLIFY_AUTH_TOKEN`         | The personal access token from the previous step   |
| `NETLIFY_STAGING_SITE_ID`   | The Project ID printed when creating the staging site    |
| `NETLIFY_PRODUCTION_SITE_ID`| The Project ID printed when creating the production site |

### Custom Domains (Optional)

To add custom domains, update the site via the Netlify dashboard (Domain Management → Add custom domain) or via API:

```bash
curl -X PUT "https://api.netlify.com/api/v1/sites/<site-id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"custom_domain": "staging.example.com"}'
```

Then add a CNAME record with your DNS provider pointing to `<site-name>.netlify.app`.

> **Cloudflare users:** Set the CNAME record to **DNS only** (grey cloud, not proxied) — proxied mode causes **Cloudflare Error 1000**.

### How It Works

The client is deployed by Netlify, not by the GitHub Actions workflows (those build and
deploy only the server image to Render). The simplest path is Netlify's Git integration:
connect each site to this repo and Netlify reads `netlify.toml`, builds `client/` on every
push, and publishes `client/dist` — point the staging site at `develop` and the production
site at `main`. Alternatively, deploy from CI or locally with the Netlify CLI using the
`NETLIFY_AUTH_TOKEN` and the target `NETLIFY_*_SITE_ID` from the secrets above:
`npx netlify deploy --dir=client/dist --prod`.

## Cloud setup (automated)

The manual Render + Netlify runbooks above are the reference. `make setup-cloud`
automates everything **around** the one unavoidable manual step (the Render
Blueprint dashboard click), with confirmation gates on every paid, irreversible,
or exposing action. It reads `scaffold.config.json` and provisions **every enabled
env** (production, plus staging and the workers if you enabled them) in one pass.

### Prerequisites

- **`gh`** installed and authenticated (`gh auth login`).
- **`netlify`** CLI installed and logged in (`netlify login`).
- **`RENDER_API_KEY`** and **`NETLIFY_AUTH_TOKEN`** exported in your shell (the CLI
  reads them from the environment and stores them as GitHub Actions secrets).

### Three modes

```bash
make setup-cloud PLAN=1   # dry run: print the full resource-by-resource plan, change nothing
make setup-cloud          # interactive: confirm each paid/exposing action
make setup-cloud YES=1    # skip prompts (for scripted/skill-driven use after you approved the plan)
```

`setup cloud` is idempotent and resumable: it detects existing state (Render
services/env groups by name, `gh secret list`, Netlify sites) and skips whatever
is already done, so it is safe to re-run after a failure or the manual pause.

### What it does, in order

1. **Preflight** — verifies `gh`/`netlify` auth and `RENDER_API_KEY`.
2. **First image** — checks the `:production` (and `:staging`) image exists in GHCR;
   if not, tells you to push `main`/`develop` (or `gh workflow run`) first.
3. **[GATE] GHCR visibility** — makes the GHCR package **public** so Render can pull
   it (or use a Render registry credential instead). Confirms before exposing.
4. **Render env group(s)** — creates a per-env group with a generated strong
   `JWT_SECRET`. An existing `JWT_SECRET` is never rotated.
5. **[MANUAL] Blueprint sync** — the one unavoidable click. Prints exact
   instructions + a deep link; the paid DB/keyvalue/services are created here (Render
   shows the monthly cost on that screen — the gate for the infra itself). Interactive
   mode waits and polls until the services appear; `YES=1` stops with a clear
   "manual action required" (exit 4) so a script can surface it.
6. **Read back service IDs** — matches each service by **name and type** (and image
   path) so a secret can never bind to the wrong service.
7. **[GATE] Netlify sites** — creates a site per env and sets `VITE_SERVER_BASE_URL`
   to that env's Render server origin (sets the origin; does not verify reachability).
8. **GitHub secrets** — sets only the missing ones: `RENDER_API_KEY`,
   `RENDER_{PRODUCTION,STAGING}_SERVICE_ID`, `RENDER_{…}_WORKER_SERVICE_ID` (when jobs
   are on), `NETLIFY_AUTH_TOKEN`, `NETLIFY_{PRODUCTION,STAGING}_SITE_ID`.
9. **Summary** — what was created/skipped and the DNS next steps if you enabled a
   custom domain.

### Exit codes

| Code | Meaning |
| ---- | ------- |
| `0`  | Completed, or `PLAN=1` produced a clean plan, or you declined a gate and it stopped cleanly |
| `1`  | Transient/operational failure after retries |
| `2`  | Usage/config error (bad flags, missing `RENDER_API_KEY`, not authenticated) |
| `3`  | Conflict/unsafe state (e.g. a Render service exists with the wrong type, or a Netlify site under a different account) |
| `4`  | Manual action required (Blueprint sync pending under `YES=1`) |

> **DNS / Cloudflare:** if you use a custom domain, add the CNAME record as **DNS
> only** (grey cloud), not Proxied — see [Custom Domain Setup](#custom-domain-setup).

### Assumptions

- **A dedicated Render workspace/project.** The env groups are named `production` /
  `staging` because `render.yaml` references them via `fromGroup`. If the same Render
  workspace already hosts another app with a `production` env group, `setup cloud` will
  reuse it — use a separate workspace/project per scaffold. Likewise it refuses to act
  when a Render **service** name is duplicated (a preview, a second Blueprint) rather
  than guessing which one is yours.
- **A clean secret slate.** GitHub Actions secrets are write-only, so `setup cloud`
  can verify a secret's presence but not its value. If the repo carries a stale
  `RENDER_*_SERVICE_ID` / `NETLIFY_*_SITE_ID` from a previous deployment, clear it
  first — otherwise setup reports success while CI deploys the wrong resource.

### Local setup

`make setup-local` verifies Docker is running, then drives `make install` (env
files, ports, build) and `make launch-detached`. Tail logs with `make logs`.

## Optional deploy features

New projects start production-only. `scaffold.config.json` at the repo root is the
single source of truth for which optional features are on:

    { "features": { "staging": false, "jobs": false, "customDomain": false } }

Add features later with idempotent one-shot commands (safe to re-run):

- `make enable-staging` — adds a staging database + server to your Render blueprint
  (`render.yaml`) and the `deploy-staging.yml` workflow (deploys on pushes to `develop`).
- `make enable-jobs` — adds a **per-env** Redis (Key Value) service and a worker to
  `render.yaml` for every enabled environment (`production-kv`, and `staging-kv` when
  staging is on), wiring each env's `REDIS_URL` to its **own** keyvalue. Separate
  instances keep staging and production BullMQ queues fully isolated — both envs run
  `NODE_ENV=production`, so a shared Redis would cross-contaminate their queues.
  (Local `docker-compose` stays single-redis on purpose: one dev box, no env split,
  so there is nothing to cross-contaminate.)
- `make enable-domain DOMAIN=api.example.com [ENV=staging]` — adds a custom domain to
  the target env's server service in `render.yaml` (defaults to `production`) and
  prints the CNAME target. Re-running with a different domain **replaces** it (so you
  can change the domain after deploy); re-running with the same domain is a no-op.

Each command patches the relevant scaffold-owned blocks in `render.yaml`,
`docker-compose.yaml`, and the workflow(s), and flips the flag in
`scaffold.config.json`. If you have hand-edited a scaffold-owned block in a way the
patcher can't reconcile, it aborts with a diff and changes nothing.

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Run `make prettier-all && make lint-server && make test-server` before pushing
4. Submit a pull request to `develop`

## License

ISC License

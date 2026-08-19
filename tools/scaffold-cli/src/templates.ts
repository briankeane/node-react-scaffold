import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Each template is a top-level YAML fragment. renderPlanner parses it and lifts the
// single node it contains, so comments attached in the template travel with the node.

// deploy-staging.yml is a whole GitHub Actions workflow file, not a YAML fragment.
// It contains `${{ ... }}` expressions, which a JS template literal would try to
// interpolate. Read the byte-exact PR1 content from a data file instead — see
// templates/deploy-staging.yml (recovered verbatim via `git show`).
const here = dirname(fileURLToPath(import.meta.url));
export const DEPLOY_STAGING_WORKFLOW = readFileSync(join(here, 'templates/deploy-staging.yml'), 'utf8');

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

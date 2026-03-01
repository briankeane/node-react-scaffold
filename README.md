# Node/React Scaffold

A modern full-stack TypeScript application template with React frontend and Node.js backend. Includes Docker containerization, automated testing, CI/CD integration, and Claude Code skills for AI-assisted development.

## Tech Stack

### Backend (Node.js)
- Express.js web framework
- PostgreSQL with Sequelize ORM
- TypeScript
- JWT authentication with role-based access control
- BullMQ job queues with Redis (optional)
- Background worker with cron scheduling
- OpenAPI 3.0 documentation (Swagger/ReDoc)

### Frontend (React)
- Vite for fast development and building
- React 18 with TypeScript
- Vitest and React Testing Library
- ESLint + Prettier

### Infrastructure
- Docker Compose for local development
- CircleCI for CI/CD
- GitHub Actions for release PR automation

## Prerequisites

- Docker and Docker Compose
- Node.js 22.15.0 and npm 10.9.2 (matches Docker images; consider using nvm)

## Getting Started

```bash
git clone <repository-url>
cd scaffold
make install
make launch
```

`make install` handles everything: copies `.env-example` files, finds open ports, and builds Docker images.

This starts:
- Frontend at http://localhost:3000
- Backend API at http://localhost:10020
- API docs at http://localhost:10020/docs
- Background worker
- PostgreSQL database
- Automatic database migrations

### Port Management

The project uses `PORT_OFFSET` (in `.env`) to avoid port conflicts when running multiple scaffold instances. Each instance offsets all ports by this value (in increments of 100). Run `make find-open-ports` to auto-detect an available offset.

| Service | Base Port | With PORT_OFFSET=100 |
|---------|-----------|---------------------|
| Client | 3000 | 3100 |
| Client HMR | 3010 | 3110 |
| Server | 10020 | 10120 |
| Server Debug | 9229 | 9329 |
| PostgreSQL | 5432 | 5532 |
| Worker | 10030 | 10130 |

### Environment Files

| File | Purpose |
|------|---------|
| `.env` | Root config (PORT_OFFSET) |
| `server/.env` | Server runtime config |
| `server/.env-test` | Test database config (auto-created) |
| `client/.env` | Client config (optional) |

### Customizing for Your Project

1. Update `container_name` entries in `docker-compose.yaml` (replace `YOUR_PROJECT_NAME`)
2. Update `server/src/config/config.ts` production values (`BASE_URL`, `CLIENT_BASE_URL`)
3. Update `server/src/docs/index.ts` with your API title and contact info

### Optional: Redis

To enable Redis for job queues:

1. Uncomment the `redis` service in `docker-compose.yaml`
2. Uncomment `REDIS_URL=redis://redis:6379` in `server/.env`
3. Restart: `make restart`

### Optional: Pre-commit Hook

```bash
./hooks/setup.sh
```

Runs Prettier inside Docker containers before each commit. Requires `make launch` to be running.

## Claude Code Skills

This project includes [Claude Code](https://claude.ai/claude-code) skills for AI-assisted development. After installing Claude Code, these slash commands are available:

| Command | Description |
|---------|-------------|
| `/create-model` | Create a Sequelize model with migration, types, and tests (TDD) |
| `/create-endpoint` | Create a REST API endpoint with integration tests and OpenAPI docs |
| `/create-lib` | Create library functions with TDD, one function at a time |
| `/diagnose-flaky` | Step-by-step flaky test diagnosis |
| `/deploy` | Interactive deployment setup (Render, Cloudflare, CircleCI, Google OAuth) |

Skills live in `.claude/skills/` and teach Claude the project's conventions so it generates code that matches existing patterns.

## Make Targets

### Core
| Target | Description |
|--------|-------------|
| `make install` | Set up env files, find ports, build Docker images |
| `make launch` | Start all services (foreground) |
| `make launch-detached` | Start all services (background) |
| `make terminate` | Stop all services |
| `make restart` | Stop and restart all services |

### Testing
| Target | Description |
|--------|-------------|
| `make test-server` | Run all server tests |
| `make test-server-file GREP="pattern"` | Run tests matching a grep pattern |
| `make test-server-with-logging` | Run tests with verbose logging |
| `make test-server-debug` | Run tests with Node debugger attached |
| `make test-client` | Run client tests |

### Code Quality
| Target | Description |
|--------|-------------|
| `make lint-server` | Lint server (ESLint + Prettier check) |
| `make lint-client` | Lint client |
| `make prettier-server` | Auto-format server files |
| `make prettier-client` | Auto-format client files |
| `make prettier-all` | Auto-format everything |

### Build & Database
| Target | Description |
|--------|-------------|
| `make build-server` | Compile TypeScript |
| `make build-client` | Build production client bundle |
| `make migrate` | Run database migrations |
| `make migrate-all` | Run migrations for dev and test databases |
| `make generate-migration NAME=add-table` | Generate a new migration file |

### Logs
| Target | Description |
|--------|-------------|
| `make logs` | Follow all container logs |
| `make logs-server` | Follow server logs |
| `make logs-client` | Follow client logs |
| `make logs-worker` | Follow worker logs |

## Project Structure

```
├── .claude/
│   └── skills/              # Claude Code skills (create-model, create-endpoint, etc.)
├── .circleci/
│   └── config.yml           # CircleCI CI/CD pipeline
├── .github/
│   └── workflows/
│       └── create-release-pr.yml  # Automated release PR (develop -> main)
├── client/                  # React frontend (Vite)
│   └── src/
├── docker/
│   └── postgres/            # PostgreSQL init scripts
├── hooks/                   # Git pre-commit hooks
├── scripts/
│   └── set-ports.sh         # Port auto-detection
├── server/
│   └── src/
│       ├── api/             # REST endpoints (routes, controllers, tests, docs)
│       ├── config/          # Environment and app configuration
│       ├── db/              # Sequelize models, migrations, sequelize instance
│       ├── docs/            # OpenAPI/Swagger setup
│       ├── lib/             # Business logic libraries
│       ├── middleware/      # Express middleware (error handler)
│       ├── queue/           # BullMQ queue infrastructure (optional Redis)
│       ├── scripts/         # Startup scripts (checkEnv, startWorker)
│       ├── test/            # Test setup, helpers, data generators
│       ├── logger.ts        # Environment-aware logging
│       ├── server.ts        # Express app entry point
│       └── worker.ts        # Background worker entry point
├── docker-compose.yaml
└── Makefile
```

## API Documentation

Available at:
- `/docs` — Interactive ReDoc UI
- `/swagger.json` — Raw OpenAPI spec
- `/api-docs` — JSON spec (alias)

Each endpoint module has a co-located `.api.docs.yaml` file that is auto-discovered. See `server/src/api/healthCheck/` for the reference pattern.

## Setting up CircleCI

1. Sign up at https://circleci.com/ and connect your GitHub repository

2. Add these environment variables in CircleCI project settings:
   - `DOCKERHUB_USERNAME` — Docker Hub username
   - `DOCKERHUB_PASSWORD` — Docker Hub access token

3. For deployment, add your hosting provider's credentials (see `/deploy` skill for guided setup)

4. The CI pipeline runs:
   - Server build + tests (on `develop` and `main` branches)
   - Server and client linting (on all branches)
   - Client tests (on all branches)
   - Deployment jobs (when hosting credentials are configured)

## Release Workflow

To create a release PR from `develop` to `main`:

1. Go to GitHub Actions -> "Create Release PR" -> Run workflow
2. Choose version bump type (patch/minor/major) and enter a release title
3. A PR is auto-created with the version bump and commit summary

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Run `make lint-server && make test-server` before pushing
4. Submit a pull request to `develop`

## License

ISC License

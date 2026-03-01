# Node/React Scaffold

A modern full-stack TypeScript application template with React frontend and Node.js backend. Production-ready setup with Docker containerization, automated testing, and CI/CD integration.

## Tech Stack

### Backend (Node.js)
- **Express.js** web framework with TypeScript
- **PostgreSQL 16** database with **Sequelize** ORM
- **Redis** for caching and job queues
- **JWT** authentication with role-based access control
- **Mocha/Chai** test suite with **nock** for HTTP mocking
- **OpenAPI 3.0** documentation with ReDoc UI
- Background **worker** process for cron jobs and queues

### Frontend (React)
- **React 19** with TypeScript
- **Vite** for fast development and building
- **Redux Toolkit** for state management
- **React Router v7** with protected routes
- **Axios** HTTP client with auth interceptor
- **Vitest** and **React Testing Library** for testing

### Infrastructure
- **Docker Compose** (v2) for local development
- **CircleCI** for CI/CD
- **Prettier** and **ESLint** for code quality

## Prerequisites

- Docker and Docker Compose
- Node.js 22.15.0 and npm 10.9.2 (matches Docker images; consider nvm)

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd node-react-scaffold
   ```

2. Create environment files and build:
   ```bash
   make install
   ```

3. Update `docker-compose.yaml` container name prefixes (replace `YOUR_PROJECT_NAME`).

4. Start the development environment:
   ```bash
   make launch
   ```

   This starts:
   - Frontend at http://localhost:3000
   - Backend API at http://localhost:10020
   - Background worker
   - PostgreSQL at localhost:5432
   - Redis at localhost:6379
   - Database migrations run automatically

5. (Optional) Install the formatting pre-commit hook:
   ```bash
   ./hooks/setup.sh
   ```

## Development

### Make Targets

```bash
make install              # Copy .env templates, build Docker images
make launch               # Start all services (foreground)
make launch-detached      # Start all services (detached)
make terminate            # Stop all services
make restart              # Restart all services

make test-server          # Run server tests
make test-client          # Run client tests
make test-all             # Run all tests

make lint-server          # Lint server code
make lint-client          # Lint client code
make lint-all             # Lint all code

make build-server         # Compile server TypeScript

make db-migrate-all       # Run migrations (dev + test)
make generate-migration NAME=add-table
```

### Server Commands (inside container)
- `npm run dev` — Compile TypeScript in watch mode and restart server
- `npm test` — Run Mocha/Chai test suite (uses `.env-test`)
- `npm run lint` — ESLint + Prettier check
- `npm run build` — Compile TypeScript and run migrations
- `npm run migrate:all` — Run all database migrations
- `npm run worker` — Start the background worker

### Client Commands (inside container)
- `npm run dev` — Start Vite dev server
- `npm test` — Run Vitest with coverage
- `npm run lint` — ESLint + Prettier check
- `npm run build` — Build production bundle

## API Documentation

Available at:
- `/docs` — Interactive ReDoc UI
- `/swagger.json` — Raw OpenAPI spec

Each endpoint is documented in a co-located `.api.docs.yaml` file alongside its controller.

## Project Structure

```
├── client/               # React frontend (Vite + Redux + Router)
│   └── src/
│       ├── Pages/        # Page components
│       ├── Routes/       # Router config and guards
│       ├── redux/        # Redux store and slices
│       ├── Services/     # API service layer
│       └── models/       # TypeScript interfaces
├── server/               # Express backend
│   └── src/
│       ├── api/          # Route handlers, middleware, error handler
│       ├── config/       # Environment configuration
│       ├── db/           # Sequelize models and migrations
│       ├── lib/          # Business logic modules
│       ├── docs/         # OpenAPI setup
│       └── test/         # Test infrastructure
├── docker/               # Docker configuration
├── docker-compose.yaml   # Service orchestration
├── Makefile              # Development commands
└── CLAUDE.md             # AI assistant project guide
```

## Setting up CircleCI

1. Copy `.circleci/config.yml` to your new repo
2. Connect your GitHub repo at https://circleci.com/
3. Add environment variables:
   - `DOCKERHUB_USERNAME`, `DOCKERHUB_PASSWORD`
   - `HEROKU_STAGING_APP_NAME`, `HEROKU_STAGING_EMAIL`, `HEROKU_STAGING_API_KEY`
   - `HEROKU_APP_NAME`
4. Pipeline: build → test → deploy to Heroku staging (on `develop`) → promote to production (on `main`)

## Contributing

1. Create a feature branch from `develop`
2. Make changes following the patterns in `CLAUDE.md`
3. Run `make test-all` and `make lint-all`
4. Submit a pull request to `develop`

## License

ISC License

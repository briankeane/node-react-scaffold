# Node/React Scaffold

A full-stack TypeScript starter template with React frontend and Node.js backend. Includes authentication patterns, state management, routing, and test infrastructure out of the box.

## Tech Stack

### Backend
- **Express.js** on Node 22
- **PostgreSQL 16** with Sequelize ORM
- **TypeScript** with strict mode
- **Mocha/Chai/Supertest** for testing
- **OpenAPI 3.0** documentation (ReDoc + Swagger)

### Frontend
- **React 19** with Vite
- **Redux Toolkit** for state management
- **React Router v7** with protected routes
- **Axios** HTTP client
- **Vitest** with React Testing Library

### Infrastructure
- Docker Compose with Postgres, Redis, and hot-reload
- CircleCI for CI/CD
- Heroku deployment ready

## Prerequisites

- Docker and Docker Compose v2
- Node.js 22+ (for local development outside Docker)

## Getting Started

```bash
# 1. Clone and enter the project
git clone <repository-url>
cd scaffold

# 2. Setup environment and build containers
make install

# 3. Start all services
make launch
```

This starts:
- Frontend at http://localhost:3000
- Backend API at http://localhost:10020
- API docs at http://localhost:10020/docs
- PostgreSQL at localhost:5432
- Redis at localhost:6379

## Development Commands

```bash
make install          # Copy .env files + build Docker images
make launch           # Start all services
make test-server      # Run server tests
make test-client      # Run client tests
make test-all         # Run all tests
make lint-server      # Lint server code
make lint-client      # Lint client code
make lint-all         # Lint everything
make build-server     # Build server TypeScript
make db-migrate-all   # Run database migrations
make generate-migration NAME=<name>  # Generate a new migration
```

## Project Structure

```
├── client/               # React 19 frontend
│   ├── src/
│   │   ├── redux/        # Redux Toolkit store + slices
│   │   ├── Routes/       # React Router + protected routes
│   │   ├── Pages/        # Page components
│   │   ├── Components/   # Reusable components
│   │   ├── Services/     # API client (Axios)
│   │   └── test/         # Test helpers
│   └── Dockerfile
├── server/               # Express backend
│   ├── src/
│   │   ├── api/          # Route handlers + tests + docs
│   │   ├── lib/          # Business logic
│   │   ├── db/           # Sequelize models + migrations
│   │   ├── config/       # Environment configuration
│   │   ├── test/         # Test infrastructure
│   │   └── utils/        # Shared utilities
│   └── Dockerfile
├── docker/               # Docker configuration
├── docker-compose.yaml   # Service orchestration
├── Makefile              # Development commands
└── .circleci/            # CI/CD configuration
```

## API Documentation

Available at:
- `/docs` — Interactive ReDoc UI
- `/swagger.json` or `/api-docs` — Raw OpenAPI spec

Each feature module includes its own `*.api.docs.yaml` file co-located with the handler code.

## Testing

- **Server**: Mocha + Chai + Supertest, with nock for HTTP mocking and automatic DB cleanup between tests
- **Client**: Vitest + React Testing Library, with `withProviders()` helper for components needing Redux/Router context

## Configuration

Copy the example env files (done automatically by `make install`):
- `server/.env-example` → `server/.env`
- `client/.env-example` → `client/.env`

Update `server/src/config/config.ts` with production URLs when deploying.

## License

ISC License

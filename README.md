# Node/React Scaffold

A modern full-stack TypeScript application template with React frontend and Node.js backend. This scaffold provides a production-ready setup with Docker containerization, automated testing, and CI/CD integration.

## Tech Stack

### Backend (Node.js)
- Express.js web framework
- PostgreSQL database with Sequelize ORM
- TypeScript for type safety
- Docker containerization
- Automated testing with Mocha and Chai

### Frontend (React)
- Vite for fast development and building
- React 18 with TypeScript
- Testing with Vitest and React Testing Library
- ESLint for code quality

## Prerequisites

- Docker and Docker Compose
- Node.js 22.15.0 and npm 10.9.2 (matches the Docker images; consider using nvm to pin locally)
- PostgreSQL (if running locally without Docker)

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd scaffold
   ```

2. Create environment files:
   ```bash
   # Server environment
   cp server/.env.example server/.env
   cp server/.env.example server/.env-test
   
   # Client environment (if needed)
   cp client/.env.example client/.env
   ```

3. Update configuration:
   - In `server/.env`, set your database and API configurations
   - In `src/config/config.ts`, update the production values for:
     - `BASE_URL`
     - `CLIENT_BASE_URL`
     - `GOOGLE_SIGNIN_REDIRECT_URL`

4. Start the development environment:
   ```bash
   # Update docker-compose.yaml container_name entries to match your project prefix (e.g., "myapp-postgres")
   # or set COMPOSE_PROJECT_NAME=myapp when running docker compose to avoid container name conflicts.
   docker-compose up
   ```

5. (Optional) Install the formatting pre-commit hook:
   ```bash
   ./hooks/setup.sh
   ```
   This hook runs Prettier inside the existing Docker containers before each commit. Make sure `docker-compose up` (or `make launch`) is running when committing changes. You can trigger the hook manually anytime with `./hooks/pre-commit` while the containers are running.

   This will start:
   - Frontend at http://localhost:3000
   - Backend API at http://localhost:10020
   - Background worker container running `npm run worker`
   - PostgreSQL database at localhost:5432
   - Database migrations will run automatically

## Development

### Server Commands
- `npm run dev` - Compile TypeScript in watch mode and restart the built server from `dist/`
- `npm test` - Run the Mocha/Chai test suite (uses `.env-test`)
- `npm run lint` - Fail on ESLint warnings and ensure Prettier formatting is clean
- `npm run prettier:write` - Format server files with Prettier
- `npm run build` - Compile TypeScript and run migrations
- `npm run migrate` / `npm run migrate:all` - Run database migrations locally and against the test DB
- `npm run worker` - Execute the background worker entry point (`src/worker.ts`)

### Client Commands
- `npm run dev` - Start the Vite dev server
- `npm test` - Run Vitest with coverage
- `npm run lint` - Fail on ESLint warnings and check Prettier formatting
- `npm run prettier:write` - Format client files with Prettier
- `npm run build` - Build the production bundle

### Make Targets
The `Makefile` wraps common Docker tasks. Highlights:

- `make install` – copy `.env` templates and build the Docker images
- `make launch` / `make launch-detached` – start the full stack (foreground or detached)
- `make logs`, `make logs-server`, `make logs-client` – follow container logs
- `make logs-worker` – follow the worker container logs
- `make test-server`, `make test-client` – run tests in containers
- `make lint-server`, `make lint-client`, `make prettier-all` – enforce formatting and linting through Docker
- `make migrate`, `make migrate-all`, `make generate-migration NAME=add-table` – manage migrations

## Docker Development

The project uses Docker Compose for development:

- `docker-compose up` - Start all services
- `docker-compose up server` - Start only the backend
- `docker-compose up client` - Start only the frontend
- `docker-compose up worker` - Start only the worker
- `docker-compose down` - Stop all services
- If you customized the `container_name` placeholders, use those names when running `docker exec`; Compose targets continue to be the service names (`server`, `client`, `postgres`, etc.).

## Testing

- Backend tests use Mocha/Chai and run in a separate test database
- Frontend tests use Vitest with React Testing Library
- Run all tests with:
  ```bash
  docker-compose run server npm test
  docker-compose run client npm test
  ```

## API Documentation

The API is documented using OpenAPI 3.0 (Swagger) specification. Documentation is available at:
- `/docs` - Interactive ReDoc documentation UI
- `/swagger.json` or `/api-docs` - Raw OpenAPI specification

### Documentation Structure

1. **Endpoint Documentation**
   - Each controller has its own `api.docs.yaml` file in the same directory
   - Example: `src/api/healthCheck/healthCheck.api.docs.yaml` documents the health check endpoint
   - These files contain only the path definitions without the root `paths:` element
   ```yaml
   # Example: healthCheck.api.docs.yaml
   /api/health:
     get:
       tags:
         - Health
       summary: Health Check
       # ... rest of the endpoint documentation
   ```

2. **Shared Components**
   - Common models, schemas, and responses are defined in YAML files in the `src/docs` directory
   - Example: `src/docs/models/error.yaml` for common error responses
   - These files can include any valid OpenAPI components (schemas, responses, parameters, etc.)
   ```yaml
   # Example: src/docs/models/error.yaml
   components:
     schemas:
       Error:
         type: object
         properties:
           message:
             type: string
   ```

### Best Practices
- Keep endpoint documentation close to the controller code
- Use shared components to maintain consistency across endpoints
- Use tags to group related endpoints
- Include examples in your documentation
- Document all possible responses, including errors

## Setting up CircleCI

1. Copy the `.circleci/config.yml` file from this repo to your new repository's `.circleci` directory

2. Sign up for CircleCI at https://circleci.com/ and connect your GitHub repository

3. In your CircleCI project settings, add the following environment variables:
   - `DOCKERHUB_USERNAME`, `DOCKERHUB_PASSWORD`
   - `HEROKU_STAGING_APP_NAME`, `HEROKU_STAGING_EMAIL`, `HEROKU_STAGING_API_KEY`
   - `HEROKU_APP_NAME`
   Deploy jobs automatically halt if any of the required variables above are missing.

4. The CircleCI configuration includes:
   - Automated testing for both server and client
   - Linting checks
   - Automated deployment to Heroku on pushes to the `develop` branch
   - Promotion of the staging slug to production on pushes to `main`
   - Proper handling of build artifacts, migrations, and environment validation

5. The deployment pipeline:
   - Builds the TypeScript code
   - Runs tests
   - Prepares the deployment package
   - Deploys to Heroku with proper release commands

Note: Make sure your Heroku application is created and properly configured before enabling the CircleCI integration.

## Project Structure

```
├── client/               # React frontend
│   ├── src/             # Source files
│   ├── tests/           # Test files
│   └── vite.config.ts   # Vite configuration
├── server/              # Node.js backend
│   ├── src/             # Source files
│   ├── tests/           # Test files
│   └── migrations/      # Database migrations
├── docker/              # Docker configuration
└── .circleci/          # CI/CD configuration
```

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Run tests and linting
4. Submit a pull request to `develop`

## License

ISC License

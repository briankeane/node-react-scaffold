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
- Node.js 18+ (for local development)
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
   docker-compose up
   ```

   This will start:
   - Frontend at http://localhost:3000
   - Backend API at http://localhost:10020
   - PostgreSQL database at localhost:5432
   - Database migrations will run automatically

## Development

### Server Commands
- `npm run dev` - Start development server with hot reload
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run build` - Build for production
- `npm run migrate` - Run database migrations

### Client Commands
- `npm run dev` - Start Vite dev server
- `npm test` - Run Vitest tests
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

## Docker Development

The project uses Docker Compose for development:

- `docker-compose up` - Start all services
- `docker-compose up server` - Start only the backend
- `docker-compose up client` - Start only the frontend
- `docker-compose down` - Stop all services

## Testing

- Backend tests use Mocha/Chai and run in a separate test database
- Frontend tests use Vitest with React Testing Library
- Run all tests with:
  ```bash
  docker-compose run server npm test
  docker-compose run client npm test
  ```

## Setting up CircleCI

1. Copy the `.circleci/config.yml` file from this repo to your new repository's `.circleci` directory

2. Sign up for CircleCI at https://circleci.com/ and connect your GitHub repository

3. In your CircleCI project settings, add the following environment variables:
   - `HEROKU_API_KEY`: Your Heroku API key
   - `HEROKU_EMAIL`: Your Heroku account email
   - `HEROKU_APP_NAME`: Your Heroku application name

4. The CircleCI configuration includes:
   - Automated testing for both server and client
   - Linting checks
   - Automated deployment to Heroku on pushes to the `develop` branch
   - Proper handling of build artifacts and migrations

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

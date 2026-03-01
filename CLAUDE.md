# Node/React Scaffold

## Project Structure

```
scaffold/
├── server/                    # Express + TypeScript backend
│   ├── src/
│   │   ├── server.ts          # Express app entry point
│   │   ├── logger.ts          # Logger (suppresses output in test env)
│   │   ├── worker.ts          # Background worker process
│   │   ├── api/
│   │   │   ├── routes.ts      # Route registration
│   │   │   ├── errorHandler.ts # Global error handler (maps errors → HTTP status)
│   │   │   ├── middleware/
│   │   │   │   ├── security.ts      # JWT auth, role checks, "me" replacement
│   │   │   │   └── routeValidators.ts # UUID, enum, date, required field validation
│   │   │   └── healthCheck/   # Example feature module
│   │   ├── config/            # Environment config
│   │   ├── db/
│   │   │   ├── sequelize.ts   # Sequelize instance
│   │   │   ├── index.ts       # DB + models export
│   │   │   ├── models/        # Sequelize models
│   │   │   └── migrations/    # DB migrations
│   │   ├── lib/               # Business logic
│   │   │   └── healthCheck/
│   │   ├── docs/              # OpenAPI/Swagger setup
│   │   ├── test/              # Test infrastructure
│   │   │   ├── mochaSetup.test.ts    # Root hooks (nock, DB cleanup)
│   │   │   ├── testHelpers.ts        # clearDatabase (FK-safe), checkAndClearNocks
│   │   │   └── testDataGenerator.ts  # Faker-based factories
│   │   ├── types/             # TypeScript type augmentations
│   │   └── utils/
│   │       └── errors.ts      # Error class hierarchy + ErrorMessages
│   └── Dockerfile
├── client/                    # React 19 + Vite frontend
│   ├── src/
│   │   ├── main.tsx           # Entry: Redux Provider + RouterProvider
│   │   ├── App.tsx            # Root layout with Outlet
│   │   ├── redux/
│   │   │   ├── store.ts       # Redux Toolkit store + createTestStore
│   │   │   └── slices/
│   │   │       └── authSlice.ts  # Auth state + localStorage persistence
│   │   ├── Routes/
│   │   │   ├── Routes.tsx     # createBrowserRouter definition
│   │   │   └── ProtectedRoute.tsx  # Auth guard → /login redirect
│   │   ├── Pages/             # Page components
│   │   ├── Components/        # Reusable components
│   │   ├── Services/
│   │   │   └── ApiService.ts  # Axios client with auth headers
│   │   ├── models/            # TypeScript interfaces
│   │   └── test/
│   │       └── testHelpers.tsx  # withProviders, PromiseResolver
│   └── Dockerfile
├── docker/postgres/           # Postgres 16 Docker image
├── docker-compose.yaml        # Full stack orchestration (includes Redis)
├── Makefile                   # Development commands
└── .circleci/                 # CI/CD configuration
```

## Development Commands

```bash
make install        # Copy .env files + build Docker images
make launch         # Start all services
make test-server    # Run server tests
make test-client    # Run client tests
make test-all       # Run all tests
make lint-server    # Lint server
make lint-client    # Lint client
make lint-all       # Lint everything
make build-server   # Build server TypeScript
make db-migrate-all # Run all DB migrations
```

## Conventions

### Feature Module Pattern (Server)
Each API feature lives in `server/src/api/<feature>/`:
- `<feature>.api.ts` — Express request handlers
- `<feature>.api.test.ts` — Supertest tests
- `<feature>.api.docs.yaml` — OpenAPI docs
- `index.ts` — Router with middleware composition

Business logic goes in `server/src/lib/<feature>/`.

### Error Handling (Server)
Error class hierarchy in `utils/errors.ts` maps to HTTP status codes:
- `NotFoundError` → 404
- `AuthenticationError` → 401
- `PermissionError` → 403
- `ValidationError` → 400
- `ConflictError` → 409
- `ServerError` → 500

The global `errorHandler` in `api/errorHandler.ts` catches all errors, logs context, handles Sequelize errors, and masks 5xx details in production.

Static error messages live in `ErrorMessages` — add new messages there instead of inline strings.

### Middleware (Server)
Middleware lives in `api/middleware/`:

**security.ts**:
- `authenticate` — JWT or Basic auth, replaces `me` in route params
- `authenticateAccessToken` — JWT-only
- `requireRoleOfAtLeast('admin')` — Role hierarchy: guest < user < admin
- `isOperatingOnSelf('userId')` — Ensures user operates on own account

**routeValidators.ts**:
- `checkBodyFor(['field1', 'field2'])` — Required fields
- `checkQueryFor([...])` — Required query params
- `checkBodyForAtLeastOneOf([...])` — At least one required
- `checkBodyForNoExtraFields([...])` — Strict field list
- `validateUUIDsInParams(['id'])` — UUID format validation
- `checkBodyEnum('status', ALLOWED_VALUES)` — Enum validation
- `convertQueryParamToDate(['startTime'])` — Date conversion
- `convertQueryParamToNumber(['limit'])` — Number conversion
- `oneOf([middleware1, middleware2])` — Try alternatives

Example route:
```typescript
router.get('/:userId/profile',
  authenticate,
  validateUUIDsInParams(['userId']),
  controller.getProfile
);
```

### Testing
- **Server**: Mocha + Chai + Supertest. Root hooks in `mochaSetup.test.ts` handle nock and DB cleanup.
- **Client**: Vitest + React Testing Library. Use `withProviders()` from `testHelpers.tsx` for components needing Redux/Router.
- Test data: use `createUser()` from `testDataGenerator.ts`.
- `clearDatabase()` safely disables FK constraints before truncating all models.

### State Management (Client)
- Redux Toolkit with slice pattern in `redux/slices/`
- Auth state persists token to localStorage
- Use `selectIsAuthenticated`, `selectUser` selectors

### Routing (Client)
- React Router v7 with `createBrowserRouter`
- Protected routes wrap children in `ProtectedRoute`
- All routes nested under App layout

### Logger (Server)
- Use `import logger from './logger'` instead of `console.log`/`console.error`
- Automatically suppressed in test environment
- Use `logger.always.log()` when output must appear regardless of environment

## Ports

| Service    | Port |
|------------|------|
| Client     | 3000 |
| Client HMR | 3010 |
| Server     | 10020|
| Debug      | 9229 |
| Worker     | 10030|
| Postgres   | 5432 |
| Redis      | 6379 |

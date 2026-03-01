# Node-React Scaffold

## Project Structure

```
├── client/                          # React frontend (Vite)
│   └── src/
│       ├── models/User.ts           # UserProfile interface
│       ├── Pages/
│       │   ├── LoginPage/
│       │   ├── DashboardPage/
│       │   └── NotFoundPage/
│       ├── redux/
│       │   ├── store.ts             # configureStore, createTestStore
│       │   └── slices/authSlice.ts  # auth state, login/logout, selectors
│       ├── Routes/
│       │   ├── Routes.tsx           # createBrowserRouter definition
│       │   └── ProtectedRoute.tsx   # auth guard with redirect
│       ├── Services/ApiService.ts   # Axios instance with auth interceptor
│       ├── test/
│       │   ├── setup.ts            # Vitest setup (cleanup)
│       │   └── testHelpers.tsx     # PromiseResolver, withProviders
│       ├── App.tsx                  # Root layout with <Outlet />
│       └── main.tsx                 # StrictMode > Provider > RouterProvider
├── server/                          # Express backend
│   └── src/
│       ├── api/
│       │   ├── errorHandler.ts      # Global error middleware
│       │   ├── middleware/
│       │   │   ├── security.ts      # JWT auth, role checks, "me" replacement
│       │   │   └── routeValidators.ts  # UUID, field, enum validators
│       │   ├── routes.ts            # Route registration
│       │   └── healthCheck/         # Example feature module
│       ├── config/                  # Environment-based configuration
│       ├── db/
│       │   ├── index.ts             # Exports { sequelize, models: { User } }
│       │   ├── sequelize.ts         # Sequelize instance
│       │   ├── config.ts            # DB config per environment
│       │   ├── models/user.model/   # User model
│       │   └── migrations/
│       ├── docs/                    # OpenAPI/Swagger setup
│       ├── lib/healthCheck/         # Business logic modules
│       ├── logger.ts                # log/error (suppressed in test), always.*
│       ├── server.ts                # Express app setup
│       ├── utils/errors.ts          # Error class hierarchy + ErrorMessages
│       ├── worker.ts                # Background worker entry point
│       └── test/
│           ├── mochaSetup.test.ts   # Root hooks (nock, clearDatabase)
│           ├── testHelpers.ts       # clearDatabase, checkAndClearNocks
│           └── testDataGenerator.ts # createUser with faker
├── docker/postgres/                 # Postgres 16-alpine Dockerfile
├── docker-compose.yaml              # All services (postgres, redis, server, worker, client)
└── Makefile                         # Docker-wrapped dev commands
```

## Development Commands

All commands run inside Docker containers via `make`:

```bash
make install             # Copy .env templates and build images
make launch              # Start all services (foreground)
make launch-detached     # Start all services (background)
make terminate           # Stop all services

make test-server         # Run server Mocha tests
make test-client         # Run client Vitest tests
make test-all            # Run both

make lint-server         # ESLint + Prettier check (server)
make lint-client         # ESLint + Prettier check (client)
make lint-all            # Both

make build-server        # Compile server TypeScript

make db-migrate-all      # Run migrations for dev + test DBs
make generate-migration NAME=add-table  # Generate new migration
```

## Conventions

### Feature Module Pattern

Each feature is a directory under `server/src/api/` containing:
- `featureName.api.ts` — Express router with endpoint handlers
- `featureName.api.test.ts` — Integration tests using supertest
- `featureName.api.docs.yaml` — OpenAPI documentation
- `index.ts` — Re-exports the router

Business logic lives in `server/src/lib/featureName/`.

### Error Handling

Use the error class hierarchy from `utils/errors.ts`:

```typescript
import { NotFoundError, ValidationError, ErrorMessages } from "../utils/errors";

throw new NotFoundError(ErrorMessages.USER_NOT_FOUND);
throw new ValidationError(ErrorMessages.invalidBodyField("role", ["admin", "user"]));
```

The global error handler in `api/errorHandler.ts` maps each class to its HTTP status code automatically. Never send error responses manually from route handlers — throw the appropriate error and let the handler do it.

### Middleware Usage

```typescript
import { authenticate, requireRoleOfAtLeast } from "./middleware/security";
import { validateUUIDsInParams, checkBodyFor } from "./middleware/routeValidators";

router.get("/:id",
  authenticate,
  validateUUIDsInParams(["id"]),
  handler
);

router.post("/",
  authenticate,
  requireRoleOfAtLeast("admin"),
  checkBodyFor(["name", "email"]),
  handler
);
```

### Testing

**Server (Mocha/Chai):** Tests use root hooks in `mochaSetup.test.ts` which disable external HTTP (nock), clear the database between tests, and await app readiness. Use `createUser()` from `testDataGenerator.ts` for test data.

**Client (Vitest):** Use `withProviders(ui, { preloadedState, route })` from `testHelpers.tsx` to wrap components with Redux store and router context.

### State Management (Client)

Redux Toolkit with slices in `redux/slices/`. Auth state is persisted to localStorage.

```typescript
import { useSelector } from "react-redux";
import { selectUser, selectIsAuthenticated } from "./redux/slices/authSlice";
```

### Routing (Client)

React Router v7 with `createBrowserRouter` in `Routes/Routes.tsx`. Protected routes use `ProtectedRoute` which checks auth state and redirects to `/login`.

### Logger

Use `logger` instead of `console.log`/`console.error` in server code. Output is suppressed during tests unless `LOGGING_LEVEL=verbose`.

```typescript
import logger from "./logger";
logger.log("info message");
logger.error("error message");
logger.always.log("always visible, even in tests");
```

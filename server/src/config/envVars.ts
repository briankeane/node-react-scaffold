export const requiredEnvVars = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "JWT_SECRET",
] as const;

export const optionalEnvVars = [
  "SOME_OPTIONAL_ENV_VARIABLE",
  "BASIC_AUTH_TOKENS",
  "REDIS_URL",
] as const;

export type RequiredEnvVar = (typeof requiredEnvVars)[number];

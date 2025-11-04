export const requiredEnvVars = [
  "NODE_ENV",
  "PORT",
  "BASE_URL",
  "CLIENT_BASE_URL",
  "DATABASE_URL",
  "JWT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

export const optionalEnvVars = [
  "ONLY_ADMIN_CAN_EDIT_STATIONS",
  "SERVICE_API_TOKEN",
  "IOS_CLIENT_BASIC_TOKEN",
  "AUDIO_BLOCK_INJESTOR_BASIC_AUTH_TOKEN",
] as const;

export type RequiredEnvVar = (typeof requiredEnvVars)[number];

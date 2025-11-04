import { optionalEnvVars, requiredEnvVars } from "./envVars";

const DIRECT_ASSIGN_OPTIONAL_VARS = new Set([
  "SERVICE_API_TOKEN",
  "IOS_CLIENT_BASIC_TOKEN",
  "AUDIO_BLOCK_INJESTOR_BASIC_AUTH_TOKEN",
]);

export enum Environments {
  PRODUCTION = "production",
  DEVELOPMENT = "development",
  TEST = "test",
}

export class Config {
  [key: string]: unknown;

  env: string;
  NODE_ENV?: string;
  PORT!: string;
  DATABASE_URL!: string;
  JWT_SECRET!: string;
  BASE_URL!: string;
  CLIENT_BASE_URL!: string;
  GOOGLE_CLIENT_ID!: string;
  GOOGLE_CLIENT_SECRET!: string;
  SERVICE_API_TOKEN?: string;
  IOS_CLIENT_BASIC_TOKEN?: string;
  AUDIO_BLOCK_INJESTOR_BASIC_AUTH_TOKEN?: string;

  constructor(env: string = process.env.NODE_ENV ?? Environments.DEVELOPMENT) {
    this.env = env;
    this.loadEnvVars();
  }

  get GOOGLE_SIGNIN_REDIRECT_URI(): string {
    const baseUrl = this["BASE_URL"];
    if (typeof baseUrl !== "string") {
      throw new Error("BASE_URL must be defined as a string");
    }
    return `${baseUrl}/v1/auth/google/web/authorize`;
  }

  get ONLY_ADMIN_CAN_EDIT_STATIONS(): boolean {
    const value = this._ONLY_ADMIN_CAN_EDIT_STATIONS as string | undefined;
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return false;
  }

  /**
   * Load required and optional environment variables.
   * Required variables are assigned directly to the instance while optional
   * variables are stored with a leading underscore to match Playola's conventions.
   */
  loadEnvVars(): void {
    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar];
      if (value == null) {
        throw new Error(`Missing environment variable: ${envVar}`);
      }
      (this as Record<string, unknown>)[envVar] = value;
    }

    for (const envVar of optionalEnvVars) {
      const value = process.env[envVar];
      if (value != null) {
        if (DIRECT_ASSIGN_OPTIONAL_VARS.has(envVar)) {
          (this as Record<string, unknown>)[envVar] = value;
        } else {
          (this as Record<string, unknown>)[`_${envVar}`] = value;
        }
      }
    }
  }
}

export const config = new Config(process.env.NODE_ENV);

export { requiredEnvVars, optionalEnvVars };

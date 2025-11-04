import { Request } from "express";

export type AuthenticatedRequest<UserType = Record<string, unknown>> =
  Request & {
    user: UserType;
  };

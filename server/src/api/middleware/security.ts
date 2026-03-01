import { NextFunction, Request, Response } from "express";
import JWT from "express-jwt";
import config from "../../config/config";
import {
  AuthenticationError,
  ErrorMessages,
  PermissionError,
} from "../../utils/errors";

export interface JWTPayload {
  id: string;
  email: string;
  displayName?: string;
  profileImageUrl?: string;
  role: string;
}

if (!config.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const jwt = JWT.expressjwt({
  secret: config.JWT_SECRET,
  algorithms: ["HS256"],
  requestProperty: "auth",
});

const ROLE_HIERARCHY: Record<string, number> = {
  guest: 0,
  user: 1,
  admin: 2,
};

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (
    req.headers.authorization === `Basic ${"REPLACE_WITH_YOUR_BASIC_TOKEN"}`
  ) {
    next();
  } else {
    authenticateAccessToken(req, res, next);
  }
}

export function authenticateAccessToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  jwt(req, res, (err) => {
    if (err) {
      return next(
        new AuthenticationError(ErrorMessages.ACCESS_TOKEN_REQUIRED),
      );
    }
    if (!req.auth) {
      return next(new AuthenticationError(ErrorMessages.ACCESS_TOKEN_REQUIRED));
    }

    replaceMeParam(req);
    return next();
  });
}

function replaceMeParam(req: Request): void {
  if (req.auth?.id) {
    for (const key of Object.keys(req.params)) {
      if (req.params[key] === "me") {
        req.params[key] = req.auth.id;
      }
    }
  }
}

export function requireRoleOfAtLeast(minimumRole: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = req.auth?.role ?? "guest";
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;

    if (userLevel < requiredLevel) {
      return next(
        new PermissionError(ErrorMessages.missingPermission(minimumRole)),
      );
    }
    return next();
  };
}

export function isOperatingOnSelf(
  paramName: string = "id",
  source: "params" | "body" | "query" = "params",
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const targetId = (req[source] as Record<string, string>)[paramName];
    const userId = req.auth?.id;

    if (!userId || targetId !== userId) {
      return next(
        new PermissionError("You can only perform this action on your own account."),
      );
    }
    return next();
  };
}

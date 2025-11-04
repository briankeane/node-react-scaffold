import { NextFunction, Request, Response } from "express";
import { expressjwt } from "express-jwt";
import { config } from "../lib/config";
import stationLib from "../lib/stations/stations.lib";
import { AuthenticatedRequest } from "../types/express";
import { JWTPayload } from "../types/jwt";
import {
  AuthenticationError,
  ErrorMessages,
  PermissionError,
} from "../utils/errors";

type RequestWithAuth = Request & {
  auth?: JWTPayload;
  user?: JWTPayload;
};

const jwt = expressjwt({
  secret: config.JWT_SECRET,
  algorithms: ["HS256"],
});

function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = (req.headers.authorization ||
    req.headers.Authorization) as string;

  if (
    authHeader === `Basic ${config.SERVICE_API_TOKEN ?? ""}` ||
    authHeader === `Basic ${config.IOS_CLIENT_BASIC_TOKEN ?? ""}`
  ) {
    return next();
  }

  jwt(req, res, () => {
    const authReq = req as RequestWithAuth;
    if (authReq.auth) {
      authReq.user = authReq.auth;

      Object.keys(req.params).forEach((paramName) => {
        if (req.params[paramName] === "me") {
          req.params[paramName] = authReq.user!.id as unknown as string;
        }
      });

      return next();
    } else {
      next(new AuthenticationError(ErrorMessages.ACCESS_TOKEN_REQUIRED));
    }
  });
}

function authenticateAccessTokenOnly(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  jwt(req, res, () => {
    const authReq = req as RequestWithAuth;
    if (authReq.auth) {
      authReq.user = authReq.auth;

      Object.keys(req.params).forEach((paramName) => {
        if (req.params[paramName] === "me") {
          req.params[paramName] = authReq.user!.id as unknown as string;
        }
      });

      return next();
    } else {
      next(
        new AuthenticationError(
          "Invalid credentials: accessToken required for this endpoint.",
        ),
      );
    }
  });
}

function authenticateBasic(req: Request, res: Response, next: NextFunction) {
  const authHeader = (req.headers.Authorization ||
    req.headers.authorization) as string;
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    next(new AuthenticationError(ErrorMessages.BASIC_AUTH_REQUIRED));
    return;
  }
  const basicToken = authHeader.split(" ")[1];
  if (
    basicToken !== config.AUDIO_BLOCK_INJESTOR_BASIC_AUTH_TOKEN &&
    basicToken !== config.IOS_CLIENT_BASIC_TOKEN
  ) {
    next(new AuthenticationError("Invalid basic authentication token"));
    return;
  }
  return next();
}

async function checkUserPermissionToEditStation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authReq = req as AuthenticatedRequest<JWTPayload>;
    const { stationId } = req.params;
    const result = await stationLib.userHasPermissionToEditStation({
      userId: authReq.user.id as string,
      stationId,
    });
    if (!result) {
      next(
        new PermissionError(
          ErrorMessages.USER_LACKS_PERMISSION_TO_EDIT_STATION,
        ),
      );
      return;
    }
    return next();
  } catch (error) {
    next(error);
  }
}

const ROLE_HIERARCHY = {
  guest: 0,
  user: 1,
  admin: 2,
} as const;

type UserRole = keyof typeof ROLE_HIERARCHY;

function requireRoleOfAtLeast(minimumRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest<JWTPayload>;
      const userRole = authReq.user.role as UserRole;

      if (!userRole || !(userRole in ROLE_HIERARCHY)) {
        next(new PermissionError("Invalid user role"));
        return;
      }

      const userRoleLevel = ROLE_HIERARCHY[userRole];
      const minimumRoleLevel = ROLE_HIERARCHY[minimumRole];

      if (userRoleLevel < minimumRoleLevel) {
        next(new PermissionError(ErrorMessages.ADMIN_REQUIRED));
        return;
      }

      return next();
    } catch (error) {
      next(error);
    }
  };
}

function isOperatingOnSelf(
  paramName: string,
  source: "params" | "body" = "params",
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest<JWTPayload>;
    const targetUserId =
      source === "params" ? req.params[paramName] : req.body[paramName];
    const authenticatedUserId = authReq.user.id as string;

    if (targetUserId !== authenticatedUserId) {
      next(
        new PermissionError(
          "You can only perform this action on your own account",
        ),
      );
      return;
    }

    next();
  };
}

export {
  authenticate,
  authenticateAccessTokenOnly,
  authenticateBasic,
  checkUserPermissionToEditStation,
  requireRoleOfAtLeast,
  isOperatingOnSelf,
};

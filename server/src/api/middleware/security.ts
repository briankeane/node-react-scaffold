import { NextFunction, Request, Response } from 'express';
import { expressjwt } from 'express-jwt';
import config from '../../config/config';
import {
  AuthenticationError,
  ErrorMessages,
  PermissionError,
} from '../../utils/errors';

export interface JWTPayload {
  id: string;
  email: string;
  displayName?: string;
  profileImageUrl?: string;
  role: 'admin' | 'user' | 'guest';
}

const jwt = expressjwt({
  secret: config.JWT_SECRET!,
  algorithms: ['HS256'],
});

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = (req.headers.authorization ||
    req.headers.Authorization) as string;

  if (authHeader?.startsWith('Basic ')) {
    // Replace with your own basic auth token validation
    return next();
  }

  jwt(req, res, () => {
    if (req.auth) {
      // Replace "me" in route params with authenticated user's ID
      Object.keys(req.params).forEach((paramName) => {
        if (req.params[paramName] === 'me') {
          req.params[paramName] = req.auth!.id;
        }
      });
      return next();
    } else {
      next(new AuthenticationError(ErrorMessages.ACCESS_TOKEN_REQUIRED));
    }
  });
}

export function authenticateAccessToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  jwt(req, res, () => {
    if (req.auth) {
      Object.keys(req.params).forEach((paramName) => {
        if (req.params[paramName] === 'me') {
          req.params[paramName] = req.auth!.id;
        }
      });
      return next();
    } else {
      next(
        new AuthenticationError(
          'Invalid credentials: accessToken required for this endpoint.'
        )
      );
    }
  });
}

const ROLE_HIERARCHY = {
  guest: 0,
  user: 1,
  admin: 2,
} as const;

type UserRole = keyof typeof ROLE_HIERARCHY;

export function requireRoleOfAtLeast(minimumRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userRole = req.auth?.role as UserRole;

      if (!userRole || !(userRole in ROLE_HIERARCHY)) {
        next(new PermissionError('Invalid user role'));
        return;
      }

      if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minimumRole]) {
        next(new PermissionError(ErrorMessages.ADMIN_REQUIRED));
        return;
      }

      return next();
    } catch (error) {
      next(error);
    }
  };
}

export function isOperatingOnSelf(
  paramName: string,
  source: 'params' | 'body' = 'params'
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const targetUserId =
      source === 'params' ? req.params[paramName] : req.body[paramName];
    const authenticatedUserId = req.auth?.id;

    if (targetUserId !== authenticatedUserId) {
      next(
        new PermissionError(
          'You can only perform this action on your own account'
        )
      );
      return;
    }

    next();
  };
}

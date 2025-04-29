import { NextFunction, Request, Response } from 'express';
import JWT from 'express-jwt';
import config from '../config/config';
import { AuthenticationError } from '../errors';

// Define the structure of our JWT payload
interface JWTPayload {
  id: string;
  email: string;
  // Add any other properties that your JWT token includes
}
const jwt = JWT.expressjwt<JWTPayload>({
  secret: config.JWT_SECRET,
  algorithms: ['HS256'],
  requestProperty: 'auth', // express-jwt v7+ uses req.auth instead of req.user
});

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (
    req.headers.authorization === `Basic ${'REPLACE_WITH_YOUR_BASIC_TOKEN'}`
  ) {
    next();
  } else {
    authenticateAccessToken(req, res, next);
  }
}
export function authenticateAccessToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  jwt(req, res, (err: Error | null) => {
    if (err) {
      return next(
        new AuthenticationError(
          'Invalid credentials: accessToken required for this endpoint.'
        )
      );
    }
    if (!req.auth) {
      return next(new AuthenticationError('No auth data in token'));
    }
    return next();
  });
}

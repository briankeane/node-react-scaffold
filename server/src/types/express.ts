import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  // Authentication middleware attaches a JWT payload rather than a model instance.
  user: any;
}

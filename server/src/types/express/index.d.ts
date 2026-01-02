declare namespace Express {
  export interface Request {
    auth?: {
      id: string;
      email: string;
      // Match the JWTPayload interface
      [key: string]: string | number;
    };
  }
}

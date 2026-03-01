declare namespace Express {
  export interface Request {
    auth?: {
      id: string;
      email: string;
      displayName?: string;
      profileImageUrl?: string;
      role: "admin" | "user" | "guest";
      [key: string]: string | number | undefined;
    };
  }
}

export interface JWTPayload {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  profileImageUrl?: string;
  role: "admin" | "user" | "guest";
  deepLink?: string;
  [key: string]: unknown;
}

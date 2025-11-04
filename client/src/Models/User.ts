export type UserRole = "admin" | "user" | "guest";

export interface UserProfile {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  role: UserRole;
  profileImageUrl?: string;
}

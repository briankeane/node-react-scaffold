export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  profileImageUrl?: string;
  role: 'admin' | 'user' | 'guest';
}

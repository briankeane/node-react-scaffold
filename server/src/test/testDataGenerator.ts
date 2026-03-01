import { faker } from '@faker-js/faker';
import User from '../db/models/user.model/user.model';

type UserOverrides = Partial<{
  displayName: string;
  email: string;
  profileImageUrl: string;
  role: 'admin' | 'user' | 'guest';
}>;

export async function createUser(overrides: UserOverrides = {}) {
  return User.create({
    displayName: overrides.displayName ?? faker.person.fullName(),
    email: overrides.email ?? faker.internet.email(),
    profileImageUrl: overrides.profileImageUrl ?? faker.image.avatar(),
    role: overrides.role ?? 'user',
  });
}

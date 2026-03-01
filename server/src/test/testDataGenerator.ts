import { faker } from "@faker-js/faker";
import config from "../config/config";
import User from "../db/models/user.model";

if (config.NODE_ENV !== "test") {
  throw new Error("testDataGenerator can only be used in test environment");
}

type UserOverrides = Partial<{
  id: string;
  displayName: string;
  email: string;
  profileImageUrl: string;
  role: "admin" | "user" | "guest";
}>;

export async function createUser(overrides: UserOverrides = {}) {
  return User.create({
    displayName: overrides.displayName ?? faker.person.fullName(),
    email: overrides.email ?? faker.internet.email(),
    profileImageUrl: overrides.profileImageUrl ?? faker.image.avatar(),
    role: overrides.role ?? "user",
    ...overrides,
  });
}

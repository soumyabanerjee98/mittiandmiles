import type { UserRecord, UserRepository } from "./user-repository.js";

export type AuthUserRepository = UserRepository & {
  findByEmail(email: string): Promise<UserRecord | null>;
  findCredentialsByEmail(
    email: string,
  ): Promise<{ user: UserRecord; passwordHash: string } | null>;
  createLocalUser(input: {
    email: string;
    passwordHash: string;
    locale: string;
  }): Promise<UserRecord>;
};

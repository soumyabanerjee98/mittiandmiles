import { randomUUID } from "node:crypto";
import type { RoleGrant } from "../auth/permissions.js";
import { LOCAL_AUTH_PROVIDER } from "../auth/constants.js";
import type { AuthUserRepository } from "./auth-user-repository.js";
import type { UserRecord } from "./user-repository.js";

type StoredUser = UserRecord & { passwordHash?: string };

export class MemoryAuthUserRepository implements AuthUserRepository {
  private readonly users: StoredUser[];

  constructor(users: readonly StoredUser[] = []) {
    this.users = users.map((user) => ({
      ...user,
      roles: [...user.roles],
    }));
  }

  findByAuthSubject(
    provider: string,
    subject: string,
  ): Promise<UserRecord | null> {
    return Promise.resolve(
      this.users.find(
        (user) =>
          user.authProvider === provider && user.authSubject === subject,
      ) ?? null,
    );
  }

  findById(id: string): Promise<UserRecord | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }

  updateLocale(id: string, locale: string): Promise<UserRecord | null> {
    const user = this.users.find((candidate) => candidate.id === id);
    if (user === undefined) {
      return Promise.resolve(null);
    }
    user.locale = locale;
    return Promise.resolve(user);
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return Promise.resolve(
      this.users.find(
        (row) => row.email.toLowerCase() === email.toLowerCase(),
      ) ?? null,
    );
  }

  findCredentialsByEmail(
    email: string,
  ): Promise<{ user: UserRecord; passwordHash: string } | null> {
    const user = this.users.find(
      (row) => row.email.toLowerCase() === email.toLowerCase(),
    );
    if (user === undefined || user.passwordHash === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ user, passwordHash: user.passwordHash });
  }

  createLocalUser(input: {
    email: string;
    passwordHash: string;
    locale: string;
  }): Promise<UserRecord> {
    const email = input.email.toLowerCase();
    const id = randomUUID();
    const roles: RoleGrant[] = [{ role: "TRAVELLER", scope: "" }];
    const user: StoredUser = {
      id,
      email,
      authProvider: LOCAL_AUTH_PROVIDER,
      authSubject: id,
      accountStatus: "ACTIVE",
      locale: input.locale,
      roles,
      passwordHash: input.passwordHash,
    };
    this.users.push(user);
    return Promise.resolve(user);
  }
}

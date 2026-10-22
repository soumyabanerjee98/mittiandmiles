import type { UserRecord, UserRepository } from "./user-repository.js";

export class MemoryUserRepository implements UserRepository {
  private readonly users: UserRecord[];

  constructor(users: readonly UserRecord[]) {
    this.users = users.map((user) => ({ ...user, roles: [...user.roles] }));
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
}

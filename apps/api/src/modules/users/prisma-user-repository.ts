import type { PrismaClient } from "@prisma/client";
import { isRole, type RoleGrant } from "../auth/permissions.js";
import {
  AccountStatus,
  type UserRecord,
  type UserRepository,
} from "./user-repository.js";

type UserRow = {
  id: string;
  email: string;
  authProvider: string;
  authSubject: string;
  accountStatus: string;
  locale: string;
  roles: readonly { role: string; scope: string }[];
};

export class PrismaUserRepository implements UserRepository {
  constructor(protected readonly prisma: PrismaClient) {}

  async findByAuthSubject(
    provider: string,
    subject: string,
  ): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        authProvider_authSubject: {
          authProvider: provider,
          authSubject: subject,
        },
      },
      include: { roles: true },
    });
    return user === null ? null : mapPrismaUserToRecord(user);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });
    return user === null ? null : mapPrismaUserToRecord(user);
  }

  async updateLocale(id: string, locale: string): Promise<UserRecord | null> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { locale },
        include: { roles: true },
      });
      return mapPrismaUserToRecord(user);
    } catch (error: unknown) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }
}

export function mapPrismaUserToRecord(user: UserRow): UserRecord {
  if (!isAccountStatus(user.accountStatus)) {
    throw new Error("Stored account status is not supported.");
  }
  const roles: RoleGrant[] = [];
  for (const grant of user.roles) {
    if (isRole(grant.role)) {
      roles.push({ role: grant.role, scope: grant.scope });
    }
  }
  return {
    id: user.id,
    email: user.email,
    authProvider: user.authProvider,
    authSubject: user.authSubject,
    accountStatus: user.accountStatus,
    locale: user.locale,
    roles,
  };
}

function isAccountStatus(value: string): value is UserRecord["accountStatus"] {
  return (
    value === AccountStatus.ACTIVE ||
    value === AccountStatus.SUSPENDED ||
    value === AccountStatus.CLOSED
  );
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  );
}

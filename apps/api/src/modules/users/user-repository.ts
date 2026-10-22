import type { RoleGrant } from "../auth/permissions.js";

export const AccountStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  CLOSED: "CLOSED",
} as const;

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export type UserRecord = {
  id: string;
  email: string;
  authProvider: string;
  authSubject: string;
  accountStatus: AccountStatus;
  locale: string;
  roles: readonly RoleGrant[];
};

export type UserRepository = {
  findByAuthSubject(
    provider: string,
    subject: string,
  ): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  updateLocale(id: string, locale: string): Promise<UserRecord | null>;
};

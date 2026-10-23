import { Role } from "@prisma/client";

/**
 * Development-only identities. Emails use the reserved example.com domain.
 * There are no passwords, documents, payment credentials, or real people.
 */
export type DevelopmentRoleGrant = {
  role: Role;
  scope: string;
};

export type DevelopmentUserFixture = {
  id: string;
  email: string;
  authProvider: "development";
  authSubject: string;
  locale: string;
  roles: readonly DevelopmentRoleGrant[];
  traveller?: { displayName: string };
  host?: { id: string; publicName: string };
};

export const developmentUsers: readonly DevelopmentUserFixture[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    email: "dev.traveller@example.com",
    authProvider: "development",
    authSubject: "dev-traveller",
    locale: "en",
    roles: [{ role: Role.TRAVELLER, scope: "" }],
    traveller: { displayName: "Dev Traveller" },
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    email: "dev.host@example.com",
    authProvider: "development",
    authSubject: "dev-host",
    locale: "en",
    roles: [{ role: Role.HOST, scope: "" }],
    host: {
      id: "22222222-2222-4222-8222-222222222223",
      publicName: "Dev Host",
    },
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    email: "dev.other@example.com",
    authProvider: "development",
    authSubject: "dev-other",
    locale: "en",
    roles: [{ role: Role.TRAVELLER, scope: "" }],
    traveller: { displayName: "Dev Other" },
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    email: "dev.operations@example.com",
    authProvider: "development",
    authSubject: "dev-operations",
    locale: "en",
    roles: [{ role: Role.OPERATIONS, scope: "" }],
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    email: "dev.support@example.com",
    authProvider: "development",
    authSubject: "dev-support",
    locale: "en",
    roles: [{ role: Role.SUPPORT, scope: "" }],
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    email: "dev.verification@example.com",
    authProvider: "development",
    authSubject: "dev-verification",
    locale: "en",
    roles: [{ role: Role.VERIFICATION, scope: "" }],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    email: "dev.finance@example.com",
    authProvider: "development",
    authSubject: "dev-finance",
    locale: "en",
    roles: [{ role: Role.FINANCE, scope: "" }],
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    email: "dev.super@example.com",
    authProvider: "development",
    authSubject: "dev-super",
    locale: "en",
    roles: [{ role: Role.SUPER_ADMIN, scope: "" }],
  },
];

export function assertDevelopmentSeed(nodeEnv: string | undefined): void {
  if (nodeEnv !== "development") {
    throw new Error("Refusing to seed: NODE_ENV must be development.");
  }
}

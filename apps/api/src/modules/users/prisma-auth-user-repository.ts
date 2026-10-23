import { Role } from "@prisma/client";
import { LOCAL_AUTH_PROVIDER } from "../auth/constants.js";
import type { AuthUserRepository } from "./auth-user-repository.js";
import {
  mapPrismaUserToRecord,
  PrismaUserRepository,
} from "./prisma-user-repository.js";

export class PrismaAuthUserRepository
  extends PrismaUserRepository
  implements AuthUserRepository
{
  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: true },
    });
    return user === null ? null : mapPrismaUserToRecord(user);
  }

  async findCredentialsByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: true },
    });
    if (user === null || user.passwordHash === null) {
      return null;
    }
    return {
      user: mapPrismaUserToRecord(user),
      passwordHash: user.passwordHash,
    };
  }

  async createLocalUser(input: {
    email: string;
    passwordHash: string;
    locale: string;
  }) {
    const email = input.email.toLowerCase();
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          authProvider: LOCAL_AUTH_PROVIDER,
          authSubject: email,
          locale: input.locale,
          passwordHash: input.passwordHash,
          accountStatus: "ACTIVE",
        },
      });
      await tx.user.update({
        where: { id: created.id },
        data: { authSubject: created.id },
      });
      await tx.userRole.create({
        data: {
          userId: created.id,
          role: Role.TRAVELLER,
          scope: "",
        },
      });
      await tx.travellerProfile.create({
        data: {
          userId: created.id,
          displayName: email.split("@")[0] ?? "Traveller",
        },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: { roles: true },
      });
    });
    return mapPrismaUserToRecord(user);
  }
}

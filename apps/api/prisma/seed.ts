import { pathToFileURL } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  assertDevelopmentSeed,
  developmentUsers,
} from "./development-fixtures.js";

async function main(): Promise<void> {
  assertDevelopmentSeed(process.env.NODE_ENV);
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const fixture of developmentUsers) {
        await tx.user.upsert({
          where: { id: fixture.id },
          create: {
            id: fixture.id,
            email: fixture.email,
            authProvider: fixture.authProvider,
            authSubject: fixture.authSubject,
            locale: fixture.locale,
            accountStatus: "ACTIVE",
          },
          update: {
            email: fixture.email,
            authProvider: fixture.authProvider,
            authSubject: fixture.authSubject,
            locale: fixture.locale,
            accountStatus: "ACTIVE",
          },
        });
        await tx.userRole.deleteMany({ where: { userId: fixture.id } });
        await tx.userRole.createMany({
          data: fixture.roles.map((grant) => ({
            userId: fixture.id,
            role: grant.role,
            scope: grant.scope,
          })),
        });
        if (fixture.traveller !== undefined) {
          await tx.travellerProfile.upsert({
            where: { userId: fixture.id },
            create: {
              userId: fixture.id,
              displayName: fixture.traveller.displayName,
            },
            update: { displayName: fixture.traveller.displayName },
          });
        }
        if (fixture.host !== undefined) {
          await tx.hostProfile.upsert({
            where: { userId: fixture.id },
            create: {
              id: fixture.host.id,
              userId: fixture.id,
              publicName: fixture.host.publicName,
              verificationStatus: "NOT_STARTED",
              onboardingStatus: "NOT_STARTED",
              publicProfileStatus: "HIDDEN",
            },
            update: {
              publicName: fixture.host.publicName,
              verificationStatus: "NOT_STARTED",
              onboardingStatus: "NOT_STARTED",
              publicProfileStatus: "HIDDEN",
            },
          });
        }
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Seed failed";
    console.error(message);
    process.exit(1);
  });
}

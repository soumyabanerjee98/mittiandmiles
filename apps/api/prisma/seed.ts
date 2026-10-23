import { pathToFileURL } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  assertDevelopmentSeed,
  developmentCatalogue,
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

      for (const language of developmentCatalogue.languages) {
        await tx.language.upsert({
          where: { code: language.code },
          create: {
            code: language.code,
            name: language.name,
            active: language.active,
            createdAt: new Date(language.createdAt),
          },
          update: { name: language.name, active: language.active },
        });
      }
      for (const category of developmentCatalogue.categories) {
        await tx.category.upsert({
          where: { slug: category.slug },
          create: {
            slug: category.slug,
            name: category.name,
            active: category.active,
            createdAt: new Date(category.createdAt),
          },
          update: { name: category.name, active: category.active },
        });
      }
      for (const city of developmentCatalogue.cities) {
        await tx.city.upsert({
          where: { id: city.id },
          create: {
            id: city.id,
            slug: city.slug,
            name: city.name,
            state: city.state,
            countryCode: city.countryCode,
            timezone: city.timezone,
            status: city.status,
            createdAt: new Date(city.createdAt),
          },
          update: {
            slug: city.slug,
            name: city.name,
            state: city.state,
            countryCode: city.countryCode,
            timezone: city.timezone,
            status: city.status,
          },
        });
      }
      for (const experience of developmentCatalogue.experiences) {
        const data = {
          hostId: experience.hostId,
          cityId: experience.cityId,
          category: experience.category,
          title: experience.title,
          description: experience.description,
          durationMinutes: experience.durationMinutes,
          basePriceMinor: experience.basePriceMinor,
          currency: experience.currency,
          capacity: experience.capacity,
          listingStatus: experience.listingStatus,
          inclusions: experience.inclusions,
          exclusions: experience.exclusions,
          meetingArea: experience.meetingArea,
          accessibilityNotes: experience.accessibilityNotes,
          safetyNotes: experience.safetyNotes,
          cancellationPolicy: experience.cancellationPolicy,
        };
        await tx.experience.upsert({
          where: { id: experience.id },
          create: {
            id: experience.id,
            ...data,
            createdAt: new Date(experience.createdAt),
            languages: {
              create: experience.languageCodes.map((languageCode) => ({
                languageCode,
              })),
            },
          },
          update: data,
        });
        await tx.experienceLanguage.deleteMany({
          where: { experienceId: experience.id },
        });
        await tx.experienceLanguage.createMany({
          data: experience.languageCodes.map((languageCode) => ({
            experienceId: experience.id,
            languageCode,
          })),
        });
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

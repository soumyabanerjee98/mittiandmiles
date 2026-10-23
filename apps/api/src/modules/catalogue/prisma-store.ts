import { Prisma, PrismaClient } from "@prisma/client";
import type {
  CatalogueStore,
  ExperienceContentUpdate,
  HostProfileUpdate,
} from "./store.js";
import {
  type BlackoutRecord,
  type CategoryRecord,
  type CityRecord,
  type CityStatus,
  type ExperienceView,
  type HostDocumentRecord,
  type HostRecord,
  type ImageRecord,
  type LanguageRecord,
  type ListingStatus,
  type SlotRecord,
  type StoredExperience,
  expectMember,
} from "./types.js";

const experienceInclude = {
  host: true,
  city: true,
  languages: true,
  images: { orderBy: { sortOrder: "asc" } },
  slots: true,
  blackouts: true,
} satisfies Prisma.ExperienceInclude;

type ExperienceRow = Prisma.ExperienceGetPayload<{
  include: typeof experienceInclude;
}>;

type HostRow = Prisma.HostProfileGetPayload<{ include: { documents: true } }>;

export class PrismaCatalogueStore implements CatalogueStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listCities(status: CityStatus | "ANY"): Promise<CityRecord[]> {
    const rows = await this.prisma.city.findMany({
      where: status === "ANY" ? {} : { status },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(toCity);
  }

  async findCityById(id: string): Promise<CityRecord | null> {
    const row = await this.prisma.city.findUnique({ where: { id } });
    return row === null ? null : toCity(row);
  }

  async findCityBySlug(slug: string): Promise<CityRecord | null> {
    const row = await this.prisma.city.findUnique({ where: { slug } });
    return row === null ? null : toCity(row);
  }

  async insertCity(city: CityRecord): Promise<"created" | "duplicate"> {
    try {
      await this.prisma.city.create({ data: toCityWrite(city) });
      return "created";
    } catch (error: unknown) {
      if (isUnique(error)) {
        return "duplicate";
      }
      throw error;
    }
  }

  async updateCityStatus(
    id: string,
    status: CityStatus,
  ): Promise<CityRecord | null> {
    try {
      const row = await this.prisma.city.update({
        where: { id },
        data: { status },
      });
      return toCity(row);
    } catch (error: unknown) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  async listLanguages(activeOnly: boolean): Promise<LanguageRecord[]> {
    const rows = await this.prisma.language.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { code: "asc" },
    });
    return rows.map(toLanguage);
  }

  async listCategories(activeOnly: boolean): Promise<CategoryRecord[]> {
    const rows = await this.prisma.category.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { name: "asc" },
    });
    return rows.map(toCategory);
  }

  async findLanguage(code: string): Promise<LanguageRecord | null> {
    const row = await this.prisma.language.findUnique({ where: { code } });
    return row === null ? null : toLanguage(row);
  }

  async findCategory(slug: string): Promise<CategoryRecord | null> {
    const row = await this.prisma.category.findUnique({ where: { slug } });
    return row === null ? null : toCategory(row);
  }

  async insertLanguage(
    language: LanguageRecord,
  ): Promise<"created" | "duplicate"> {
    try {
      await this.prisma.language.create({
        data: {
          code: language.code,
          name: language.name,
          active: language.active,
          createdAt: new Date(language.createdAt),
        },
      });
      return "created";
    } catch (error: unknown) {
      if (isUnique(error)) {
        return "duplicate";
      }
      throw error;
    }
  }

  async insertCategory(
    category: CategoryRecord,
  ): Promise<"created" | "duplicate"> {
    try {
      await this.prisma.category.create({
        data: {
          slug: category.slug,
          name: category.name,
          active: category.active,
          createdAt: new Date(category.createdAt),
        },
      });
      return "created";
    } catch (error: unknown) {
      if (isUnique(error)) {
        return "duplicate";
      }
      throw error;
    }
  }

  async findHostByUserId(userId: string): Promise<HostRecord | null> {
    const row = await this.prisma.hostProfile.findUnique({
      where: { userId },
      include: { documents: { where: { deletedAt: null } } },
    });
    return row === null ? null : toHost(row);
  }

  async findHostById(id: string): Promise<HostRecord | null> {
    const row = await this.prisma.hostProfile.findUnique({
      where: { id },
      include: { documents: { where: { deletedAt: null } } },
    });
    return row === null ? null : toHost(row);
  }

  async listHosts(): Promise<HostRecord[]> {
    const rows = await this.prisma.hostProfile.findMany({
      include: { documents: { where: { deletedAt: null } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(toHost);
  }

  async insertHost(host: HostRecord): Promise<void> {
    await this.prisma.hostProfile.create({
      data: {
        id: host.id,
        userId: host.userId,
        publicName: host.publicName,
        bio: host.bio,
        verificationStatus: host.verificationStatus,
        onboardingStatus: host.onboardingStatus,
        publicProfileStatus: host.publicProfileStatus,
        verificationNote: host.verificationNote,
      },
    });
  }

  async updateHost(update: HostProfileUpdate): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.hostProfile.update({
        where: { id: update.id },
        data: {
          publicName: update.publicName,
          bio: update.bio,
          verificationStatus: update.verificationStatus,
          onboardingStatus: update.onboardingStatus,
          publicProfileStatus: update.publicProfileStatus,
          verificationNote: update.verificationNote,
        },
      });
      for (const document of update.documents) {
        await tx.hostDocument.update({
          where: { id: document.id },
          data: { verificationState: document.verificationState },
        });
      }
    });
  }

  async insertDocument(document: HostDocumentRecord): Promise<void> {
    await this.prisma.hostDocument.create({
      data: {
        id: document.id,
        hostId: document.hostId,
        documentType: document.documentType,
        storageReference: document.storageReference,
        verificationState: document.verificationState,
      },
    });
  }

  async insertExperience(experience: StoredExperience): Promise<void> {
    await this.prisma.experience.create({
      data: {
        ...experienceScalars(experience),
        id: experience.id,
        hostId: experience.hostId,
        listingStatus: experience.listingStatus,
        moderationNote: experience.moderationNote,
        createdAt: new Date(experience.createdAt),
        languages: {
          create: experience.languageCodes.map((languageCode) => ({
            languageCode,
          })),
        },
      },
    });
  }

  async updateExperienceContent(
    update: ExperienceContentUpdate,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.experience.update({
        where: { id: update.id },
        data: {
          cityId: update.cityId,
          category: update.category,
          title: update.title,
          description: update.description,
          durationMinutes: update.durationMinutes,
          basePriceMinor: update.basePriceMinor,
          currency: update.currency,
          capacity: update.capacity,
          inclusions: update.inclusions,
          exclusions: update.exclusions,
          meetingArea: update.meetingArea,
          accessibilityNotes: update.accessibilityNotes,
          safetyNotes: update.safetyNotes,
          cancellationPolicy: update.cancellationPolicy,
        },
      });
      await tx.experienceLanguage.deleteMany({
        where: { experienceId: update.id },
      });
      if (update.languageCodes.length > 0) {
        await tx.experienceLanguage.createMany({
          data: update.languageCodes.map((languageCode) => ({
            experienceId: update.id,
            languageCode,
          })),
        });
      }
    });
  }

  async updateListing(
    id: string,
    listingStatus: ListingStatus,
    moderationNote: string | null,
  ): Promise<void> {
    await this.prisma.experience.update({
      where: { id },
      data: { listingStatus, moderationNote },
    });
  }

  async replaceSchedule(
    id: string,
    slots: readonly SlotRecord[],
    blackouts: readonly BlackoutRecord[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.experienceSlot.deleteMany({ where: { experienceId: id } });
      await tx.experienceBlackout.deleteMany({ where: { experienceId: id } });
      if (slots.length > 0) {
        await tx.experienceSlot.createMany({
          data: slots.map((slot) => ({
            id: slot.id,
            experienceId: id,
            startsAt: new Date(slot.startsAt),
            endsAt: new Date(slot.endsAt),
            capacity: slot.capacity,
            status: slot.status,
          })),
        });
      }
      if (blackouts.length > 0) {
        await tx.experienceBlackout.createMany({
          data: blackouts.map((blackout) => ({
            id: blackout.id,
            experienceId: id,
            startsAt: new Date(blackout.startsAt),
            endsAt: new Date(blackout.endsAt),
          })),
        });
      }
    });
  }

  async insertImage(experienceId: string, image: ImageRecord): Promise<void> {
    await this.prisma.experienceImage.create({
      data: {
        id: image.id,
        experienceId,
        storageReference: image.storageReference,
        sortOrder: image.sortOrder,
        moderationStatus: image.moderationStatus,
      },
    });
  }

  async updateImageStatus(
    experienceId: string,
    imageId: string,
    moderationStatus: ImageRecord["moderationStatus"],
  ): Promise<boolean> {
    const image = await this.prisma.experienceImage.findFirst({
      where: { id: imageId, experienceId },
    });
    if (image === null) {
      return false;
    }
    await this.prisma.experienceImage.update({
      where: { id: imageId },
      data: { moderationStatus },
    });
    return true;
  }

  async findExperience(id: string): Promise<ExperienceView | null> {
    const row = await this.prisma.experience.findUnique({
      where: { id },
      include: experienceInclude,
    });
    return row === null ? null : toExperience(row);
  }

  async listExperiences(): Promise<ExperienceView[]> {
    const rows = await this.prisma.experience.findMany({
      include: experienceInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(toExperience);
  }

  async countBlockingReservations(experienceId: string): Promise<number> {
    return this.prisma.slotReservation.count({
      where: {
        state: { in: ["HELD", "CONFIRMED"] },
        slot: { experienceId },
      },
    });
  }
}

function toCity(row: {
  id: string;
  slug: string;
  name: string;
  state: string;
  countryCode: string;
  timezone: string;
  status: string;
  createdAt: Date;
}): CityRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    state: row.state,
    countryCode: row.countryCode,
    timezone: row.timezone,
    status: expectMember(row.status, ["INACTIVE", "ACTIVE"], "city status"),
    createdAt: row.createdAt.toISOString(),
  };
}

function toCityWrite(city: CityRecord): Prisma.CityCreateInput {
  return {
    id: city.id,
    slug: city.slug,
    name: city.name,
    state: city.state,
    countryCode: city.countryCode,
    timezone: city.timezone,
    status: city.status,
    createdAt: new Date(city.createdAt),
  };
}

function toLanguage(row: {
  code: string;
  name: string;
  active: boolean;
  createdAt: Date;
}): LanguageRecord {
  return {
    code: row.code,
    name: row.name,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCategory(row: {
  slug: string;
  name: string;
  active: boolean;
  createdAt: Date;
}): CategoryRecord {
  return {
    slug: row.slug,
    name: row.name,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

function toHost(row: HostRow): HostRecord {
  return {
    id: row.id,
    userId: row.userId,
    publicName: row.publicName,
    bio: row.bio,
    verificationStatus: expectMember(
      row.verificationStatus,
      [
        "NOT_STARTED",
        "PENDING",
        "VERIFIED",
        "REJECTED",
        "EXPIRED",
        "NEEDS_INFORMATION",
      ],
      "host verification status",
    ),
    onboardingStatus: expectMember(
      row.onboardingStatus,
      ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "COMPLETE"],
      "host onboarding status",
    ),
    publicProfileStatus: expectMember(
      row.publicProfileStatus,
      ["HIDDEN", "VISIBLE"],
      "public profile status",
    ),
    verificationNote: row.verificationNote,
    createdAt: row.createdAt.toISOString(),
    documents: row.documents.map((document) => ({
      id: document.id,
      hostId: document.hostId,
      documentType: expectMember(
        document.documentType,
        ["IDENTITY", "ADDRESS", "CREDENTIAL", "OTHER"],
        "document type",
      ),
      storageReference: document.storageReference,
      verificationState: expectMember(
        document.verificationState,
        ["PENDING", "VERIFIED", "REJECTED"],
        "document verification state",
      ),
    })),
  };
}

function experienceScalars(
  experience: StoredExperience,
): Omit<
  Prisma.ExperienceUncheckedCreateInput,
  "id" | "hostId" | "listingStatus" | "moderationNote" | "createdAt"
> {
  return {
    cityId: experience.cityId,
    category: experience.category,
    title: experience.title,
    description: experience.description,
    durationMinutes: experience.durationMinutes,
    basePriceMinor: experience.basePriceMinor,
    currency: experience.currency,
    capacity: experience.capacity,
    inclusions: experience.inclusions,
    exclusions: experience.exclusions,
    meetingArea: experience.meetingArea,
    accessibilityNotes: experience.accessibilityNotes,
    safetyNotes: experience.safetyNotes,
    cancellationPolicy: experience.cancellationPolicy,
  };
}

function toExperience(row: ExperienceRow): ExperienceView {
  return {
    id: row.id,
    hostId: row.hostId,
    cityId: row.cityId,
    category: row.category,
    title: row.title,
    description: row.description,
    durationMinutes: row.durationMinutes,
    basePriceMinor: row.basePriceMinor,
    currency: row.currency,
    capacity: row.capacity,
    listingStatus: expectMember(
      row.listingStatus,
      [
        "DRAFT",
        "IN_REVIEW",
        "PUBLISHED",
        "REJECTED",
        "UNPUBLISHED",
        "ARCHIVED",
      ],
      "listing status",
    ),
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    meetingArea: row.meetingArea,
    accessibilityNotes: row.accessibilityNotes,
    safetyNotes: row.safetyNotes,
    cancellationPolicy: row.cancellationPolicy,
    moderationNote: row.moderationNote,
    languageCodes: row.languages.map((language) => language.languageCode),
    images: row.images.map((image) => ({
      id: image.id,
      storageReference: image.storageReference,
      sortOrder: image.sortOrder,
      moderationStatus: expectMember(
        image.moderationStatus,
        ["PENDING", "APPROVED", "REJECTED"],
        "image moderation status",
      ),
    })),
    slots: row.slots.map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      capacity: slot.capacity,
      status: expectMember(
        slot.status,
        ["OPEN", "CLOSED", "CANCELLED"],
        "slot status",
      ),
    })),
    blackouts: row.blackouts.map((blackout) => ({
      id: blackout.id,
      startsAt: blackout.startsAt.toISOString(),
      endsAt: blackout.endsAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    hostUserId: row.host.userId,
    hostPublicName: row.host.publicName,
    hostBio: row.host.bio,
    hostVerificationStatus: expectMember(
      row.host.verificationStatus,
      [
        "NOT_STARTED",
        "PENDING",
        "VERIFIED",
        "REJECTED",
        "EXPIRED",
        "NEEDS_INFORMATION",
      ],
      "host verification status",
    ),
    hostPublicProfileStatus: expectMember(
      row.host.publicProfileStatus,
      ["HIDDEN", "VISIBLE"],
      "public profile status",
    ),
    citySlug: row.city.slug,
    cityName: row.city.name,
    cityState: row.city.state,
    cityCountryCode: row.city.countryCode,
    cityTimezone: row.city.timezone,
    cityStatus: expectMember(
      row.city.status,
      ["INACTIVE", "ACTIVE"],
      "city status",
    ),
  };
}

function isUnique(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
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

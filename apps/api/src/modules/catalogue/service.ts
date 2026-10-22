import { randomUUID } from "node:crypto";
import { HttpError } from "../../shared/http-error.js";
import type { PrivateDocumentStorage } from "./document-storage.js";
import {
  bookingBlockReason,
  matchesDiscovery,
  selectableSlots,
  type DiscoveryFilter,
} from "./discovery.js";
import type { CatalogueStore } from "./store.js";
import { isIanaTimeZone, validateSchedule } from "./time.js";
import type {
  BlackoutRecord,
  CategoryRecord,
  CityRecord,
  CityStatus,
  DocumentType,
  ExperienceView,
  HostRecord,
  HostVerificationStatus,
  ImageModerationStatus,
  LanguageRecord,
  ListingStatus,
  SlotRecord,
  StoredExperience,
} from "./types.js";

export class ResourceNotOwnedError extends HttpError {
  readonly resourceType: string;
  readonly resourceId: string;

  constructor(resourceType: string, resourceId: string) {
    super(404, "NOT_FOUND", "Not found.");
    this.name = "ResourceNotOwnedError";
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

export type OnboardingInput = {
  publicName: string;
  bio?: string;
  submit: boolean;
};

export type ExperienceInput = {
  cityId: string;
  category: string;
  title: string;
  description: string;
  durationMinutes: number;
  basePriceMinor: number;
  currency: string;
  capacity: number;
  inclusions: string;
  exclusions: string;
  meetingArea: string;
  accessibilityNotes: string;
  safetyNotes: string;
  cancellationPolicy: string;
  languageCodes: readonly string[];
};

export type ExperiencePatch = {
  [Key in keyof ExperienceInput]?: ExperienceInput[Key];
};

export type ScheduleInput = {
  slots: readonly { startsAt: string; endsAt: string; capacity: number }[];
  blackouts: readonly { startsAt: string; endsAt: string }[];
};

export type VerificationDecision = "APPROVE" | "REJECT" | "NEEDS_INFORMATION";
export type ListingDecision = "PUBLISH" | "REJECT" | "UNPUBLISH" | "ARCHIVE";

export type ReviewedDocument = {
  id: string;
  documentType: DocumentType;
  verificationState: HostRecord["documents"][number]["verificationState"];
  access: { scheme: "unconfigured"; expiresAt: string };
};

type Changed<T> = { changed: boolean; value: T };

export class CatalogueService {
  constructor(
    private readonly store: CatalogueStore,
    private readonly documents: PrivateDocumentStorage,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = () => randomUUID(),
  ) {}

  listCities(status: CityStatus | "ANY"): Promise<CityRecord[]> {
    return this.store.listCities(status);
  }

  async createCity(input: {
    slug: string;
    name: string;
    state: string;
    countryCode: string;
    timezone: string;
  }): Promise<CityRecord> {
    if (!isIanaTimeZone(input.timezone)) {
      throw invalid("timezone");
    }
    const city: CityRecord = {
      id: this.newId(),
      slug: input.slug,
      name: input.name,
      state: input.state,
      countryCode: input.countryCode,
      timezone: input.timezone,
      status: "INACTIVE",
      createdAt: this.now().toISOString(),
    };
    const result = await this.store.insertCity(city);
    if (result === "duplicate") {
      throw conflict(
        "CITY_SLUG_TAKEN",
        "A city with this slug already exists.",
      );
    }
    return city;
  }

  async setCityStatus(
    id: string,
    status: CityStatus,
  ): Promise<Changed<CityRecord> | null> {
    const current = await this.store.findCityById(id);
    if (current === null) {
      return null;
    }
    if (current.status === status) {
      return { changed: false, value: current };
    }
    const updated = await this.store.updateCityStatus(id, status);
    return updated === null ? null : { changed: true, value: updated };
  }

  listLanguages(activeOnly: boolean): Promise<LanguageRecord[]> {
    return this.store.listLanguages(activeOnly);
  }

  listCategories(activeOnly: boolean): Promise<CategoryRecord[]> {
    return this.store.listCategories(activeOnly);
  }

  async createLanguage(input: {
    code: string;
    name: string;
  }): Promise<LanguageRecord> {
    const language: LanguageRecord = {
      code: input.code,
      name: input.name,
      active: true,
      createdAt: this.now().toISOString(),
    };
    const result = await this.store.insertLanguage(language);
    if (result === "duplicate") {
      throw conflict("LANGUAGE_EXISTS", "This language already exists.");
    }
    return language;
  }

  async createCategory(input: {
    slug: string;
    name: string;
  }): Promise<CategoryRecord> {
    const category: CategoryRecord = {
      slug: input.slug,
      name: input.name,
      active: true,
      createdAt: this.now().toISOString(),
    };
    const result = await this.store.insertCategory(category);
    if (result === "duplicate") {
      throw conflict("CATEGORY_EXISTS", "This category already exists.");
    }
    return category;
  }

  async onboard(userId: string, input: OnboardingInput): Promise<HostRecord> {
    let host = await this.store.findHostByUserId(userId);
    if (host === null) {
      host = {
        id: this.newId(),
        userId,
        publicName: input.publicName,
        bio: optionalBio(input.bio),
        verificationStatus: "NOT_STARTED",
        onboardingStatus: "NOT_STARTED",
        publicProfileStatus: "HIDDEN",
        verificationNote: null,
        createdAt: this.now().toISOString(),
        documents: [],
      };
      await this.store.insertHost(host);
    }

    const bio = input.bio === undefined ? host.bio : optionalBio(input.bio);
    let verificationStatus = host.verificationStatus;
    let onboardingStatus = host.onboardingStatus;
    let publicProfileStatus = host.publicProfileStatus;
    let verificationNote = host.verificationNote;

    if (input.submit && verificationStatus !== "VERIFIED") {
      const hasIdentity = host.documents.some(
        (document) =>
          document.documentType === "IDENTITY" &&
          document.verificationState !== "REJECTED",
      );
      if (!hasIdentity) {
        await this.persistHost(host, {
          publicName: input.publicName,
          bio,
          verificationStatus,
          onboardingStatus:
            onboardingStatus === "NOT_STARTED"
              ? "IN_PROGRESS"
              : onboardingStatus,
          publicProfileStatus,
          verificationNote,
        });
        throw conflict(
          "IDENTITY_DOCUMENT_REQUIRED",
          "An identity document is required before review.",
        );
      }
      verificationStatus = "PENDING";
      onboardingStatus = "SUBMITTED";
      publicProfileStatus = "HIDDEN";
      verificationNote = null;
    } else if (onboardingStatus === "NOT_STARTED") {
      onboardingStatus = "IN_PROGRESS";
    }

    await this.persistHost(host, {
      publicName: input.publicName,
      bio,
      verificationStatus,
      onboardingStatus,
      publicProfileStatus,
      verificationNote,
    });
    return this.requireHostUser(userId);
  }

  async ownHost(userId: string): Promise<HostRecord | null> {
    return this.store.findHostByUserId(userId);
  }

  async addDocument(
    userId: string,
    documentType: DocumentType,
  ): Promise<HostRecord["documents"][number]> {
    const host = await this.store.findHostByUserId(userId);
    if (host === null) {
      throw new HttpError(
        403,
        "HOST_PROFILE_REQUIRED",
        "Create a host profile before continuing.",
      );
    }
    const allocated = this.documents.allocate({
      purpose: "host-document",
      ownerId: host.id,
    });
    const document: HostRecord["documents"][number] = {
      id: this.newId(),
      hostId: host.id,
      documentType,
      storageReference: allocated.storageReference,
      verificationState: "PENDING",
    };
    await this.store.insertDocument(document);
    return document;
  }

  async decideVerification(
    hostId: string,
    decision: VerificationDecision,
    reason: string,
  ): Promise<Changed<HostRecord> | null> {
    const host = await this.store.findHostById(hostId);
    if (host === null) {
      return null;
    }
    const next = nextVerification(host.verificationStatus, decision);
    if (next.kind === "invalid") {
      throw conflict(
        "INVALID_VERIFICATION_TRANSITION",
        "This verification decision is not allowed.",
      );
    }
    if (next.kind === "same") {
      return { changed: false, value: host };
    }
    const documents = host.documents.map((document) => ({
      id: document.id,
      verificationState:
        next.pendingDocuments === "keep" ||
        document.verificationState !== "PENDING"
          ? document.verificationState
          : next.pendingDocuments,
    }));
    await this.store.updateHost({
      id: host.id,
      publicName: host.publicName,
      bio: host.bio,
      verificationStatus: next.verificationStatus,
      onboardingStatus: next.onboardingStatus,
      publicProfileStatus: next.publicProfileStatus,
      verificationNote: reason,
      documents,
    });
    return { changed: true, value: await this.requireHostId(hostId) };
  }

  async reviewDocuments(hostId: string): Promise<ReviewedDocument[] | null> {
    const host = await this.store.findHostById(hostId);
    if (host === null) {
      return null;
    }
    const now = this.now();
    return host.documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      verificationState: document.verificationState,
      access: this.documents.describe(document.storageReference, now),
    }));
  }

  async createExperience(
    userId: string,
    input: ExperienceInput,
  ): Promise<ExperienceView> {
    const host = await this.requireHostProfile(userId);
    await this.requireCity(input.cityId);
    await this.requireActiveCategory(input.category);
    await this.requireActiveLanguages(input.languageCodes);
    const experience: StoredExperience = {
      id: this.newId(),
      hostId: host.id,
      cityId: input.cityId,
      category: input.category,
      title: input.title,
      description: input.description,
      durationMinutes: input.durationMinutes,
      basePriceMinor: input.basePriceMinor,
      currency: input.currency,
      capacity: input.capacity,
      listingStatus: "DRAFT",
      inclusions: input.inclusions,
      exclusions: input.exclusions,
      meetingArea: input.meetingArea,
      accessibilityNotes: input.accessibilityNotes,
      safetyNotes: input.safetyNotes,
      cancellationPolicy: input.cancellationPolicy,
      moderationNote: null,
      languageCodes: [...input.languageCodes],
      images: [],
      slots: [],
      blackouts: [],
      createdAt: this.now().toISOString(),
    };
    await this.store.insertExperience(experience);
    return this.requireExperience(experience.id);
  }

  async updateExperience(
    userId: string,
    experienceId: string,
    patch: ExperiencePatch,
  ): Promise<ExperienceView> {
    const owned = await this.requireOwned(userId, experienceId);
    if (!isEditable(owned.experience.listingStatus)) {
      throw conflict("LISTING_LOCKED", "This listing cannot be edited now.");
    }
    const next = applyPatch(owned.experience, patch);
    await this.requireCity(next.cityId);
    await this.requireActiveCategory(next.category);
    await this.requireActiveLanguages(next.languageCodes);
    const scheduleReset =
      next.durationMinutes !== owned.experience.durationMinutes ||
      next.capacity !== owned.experience.capacity;
    if (scheduleReset && owned.experience.slots.length > 0) {
      await this.assertScheduleUnlocked(experienceId);
    }
    await this.store.updateExperienceContent({
      id: experienceId,
      cityId: next.cityId,
      category: next.category,
      title: next.title,
      description: next.description,
      durationMinutes: next.durationMinutes,
      basePriceMinor: next.basePriceMinor,
      currency: next.currency,
      capacity: next.capacity,
      inclusions: next.inclusions,
      exclusions: next.exclusions,
      meetingArea: next.meetingArea,
      accessibilityNotes: next.accessibilityNotes,
      safetyNotes: next.safetyNotes,
      cancellationPolicy: next.cancellationPolicy,
      languageCodes: next.languageCodes,
    });
    if (scheduleReset && owned.experience.slots.length > 0) {
      await this.store.replaceSchedule(
        experienceId,
        [],
        owned.experience.blackouts,
      );
    }
    return this.requireExperience(experienceId);
  }

  async submitExperience(
    userId: string,
    experienceId: string,
  ): Promise<ExperienceView> {
    const owned = await this.requireOwned(userId, experienceId);
    if (!isEditable(owned.experience.listingStatus)) {
      throw conflict("LISTING_LOCKED", "This listing cannot be submitted now.");
    }
    if (owned.experience.hostVerificationStatus !== "VERIFIED") {
      throw conflict(
        "HOST_NOT_VERIFIED",
        "A verified host profile is required before review.",
      );
    }
    if (owned.experience.cityStatus !== "ACTIVE") {
      throw conflict("CITY_INACTIVE", "This city is not active.");
    }
    await this.requireActiveCategory(owned.experience.category);
    await this.requireActiveLanguages(owned.experience.languageCodes);
    await this.store.updateListing(experienceId, "IN_REVIEW", null);
    return this.requireExperience(experienceId);
  }

  async replaceAvailability(
    userId: string,
    experienceId: string,
    input: ScheduleInput,
  ): Promise<ExperienceView> {
    const owned = await this.requireOwned(userId, experienceId);
    if (owned.experience.listingStatus === "ARCHIVED") {
      throw conflict("LISTING_LOCKED", "This listing cannot be edited now.");
    }
    const details = validateSchedule({
      durationMinutes: owned.experience.durationMinutes,
      listingCapacity: owned.experience.capacity,
      slots: input.slots,
      blackouts: input.blackouts,
    });
    if (details.length > 0) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Request validation failed.",
        details,
      );
    }
    await this.assertScheduleUnlocked(experienceId);
    const slots: SlotRecord[] = input.slots.map((slot) => ({
      id: this.newId(),
      startsAt: new Date(slot.startsAt).toISOString(),
      endsAt: new Date(slot.endsAt).toISOString(),
      capacity: slot.capacity,
      status: "OPEN",
    }));
    const blackouts: BlackoutRecord[] = input.blackouts.map((blackout) => ({
      id: this.newId(),
      startsAt: new Date(blackout.startsAt).toISOString(),
      endsAt: new Date(blackout.endsAt).toISOString(),
    }));
    await this.store.replaceSchedule(experienceId, slots, blackouts);
    return this.requireExperience(experienceId);
  }

  async addImage(
    userId: string,
    experienceId: string,
  ): Promise<ExperienceView> {
    const owned = await this.requireOwned(userId, experienceId);
    if (owned.experience.listingStatus === "ARCHIVED") {
      throw conflict("LISTING_LOCKED", "This listing cannot be edited now.");
    }
    const allocated = this.documents.allocate({
      purpose: "experience-image",
      ownerId: owned.experience.id,
    });
    await this.store.insertImage(experienceId, {
      id: this.newId(),
      storageReference: allocated.storageReference,
      sortOrder: owned.experience.images.length,
      moderationStatus: "PENDING",
    });
    return this.requireExperience(experienceId);
  }

  async ownExperience(
    userId: string,
    experienceId: string,
  ): Promise<ExperienceView> {
    const owned = await this.requireOwned(userId, experienceId);
    return owned.experience;
  }

  async listOwnExperiences(userId: string): Promise<ExperienceView[]> {
    const host = await this.store.findHostByUserId(userId);
    if (host === null) {
      return [];
    }
    const rows = await this.store.listExperiences();
    return rows.filter((row) => row.hostId === host.id);
  }

  async decideListing(
    experienceId: string,
    decision: ListingDecision,
    reason: string,
  ): Promise<Changed<ExperienceView> | null> {
    const experience = await this.store.findExperience(experienceId);
    if (experience === null) {
      return null;
    }
    const next = nextListing(experience.listingStatus, decision);
    if (next.kind === "invalid") {
      throw conflict(
        "INVALID_LISTING_TRANSITION",
        "This moderation decision is not allowed.",
      );
    }
    if (next.kind === "same") {
      return { changed: false, value: experience };
    }
    if (next.listingStatus === "PUBLISHED") {
      await this.assertPublishable(experience);
    }
    await this.store.updateListing(
      experienceId,
      next.listingStatus,
      next.listingStatus === "IN_REVIEW" ? null : reason,
    );
    return { changed: true, value: await this.requireExperience(experienceId) };
  }

  async decideImage(
    experienceId: string,
    imageId: string,
    moderationStatus: ImageModerationStatus,
  ): Promise<Changed<ExperienceView> | null> {
    const experience = await this.store.findExperience(experienceId);
    if (experience === null) {
      return null;
    }
    const image = experience.images.find((row) => row.id === imageId);
    if (image === undefined) {
      return null;
    }
    if (image.moderationStatus === moderationStatus) {
      return { changed: false, value: experience };
    }
    const updated = await this.store.updateImageStatus(
      experienceId,
      imageId,
      moderationStatus,
    );
    if (!updated) {
      return null;
    }
    return { changed: true, value: await this.requireExperience(experienceId) };
  }

  async publicExperience(id: string): Promise<ExperienceView | null> {
    const experience = await this.store.findExperience(id);
    if (experience === null || bookingBlockReason(experience) !== null) {
      return null;
    }
    return experience;
  }

  async publicHost(id: string): Promise<HostRecord | null> {
    const host = await this.store.findHostById(id);
    if (
      host === null ||
      host.verificationStatus !== "VERIFIED" ||
      host.publicProfileStatus !== "VISIBLE"
    ) {
      return null;
    }
    return host;
  }

  async search(filter: DiscoveryFilter): Promise<ExperienceView[]> {
    const rows = await this.store.listExperiences();
    return rows.filter((row) => matchesDiscovery(row, filter, this.now()));
  }

  async publicAvailability(
    id: string,
    range: { from: string; to: string; partySize?: number },
  ): Promise<{ timezone: string; slots: SlotRecord[] } | null> {
    const experience = await this.publicExperience(id);
    if (experience === null) {
      return null;
    }
    return {
      timezone: experience.cityTimezone,
      slots: selectableSlots(experience, {
        from: range.from,
        to: range.to,
        partySize: range.partySize ?? 1,
        now: this.now(),
      }),
    };
  }

  listExperiences(): Promise<ExperienceView[]> {
    return this.store.listExperiences();
  }

  listHosts(): Promise<HostRecord[]> {
    return this.store.listHosts();
  }

  private async persistHost(
    host: HostRecord,
    next: {
      publicName: string;
      bio: string | null;
      verificationStatus: HostRecord["verificationStatus"];
      onboardingStatus: HostRecord["onboardingStatus"];
      publicProfileStatus: HostRecord["publicProfileStatus"];
      verificationNote: string | null;
    },
  ): Promise<void> {
    await this.store.updateHost({
      id: host.id,
      publicName: next.publicName,
      bio: next.bio,
      verificationStatus: next.verificationStatus,
      onboardingStatus: next.onboardingStatus,
      publicProfileStatus: next.publicProfileStatus,
      verificationNote: next.verificationNote,
      documents: host.documents.map((document) => ({
        id: document.id,
        verificationState: document.verificationState,
      })),
    });
  }

  private async requireHostUser(userId: string): Promise<HostRecord> {
    const host = await this.store.findHostByUserId(userId);
    if (host === null) {
      throw new Error("Host profile is missing.");
    }
    return host;
  }

  private async requireHostId(hostId: string): Promise<HostRecord> {
    const host = await this.store.findHostById(hostId);
    if (host === null) {
      throw new Error("Host profile is missing.");
    }
    return host;
  }

  private async requireHostProfile(userId: string): Promise<HostRecord> {
    const host = await this.store.findHostByUserId(userId);
    if (host === null) {
      throw new HttpError(
        403,
        "HOST_PROFILE_REQUIRED",
        "Create a host profile before continuing.",
      );
    }
    return host;
  }

  private async requireOwned(
    userId: string,
    experienceId: string,
  ): Promise<{ host: HostRecord; experience: ExperienceView }> {
    const host = await this.requireHostProfile(userId);
    const experience = await this.store.findExperience(experienceId);
    if (experience === null) {
      throw new HttpError(404, "NOT_FOUND", "Not found.");
    }
    if (experience.hostId !== host.id) {
      throw new ResourceNotOwnedError("experience", experienceId);
    }
    return { host, experience };
  }

  private async requireExperience(id: string): Promise<ExperienceView> {
    const experience = await this.store.findExperience(id);
    if (experience === null) {
      throw new Error("Experience is missing.");
    }
    return experience;
  }

  private async requireCity(id: string): Promise<CityRecord> {
    const city = await this.store.findCityById(id);
    if (city === null) {
      throw invalid("cityId");
    }
    return city;
  }

  private async requireActiveCategory(slug: string): Promise<void> {
    const category = await this.store.findCategory(slug);
    if (category === null || !category.active) {
      throw invalid("category");
    }
  }

  private async requireActiveLanguages(
    codes: readonly string[],
  ): Promise<void> {
    for (const code of codes) {
      const language = await this.store.findLanguage(code);
      if (language === null || !language.active) {
        throw invalid("languageCodes");
      }
    }
  }

  private async assertScheduleUnlocked(experienceId: string): Promise<void> {
    const blocking = await this.store.countBlockingReservations(experienceId);
    if (blocking > 0) {
      throw conflict(
        "AVAILABILITY_LOCKED",
        "Availability cannot change while seats are reserved.",
      );
    }
  }

  private async assertPublishable(experience: ExperienceView): Promise<void> {
    const projected = {
      ...experience,
      listingStatus: "PUBLISHED" as const,
    };
    if (bookingBlockReason(projected) !== null) {
      throw conflict(
        "LISTING_NOT_ELIGIBLE",
        "This listing cannot be published yet.",
      );
    }
    const category = await this.store.findCategory(experience.category);
    if (category === null || !category.active) {
      throw conflict(
        "LISTING_NOT_ELIGIBLE",
        "This listing cannot be published yet.",
      );
    }
    for (const code of experience.languageCodes) {
      const language = await this.store.findLanguage(code);
      if (language === null || !language.active) {
        throw conflict(
          "LISTING_NOT_ELIGIBLE",
          "This listing cannot be published yet.",
        );
      }
    }
  }
}

function optionalBio(bio: string | undefined): string | null {
  if (bio === undefined || bio.trim() === "") {
    return null;
  }
  return bio;
}

function invalid(field: string): HttpError {
  return new HttpError(400, "VALIDATION_ERROR", "Request validation failed.", [
    { field, message: "Invalid value." },
  ]);
}

function conflict(code: string, message: string): HttpError {
  return new HttpError(409, code, message);
}

function isEditable(status: ListingStatus): boolean {
  return status === "DRAFT" || status === "REJECTED";
}

function applyPatch(
  experience: ExperienceView,
  patch: ExperiencePatch,
): ExperienceInput {
  return {
    cityId: patch.cityId ?? experience.cityId,
    category: patch.category ?? experience.category,
    title: patch.title ?? experience.title,
    description: patch.description ?? experience.description,
    durationMinutes: patch.durationMinutes ?? experience.durationMinutes,
    basePriceMinor: patch.basePriceMinor ?? experience.basePriceMinor,
    currency: patch.currency ?? experience.currency,
    capacity: patch.capacity ?? experience.capacity,
    inclusions: patch.inclusions ?? experience.inclusions,
    exclusions: patch.exclusions ?? experience.exclusions,
    meetingArea: patch.meetingArea ?? experience.meetingArea,
    accessibilityNotes:
      patch.accessibilityNotes ?? experience.accessibilityNotes,
    safetyNotes: patch.safetyNotes ?? experience.safetyNotes,
    cancellationPolicy:
      patch.cancellationPolicy ?? experience.cancellationPolicy,
    languageCodes: patch.languageCodes ?? experience.languageCodes,
  };
}

function nextVerification(
  current: HostVerificationStatus,
  decision: VerificationDecision,
):
  | { kind: "same" }
  | { kind: "invalid" }
  | {
      kind: "change";
      verificationStatus: HostVerificationStatus;
      onboardingStatus: HostRecord["onboardingStatus"];
      publicProfileStatus: HostRecord["publicProfileStatus"];
      pendingDocuments: "VERIFIED" | "REJECTED" | "keep";
    } {
  if (decision === "APPROVE" && current === "VERIFIED") {
    return { kind: "same" };
  }
  if (decision === "APPROVE" && current === "PENDING") {
    return {
      kind: "change",
      verificationStatus: "VERIFIED",
      onboardingStatus: "COMPLETE",
      publicProfileStatus: "VISIBLE",
      pendingDocuments: "VERIFIED",
    };
  }
  if (decision === "REJECT" && current === "REJECTED") {
    return { kind: "same" };
  }
  if (
    decision === "REJECT" &&
    (current === "PENDING" ||
      current === "VERIFIED" ||
      current === "NEEDS_INFORMATION")
  ) {
    return {
      kind: "change",
      verificationStatus: "REJECTED",
      onboardingStatus: "IN_PROGRESS",
      publicProfileStatus: "HIDDEN",
      pendingDocuments: "REJECTED",
    };
  }
  if (decision === "NEEDS_INFORMATION" && current === "NEEDS_INFORMATION") {
    return { kind: "same" };
  }
  if (decision === "NEEDS_INFORMATION" && current === "PENDING") {
    return {
      kind: "change",
      verificationStatus: "NEEDS_INFORMATION",
      onboardingStatus: "IN_PROGRESS",
      publicProfileStatus: "HIDDEN",
      pendingDocuments: "keep",
    };
  }
  return { kind: "invalid" };
}

function nextListing(
  current: ListingStatus,
  decision: ListingDecision,
):
  | { kind: "same" }
  | { kind: "invalid" }
  | { kind: "change"; listingStatus: ListingStatus } {
  if (decision === "PUBLISH" && current === "PUBLISHED") {
    return { kind: "same" };
  }
  if (decision === "PUBLISH" && current === "IN_REVIEW") {
    return { kind: "change", listingStatus: "PUBLISHED" };
  }
  if (decision === "REJECT" && current === "REJECTED") {
    return { kind: "same" };
  }
  if (decision === "REJECT" && current === "IN_REVIEW") {
    return { kind: "change", listingStatus: "REJECTED" };
  }
  if (decision === "UNPUBLISH" && current === "UNPUBLISHED") {
    return { kind: "same" };
  }
  if (decision === "UNPUBLISH" && current === "PUBLISHED") {
    return { kind: "change", listingStatus: "UNPUBLISHED" };
  }
  if (decision === "ARCHIVE" && current === "ARCHIVED") {
    return { kind: "same" };
  }
  if (decision === "ARCHIVE") {
    return { kind: "change", listingStatus: "ARCHIVED" };
  }
  return { kind: "invalid" };
}

import type {
  BlackoutRecord,
  CategoryRecord,
  CityRecord,
  CityStatus,
  ExperienceView,
  HostDocumentRecord,
  HostOnboardingStatus,
  HostRecord,
  HostVerificationStatus,
  ImageRecord,
  LanguageRecord,
  ListingStatus,
  PublicProfileStatus,
  SlotRecord,
  StoredExperience,
} from "./types.js";

export type HostProfileUpdate = {
  id: string;
  publicName: string;
  bio: string | null;
  verificationStatus: HostVerificationStatus;
  onboardingStatus: HostOnboardingStatus;
  publicProfileStatus: PublicProfileStatus;
  verificationNote: string | null;
  documents: readonly Pick<HostDocumentRecord, "id" | "verificationState">[];
};

export type ExperienceContentUpdate = {
  id: string;
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

export type CatalogueStore = {
  listCities(status: CityStatus | "ANY"): Promise<CityRecord[]>;
  findCityById(id: string): Promise<CityRecord | null>;
  findCityBySlug(slug: string): Promise<CityRecord | null>;
  insertCity(city: CityRecord): Promise<"created" | "duplicate">;
  updateCityStatus(id: string, status: CityStatus): Promise<CityRecord | null>;

  listLanguages(activeOnly: boolean): Promise<LanguageRecord[]>;
  listCategories(activeOnly: boolean): Promise<CategoryRecord[]>;
  findLanguage(code: string): Promise<LanguageRecord | null>;
  findCategory(slug: string): Promise<CategoryRecord | null>;
  insertLanguage(language: LanguageRecord): Promise<"created" | "duplicate">;
  insertCategory(category: CategoryRecord): Promise<"created" | "duplicate">;

  findHostByUserId(userId: string): Promise<HostRecord | null>;
  findHostById(id: string): Promise<HostRecord | null>;
  listHosts(): Promise<HostRecord[]>;
  insertHost(host: HostRecord): Promise<void>;
  updateHost(update: HostProfileUpdate): Promise<void>;
  insertDocument(document: HostDocumentRecord): Promise<void>;

  insertExperience(experience: StoredExperience): Promise<void>;
  updateExperienceContent(update: ExperienceContentUpdate): Promise<void>;
  updateListing(
    id: string,
    listingStatus: ListingStatus,
    moderationNote: string | null,
  ): Promise<void>;
  replaceSchedule(
    id: string,
    slots: readonly SlotRecord[],
    blackouts: readonly BlackoutRecord[],
  ): Promise<void>;
  insertImage(experienceId: string, image: ImageRecord): Promise<void>;
  updateImageStatus(
    experienceId: string,
    imageId: string,
    moderationStatus: ImageRecord["moderationStatus"],
  ): Promise<boolean>;
  findExperience(id: string): Promise<ExperienceView | null>;
  listExperiences(): Promise<ExperienceView[]>;
  countBlockingReservations(experienceId: string): Promise<number>;
};

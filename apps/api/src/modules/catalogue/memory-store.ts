import type {
  CatalogueStore,
  ExperienceContentUpdate,
  HostProfileUpdate,
} from "./store.js";
import type {
  BlackoutRecord,
  CategoryRecord,
  CityRecord,
  CityStatus,
  ExperienceView,
  HostDocumentRecord,
  HostRecord,
  ImageRecord,
  LanguageRecord,
  ListingStatus,
  SlotRecord,
  StoredExperience,
} from "./types.js";

export type CatalogueSeed = {
  cities?: readonly CityRecord[];
  languages?: readonly LanguageRecord[];
  categories?: readonly CategoryRecord[];
  hosts?: readonly HostRecord[];
  experiences?: readonly StoredExperience[];
};

export class MemoryCatalogueStore implements CatalogueStore {
  private readonly cities: CityRecord[] = [];
  private readonly languages: LanguageRecord[] = [];
  private readonly categories: CategoryRecord[] = [];
  private readonly hosts: HostRecord[] = [];
  private readonly experiences: StoredExperience[] = [];

  constructor(seed: CatalogueSeed = {}) {
    for (const city of seed.cities ?? []) {
      this.cities.push(clone(city));
    }
    for (const language of seed.languages ?? []) {
      this.languages.push(clone(language));
    }
    for (const category of seed.categories ?? []) {
      this.categories.push(clone(category));
    }
    for (const host of seed.hosts ?? []) {
      this.hosts.push(clone(host));
    }
    for (const experience of seed.experiences ?? []) {
      this.experiences.push(clone(experience));
    }
  }

  listCities(status: CityStatus | "ANY"): Promise<CityRecord[]> {
    const rows = this.cities.filter(
      (city) => status === "ANY" || city.status === status,
    );
    return Promise.resolve(clone(rows));
  }

  findCityById(id: string): Promise<CityRecord | null> {
    return Promise.resolve(
      clone(this.cities.find((city) => city.id === id) ?? null),
    );
  }

  findCityBySlug(slug: string): Promise<CityRecord | null> {
    return Promise.resolve(
      clone(this.cities.find((city) => city.slug === slug) ?? null),
    );
  }

  insertCity(city: CityRecord): Promise<"created" | "duplicate"> {
    if (
      this.cities.some((row) => row.slug === city.slug || row.id === city.id)
    ) {
      return Promise.resolve("duplicate");
    }
    this.cities.push(clone(city));
    return Promise.resolve("created");
  }

  updateCityStatus(id: string, status: CityStatus): Promise<CityRecord | null> {
    const city = this.cities.find((row) => row.id === id);
    if (city === undefined) {
      return Promise.resolve(null);
    }
    city.status = status;
    return Promise.resolve(clone(city));
  }

  listLanguages(activeOnly: boolean): Promise<LanguageRecord[]> {
    const rows = this.languages.filter((row) => !activeOnly || row.active);
    return Promise.resolve(clone(rows));
  }

  listCategories(activeOnly: boolean): Promise<CategoryRecord[]> {
    const rows = this.categories.filter((row) => !activeOnly || row.active);
    return Promise.resolve(clone(rows));
  }

  findLanguage(code: string): Promise<LanguageRecord | null> {
    return Promise.resolve(
      clone(this.languages.find((row) => row.code === code) ?? null),
    );
  }

  findCategory(slug: string): Promise<CategoryRecord | null> {
    return Promise.resolve(
      clone(this.categories.find((row) => row.slug === slug) ?? null),
    );
  }

  insertLanguage(language: LanguageRecord): Promise<"created" | "duplicate"> {
    if (this.languages.some((row) => row.code === language.code)) {
      return Promise.resolve("duplicate");
    }
    this.languages.push(clone(language));
    return Promise.resolve("created");
  }

  insertCategory(category: CategoryRecord): Promise<"created" | "duplicate"> {
    if (this.categories.some((row) => row.slug === category.slug)) {
      return Promise.resolve("duplicate");
    }
    this.categories.push(clone(category));
    return Promise.resolve("created");
  }

  findHostByUserId(userId: string): Promise<HostRecord | null> {
    return Promise.resolve(
      clone(this.hosts.find((host) => host.userId === userId) ?? null),
    );
  }

  findHostById(id: string): Promise<HostRecord | null> {
    return Promise.resolve(
      clone(this.hosts.find((host) => host.id === id) ?? null),
    );
  }

  listHosts(): Promise<HostRecord[]> {
    return Promise.resolve(clone(this.hosts));
  }

  insertHost(host: HostRecord): Promise<void> {
    this.hosts.push(clone(host));
    return Promise.resolve();
  }

  updateHost(update: HostProfileUpdate): Promise<void> {
    const host = this.hosts.find((row) => row.id === update.id);
    if (host === undefined) {
      return Promise.reject(new Error("Host profile is missing."));
    }
    host.publicName = update.publicName;
    host.bio = update.bio;
    host.verificationStatus = update.verificationStatus;
    host.onboardingStatus = update.onboardingStatus;
    host.publicProfileStatus = update.publicProfileStatus;
    host.verificationNote = update.verificationNote;
    for (const document of update.documents) {
      const stored = host.documents.find((row) => row.id === document.id);
      if (stored !== undefined) {
        stored.verificationState = document.verificationState;
      }
    }
    return Promise.resolve();
  }

  insertDocument(document: HostDocumentRecord): Promise<void> {
    const host = this.hosts.find((row) => row.id === document.hostId);
    if (host === undefined) {
      return Promise.reject(new Error("Host profile is missing."));
    }
    host.documents.push(clone(document));
    return Promise.resolve();
  }

  insertExperience(experience: StoredExperience): Promise<void> {
    this.experiences.push(clone(experience));
    return Promise.resolve();
  }

  updateExperienceContent(update: ExperienceContentUpdate): Promise<void> {
    const experience = this.experiences.find((row) => row.id === update.id);
    if (experience === undefined) {
      return Promise.reject(new Error("Experience is missing."));
    }
    experience.cityId = update.cityId;
    experience.category = update.category;
    experience.title = update.title;
    experience.description = update.description;
    experience.durationMinutes = update.durationMinutes;
    experience.basePriceMinor = update.basePriceMinor;
    experience.currency = update.currency;
    experience.capacity = update.capacity;
    experience.inclusions = update.inclusions;
    experience.exclusions = update.exclusions;
    experience.meetingArea = update.meetingArea;
    experience.accessibilityNotes = update.accessibilityNotes;
    experience.safetyNotes = update.safetyNotes;
    experience.cancellationPolicy = update.cancellationPolicy;
    experience.languageCodes = [...update.languageCodes];
    return Promise.resolve();
  }

  updateListing(
    id: string,
    listingStatus: ListingStatus,
    moderationNote: string | null,
  ): Promise<void> {
    const experience = this.experiences.find((row) => row.id === id);
    if (experience === undefined) {
      return Promise.reject(new Error("Experience is missing."));
    }
    experience.listingStatus = listingStatus;
    experience.moderationNote = moderationNote;
    return Promise.resolve();
  }

  replaceSchedule(
    id: string,
    slots: readonly SlotRecord[],
    blackouts: readonly BlackoutRecord[],
  ): Promise<void> {
    const experience = this.experiences.find((row) => row.id === id);
    if (experience === undefined) {
      return Promise.reject(new Error("Experience is missing."));
    }
    experience.slots = slots.map((slot) => clone(slot));
    experience.blackouts = blackouts.map((row) => clone(row));
    return Promise.resolve();
  }

  insertImage(experienceId: string, image: ImageRecord): Promise<void> {
    const experience = this.experiences.find((row) => row.id === experienceId);
    if (experience === undefined) {
      return Promise.reject(new Error("Experience is missing."));
    }
    experience.images.push(clone(image));
    return Promise.resolve();
  }

  updateImageStatus(
    experienceId: string,
    imageId: string,
    moderationStatus: ImageRecord["moderationStatus"],
  ): Promise<boolean> {
    const experience = this.experiences.find((row) => row.id === experienceId);
    const image = experience?.images.find((row) => row.id === imageId);
    if (image === undefined) {
      return Promise.resolve(false);
    }
    image.moderationStatus = moderationStatus;
    return Promise.resolve(true);
  }

  findExperience(id: string): Promise<ExperienceView | null> {
    const experience = this.experiences.find((row) => row.id === id);
    if (experience === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.toView(experience));
  }

  listExperiences(): Promise<ExperienceView[]> {
    return Promise.resolve(
      this.experiences.flatMap((experience) => {
        const view = this.toView(experience);
        return view === null ? [] : [view];
      }),
    );
  }

  countBlockingReservations(): Promise<number> {
    return Promise.resolve(0);
  }

  private toView(experience: StoredExperience): ExperienceView | null {
    const host = this.hosts.find((row) => row.id === experience.hostId);
    const city = this.cities.find((row) => row.id === experience.cityId);
    if (host === undefined || city === undefined) {
      return null;
    }
    return {
      ...clone(experience),
      hostUserId: host.userId,
      hostPublicName: host.publicName,
      hostBio: host.bio,
      hostVerificationStatus: host.verificationStatus,
      hostPublicProfileStatus: host.publicProfileStatus,
      citySlug: city.slug,
      cityName: city.name,
      cityState: city.state,
      cityCountryCode: city.countryCode,
      cityTimezone: city.timezone,
      cityStatus: city.status,
    };
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

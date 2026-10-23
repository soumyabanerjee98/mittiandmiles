import type { ExperienceView, HostRecord, SlotRecord } from "./types.js";

export function presentCity(city: {
  id: string;
  slug: string;
  name: string;
  state: string;
  countryCode: string;
  timezone: string;
  status: string;
}) {
  return {
    id: city.id,
    slug: city.slug,
    name: city.name,
    state: city.state,
    countryCode: city.countryCode,
    timezone: city.timezone,
    status: city.status,
  };
}

export function presentLanguage(language: { code: string; name: string }) {
  return { code: language.code, name: language.name };
}

export function presentCategory(category: { slug: string; name: string }) {
  return { slug: category.slug, name: category.name };
}

export function presentOwnHost(host: HostRecord) {
  return {
    id: host.id,
    publicName: host.publicName,
    bio: host.bio,
    verificationStatus: host.verificationStatus,
    onboardingStatus: host.onboardingStatus,
    publicProfileStatus: host.publicProfileStatus,
  };
}

export function presentVerification(host: HostRecord) {
  return {
    verificationStatus: host.verificationStatus,
    onboardingStatus: host.onboardingStatus,
    publicProfileStatus: host.publicProfileStatus,
    note: host.verificationNote,
    documents: host.documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      verificationState: document.verificationState,
    })),
  };
}

export function presentPublicHost(host: HostRecord) {
  return {
    id: host.id,
    publicName: host.publicName,
    bio: host.bio,
    verificationStatus: host.verificationStatus,
  };
}

export function presentHostQueueItem(host: HostRecord) {
  return {
    id: host.id,
    publicName: host.publicName,
    verificationStatus: host.verificationStatus,
    onboardingStatus: host.onboardingStatus,
    publicProfileStatus: host.publicProfileStatus,
    note: host.verificationNote,
    documents: host.documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      verificationState: document.verificationState,
    })),
  };
}

export function presentExperienceCard(experience: ExperienceView) {
  return {
    id: experience.id,
    title: experience.title,
    category: experience.category,
    durationMinutes: experience.durationMinutes,
    basePriceMinor: experience.basePriceMinor,
    currency: experience.currency,
    capacity: experience.capacity,
    languageCodes: experience.languageCodes,
    city: {
      id: experience.cityId,
      slug: experience.citySlug,
      name: experience.cityName,
    },
    host: {
      id: experience.hostId,
      publicName: experience.hostPublicName,
      verificationStatus: experience.hostVerificationStatus,
    },
  };
}

export function presentPublicExperience(experience: ExperienceView) {
  return {
    ...presentExperienceCard(experience),
    description: experience.description,
    inclusions: experience.inclusions,
    exclusions: experience.exclusions,
    meetingArea: experience.meetingArea,
    accessibilityNotes: experience.accessibilityNotes,
    safetyNotes: experience.safetyNotes,
    cancellationPolicy: experience.cancellationPolicy,
    city: {
      id: experience.cityId,
      slug: experience.citySlug,
      name: experience.cityName,
      state: experience.cityState,
      countryCode: experience.cityCountryCode,
      timezone: experience.cityTimezone,
    },
    images: experience.images
      .filter((image) => image.moderationStatus === "APPROVED")
      .map((image) => ({ id: image.id, sortOrder: image.sortOrder })),
  };
}

export function presentOwnExperience(experience: ExperienceView) {
  return {
    ...presentPublicExperience(experience),
    listingStatus: experience.listingStatus,
    moderationNote: experience.moderationNote,
    images: experience.images.map((image) => ({
      id: image.id,
      sortOrder: image.sortOrder,
      moderationStatus: image.moderationStatus,
    })),
    slots: experience.slots.map(presentSlot),
    blackouts: experience.blackouts.map((blackout) => ({
      id: blackout.id,
      startsAt: blackout.startsAt,
      endsAt: blackout.endsAt,
    })),
  };
}

export function presentSlot(slot: SlotRecord) {
  return {
    id: slot.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    capacity: slot.capacity,
    remaining: slot.capacity - (slot.heldQuantity ?? 0),
    status: slot.status,
  };
}

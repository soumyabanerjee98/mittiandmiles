export const HostVerificationStatus = {
  NOT_STARTED: "NOT_STARTED",
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
  NEEDS_INFORMATION: "NEEDS_INFORMATION",
} as const;

export type HostVerificationStatus =
  (typeof HostVerificationStatus)[keyof typeof HostVerificationStatus];

export const HostOnboardingStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  COMPLETE: "COMPLETE",
} as const;

export type HostOnboardingStatus =
  (typeof HostOnboardingStatus)[keyof typeof HostOnboardingStatus];

export const PublicProfileStatus = {
  HIDDEN: "HIDDEN",
  VISIBLE: "VISIBLE",
} as const;

export type PublicProfileStatus =
  (typeof PublicProfileStatus)[keyof typeof PublicProfileStatus];

export const DocumentType = {
  IDENTITY: "IDENTITY",
  ADDRESS: "ADDRESS",
  CREDENTIAL: "CREDENTIAL",
  OTHER: "OTHER",
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentVerificationState = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;

export type DocumentVerificationState =
  (typeof DocumentVerificationState)[keyof typeof DocumentVerificationState];

export const CityStatus = {
  INACTIVE: "INACTIVE",
  ACTIVE: "ACTIVE",
} as const;

export type CityStatus = (typeof CityStatus)[keyof typeof CityStatus];

export const ListingStatus = {
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED",
  UNPUBLISHED: "UNPUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export const ImageModerationStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type ImageModerationStatus =
  (typeof ImageModerationStatus)[keyof typeof ImageModerationStatus];

export const SlotStatus = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
} as const;

export type SlotStatus = (typeof SlotStatus)[keyof typeof SlotStatus];

export type CityRecord = {
  id: string;
  slug: string;
  name: string;
  state: string;
  countryCode: string;
  timezone: string;
  status: CityStatus;
  createdAt: string;
};

export type LanguageRecord = {
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
};

export type CategoryRecord = {
  slug: string;
  name: string;
  active: boolean;
  createdAt: string;
};

export type HostDocumentRecord = {
  id: string;
  hostId: string;
  documentType: DocumentType;
  storageReference: string;
  verificationState: DocumentVerificationState;
};

export type HostRecord = {
  id: string;
  userId: string;
  publicName: string;
  bio: string | null;
  verificationStatus: HostVerificationStatus;
  onboardingStatus: HostOnboardingStatus;
  publicProfileStatus: PublicProfileStatus;
  verificationNote: string | null;
  createdAt: string;
  documents: HostDocumentRecord[];
};

export type ImageRecord = {
  id: string;
  storageReference: string;
  sortOrder: number;
  moderationStatus: ImageModerationStatus;
};

export type SlotRecord = {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  /** Seats held or confirmed and not yet expired. Omitted when none. */
  heldQuantity?: number;
  status: SlotStatus;
};

export type BlackoutRecord = {
  id: string;
  startsAt: string;
  endsAt: string;
};

export type StoredExperience = {
  id: string;
  hostId: string;
  cityId: string;
  category: string;
  title: string;
  description: string;
  durationMinutes: number;
  basePriceMinor: number;
  currency: string;
  capacity: number;
  listingStatus: ListingStatus;
  inclusions: string;
  exclusions: string;
  meetingArea: string;
  accessibilityNotes: string;
  safetyNotes: string;
  cancellationPolicy: string;
  moderationNote: string | null;
  languageCodes: string[];
  images: ImageRecord[];
  slots: SlotRecord[];
  blackouts: BlackoutRecord[];
  createdAt: string;
};

export type ExperienceView = StoredExperience & {
  hostUserId: string;
  hostPublicName: string;
  hostBio: string | null;
  hostVerificationStatus: HostVerificationStatus;
  hostPublicProfileStatus: PublicProfileStatus;
  citySlug: string;
  cityName: string;
  cityState: string;
  cityCountryCode: string;
  cityTimezone: string;
  cityStatus: CityStatus;
};

export function expectMember<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  for (const candidate of allowed) {
    if (candidate === value) {
      return candidate;
    }
  }
  throw new Error(`Stored ${label} is not supported.`);
}

import { randomUUID } from "node:crypto";

export type StoragePurpose = "host-document" | "experience-image";

export type PrivateAccess = {
  scheme: "unconfigured";
  expiresAt: string;
};

/**
 * Object storage is not selected. This seam allocates a private reference and
 * describes short-lived access without returning bytes, a download URL, or a
 * provider credential.
 */
export type PrivateDocumentStorage = {
  allocate(input: { purpose: StoragePurpose; ownerId: string }): {
    storageReference: string;
  };
  describe(storageReference: string, now: Date): PrivateAccess;
};

const ACCESS_TTL_MS = 5 * 60 * 1000;

export class UnconfiguredPrivateStorage implements PrivateDocumentStorage {
  allocate(input: { purpose: StoragePurpose; ownerId: string }): {
    storageReference: string;
  } {
    return {
      storageReference: `private://${input.purpose}/${input.ownerId}/${randomUUID()}`,
    };
  }

  describe(_storageReference: string, now: Date): PrivateAccess {
    return {
      scheme: "unconfigured",
      expiresAt: new Date(now.getTime() + ACCESS_TTL_MS).toISOString(),
    };
  }
}

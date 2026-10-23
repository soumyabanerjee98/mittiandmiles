import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingBlockReason,
  isExperienceBookable,
} from "../src/modules/catalogue/discovery.js";
import { localDate } from "../src/modules/catalogue/time.js";

test("only a published listing from a visible verified host in an active city is bookable", () => {
  const ready = {
    listingStatus: "PUBLISHED" as const,
    hostVerificationStatus: "VERIFIED" as const,
    hostPublicProfileStatus: "VISIBLE" as const,
    cityStatus: "ACTIVE" as const,
  };
  assert.equal(isExperienceBookable(ready), true);
  assert.equal(bookingBlockReason(ready), null);

  for (const blocked of [
    { ...ready, listingStatus: "DRAFT" as const },
    { ...ready, listingStatus: "IN_REVIEW" as const },
    { ...ready, listingStatus: "REJECTED" as const },
    { ...ready, listingStatus: "UNPUBLISHED" as const },
    { ...ready, listingStatus: "ARCHIVED" as const },
    { ...ready, hostVerificationStatus: "PENDING" as const },
    { ...ready, hostPublicProfileStatus: "HIDDEN" as const },
    { ...ready, cityStatus: "INACTIVE" as const },
  ]) {
    assert.equal(isExperienceBookable(blocked), false);
    assert.equal(bookingBlockReason(blocked), "BOOKING_NOT_AVAILABLE");
  }
});

test("slot dates use the city time zone", () => {
  assert.equal(
    localDate(new Date("2030-01-14T20:30:00.000Z"), "Asia/Kolkata"),
    "2030-01-15",
  );
});

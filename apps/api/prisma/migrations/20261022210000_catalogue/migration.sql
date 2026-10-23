-- Phase 3 catalogue. Cities, languages, and categories stay data, not code.
-- Identity document bytes are still not stored. New columns hold notes and
-- the listing cancellation policy only.

ALTER TYPE "HostVerificationStatus" ADD VALUE 'NEEDS_INFORMATION';

CREATE TABLE "languages" (
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "languages_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "categories" (
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("slug")
);

ALTER TABLE "host_profiles"
  ADD COLUMN "verification_note" VARCHAR(160);

ALTER TABLE "experiences"
  ADD COLUMN "cancellation_policy" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "moderation_note" VARCHAR(160);

ALTER TABLE "experiences"
  ADD CONSTRAINT "experiences_category_fkey"
  FOREIGN KEY ("category") REFERENCES "categories"("slug")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "experience_languages"
  ADD CONSTRAINT "experience_languages_language_code_fkey"
  FOREIGN KEY ("language_code") REFERENCES "languages"("code")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "experience_blackouts" (
    "id" UUID NOT NULL,
    "experience_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experience_blackouts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "experience_blackouts_window" CHECK ("ends_at" > "starts_at")
);

CREATE INDEX "experience_blackouts_experience_id_starts_at_idx"
  ON "experience_blackouts"("experience_id", "starts_at");

ALTER TABLE "experience_blackouts"
  ADD CONSTRAINT "experience_blackouts_experience_id_fkey"
  FOREIGN KEY ("experience_id") REFERENCES "experiences"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

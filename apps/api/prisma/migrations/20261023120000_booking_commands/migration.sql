-- Phase 4. Idempotent trip-request and booking commands.
-- Payment success is not stored by this migration.
-- Prisma cannot express the partial unique index below. Keep it in SQL.

CREATE TABLE "command_idempotency" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "scope" VARCHAR(64) NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "resource_type" VARCHAR(64) NOT NULL,
    "resource_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "command_idempotency_actor_user_id_scope_idempotency_key_key"
  ON "command_idempotency"("actor_user_id", "scope", "idempotency_key");

CREATE INDEX "command_idempotency_resource_type_resource_id_idx"
  ON "command_idempotency"("resource_type", "resource_id");

ALTER TABLE "command_idempotency"
  ADD CONSTRAINT "command_idempotency_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "offers_one_pending_per_host"
  ON "offers" ("request_id", "host_id")
  WHERE "status" = 'PENDING';

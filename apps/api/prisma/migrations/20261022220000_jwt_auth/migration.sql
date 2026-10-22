-- AlterTable
ALTER TABLE "users" ADD COLUMN "password_hash" VARCHAR(255);

-- CreateTable
CREATE TABLE "auth_refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_refresh_sessions_token_hash_key" ON "auth_refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_refresh_sessions_user_id_idx" ON "auth_refresh_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_refresh_sessions_expires_at_idx" ON "auth_refresh_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "auth_refresh_sessions" ADD CONSTRAINT "auth_refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

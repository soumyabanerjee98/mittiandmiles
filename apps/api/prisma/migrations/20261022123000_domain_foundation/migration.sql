-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TRAVELLER', 'HOST', 'OPERATIONS', 'SUPPORT', 'VERIFICATION', 'FINANCE', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "HostVerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "HostOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "PublicProfileStatus" AS ENUM ('HIDDEN', 'VISIBLE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('IDENTITY', 'ADDRESS', 'CREDENTIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVerificationState" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CityStatus" AS ENUM ('INACTIVE', 'ACTIVE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImageModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReservationState" AS ENUM ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TripRequestStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'WITHDRAWN', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETION_PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AttendanceState" AS ENUM ('EXPECTED', 'CHECKED_IN', 'ABSENT');

-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('HOST_CODE', 'PARTICIPANT_CODE', 'MANUAL');

-- CreateEnum
CREATE TYPE "CheckInPolicyResult" AS ENUM ('ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'REJECTED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerAccountStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('BOOKING_CHARGE', 'REFUND', 'PAYOUT', 'COMMISSION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING_ELIGIBILITY', 'ELIGIBLE', 'SUBMITTED', 'SETTLED', 'FAILED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('PERCENTAGE_BPS');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageModerationStatus" AS ENUM ('PENDING', 'VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'WAITING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('ALLOWED', 'DENIED');

-- CreateEnum
CREATE TYPE "OutboxState" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "phone" VARCHAR(32),
    "auth_provider" VARCHAR(64) NOT NULL,
    "auth_subject" VARCHAR(128) NOT NULL,
    "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" VARCHAR(35) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traveller_profiles" (
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "country_code" VARCHAR(2),
    "language_preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "traveller_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "host_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "public_name" VARCHAR(120) NOT NULL,
    "bio" TEXT,
    "verification_status" "HostVerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "onboarding_status" "HostOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "payout_provider_reference" VARCHAR(128),
    "public_profile_status" "PublicProfileStatus" NOT NULL DEFAULT 'HIDDEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "host_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_documents" (
    "id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "storage_reference" VARCHAR(512) NOT NULL,
    "verification_state" "DocumentVerificationState" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "retain_until" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "host_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "scope" VARCHAR(64) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "state" VARCHAR(120) NOT NULL,
    "country_code" VARCHAR(2) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "status" "CityStatus" NOT NULL DEFAULT 'INACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiences" (
    "id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "base_price_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "listing_status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "inclusions" TEXT NOT NULL,
    "exclusions" TEXT NOT NULL,
    "meeting_area" VARCHAR(240) NOT NULL,
    "accessibility_notes" TEXT NOT NULL DEFAULT '',
    "safety_notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_languages" (
    "experience_id" UUID NOT NULL,
    "language_code" VARCHAR(16) NOT NULL,

    CONSTRAINT "experience_languages_pkey" PRIMARY KEY ("experience_id","language_code")
);

-- CreateTable
CREATE TABLE "experience_images" (
    "id" UUID NOT NULL,
    "experience_id" UUID NOT NULL,
    "storage_reference" VARCHAR(512) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "moderation_status" "ImageModerationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experience_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_slots" (
    "id" UUID NOT NULL,
    "experience_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "experience_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_reservations" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "state" "ReservationState" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "slot_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_requests" (
    "id" UUID NOT NULL,
    "traveller_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "party_size" INTEGER NOT NULL,
    "budget_minor" INTEGER,
    "currency" VARCHAR(3) NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "status" "TripRequestStatus" NOT NULL DEFAULT 'OPEN',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trip_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "proposed_starts_at" TIMESTAMPTZ(3) NOT NULL,
    "proposed_ends_at" TIMESTAMPTZ(3) NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "inclusions" TEXT NOT NULL,
    "exclusions" TEXT NOT NULL,
    "policy_snapshot" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "traveller_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "experience_id" UUID,
    "offer_id" UUID,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "participant_count" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "subtotal_minor" INTEGER NOT NULL,
    "discount_minor" INTEGER NOT NULL DEFAULT 0,
    "tax_minor" INTEGER NOT NULL DEFAULT 0,
    "total_minor" INTEGER NOT NULL,
    "commission_policy_id" UUID,
    "commission_minor" INTEGER NOT NULL,
    "host_gross_minor" INTEGER NOT NULL,
    "cancellation_policy_snapshot" JSONB NOT NULL,
    "experience_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_participants" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "display_label" VARCHAR(120) NOT NULL DEFAULT '',
    "attendance" "AttendanceState" NOT NULL DEFAULT 'EXPECTED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_events" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "event_type" VARCHAR(64) NOT NULL,
    "actor_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "method" "CheckInMethod" NOT NULL,
    "verified_at" TIMESTAMPTZ(3) NOT NULL,
    "policy_result" "CheckInPolicyResult" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "provider_order_ref" VARCHAR(128),
    "provider_payment_ref" VARCHAR(128),
    "amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "idempotency_key" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "provider_event_id" VARCHAR(128) NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "processing_status" "WebhookProcessingStatus" NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "provider_refund_ref" VARCHAR(128),
    "amount_minor" INTEGER NOT NULL,
    "reason_code" VARCHAR(64) NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "account_type" "LedgerAccountType" NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "LedgerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" UUID NOT NULL,
    "transaction_type" "LedgerTransactionType" NOT NULL,
    "booking_id" UUID,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit_minor" INTEGER NOT NULL DEFAULT 0,
    "credit_minor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "provider_payout_ref" VARCHAR(128),
    "amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING_ELIGIBILITY',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMPTZ(3),

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_allocations" (
    "id" UUID NOT NULL,
    "payout_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_policies" (
    "id" UUID NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "basis" "CommissionBasis" NOT NULL,
    "rate_bps" INTEGER NOT NULL,
    "eligibility" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "request_id" UUID,
    "booking_id" UUID,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "moderation_status" "MessageModerationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "reviewee_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reported_user_id" UUID,
    "booking_id" UUID,
    "category" VARCHAR(64) NOT NULL,
    "evidence_reference" VARCHAR(512),
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" VARCHAR(240),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "booking_id" UUID,
    "category" VARCHAR(64) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "resource_type" VARCHAR(80) NOT NULL,
    "resource_id" VARCHAR(128) NOT NULL,
    "request_id" VARCHAR(128) NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "reason" VARCHAR(160),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "aggregate_id" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "state" "OutboxState" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_account_status_idx" ON "users"("account_status");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_provider_auth_subject_key" ON "users"("auth_provider", "auth_subject");

-- CreateIndex
CREATE UNIQUE INDEX "host_profiles_user_id_key" ON "host_profiles"("user_id");

-- CreateIndex
CREATE INDEX "host_profiles_verification_status_idx" ON "host_profiles"("verification_status");

-- CreateIndex
CREATE INDEX "host_documents_host_id_idx" ON "host_documents"("host_id");

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_scope_key" ON "user_roles"("user_id", "role", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE INDEX "cities_status_idx" ON "cities"("status");

-- CreateIndex
CREATE INDEX "experiences_host_id_idx" ON "experiences"("host_id");

-- CreateIndex
CREATE INDEX "experiences_city_id_listing_status_idx" ON "experiences"("city_id", "listing_status");

-- CreateIndex
CREATE INDEX "experience_images_experience_id_sort_order_idx" ON "experience_images"("experience_id", "sort_order");

-- CreateIndex
CREATE INDEX "experience_slots_experience_id_starts_at_idx" ON "experience_slots"("experience_id", "starts_at");

-- CreateIndex
CREATE INDEX "slot_reservations_slot_id_state_idx" ON "slot_reservations"("slot_id", "state");

-- CreateIndex
CREATE INDEX "slot_reservations_booking_id_idx" ON "slot_reservations"("booking_id");

-- CreateIndex
CREATE INDEX "trip_requests_traveller_id_status_idx" ON "trip_requests"("traveller_id", "status");

-- CreateIndex
CREATE INDEX "trip_requests_city_id_status_idx" ON "trip_requests"("city_id", "status");

-- CreateIndex
CREATE INDEX "offers_request_id_status_idx" ON "offers"("request_id", "status");

-- CreateIndex
CREATE INDEX "offers_host_id_status_idx" ON "offers"("host_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_offer_id_key" ON "bookings"("offer_id");

-- CreateIndex
CREATE INDEX "bookings_traveller_id_status_idx" ON "bookings"("traveller_id", "status");

-- CreateIndex
CREATE INDEX "bookings_host_id_status_idx" ON "bookings"("host_id", "status");

-- CreateIndex
CREATE INDEX "bookings_experience_id_idx" ON "bookings"("experience_id");

-- CreateIndex
CREATE INDEX "booking_participants_booking_id_idx" ON "booking_participants"("booking_id");

-- CreateIndex
CREATE INDEX "booking_events_booking_id_created_at_idx" ON "booking_events"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "check_ins_booking_id_idx" ON "check_ins"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_idempotency_key_key" ON "payment_attempts"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_attempts_booking_id_status_idx" ON "payment_attempts"("booking_id", "status");

-- CreateIndex
CREATE INDEX "webhook_events_processing_status_idx" ON "webhook_events"("processing_status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_provider_event_id_key" ON "webhook_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "refunds_booking_id_status_idx" ON "refunds"("booking_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_idempotency_key_key" ON "ledger_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_transactions_booking_id_idx" ON "ledger_transactions"("booking_id");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_idx" ON "ledger_entries"("account_id");

-- CreateIndex
CREATE INDEX "payouts_host_id_status_idx" ON "payouts"("host_id", "status");

-- CreateIndex
CREATE INDEX "payout_allocations_booking_id_idx" ON "payout_allocations"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_allocations_payout_id_booking_id_key" ON "payout_allocations"("payout_id", "booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_policies_version_key" ON "commission_policies"("version");

-- CreateIndex
CREATE INDEX "conversations_request_id_idx" ON "conversations"("request_id");

-- CreateIndex
CREATE INDEX "conversations_booking_id_idx" ON "conversations"("booking_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_reviewee_id_status_idx" ON "reviews"("reviewee_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_reviewer_id_reviewee_id_key" ON "reviews"("booking_id", "reviewer_id", "reviewee_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_reported_user_id_idx" ON "reports"("reported_user_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_requester_id_idx" ON "support_tickets"("requester_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "outbox_events_state_created_at_idx" ON "outbox_events"("state", "created_at");

-- AddForeignKey
ALTER TABLE "traveller_profiles" ADD CONSTRAINT "traveller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_profiles" ADD CONSTRAINT "host_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_documents" ADD CONSTRAINT "host_documents_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "host_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_documents" ADD CONSTRAINT "host_documents_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "host_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_languages" ADD CONSTRAINT "experience_languages_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experiences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_images" ADD CONSTRAINT "experience_images_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experiences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_slots" ADD CONSTRAINT "experience_slots_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experiences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "experience_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_traveller_id_fkey" FOREIGN KEY ("traveller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "trip_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "host_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_traveller_id_fkey" FOREIGN KEY ("traveller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "host_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experiences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_commission_policy_id_fkey" FOREIGN KEY ("commission_policy_id") REFERENCES "commission_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "host_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_allocations" ADD CONSTRAINT "payout_allocations_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_allocations" ADD CONSTRAINT "payout_allocations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "trip_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints Prisma cannot express.
-- Integrity rules only. This migration does not capture or confirm payments.

CREATE FUNCTION reject_row_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION reject_row_mutation();

CREATE TRIGGER booking_events_append_only
  BEFORE UPDATE OR DELETE ON booking_events
  FOR EACH ROW EXECUTE FUNCTION reject_row_mutation();

CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION reject_row_mutation();

CREATE TRIGGER ledger_transactions_append_only
  BEFORE UPDATE OR DELETE ON ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION reject_row_mutation();

CREATE TRIGGER commission_policies_append_only
  BEFORE UPDATE OR DELETE ON commission_policies
  FOR EACH ROW EXECUTE FUNCTION reject_row_mutation();

ALTER TABLE cities
  ADD CONSTRAINT cities_country_code CHECK (country_code ~ '^[A-Z]{2}$');

ALTER TABLE experiences
  ADD CONSTRAINT experiences_price_non_negative CHECK (base_price_minor >= 0),
  ADD CONSTRAINT experiences_capacity_positive CHECK (capacity > 0),
  ADD CONSTRAINT experiences_duration_positive CHECK (duration_minutes > 0),
  ADD CONSTRAINT experiences_currency_iso CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE experience_slots
  ADD CONSTRAINT experience_slots_time_order CHECK (starts_at < ends_at),
  ADD CONSTRAINT experience_slots_capacity_positive CHECK (capacity > 0);

ALTER TABLE slot_reservations
  ADD CONSTRAINT slot_reservations_quantity_positive CHECK (quantity > 0),
  ADD CONSTRAINT slot_reservations_hold_has_expiry CHECK (state <> 'HELD' OR expires_at IS NOT NULL);

ALTER TABLE trip_requests
  ADD CONSTRAINT trip_requests_date_order CHECK (starts_on <= ends_on),
  ADD CONSTRAINT trip_requests_party_positive CHECK (party_size > 0),
  ADD CONSTRAINT trip_requests_budget_non_negative CHECK (budget_minor IS NULL OR budget_minor >= 0),
  ADD CONSTRAINT trip_requests_currency_iso CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE offers
  ADD CONSTRAINT offers_time_order CHECK (proposed_starts_at < proposed_ends_at),
  ADD CONSTRAINT offers_price_non_negative CHECK (price_minor >= 0),
  ADD CONSTRAINT offers_currency_iso CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE bookings
  ADD CONSTRAINT bookings_time_order CHECK (starts_at < ends_at),
  ADD CONSTRAINT bookings_participants_positive CHECK (participant_count > 0),
  ADD CONSTRAINT bookings_amounts_non_negative CHECK (
    subtotal_minor >= 0
    AND discount_minor >= 0
    AND tax_minor >= 0
    AND total_minor >= 0
    AND commission_minor >= 0
    AND host_gross_minor >= 0
  ),
  ADD CONSTRAINT bookings_currency_iso CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT bookings_has_experience_or_offer CHECK (
    experience_id IS NOT NULL OR offer_id IS NOT NULL
  );

ALTER TABLE payment_attempts
  ADD CONSTRAINT payment_attempts_amount_non_negative CHECK (amount_minor >= 0),
  ADD CONSTRAINT payment_attempts_currency_iso CHECK (currency ~ '^[A-Z]{3}$');

CREATE UNIQUE INDEX payment_attempts_provider_payment_ref_key
  ON payment_attempts (provider, provider_payment_ref)
  WHERE provider_payment_ref IS NOT NULL;

CREATE UNIQUE INDEX payment_attempts_provider_order_ref_key
  ON payment_attempts (provider, provider_order_ref)
  WHERE provider_order_ref IS NOT NULL;

ALTER TABLE refunds
  ADD CONSTRAINT refunds_amount_positive CHECK (amount_minor > 0);

CREATE UNIQUE INDEX refunds_provider_refund_ref_key
  ON refunds (provider, provider_refund_ref)
  WHERE provider_refund_ref IS NOT NULL;

ALTER TABLE ledger_accounts
  ADD CONSTRAINT ledger_accounts_currency_iso CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE ledger_transactions
  ADD CONSTRAINT ledger_transactions_currency_iso CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_one_sided CHECK (
    debit_minor >= 0
    AND credit_minor >= 0
    AND NOT (debit_minor > 0 AND credit_minor > 0)
    AND (debit_minor > 0 OR credit_minor > 0)
  );

ALTER TABLE payouts
  ADD CONSTRAINT payouts_amount_non_negative CHECK (amount_minor >= 0),
  ADD CONSTRAINT payouts_currency_iso CHECK (currency ~ '^[A-Z]{3}$');

CREATE UNIQUE INDEX payouts_provider_payout_ref_key
  ON payouts (provider, provider_payout_ref)
  WHERE provider_payout_ref IS NOT NULL;

ALTER TABLE payout_allocations
  ADD CONSTRAINT payout_allocations_amount_positive CHECK (amount_minor > 0);

ALTER TABLE commission_policies
  ADD CONSTRAINT commission_policies_rate_bps_range CHECK (
    basis <> 'PERCENTAGE_BPS' OR (rate_bps >= 0 AND rate_bps <= 10000)
  ),
  ADD CONSTRAINT commission_policies_effective_range CHECK (
    effective_to IS NULL OR effective_to > effective_from
  );

ALTER TABLE conversations
  ADD CONSTRAINT conversations_has_parent CHECK (
    request_id IS NOT NULL OR booking_id IS NOT NULL
  );

ALTER TABLE reviews
  ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE reports
  ADD CONSTRAINT reports_has_target CHECK (
    reported_user_id IS NOT NULL OR booking_id IS NOT NULL
  );

CREATE FUNCTION prevent_host_self_booking() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM host_profiles
    WHERE id = NEW.host_id
      AND user_id = NEW.traveller_id
  ) THEN
    RAISE EXCEPTION 'host cannot accept own booking'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_no_self_booking
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION prevent_host_self_booking();

CREATE FUNCTION enforce_slot_capacity() RETURNS trigger AS $$
DECLARE
  slot_capacity integer;
  reserved integer;
BEGIN
  IF NEW.state NOT IN ('HELD', 'CONFIRMED') THEN
    RETURN NEW;
  END IF;

  SELECT capacity
    INTO slot_capacity
  FROM experience_slots
  WHERE id = NEW.slot_id
  FOR UPDATE;

  SELECT COALESCE(SUM(quantity), 0)
    INTO reserved
  FROM slot_reservations
  WHERE slot_id = NEW.slot_id
    AND state IN ('HELD', 'CONFIRMED')
    AND id <> NEW.id
    AND (expires_at IS NULL OR expires_at > now());

  IF reserved + NEW.quantity > slot_capacity THEN
    RAISE EXCEPTION 'slot capacity exceeded'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER slot_reservations_capacity
  BEFORE INSERT OR UPDATE ON slot_reservations
  FOR EACH ROW EXECUTE FUNCTION enforce_slot_capacity();

CREATE FUNCTION assert_ledger_transaction_balanced() RETURNS trigger AS $$
DECLARE
  txn uuid;
  txn_currency varchar(3);
  debits bigint;
  credits bigint;
BEGIN
  txn := COALESCE(NEW.transaction_id, OLD.transaction_id);

  SELECT currency
    INTO txn_currency
  FROM ledger_transactions
  WHERE id = txn;

  SELECT COALESCE(SUM(debit_minor), 0), COALESCE(SUM(credit_minor), 0)
    INTO debits, credits
  FROM ledger_entries
  WHERE transaction_id = txn;

  IF debits <> credits THEN
    RAISE EXCEPTION 'ledger transaction is not balanced'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM ledger_entries AS entry
    JOIN ledger_accounts AS account ON account.id = entry.account_id
    WHERE entry.transaction_id = txn
      AND account.currency <> txn_currency
  ) THEN
    RAISE EXCEPTION 'ledger entry currency does not match transaction'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entries_balanced
  AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_ledger_transaction_balanced();

CREATE FUNCTION assert_refund_within_captured() RETURNS trigger AS $$
DECLARE
  captured bigint;
  refunded bigint;
BEGIN
  SELECT COALESCE(SUM(amount_minor), 0)
    INTO captured
  FROM payment_attempts
  WHERE booking_id = NEW.booking_id
    AND status = 'SUCCEEDED';

  SELECT COALESCE(SUM(amount_minor), 0)
    INTO refunded
  FROM refunds
  WHERE booking_id = NEW.booking_id
    AND status <> 'FAILED';

  IF refunded > captured THEN
    RAISE EXCEPTION 'refund total exceeds captured amount'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER refunds_within_captured
  AFTER INSERT OR UPDATE ON refunds
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_refund_within_captured();

CREATE FUNCTION assert_payout_allocation_limits() RETURNS trigger AS $$
DECLARE
  payout_amount bigint;
  allocated bigint;
  host_payable bigint;
  booking_allocated bigint;
BEGIN
  SELECT amount_minor
    INTO payout_amount
  FROM payouts
  WHERE id = NEW.payout_id;

  SELECT COALESCE(SUM(amount_minor), 0)
    INTO allocated
  FROM payout_allocations
  WHERE payout_id = NEW.payout_id;

  IF allocated > payout_amount THEN
    RAISE EXCEPTION 'payout allocation exceeds payout amount'
      USING ERRCODE = '23514';
  END IF;

  SELECT host_gross_minor
    INTO host_payable
  FROM bookings
  WHERE id = NEW.booking_id;

  SELECT COALESCE(SUM(amount_minor), 0)
    INTO booking_allocated
  FROM payout_allocations
  WHERE booking_id = NEW.booking_id;

  IF booking_allocated > host_payable THEN
    RAISE EXCEPTION 'payout allocation exceeds host payable'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER payout_allocations_within_limits
  AFTER INSERT OR UPDATE ON payout_allocations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_payout_allocation_limits();


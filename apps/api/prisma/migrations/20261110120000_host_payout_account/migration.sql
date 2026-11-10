-- Masked host bank details saved after verification.
-- The full account number is not stored. payout_provider_reference
-- remains the Razorpay fund account id used for payout submission.

ALTER TABLE "host_profiles"
  ADD COLUMN "payout_account_holder_name" VARCHAR(120),
  ADD COLUMN "payout_ifsc" VARCHAR(11),
  ADD COLUMN "payout_account_last4" VARCHAR(4);

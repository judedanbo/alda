-- Adds an SMS verification gate that the applicant must clear before
-- creating a declaration. International numbers are now accepted at
-- registration (handled in app code); the gate lives in the
-- declaration endpoint so Legal-Unit approval no longer implies a
-- reachable phone.
--
-- Already-VERIFIED applicants with a phone on file are grandfathered
-- as phone-verified: they could create declarations under the old
-- rules, so we don't break their flow.

ALTER TABLE "users"
    ADD COLUMN "phone_verified"    BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN "phone_verified_at" TIMESTAMP(3);

CREATE TABLE "phone_verification_tokens" (
    "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"    UUID         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "code"       VARCHAR(6)   NOT NULL,
    "attempts"   INTEGER      NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at"    TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "phone_verification_tokens_user_id_idx"
    ON "phone_verification_tokens" ("user_id");

CREATE INDEX "phone_verification_tokens_user_id_used_at_idx"
    ON "phone_verification_tokens" ("user_id", "used_at");

-- Grandfather: any user whose applicant profile is already VERIFIED
-- and who has a phone on file is treated as phone-verified.
UPDATE "users"
SET    "phone_verified"    = TRUE,
       "phone_verified_at" = NOW()
FROM   "applicant_profiles"
WHERE  "applicant_profiles"."user_id" = "users"."id"
  AND  "applicant_profiles"."verification_status" = 'VERIFIED'
  AND  "users"."phone" IS NOT NULL;

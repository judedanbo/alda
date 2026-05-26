-- Field-level encryption-at-rest for national-ID columns (C-5).
--
-- This migration adds the four new columns alongside the existing plaintext
-- columns and drops the old unique constraints so the backfill script can
-- populate hashes without collision risk. The plaintext columns are dropped
-- in the next migration (20260526010000_pii_encryption_drop_plaintext)
-- AFTER `npm run db:backfill:pii` has populated the cipher + hash columns
-- from existing rows.
--
-- Deploy sequence on a system with existing data:
--   1. Run THIS migration.
--   2. Run `npm run db:backfill:pii`.
--   3. Run the drop-plaintext migration.
--
-- For a fresh dev DB, `prisma migrate reset` applies both migrations
-- back-to-back. The seed runs afterward and writes directly to the
-- cipher + hash columns, so no backfill is needed.

ALTER TABLE "applicant_profiles"
    ADD COLUMN "ghana_card_number_cipher" TEXT,
    ADD COLUMN "ghana_card_number_hash" VARCHAR(64),
    ADD COLUMN "alternate_id_number_cipher" TEXT,
    ADD COLUMN "alternate_id_number_hash" VARCHAR(64);

-- Drop the plaintext unique constraints. Hash-based constraints are added
-- in the second migration after backfill.
ALTER TABLE "applicant_profiles"
    DROP CONSTRAINT IF EXISTS "applicant_profiles_ghana_card_number_key",
    DROP CONSTRAINT IF EXISTS "applicant_profiles_alt_id_key";

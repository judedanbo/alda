-- Second half of the PII-encryption migration (C-5). Drops the plaintext
-- columns and rebuilds the unique constraints on the new hash columns.
--
-- IMPORTANT: this must NOT run on a system with existing data until
-- `npm run db:backfill:pii` has copied each plaintext value into the
-- cipher + hash columns. On a fresh DB it's safe to run back-to-back
-- with the previous migration because there's no data to lose.
--
-- `prisma migrate reset` (dev) runs both migrations then seeds. The
-- seed writes directly to the cipher + hash columns via the encryption
-- helpers, so it doesn't depend on the plaintext columns surviving.

ALTER TABLE "applicant_profiles"
    DROP COLUMN "ghana_card_number",
    DROP COLUMN "alternate_id_number";

-- New unique constraints on the hash columns:
-- - `ghana_card_number_hash` is globally unique (matches the old shape).
-- - `alternate_id_number_hash` is unique per id_type (composite).
CREATE UNIQUE INDEX "applicant_profiles_ghana_card_number_hash_key"
    ON "applicant_profiles" ("ghana_card_number_hash");

CREATE UNIQUE INDEX "applicant_profiles_alt_id_hash_key"
    ON "applicant_profiles" ("id_type", "alternate_id_number_hash");

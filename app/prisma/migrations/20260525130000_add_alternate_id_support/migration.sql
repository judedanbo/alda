-- Allow applicants who legitimately can't supply a Ghana Card
-- (pending NIA registration, foreign nationals, lost-card holders
-- awaiting reissue) to register with an alternate government ID +
-- justification. Existing rows default to GHANA_CARD and are
-- unaffected. The CHECK constraint enforces "either a Ghana Card or
-- a full alternate-ID set" at the row level.

CREATE TYPE "id_document_type" AS ENUM (
    'GHANA_CARD',
    'PASSPORT',
    'VOTER_ID',
    'DRIVERS_LICENSE',
    'NIA_RECEIPT'
);

CREATE TYPE "alternate_id_reason" AS ENUM (
    'PENDING_NIA_REGISTRATION',
    'FOREIGN_NATIONAL',
    'LOST_AWAITING_REISSUE',
    'DAMAGED_AWAITING_REISSUE',
    'OTHER'
);

ALTER TABLE "applicant_profiles"
    ADD COLUMN "id_type" "id_document_type" NOT NULL DEFAULT 'GHANA_CARD',
    ADD COLUMN "alternate_id_number" VARCHAR(64),
    ADD COLUMN "alternate_id_scan_url" TEXT,
    ADD COLUMN "alternate_id_reason" "alternate_id_reason",
    ADD COLUMN "alternate_id_details" TEXT;

ALTER TABLE "applicant_profiles"
    ALTER COLUMN "ghana_card_number" DROP NOT NULL,
    ALTER COLUMN "ghana_card_front_url" DROP NOT NULL;

CREATE UNIQUE INDEX "applicant_profiles_alt_id_key"
    ON "applicant_profiles" ("id_type", "alternate_id_number");

CREATE INDEX "applicant_profiles_id_type_idx"
    ON "applicant_profiles" ("id_type");

ALTER TABLE "applicant_profiles" ADD CONSTRAINT "applicant_profiles_id_path_chk" CHECK (
    (id_type = 'GHANA_CARD'
        AND ghana_card_number IS NOT NULL
        AND ghana_card_front_url IS NOT NULL
        AND alternate_id_number IS NULL)
    OR
    (id_type <> 'GHANA_CARD'
        AND alternate_id_number IS NOT NULL
        AND alternate_id_scan_url IS NOT NULL
        AND alternate_id_reason IS NOT NULL
        AND ghana_card_number IS NULL)
);

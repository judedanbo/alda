-- Track the review sub-state of a declaration independently of its high-level
-- workflow status (which stays UNDER_REVIEW throughout the issue-resolution cycle).
CREATE TYPE "declaration_review_status" AS ENUM ('NEW', 'ISSUES_IDENTIFIED', 'ISSUES_RESOLVED');

ALTER TABLE "declarations" ADD COLUMN "review_status" "declaration_review_status" NOT NULL DEFAULT 'NEW';

-- Backfill in-flight reviews so the new sub-status reflects existing section issues.
-- UNDER_REVIEW declarations with at least one unresolved section issue → ISSUES_IDENTIFIED.
UPDATE "declarations" d
SET "review_status" = 'ISSUES_IDENTIFIED'
WHERE d."status" = 'UNDER_REVIEW'
  AND EXISTS (
    SELECT 1 FROM "declaration_section_reviews" r
    WHERE r."declaration_id" = d."id"
      AND r."is_acceptable" = false
      AND r."resolved_at" IS NULL
  );

-- UNDER_REVIEW declarations that have section reviews but no unresolved issues → ISSUES_RESOLVED.
UPDATE "declarations" d
SET "review_status" = 'ISSUES_RESOLVED'
WHERE d."status" = 'UNDER_REVIEW'
  AND EXISTS (
    SELECT 1 FROM "declaration_section_reviews" r
    WHERE r."declaration_id" = d."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "declaration_section_reviews" r
    WHERE r."declaration_id" = d."id"
      AND r."is_acceptable" = false
      AND r."resolved_at" IS NULL
  );

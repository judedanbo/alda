-- Query-optimization index pass. Three kinds of change:
--
--  1. New foreign-key indexes. Postgres does NOT auto-index FKs, so these
--     joins were sequential scans that degrade as the tables grow.
--  2. Composite (filter + sort) indexes. A query that filters on column A and
--     ORDER BYs column B is served by one index scan on (A, B) with no sort
--     step; a single-column index on A forces a sort of the matched rows. The
--     composite also serves bare-A equality via its leftmost prefix, so it
--     fully replaces the single-column index it drops.
--  3. Dropping redundant duplicate indexes. A column marked UNIQUE already has
--     a btree index (*_key); a second non-unique index on the same column is
--     never preferred by the planner and only adds write/storage overhead.
--
-- This migration is IDEMPOTENT (CREATE INDEX IF NOT EXISTS / DROP INDEX IF
-- EXISTS) so it composes with an out-of-band build on a live database:
--
-- NOTE FOR PROD/STAGING (tables with existing data): plain CREATE INDEX takes a
-- SHARE lock that blocks writes for the build duration. To avoid that, build the
-- indexes first with `CREATE INDEX CONCURRENTLY` (cannot run in a transaction,
-- so it can't live in this Prisma migration) via the dedicated job in
-- `k8s/jobs/staging-optimization-indexes-concurrently.yaml`. Because this
-- migration is idempotent, the subsequent `prisma migrate deploy` then no-ops
-- (every CREATE/DROP is already satisfied) and records the migration as applied
-- with no further locking — no `migrate resolve` needed.
-- On a fresh/small DB, applying this migration directly is fine.

-- 1. New foreign-key indexes -------------------------------------------------
-- CreateIndex
CREATE INDEX IF NOT EXISTS "applicant_offices_profile_id_idx" ON "applicant_offices"("profile_id");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "applicant_offices_institution_id_idx" ON "applicant_offices"("institution_id");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "applicant_offices_office_category_id_idx" ON "applicant_offices"("office_category_id");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "reviews_declaration_id_idx" ON "reviews"("declaration_id");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "reviews_reviewed_by_idx" ON "reviews"("reviewed_by");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "receipts_declaration_id_idx" ON "receipts"("declaration_id");

-- 2. Composite filter+sort indexes (replace single-column equivalents) -------
-- DropIndex (redundant with the unique constraint declarations_unique_code_key)
DROP INDEX IF EXISTS "declarations_unique_code_idx";
-- DropIndex (replaced by the (status, created_at) composite below)
DROP INDEX IF EXISTS "declarations_status_idx";
-- DropIndex (replaced by the (verification_status, created_at) composite below)
DROP INDEX IF EXISTS "applicant_profiles_verification_status_idx";
-- CreateIndex (applicant's own declaration list: filter applicant_id, sort created_at)
CREATE INDEX IF NOT EXISTS "declarations_applicant_id_created_at_idx" ON "declarations"("applicant_id", "created_at");
-- CreateIndex (officer/admin list filtered by status, sorted created_at; also serves status-only count/groupBy)
CREATE INDEX IF NOT EXISTS "declarations_status_created_at_idx" ON "declarations"("status", "created_at");
-- CreateIndex (admin list with no status filter, sorted created_at)
CREATE INDEX IF NOT EXISTS "declarations_created_at_idx" ON "declarations"("created_at");
-- CreateIndex (legal verification queue: filter verification_status, sort created_at)
CREATE INDEX IF NOT EXISTS "applicant_profiles_verification_status_created_at_idx" ON "applicant_profiles"("verification_status", "created_at");

-- 3. Drop redundant duplicate indexes on UNIQUE columns ----------------------
-- DropIndex (redundant with refresh_tokens_token_key)
DROP INDEX IF EXISTS "refresh_tokens_token_idx";
-- DropIndex (redundant with password_reset_tokens_token_key)
DROP INDEX IF EXISTS "password_reset_tokens_token_idx";
-- DropIndex (redundant with email_verification_tokens_token_key)
DROP INDEX IF EXISTS "email_verification_tokens_token_idx";

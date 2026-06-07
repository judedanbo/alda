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
-- NOTE FOR PROD (tables with existing data): plain CREATE INDEX takes a SHARE
-- lock that blocks writes for the build duration. On large tables, pre-create
-- each new index out-of-band with `CREATE INDEX CONCURRENTLY` (cannot run in a
-- transaction, so it can't live in this Prisma migration), DROP the redundant
-- ones with `DROP INDEX CONCURRENTLY`, then mark this migration applied with
-- `prisma migrate resolve --applied 20260607000000_query_optimization_indexes`.
-- On a fresh/small DB, applying it directly is fine.

-- 1. New foreign-key indexes -------------------------------------------------
-- CreateIndex
CREATE INDEX "applicant_offices_profile_id_idx" ON "applicant_offices"("profile_id");
-- CreateIndex
CREATE INDEX "applicant_offices_institution_id_idx" ON "applicant_offices"("institution_id");
-- CreateIndex
CREATE INDEX "applicant_offices_office_category_id_idx" ON "applicant_offices"("office_category_id");
-- CreateIndex
CREATE INDEX "reviews_declaration_id_idx" ON "reviews"("declaration_id");
-- CreateIndex
CREATE INDEX "reviews_reviewed_by_idx" ON "reviews"("reviewed_by");
-- CreateIndex
CREATE INDEX "receipts_declaration_id_idx" ON "receipts"("declaration_id");

-- 2. Composite filter+sort indexes (replace single-column equivalents) -------
-- DropIndex (redundant with the unique constraint declarations_unique_code_key)
DROP INDEX "declarations_unique_code_idx";
-- DropIndex (replaced by the (status, created_at) composite below)
DROP INDEX "declarations_status_idx";
-- DropIndex (replaced by the (verification_status, created_at) composite below)
DROP INDEX "applicant_profiles_verification_status_idx";
-- CreateIndex (applicant's own declaration list: filter applicant_id, sort created_at)
CREATE INDEX "declarations_applicant_id_created_at_idx" ON "declarations"("applicant_id", "created_at");
-- CreateIndex (officer/admin list filtered by status, sorted created_at; also serves status-only count/groupBy)
CREATE INDEX "declarations_status_created_at_idx" ON "declarations"("status", "created_at");
-- CreateIndex (admin list with no status filter, sorted created_at)
CREATE INDEX "declarations_created_at_idx" ON "declarations"("created_at");
-- CreateIndex (legal verification queue: filter verification_status, sort created_at)
CREATE INDEX "applicant_profiles_verification_status_created_at_idx" ON "applicant_profiles"("verification_status", "created_at");

-- 3. Drop redundant duplicate indexes on UNIQUE columns ----------------------
-- DropIndex (redundant with refresh_tokens_token_key)
DROP INDEX "refresh_tokens_token_idx";
-- DropIndex (redundant with password_reset_tokens_token_key)
DROP INDEX "password_reset_tokens_token_idx";
-- DropIndex (redundant with email_verification_tokens_token_key)
DROP INDEX "email_verification_tokens_token_idx";

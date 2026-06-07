/**
 * Guards the query-optimization migration against reversion: asserts the new
 * indexes exist in the live schema and the redundant duplicates were dropped.
 * Runs against TEST_DATABASE_URL (migrations applied).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "~/server/utils/prisma";

const EXPECTED_PRESENT = [
  "declarations_applicant_id_created_at_idx",
  "declarations_status_created_at_idx",
  "declarations_created_at_idx",
  "applicant_profiles_verification_status_created_at_idx",
  "receipts_declaration_id_idx",
  "reviews_declaration_id_idx",
  "reviews_reviewed_by_idx",
  "applicant_offices_profile_id_idx",
  "applicant_offices_institution_id_idx",
  "applicant_offices_office_category_id_idx",
];

const EXPECTED_ABSENT = [
  "refresh_tokens_token_idx",
  "password_reset_tokens_token_idx",
  "email_verification_tokens_token_idx",
  "declarations_unique_code_idx",
  "declarations_status_idx",
  "applicant_profiles_verification_status_idx",
];

describe("query-optimization migration", () => {
  let indexNames!: Set<string>;

  beforeAll(async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    `;
    indexNames = new Set(rows.map((r) => r.indexname));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each(EXPECTED_PRESENT)("has the new index %s", (idx) => {
    expect(indexNames.has(idx), `expected index ${idx} to exist`).toBe(true);
  });

  it.each(EXPECTED_ABSENT)("dropped the redundant index %s", (idx) => {
    expect(indexNames.has(idx), `expected index ${idx} to be gone`).toBe(false);
  });
});

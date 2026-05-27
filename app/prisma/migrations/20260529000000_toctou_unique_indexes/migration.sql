-- TOCTOU race-safe constraints (M-1 + M-2 from docs/security-assessment.md).
--
-- The pre-insert "no second active declaration" check in
-- server/api/declarations/index.post.ts and the "no second PENDING
-- reissue" check in declarations/[id]/reissue-request.post.ts are both
-- non-transactional read-modify-write pairs. Two concurrent POSTs can
-- pass the SELECT and both insert.
--
-- Partial unique indexes catch the race at the DB. The handlers will
-- still do the friendly pre-check (so the common case returns a 409 with
-- a useful message instead of a constraint-violation 500); a P2002 on
-- the create is converted to the same 409 in the catch block.
--
-- Partial unique indexes aren't first-class in Prisma's schema syntax;
-- the indexes are managed entirely through raw SQL migrations. Future
-- `prisma migrate dev` runs may flag drift — the warning is expected
-- and shouldn't be resolved by dropping the indexes.

CREATE UNIQUE INDEX "declarations_applicant_active_unique"
    ON "declarations" ("applicant_id")
    WHERE "status" IN ('CODE_GENERATED', 'FORM_COLLECTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED');

CREATE UNIQUE INDEX "form_reissue_requests_declaration_pending_unique"
    ON "form_reissue_requests" ("declaration_id")
    WHERE "status" = 'PENDING';

-- Many-to-many: schedule officers (and admins, though admins bypass) are
-- scoped to specific CollectionOffices for write actions. See H-3 in
-- docs/security-assessment.md and the `assertOfficerCanActOn*` helpers in
-- server/utils/officer-scope.ts.
--
-- Adding the junction table is non-destructive: existing officer rows just
-- have zero assignments until they're populated, at which point those
-- officers can no longer perform office-scoped actions (the helper throws
-- 403 on a missing assignment). The dev seed is updated in the same PR
-- to wire seeded officers up.

CREATE TABLE "user_collection_offices" (
    "user_id"              UUID         NOT NULL,
    "collection_office_id" UUID         NOT NULL,
    "assigned_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_collection_offices_pkey" PRIMARY KEY ("user_id", "collection_office_id"),
    CONSTRAINT "user_collection_offices_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_collection_offices_collection_office_id_fkey"
        FOREIGN KEY ("collection_office_id") REFERENCES "collection_offices"("id") ON DELETE CASCADE
);

CREATE INDEX "user_collection_offices_collection_office_id_idx"
    ON "user_collection_offices" ("collection_office_id");

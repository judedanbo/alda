-- Refresh-token family + replay detection (H-7).
--
-- Each row in `refresh_tokens` gains a `family_id` (set on issue, inherited
-- across rotations) and a `consumed_at` (set when the token is rotated out
-- in `refresh.post.ts`, without deleting the row). When a token whose row
-- already has `consumed_at` set is presented again, the entire family is
-- wiped and the user must re-authenticate — surfacing the compromise that
-- would otherwise be silent.
--
-- Both columns are nullable so the migration is backwards compatible with
-- in-flight tokens issued before the rollout. Those tokens get a fresh
-- familyId on their first post-migration refresh.

ALTER TABLE "refresh_tokens"
    ADD COLUMN "family_id"   UUID,
    ADD COLUMN "consumed_at" TIMESTAMP(3);

CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" ("family_id");

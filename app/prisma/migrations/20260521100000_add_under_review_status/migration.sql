-- Add UNDER_REVIEW back to declaration_status enum
ALTER TABLE "declarations" ALTER COLUMN "status" DROP DEFAULT;
CREATE TYPE "declaration_status_new" AS ENUM ('CODE_GENERATED', 'FORM_COLLECTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SEALED');
ALTER TABLE "declarations" ALTER COLUMN "status" TYPE "declaration_status_new" USING ("status"::text::"declaration_status_new");
ALTER TABLE "declaration_status_history" ALTER COLUMN "status" TYPE "declaration_status_new" USING ("status"::text::"declaration_status_new");
DROP TYPE "declaration_status";
ALTER TYPE "declaration_status_new" RENAME TO "declaration_status";
ALTER TABLE "declarations" ALTER COLUMN "status" SET DEFAULT 'CODE_GENERATED'::"declaration_status";

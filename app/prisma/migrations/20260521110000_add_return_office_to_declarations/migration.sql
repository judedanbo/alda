-- Add return_office_id to declarations
ALTER TABLE "declarations" ADD COLUMN "return_office_id" UUID;

ALTER TABLE "declarations" ADD CONSTRAINT "declarations_return_office_id_fkey" FOREIGN KEY ("return_office_id") REFERENCES "collection_offices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

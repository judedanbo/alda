/**
 * One-shot backfill: copies plaintext national-ID values from the legacy
 * columns into their encrypted + hashed counterparts.
 *
 * Run BETWEEN the `20260526000000_pii_encryption_add_columns` migration
 * and the `20260526010000_pii_encryption_drop_plaintext` migration on a
 * system with existing data:
 *
 *   npm run db:migrate          # applies up to add_columns
 *   npm run db:backfill:pii     # this script
 *   npm run db:migrate          # applies drop_plaintext
 *
 * On a fresh dev DB (`prisma migrate reset`) this script is a no-op
 * because the seed writes encrypted values directly.
 *
 * Idempotent: rows that already have a cipher are skipped.
 */

import { PrismaClient } from "@prisma/client";
import { encryptPii, hashPii } from "../server/utils/pii-encryption";

const prisma = new PrismaClient();

interface LegacyRow {
  id: string;
  ghana_card_number: string | null;
  alternate_id_number: string | null;
  ghana_card_number_cipher: string | null;
  alternate_id_number_cipher: string | null;
}

async function main() {
  console.log("PII encryption backfill — starting...");

  const rows = await prisma.$queryRaw<LegacyRow[]>`
    SELECT
      id,
      ghana_card_number,
      alternate_id_number,
      ghana_card_number_cipher,
      alternate_id_number_cipher
    FROM applicant_profiles
    WHERE
      (ghana_card_number IS NOT NULL AND ghana_card_number_cipher IS NULL)
      OR (alternate_id_number IS NOT NULL AND alternate_id_number_cipher IS NULL)
  `;

  console.log(`Found ${rows.length} profile(s) needing backfill.`);

  let updated = 0;
  for (const row of rows) {
    // Two separate UPDATEs — each touches a fixed pair of columns, so
    // the SQL is static and bound parameters stay simple.
    if (row.ghana_card_number && !row.ghana_card_number_cipher) {
      const cipher = encryptPii(row.ghana_card_number);
      const hash = hashPii(row.ghana_card_number);
      await prisma.$executeRaw`
        UPDATE applicant_profiles
        SET ghana_card_number_cipher = ${cipher},
            ghana_card_number_hash = ${hash}
        WHERE id = ${row.id}::uuid
      `;
    }
    if (row.alternate_id_number && !row.alternate_id_number_cipher) {
      const cipher = encryptPii(row.alternate_id_number);
      const hash = hashPii(row.alternate_id_number);
      await prisma.$executeRaw`
        UPDATE applicant_profiles
        SET alternate_id_number_cipher = ${cipher},
            alternate_id_number_hash = ${hash}
        WHERE id = ${row.id}::uuid
      `;
    }
    updated++;
  }

  console.log(`Backfill complete — updated ${updated} profile(s).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

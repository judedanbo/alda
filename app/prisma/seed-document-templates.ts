import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Ingests the governance/security Markdown scaffolds under repo-root `docs/`
 * into the `DocumentTemplate` table so the admin Document Templates feature can
 * read them at runtime (no filesystem dependency in the server). Only documents
 * that actually contain `[TBD]` placeholders are treated as fillable templates.
 *
 * Idempotent: upserts by `key`, refreshing `sourceMarkdown` on each run.
 */

const here = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(here, "..", "..", "docs");

// Files in docs/ that are NOT policy templates (reference material / data).
const EXCLUDE = new Set([
  "audit-documentation-checklist.md", // index/checklist, not a fillable doc
  "analytics-abuse-ratelimit.md",
  "api-inventory.md",
  "architecture.md",
  "data-model.md",
  "backlog.md",
  "production-checklist.md",
  "security-assessment.md",
  "sbom.md",
]);

// Coarse category grouping for the admin list view.
const CATEGORY_BY_KEY: Record<string, string> = {
  "information-security-policy": "Security Governance",
  "access-control-policy": "Security Governance",
  "cryptography-policy": "Security Governance",
  "data-classification-policy": "Security Governance",
  "secure-development-policy": "Security Governance",
  "change-management-policy": "Security Governance",
  "logging-monitoring-policy": "Security Governance",
  "vulnerability-patch-management-policy": "Security Governance",
  "acceptable-use-policy": "Security Governance",
  "remote-working-policy": "HR & People",
  "hr-security-policy": "HR & People",
  "security-awareness-training-policy": "HR & People",
  "confidentiality-nda-agreement": "HR & People",
  dpia: "Data Protection",
  ropa: "Data Protection",
  "dsar-procedure": "Data Protection",
  "data-protection-policy": "Data Protection",
  "risk-register": "Risk & Compliance",
  "statement-of-applicability": "Risk & Compliance",
  "threat-model": "Risk & Compliance",
  "integration-control-documents": "Risk & Compliance",
  "incident-response-plan": "Operations & Resilience",
  "backup-dr-plan": "Operations & Resilience",
  "key-management-procedure": "Operations & Resilience",
};

function deriveTitle(markdown: string, key: string): string {
  const h1 = /^#\s+(.+)$/m.exec(markdown);
  const raw = h1?.[1]?.trim() ?? key;
  // Drop the "— Asset Declaration Portal (ADLA)" suffix for a cleaner label.
  return raw.replace(/\s*[—-]\s*Asset Declaration Portal.*$/i, "").trim();
}

export async function seedDocumentTemplates(prisma: PrismaClient): Promise<void> {
  console.log("📄 Seeding document templates from docs/ ...");
  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md") && !EXCLUDE.has(f));

  let count = 0;
  for (const file of files) {
    const markdown = readFileSync(join(DOCS_DIR, file), "utf8");
    if (!markdown.includes("[TBD")) continue; // only fillable scaffolds

    const key = file.replace(/\.md$/, "");
    const title = deriveTitle(markdown, key);
    const category = CATEGORY_BY_KEY[key] ?? "Governance";

    await prisma.documentTemplate.upsert({
      where: { key },
      update: { title, category, sourceMarkdown: markdown, sourcePath: `docs/${file}`, isActive: true },
      create: { key, title, category, sourceMarkdown: markdown, sourcePath: `docs/${file}` },
    });
    count++;
    console.log(`  ✓ ${key} — ${title}`);
  }

  console.log(`✅ Seeded ${count} document templates.`);
}

// Run standalone (`tsx prisma/seed-document-templates.ts`) but stay importable
// from the main seed without re-executing.
const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]!).href;

if (invokedDirectly) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED_IN_PRODUCTION !== "true") {
    console.error(
      "Refusing to seed document templates in production without ALLOW_SEED_IN_PRODUCTION=true.",
    );
    process.exit(1);
  }
  const prisma = new PrismaClient();
  seedDocumentTemplates(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

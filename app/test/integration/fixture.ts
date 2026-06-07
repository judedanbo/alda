/**
 * Deterministic fixture for the integration suite. Builds the minimal graph
 * the report / admin-declaration handlers read, with FIXED timestamps so the
 * aggregate assertions are exact:
 *
 *   2 SEALED declarations for one applicant, each with submittedAt = base,
 *   an earliest review at base+10h, and a receipt at base+16h
 *   → avg submission→review = 10h, avg review→receipt = 6h, both in `base`'s month.
 *
 * Runs against TEST_DATABASE_URL; truncates the touched tables first so each
 * run is isolated.
 */
import prisma from "~/server/utils/prisma";
import { encryptPii, hashPii } from "~/server/utils/pii-encryption";

export const KNOWN_GHANA_CARD = "GHA-INT-0001";

export interface SeededFixture {
  adminUserId: string;
  applicantUserId: string;
  institutionName: string;
  expectedMonth: string; // YYYY-MM
  expectedDeclarationCount: number;
  expectedAvgSubmissionToReview: number; // hours
  expectedAvgReviewToReceipt: number; // hours
}

const TABLES = [
  "receipts",
  "reviews",
  "declaration_status_history",
  "declarations",
  "applicant_offices",
  "applicant_profiles",
  "user_roles",
  "users",
  "institutions",
  "public_office_categories",
  "roles",
];

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}

const HOURS = (n: number) => n * 60 * 60 * 1000;

export async function seedFixture(): Promise<SeededFixture> {
  await resetDb();

  const adminRole = await prisma.role.create({ data: { name: "admin" } });
  const applicantRole = await prisma.role.create({ data: { name: "applicant" } });

  const admin = await prisma.user.create({
    data: { email: "int-admin@adla.test", passwordHash: "x", emailVerified: true },
  });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

  const applicantUser = await prisma.user.create({
    data: { email: "int-applicant@adla.test", passwordHash: "x", emailVerified: true },
  });
  await prisma.userRole.create({ data: { userId: applicantUser.id, roleId: applicantRole.id } });

  const category = await prisma.publicOfficeCategory.create({ data: { name: "Chief Director" } });
  const institution = await prisma.institution.create({ data: { name: "Ghana Health Service" } });

  const profile = await prisma.applicantProfile.create({
    data: {
      userId: applicantUser.id,
      fullName: "Ama Mensah",
      idType: "GHANA_CARD",
      ghanaCardNumberCipher: encryptPii(KNOWN_GHANA_CARD),
      ghanaCardNumberHash: hashPii(KNOWN_GHANA_CARD),
      offices: {
        create: [
          {
            designation: "Director",
            officeCategoryId: category.id,
            institutionId: institution.id,
            startDate: new Date("2020-01-01T00:00:00Z"),
          },
        ],
      },
    },
  });

  // Fixed, recent base so the declarations fall inside the rolling 12-month
  // window regardless of the day the suite runs.
  const base = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  base.setUTCHours(0, 0, 0, 0);

  for (const code of ["INT-0001", "INT-0002"]) {
    const decl = await prisma.declaration.create({
      data: {
        applicantId: profile.id,
        uniqueCode: code,
        status: "SEALED",
        createdAt: base,
        submittedAt: base,
      },
    });
    await prisma.review.create({
      data: {
        declarationId: decl.id,
        reviewedBy: admin.id,
        reviewDate: new Date(base.getTime() + HOURS(10)),
        status: "APPROVED",
        createdAt: new Date(base.getTime() + HOURS(10)),
      },
    });
    await prisma.receipt.create({
      data: {
        declarationId: decl.id,
        receiptNumber: `RCPT-${code}`,
        generatedBy: admin.id,
        createdAt: new Date(base.getTime() + HOURS(16)),
      },
    });
  }

  return {
    adminUserId: admin.id,
    applicantUserId: applicantUser.id,
    institutionName: institution.name,
    expectedMonth: base.toISOString().slice(0, 7),
    expectedDeclarationCount: 2,
    expectedAvgSubmissionToReview: 10,
    expectedAvgReviewToReceipt: 6,
  };
}

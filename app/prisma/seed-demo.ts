import { type Prisma, type DeclarationStatus, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { encryptPii, hashPii, canonicalizeId } from "../server/utils/pii-encryption";

const prisma = new PrismaClient();

/**
 * M-8: refuse to run in production. The demo seed creates 250 fictional
 * applicants with a hardcoded password. Override only via explicit
 * ALLOW_SEED_IN_PRODUCTION=true env var.
 */
function assertNotProduction(scriptName: string): void {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED_IN_PRODUCTION !== "true") {
    console.error(
      `Refusing to run ${scriptName} in production. This script creates ` +
      "demo data with hardcoded credentials. Set ALLOW_SEED_IN_PRODUCTION=true " +
      "if you genuinely need to run it against a production database (you " +
      "almost certainly should not).",
    );
    process.exit(1);
  }
}

// ═══ Name Pools ═══════════════════════════════════════════════

const MALE_FIRST = [
  "Kwame", "Kofi", "Kwesi", "Yaw", "Kwaku", "Kwabena", "Kojo", "Ebo",
  "Nii", "Nana", "Ato", "Fiifi", "Papa", "Koku", "Edem", "Selorm",
  "Kafui", "Senyo", "Delali", "Eli", "Dagadu", "Abdul", "Mustapha",
  "Ibrahim", "Alhassan", "Yakubu", "Abubakari", "Issah", "Mohammed", "Rashid",
];

const FEMALE_FIRST = [
  "Ama", "Akua", "Adwoa", "Yaa", "Afia", "Abena", "Akosua", "Efua",
  "Naa", "Maame", "Araba", "Esi", "Adzo", "Dzifa", "Sena", "Esinam",
  "Elinam", "Fafa", "Ayisha", "Fatima", "Zainab", "Amina", "Rahinatu",
  "Salamatu", "Memuna",
];

const SURNAMES = [
  "Mensah", "Asante", "Boateng", "Agyemang", "Owusu", "Appiah", "Osei",
  "Ankrah", "Tetteh", "Nartey", "Laryea", "Quaye", "Adjei", "Amoah",
  "Frimpong", "Darko", "Bonsu", "Sarpong", "Acheampong", "Badu",
  "Asamoah", "Gyamfi", "Opoku", "Marfo", "Kusi", "Ofori", "Danso",
  "Yeboah", "Antwi", "Boakye", "Amissah", "Aidoo", "Agbeko", "Doku",
  "Agbenyega", "Amegah", "Togbe", "Atsu", "Ahiagbah", "Azumah",
  "Tampuli", "Mahama", "Wuni", "Ziblim", "Salifu", "Iddrisu", "Dawuni",
  "Bukari", "Fuseini", "Abukari",
];

// ═══ Designation Pool ═════════════════════════════════════════

const DESIGNATION_POOL = [
  { title: "Director of Finance", category: "Head of Ministry or Government Department", institution: "Ghana Revenue Authority" },
  { title: "Director of Finance", category: "Head of Ministry or Government Department", institution: "Ghana Health Service" },
  { title: "Deputy Director", category: "Head of Ministry or Government Department", institution: "Ghana Revenue Authority" },
  { title: "Deputy Director", category: "Head of Ministry or Government Department", institution: "Ghana Education Service" },
  { title: "Deputy Director", category: "Head of Ministry or Government Department", institution: "Ghana Health Service" },
  { title: "Regional Director", category: "Head of Ministry or Government Department", institution: "Ghana Education Service" },
  { title: "Regional Director", category: "Head of Ministry or Government Department", institution: "Ghana Health Service" },
  { title: "Chief Director", category: "Head of Ministry or Government Department", institution: "Ghana Revenue Authority" },
  { title: "Principal Secretary", category: "Head of Ministry or Government Department", institution: "Ghana Education Service" },
  { title: "Member of Parliament", category: "Speaker, Deputy Speakers and Members of Parliament", institution: "Parliament of Ghana" },
  { title: "Member of Parliament", category: "Speaker, Deputy Speakers and Members of Parliament", institution: "Parliament of Ghana" },
  { title: "Deputy Minister", category: "Ministers and Deputy Ministers", institution: "Office of the President" },
  { title: "Justice of the High Court", category: "Chief Justice and Justices of Superior Courts", institution: "Supreme Court of Ghana" },
  { title: "Circuit Court Judge", category: "Chief Justice and Justices of Superior Courts", institution: "Supreme Court of Ghana" },
  { title: "Ambassador", category: "Ambassador or High Commissioner", institution: "Office of the President" },
  { title: "Board Chairman", category: "Chairmen and Members of Boards", institution: "Ghana National Petroleum Corporation" },
  { title: "Board Member", category: "Chairmen and Members of Boards", institution: "Electricity Company of Ghana" },
  { title: "Managing Director", category: "Managing Directors of Public Corporations", institution: "Ghana National Petroleum Corporation" },
  { title: "Deputy Managing Director", category: "Managing Directors of Public Corporations", institution: "Electricity Company of Ghana" },
  { title: "Chief Superintendent", category: "Police and Security Services Officers", institution: "Ghana Police Service" },
  { title: "Deputy Commissioner", category: "Police and Security Services Officers", institution: "Ghana Police Service" },
  { title: "Chief Inspector", category: "Police and Security Services Officers", institution: "Ghana Immigration Service" },
  { title: "Deputy Comptroller", category: "Police and Security Services Officers", institution: "Ghana Prisons Service" },
  { title: "Superintendent", category: "Police and Security Services Officers", institution: "Ghana Immigration Service" },
  { title: "Superintendent", category: "Police and Security Services Officers", institution: "Ghana Prisons Service" },
  { title: "Colonel", category: "Officers in the Armed Forces", institution: "Ghana Armed Forces" },
  { title: "Brigadier General", category: "Officers in the Armed Forces", institution: "Ghana Armed Forces" },
  { title: "Major", category: "Officers in the Armed Forces", institution: "Ghana Armed Forces" },
  { title: "Lieutenant Colonel", category: "Officers in the Armed Forces", institution: "Ghana Armed Forces" },
  { title: "Vice Chancellor", category: "Heads of Public Educational Institutions", institution: "University of Ghana" },
  { title: "Pro Vice Chancellor", category: "Heads of Public Educational Institutions", institution: "Kwame Nkrumah University of Science and Technology" },
  { title: "Dean of Faculty", category: "Heads of Public Educational Institutions", institution: "University of Ghana" },
  { title: "Senior Revenue Officer", category: "Other Public Officers", institution: "Ghana Revenue Authority" },
  { title: "Principal Analyst", category: "Other Public Officers", institution: "Bank of Ghana" },
  { title: "Senior Medical Officer", category: "Other Public Officers", institution: "Ghana Health Service" },
  { title: "Senior Education Officer", category: "Other Public Officers", institution: "Ghana Education Service" },
  { title: "Administrative Officer", category: "Other Public Officers", institution: "Ghana Revenue Authority" },
  { title: "Administrative Officer", category: "Other Public Officers", institution: "Ghana Health Service" },
];

// ═══ Data Pools ═══════════════════════════════════════════════

const REJECTION_REASONS = [
  "Incomplete property declarations in Section B",
  "Missing bank account details in Section D",
  "Inconsistent income sources declared",
  "Employment history does not match records",
  "Missing signatures on declaration certificate",
  "Illegible handwriting in multiple sections",
  "Securities information incomplete",
  "Liabilities section left blank",
  "Missing voluntary disclosure information",
  "Declaration form damaged beyond readability",
];

const REISSUE_NOTES = [
  "Form was damaged in a flood at my office",
  "Form accidentally disposed of during office relocation",
  "Form stolen from my vehicle",
  "Form misplaced during transition between offices",
  "Form destroyed in office fire incident",
];

const DECLINE_REASONS = [
  "Insufficient evidence of form loss",
  "No supporting letter from Auditor General",
  "Applicant failed to provide police report",
  "Conflicting accounts of form loss circumstances",
];

const SECTION_COMMENTS = [
  "Missing property address details",
  "Bank account numbers partially illegible",
  "Employment dates do not match records",
  "Signature appears different from registered specimen",
  "Information appears incomplete",
  "Figures do not add up correctly",
  "Required supporting details omitted",
  "Handwriting unclear in this section",
];

const FORM_SECTIONS = [
  "PERSONAL_PARTICULARS", "PROPERTIES", "EMPLOYMENT_BUSINESS",
  "SECURITIES_BANK", "ALIASES_PROPERTIES", "LIABILITIES",
  "VOLUNTARY_INFO", "DECLARANT_CERTIFICATE",
] as const;

const YEAR_WEIGHTS: [number, number][] = [
  [2016, 20], [2017, 20], [2018, 22], [2019, 25],
  [2020, 18], [2021, 25], [2022, 30], [2023, 32],
  [2024, 32], [2025, 20], [2026, 5],
];

const PHONE_PREFIXES = ["20", "24", "27", "26", "54", "55"];

// ═══ Helpers ══════════════════════════════════════════════════

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)]!;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function randomDateInYear(year: number): Date {
  const start = new Date(year, 0, 15);
  const end = year === 2026 ? new Date(2026, 4, 15) : new Date(year, 11, 15);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pickWeightedYear(minYear = 2016, maxYear = 2026): number {
  const eligible = YEAR_WEIGHTS.filter(([y]) => y >= minYear && y <= maxYear);
  if (eligible.length === 0) return maxYear;
  const total = eligible.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [year, weight] of eligible) {
    r -= weight;
    if (r <= 0) return year;
  }
  return eligible[eligible.length - 1]![0];
}

function generateFullName(index: number): string {
  const isMale = index % 100 < 55;
  const first = isMale
    ? MALE_FIRST[index % MALE_FIRST.length]!
    : FEMALE_FIRST[index % FEMALE_FIRST.length]!;
  const surname = SURNAMES[index % SURNAMES.length]!;
  if (index % 10 < 3) {
    const middle = SURNAMES[(index * 7 + 13) % SURNAMES.length]!;
    return `${first} ${middle} ${surname}`;
  }
  return `${first} ${surname}`;
}

function demoUniqueCode(date: Date, index: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  let n = index;
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = chars[n % chars.length]! + code;
    n = Math.floor(n / chars.length);
  }
  return `ADLA-${y}${m}${d}-${code}`;
}

function demoReceiptNumber(date: Date, seq: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `RCP-${y}${m}${d}-${String(seq).padStart(6, "0")}`;
}

function determineStatus(year: number): DeclarationStatus {
  const r = Math.random();
  if (year <= 2023) return r < 0.93 ? "SEALED" : r < 0.98 ? "REJECTED" : "SEALED";
  if (year === 2024) {
    if (r < 0.70) return "SEALED";
    if (r < 0.80) return "APPROVED";
    if (r < 0.85) return "UNDER_REVIEW";
    if (r < 0.90) return "SUBMITTED";
    if (r < 0.95) return "FORM_COLLECTED";
    return "REJECTED";
  }
  // 2025–2026
  if (r < 0.25) return "SEALED";
  if (r < 0.35) return "APPROVED";
  if (r < 0.50) return "UNDER_REVIEW";
  if (r < 0.65) return "SUBMITTED";
  if (r < 0.80) return "FORM_COLLECTED";
  if (r < 0.93) return "CODE_GENERATED";
  return "REJECTED";
}

// ═══ Interfaces ═══════════════════════════════════════════════

interface ResolvedDesignation {
  title: string;
  categoryId: number;
  institutionId: string;
}

interface ApplicantData {
  userId: string;
  profileId: string;
  email: string;
  fullName: string;
  ghanaCardNumber: string;
  phone: string;
  registeredAt: Date;
  years: number[];
  designation: ResolvedDesignation;
  hasOfficeChange: boolean;
}

interface DeclPlan {
  id: string;
  profileId: string;
  userId: string;
  year: number;
  targetStatus: DeclarationStatus;
  previousDeclId: string | null;
}

// ═══ Main ═════════════════════════════════════════════════════

async function main() {
  assertNotProduction("prisma/seed-demo.ts");
  console.log("📊 Demo Seed: Starting...\n");

  // ── Check prerequisites ────────────────────────────────────
  const roles = await prisma.role.findMany();
  const applicantRole = roles.find((r) => r.name === "applicant");
  const officerRole = roles.find((r) => r.name === "schedule_officer");
  const legalRole = roles.find((r) => r.name === "legal_unit");
  if (!applicantRole || !officerRole || !legalRole) {
    console.error("❌ Roles not found. Run `npm run db:seed` first.");
    process.exit(1);
  }

  const categories = await prisma.publicOfficeCategory.findMany({ orderBy: { id: "asc" } });
  const institutions = await prisma.institution.findMany();
  const collectionOffices = await prisma.collectionOffice.findMany();
  if (categories.length < 10 || institutions.length < 5 || collectionOffices.length < 3) {
    console.error("❌ Reference data missing. Run `npm run db:seed` first.");
    process.exit(1);
  }

  const existingOfficers = await prisma.user.findMany({
    where: {
      email: {
        in: ["officer@adla.gov.gh", "officer2@adla.gov.gh", "legal@adla.gov.gh", "legal2@adla.gov.gh"],
      },
    },
  });

  console.log(
    `  Found ${roles.length} roles, ${categories.length} categories, ` +
      `${institutions.length} institutions, ${collectionOffices.length} offices, ` +
      `${existingOfficers.length} existing officers`,
  );

  // ── Idempotency check ──────────────────────────────────────
  const sentinel = await prisma.user.findUnique({
    where: { email: "demo-applicant-001@adla-demo.gh" },
  });
  if (sentinel) {
    console.log(
      "⚠️  Demo data already exists. Run `npm run db:reset` then " +
        "`npm run db:seed` then `npm run db:seed:demo` to re-create.",
    );
    return;
  }

  // ── Build lookups ──────────────────────────────────────────
  const catByName = new Map(categories.map((c) => [c.name, c]));
  const instByName = new Map(institutions.map((i) => [i.name, i]));
  const passwordHash = await bcrypt.hash("password123", 12);

  const resolvedDesignations: ResolvedDesignation[] = DESIGNATION_POOL.map((d) => ({
    title: d.title,
    categoryId: catByName.get(d.category)?.id,
    institutionId: instByName.get(d.institution)?.id,
  })).filter((d): d is ResolvedDesignation => d.categoryId != null && d.institutionId != null);

  if (resolvedDesignations.length === 0) {
    console.error("❌ Could not resolve designations. Check reference data.");
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════
  // Phase 1: Create demo officers
  // ══════════════════════════════════════════════════════════════
  console.log("\nPhase 1: Creating demo officers...");

  const demoOfficerSpecs = [
    { email: "demo-officer-1@adla.gov.gh", fullName: generateFullName(901), phone: "+233201000001", roleId: officerRole.id },
    { email: "demo-officer-2@adla.gov.gh", fullName: generateFullName(902), phone: "+233201000002", roleId: officerRole.id },
    { email: "demo-officer-3@adla.gov.gh", fullName: generateFullName(903), phone: "+233201000003", roleId: officerRole.id },
    { email: "demo-legal-1@adla.gov.gh", fullName: generateFullName(904), phone: "+233201000004", roleId: legalRole.id },
  ];

  const scheduleOfficerIds: string[] = existingOfficers
    .filter((o) => !o.email.startsWith("legal"))
    .map((o) => o.id);
  const legalOfficerIds: string[] = existingOfficers
    .filter((o) => o.email.startsWith("legal"))
    .map((o) => o.id);

  for (const spec of demoOfficerSpecs) {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        email: spec.email,
        fullName: spec.fullName,
        passwordHash,
        phone: spec.phone,
        emailVerified: true,
        isActive: true,
        roles: { create: { roleId: spec.roleId } },
      },
    });
    if (spec.roleId === legalRole.id) legalOfficerIds.push(id);
    else scheduleOfficerIds.push(id);
  }

  const officerPool = [...scheduleOfficerIds];
  console.log(`  ✅ ${demoOfficerSpecs.length} demo officers (${officerPool.length} schedule, ${legalOfficerIds.length} legal)`);

  // ══════════════════════════════════════════════════════════════
  // Phase 2: Generate and create applicants
  // ══════════════════════════════════════════════════════════════
  console.log("\nPhase 2: Generating 250 applicants...");

  const applicants: ApplicantData[] = [];

  for (let i = 0; i < 250; i++) {
    let years: number[];
    if (i < 210) {
      years = [pickWeightedYear()];
    } else if (i < 240) {
      const y1 = pickWeightedYear(2016, 2022);
      years = [y1, pickWeightedYear(y1 + 2, 2026)];
    } else {
      const y1 = pickWeightedYear(2016, 2019);
      const y2 = pickWeightedYear(y1 + 2, 2023);
      years = [y1, y2, pickWeightedYear(y2 + 2, 2026)];
    }

    const registeredAt = addDays(randomDateInYear(years[0]!), -randomInt(30, 180));

    applicants.push({
      userId: randomUUID(),
      profileId: randomUUID(),
      email: `demo-applicant-${String(i + 1).padStart(3, "0")}@adla-demo.gh`,
      fullName: generateFullName(i),
      ghanaCardNumber: `GHA-${String(100000000 + i)}-${i % 10}`,
      phone: `+233${PHONE_PREFIXES[i % PHONE_PREFIXES.length]}${String(1000000 + ((i * 31) % 9000000)).padStart(7, "0")}`,
      registeredAt,
      years,
      designation: pickRandom(resolvedDesignations),
      hasOfficeChange: i >= 60 && i < 100,
    });
  }

  // Build office records
  const officeRecords: Prisma.ApplicantOfficeCreateManyInput[] = [];
  for (const a of applicants) {
    const officeStart = new Date(a.years[0]! - randomInt(1, 3), randomInt(0, 11), randomInt(1, 28));

    if (a.hasOfficeChange) {
      const changeYear = randomInt(Math.max(2018, a.years[0]!), Math.min(2023, a.years[a.years.length - 1]!));
      const endDate = new Date(changeYear, randomInt(0, 11), randomInt(1, 28));

      const candidates = resolvedDesignations.filter(
        (d) => d.title !== a.designation.title || d.institutionId !== a.designation.institutionId,
      );
      const newDes = pickRandom(candidates.length > 0 ? candidates : resolvedDesignations);
      const newStart = addDays(endDate, randomInt(5, 30));

      officeRecords.push({
        id: randomUUID(),
        profileId: a.profileId,
        designation: a.designation.title,
        officeCategoryId: a.designation.categoryId,
        institutionId: a.designation.institutionId,
        startDate: officeStart,
        endDate,
      });
      officeRecords.push({
        id: randomUUID(),
        profileId: a.profileId,
        designation: newDes.title,
        officeCategoryId: newDes.categoryId,
        institutionId: newDes.institutionId,
        startDate: newStart,
        endDate: null,
      });
    } else {
      officeRecords.push({
        id: randomUUID(),
        profileId: a.profileId,
        designation: a.designation.title,
        officeCategoryId: a.designation.categoryId,
        institutionId: a.designation.institutionId,
        startDate: officeStart,
        endDate: null,
      });
    }
  }

  // Batch insert
  console.log("  Inserting users, profiles, offices...");
  await prisma.$transaction(
    async (tx) => {
      await tx.user.createMany({
        data: applicants.map((a) => ({
          id: a.userId,
          email: a.email,
          passwordHash,
          phone: a.phone,
          emailVerified: true,
          isActive: true,
          createdAt: a.registeredAt,
        })),
      });

      await tx.userRole.createMany({
        data: applicants.map((a) => ({ userId: a.userId, roleId: applicantRole.id })),
      });

      await tx.applicantProfile.createMany({
        data: applicants.map((a) => ({
          id: a.profileId,
          userId: a.userId,
          fullName: a.fullName,
          ghanaCardNumberCipher: encryptPii(canonicalizeId(a.ghanaCardNumber)),
          ghanaCardNumberHash: hashPii(a.ghanaCardNumber),
          ghanaCardFrontUrl: `https://placeholder.local/demo/ghana-card-${a.ghanaCardNumber}-front.jpg`,
          ghanaCardBackUrl:
            Math.random() < 0.7
              ? `https://placeholder.local/demo/ghana-card-${a.ghanaCardNumber}-back.jpg`
              : null,
          verificationStatus: "VERIFIED" as const,
          createdAt: addDays(a.registeredAt, randomInt(0, 5)),
        })),
      });

      await tx.applicantOffice.createMany({ data: officeRecords });
    },
    { timeout: 30000 },
  );

  console.log(`  ✅ 250 users, 250 profiles, ${officeRecords.length} office entries`);

  // ══════════════════════════════════════════════════════════════
  // Phase 3: Generate and create declarations
  // ══════════════════════════════════════════════════════════════
  console.log("\nPhase 3: Generating declarations...");

  const declPlans: DeclPlan[] = [];
  for (const a of applicants) {
    for (let di = 0; di < a.years.length; di++) {
      const isLast = di === a.years.length - 1;
      declPlans.push({
        id: randomUUID(),
        profileId: a.profileId,
        userId: a.userId,
        year: a.years[di]!,
        targetStatus: isLast ? determineStatus(a.years[di]!) : ("SEALED" as DeclarationStatus),
        previousDeclId: null,
      });
    }
  }

  const baseCount = declPlans.length;

  // Add replacement declarations for ~70% of rejections
  const rejectedPlans = declPlans.filter((p) => p.targetStatus === "REJECTED");
  let replacementCount = 0;
  for (const plan of rejectedPlans) {
    if (Math.random() < 0.7) {
      const rYear = Math.min(plan.year + randomInt(0, 1), 2026);
      let rStatus = determineStatus(rYear);
      if (rStatus === "REJECTED") rStatus = "SEALED" as DeclarationStatus;
      declPlans.push({
        id: randomUUID(),
        profileId: plan.profileId,
        userId: plan.userId,
        year: rYear,
        targetStatus: rStatus,
        previousDeclId: plan.id,
      });
      replacementCount++;
    }
  }

  console.log(
    `  ${declPlans.length} declarations planned ` +
      `(${baseCount} base + ${replacementCount} replacements, ${rejectedPlans.length} rejected)`,
  );

  // Build lifecycle records
  const declarations: Prisma.DeclarationCreateManyInput[] = [];
  const histories: Prisma.DeclarationStatusHistoryCreateManyInput[] = [];
  const formCollections: Prisma.FormCollectionCreateManyInput[] = [];
  const sectionReviews: Prisma.DeclarationSectionReviewCreateManyInput[] = [];
  const reviewRecords: Prisma.ReviewCreateManyInput[] = [];
  const receiptRecords: Prisma.ReceiptCreateManyInput[] = [];
  const allAuditLogs: Prisma.AuditLogCreateManyInput[] = [];

  let codeIdx = 1;
  let receiptSeq = 1;

  for (const plan of declPlans) {
    const target = plan.targetStatus;
    const codeDate = randomDateInYear(plan.year);
    const collector = pickRandom(officerPool);
    const reviewer = pickRandom(officerPool);
    const receiptOfficer = pickRandom(officerPool);
    const collOffice = pickRandom(collectionOffices);
    const retOffice = pickRandom(collectionOffices);

    const reachedCollect = target !== "CODE_GENERATED";
    const reachedSubmit = reachedCollect && target !== "FORM_COLLECTED";
    const reachedDecision = reachedSubmit && target !== "SUBMITTED";
    const isApproved = target === "APPROVED" || target === "SEALED";
    const isSealed = target === "SEALED";

    const collectDate = reachedCollect ? addDays(codeDate, randomInt(1, 5)) : null;
    const submitDate = reachedSubmit ? addDays(collectDate!, randomInt(7, 30)) : null;
    const decisionDate = reachedDecision ? addDays(submitDate!, randomInt(3, 14)) : null;
    const sealDate = isSealed ? addDays(decisionDate!, randomInt(1, 3)) : null;

    const uniqueCode = demoUniqueCode(codeDate, codeIdx++);

    // ── Declaration record ──
    declarations.push({
      id: plan.id,
      applicantId: plan.profileId,
      uniqueCode,
      status: target,
      // UNDER_REVIEW demo declarations always carry unresolved section issues.
      reviewStatus: target === "UNDER_REVIEW" ? "ISSUES_IDENTIFIED" : "NEW",
      submittedAt: submitDate,
      returnOfficeId: reachedSubmit ? retOffice.id : null,
      previousDeclarationId: plan.previousDeclId,
      createdAt: codeDate,
    });

    // ── CODE_GENERATED ──
    histories.push({
      id: randomUUID(),
      declarationId: plan.id,
      status: "CODE_GENERATED",
      changedById: null,
      notes: plan.previousDeclId
        ? "Replacement declaration issued for rejected submission"
        : "Declaration created; unique code generated",
      createdAt: codeDate,
    });
    allAuditLogs.push({
      id: randomUUID(),
      userId: plan.userId,
      action: "declaration_created",
      entityType: "declaration",
      entityId: plan.id,
      newValues: { uniqueCode },
      ipAddress: "seed-demo",
      userAgent: "seed-demo/1.0",
      createdAt: codeDate,
    });

    if (!reachedCollect) continue;

    // ── FORM_COLLECTED ──
    histories.push({
      id: randomUUID(),
      declarationId: plan.id,
      status: "FORM_COLLECTED",
      changedById: collector,
      notes: `Physical form collected from ${collOffice.name}; recorded by GAS officer`,
      createdAt: collectDate!,
    });
    formCollections.push({
      id: randomUUID(),
      declarationId: plan.id,
      recordedBy: collector,
      collectionOfficeId: collOffice.id,
      collectedAt: collectDate!,
      notes: null,
      createdAt: collectDate!,
    });
    allAuditLogs.push({
      id: randomUUID(),
      userId: collector,
      action: "form_collection_recorded",
      entityType: "form_collection",
      entityId: plan.id,
      newValues: { collectionOfficeId: collOffice.id },
      ipAddress: "seed-demo",
      userAgent: "seed-demo/1.0",
      createdAt: collectDate!,
    });

    if (!reachedSubmit) continue;

    // ── SUBMITTED ──
    histories.push({
      id: randomUUID(),
      declarationId: plan.id,
      status: "SUBMITTED",
      changedById: collector,
      notes: `Form returned to ${retOffice.name}; recorded by GAS officer`,
      createdAt: submitDate!,
    });
    allAuditLogs.push({
      id: randomUUID(),
      userId: collector,
      action: "form_returned",
      entityType: "declaration",
      entityId: plan.id,
      oldValues: { status: "FORM_COLLECTED" },
      newValues: { status: "SUBMITTED" },
      ipAddress: "seed-demo",
      userAgent: "seed-demo/1.0",
      createdAt: submitDate!,
    });

    if (!reachedDecision) continue;

    // ── REJECTED path ──
    if (target === "REJECTED") {
      const reason = pickRandom(REJECTION_REASONS);
      histories.push({
        id: randomUUID(),
        declarationId: plan.id,
        status: "REJECTED",
        changedById: reviewer,
        notes: `Declaration rejected: ${reason}`,
        createdAt: decisionDate!,
      });
      for (const section of FORM_SECTIONS) {
        const ok = Math.random() > 0.35;
        sectionReviews.push({
          id: randomUUID(),
          declarationId: plan.id,
          reviewedBy: reviewer,
          section,
          isAcceptable: ok,
          comments: ok ? null : pickRandom(SECTION_COMMENTS),
          createdAt: decisionDate!,
        });
      }
      reviewRecords.push({
        id: randomUUID(),
        declarationId: plan.id,
        reviewedBy: reviewer,
        reviewDate: decisionDate!,
        status: "REJECTED",
        rejectionReason: reason,
        createdAt: decisionDate!,
      });
      allAuditLogs.push({
        id: randomUUID(),
        userId: reviewer,
        action: "declaration_rejected",
        entityType: "declaration",
        entityId: plan.id,
        newValues: { status: "REJECTED", rejectionReason: reason },
        ipAddress: "seed-demo",
        userAgent: "seed-demo/1.0",
        createdAt: decisionDate!,
      });
      continue;
    }

    // ── UNDER_REVIEW path (in-progress, has section issues) ──
    if (target === "UNDER_REVIEW") {
      const issueCount = randomInt(1, 3);
      const issueIndices = new Set<number>();
      while (issueIndices.size < issueCount) issueIndices.add(randomInt(0, 7));

      const issueNames = [...issueIndices].map((idx) => FORM_SECTIONS[idx]).join(", ");
      histories.push({
        id: randomUUID(),
        declarationId: plan.id,
        status: "UNDER_REVIEW",
        changedById: reviewer,
        notes: `Section review submitted — issues found in: ${issueNames}`,
        createdAt: decisionDate!,
      });
      for (let si = 0; si < FORM_SECTIONS.length; si++) {
        const hasIssue = issueIndices.has(si);
        sectionReviews.push({
          id: randomUUID(),
          declarationId: plan.id,
          reviewedBy: reviewer,
          section: FORM_SECTIONS[si]!,
          isAcceptable: !hasIssue,
          comments: hasIssue ? pickRandom(SECTION_COMMENTS) : null,
          createdAt: decisionDate!,
        });
      }
      allAuditLogs.push({
        id: randomUUID(),
        userId: reviewer,
        action: "section_review_submitted",
        entityType: "declaration",
        entityId: plan.id,
        newValues: { status: "UNDER_REVIEW" },
        ipAddress: "seed-demo",
        userAgent: "seed-demo/1.0",
        createdAt: decisionDate!,
      });
      continue;
    }

    // ── APPROVED path (all sections acceptable) ──
    if (!isApproved) continue;

    histories.push({
      id: randomUUID(),
      declarationId: plan.id,
      status: "APPROVED",
      changedById: reviewer,
      notes: "All form sections reviewed and approved",
      createdAt: decisionDate!,
    });
    for (const section of FORM_SECTIONS) {
      sectionReviews.push({
        id: randomUUID(),
        declarationId: plan.id,
        reviewedBy: reviewer,
        section,
        isAcceptable: true,
        comments: null,
        createdAt: decisionDate!,
      });
    }
    reviewRecords.push({
      id: randomUUID(),
      declarationId: plan.id,
      reviewedBy: reviewer,
      reviewDate: decisionDate!,
      status: "APPROVED",
      rejectionReason: null,
      createdAt: decisionDate!,
    });
    allAuditLogs.push({
      id: randomUUID(),
      userId: reviewer,
      action: "declaration_approved",
      entityType: "declaration",
      entityId: plan.id,
      newValues: { status: "APPROVED" },
      ipAddress: "seed-demo",
      userAgent: "seed-demo/1.0",
      createdAt: decisionDate!,
    });

    if (!isSealed) continue;

    // ── SEALED ──
    const receiptNum = demoReceiptNumber(sealDate!, receiptSeq++);
    histories.push({
      id: randomUUID(),
      declarationId: plan.id,
      status: "SEALED",
      changedById: receiptOfficer,
      notes: `Receipt generated: ${receiptNum}`,
      createdAt: sealDate!,
    });
    receiptRecords.push({
      id: randomUUID(),
      declarationId: plan.id,
      receiptNumber: receiptNum,
      generatedBy: receiptOfficer,
      pdfUrl: `https://placeholder.local/demo/receipts/${receiptNum}.pdf`,
      createdAt: sealDate!,
    });
    allAuditLogs.push({
      id: randomUUID(),
      userId: receiptOfficer,
      action: "receipt_generated",
      entityType: "receipt",
      entityId: plan.id,
      newValues: { receiptNumber: receiptNum },
      ipAddress: "seed-demo",
      userAgent: "seed-demo/1.0",
      createdAt: sealDate!,
    });
  }

  console.log(
    `  Built: ${declarations.length} declarations, ${histories.length} histories, ` +
      `${formCollections.length} form collections, ${sectionReviews.length} section reviews, ` +
      `${reviewRecords.length} reviews, ${receiptRecords.length} receipts`,
  );

  // Batch insert (originals first for FK constraint on previousDeclarationId)
  console.log("  Inserting...");
  const primaryDecls = declarations.filter((d) => !d.previousDeclarationId);
  const replacementDecls = declarations.filter((d) => d.previousDeclarationId);

  await prisma.$transaction(
    async (tx) => {
      await tx.declaration.createMany({ data: primaryDecls });
      if (replacementDecls.length > 0) {
        await tx.declaration.createMany({ data: replacementDecls });
      }
      await tx.declarationStatusHistory.createMany({ data: histories });
      await tx.formCollection.createMany({ data: formCollections });
      if (sectionReviews.length > 0) await tx.declarationSectionReview.createMany({ data: sectionReviews });
      if (reviewRecords.length > 0) await tx.review.createMany({ data: reviewRecords });
      if (receiptRecords.length > 0) await tx.receipt.createMany({ data: receiptRecords });
    },
    { timeout: 60000 },
  );
  console.log("  ✅ Declaration lifecycle records inserted");

  // ══════════════════════════════════════════════════════════════
  // Phase 4: Form reissue requests
  // ══════════════════════════════════════════════════════════════
  console.log("\nPhase 4: Creating form reissue requests...");

  const reissueRequests: Prisma.FormReissueRequestCreateManyInput[] = [];
  const reissueHistories: Prisma.DeclarationStatusHistoryCreateManyInput[] = [];

  // PENDING reissues — from declarations currently stuck in FORM_COLLECTED
  const formCollectedDecls = declPlans.filter((p) => p.targetStatus === "FORM_COLLECTED");
  for (const decl of formCollectedDecls.slice(0, 3)) {
    const fc = formCollections.find((f) => f.declarationId === decl.id);
    if (!fc) continue;
    const reqId = randomUUID();
    const requestDate = addDays(new Date(fc.collectedAt), randomInt(5, 20));
    reissueRequests.push({
      id: reqId,
      declarationId: decl.id,
      requestedById: decl.userId,
      status: "PENDING",
      applicantNote: pickRandom(REISSUE_NOTES),
      createdAt: requestDate,
    });
    reissueHistories.push({
      id: randomUUID(),
      declarationId: decl.id,
      status: "FORM_COLLECTED",
      changedById: decl.userId,
      notes: "Applicant reported the collected form lost; reissue requested (offline Auditor General approval pending)",
      createdAt: requestDate,
    });
    allAuditLogs.push({
      id: randomUUID(),
      userId: decl.userId,
      action: "form_reissue_requested",
      entityType: "form_reissue_request",
      entityId: reqId,
      newValues: { declarationId: decl.id },
      ipAddress: "seed-demo",
      userAgent: "seed-demo/1.0",
      createdAt: requestDate,
    });
  }

  // APPROVED reissues — from declarations that progressed past FORM_COLLECTED
  const progressedDecls = declPlans.filter((p) =>
    ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "SEALED"].includes(p.targetStatus),
  );
  for (const decl of progressedDecls.slice(0, 5)) {
    const fc = formCollections.find((f) => f.declarationId === decl.id);
    if (!fc) continue;
    const reqId = randomUUID();
    const requestDate = addDays(new Date(fc.collectedAt), randomInt(3, 10));
    const reviewDate = addDays(requestDate, randomInt(3, 14));
    const legal = pickRandom(legalOfficerIds);
    const isAG = Math.random() < 0.6;
    reissueRequests.push({
      id: reqId,
      declarationId: decl.id,
      requestedById: decl.userId,
      status: "APPROVED",
      applicantNote: pickRandom(REISSUE_NOTES),
      reviewedById: legal,
      approverType: isAG ? "AUDITOR_GENERAL" : "REGIONAL_AUDITOR",
      approverDetail: isAG ? "Auditor General's Office" : "Ashanti Regional Auditor",
      letterScanUrl: `https://placeholder.local/demo/reissue-letters/${reqId}.pdf`,
      decisionReason: null,
      reviewedAt: reviewDate,
      createdAt: requestDate,
    });
    reissueHistories.push(
      {
        id: randomUUID(),
        declarationId: decl.id,
        status: "FORM_COLLECTED",
        changedById: decl.userId,
        notes: "Applicant reported the collected form lost; reissue requested",
        createdAt: requestDate,
      },
      {
        id: randomUUID(),
        declarationId: decl.id,
        status: "FORM_COLLECTED",
        changedById: legal,
        notes: `Form reissue approved by ${isAG ? "Auditor General" : "Regional Auditor"}; reissued form to be returned via the normal Form Return step`,
        createdAt: reviewDate,
      },
    );
    allAuditLogs.push(
      {
        id: randomUUID(),
        userId: decl.userId,
        action: "form_reissue_requested",
        entityType: "form_reissue_request",
        entityId: reqId,
        ipAddress: "seed-demo",
        userAgent: "seed-demo/1.0",
        createdAt: requestDate,
      },
      {
        id: randomUUID(),
        userId: legal,
        action: "form_reissue_approved",
        entityType: "form_reissue_request",
        entityId: reqId,
        ipAddress: "seed-demo",
        userAgent: "seed-demo/1.0",
        createdAt: reviewDate,
      },
    );
  }

  // DECLINED reissues
  for (const decl of progressedDecls.slice(5, 9)) {
    const fc = formCollections.find((f) => f.declarationId === decl.id);
    if (!fc) continue;
    const reqId = randomUUID();
    const requestDate = addDays(new Date(fc.collectedAt), randomInt(3, 10));
    const reviewDate = addDays(requestDate, randomInt(2, 10));
    const legal = pickRandom(legalOfficerIds);
    const reason = pickRandom(DECLINE_REASONS);
    reissueRequests.push({
      id: reqId,
      declarationId: decl.id,
      requestedById: decl.userId,
      status: "DECLINED",
      applicantNote: pickRandom(REISSUE_NOTES),
      reviewedById: legal,
      decisionReason: reason,
      reviewedAt: reviewDate,
      createdAt: requestDate,
    });
    reissueHistories.push(
      {
        id: randomUUID(),
        declarationId: decl.id,
        status: "FORM_COLLECTED",
        changedById: decl.userId,
        notes: "Applicant reported the collected form lost; reissue requested",
        createdAt: requestDate,
      },
      {
        id: randomUUID(),
        declarationId: decl.id,
        status: "FORM_COLLECTED",
        changedById: legal,
        notes: `Form reissue declined: ${reason}`,
        createdAt: reviewDate,
      },
    );
    allAuditLogs.push(
      {
        id: randomUUID(),
        userId: decl.userId,
        action: "form_reissue_requested",
        entityType: "form_reissue_request",
        entityId: reqId,
        ipAddress: "seed-demo",
        userAgent: "seed-demo/1.0",
        createdAt: requestDate,
      },
      {
        id: randomUUID(),
        userId: legal,
        action: "form_reissue_declined",
        entityType: "form_reissue_request",
        entityId: reqId,
        ipAddress: "seed-demo",
        userAgent: "seed-demo/1.0",
        createdAt: reviewDate,
      },
    );
  }

  if (reissueRequests.length > 0 || reissueHistories.length > 0) {
    await prisma.$transaction(async (tx) => {
      if (reissueRequests.length > 0) await tx.formReissueRequest.createMany({ data: reissueRequests });
      if (reissueHistories.length > 0) await tx.declarationStatusHistory.createMany({ data: reissueHistories });
    });
  }
  console.log(`  ✅ ${reissueRequests.length} form reissue requests created`);

  // ══════════════════════════════════════════════════════════════
  // Phase 5: Audit logs
  // ══════════════════════════════════════════════════════════════
  console.log("\nPhase 5: Creating audit logs...");
  const CHUNK = 500;
  for (let i = 0; i < allAuditLogs.length; i += CHUNK) {
    await prisma.auditLog.createMany({ data: allAuditLogs.slice(i, i + CHUNK) });
  }
  console.log(`  ✅ ${allAuditLogs.length} audit log entries`);

  // ── Summary ────────────────────────────────────────────────
  console.log(`
🎉 Demo seed completed!
   250 applicants (40 with office changes)
   ${declarations.length} declarations (${rejectedPlans.length} rejected, ${replacementCount} replacements)
   ${histories.length + reissueHistories.length} status history entries
   ${formCollections.length} form collections
   ${sectionReviews.length} section reviews
   ${reviewRecords.length} reviews
   ${receiptRecords.length} receipts
   ${reissueRequests.length} form reissue requests
   ${allAuditLogs.length} audit log entries
  `);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Demo seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

import prisma from "~/server/utils/prisma";
import { getCached, buildCacheKey } from "~/server/utils/analytics-cache";

export type ObligationType = "assumption" | "periodic" | "departure";
export type ComplianceStatus = "compliant" | "upcoming" | "due_now" | "overdue";

export interface ComplianceObligation {
  applicantId: string;
  fullName: string | null;
  ghanaCardNumber: string | null;
  institution: string | null;
  institutionId: string | null;
  designation: string;
  obligationType: ObligationType;
  dueDate: Date;
  daysPastDue: number;
  status: ComplianceStatus;
  lastDeclarationDate: string | null;
  officeStartDate: string;
  officeEndDate: string | null;
}

export interface ComplianceSummary {
  totalApplicantsWithOffices: number;
  compliant: number;
  upcoming: number;
  dueNow: number;
  overdue: number;
  complianceRate: number;
}

export interface ComplianceListResult {
  items: ComplianceObligation[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ComplianceFilters {
  status?: ComplianceStatus;
  institutionId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

const OBLIGATION_INTERVAL_YEARS = 4;
const TOLERANCE_DAYS = 90;

function generateDueDates(startDate: Date, endDate: Date | null, today: Date): { date: Date; type: ObligationType }[] {
  const dues: { date: Date; type: ObligationType }[] = [];

  dues.push({ date: new Date(startDate), type: "assumption" });

  const boundary = endDate ?? today;
  let nextPeriodic = new Date(startDate);
  nextPeriodic.setFullYear(nextPeriodic.getFullYear() + OBLIGATION_INTERVAL_YEARS);

  while (nextPeriodic <= boundary) {
    dues.push({ date: new Date(nextPeriodic), type: "periodic" });
    nextPeriodic = new Date(nextPeriodic);
    nextPeriodic.setFullYear(nextPeriodic.getFullYear() + OBLIGATION_INTERVAL_YEARS);
  }

  if (!endDate && nextPeriodic.getTime() - today.getTime() <= TOLERANCE_DAYS * 86400000) {
    dues.push({ date: new Date(nextPeriodic), type: "periodic" });
  }

  if (endDate) {
    dues.push({ date: new Date(endDate), type: "departure" });
  }

  return dues;
}

function classifyObligation(dueDate: Date, today: Date): ComplianceStatus {
  const diffMs = today.getTime() - dueDate.getTime();
  const diffDays = diffMs / 86400000;

  if (diffDays < -TOLERANCE_DAYS) {
    return "compliant";
  }
  if (diffDays < 0) {
    return "upcoming";
  }
  if (diffDays <= TOLERANCE_DAYS) {
    return "due_now";
  }
  return "overdue";
}

function isSatisfied(dueDate: Date, sealedDates: Date[]): boolean {
  const toleranceMs = TOLERANCE_DAYS * 86400000;
  return sealedDates.some(
    (sd) => Math.abs(sd.getTime() - dueDate.getTime()) <= toleranceMs,
  );
}

export async function computeComplianceObligations(
  scopeUserId?: string,
): Promise<ComplianceObligation[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let applicantIdFilter: string[] | undefined;
  if (scopeUserId) {
    const processed = await prisma.declarationStatusHistory.findMany({
      where: { changedById: scopeUserId },
      select: { declaration: { select: { applicantId: true } } },
      distinct: ["declarationId"],
    });
    applicantIdFilter = [...new Set(processed.map((p) => p.declaration.applicantId))];
    if (applicantIdFilter.length === 0) return [];
  }

  const offices = await prisma.applicantOffice.findMany({
    where: applicantIdFilter
      ? { profile: { id: { in: applicantIdFilter } } }
      : undefined,
    select: {
      designation: true,
      startDate: true,
      endDate: true,
      institution: { select: { id: true, name: true } },
      profile: {
        select: {
          id: true,
          fullName: true,
          ghanaCardNumber: true,
          declarations: {
            select: {
              statusHistory: {
                where: { status: "SEALED" },
                select: { createdAt: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  const obligations: ComplianceObligation[] = [];

  for (const office of offices) {
    const sealedDates = office.profile.declarations
      .flatMap((d) => d.statusHistory.map((h) => h.createdAt));

    const lastSealed = sealedDates.length > 0
      ? new Date(Math.max(...sealedDates.map((d) => d.getTime())))
      : null;

    const dues = generateDueDates(office.startDate, office.endDate, today);

    for (const due of dues) {
      if (isSatisfied(due.date, sealedDates)) continue;

      const status = classifyObligation(due.date, today);
      if (status === "compliant") continue;

      const diffDays = Math.round((today.getTime() - due.date.getTime()) / 86400000);

      obligations.push({
        applicantId: office.profile.id,
        fullName: office.profile.fullName,
        ghanaCardNumber: office.profile.ghanaCardNumber,
        institution: office.institution?.name ?? null,
        institutionId: office.institution?.id ?? null,
        designation: office.designation,
        obligationType: due.type,
        dueDate: due.date,
        daysPastDue: diffDays,
        status,
        lastDeclarationDate: lastSealed?.toISOString() ?? null,
        officeStartDate: office.startDate.toISOString(),
        officeEndDate: office.endDate?.toISOString() ?? null,
      });
    }
  }

  return obligations;
}

export async function getComplianceSummary(
  scopeUserId?: string,
): Promise<ComplianceSummary> {
  const cacheKey = buildCacheKey("compliance:summary", {
    date: new Date().toISOString().slice(0, 10),
    scopeUserId: scopeUserId ?? "all",
  });

  return getCached(cacheKey, 300, async () => {
    const obligations = await computeComplianceObligations(scopeUserId);

    const totalApplicantsWithOffices = await prisma.applicantProfile.count({
      where: { offices: { some: {} } },
    });

    const upcoming = obligations.filter((o) => o.status === "upcoming").length;
    const dueNow = obligations.filter((o) => o.status === "due_now").length;
    const overdue = obligations.filter((o) => o.status === "overdue").length;
    const nonCompliant = upcoming + dueNow + overdue;
    const compliant = Math.max(0, totalApplicantsWithOffices - nonCompliant);
    const complianceRate = totalApplicantsWithOffices > 0
      ? Math.round((compliant / totalApplicantsWithOffices) * 1000) / 10
      : 0;

    return { totalApplicantsWithOffices, compliant, upcoming, dueNow, overdue, complianceRate };
  });
}

export async function getComplianceList(
  filters: ComplianceFilters,
  scopeUserId?: string,
): Promise<ComplianceListResult> {
  const cacheKey = buildCacheKey("compliance:list", {
    date: new Date().toISOString().slice(0, 10),
    scopeUserId: scopeUserId ?? "all",
    ...filters,
  });

  return getCached(cacheKey, 300, async () => {
    let obligations = await computeComplianceObligations(scopeUserId);

    if (filters.status) {
      obligations = obligations.filter((o) => o.status === filters.status);
    }

    if (filters.institutionId) {
      obligations = obligations.filter((o) => o.institutionId === filters.institutionId);
    }

    if (filters.search) {
      const term = filters.search.toLowerCase();
      obligations = obligations.filter(
        (o) =>
          o.fullName?.toLowerCase().includes(term) ||
          o.ghanaCardNumber?.toLowerCase().includes(term),
      );
    }

    const sortBy = filters.sortBy ?? "dueDate";
    const sortOrder = filters.sortOrder ?? "asc";
    const dir = sortOrder === "asc" ? 1 : -1;

    obligations.sort((a, b) => {
      switch (sortBy) {
        case "applicantName":
          return dir * (a.fullName ?? "").localeCompare(b.fullName ?? "");
        case "institution":
          return dir * (a.institution ?? "").localeCompare(b.institution ?? "");
        case "daysPastDue":
          return dir * (a.daysPastDue - b.daysPastDue);
        case "dueDate":
        default:
          return dir * (a.dueDate.getTime() - b.dueDate.getTime());
      }
    });

    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 25, 100);
    const total = obligations.length;
    const start = (page - 1) * pageSize;
    const items = obligations.slice(start, start + pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  });
}

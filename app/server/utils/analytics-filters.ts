import type { H3Event } from "h3";
import type { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { hashPii } from "./pii-encryption";
import { ID_NUMBER_PATTERNS } from "./validators";

export interface AnalyticsFilters {
  dateFrom?: Date;
  dateTo?: Date;
  officeId?: string;
  collectionOfficeId?: string;
  officerId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export function parseFilters(event: H3Event): AnalyticsFilters {
  const query = getQuery(event);

  const filters: AnalyticsFilters = {};

  if (query.dateFrom) {
    filters.dateFrom = new Date(query.dateFrom as string);
  }
  if (query.dateTo) {
    const d = new Date(query.dateTo as string);
    d.setHours(23, 59, 59, 999);
    filters.dateTo = d;
  }
  if (query.officeId) {
    filters.officeId = query.officeId as string;
  }
  if (query.collectionOfficeId) {
    filters.collectionOfficeId = query.collectionOfficeId as string;
  }
  if (query.officerId) {
    filters.officerId = query.officerId as string;
  }
  if (query.search) {
    filters.search = (query.search as string).trim();
  }
  if (query.page) {
    filters.page = Math.max(1, parseInt(query.page as string, 10) || 1);
  }
  if (query.pageSize) {
    filters.pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string, 10) || 25));
  }
  if (query.sortBy) {
    filters.sortBy = query.sortBy as string;
  }
  if (query.sortOrder === "asc" || query.sortOrder === "desc") {
    filters.sortOrder = query.sortOrder;
  }

  return filters;
}

export interface RoleScope {
  role: string;
  userId: string;
  applicantProfileId?: string;
}

export async function getRoleScope(event: H3Event): Promise<RoleScope> {
  const auth = event.context.auth!;

  const roles = auth.roles as string[];
  if (roles.includes("admin")) {
    return { role: "admin", userId: auth.userId };
  }
  if (roles.includes("schedule_officer")) {
    return { role: "schedule_officer", userId: auth.userId };
  }
  if (roles.includes("legal_unit")) {
    return { role: "legal_unit", userId: auth.userId };
  }

  // Applicant — need their profile ID
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });

  return {
    role: "applicant",
    userId: auth.userId,
    applicantProfileId: profile?.id,
  };
}

export function buildSealedHistoryWhere(
  filters: AnalyticsFilters,
  scope: RoleScope,
): Prisma.DeclarationStatusHistoryWhereInput {
  const where: Prisma.DeclarationStatusHistoryWhereInput = {
    status: "SEALED",
  };

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
    if (filters.dateTo) where.createdAt.lte = filters.dateTo;
  }

  if (filters.officerId) {
    where.changedById = filters.officerId;
  }

  if (scope.role === "schedule_officer") {
    where.changedById = scope.userId;
  }

  if (scope.role === "applicant" && scope.applicantProfileId) {
    where.declaration = { applicantId: scope.applicantProfileId };
  }

  if (filters.officeId) {
    where.declaration = {
      ...where.declaration as Prisma.DeclarationWhereInput,
      applicant: {
        offices: { some: { institutionId: filters.officeId } },
      },
    };
  }

  if (filters.collectionOfficeId) {
    where.declaration = {
      ...where.declaration as Prisma.DeclarationWhereInput,
      OR: [
        { returnOfficeId: filters.collectionOfficeId },
        { formCollections: { some: { collectionOfficeId: filters.collectionOfficeId } } },
      ],
    };
  }

  if (filters.search) {
    const searchTerm = filters.search;
    // National-ID columns are encrypted (C-5); exact-match hash lookup
    // when the term looks like a canonical ID number.
    const idCandidate = searchTerm.trim().toUpperCase();
    const idMatches: Prisma.DeclarationWhereInput[] = [];
    if (ID_NUMBER_PATTERNS.GHANA_CARD.test(idCandidate)) {
      idMatches.push({ applicant: { ghanaCardNumberHash: hashPii(idCandidate) } });
    } else {
      for (const t of ["PASSPORT", "VOTER_ID", "DRIVERS_LICENSE", "NIA_RECEIPT"] as const) {
        if (ID_NUMBER_PATTERNS[t].test(idCandidate)) {
          idMatches.push({
            applicant: { idType: t, alternateIdNumberHash: hashPii(idCandidate) },
          });
        }
      }
    }
    where.declaration = {
      ...where.declaration as Prisma.DeclarationWhereInput,
      OR: [
        { uniqueCode: { contains: searchTerm, mode: "insensitive" } },
        { applicant: { fullName: { contains: searchTerm, mode: "insensitive" } } },
        ...idMatches,
      ],
    };
  }

  return where;
}

export function getComparisonDateRange(
  dateFrom?: Date,
  dateTo?: Date,
): { prevFrom: Date; prevTo: Date } | null {
  if (!dateFrom && !dateTo) {
    // "All Time" → compare current year vs previous year
    const now = new Date();
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return { prevFrom: prevYearStart, prevTo: prevYearEnd };
  }

  if (dateFrom && dateTo) {
    const rangeMs = dateTo.getTime() - dateFrom.getTime();
    const prevTo = new Date(dateFrom.getTime() - 1);
    prevTo.setHours(23, 59, 59, 999);
    const prevFrom = new Date(prevTo.getTime() - rangeMs);
    prevFrom.setHours(0, 0, 0, 0);
    return { prevFrom, prevTo };
  }

  return null;
}

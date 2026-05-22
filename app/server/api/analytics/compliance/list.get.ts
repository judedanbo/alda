import { getRoleScope } from "~/server/utils/analytics-filters";
import { getComplianceList, type ComplianceFilters } from "~/server/utils/compliance";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const scope = await getRoleScope(event);

  if (scope.role === "applicant") {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }

  const query = getQuery(event);

  const filters: ComplianceFilters = {};
  if (query.status && ["upcoming", "due_now", "overdue", "compliant"].includes(query.status as string)) {
    filters.status = query.status as ComplianceFilters["status"];
  }
  if (query.institutionId) {
    filters.institutionId = query.institutionId as string;
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

  const scopeUserId = scope.role === "schedule_officer" ? scope.userId : undefined;
  const data = await getComplianceList(filters, scopeUserId);

  const serializedItems = data.items.map((item) => ({
    ...item,
    dueDate: item.dueDate.toISOString().slice(0, 10),
  }));

  return {
    success: true,
    data: {
      items: serializedItems,
      pagination: data.pagination,
    },
  };
});

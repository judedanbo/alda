import { getRoleScope } from "~/server/utils/analytics-filters";
import { getComplianceSummary } from "~/server/utils/compliance";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const scope = await getRoleScope(event);

  if (scope.role === "applicant") {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }

  const scopeUserId = scope.role === "schedule_officer" ? scope.userId : undefined;
  const data = await getComplianceSummary(scopeUserId);

  return { success: true, data };
});

import type { HelpRole } from "~/help";
import { HELP_ROLES } from "~/help";
import { useAuthStore } from "~/stores/auth";

/**
 * Resolves the help role for the signed-in user. The help centre defaults to
 * this role's content but lets users browse other roles.
 */
export function useHelp() {
  const authStore = useAuthStore();

  const currentRole = computed<HelpRole>(() => {
    if (authStore.isAdmin) return "admin";
    if (authStore.isOfficer) return "schedule_officer";
    if (authStore.isLegalUnit) return "legal_unit";
    return "applicant";
  });

  /** Coerce an arbitrary string (e.g. a ?role= query) into a valid HelpRole. */
  function resolveRole(value: unknown, fallback: HelpRole): HelpRole {
    return typeof value === "string" && (HELP_ROLES as string[]).includes(value)
      ? (value as HelpRole)
      : fallback;
  }

  return { currentRole, resolveRole };
}

import { useAuthStore } from "~/stores/auth";

export interface NavItem {
  name: string;
  href: string;
  icon: string;
  tour?: string;
  disabled?: boolean;
}

const helpNavItem: NavItem = {
  name: "Help",
  href: "/help",
  icon: "circle-help",
  tour: "nav-help",
};

/**
 * Single source of truth for the role-based primary navigation. Shared by the
 * applicant top-nav shell and the officer/legal/admin left sidebar so the menu
 * is defined exactly once.
 */
export function useDashboardNav() {
  const authStore = useAuthStore();
  const { hasActiveDeclaration } = useActiveDeclaration();

  const navigation = computed<NavItem[]>(() => {
    const baseNav: NavItem[] = [
      { name: "Dashboard", href: "/applicant/dashboard", icon: "home", tour: "nav-dashboard" },
    ];

    if (authStore.isApplicant) {
      return [
        ...baseNav,
        { name: "My Declarations", href: "/applicant/declarations", icon: "file-text", tour: "nav-declarations" },
        { name: "New Declaration", href: "/applicant/declaration/new", icon: "plus-circle", tour: "nav-new-declaration", disabled: !authStore.isVerified || hasActiveDeclaration.value },
        { name: "Analytics", href: "/applicant/analytics", icon: "bar-chart", tour: "nav-analytics" },
        helpNavItem,
      ];
    }

    if (authStore.isOfficer) {
      return [
        { name: "Dashboard", href: "/officer/dashboard", icon: "home", tour: "nav-dashboard" },
        { name: "Form Returns", href: "/officer/form-returns", icon: "inbox", tour: "nav-form-returns" },
        { name: "Reviews", href: "/officer/reviews", icon: "check-circle", tour: "nav-reviews" },
        { name: "Receipts", href: "/officer/receipts", icon: "receipt", tour: "nav-receipts" },
        { name: "Compliance", href: "/officer/compliance", icon: "clipboard-check", tour: "nav-compliance" },
        { name: "Analytics", href: "/officer/analytics", icon: "bar-chart", tour: "nav-analytics" },
        helpNavItem,
      ];
    }

    if (authStore.isLegalUnit) {
      return [
        { name: "Dashboard", href: "/legal/dashboard", icon: "home", tour: "nav-dashboard" },
        { name: "Applicant Verifications", href: "/legal/verifications", icon: "user-check", tour: "nav-verifications" },
        { name: "Form Reissues", href: "/legal/form-reissues", icon: "file-text", tour: "nav-form-reissues" },
        { name: "Verify Code", href: "/legal/verify", icon: "search", tour: "nav-verify-code" },
        { name: "Compliance", href: "/legal/compliance", icon: "clipboard-check", tour: "nav-compliance" },
        { name: "Analytics", href: "/legal/analytics", icon: "bar-chart", tour: "nav-analytics" },
        helpNavItem,
      ];
    }

    if (authStore.isAdmin) {
      return [
        { name: "Dashboard", href: "/admin/dashboard", icon: "home", tour: "nav-dashboard" },
        { name: "Declarations", href: "/admin/declarations", icon: "file-text", tour: "nav-declarations" },
        { name: "Users", href: "/admin/users", icon: "users", tour: "nav-users" },
        { name: "Institutions", href: "/admin/institutions", icon: "building", tour: "nav-institutions" },
        { name: "Categories", href: "/admin/categories", icon: "tag", tour: "nav-categories" },
        { name: "Audit Logs", href: "/admin/audit-logs", icon: "shield", tour: "nav-audit-logs" },
        { name: "Notifications", href: "/admin/notifications", icon: "bell", tour: "nav-notifications" },
        { name: "Compliance", href: "/admin/compliance", icon: "clipboard-check", tour: "nav-compliance" },
        { name: "Analytics", href: "/admin/analytics", icon: "bar-chart", tour: "nav-analytics" },
        { name: "Web Analytics", href: "/admin/web-analytics", icon: "activity", tour: "nav-web-analytics" },
        { name: "Reports", href: "/admin/reports", icon: "bar-chart", tour: "nav-reports" },
        { name: "Settings", href: "/admin/settings", icon: "settings", tour: "nav-settings" },
        helpNavItem,
      ];
    }

    return [...baseNav, helpNavItem];
  });

  return { navigation };
}

const STORAGE_KEY = "adla_sidebar_collapsed";

/**
 * Shared UI state for the officer/legal/admin left sidebar.
 * - `collapsed`: desktop icon-only rail, persisted to localStorage.
 * - `mobileOpen`: the mobile drawer (Sheet) open state.
 */
export function useSidebar() {
  const collapsed = useState<boolean>("sidebar-collapsed", () => false);
  const mobileOpen = useState<boolean>("sidebar-mobile-open", () => false);

  onMounted(() => {
    if (import.meta.client) {
      collapsed.value = localStorage.getItem(STORAGE_KEY) === "true";
    }
  });

  const toggleCollapsed = () => {
    collapsed.value = !collapsed.value;
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, String(collapsed.value));
    }
  };

  const toggleMobile = () => {
    mobileOpen.value = !mobileOpen.value;
  };

  const closeMobile = () => {
    mobileOpen.value = false;
  };

  return { collapsed, mobileOpen, toggleCollapsed, toggleMobile, closeMobile };
}

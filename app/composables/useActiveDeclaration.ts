import { authFetch } from "~/utils/authFetch";

const hasActive = ref<boolean | null>(null);

export function useActiveDeclaration() {
  const check = async () => {
    try {
      const response = await authFetch<{ data: { activeDeclaration: { id: string } | null } }>(
        "/api/declarations/stats",
      );
      hasActive.value = !!response.data.activeDeclaration;
    } catch {
      hasActive.value = null;
    }
  };

  const hasActiveDeclaration = computed(() => hasActive.value === true);

  return { hasActiveDeclaration, check };
}

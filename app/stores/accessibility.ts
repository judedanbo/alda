import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import {
  A11Y_DEFAULTS,
  A11Y_STORAGE_KEY,
  applyAccessibilityToDocument,
  readAccessibilityFromStorage,
  writeAccessibilityToStorage,
  type AccessibilityPreferences,
  type TextSize,
} from "~/utils/accessibility";
import { useAuthStore } from "~/stores/auth";

export const useAccessibilityStore = defineStore("accessibility", () => {
  const prefs = reactive<AccessibilityPreferences>({ ...A11Y_DEFAULTS });
  const hydratedFromStorage = ref(false);
  const hydratedFromServer = ref(false);
  const saving = ref(false);

  const isCustomized = computed(
    () =>
      prefs.textSize !== "base"
      || prefs.reduceMotion
      || prefs.underlineLinks
      || prefs.readableFont,
  );

  function _commit(
    next: AccessibilityPreferences,
    opts: { persistLocal?: boolean } = { persistLocal: true },
  ) {
    Object.assign(prefs, next);
    if (import.meta.client) {
      applyAccessibilityToDocument(prefs);
      if (opts.persistLocal) writeAccessibilityToStorage(prefs);
    }
  }

  function hydrateFromStorage() {
    if (hydratedFromStorage.value || !import.meta.client) return;
    _commit(readAccessibilityFromStorage(), { persistLocal: false });
    hydratedFromStorage.value = true;
  }

  // First-visit seed: only when nothing is in localStorage yet — honour the
  // user's OS-level "Reduce motion" so the experience matches expectations
  // immediately, without the user having to flip a switch.
  function seedFromOSIfFresh() {
    if (!import.meta.client) return;
    if (localStorage.getItem(A11Y_STORAGE_KEY)) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      _commit({ ...prefs, reduceMotion: true });
    }
  }

  async function hydrateFromServerIfAuthed() {
    const auth = useAuthStore();
    if (!auth.isAuthenticated || hydratedFromServer.value) return;
    try {
      const res = await authFetch<{ success: boolean; data: AccessibilityPreferences }>(
        "/api/accessibility/preferences",
      );
      if (res.success) {
        _commit(res.data, { persistLocal: true });
        hydratedFromServer.value = true;
      }
    } catch {
      /* silent — localStorage remains the source of truth this session */
    }
  }

  // Debounce server writes so a rapid sequence of changes (e.g. flipping
  // through text-size levels) doesn't fire a PATCH per click.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function _scheduleServerSave() {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saving.value = true;
      try {
        await authFetch("/api/accessibility/preferences", {
          method: "PATCH",
          body: { ...prefs },
        });
      } catch {
        /* swallow — localStorage still wins next session */
      } finally {
        saving.value = false;
      }
    }, 400);
  }

  function setTextSize(value: TextSize) {
    _commit({ ...prefs, textSize: value });
    _scheduleServerSave();
  }
  function setReduceMotion(value: boolean) {
    _commit({ ...prefs, reduceMotion: value });
    _scheduleServerSave();
  }
  function setUnderlineLinks(value: boolean) {
    _commit({ ...prefs, underlineLinks: value });
    _scheduleServerSave();
  }
  function setReadableFont(value: boolean) {
    _commit({ ...prefs, readableFont: value });
    _scheduleServerSave();
  }
  function reset() {
    _commit({ ...A11Y_DEFAULTS });
    _scheduleServerSave();
  }

  return {
    prefs,
    isCustomized,
    saving,
    hydrateFromStorage,
    seedFromOSIfFresh,
    hydrateFromServerIfAuthed,
    setTextSize,
    setReduceMotion,
    setUnderlineLinks,
    setReadableFont,
    reset,
  };
});

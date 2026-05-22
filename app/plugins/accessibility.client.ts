import { watch } from "vue";
import { useAccessibilityStore } from "~/stores/accessibility";
import { useAuthStore } from "~/stores/auth";

export default defineNuxtPlugin(() => {
  const a11y = useAccessibilityStore();
  const auth = useAuthStore();

  // 1. Mirror what the inline FOUC script already applied to <html>.
  a11y.hydrateFromStorage();
  // 2. First-visit fallback to OS reduced-motion preference.
  a11y.seedFromOSIfFresh();

  // 3. When the user is (or becomes) authenticated, pull DB prefs so settings
  //    sync across devices. `immediate: true` covers the page-load case where
  //    cookies have already populated the auth store synchronously.
  watch(
    () => auth.isAuthenticated,
    (isAuthed) => {
      if (isAuthed) a11y.hydrateFromServerIfAuthed();
    },
    { immediate: true },
  );
});

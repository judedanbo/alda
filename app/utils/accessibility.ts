// Shared accessibility-preference types, defaults, and DOM application helper.
// Used by the inline FOUC script (via the same key/shape), the Pinia store,
// the panel UI, and the server API.

export type TextSize = "base" | "lg" | "xl" | "2xl";

export interface AccessibilityPreferences {
  textSize: TextSize;
  reduceMotion: boolean;
  underlineLinks: boolean;
  readableFont: boolean;
}

export const A11Y_STORAGE_KEY = "adla-a11y";

export const A11Y_DEFAULTS: AccessibilityPreferences = {
  textSize: "base",
  reduceMotion: false,
  underlineLinks: false,
  readableFont: false,
};

export const TEXT_SIZE_LEVELS: { id: TextSize; label: string; scale: string }[] = [
  { id: "base", label: "Default", scale: "100%" },
  { id: "lg", label: "Large", scale: "115%" },
  { id: "xl", label: "Larger", scale: "130%" },
  { id: "2xl", label: "Largest", scale: "150%" },
];

const TEXT_SIZES: TextSize[] = ["base", "lg", "xl", "2xl"];

export function applyAccessibilityToDocument(prefs: AccessibilityPreferences) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.dataset.a11yTextSize = prefs.textSize;
  el.classList.toggle("a11y-reduce-motion", prefs.reduceMotion);
  el.classList.toggle("a11y-underline-links", prefs.underlineLinks);
  el.classList.toggle("a11y-readable-font", prefs.readableFont);
}

export function readAccessibilityFromStorage(): AccessibilityPreferences {
  if (typeof localStorage === "undefined") return { ...A11Y_DEFAULTS };
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return { ...A11Y_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
    return {
      textSize: TEXT_SIZES.includes(parsed.textSize as TextSize)
        ? (parsed.textSize as TextSize)
        : "base",
      reduceMotion: !!parsed.reduceMotion,
      underlineLinks: !!parsed.underlineLinks,
      readableFont: !!parsed.readableFont,
    };
  } catch {
    return { ...A11Y_DEFAULTS };
  }
}

export function writeAccessibilityToStorage(prefs: AccessibilityPreferences) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / disabled storage — ignore */
  }
}

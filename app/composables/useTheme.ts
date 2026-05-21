export interface ThemeOption {
  id: string;
  label: string;
  description: string;
  swatch: {
    bg: string;
    card: string;
    primary: string;
    accent: string;
    foreground: string;
  };
}

export const THEMES: ThemeOption[] = [
  {
    id: "system",
    label: "System",
    description: "Follow your operating system setting.",
    swatch: { bg: "#FFFFFF", card: "#F5F5F5", primary: "#006B3F", accent: "#0E9B5C", foreground: "#0A0A0A" },
  },
  {
    id: "light",
    label: "Light",
    description: "The default Ghana Government look.",
    swatch: { bg: "#FFFFFF", card: "#F5F5F5", primary: "#006B3F", accent: "#CE1126", foreground: "#0A0A0A" },
  },
  {
    id: "dark",
    label: "Dark",
    description: "Near-black surfaces, easy on the eyes.",
    swatch: { bg: "#0A0A0A", card: "#141414", primary: "#0E9B5C", accent: "#F0506A", foreground: "#FAFAFA" },
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    description: "Maximum legibility with bold borders.",
    swatch: { bg: "#FFFFFF", card: "#F0F0F0", primary: "#005C36", accent: "#C8102E", foreground: "#000000" },
  },
  {
    id: "sepia",
    label: "Sepia",
    description: "Warm parchment tones for comfortable reading.",
    swatch: { bg: "#F4ECD8", card: "#FBF5E3", primary: "#6B4F2A", accent: "#9C3B23", foreground: "#3B2F1E" },
  },
  {
    id: "solarized",
    label: "Solarized",
    description: "The balanced, low-strain Solarized palette.",
    swatch: { bg: "#FDF6E3", card: "#EEE8D5", primary: "#268BD2", accent: "#2AA198", foreground: "#586E75" },
  },
];

/**
 * Thin wrapper over @nuxtjs/color-mode that exposes the ADLA theme registry.
 * `current` is the user's choice (may be "system"); `resolved` is the concrete
 * theme actually applied — use `resolved` for anything that needs a real palette.
 */
export function useTheme() {
  const colorMode = useColorMode();

  const current = computed(() => colorMode.preference);
  const resolved = computed(() => colorMode.value);
  const isSystem = computed(() => colorMode.preference === "system");

  function setTheme(id: string) {
    colorMode.preference = id;
  }

  return { current, resolved, isSystem, setTheme, themes: THEMES };
}

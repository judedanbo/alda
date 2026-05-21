/**
 * Supplies ApexCharts with colors that follow the active ADLA theme.
 * ApexCharts needs concrete color strings, so this reads the resolved
 * `--color-*` custom properties off `<html>` and re-reads them whenever the
 * theme changes. Client-only — chart components are always inside <ClientOnly>.
 */
const FALLBACK_PALETTE = ["#006B3F", "#CE1126", "#FCD116", "#0EA5E9", "#A855F7"];

export function useChartTheme() {
  const colorMode = useColorMode();

  const palette = ref<string[]>([...FALLBACK_PALETTE]);
  const gridColor = ref("#E5E5E5");
  const foreColor = ref("#737373");
  const tooltipTheme = ref<"light" | "dark">("light");

  function read() {
    if (!import.meta.client) return;
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string) => styles.getPropertyValue(name).trim();

    palette.value = [
      token("--color-primary") || FALLBACK_PALETTE[0],
      token("--color-accent") || FALLBACK_PALETTE[1],
      token("--color-secondary") || FALLBACK_PALETTE[2],
      FALLBACK_PALETTE[3],
      FALLBACK_PALETTE[4],
    ];
    gridColor.value = token("--color-border") || "#E5E5E5";
    foreColor.value = token("--color-muted-foreground") || "#737373";
    tooltipTheme.value = colorMode.value === "dark" ? "dark" : "light";
  }

  onMounted(read);
  // The theme class lands on <html> first; re-read after the DOM flush.
  watch(() => colorMode.value, () => nextTick(read));

  return { palette, gridColor, foreColor, tooltipTheme };
}

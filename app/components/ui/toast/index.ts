import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export { default as Toast } from "./Toast.vue";
export { default as ToastContainer } from "./ToastContainer.vue";

/**
 * Card-surface toast with a colored accent border + colored icon, so it reads
 * well across every theme defined in main.css. Animations use tw-animate-css
 * utilities; reduced-motion is handled globally by main.css (no guard needed).
 */
export const toastVariants = cva(
  "group/toast pointer-events-auto relative flex w-full items-start gap-3 rounded-lg border bg-card px-3.5 py-3 pr-9 text-card-foreground text-sm shadow-lg ring-1 ring-foreground/5 " +
    "data-[swiping=true]:transition-none " +
    "animate-in fade-in slide-in-from-bottom-2 sm:slide-in-from-right-full",
  {
    variants: {
      variant: {
        info: "border-primary/30 *:data-[slot=toast-icon]:text-primary",
        success: "border-success/40 *:data-[slot=toast-icon]:text-success",
        warning: "border-warning/40 *:data-[slot=toast-icon]:text-warning",
        error: "border-destructive/40 *:data-[slot=toast-icon]:text-destructive",
        loading: "border-border *:data-[slot=toast-icon]:text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

export type ToastVariants = VariantProps<typeof toastVariants>;

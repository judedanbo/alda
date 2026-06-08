import { defineStore } from "pinia";
import { ref, computed } from "vue";

export type ToastVariant = "success" | "error" | "warning" | "info" | "loading";

export type ToastPosition =
  | "bottom-right"
  | "bottom-left"
  | "bottom-center"
  | "top-right"
  | "top-left"
  | "top-center";

export interface ToastAction {
  label: string;
  /** Invoked when the action button is clicked. */
  onClick: () => void | Promise<void>;
  /** Dismiss the toast after the action runs. Defaults to true. */
  dismissOnClick?: boolean;
}

export interface ToastOptions {
  title?: string;
  /** Message body. Also accepted as the first positional arg of the composable helpers. */
  description?: string;
  variant?: ToastVariant;
  /** ms before auto-dismiss. 0 / null / Infinity = sticky. Defaults: 5000, errors 8000, loading sticky. */
  duration?: number | null;
  /** Show the close button. Defaults to true (false for loading toasts). */
  dismissible?: boolean;
  /** Optional action / undo button. */
  action?: ToastAction;
  /** Caller-supplied id — re-using an id updates the existing toast in place (used by promise toasts). */
  id?: string;
  /** Collapse identical repeats. Defaults to `variant + title + description`. */
  dedupeKey?: string;
}

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title?: string;
  description: string;
  duration: number | null;
  dismissible: boolean;
  action?: ToastAction;
  dedupeKey: string;
  /** Number of times this (deduped) toast has fired — rendered as "× N" when > 1. */
  count: number;
  createdAt: number;
}

const MAX_VISIBLE = 4;

function defaultDuration(variant: ToastVariant): number | null {
  if (variant === "loading") return null;
  if (variant === "error") return 8000;
  if (variant === "warning") return 6000;
  return 5000;
}

export const useToastStore = defineStore("toast", () => {
  // Visible toasts (newest first). Overflow waits in `queue`.
  const toasts = ref<ToastItem[]>([]);
  const queue = ref<ToastItem[]>([]);
  const position = ref<ToastPosition>("bottom-right");

  // Timer bookkeeping is intentionally kept OUT of reactive state so the
  // setTimeout handles are never proxied / tracked by Vue (avoids leaks).
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const remaining = new Map<string, { endsAt: number; left: number }>();

  function clearTimer(id: string) {
    const t = timers.get(id);
    if (t) clearTimeout(t);
    timers.delete(id);
    remaining.delete(id);
  }

  function scheduleDismiss(id: string, ms: number) {
    if (!import.meta.client) return;
    clearTimer(id);
    remaining.set(id, { endsAt: Date.now() + ms, left: ms });
    timers.set(id, setTimeout(() => dismiss(id), ms));
  }

  function promoteFromQueue() {
    while (toasts.value.length < MAX_VISIBLE && queue.value.length > 0) {
      const next = queue.value.shift()!;
      toasts.value = [next, ...toasts.value];
      if (next.duration) scheduleDismiss(next.id, next.duration);
    }
  }

  function add(opts: ToastOptions): string {
    const variant = opts.variant ?? "info";
    const description = opts.description ?? "";
    const dedupeKey = opts.dedupeKey ?? `${variant}|${opts.title ?? ""}|${description}`;

    // Update-in-place when an explicit id is reused (promise toasts).
    if (opts.id) {
      const existing = toasts.value.find((t) => t.id === opts.id) ?? queue.value.find((t) => t.id === opts.id);
      if (existing) {
        update(opts.id, opts);
        return opts.id;
      }
    }

    // Dedupe: bump the count + reset the timer on an identical visible toast.
    const dupe = toasts.value.find((t) => t.dedupeKey === dedupeKey);
    if (dupe) {
      dupe.count += 1;
      if (dupe.duration) scheduleDismiss(dupe.id, dupe.duration);
      return dupe.id;
    }

    const duration = opts.duration === undefined ? defaultDuration(variant) : opts.duration;
    const item: ToastItem = {
      id: opts.id ?? (import.meta.client ? crypto.randomUUID() : `t-${Date.now()}-${Math.random()}`),
      variant,
      title: opts.title,
      description,
      duration: duration && Number.isFinite(duration) ? duration : null,
      dismissible: opts.dismissible ?? variant !== "loading",
      action: opts.action,
      dedupeKey,
      count: 1,
      createdAt: Date.now(),
    };

    if (toasts.value.length >= MAX_VISIBLE) {
      queue.value.push(item);
    } else {
      toasts.value = [item, ...toasts.value];
      if (item.duration) scheduleDismiss(item.id, item.duration);
    }
    return item.id;
  }

  function update(id: string, opts: ToastOptions) {
    const apply = (t: ToastItem) => {
      if (opts.variant !== undefined) t.variant = opts.variant;
      if (opts.title !== undefined) t.title = opts.title;
      if (opts.description !== undefined) t.description = opts.description;
      if (opts.action !== undefined) t.action = opts.action;
      if (opts.dismissible !== undefined) t.dismissible = opts.dismissible;
      const dur = opts.duration === undefined ? defaultDuration(t.variant) : opts.duration;
      t.duration = dur && Number.isFinite(dur) ? dur : null;
      if (t.duration) scheduleDismiss(t.id, t.duration);
      else clearTimer(t.id);
    };
    const visible = toasts.value.find((t) => t.id === id);
    if (visible) return apply(visible);
    const queued = queue.value.find((t) => t.id === id);
    if (queued) apply(queued);
  }

  function dismiss(id: string) {
    clearTimer(id);
    toasts.value = toasts.value.filter((t) => t.id !== id);
    queue.value = queue.value.filter((t) => t.id !== id);
    promoteFromQueue();
  }

  function clear() {
    for (const id of timers.keys()) clearTimer(id);
    toasts.value = [];
    queue.value = [];
  }

  // Pause / resume the auto-dismiss timer (hover + focus).
  function pause(id: string) {
    const meta = remaining.get(id);
    const t = timers.get(id);
    if (!meta || !t) return;
    clearTimeout(t);
    timers.delete(id);
    meta.left = Math.max(0, meta.endsAt - Date.now());
  }

  function resume(id: string) {
    const meta = remaining.get(id);
    if (!meta || timers.has(id)) return;
    if (meta.left <= 0) return dismiss(id);
    scheduleDismiss(id, meta.left);
  }

  function setPosition(p: ToastPosition) {
    position.value = p;
  }

  const hasToasts = computed(() => toasts.value.length > 0);

  return {
    // state
    toasts,
    queue,
    position,
    // getters
    hasToasts,
    // actions
    add,
    update,
    dismiss,
    clear,
    pause,
    resume,
    setPosition,
  };
});

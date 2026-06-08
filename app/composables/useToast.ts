import { useToastStore } from "~/stores/toast";
import type { ToastOptions, ToastVariant } from "~/stores/toast";
import { toastErrorMessage } from "~/utils/toastError";

type HelperOptions = Omit<ToastOptions, "variant" | "description">;

interface PromiseMessages<T> {
  loading: string;
  success: string | ((value: T) => string);
  error?: string | ((err: unknown) => string);
}

/**
 * Ergonomic, app-wide toast API. The only thing call-sites import.
 *
 *   const { toast } = useToast();
 *   toast.success("Saved");
 *   toast.error("Could not save");
 *   catch (err) { toast.fromError(err); }
 *   await toast.promise(authFetch(...), { loading: "Saving…", success: "Saved" });
 */
export function useToast() {
  const store = useToastStore();

  const make =
    (variant: ToastVariant) =>
    (message: string, opts: HelperOptions = {}) =>
      store.add({ ...opts, variant, description: message });

  const toast = {
    success: make("success"),
    error: make("error"),
    warning: make("warning"),
    info: make("info"),

    /** Full control over the toast payload. */
    show: (opts: ToastOptions) => store.add(opts),

    dismiss: (id: string) => store.dismiss(id),
    clear: () => store.clear(),

    /** Show an error toast from a caught fetch/H3 error (no side-effects). */
    fromError: (err: unknown, fallback = "Something went wrong", opts: HelperOptions = {}) =>
      store.add({ ...opts, variant: "error", description: toastErrorMessage(err, fallback) }),

    /**
     * Drive a toast through a promise: loading → success / error.
     * Returns the original promise so callers can keep awaiting the value.
     */
    promise: async <T>(promise: Promise<T>, messages: PromiseMessages<T>): Promise<T> => {
      const id = store.add({ variant: "loading", description: messages.loading, dismissible: false });
      try {
        const value = await promise;
        store.update(id, {
          variant: "success",
          description:
            typeof messages.success === "function" ? messages.success(value) : messages.success,
          dismissible: true,
        });
        return value;
      } catch (err) {
        const msg =
          messages.error === undefined
            ? toastErrorMessage(err)
            : typeof messages.error === "function"
              ? messages.error(err)
              : messages.error;
        store.update(id, { variant: "error", description: msg, dismissible: true });
        throw err;
      }
    },
  };

  return { toast };
}

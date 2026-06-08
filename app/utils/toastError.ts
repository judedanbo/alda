/**
 * Extracts a human-readable message from a caught H3/$fetch error for display
 * in a toast. This is a PURE function — unlike `useFieldErrors().handleServerError`
 * it has no reactive side-effects, so it can be called from stores, plugins, or
 * anywhere a `useFieldErrors` instance isn't available.
 *
 * Resolution order mirrors the server error envelope:
 *   data.data.formErrors → data.message → data.statusMessage → fallback.
 */
export function toastErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const e = err as {
    data?: {
      data?: { formErrors?: string[] };
      message?: string;
      statusMessage?: string;
    };
    message?: string;
  };

  const formErrors = e?.data?.data?.formErrors;
  if (formErrors?.length) return formErrors.join(". ");

  return e?.data?.message || e?.data?.statusMessage || e?.message || fallback;
}

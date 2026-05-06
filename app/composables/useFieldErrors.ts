export function useFieldErrors() {
  const fieldErrors = reactive<Record<string, string>>({});

  function clearFieldError(field: string) {
    delete fieldErrors[field];
  }

  function clearAll() {
    for (const key of Object.keys(fieldErrors)) {
      delete fieldErrors[key];
    }
  }

  function setFieldError(field: string, message: string) {
    fieldErrors[field] = message;
  }

  function hasErrors() {
    return Object.keys(fieldErrors).length > 0;
  }

  function handleServerError(err: unknown): string {
    const e = err as {
      data?: {
        data?: {
          fieldErrors?: Record<string, string[]>;
          formErrors?: string[];
        };
        message?: string;
        statusMessage?: string;
      };
    };

    const serverFieldErrors = e?.data?.data?.fieldErrors;
    if (serverFieldErrors) {
      for (const [field, messages] of Object.entries(serverFieldErrors)) {
        if (Array.isArray(messages) && messages.length > 0) {
          fieldErrors[field] = messages[0];
        }
      }
    }

    const formErrors = e?.data?.data?.formErrors;
    if (formErrors?.length) {
      return formErrors.join(". ");
    }

    if (!serverFieldErrors || Object.keys(serverFieldErrors).length === 0) {
      return (
        e?.data?.message || e?.data?.statusMessage || "An error occurred"
      );
    }

    return "";
  }

  return {
    fieldErrors,
    clearFieldError,
    clearAll,
    setFieldError,
    hasErrors,
    handleServerError,
  };
}

/**
 * Production startup gate: refuse to boot when required secrets are missing
 * or set to the committed example values from `nuxt.config.ts`.
 *
 * The `00.` filename prefix is deliberate. Nitro loads server plugins in
 * lexical filename order, so this gate runs before `notification-worker.ts`
 * and `traffic.ts`, both of which read `runtimeConfig` at registration.
 *
 * Validation logic lives in `server/utils/config-validation.ts` so it can be
 * unit-tested without booting Nitro.
 */
import { validateRequiredSecrets } from "~/server/utils/config-validation";

export default defineNitroPlugin(() => {
  const errors = validateRequiredSecrets(process.env, process.env.NODE_ENV);
  if (errors.length > 0) {
    const message
      = "[config-validation] Refusing to start in production with insecure secrets:\n  - "
      + errors.join("\n  - ");
    // Explicit stderr write: some container runtimes truncate or reformat
    // thrown errors, but the last line written before exit reliably appears
    // in `kubectl logs --previous` and equivalent operator views.
    process.stderr.write(message + "\n");
    throw new Error(message);
  }
  if (process.env.NODE_ENV === "production") {
    console.log("[config-validation] all required production secrets present");
  }
});

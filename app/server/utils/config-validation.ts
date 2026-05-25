/**
 * Production secret validation.
 *
 * `nuxt.config.ts` ships committed fallback strings for several secrets so
 * dev and test environments work without a `.env` file. Those fallbacks are
 * dangerous if they ever flow to production — anyone with the source can
 * forge tokens or take over object storage. This module produces the list
 * of misconfigurations that should prevent the server from starting in
 * production. The Nitro plugin at `server/plugins/00.config-validation.ts`
 * is the one place that calls into here at boot.
 *
 * The function is intentionally pure (takes `env` and `nodeEnv` as
 * parameters, no I/O) so the seven cases in
 * `test/config-validation.test.ts` can exercise it directly without
 * spinning up Nitro.
 *
 * Error messages name only the env var and the failed check — values are
 * never echoed.
 */

export interface RequiredSecret {
  envVar: string;
  description: string;
  /**
   * The committed example value from `nuxt.config.ts` (or `.env.example`).
   * When set, an explicit value matching this literal is rejected with a
   * distinct "committed example value" error — covers the case where an
   * operator copies the example verbatim instead of generating a real
   * secret.
   *
   * Omitted for `NOTIFICATIONS_SMS_WEBHOOK_SECRET`, which has no committed
   * literal — the dev-friendly semantic is "null means accept any caller"
   * (see `server/utils/sms-webhook.ts`); only the empty-check applies here.
   */
  forbiddenLiteral?: string;
}

export const PRODUCTION_REQUIRED_SECRETS: ReadonlyArray<RequiredSecret> = [
  {
    envVar: "JWT_SECRET",
    description: "JWT access-token signing key",
    forbiddenLiteral: "your-super-secret-jwt-key-change-in-production",
  },
  {
    envVar: "JWT_REFRESH_SECRET",
    description: "JWT refresh-token signing key",
    forbiddenLiteral: "your-refresh-secret-key-change-in-production",
  },
  {
    envVar: "MINIO_ACCESS_KEY",
    description: "MinIO access key",
    forbiddenLiteral: "minioadmin",
  },
  {
    envVar: "MINIO_SECRET_KEY",
    description: "MinIO secret key",
    forbiddenLiteral: "minioadmin",
  },
  {
    envVar: "ANALYTICS_IP_SALT",
    description: "Analytics IP-hash salt",
    forbiddenLiteral: "change-this-analytics-ip-salt-in-production",
  },
  {
    envVar: "NOTIFICATIONS_SMS_WEBHOOK_SECRET",
    description: "Shared secret authenticating inbound SMS-provider webhooks",
  },
];

export function validateRequiredSecrets(
  env: Record<string, string | undefined>,
  nodeEnv: string | undefined,
): string[] {
  if (nodeEnv !== "production") return [];

  const errors: string[] = [];
  for (const secret of PRODUCTION_REQUIRED_SECRETS) {
    const raw = env[secret.envVar];
    if (raw === undefined || raw.trim() === "") {
      errors.push(`${secret.envVar} is unset or empty (${secret.description})`);
      continue;
    }
    if (secret.forbiddenLiteral !== undefined && raw === secret.forbiddenLiteral) {
      errors.push(
        `${secret.envVar} is set to the committed example value — generate a fresh secret`,
      );
    }
  }
  return errors;
}

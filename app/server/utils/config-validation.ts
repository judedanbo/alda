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
  {
    envVar: "PII_ENCRYPTION_KEY",
    description: "AES-256-GCM key for at-rest encryption of national-ID columns (32 raw bytes hex-encoded)",
    forbiddenLiteral: "00000000000000000000000000000000000000000000000000000000000000ff",
  },
  {
    envVar: "PII_HMAC_KEY",
    description: "HMAC-SHA256 key for deterministic hash columns used to look up encrypted national IDs (32 raw bytes hex-encoded)",
    forbiddenLiteral: "00000000000000000000000000000000000000000000000000000000000000aa",
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

/**
 * A security-critical value the app reads via `useRuntimeConfig()`, paired with
 * the committed dev default it must NOT still equal in production.
 *
 * This complements `PRODUCTION_REQUIRED_SECRETS` (which checks raw `process.env`).
 * The distinction matters: a production Nuxt build overrides runtimeConfig ONLY
 * from `NUXT_`-prefixed env at runtime, so a plain `MINIO_ACCESS_KEY` can be
 * present (passing the env check) while `runtimeConfig.minioAccessKey` silently
 * falls back to `minioadmin` because the `NUXT_MINIO_ACCESS_KEY` twin is missing.
 * Validating the RESOLVED value is what catches that gap — the exact failure
 * that took down staging uploads with a runtime 502 instead of a boot error.
 */
export interface ResolvedConfigCheck {
  /** Dotted runtimeConfig path, used only in the error message. */
  path: string;
  /** Read the resolved value from a runtimeConfig object. */
  get: (config: Record<string, unknown>) => unknown;
  /** Write a value at this path (used by tests to build fixtures). */
  set: (config: Record<string, unknown>, value: unknown) => Record<string, unknown>;
  /** The committed dev default from `nuxt.config.ts` that must not survive to prod. */
  forbiddenDefault: string;
  description: string;
}

export const RESOLVED_CONFIG_CHECKS: ReadonlyArray<ResolvedConfigCheck> = [
  {
    path: "jwtSecret",
    get: (c) => c.jwtSecret,
    set: (c, v) => ({ ...c, jwtSecret: v }),
    forbiddenDefault: "your-super-secret-jwt-key-change-in-production",
    description: "JWT access-token signing key",
  },
  {
    path: "jwtRefreshSecret",
    get: (c) => c.jwtRefreshSecret,
    set: (c, v) => ({ ...c, jwtRefreshSecret: v }),
    forbiddenDefault: "your-refresh-secret-key-change-in-production",
    description: "JWT refresh-token signing key",
  },
  {
    path: "minioAccessKey",
    get: (c) => c.minioAccessKey,
    set: (c, v) => ({ ...c, minioAccessKey: v }),
    forbiddenDefault: "minioadmin",
    description: "MinIO access key",
  },
  {
    path: "minioSecretKey",
    get: (c) => c.minioSecretKey,
    set: (c, v) => ({ ...c, minioSecretKey: v }),
    forbiddenDefault: "minioadmin",
    description: "MinIO secret key",
  },
  {
    path: "analytics.ipSalt",
    get: (c) => (c.analytics as { ipSalt?: unknown } | undefined)?.ipSalt,
    set: (c, v) => ({ ...c, analytics: { ...(c.analytics as object), ipSalt: v } }),
    forbiddenDefault: "change-this-analytics-ip-salt-in-production",
    description: "Analytics IP-hash salt",
  },
];

/**
 * Validate the RESOLVED runtimeConfig (what the app actually consumes) against
 * the committed dev defaults. In production, any checked value that is unset or
 * still equal to its default is an error — almost always because the
 * `NUXT_`-prefixed env override that should have replaced it is missing.
 *
 * Pure (no I/O); the boot plugin passes `useRuntimeConfig()`. Values are never
 * echoed — only the path and the likely cause.
 */
export function validateResolvedRuntimeConfig(
  config: Record<string, unknown>,
  nodeEnv: string | undefined,
): string[] {
  if (nodeEnv !== "production") return [];

  const errors: string[] = [];
  for (const check of RESOLVED_CONFIG_CHECKS) {
    const value = check.get(config);
    if (value === undefined || value === null || String(value).trim() === "") {
      errors.push(`runtimeConfig.${check.path} is unset (${check.description})`);
      continue;
    }
    if (value === check.forbiddenDefault) {
      errors.push(
        `runtimeConfig.${check.path} resolved to the committed dev default — the `
        + `NUXT_-prefixed env override is missing (${check.description})`,
      );
    }
  }
  return errors;
}

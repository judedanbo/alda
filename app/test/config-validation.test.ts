import { describe, expect, it } from "vitest";

const {
  PRODUCTION_REQUIRED_SECRETS,
  validateRequiredSecrets,
  RESOLVED_CONFIG_CHECKS,
  validateResolvedRuntimeConfig,
} = await import("~/server/utils/config-validation");

const ALL_REAL = {
  JWT_SECRET: "Aw7r0Ng-S3cret-Long-Random",
  JWT_REFRESH_SECRET: "R3fresh-S3cret-Long-Random",
  MINIO_ACCESS_KEY: "real-access-key",
  MINIO_SECRET_KEY: "real-secret-key",
  ANALYTICS_IP_SALT: "real-ip-salt",
  NOTIFICATIONS_SMS_WEBHOOK_SECRET: "real-webhook-secret",
  PII_ENCRYPTION_KEY: "33".repeat(32),
  PII_HMAC_KEY: "44".repeat(32),
};

const ALL_FALLBACKS = Object.fromEntries(
  PRODUCTION_REQUIRED_SECRETS.filter((s) => s.forbiddenLiteral !== undefined).map(
    (s) => [s.envVar, s.forbiddenLiteral!],
  ),
);

describe("validateRequiredSecrets", () => {
  it("returns no errors in development, even with everything unset", () => {
    expect(validateRequiredSecrets({}, "development")).toEqual([]);
  });

  it("returns no errors in test, even with everything unset", () => {
    expect(validateRequiredSecrets({}, "test")).toEqual([]);
  });

  it("reports one error per required secret when all are unset in production", () => {
    const errors = validateRequiredSecrets({}, "production");
    expect(errors).toHaveLength(PRODUCTION_REQUIRED_SECRETS.length);
    for (const secret of PRODUCTION_REQUIRED_SECRETS) {
      expect(errors.some((e) => e.includes(secret.envVar))).toBe(true);
    }
  });

  it("rejects each committed fallback literal explicitly set in production", () => {
    const errors = validateRequiredSecrets(
      { ...ALL_FALLBACKS, NOTIFICATIONS_SMS_WEBHOOK_SECRET: "real-webhook-secret" },
      "production",
    );
    const fallbacks = PRODUCTION_REQUIRED_SECRETS.filter(
      (s) => s.forbiddenLiteral !== undefined,
    );
    expect(errors).toHaveLength(fallbacks.length);
    for (const secret of fallbacks) {
      expect(
        errors.some(
          (e) => e.includes(secret.envVar) && e.includes("committed example value"),
        ),
      ).toBe(true);
    }
  });

  it("isolates failures: one fallback among real values surfaces exactly one error", () => {
    const env = { ...ALL_REAL, MINIO_ACCESS_KEY: "minioadmin" };
    const errors = validateRequiredSecrets(env, "production");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("MINIO_ACCESS_KEY");
    expect(errors[0]).toContain("committed example value");
  });

  it("treats whitespace-only values as empty", () => {
    const env = { ...ALL_REAL, JWT_SECRET: "   " };
    const errors = validateRequiredSecrets(env, "production");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("JWT_SECRET");
    expect(errors[0]).toContain("unset or empty");
  });

  it("returns no errors in production when every required secret has a real value", () => {
    expect(validateRequiredSecrets(ALL_REAL, "production")).toEqual([]);
  });

  it("never echoes secret values in error messages", () => {
    const env = {
      JWT_SECRET: "leak-this-value-please",
      MINIO_ACCESS_KEY: "minioadmin",
    };
    const errors = validateRequiredSecrets(env, "production");
    for (const err of errors) {
      expect(err).not.toContain("leak-this-value-please");
      expect(err).not.toContain("minioadmin");
    }
  });
});

// A resolved runtimeConfig with real (non-default) values for every checked path.
const REAL_CONFIG = {
  jwtSecret: "Aw7r0Ng-S3cret-Long-Random",
  jwtRefreshSecret: "R3fresh-S3cret-Long-Random",
  minioAccessKey: "real-access-key",
  minioSecretKey: "real-secret-key",
  analytics: { ipSalt: "real-ip-salt" },
};

// A resolved runtimeConfig where every checked path is still the baked dev
// default — the exact shape produced when the NUXT_ env overrides are missing.
const DEFAULT_CONFIG = RESOLVED_CONFIG_CHECKS.reduce(
  (cfg: Record<string, unknown>, check) => check.set(cfg, check.forbiddenDefault),
  {},
);

describe("validateResolvedRuntimeConfig", () => {
  it("returns no errors outside production, even at dev defaults", () => {
    expect(validateResolvedRuntimeConfig(DEFAULT_CONFIG, "development")).toEqual([]);
    expect(validateResolvedRuntimeConfig(DEFAULT_CONFIG, "test")).toEqual([]);
  });

  it("returns no errors in production when every resolved value is real", () => {
    expect(validateResolvedRuntimeConfig(REAL_CONFIG, "production")).toEqual([]);
  });

  it("reports one error per check when every value is the baked dev default", () => {
    const errors = validateResolvedRuntimeConfig(DEFAULT_CONFIG, "production");
    expect(errors).toHaveLength(RESOLVED_CONFIG_CHECKS.length);
    for (const check of RESOLVED_CONFIG_CHECKS) {
      expect(errors.some((e: string) => e.includes(check.path))).toBe(true);
    }
  });

  it("flags the real-world failure: minioAccessKey fell back to minioadmin", () => {
    const cfg = { ...REAL_CONFIG, minioAccessKey: "minioadmin" };
    const errors = validateResolvedRuntimeConfig(cfg, "production");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("minioAccessKey");
    // The message must point the operator at the actual cause.
    expect(errors[0]).toContain("NUXT_");
  });

  it("treats an unset/empty resolved value as a failure", () => {
    const cfg = { ...REAL_CONFIG, jwtSecret: "" };
    const errors = validateResolvedRuntimeConfig(cfg, "production");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("jwtSecret");
  });

  it("never echoes resolved secret values in error messages", () => {
    const cfg = { ...REAL_CONFIG, minioAccessKey: "minioadmin", jwtSecret: "leak-me" };
    const errors = validateResolvedRuntimeConfig(cfg, "production");
    for (const err of errors) {
      expect(err).not.toContain("leak-me");
      expect(err).not.toContain("minioadmin");
    }
  });
});

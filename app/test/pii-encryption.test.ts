import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";

// Generate stable test keys before importing the module. The helpers read
// `process.env` directly, so a fresh value is picked up per call.
const TEST_ENC_KEY = "11".repeat(32); // 64-char hex
const TEST_HMAC_KEY = "22".repeat(32);

const ORIGINAL_ENC = process.env.PII_ENCRYPTION_KEY;
const ORIGINAL_HMAC = process.env.PII_HMAC_KEY;

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEY = TEST_ENC_KEY;
  process.env.PII_HMAC_KEY = TEST_HMAC_KEY;
});

afterAll(() => {
  if (ORIGINAL_ENC === undefined) delete process.env.PII_ENCRYPTION_KEY;
  else process.env.PII_ENCRYPTION_KEY = ORIGINAL_ENC;
  if (ORIGINAL_HMAC === undefined) delete process.env.PII_HMAC_KEY;
  else process.env.PII_HMAC_KEY = ORIGINAL_HMAC;
});

const { encryptPii, decryptPii, hashPii, canonicalizeId, decryptProfileIds } = await import(
  "~/server/utils/pii-encryption"
);

describe("canonicalizeId", () => {
  it("uppercases and trims", () => {
    expect(canonicalizeId("  gha-123456789-7  ")).toBe("GHA-123456789-7");
  });
});

describe("encryptPii / decryptPii round-trip", () => {
  it("recovers the plaintext", () => {
    const plaintext = "GHA-123456789-7";
    const envelope = encryptPii(plaintext);
    expect(decryptPii(envelope)).toBe(plaintext);
  });

  it("produces a different envelope each call (random IV)", () => {
    const a = encryptPii("GHA-123456789-7");
    const b = encryptPii("GHA-123456789-7");
    expect(a).not.toBe(b);
    expect(decryptPii(a)).toBe(decryptPii(b));
  });

  it("envelope shape is `v<n>.<iv>.<tag>.<ct>`", () => {
    const envelope = encryptPii("test");
    const parts = envelope.split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toMatch(/^v\d+$/);
    expect(parts[1]).toMatch(/^[0-9a-f]+$/); // iv hex
    expect(parts[2]).toMatch(/^[0-9a-f]+$/); // tag hex
    expect(parts[3]).toMatch(/^[0-9a-f]+$/); // ct hex
  });

  it("rejects an unknown version", () => {
    const envelope = encryptPii("test").replace(/^v\d+/, "v99");
    expect(() => decryptPii(envelope)).toThrow(/Unsupported PII cipher version/);
  });

  it("rejects a tampered ciphertext (auth tag check)", () => {
    const envelope = encryptPii("GHA-123456789-7");
    const parts = envelope.split(".");
    // Flip the last hex digit of the ciphertext.
    const ct = parts[3]!;
    const flipped = ct.slice(0, -1) + (ct.slice(-1) === "0" ? "1" : "0");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${flipped}`;
    expect(() => decryptPii(tampered)).toThrow();
  });

  it("rejects a malformed envelope", () => {
    expect(() => decryptPii("not-an-envelope")).toThrow(/Invalid PII cipher envelope shape/);
    expect(() => decryptPii("")).toThrow();
  });
});

describe("hashPii", () => {
  it("is deterministic for the same canonical input", () => {
    expect(hashPii("GHA-123456789-7")).toBe(hashPii("GHA-123456789-7"));
  });

  it("treats equivalent inputs as equal after canonicalisation", () => {
    // Lowercase / extra whitespace canonicalise to the same value.
    expect(hashPii("  gha-123456789-7 ")).toBe(hashPii("GHA-123456789-7"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashPii("GHA-111111111-1")).not.toBe(hashPii("GHA-222222222-2"));
  });

  it("returns a 64-char hex string (SHA-256)", () => {
    expect(hashPii("test")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("decryptProfileIds", () => {
  it("rehydrates ghanaCardNumber and alternateIdNumber from cipher fields", () => {
    const profile = {
      id: "abc",
      ghanaCardNumberCipher: encryptPii("GHA-123456789-7"),
      alternateIdNumberCipher: null,
    };
    const result = decryptProfileIds(profile);
    expect(result.ghanaCardNumber).toBe("GHA-123456789-7");
    expect(result.alternateIdNumber).toBeNull();
    expect(result.id).toBe("abc");
  });

  it("returns null for both when both ciphers are null", () => {
    const result = decryptProfileIds({
      ghanaCardNumberCipher: null,
      alternateIdNumberCipher: null,
    });
    expect(result.ghanaCardNumber).toBeNull();
    expect(result.alternateIdNumber).toBeNull();
  });
});

describe("missing keys", () => {
  beforeEach(() => {
    // Restore for the rest of the suite.
  });

  it("encryptPii throws when PII_ENCRYPTION_KEY is unset", async () => {
    const saved = process.env.PII_ENCRYPTION_KEY;
    delete process.env.PII_ENCRYPTION_KEY;
    expect(() => encryptPii("test")).toThrow(/PII_ENCRYPTION_KEY is not set/);
    process.env.PII_ENCRYPTION_KEY = saved;
  });

  it("encryptPii throws when the key is wrong length", () => {
    const saved = process.env.PII_ENCRYPTION_KEY;
    process.env.PII_ENCRYPTION_KEY = "deadbeef";
    expect(() => encryptPii("test")).toThrow(/must be 32 raw bytes/);
    process.env.PII_ENCRYPTION_KEY = saved;
  });

  it("hashPii throws when PII_HMAC_KEY is unset", () => {
    const saved = process.env.PII_HMAC_KEY;
    delete process.env.PII_HMAC_KEY;
    expect(() => hashPii("test")).toThrow(/PII_HMAC_KEY is not set/);
    process.env.PII_HMAC_KEY = saved;
  });
});

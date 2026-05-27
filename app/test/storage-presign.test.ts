import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * `parseStoredKey` is the pure half of `presignStored`. It takes whatever the
 * DB column happens to hold (a bucket-relative key after this change, or a
 * legacy `http://host:port/bucket/path` URL, or an expired presigned URL
 * with a query string) and returns the bucket key.
 *
 * The function reads `useRuntimeConfig().minioBucket` to know what prefix
 * to strip; the test setup's `vi.stubGlobal("useRuntimeConfig", ...)` stub
 * only exposes `analytics`, so we re-stub here with the bucket field.
 */
beforeEach(() => {
  vi.stubGlobal("useRuntimeConfig", () => ({
    minioBucket: "adla-uploads",
    minioEndpoint: "localhost",
    minioPort: 9000,
    minioAccessKey: "test",
    minioSecretKey: "test",
    analytics: { ipSalt: "test-salt" },
  }));
});

const { parseStoredKey } = await import("~/server/services/storage.service");

describe("parseStoredKey", () => {
  it("returns a bare key unchanged", () => {
    expect(parseStoredKey("ghana-cards/abc/front.jpg")).toBe(
      "ghana-cards/abc/front.jpg",
    );
  });

  it("strips host + bucket prefix from a legacy absolute URL", () => {
    expect(
      parseStoredKey("http://localhost:9000/adla-uploads/ghana-cards/abc/front.jpg"),
    ).toBe("ghana-cards/abc/front.jpg");
  });

  it("strips the query string from an expired presigned URL", () => {
    const presigned
      = "http://localhost:9000/adla-uploads/receipts/RCP-1.pdf"
        + "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc123";
    expect(parseStoredKey(presigned)).toBe("receipts/RCP-1.pdf");
  });

  it("returns the path for a URL with a different bucket name (legacy / renamed)", () => {
    // The minio bucket in test config is `adla-uploads`. A URL pointing at a
    // different bucket gets its leading slash stripped; we treat it as a
    // best-effort key rather than refusing to serve.
    expect(
      parseStoredKey("http://localhost:9000/old-bucket/some/key.jpg"),
    ).toBe("old-bucket/some/key.jpg");
  });

  it("returns null for an empty input", () => {
    expect(parseStoredKey("")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(parseStoredKey("http://[not-a-url")).toBeNull();
  });

  it("handles HTTPS legacy URLs", () => {
    expect(
      parseStoredKey("https://minio.example.com/adla-uploads/alternate-ids/u/passport.jpg"),
    ).toBe("alternate-ids/u/passport.jpg");
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.stubGlobal("useRuntimeConfig", () => ({
    minioBucket: "adla-uploads",
    minioEndpoint: "localhost",
    minioPort: 9000,
    minioUseSSL: false,
    minioAccessKey: "test",
    minioSecretKey: "test",
    analytics: { ipSalt: "test-salt" },
  }));
});

const { detectMagicType, validateImageFile, validateDocumentFile } = await import(
  "~/server/services/storage.service"
);

// Real format byte prefixes — only the signature bytes matter for detection;
// the rest of the buffer is padded with zeros.
function withSignature(prefix: number[], totalLen = 64): Buffer {
  const out = Buffer.alloc(totalLen);
  for (let i = 0; i < prefix.length; i++) out[i] = prefix[i]!;
  return out;
}

const JPEG = withSignature([0xff, 0xd8, 0xff, 0xe0]);
const PNG = withSignature([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// WebP: "RIFF" + 4-byte size + "WEBP"
const WEBP = withSignature([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x00, 0x00, 0x00, 0x00, // size (any)
  0x57, 0x45, 0x42, 0x50, // "WEBP"
]);
const PDF = withSignature([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

describe("detectMagicType", () => {
  it("recognizes JPEG", () => {
    expect(detectMagicType(JPEG)).toBe("image/jpeg");
  });
  it("recognizes PNG", () => {
    expect(detectMagicType(PNG)).toBe("image/png");
  });
  it("recognizes WebP only when both the RIFF and WEBP markers are present", () => {
    expect(detectMagicType(WEBP)).toBe("image/webp");
    // RIFF without WEBP — could be WAV, AVI, etc.
    const riffOther = withSignature([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]);
    expect(detectMagicType(riffOther)).toBeNull();
  });
  it("recognizes PDF", () => {
    expect(detectMagicType(PDF)).toBe("application/pdf");
  });
  it("rejects HTML-shaped payloads (leading `<`)", () => {
    expect(detectMagicType(Buffer.from("<!DOCTYPE html>"))).toBeNull();
    expect(detectMagicType(Buffer.from("<svg xmlns=...>"))).toBeNull();
    expect(detectMagicType(Buffer.from("<?xml version=\"1.0\"?>"))).toBeNull();
  });
  it("rejects HTML with leading whitespace", () => {
    expect(detectMagicType(Buffer.from("   \n<html>"))).toBeNull();
  });
  it("rejects empty or too-short buffers", () => {
    expect(detectMagicType(Buffer.alloc(0))).toBeNull();
    expect(detectMagicType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
  it("rejects arbitrary binary that isn't a known format", () => {
    expect(detectMagicType(Buffer.from([0xde, 0xad, 0xbe, 0xef]))).toBeNull();
  });
});

describe("validateImageFile", () => {
  it("accepts a real JPEG declared as image/jpeg and echoes the trusted type", () => {
    const result = validateImageFile(JPEG, "image/jpeg");
    expect(result).toEqual({ valid: true, contentType: "image/jpeg" });
  });

  it("rejects an HTML payload labelled image/jpeg (H-4 regression)", () => {
    const html = Buffer.from("<!DOCTYPE html><script>alert(1)</script>");
    const result = validateImageFile(html, "image/jpeg");
    expect(result.valid).toBe(false);
    // Either rejected as unsupported bytes or as a type mismatch — both
    // are correct outcomes for this attack shape.
    expect(result.contentType).toBeUndefined();
  });

  it("rejects a real JPEG declared as image/png (cross-format spoof)", () => {
    const result = validateImageFile(JPEG, "image/png");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/don't match/);
    expect(result.contentType).toBeUndefined();
  });

  it("rejects PDFs (allowed only by validateDocumentFile)", () => {
    const result = validateImageFile(PDF, "application/pdf");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid file type/);
  });

  it("enforces the 5 MB byte cap", () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1);
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
    const result = validateImageFile(big, "image/jpeg");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  it("accepts PNG and WebP too", () => {
    expect(validateImageFile(PNG, "image/png").valid).toBe(true);
    expect(validateImageFile(WEBP, "image/webp").valid).toBe(true);
  });
});

describe("validateDocumentFile", () => {
  it("accepts a real PDF", () => {
    const result = validateDocumentFile(PDF, "application/pdf");
    expect(result).toEqual({ valid: true, contentType: "application/pdf" });
  });

  it("accepts JPEG / PNG / WebP scans too", () => {
    expect(validateDocumentFile(JPEG, "image/jpeg").valid).toBe(true);
    expect(validateDocumentFile(PNG, "image/png").valid).toBe(true);
    expect(validateDocumentFile(WEBP, "image/webp").valid).toBe(true);
  });

  it("rejects HTML payload labelled application/pdf", () => {
    const result = validateDocumentFile(Buffer.from("<html><body>fake</body></html>"), "application/pdf");
    expect(result.valid).toBe(false);
    expect(result.contentType).toBeUndefined();
  });

  it("enforces the 10 MB byte cap", () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    big[0] = 0x25; big[1] = 0x50; big[2] = 0x44; big[3] = 0x46; big[4] = 0x2d;
    const result = validateDocumentFile(big, "application/pdf");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });
});

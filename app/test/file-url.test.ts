import { describe, expect, it, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.stubGlobal("useRuntimeConfig", () => ({ jwtSecret: "unit-test-secret" }));
});

const { signFileUrl, verifyFileSig } = await import("~/server/utils/file-url");

function parse(url: string) {
  const [path, qs] = url.split("?");
  const q = new URLSearchParams(qs);
  return { path, exp: Number(q.get("exp")), sig: q.get("sig") || "" };
}

describe("signFileUrl / verifyFileSig", () => {
  it("round-trips: a freshly signed url verifies", () => {
    const url = signFileUrl("ghana-cards/abc/front.jpg", 900);
    const { path, exp, sig } = parse(url);
    expect(path).toBe("/api/files/ghana-cards/abc/front.jpg");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyFileSig("ghana-cards/abc/front.jpg", exp, sig)).toBe(true);
  });

  it("rejects an expired url", () => {
    const { exp, sig } = parse(signFileUrl("k/x.jpg", -10)); // exp in the past
    expect(verifyFileSig("k/x.jpg", exp, sig)).toBe(false);
  });

  it("rejects a tampered key", () => {
    const { exp, sig } = parse(signFileUrl("k/x.jpg", 900));
    expect(verifyFileSig("k/other.jpg", exp, sig)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const { exp, sig } = parse(signFileUrl("k/x.jpg", 900));
    const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    expect(verifyFileSig("k/x.jpg", exp, flipped)).toBe(false);
  });

  it("rejects a tampered expiry", () => {
    const { exp, sig } = parse(signFileUrl("k/x.jpg", 900));
    expect(verifyFileSig("k/x.jpg", exp + 1000, sig)).toBe(false);
  });

  it("rejects a non-integer expiry", () => {
    const { sig } = parse(signFileUrl("k/x.jpg", 900));
    expect(verifyFileSig("k/x.jpg", Number.NaN, sig)).toBe(false);
  });

  it("rejects an empty signature", () => {
    const { exp } = parse(signFileUrl("k/x.jpg", 900));
    expect(verifyFileSig("k/x.jpg", exp, "")).toBe(false);
  });
});

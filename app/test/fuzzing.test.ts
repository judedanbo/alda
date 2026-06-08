import { describe, it, expect } from "vitest";
import { classifyFuzzingAttempt, shouldPersistAttempt } from "../server/utils/fuzzing";

// Most attacks are unauthenticated probes against the API; that's the default
// shape these cases share. Scoping behaviour for authenticated / content-route
// requests is asserted separately below.
const base = { isApi: true, authenticated: false };

describe("classifyFuzzingAttempt", () => {
  it("flags known suspicious paths as HIGH regardless of status or auth", () => {
    expect(classifyFuzzingAttempt({ ...base, method: "GET", path: "/.env", statusCode: 404, isApi: false }))
      .toEqual({ category: "SUSPICIOUS_PATH", severity: "HIGH" });
    expect(classifyFuzzingAttempt({ ...base, method: "GET", path: "/wp-login.php", statusCode: 200, isApi: false }))
      .toEqual({ category: "SUSPICIOUS_PATH", severity: "HIGH" });
    // Suspicious paths are caught even for an authenticated session — the path
    // itself is the tell, and the gate (not the classifier) handles dedup.
    expect(classifyFuzzingAttempt({ ...base, method: "GET", path: "/.git/config", statusCode: 404, isApi: false, authenticated: true }))
      .toEqual({ category: "SUSPICIOUS_PATH", severity: "HIGH" });
  });

  it("flags failed login probing as AUTH_FUZZING (login is always unauthenticated)", () => {
    expect(classifyFuzzingAttempt({ ...base, method: "POST", path: "/api/auth/login", statusCode: 401 }))
      .toEqual({ category: "AUTH_FUZZING", severity: "MEDIUM" });
    expect(classifyFuzzingAttempt({ ...base, method: "POST", path: "/api/auth/login", statusCode: 400 }))
      .toEqual({ category: "AUTH_FUZZING", severity: "MEDIUM" });
  });

  it("flags malformed validated form submissions as FORM_VALIDATION", () => {
    expect(
      classifyFuzzingAttempt({
        ...base,
        method: "POST",
        path: "/api/declarations",
        statusCode: 400,
        validation: { validationFailed: true, fields: ["categoryId"] },
      }),
    ).toEqual({ category: "FORM_VALIDATION", severity: "MEDIUM" });
  });

  it("flags 404s on API routes as PATH_PROBE", () => {
    expect(classifyFuzzingAttempt({ ...base, method: "GET", path: "/api/does-not-exist", statusCode: 404 }))
      .toEqual({ category: "PATH_PROBE", severity: "LOW" });
  });

  it("flags 422 and unattributed 400s as PARAM_TAMPERING", () => {
    expect(classifyFuzzingAttempt({ ...base, method: "GET", path: "/api/declarations", statusCode: 422 }))
      .toEqual({ category: "PARAM_TAMPERING", severity: "LOW" });
    // A 400 with no validation flag (e.g. malformed JSON body / bad query param).
    expect(classifyFuzzingAttempt({ ...base, method: "GET", path: "/api/declarations", statusCode: 400 }))
      .toEqual({ category: "PARAM_TAMPERING", severity: "LOW" });
  });

  it("does not flag normal successful traffic", () => {
    expect(classifyFuzzingAttempt({ ...base, method: "GET", path: "/api/declarations", statusCode: 200 }))
      .toBeNull();
    expect(classifyFuzzingAttempt({ ...base, method: "POST", path: "/api/declarations", statusCode: 201 }))
      .toBeNull();
    // 401 on a non-login endpoint is an auth gate, not fuzzing.
    expect(classifyFuzzingAttempt({ ...base, method: "GET", path: "/api/admin/users", statusCode: 401 }))
      .toBeNull();
  });

  it("prioritises suspicious path over a 404 status", () => {
    expect(classifyFuzzingAttempt({ ...base, method: "GET", path: "/.git/config", statusCode: 404, isApi: false }))
      .toEqual({ category: "SUSPICIOUS_PATH", severity: "HIGH" });
  });

  // --- scoping: authenticated users and content routes are not "fuzzing" -----

  it("does NOT flag an authenticated user's form/param errors (product friction)", () => {
    expect(
      classifyFuzzingAttempt({
        ...base,
        authenticated: true,
        method: "POST",
        path: "/api/declarations",
        statusCode: 400,
        validation: { validationFailed: true, fields: ["categoryId"] },
      }),
    ).toBeNull();
    expect(classifyFuzzingAttempt({ ...base, authenticated: true, method: "GET", path: "/api/declarations/abc", statusCode: 422 }))
      .toBeNull();
    expect(classifyFuzzingAttempt({ ...base, authenticated: true, method: "GET", path: "/api/does-not-exist", statusCode: 404 }))
      .toBeNull();
  });

  it("does NOT flag content-route 404s (broken links / stale bookmarks / assets)", () => {
    expect(classifyFuzzingAttempt({ ...base, method: "GET", path: "/old-page", statusCode: 404, isApi: false }))
      .toBeNull();
    expect(classifyFuzzingAttempt({ ...base, method: "GET", path: "/favicon-old.ico", statusCode: 404, isApi: false }))
      .toBeNull();
  });
});

describe("shouldPersistAttempt (rate gate)", () => {
  it("drops a single honest mistake", () => {
    expect(shouldPersistAttempt("LOW", 1)).toBe(false); // one stale-link 404
    expect(shouldPersistAttempt("MEDIUM", 1)).toBe(false); // one mistyped password
  });

  it("persists once an actor repeats past the per-severity threshold", () => {
    // MEDIUM (auth/form fuzzing) is higher-signal → lower threshold than LOW.
    expect(shouldPersistAttempt("MEDIUM", 2)).toBe(false);
    expect(shouldPersistAttempt("MEDIUM", 3)).toBe(true);
    expect(shouldPersistAttempt("LOW", 4)).toBe(false);
    expect(shouldPersistAttempt("LOW", 5)).toBe(true);
  });
});

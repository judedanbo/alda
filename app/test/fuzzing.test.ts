import { describe, it, expect } from "vitest";
import { classifyFuzzingAttempt } from "../server/utils/fuzzing";

describe("classifyFuzzingAttempt", () => {
  it("flags known suspicious paths as HIGH regardless of status", () => {
    expect(classifyFuzzingAttempt({ method: "GET", path: "/.env", statusCode: 404, isApi: false }))
      .toEqual({ category: "SUSPICIOUS_PATH", severity: "HIGH" });
    expect(classifyFuzzingAttempt({ method: "GET", path: "/wp-login.php", statusCode: 200, isApi: false }))
      .toEqual({ category: "SUSPICIOUS_PATH", severity: "HIGH" });
  });

  it("flags failed login probing as AUTH_FUZZING", () => {
    expect(classifyFuzzingAttempt({ method: "POST", path: "/api/auth/login", statusCode: 401, isApi: true }))
      .toEqual({ category: "AUTH_FUZZING", severity: "MEDIUM" });
    expect(classifyFuzzingAttempt({ method: "POST", path: "/api/auth/login", statusCode: 400, isApi: true }))
      .toEqual({ category: "AUTH_FUZZING", severity: "MEDIUM" });
  });

  it("flags malformed validated form submissions as FORM_VALIDATION", () => {
    expect(
      classifyFuzzingAttempt({
        method: "POST",
        path: "/api/declarations",
        statusCode: 400,
        isApi: true,
        validation: { validationFailed: true, fields: ["categoryId"] },
      }),
    ).toEqual({ category: "FORM_VALIDATION", severity: "MEDIUM" });
  });

  it("flags 404s as PATH_PROBE", () => {
    expect(classifyFuzzingAttempt({ method: "GET", path: "/does-not-exist", statusCode: 404, isApi: false }))
      .toEqual({ category: "PATH_PROBE", severity: "LOW" });
  });

  it("flags 422 and unattributed 400s as PARAM_TAMPERING", () => {
    expect(classifyFuzzingAttempt({ method: "GET", path: "/api/declarations", statusCode: 422, isApi: true }))
      .toEqual({ category: "PARAM_TAMPERING", severity: "LOW" });
    // A 400 with no validation flag (e.g. malformed JSON body / bad query param).
    expect(classifyFuzzingAttempt({ method: "GET", path: "/api/declarations", statusCode: 400, isApi: true }))
      .toEqual({ category: "PARAM_TAMPERING", severity: "LOW" });
  });

  it("does not flag normal successful traffic", () => {
    expect(classifyFuzzingAttempt({ method: "GET", path: "/api/declarations", statusCode: 200, isApi: true }))
      .toBeNull();
    expect(classifyFuzzingAttempt({ method: "POST", path: "/api/declarations", statusCode: 201, isApi: true }))
      .toBeNull();
    // 401 on a non-login endpoint is an auth gate, not fuzzing.
    expect(classifyFuzzingAttempt({ method: "GET", path: "/api/admin/users", statusCode: 401, isApi: true }))
      .toBeNull();
  });

  it("prioritises suspicious path over a 404 status", () => {
    expect(classifyFuzzingAttempt({ method: "GET", path: "/.git/config", statusCode: 404, isApi: false }))
      .toEqual({ category: "SUSPICIOUS_PATH", severity: "HIGH" });
  });
});

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * The middleware module reads `process.env.NODE_ENV` and
 * `process.env.SECURITY_CSP_ENFORCE` at request time. Each test toggles
 * those, then dynamically imports the handler so the inline globals
 * resolved against the test setup's stubs.
 */
async function loadHandler() {
  const mod = await import("~/server/middleware/01.security-headers");
  return mod.default as (event: unknown) => void;
}

/**
 * Minimal h3 event double: node.res.setHeader / getHeader / hasHeader are
 * exactly what `setResponseHeader` and `getResponseHeader` from h3 call into.
 */
function makeEvent() {
  const headers = new Map<string, string>();
  return {
    captured: headers,
    node: {
      req: { headers: {} },
      res: {
        setHeader(name: string, value: string | number | readonly string[]) {
          headers.set(name.toLowerCase(), String(value));
          return this;
        },
        getHeader(name: string) {
          return headers.get(name.toLowerCase());
        },
        hasHeader(name: string) {
          return headers.has(name.toLowerCase());
        },
      },
    },
  };
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_CSP_ENFORCE = process.env.SECURITY_CSP_ENFORCE;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_CSP_ENFORCE === undefined) delete process.env.SECURITY_CSP_ENFORCE;
  else process.env.SECURITY_CSP_ENFORCE = ORIGINAL_CSP_ENFORCE;
  vi.resetModules();
});

describe("security headers middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("always sets the bulletproof headers", async () => {
    process.env.NODE_ENV = "development";
    const handler = await loadHandler();
    const event = makeEvent();
    handler(event);
    expect(event.captured.get("x-frame-options")).toBe("DENY");
    expect(event.captured.get("x-content-type-options")).toBe("nosniff");
    expect(event.captured.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(event.captured.get("permissions-policy")).toContain("camera=()");
    expect(event.captured.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(event.captured.get("x-dns-prefetch-control")).toBe("off");
  });

  it("omits HSTS in development", async () => {
    process.env.NODE_ENV = "development";
    const handler = await loadHandler();
    const event = makeEvent();
    handler(event);
    expect(event.captured.has("strict-transport-security")).toBe(false);
  });

  it("sets HSTS only in production", async () => {
    process.env.NODE_ENV = "production";
    const handler = await loadHandler();
    const event = makeEvent();
    handler(event);
    expect(event.captured.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });

  it("sends CSP in report-only mode by default", async () => {
    delete process.env.SECURITY_CSP_ENFORCE;
    const handler = await loadHandler();
    const event = makeEvent();
    handler(event);
    expect(event.captured.has("content-security-policy-report-only")).toBe(true);
    expect(event.captured.has("content-security-policy")).toBe(false);
    const csp = event.captured.get("content-security-policy-report-only")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("switches to CSP enforce mode when SECURITY_CSP_ENFORCE=true", async () => {
    process.env.SECURITY_CSP_ENFORCE = "true";
    const handler = await loadHandler();
    const event = makeEvent();
    handler(event);
    expect(event.captured.has("content-security-policy")).toBe(true);
    expect(event.captured.has("content-security-policy-report-only")).toBe(false);
  });

  it("does not overwrite headers a handler set itself", async () => {
    const handler = await loadHandler();
    const event = makeEvent();
    // Pretend a previous handler already chose a stricter X-Frame-Options.
    event.node.res.setHeader("X-Frame-Options", "SAMEORIGIN");
    handler(event);
    expect(event.captured.get("x-frame-options")).toBe("SAMEORIGIN");
  });
});

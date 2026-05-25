import { describe, expect, it } from "vitest";
import type { H3Event } from "h3";

const { extractClientIp, normalizeIp } = await import("~/server/utils/request-meta");

/**
 * Builds a minimal h3-shaped event with a socket peer and any forwarding
 * headers we want to test against. Only the fields read by extractClientIp
 * are wired up.
 */
function mockEvent(opts: {
  socket?: string | null;
  xff?: string;
  xRealIp?: string;
}): H3Event {
  const headers: Record<string, string> = {};
  if (opts.xff !== undefined) headers["x-forwarded-for"] = opts.xff;
  if (opts.xRealIp !== undefined) headers["x-real-ip"] = opts.xRealIp;

  return {
    node: {
      req: {
        headers,
        socket: { remoteAddress: opts.socket ?? undefined },
      },
    },
  } as unknown as H3Event;
}

describe("normalizeIp", () => {
  it("unwraps IPv4-mapped IPv6", () => {
    expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
  });
  it("strips IPv6 zone IDs", () => {
    expect(normalizeIp("fe80::1%eth0")).toBe("fe80::1");
  });
  it("leaves plain IPv4 and IPv6 alone", () => {
    expect(normalizeIp("203.0.113.5")).toBe("203.0.113.5");
    expect(normalizeIp("2001:db8::1")).toBe("2001:db8::1");
  });
});

describe("extractClientIp", () => {
  it("returns 'unknown' when no socket peer and no headers", () => {
    expect(extractClientIp(mockEvent({ socket: null }), [])).toBe("unknown");
  });

  it("returns the normalized socket peer when no headers and trust list empty", () => {
    expect(
      extractClientIp(mockEvent({ socket: "203.0.113.5" }), []),
    ).toBe("203.0.113.5");
  });

  it("unwraps IPv4-mapped IPv6 socket peers", () => {
    expect(
      extractClientIp(mockEvent({ socket: "::ffff:1.2.3.4" }), []),
    ).toBe("1.2.3.4");
  });

  it("ignores X-Forwarded-For when the socket peer is not a trusted proxy", () => {
    // Regression for C-2: an attacker hitting the app directly cannot
    // impersonate someone else by sending a forwarding header.
    expect(
      extractClientIp(
        mockEvent({ socket: "203.0.113.5", xff: "9.9.9.9" }),
        ["10.0.0.0/8"],
      ),
    ).toBe("203.0.113.5");
  });

  it("honors X-Forwarded-For when the socket peer is a trusted proxy", () => {
    expect(
      extractClientIp(
        mockEvent({ socket: "10.0.0.5", xff: "198.51.100.7, 10.0.0.5" }),
        ["10.0.0.0/8"],
      ),
    ).toBe("198.51.100.7");
  });

  it("walks the chain right-to-left, ignoring a leftmost spoof", () => {
    // Chain: [attacker-spoof, real-client, proxy1]. Only proxy1 is trusted.
    // Right-to-left: drop proxy1 (trusted), stop at real-client (untrusted).
    expect(
      extractClientIp(
        mockEvent({
          socket: "10.0.0.5",
          xff: "1.2.3.4, 198.51.100.7, 10.0.0.5",
        }),
        ["10.0.0.0/8"],
      ),
    ).toBe("198.51.100.7");
  });

  it("falls back to X-Real-IP when the trusted peer sends no X-Forwarded-For", () => {
    expect(
      extractClientIp(
        mockEvent({ socket: "10.0.0.5", xRealIp: "203.0.113.42" }),
        ["10.0.0.0/8"],
      ),
    ).toBe("203.0.113.42");
  });

  it("matches IPv6 CIDRs", () => {
    expect(
      extractClientIp(
        mockEvent({ socket: "fc00::1", xff: "2001:db8::1, fc00::1" }),
        ["fc00::/7"],
      ),
    ).toBe("2001:db8::1");
  });
});

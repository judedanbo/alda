import { describe, it, expect } from "vitest";
import { resolveVisitorSession } from "../server/utils/sessionization";

let counter = 0;
const genId = () => `id-${++counter}`;

describe("resolveVisitorSession", () => {
  it("treats a request with no cookies as a new visitor and new session", () => {
    const r = resolveVisitorSession({ visitorCookie: null, sessionCookie: null, dnt: false }, genId);
    expect(r.isNewVisitor).toBe(true);
    expect(r.isNewSession).toBe(true);
    expect(r.visitorId).not.toBeNull();
    expect(r.setVisitorCookie).toBe(true);
    expect(r.setSessionCookie).toBe(true);
  });

  it("treats a request with existing cookies as returning", () => {
    const r = resolveVisitorSession({ visitorCookie: "vid-1", sessionCookie: "sid-1", dnt: false }, genId);
    expect(r.isNewVisitor).toBe(false);
    expect(r.isNewSession).toBe(false);
    expect(r.visitorId).toBe("vid-1");
    expect(r.sessionId).toBe("sid-1");
    expect(r.setVisitorCookie).toBe(false);
  });

  it("starts a new session for a returning visitor whose session expired", () => {
    const r = resolveVisitorSession({ visitorCookie: "vid-2", sessionCookie: null, dnt: false }, genId);
    expect(r.isNewVisitor).toBe(false);
    expect(r.isNewSession).toBe(true);
    expect(r.visitorId).toBe("vid-2");
  });

  it("suppresses the persistent visitor id under Do-Not-Track", () => {
    const r = resolveVisitorSession({ visitorCookie: null, sessionCookie: null, dnt: true }, genId);
    expect(r.visitorId).toBeNull();
    expect(r.isNewVisitor).toBe(false);
    expect(r.setVisitorCookie).toBe(false);
    // A session is still established for security/abuse correlation.
    expect(r.sessionId).not.toBeNull();
    expect(r.setSessionCookie).toBe(true);
  });

  it("always (re)writes the session cookie so its inactivity window rolls", () => {
    const r = resolveVisitorSession({ visitorCookie: "v", sessionCookie: "s", dnt: false }, genId);
    expect(r.setSessionCookie).toBe(true);
  });
});

import { randomUUID } from "node:crypto";

/**
 * Anonymous-visitor sessionization — pure decision logic, kept separate from
 * the traffic plugin so it is directly unit-testable.
 *
 * Two cookies are used (deliberately distinct from the auth `session_id`
 * cookie): a long-lived visitor id (`adla_vid`) for new-vs-returning, and a
 * rolling session id (`adla_sid`) whose inactivity window is refreshed on
 * every request. Under Do-Not-Track the persistent visitor id is suppressed.
 */

export interface SessionCookies {
  /** Existing `adla_vid` cookie value, or null. */
  visitorCookie: string | null;
  /** Existing `adla_sid` cookie value, or null. */
  sessionCookie: string | null;
  /** Client requested Do-Not-Track and the config honours it. */
  dnt: boolean;
}

export interface SessionResolution {
  /** Stable visitor id (null when suppressed by Do-Not-Track). */
  visitorId: string | null;
  /** Current session id — always present. */
  sessionId: string;
  isNewVisitor: boolean;
  isNewSession: boolean;
  /** Whether the caller should write the `adla_vid` cookie. */
  setVisitorCookie: boolean;
  /** Whether the caller should write/refresh the `adla_sid` cookie. */
  setSessionCookie: boolean;
}

/**
 * Resolves the visitor and session identity for a request from its existing
 * cookies. `genId` is injectable so tests can assert deterministically.
 */
export function resolveVisitorSession(
  cookies: SessionCookies,
  genId: () => string = randomUUID,
): SessionResolution {
  let visitorId: string | null = cookies.visitorCookie;
  let isNewVisitor = false;
  let setVisitorCookie = false;

  if (!visitorId) {
    if (cookies.dnt) {
      // Do-Not-Track: no persistent cross-visit identifier.
      visitorId = null;
    } else {
      visitorId = genId();
      isNewVisitor = true;
      setVisitorCookie = true;
    }
  }

  let sessionId = cookies.sessionCookie;
  let isNewSession = false;
  if (!sessionId) {
    sessionId = genId();
    isNewSession = true;
  }

  return {
    visitorId,
    sessionId,
    isNewVisitor,
    isNewSession,
    setVisitorCookie,
    // The session cookie is always (re)written so its inactivity window rolls.
    setSessionCookie: true,
  };
}

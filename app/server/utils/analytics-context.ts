import type { ParsedUserAgent } from "./user-agent";
import type { VisitorClassification, AiVerificationVerdict } from "./ai-agents";

/**
 * Per-request analytics state. Populated by the traffic plugin's `request`
 * hook (before any middleware runs) and consumed by the security middleware,
 * the per-user rate limiter and the `afterResponse` capture hook — so the
 * User-Agent is parsed and the visitor classified exactly once per request.
 */
export interface AnalyticsRequestContext {
  /** `Date.now()` at request start, for duration measurement. */
  startTime: number;
  /** True when the path is on the capture/enforcement deny list. */
  excluded: boolean;
  ip: string;
  ipHash: string;
  ipTruncated: string | null;
  country: string | null;
  requestId: string;
  visitorId: string | null;
  sessionId: string | null;
  isNewVisitor: boolean;
  isNewSession: boolean;
  /** Client requested Do-Not-Track and the config honours it. */
  dnt: boolean;
  ua: ParsedUserAgent;
  classification: VisitorClassification;
  /** AI declared-identity verdict, resolved from cache during the request. */
  aiVerified: AiVerificationVerdict | null;
}

/** Validation-failure metadata set by `validateBody`, read by the traffic
 * plugin to record a FORM_VALIDATION fuzzing attempt. Field NAMES only. */
export interface FuzzingRequestContext {
  validationFailed?: boolean;
  fields?: string[];
}

declare module "h3" {
  interface H3EventContext {
    analytics?: AnalyticsRequestContext;
    fuzzing?: FuzzingRequestContext;
  }
}

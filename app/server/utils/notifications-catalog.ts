import type { NotificationType } from "@prisma/client";

/**
 * Catalog of user-configurable notification preferences.
 *
 * `PASSWORD_RESET` and `EMAIL_VERIFICATION` are transactional/security
 * notifications: they are intentionally excluded here so they always send.
 */

export type NotificationViewMode = "category" | "type";

export interface NotificationCategory {
  key: string;
  label: string;
  description: string;
  types: NotificationType[];
}

const STAFF_ROLES = ["schedule_officer", "legal_unit", "admin"];

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: "declaration_progress",
    label: "Declaration progress",
    description: "Updates as your declaration moves through collection and submission.",
    types: ["UNIQUE_CODE_GENERATED", "FORM_COLLECTED", "FORM_RETURNED"],
  },
  {
    key: "review_receipt",
    label: "Review & receipt",
    description: "Review comments, approval decisions, and receipt availability.",
    types: ["SECTION_REVIEW_COMMENTS", "REVIEW_APPROVED", "REVIEW_REJECTED", "RECEIPT_READY"],
  },
  {
    key: "form_reissue",
    label: "Form reissue",
    description: "Progress on lost-form reissue requests.",
    types: ["FORM_REISSUE_REQUESTED", "FORM_REISSUE_APPROVED", "FORM_REISSUE_DECLINED"],
  },
  {
    key: "identity_verification",
    label: "Identity verification",
    description: "Status of your profile and Ghana Card verification.",
    types: [
      "VERIFICATION_SUBMITTED",
      "VERIFICATION_APPROVED",
      "VERIFICATION_REJECTED",
      "VERIFICATION_ON_HOLD",
      "VERIFICATION_MORE_INFO_REQUIRED",
    ],
  },
];

export const TYPE_LABELS: Record<string, string> = {
  UNIQUE_CODE_GENERATED: "Unique code generated",
  FORM_COLLECTED: "Form collected",
  FORM_RETURNED: "Form returned",
  SECTION_REVIEW_COMMENTS: "Section review comments",
  REVIEW_APPROVED: "Declaration approved",
  REVIEW_REJECTED: "Declaration rejected",
  RECEIPT_READY: "Receipt ready",
  FORM_REISSUE_REQUESTED: "Reissue request received",
  FORM_REISSUE_APPROVED: "Reissue approved",
  FORM_REISSUE_DECLINED: "Reissue declined",
  VERIFICATION_SUBMITTED: "Verification submitted",
  VERIFICATION_APPROVED: "Verification approved",
  VERIFICATION_REJECTED: "Verification rejected",
  VERIFICATION_ON_HOLD: "Verification on hold",
  VERIFICATION_MORE_INFO_REQUIRED: "More information required",
};

/** The user-controllable notification types, in catalog order. */
export const CONTROLLABLE_TYPES: NotificationType[] = NOTIFICATION_CATEGORIES.flatMap(
  (category) => category.types,
);

/** Staff see every type individually; everyone else sees grouped categories. */
export function getViewModeForRoles(roles: string[]): NotificationViewMode {
  return roles.some((role) => STAFF_ROLES.includes(role)) ? "type" : "category";
}

/** Types a given role is allowed to configure (same set for all roles today). */
export function getControllableTypesForRole(_roles: string[]): NotificationType[] {
  return CONTROLLABLE_TYPES;
}

interface ChannelFlags {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
}

// ============================================
// Default channel policy
// ============================================

/**
 * How a notification type uses the email channel by default:
 *  - `off`       — no email unless the user explicitly opts in
 *  - `immediate` — email sent as soon as the notification fires
 *  - `digest`    — email batched into the periodic summary (see
 *                  `server/tasks/notifications/digest.ts`)
 */
export type EmailMode = "off" | "immediate" | "digest";

export interface ChannelPolicy {
  email: EmailMode;
  /** Whether SMS is on by default. In-app is always on. */
  sms: boolean;
}

/**
 * Per-type default channel policy — the single source of truth for which
 * channels a notification uses when the user has not overridden it. SMS is
 * reserved for the few time-critical, action-required events; low-urgency
 * confirmations are batched into the email digest.
 */
export const DEFAULT_CHANNEL_POLICY: Record<NotificationType, ChannelPolicy> = {
  UNIQUE_CODE_GENERATED: { email: "immediate", sms: true },
  FORM_COLLECTED: { email: "immediate", sms: false },
  FORM_RETURNED: { email: "digest", sms: false },
  SECTION_REVIEW_COMMENTS: { email: "immediate", sms: false },
  REVIEW_APPROVED: { email: "immediate", sms: false },
  REVIEW_REJECTED: { email: "immediate", sms: true },
  RECEIPT_READY: { email: "immediate", sms: true },
  FORM_REISSUE_REQUESTED: { email: "off", sms: false },
  FORM_REISSUE_APPROVED: { email: "immediate", sms: false },
  FORM_REISSUE_DECLINED: { email: "immediate", sms: false },
  VERIFICATION_SUBMITTED: { email: "digest", sms: false },
  VERIFICATION_APPROVED: { email: "immediate", sms: false },
  VERIFICATION_REJECTED: { email: "immediate", sms: false },
  VERIFICATION_ON_HOLD: { email: "immediate", sms: false },
  VERIFICATION_MORE_INFO_REQUIRED: { email: "immediate", sms: false },
  // Transactional/security types bypass sendNotification(); listed for completeness.
  PASSWORD_RESET: { email: "immediate", sms: false },
  EMAIL_VERIFICATION: { email: "immediate", sms: false },
};

const FALLBACK_POLICY: ChannelPolicy = { email: "immediate", sms: false };

/** The default channel policy for a type, with a safe fallback. */
export function getChannelPolicy(type: NotificationType): ChannelPolicy {
  return DEFAULT_CHANNEL_POLICY[type] ?? FALLBACK_POLICY;
}

/** The channel flags a user has for a type when they have never customised it. */
export function defaultFlagsForType(type: NotificationType): ChannelFlags {
  const policy = getChannelPolicy(type);
  return {
    emailEnabled: policy.email !== "off",
    smsEnabled: policy.sms,
    inAppEnabled: true,
  };
}

export interface ResolvedDelivery {
  inApp: boolean;
  email: boolean;
  emailMode: "immediate" | "digest";
  sms: boolean;
}

/**
 * Resolve which channels a notification should actually use, combining the
 * catalog default with the user's global and per-type preferences. A missing
 * global or per-type row falls back to the catalog default, never to "all on".
 */
export function resolveDelivery(
  type: NotificationType,
  globalPrefs: Partial<ChannelFlags> | null | undefined,
  typePref: Partial<ChannelFlags> | null | undefined,
): ResolvedDelivery {
  const policy = getChannelPolicy(type);

  const inApp =
    (globalPrefs?.inAppEnabled ?? true) && (typePref?.inAppEnabled ?? true);
  const email =
    (globalPrefs?.emailEnabled ?? true) &&
    (typePref?.emailEnabled ?? policy.email !== "off");
  const sms =
    (globalPrefs?.smsEnabled ?? true) && (typePref?.smsEnabled ?? policy.sms);

  return {
    inApp,
    email,
    emailMode: policy.email === "digest" ? "digest" : "immediate",
    sms,
  };
}

interface TypeRow extends ChannelFlags {
  type: NotificationType;
}

/**
 * Build the preferences payload returned by the GET/PATCH endpoints. The client
 * renders entirely from this, so no catalog constants need to be shared.
 */
export function buildPreferencesPayload(
  roles: string[],
  channels: ChannelFlags,
  typeRows: TypeRow[],
) {
  const rowByType = new Map(typeRows.map((row) => [row.type, row]));

  const typePreferences: Record<string, ChannelFlags> = {};
  for (const type of CONTROLLABLE_TYPES) {
    const row = rowByType.get(type);
    const defaults = defaultFlagsForType(type);
    typePreferences[type] = {
      emailEnabled: row?.emailEnabled ?? defaults.emailEnabled,
      smsEnabled: row?.smsEnabled ?? defaults.smsEnabled,
      inAppEnabled: row?.inAppEnabled ?? defaults.inAppEnabled,
    };
  }

  return {
    channels: {
      emailEnabled: channels.emailEnabled,
      smsEnabled: channels.smsEnabled,
      inAppEnabled: channels.inAppEnabled,
    },
    mode: getViewModeForRoles(roles),
    groups: NOTIFICATION_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      description: category.description,
      types: category.types.map((type) => ({
        type,
        label: TYPE_LABELS[type] ?? type,
        emailMode: getChannelPolicy(type).email,
      })),
    })),
    typePreferences,
  };
}

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
  PHONE_VERIFICATION_CODE: "Phone verification code",
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
    typePreferences[type] = {
      emailEnabled: row?.emailEnabled ?? true,
      smsEnabled: row?.smsEnabled ?? true,
      inAppEnabled: row?.inAppEnabled ?? true,
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
      types: category.types.map((type) => ({ type, label: TYPE_LABELS[type] ?? type })),
    })),
    typePreferences,
  };
}

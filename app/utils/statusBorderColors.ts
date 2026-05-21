const STATUS_BORDER: Record<string, string> = {
  // Declaration statuses
  CODE_GENERATED: "border-l-amber-400 dark:border-l-amber-500",
  FORM_COLLECTED: "border-l-cyan-400 dark:border-l-cyan-500",
  SUBMITTED: "border-l-blue-400 dark:border-l-blue-500",
  UNDER_REVIEW: "border-l-purple-400 dark:border-l-purple-500",
  APPROVED: "border-l-green-500 dark:border-l-green-400",
  REJECTED: "border-l-red-500 dark:border-l-red-400",
  SEALED: "border-l-emerald-500 dark:border-l-emerald-400",

  // User statuses (string form)
  active: "border-l-green-500 dark:border-l-green-400",
  inactive: "border-l-red-400 dark:border-l-red-500",

  // Boolean statuses (isActive coerced to string)
  true: "border-l-green-500 dark:border-l-green-400",
  false: "border-l-red-400 dark:border-l-red-500",

  // Audit actions
  LOGIN: "border-l-purple-400 dark:border-l-purple-500",
  LOGOUT: "border-l-gray-400 dark:border-l-gray-500",
  REGISTER: "border-l-green-500 dark:border-l-green-400",
  DECLARATION_CREATE: "border-l-green-500 dark:border-l-green-400",
  DECLARATION_SUBMIT: "border-l-blue-400 dark:border-l-blue-500",
  DECLARATION_APPROVE: "border-l-emerald-500 dark:border-l-emerald-400",
  DECLARATION_REJECT: "border-l-red-500 dark:border-l-red-400",
  USER_UPDATE: "border-l-blue-400 dark:border-l-blue-500",
  ROLE_ASSIGN: "border-l-purple-400 dark:border-l-purple-500",
};

const DEFAULT_BORDER = "border-l-gray-300 dark:border-l-gray-600";

export function getStatusBorderClass(status: string | null | undefined): string {
  if (!status) return DEFAULT_BORDER;
  return STATUS_BORDER[status] ?? DEFAULT_BORDER;
}

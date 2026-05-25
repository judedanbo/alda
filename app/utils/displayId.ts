export type IdType =
  | "GHANA_CARD"
  | "PASSPORT"
  | "VOTER_ID"
  | "DRIVERS_LICENSE"
  | "NIA_RECEIPT";

export type AltReason =
  | "PENDING_NIA_REGISTRATION"
  | "FOREIGN_NATIONAL"
  | "LOST_AWAITING_REISSUE"
  | "DAMAGED_AWAITING_REISSUE"
  | "OTHER";

export const ID_TYPE_LABEL: Record<IdType, string> = {
  GHANA_CARD: "Ghana Card",
  PASSPORT: "Passport",
  VOTER_ID: "Voter ID",
  DRIVERS_LICENSE: "Driver's Licence",
  NIA_RECEIPT: "NIA Registration Receipt",
};

export const ALT_REASON_LABEL: Record<AltReason, string> = {
  PENDING_NIA_REGISTRATION: "Pending NIA / Ghana Card registration",
  FOREIGN_NATIONAL: "Foreign national",
  LOST_AWAITING_REISSUE: "Card lost — awaiting reissue",
  DAMAGED_AWAITING_REISSUE: "Card damaged — awaiting reissue",
  OTHER: "Other (see details)",
};

export interface IdBearingProfile {
  idType?: IdType | string | null;
  ghanaCardNumber?: string | null;
  alternateIdNumber?: string | null;
}

export function displayId(p: IdBearingProfile): { label: string; value: string } {
  const type = (p.idType ?? "GHANA_CARD") as IdType;
  const label = ID_TYPE_LABEL[type] ?? "ID";
  const value =
    type === "GHANA_CARD"
      ? (p.ghanaCardNumber ?? "")
      : (p.alternateIdNumber ?? "");
  return { label, value };
}

export function altReasonLabel(reason?: AltReason | string | null): string {
  if (!reason) return "";
  return ALT_REASON_LABEL[reason as AltReason] ?? reason;
}

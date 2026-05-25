// Server-side mirror of app/utils/displayId.ts. Kept in sync so that
// Nitro routes (PDF, CSV, services) can render the same labels without
// reaching across the server/client bundle boundary.

export type IdType =
  | "GHANA_CARD"
  | "PASSPORT"
  | "VOTER_ID"
  | "DRIVERS_LICENSE"
  | "NIA_RECEIPT";

export const ID_TYPE_LABEL: Record<IdType, string> = {
  GHANA_CARD: "Ghana Card",
  PASSPORT: "Passport",
  VOTER_ID: "Voter ID",
  DRIVERS_LICENSE: "Driver's Licence",
  NIA_RECEIPT: "NIA Registration Receipt",
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

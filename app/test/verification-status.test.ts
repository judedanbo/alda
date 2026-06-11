import { describe, expect, it } from "vitest";
import type { VerificationStatus } from "@prisma/client";
import {
  canManageVerificationDocuments,
  canResubmitVerification,
} from "~/server/utils/verification";

const ALL_STATUSES: VerificationStatus[] = [
  "PENDING_VERIFICATION",
  "VERIFIED",
  "ON_HOLD",
  "MORE_INFO_REQUIRED",
  "REJECTED",
];

describe("canManageVerificationDocuments", () => {
  it("allows only MORE_INFO_REQUIRED", () => {
    for (const status of ALL_STATUSES) {
      expect(canManageVerificationDocuments(status)).toBe(status === "MORE_INFO_REQUIRED");
    }
  });
});

describe("canResubmitVerification", () => {
  it("allows REJECTED and MORE_INFO_REQUIRED only", () => {
    for (const status of ALL_STATUSES) {
      const expected = status === "REJECTED" || status === "MORE_INFO_REQUIRED";
      expect(canResubmitVerification(status)).toBe(expected);
    }
  });
});

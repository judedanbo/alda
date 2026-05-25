/**
 * Tests for the shared notification payload builders. Pure functions —
 * they construct title/message/metadata from inputs. No mocking needed.
 */
import { describe, expect, it } from "vitest";

const { payloads } = await import("~/server/notifications/payloads");

describe("payloads.uniqueCodeGenerated", () => {
  it("includes the code in the title and message", () => {
    const p = payloads.uniqueCodeGenerated({ uniqueCode: "ADLA-X1", name: "Jane" });
    expect(p.title).toContain("ADLA-X1");
    expect(p.message).toContain("ADLA-X1");
    expect(p.metadata).toEqual({ uniqueCode: "ADLA-X1", name: "Jane" });
  });
});

describe("payloads.formCollected", () => {
  it("references the collection office in the message", () => {
    const p = payloads.formCollected({
      uniqueCode: "ADLA-1",
      collectionOffice: "Accra Regional Office",
      declarationId: "d-1",
    });
    expect(p.message).toContain("Accra Regional Office");
    expect(p.message).toContain("ADLA-1");
    expect(p.metadata).toMatchObject({ declarationId: "d-1" });
  });
});

describe("payloads.declarationRejected", () => {
  it("uses a different title and message when a new code is issued", () => {
    const withCode = payloads.declarationRejected({
      uniqueCode: "ADLA-1",
      name: "Jane",
      reason: "missing assets",
      newCode: "ADLA-2",
    });
    expect(withCode.title).toBe("Declaration Requires Revision");
    expect(withCode.message).toContain("ADLA-2");
    expect(withCode.metadata.newCode).toBe("ADLA-2");

    const noCode = payloads.declarationRejected({
      uniqueCode: "ADLA-1",
      name: "Jane",
      reason: "missing assets",
    });
    expect(noCode.title).toBe("Declaration Rejected");
    expect(noCode.message).not.toContain("ADLA-2");
    expect(noCode.metadata).not.toHaveProperty("newCode");
  });
});

describe("payloads.receiptReady", () => {
  it("propagates optional declarationId and pdfUrl", () => {
    const p = payloads.receiptReady({
      uniqueCode: "ADLA-1",
      receiptNumber: "R-1",
      name: "Jane",
      declarationId: "d-1",
      pdfUrl: "https://example.com/r.pdf",
    });
    expect(p.metadata).toMatchObject({
      declarationId: "d-1",
      pdfUrl: "https://example.com/r.pdf",
    });
  });

  it("omits optional fields when not provided", () => {
    const p = payloads.receiptReady({
      uniqueCode: "ADLA-1",
      receiptNumber: "R-1",
      name: "Jane",
    });
    expect(p.metadata).not.toHaveProperty("declarationId");
    expect(p.metadata).not.toHaveProperty("pdfUrl");
  });
});

describe("payloads.verificationStatus", () => {
  it("returns distinct copy per status", () => {
    const verified = payloads.verificationStatus({
      status: "VERIFIED",
      name: "Jane",
      reason: "",
      dashboardUrl: "https://example.com/dash",
    });
    const onHold = payloads.verificationStatus({
      status: "ON_HOLD",
      name: "Jane",
      reason: "pending background check",
      dashboardUrl: "https://example.com/dash",
    });
    const moreInfo = payloads.verificationStatus({
      status: "MORE_INFO_REQUIRED",
      name: "Jane",
      reason: "fallback reason",
      messageToApplicant: "please upload back of Ghana Card",
      dashboardUrl: "https://example.com/dash",
    });

    expect(verified.title).toMatch(/Verified/);
    expect(onHold.title).toMatch(/Investigation/);
    expect(onHold.message).toContain("pending background check");
    // messageToApplicant wins over reason when present.
    expect(moreInfo.message).toContain("please upload back of Ghana Card");
    expect(moreInfo.message).not.toContain("fallback reason");
  });
});

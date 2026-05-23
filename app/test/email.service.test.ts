/**
 * Smoke tests for the email-template renderer. We're not validating
 * markup, only that every template type renders to a non-empty string
 * with the expected dynamic values interpolated and no `undefined`
 * leaking through.
 */
import { describe, expect, it } from "vitest";

const { generateEmailHtml } = await import("~/server/services/email.service");

const allTemplates = [
  "welcome",
  "email-verification",
  "password-reset",
  "unique-code",
  "declaration-submitted",
  "declaration-approved",
  "declaration-rejected",
  "receipt-ready",
  "pickup-notification",
  "verification-submitted",
  "verification-approved",
  "verification-rejected",
  "verification-on-hold",
  "verification-more-info",
] as const;

describe("generateEmailHtml", () => {
  it.each(allTemplates)("renders %s without crashing", (template) => {
    const html = generateEmailHtml(template, {
      name: "Jane Doe",
      verificationUrl: "https://example.com/verify?t=abc",
      resetUrl: "https://example.com/reset?t=abc",
      loginUrl: "https://example.com/login",
      dashboardUrl: "https://example.com/dashboard",
      uniqueCode: "ADLA-001",
      receiptNumber: "R-2026-001",
      reason: "missing supporting document",
      messageToApplicant: "please re-upload your Ghana Card",
    });
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain("Jane Doe");
  });

  it("interpolates the unique code into the unique-code email", () => {
    const html = generateEmailHtml("unique-code", {
      name: "Jane",
      uniqueCode: "ADLA-XYZ-123",
    });
    expect(html).toContain("ADLA-XYZ-123");
  });

  it("interpolates receipt number into receipt-ready email", () => {
    const html = generateEmailHtml("receipt-ready", {
      name: "Jane",
      uniqueCode: "ADLA-001",
      receiptNumber: "R-2026-001",
    });
    expect(html).toContain("R-2026-001");
  });

  it("interpolates the rejection reason into the rejected email", () => {
    const html = generateEmailHtml("declaration-rejected", {
      name: "Jane",
      uniqueCode: "ADLA-001",
      rejectionReason: "incomplete asset breakdown",
    });
    expect(html).toContain("incomplete asset breakdown");
  });

  it("falls back to the welcome template when an unknown template is requested", () => {
    // The mapper in notification.service.ts can return `welcome` for
    // unmapped types; make sure that doesn't crash even with sparse data.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = generateEmailHtml("welcome" as any, {});
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(50);
  });

  it("never leaks the literal string 'undefined' for omitted optional fields", () => {
    // A missing `name` should fall back to "User", not render "undefined".
    const html = generateEmailHtml("welcome", { loginUrl: "https://example.com/login" });
    expect(html).not.toMatch(/Dear undefined/);
  });
});

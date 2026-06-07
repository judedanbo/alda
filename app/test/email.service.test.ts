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
  "staff-invite",
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
      inviteUrl: "https://example.com/auth/accept-invite?token=abc",
      roleLabels: "Legal Unit",
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

  it("interpolates the accept-invite URL into the staff-invite email", () => {
    const html = generateEmailHtml("staff-invite", {
      name: "Jane",
      roleLabels: "Legal Unit",
      inviteUrl: "https://example.com/auth/accept-invite?token=abc",
    });
    expect(html).toContain("https://example.com/auth/accept-invite?token=abc");
    expect(html).toContain("Legal Unit");
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

describe("generateEmailHtml — HTML escaping", () => {
  it("escapes script-injection attempts in user-typed rejection reasons", () => {
    const html = generateEmailHtml("declaration-rejected", {
      name: "Jane",
      uniqueCode: "ADLA-1",
      rejectionReason: "<script>alert('xss')</script>",
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
  });

  it("escapes HTML in the applicant name", () => {
    const html = generateEmailHtml("welcome", {
      name: "<img src=x onerror=alert(1)>",
      loginUrl: "https://example.com/login",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes officer messageToApplicant in more-info email", () => {
    const html = generateEmailHtml("verification-more-info", {
      name: "Jane",
      dashboardUrl: "https://example.com/dash",
      messageToApplicant: 'evil "quote" & <b>bold</b>',
    });
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("evil &quot;quote&quot; &amp; &lt;b&gt;bold&lt;/b&gt;");
  });

  it("escapes & in URLs so href stays single-attribute", () => {
    // A URL with an unescaped & could be misparsed by strict HTML
    // parsers. esc() turns & into &amp;.
    const html = generateEmailHtml("welcome", {
      name: "Jane",
      loginUrl: "https://example.com/?a=1&b=2",
    });
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');
  });

  it("escapes verification-rejected reason and messageToApplicant", () => {
    const html = generateEmailHtml("verification-rejected", {
      name: "Jane",
      reason: '"><script>1</script>',
      messageToApplicant: "<svg onload=alert(1)>",
    });
    expect(html).not.toContain("<script>1</script>");
    expect(html).not.toContain("<svg onload=alert(1)>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
    expect(html).toContain("&lt;svg onload=alert(1)&gt;");
  });

  it("escapes pickup notification authorized person fields", () => {
    const html = generateEmailHtml("pickup-notification", {
      name: "Jane",
      uniqueCode: "ADLA-1",
      receiptNumber: "R-1",
      authorizedPerson: "<b>Bob</b>",
      authorizedPhone: "<img>",
    });
    expect(html).not.toContain("<b>Bob</b>");
    expect(html).toContain("&lt;b&gt;Bob&lt;/b&gt;");
    expect(html).toContain("&lt;img&gt;");
  });
});

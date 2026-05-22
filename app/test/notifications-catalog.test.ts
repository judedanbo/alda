import { describe, it, expect } from "vitest";
import {
  resolveDelivery,
  getChannelPolicy,
  defaultFlagsForType,
  CONTROLLABLE_TYPES,
} from "../server/utils/notifications-catalog";

describe("notification channel policy", () => {
  it("enables SMS by default only for the three critical action types", () => {
    const smsOn = CONTROLLABLE_TYPES.filter((t) => getChannelPolicy(t).sms).sort();
    expect(smsOn).toEqual(
      ["RECEIPT_READY", "REVIEW_REJECTED", "UNIQUE_CODE_GENERATED"].sort(),
    );
  });

  it("batches low-urgency confirmations into the email digest", () => {
    expect(getChannelPolicy("FORM_RETURNED").email).toBe("digest");
    expect(getChannelPolicy("VERIFICATION_SUBMITTED").email).toBe("digest");
  });

  it("keeps FORM_REISSUE_REQUESTED email off by default", () => {
    expect(defaultFlagsForType("FORM_REISSUE_REQUESTED").emailEnabled).toBe(false);
  });

  it("always defaults in-app notifications on", () => {
    for (const type of CONTROLLABLE_TYPES) {
      expect(defaultFlagsForType(type).inAppEnabled).toBe(true);
    }
  });
});

describe("resolveDelivery", () => {
  it("falls back to catalog defaults when the user has no preferences", () => {
    expect(resolveDelivery("UNIQUE_CODE_GENERATED", null, null)).toEqual({
      inApp: true,
      email: true,
      emailMode: "immediate",
      sms: true,
    });

    const collected = resolveDelivery("FORM_COLLECTED", null, null);
    expect(collected.email).toBe(true);
    expect(collected.sms).toBe(false);

    expect(resolveDelivery("FORM_RETURNED", null, null).emailMode).toBe("digest");
  });

  it("respects the global channel master switch", () => {
    const prefs = { emailEnabled: false, smsEnabled: false, inAppEnabled: true };
    const r = resolveDelivery("UNIQUE_CODE_GENERATED", prefs, null);
    expect(r.email).toBe(false);
    expect(r.sms).toBe(false);
    expect(r.inApp).toBe(true);
  });

  it("lets a per-type override turn a default-off channel on", () => {
    const typePref = { emailEnabled: true, smsEnabled: true, inAppEnabled: true };
    expect(resolveDelivery("FORM_COLLECTED", null, typePref).sms).toBe(true);
  });

  it("lets a per-type override turn a default-on channel off", () => {
    const typePref = { emailEnabled: true, smsEnabled: false, inAppEnabled: true };
    expect(resolveDelivery("UNIQUE_CODE_GENERATED", null, typePref).sms).toBe(false);
  });

  it("global off overrides a per-type on", () => {
    const prefs = { emailEnabled: false, smsEnabled: false, inAppEnabled: true };
    const typePref = { emailEnabled: true, smsEnabled: true, inAppEnabled: true };
    const r = resolveDelivery("FORM_COLLECTED", prefs, typePref);
    expect(r.email).toBe(false);
    expect(r.sms).toBe(false);
  });
});

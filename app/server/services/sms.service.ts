/**
 * SMS Service
 * Routes Ghana numbers through Hubtel / Arkesel (local providers) and
 * any other country code through Twilio, when configured.
 */
import { isGhanaPhone, normalizePhoneE164 } from "~/server/utils/phone";
import { getResolvedSmsConfig, type ResolvedSmsConfig } from "~/server/utils/notification-config";

export type SmsProvider = "hubtel" | "arkesel" | "twilio";
type GhanaProvider = Extract<SmsProvider, "hubtel" | "arkesel">;

// Resolved SMS config (in-app DB override → env fallback). Sub-objects are
// always present; the per-provider send fns still guard on empty credentials.
type SmsConfig = ResolvedSmsConfig;

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** Which provider actually delivered the message (set on success). */
  provider?: SmsProvider;
}

/**
 * Format Ghana phone number to international format
 */
export function formatGhanaPhone(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, "");

  // If starts with 0, replace with 233
  if (digits.startsWith("0")) {
    digits = "233" + digits.slice(1);
  }

  // If doesn't start with 233, add it
  if (!digits.startsWith("233")) {
    digits = "233" + digits;
  }

  return digits;
}

/**
 * Validate Ghana phone number
 */
export function isValidGhanaPhone(phone: string): boolean {
  const formatted = formatGhanaPhone(phone);
  // Ghana numbers: 233 + 9 digits (total 12)
  return /^233[2-9]\d{8}$/.test(formatted);
}

/**
 * Send SMS via Hubtel
 */
async function sendViaHubtel(
  to: string,
  message: string,
  config: SmsConfig["hubtel"]
): Promise<SmsResult> {
  if (!config?.clientId || !config?.clientSecret) {
    console.log("[SMS-DEV] Hubtel not configured, message:", message, "to:", to);
    return { success: true, messageId: "dev-" + Date.now() };
  }

  try {
    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

    const response = await fetch("https://smsc.hubtel.com/v1/messages/send", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        From: config.senderId,
        To: formatGhanaPhone(to),
        Content: message,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, messageId: data.MessageId };
    } else {
      return { success: false, error: data.Message || "Failed to send SMS" };
    }
  } catch (error) {
    console.error("Hubtel SMS error:", error);
    return { success: false, error: "Failed to connect to SMS provider" };
  }
}

/**
 * Send SMS via Arkesel
 */
async function sendViaArkesel(
  to: string,
  message: string,
  config: SmsConfig["arkesel"]
): Promise<SmsResult> {
  if (!config?.apiKey) {
    console.log("[SMS-DEV] Arkesel not configured, message:", message, "to:", to);
    return { success: true, messageId: "dev-" + Date.now() };
  }

  try {
    const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: config.senderId,
        recipients: [formatGhanaPhone(to)],
        message,
      }),
    });

    const data = await response.json();

    if (data.status === "success") {
      return { success: true, messageId: data.data?.[0]?.id };
    } else {
      return { success: false, error: data.message || "Failed to send SMS" };
    }
  } catch (error) {
    console.error("Arkesel SMS error:", error);
    return { success: false, error: "Failed to connect to SMS provider" };
  }
}

/**
 * Send SMS via Twilio. Used for any destination not on the +233 country
 * code. Twilio requires fully-qualified E.164 (with leading `+`), so we
 * pass the normalized number through directly rather than the Ghana-
 * specific `formatGhanaPhone()` (which drops the `+`).
 */
async function sendViaTwilio(
  toE164: string,
  message: string,
  config: SmsConfig["twilio"],
): Promise<SmsResult> {
  if (!config?.accountSid || !config?.authToken || !config?.fromNumber) {
    console.log("[SMS-DEV] Twilio not configured, message:", message, "to:", toE164);
    return { success: true, messageId: "dev-twilio-" + Date.now() };
  }

  try {
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
    const body = new URLSearchParams({
      To: toE164,
      From: config.fromNumber,
      Body: message,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );

    const data = await response.json() as { sid?: string; message?: string };

    if (response.ok) {
      return { success: true, messageId: data.sid };
    }
    return { success: false, error: data.message || "Failed to send SMS" };
  } catch (error) {
    console.error("Twilio SMS error:", error);
    return { success: false, error: "Failed to connect to SMS provider" };
  }
}

/**
 * Send SMS message. Routes by destination:
 *   - +233 → tries the configured Ghana provider, falls back to the
 *     other Ghana provider once.
 *   - any other E.164 → Twilio (if configured).
 *
 * Returns the provider that actually delivered so it can be recorded in
 * NotificationDeliveryLog.providerResponse.
 */
export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const normalized = normalizePhoneE164(to);
  if (!normalized) {
    return { success: false, error: "Invalid phone number" };
  }

  const config = await getResolvedSmsConfig();

  if (isGhanaPhone(normalized)) {
    const order = providerOrder(config.provider);
    let lastError: string | undefined;
    for (const provider of order) {
      const result = await sendVia(provider, normalized, message, config);
      if (result.success) {
        return { ...result, provider };
      }
      lastError = result.error;
      // Only attempt a fallback if the other provider is actually
      // configured — otherwise we'd just hit the dev-mode mock and report
      // a misleading success.
      if (!isConfigured(otherProvider(provider), config)) break;
    }
    return { success: false, error: lastError ?? "All SMS providers failed" };
  }

  // International — Twilio only.
  if (!isTwilioConfigured(config) && process.env.NODE_ENV === "production") {
    return {
      success: false,
      error: "No SMS provider configured for this destination country",
    };
  }
  const result = await sendViaTwilio(normalized, message, config.twilio);
  return result.success ? { ...result, provider: "twilio" } : result;
}

function providerOrder(primary: GhanaProvider): GhanaProvider[] {
  return primary === "hubtel" ? ["hubtel", "arkesel"] : ["arkesel", "hubtel"];
}

function otherProvider(p: GhanaProvider): GhanaProvider {
  return p === "hubtel" ? "arkesel" : "hubtel";
}

function isConfigured(p: GhanaProvider, config: SmsConfig): boolean {
  if (p === "hubtel") return !!(config.hubtel?.clientId && config.hubtel?.clientSecret);
  return !!config.arkesel?.apiKey;
}

function isTwilioConfigured(config: SmsConfig): boolean {
  return !!(config.twilio?.accountSid && config.twilio?.authToken && config.twilio?.fromNumber);
}

function sendVia(
  provider: GhanaProvider,
  to: string,
  message: string,
  config: SmsConfig,
): Promise<SmsResult> {
  if (provider === "hubtel") return sendViaHubtel(to, message, config.hubtel);
  return sendViaArkesel(to, message, config.arkesel);
}


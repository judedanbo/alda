/**
 * SMS Service for Ghana
 * Supports Hubtel and Arkesel SMS providers
 */
import { BRAND, DEFAULT_SMS_SENDER_ID } from "~/server/utils/branding";

export type SmsProvider = "hubtel" | "arkesel";

interface SmsConfig {
  provider: SmsProvider;
  hubtel?: {
    clientId: string;
    clientSecret: string;
    senderId: string;
  };
  arkesel?: {
    apiKey: string;
    senderId: string;
  };
}

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** Which provider actually delivered the message (set on success). */
  provider?: SmsProvider;
}

/**
 * Get SMS configuration from runtime config
 */
function getSmsConfig(): SmsConfig {
  const _config = useRuntimeConfig();

  // Default to a mock provider in development
  const provider = (process.env.SMS_PROVIDER as SmsProvider) || "hubtel";

  return {
    provider,
    hubtel: {
      clientId: process.env.HUBTEL_CLIENT_ID || "",
      clientSecret: process.env.HUBTEL_CLIENT_SECRET || "",
      senderId: process.env.HUBTEL_SENDER_ID || DEFAULT_SMS_SENDER_ID,
    },
    arkesel: {
      apiKey: process.env.ARKESEL_API_KEY || "",
      senderId: process.env.ARKESEL_SENDER_ID || DEFAULT_SMS_SENDER_ID,
    },
  };
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
 * Send SMS message. Tries the configured primary provider, and on
 * failure falls back to the other once. The result includes which
 * provider actually delivered so it can be recorded in
 * NotificationDeliveryLog.providerResponse.
 */
export async function sendSms(to: string, message: string): Promise<SmsResult> {
  if (!isValidGhanaPhone(to)) {
    return { success: false, error: "Invalid Ghana phone number" };
  }

  const config = getSmsConfig();
  const order = providerOrder(config.provider);

  let lastError: string | undefined;
  for (const provider of order) {
    const result = await sendVia(provider, to, message, config);
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

function providerOrder(primary: SmsProvider): SmsProvider[] {
  return primary === "hubtel" ? ["hubtel", "arkesel"] : ["arkesel", "hubtel"];
}

function otherProvider(p: SmsProvider): SmsProvider {
  return p === "hubtel" ? "arkesel" : "hubtel";
}

function isConfigured(p: SmsProvider, config: SmsConfig): boolean {
  if (p === "hubtel") return !!(config.hubtel?.clientId && config.hubtel?.clientSecret);
  return !!config.arkesel?.apiKey;
}

function sendVia(
  provider: SmsProvider,
  to: string,
  message: string,
  config: SmsConfig,
): Promise<SmsResult> {
  if (provider === "hubtel") return sendViaHubtel(to, message, config.hubtel);
  return sendViaArkesel(to, message, config.arkesel);
}

/**
 * SMS Templates
 */
export const SmsTemplates = {
  uniqueCode: (code: string) =>
    `Your ${BRAND.shortName} Declaration Code is: ${code}. Keep this code safe for tracking your declaration status.`,

  declarationSubmitted: (code: string) =>
    `Your asset declaration (${code}) has been submitted for review. You will be notified when a decision is made.`,

  declarationApproved: (code: string) =>
    `Congratulations! Your declaration (${code}) has been approved. Your receipt is ready for collection.`,

  declarationRejected: (code: string) =>
    `Your declaration (${code}) requires attention. Please log in to your account for details.`,

  pickupReady: (code: string) =>
    `Your sealed declaration document (${code}) is ready for pickup. Bring your Ghana Card for identification.`,

  otp: (otp: string) =>
    `Your ${BRAND.shortName} verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
};

/**
 * Send unique code SMS
 */
export async function sendUniqueCodeSms(phone: string, code: string): Promise<SmsResult> {
  return sendSms(phone, SmsTemplates.uniqueCode(code));
}

/**
 * Send declaration status SMS
 */
export async function sendDeclarationStatusSms(
  phone: string,
  status: "submitted" | "approved" | "rejected",
  code: string
): Promise<SmsResult> {
  const templates = {
    submitted: SmsTemplates.declarationSubmitted,
    approved: SmsTemplates.declarationApproved,
    rejected: SmsTemplates.declarationRejected,
  };

  return sendSms(phone, templates[status](code));
}

/**
 * Send pickup notification SMS
 */
export async function sendPickupSms(phone: string, code: string): Promise<SmsResult> {
  return sendSms(phone, SmsTemplates.pickupReady(code));
}

/**
 * Shared helpers for SMS provider delivery-status webhooks.
 *
 * Both Hubtel and Arkesel can POST delivery receipts to us when a
 * carrier confirms (or fails to confirm) message delivery. The handlers
 * map the provider-specific payload to a DeliveryStatus and flip the
 * corresponding NotificationDeliveryLog.
 *
 * Authenticated via a shared secret in either the `x-webhook-secret`
 * header or a `secret` query string — kept simple because both
 * providers' webhook configs offer one of these but not a full HMAC.
 * Set NOTIFICATIONS_SMS_WEBHOOK_SECRET in production. Comparison is
 * done with `timingSafeEqual` so an attacker can't byte-by-byte guess
 * the secret from response timing.
 */
import { timingSafeEqual } from "node:crypto";
import type { H3Event } from "h3";
import prisma from "~/server/utils/prisma";
import { getCredential } from "~/server/utils/notification-config";
import type { DeliveryStatus, Prisma } from "@prisma/client";

/** Resolved webhook secret: in-app DB override → NOTIFICATIONS_SMS_WEBHOOK_SECRET env. */
export async function getWebhookSecret(): Promise<string | null> {
  const v = await getCredential("sms.webhookSecret");
  return v ? v : null;
}

/**
 * Constant-time string comparison. Returns false on length mismatch
 * without leaking length difference through timing.
 */
function safeEqual(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Compares the request's claimed secret to the configured one.
 *
 * - In production: the secret MUST be configured (the C-1 startup gate
 *   already refuses to boot otherwise). If it ever isn't, refuse the
 *   webhook rather than accepting anonymous deliveries. M-3 from
 *   docs/security-assessment.md.
 * - In dev / test: missing secret accepts any caller, so the SMS-provider
 *   localhost callback doesn't need a copy of the production key.
 */
export async function verifyWebhookSecret(event: H3Event): Promise<boolean> {
  const configured = await getWebhookSecret();
  if (!configured) {
    // Production deploys without the secret set: explicitly refuse, even
    // though the C-1 gate should have prevented startup. Defence in depth.
    if (process.env.NODE_ENV === "production") return false;
    return true; // dev / test only
  }
  const headerSecret = getHeader(event, "x-webhook-secret");
  const query = getQuery(event);
  const querySecret = typeof query.secret === "string" ? query.secret : undefined;
  return safeEqual(headerSecret, configured) || safeEqual(querySecret, configured);
}

/**
 * Find the NotificationDeliveryLog associated with a provider message id.
 * Walks `providerResponse->messageId` because we stored it there during
 * the original send.
 */
export async function findLogByMessageId(messageId: string): Promise<{ id: string } | null> {
  // Prisma JSON filtering — find a SMS log whose providerResponse JSON
  // has `messageId` equal to the carrier id.
  const log = await prisma.notificationDeliveryLog.findFirst({
    where: {
      channel: "SMS",
      providerResponse: { path: ["messageId"], equals: messageId },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  return log;
}

export async function applyDeliveryUpdate(
  logId: string,
  status: DeliveryStatus,
  rawProviderPayload: unknown,
): Promise<void> {
  await prisma.notificationDeliveryLog.update({
    where: { id: logId },
    data: {
      status,
      deliveredAt: status === "DELIVERED" ? new Date() : null,
      providerResponse: { webhook: rawProviderPayload as Prisma.InputJsonValue },
    },
  });
}

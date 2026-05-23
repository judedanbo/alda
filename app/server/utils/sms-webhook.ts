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
import type { DeliveryStatus } from "@prisma/client";

export function getWebhookSecret(): string | null {
  return process.env.NOTIFICATIONS_SMS_WEBHOOK_SECRET || null;
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
 * Compares the request's claimed secret to the configured one. Returns
 * true when no secret is configured (dev-friendly), false on mismatch.
 */
export function verifyWebhookSecret(event: H3Event): boolean {
  const configured = getWebhookSecret();
  if (!configured) return true; // dev: accept; production should set the env var
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
  const data: {
    status: DeliveryStatus;
    deliveredAt: Date | null;
    providerResponse: { webhook: unknown };
  } = {
    status,
    deliveredAt: status === "DELIVERED" ? new Date() : null,
    providerResponse: { webhook: rawProviderPayload },
  };
  await prisma.notificationDeliveryLog.update({
    where: { id: logId },
    data,
  });
}

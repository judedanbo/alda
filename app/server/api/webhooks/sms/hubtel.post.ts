/**
 * Hubtel SMS delivery callback.
 *
 * Hubtel POSTs a JSON body roughly like:
 *   { MessageId, Status, NetworkCode, To, ... }
 * Where Status is a string ("Delivered", "Failed", "Pending", etc.).
 *
 * Configure the webhook URL in the Hubtel dashboard with the shared
 * secret as a query parameter, e.g.:
 *   https://adla.example.com/api/webhooks/sms/hubtel?secret=...
 */
import {
  applyDeliveryUpdate,
  findLogByMessageId,
  verifyWebhookSecret,
} from "~/server/utils/sms-webhook";
import { logAudit, AuditActions } from "~/server/utils/audit";

interface HubtelCallback {
  MessageId?: string;
  Status?: string;
  [key: string]: unknown;
}

function mapHubtelStatus(status: string | undefined): "DELIVERED" | "FAILED" | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "delivered") return "DELIVERED";
  if (s === "failed" || s === "undelivered" || s === "rejected") return "FAILED";
  return null; // pending / other intermediate states — ignore
}

export default defineEventHandler(async (event) => {
  if (!(await verifyWebhookSecret(event))) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = (await readBody<HubtelCallback>(event)) ?? {};
  const status = mapHubtelStatus(body.Status);
  if (!body.MessageId || !status) {
    // Intermediate / unknown status: ack so Hubtel doesn't retry.
    return { ok: true, ignored: true };
  }

  const log = await findLogByMessageId(body.MessageId);
  if (!log) {
    console.warn("[sms-webhook:hubtel] no log found for messageId", body.MessageId);
    return { ok: true, found: false };
  }

  await applyDeliveryUpdate(log.id, status, body);

  // Audit the provider-driven delivery-status change. No userId — this is an
  // unauthenticated (secret-gated) inbound webhook.
  logAudit(event, {
    action: AuditActions.SMS_DELIVERY_UPDATED,
    entityType: "notification_delivery_log",
    entityId: log.id,
    newValues: { provider: "hubtel", messageId: body.MessageId, status },
  });

  return { ok: true, found: true, status };
});

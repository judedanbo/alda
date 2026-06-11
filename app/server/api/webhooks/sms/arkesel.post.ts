/**
 * Arkesel SMS delivery callback.
 *
 * Arkesel POSTs a JSON body roughly like:
 *   { id, status, recipient, sender, ... }
 * Where status is "DELIVERED" | "FAILED" | "PENDING" (uppercase).
 *
 * Configure the callback URL in the Arkesel dashboard with the shared
 * secret as a query parameter:
 *   https://adla.example.com/api/webhooks/sms/arkesel?secret=...
 */
import {
  applyDeliveryUpdate,
  findLogByMessageId,
  verifyWebhookSecret,
} from "~/server/utils/sms-webhook";
import { logAudit, AuditActions } from "~/server/utils/audit";

interface ArkeselCallback {
  id?: string;
  status?: string;
  [key: string]: unknown;
}

function mapArkeselStatus(status: string | undefined): "DELIVERED" | "FAILED" | null {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === "DELIVERED") return "DELIVERED";
  if (s === "FAILED" || s === "REJECTED" || s === "EXPIRED") return "FAILED";
  return null;
}

export default defineEventHandler(async (event) => {
  if (!(await verifyWebhookSecret(event))) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = (await readBody<ArkeselCallback>(event)) ?? {};
  const status = mapArkeselStatus(body.status);
  if (!body.id || !status) {
    return { ok: true, ignored: true };
  }

  const log = await findLogByMessageId(body.id);
  if (!log) {
    console.warn("[sms-webhook:arkesel] no log found for messageId", body.id);
    return { ok: true, found: false };
  }

  await applyDeliveryUpdate(log.id, status, body);

  // Audit the provider-driven delivery-status change. No userId — this is an
  // unauthenticated (secret-gated) inbound webhook.
  logAudit(event, {
    action: AuditActions.SMS_DELIVERY_UPDATED,
    entityType: "notification_delivery_log",
    entityId: log.id,
    newValues: { provider: "arkesel", messageId: body.id, status },
  });

  return { ok: true, found: true, status };
});

import prisma from "~/server/utils/prisma";
import { requireAdmin } from "~/server/utils/analytics-query";
import { validateBody, analyticsActorRuleSchema } from "~/server/utils/validators";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { clearEnforcement } from "~/server/utils/abuse";
import { getAnalyticsConfig } from "~/server/utils/analytics-config";
import { hashIp } from "~/server/utils/request-meta";
import {
  getAnalyticsStorage,
  StorageKeys,
  safeSet,
  safeRemove,
} from "~/server/utils/analytics-storage";

/**
 * Manual enforcement controls for admins: block, allow-list or unblock a
 * client IP. Each action updates both the durable `ActorAccessRule` row and
 * the storage fast-path key read by the security middleware, and records an
 * audit-log entry so it surfaces on `/admin/audit-logs`.
 *
 * `actorValue` is an exact IP — the security middleware matches keys exactly.
 */

export default defineEventHandler(async (event) => {
  const auth = requireAdmin(event);
  const { action, ip, reason, expiresInMinutes } = await validateBody(event, analyticsActorRuleSchema);

  const storage = getAnalyticsStorage();
  const expiresAt = expiresInMinutes ? new Date(Date.now() + expiresInMinutes * 60_000) : null;
  const ttl = expiresInMinutes ? expiresInMinutes * 60 : undefined;

  if (action === "block") {
    await prisma.actorAccessRule.upsert({
      where: { actorType_actorValue_ruleType: { actorType: "IP", actorValue: ip, ruleType: "BLOCK" } },
      create: {
        actorType: "IP",
        actorValue: ip,
        ruleType: "BLOCK",
        reason: reason ?? "Manually blocked by administrator",
        createdById: auth.userId,
        expiresAt,
      },
      update: { active: true, reason: reason ?? "Manually blocked by administrator", expiresAt },
    });
    // Drop any conflicting allow rule.
    await prisma.actorAccessRule.updateMany({
      where: { actorType: "IP", actorValue: ip, ruleType: "ALLOW", active: true },
      data: { active: false },
    });
    await safeRemove(storage, StorageKeys.allow("ip", ip));
    await safeSet(storage, StorageKeys.block("ip", ip), { reason: reason ?? "manual" }, ttl);

    await createAuditLog(event, {
      userId: auth.userId,
      action: AuditActions.ACTOR_MANUALLY_BLOCKED,
      entityType: "actor_access_rule",
      entityId: ip,
      newValues: { ip, reason, expiresAt: expiresAt?.toISOString() ?? null },
    });
    return { success: true, message: `IP ${ip} blocked` };
  }

  if (action === "allow") {
    await prisma.actorAccessRule.upsert({
      where: { actorType_actorValue_ruleType: { actorType: "IP", actorValue: ip, ruleType: "ALLOW" } },
      create: {
        actorType: "IP",
        actorValue: ip,
        ruleType: "ALLOW",
        reason: reason ?? "Manually allow-listed by administrator",
        createdById: auth.userId,
        expiresAt,
      },
      update: { active: true, reason: reason ?? "Manually allow-listed by administrator", expiresAt },
    });
    // Drop any conflicting block rule + enforcement.
    await prisma.actorAccessRule.updateMany({
      where: { actorType: "IP", actorValue: ip, ruleType: "BLOCK", active: true },
      data: { active: false },
    });
    await safeRemove(storage, StorageKeys.block("ip", ip));
    await clearEnforcement(storage, ip);
    await safeSet(storage, StorageKeys.allow("ip", ip), { reason: reason ?? "manual" }, ttl);

    await createAuditLog(event, {
      userId: auth.userId,
      action: AuditActions.ACTOR_MANUALLY_ALLOWED,
      entityType: "actor_access_rule",
      entityId: ip,
      newValues: { ip, reason, expiresAt: expiresAt?.toISOString() ?? null },
    });
    return { success: true, message: `IP ${ip} added to allow list` };
  }

  // action === "unblock"
  await prisma.actorAccessRule.updateMany({
    where: { actorType: "IP", actorValue: ip, ruleType: "BLOCK", active: true },
    data: { active: false },
  });
  await safeRemove(storage, StorageKeys.block("ip", ip));
  await clearEnforcement(storage, ip);
  // System enforcement rows key on the hashed IP — deactivate those too.
  await prisma.enforcementAction.updateMany({
    where: {
      actorType: "IP",
      actorKey: hashIp(ip, getAnalyticsConfig().ipSalt),
      active: true,
    },
    data: { active: false },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.ACTOR_MANUALLY_UNBLOCKED,
    entityType: "actor_access_rule",
    entityId: ip,
    newValues: { ip, reason },
  });
  return { success: true, message: `IP ${ip} unblocked` };
});

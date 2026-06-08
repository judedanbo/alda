<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotificationStore } from "~/stores/notifications";

const notificationStore = useNotificationStore();

const TYPES = [
  { value: "UNIQUE_CODE_GENERATED", label: "Unique code generated" },
  { value: "FORM_COLLECTED", label: "Form collected" },
  { value: "FORM_RETURNED", label: "Form returned (declaration submitted)" },
  { value: "SECTION_REVIEW_COMMENTS", label: "Section review comments" },
  { value: "REVIEW_APPROVED", label: "Declaration approved" },
  { value: "REVIEW_REJECTED", label: "Declaration rejected" },
  { value: "RECEIPT_READY", label: "Receipt ready" },
  { value: "FORM_REISSUE_REQUESTED", label: "Reissue request received" },
  { value: "FORM_REISSUE_APPROVED", label: "Reissue approved" },
  { value: "FORM_REISSUE_DECLINED", label: "Reissue declined" },
  { value: "VERIFICATION_SUBMITTED", label: "Verification submitted" },
  { value: "VERIFICATION_APPROVED", label: "Verification approved" },
  { value: "VERIFICATION_REJECTED", label: "Verification rejected" },
  { value: "VERIFICATION_ON_HOLD", label: "Verification on hold" },
  { value: "VERIFICATION_MORE_INFO_REQUIRED", label: "More info required" },
  { value: "PASSWORD_RESET", label: "Password reset (transactional)" },
  { value: "EMAIL_VERIFICATION", label: "Email verification (transactional)" },
];

const selectedType = ref("REVIEW_APPROVED");
const targetUserId = ref("");
const channels = reactive({ email: true, sms: true, inApp: true });
const sending = ref(false);
const result = ref<{ ok: boolean; message: string } | null>(null);

async function send() {
  sending.value = true;
  result.value = null;
  try {
    const selected = (
      [
        channels.email ? "EMAIL" : null,
        channels.sms ? "SMS" : null,
        channels.inApp ? "IN_APP" : null,
      ].filter(Boolean) as ("EMAIL" | "SMS" | "IN_APP")[]
    );

    const response = await authFetch<{ success: boolean; message: string }>(
      "/api/admin/notifications/test",
      {
        method: "POST",
        body: {
          type: selectedType.value,
          ...(targetUserId.value ? { targetUserId: targetUserId.value } : {}),
          ...(selected.length > 0 ? { channels: selected } : {}),
        },
      },
    );
    result.value = { ok: true, message: response.message };

    // If the test included the in-app channel and went to the current admin
    // (no explicit target = send to self), force an immediate bell refresh so
    // the new notification shows without waiting for the SSE push.
    // fetchNotifications sets the unread count from the server, so it can't
    // double-count a notification the SSE stream may have already pushed.
    if (selected.includes("IN_APP") && !targetUserId.value) {
      await notificationStore.fetchNotifications();
    }
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    result.value = {
      ok: false,
      message: e.data?.message || e.data?.statusMessage || "Send failed",
    };
  } finally {
    sending.value = false;
  }
}

// SMTP connection probe — mirrors the GET /api/admin/smtp-check response.
// The endpoint returns HTTP 200 even when ok:false (a reachable-but-rejected
// server), so a thrown error here means transport/auth failure (401/403/5xx),
// not a bad SMTP config — the two are surfaced separately.
type SmtpCheck = {
  ok: boolean;
  authConfigured: boolean;
  host?: string;
  port?: number;
  hint?: string;
  code?: string;
};

const checkingSmtp = ref(false);
const smtpResult = ref<SmtpCheck | null>(null);
const smtpError = ref<string | null>(null);

async function checkSmtp() {
  checkingSmtp.value = true;
  smtpResult.value = null;
  smtpError.value = null;
  try {
    smtpResult.value = await authFetch<SmtpCheck>("/api/admin/smtp-check");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    smtpError.value = e.data?.message || e.data?.statusMessage || "SMTP check failed";
  } finally {
    checkingSmtp.value = false;
  }
}
</script>

<template>
  <div class="max-w-3xl">
    <Alert v-if="result" :variant="result.ok ? undefined : 'destructive'" class="mb-4">
      <AlertDescription>{{ result.message }}</AlertDescription>
    </Alert>

    <Card class="mb-4">
      <CardHeader>
        <CardTitle>Email server (SMTP) connection</CardTitle>
        <CardDescription>
          Opens an authenticated connection to the mail server without sending an email. Run this
          after changing SMTP credentials to confirm they took effect.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Alert v-if="smtpError" variant="destructive">
          <AlertDescription>{{ smtpError }}</AlertDescription>
        </Alert>

        <Alert v-else-if="smtpResult" :variant="smtpResult.ok ? undefined : 'destructive'">
          <AlertDescription>
            <span class="font-medium">
              {{ smtpResult.ok ? "🟢 SMTP connection OK" : "🔴 SMTP check failed" }}
            </span>
            <span v-if="smtpResult.host" class="block text-xs mt-1 font-mono">
              {{ smtpResult.host }}:{{ smtpResult.port }}<template v-if="smtpResult.code">
                · {{ smtpResult.code }}</template>
            </span>
            <span v-if="smtpResult.hint" class="block text-xs mt-1">{{ smtpResult.hint }}</span>
          </AlertDescription>
        </Alert>

        <Button :disabled="checkingSmtp" @click="checkSmtp">
          <span v-if="checkingSmtp">Checking...</span>
          <span v-else>Check email delivery</span>
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Send test notification</CardTitle>
        <CardDescription>
          Sample data is substituted for code/receipt/reason fields. The notification flows through
          the regular pipeline (preferences, dedupe, rate limit, queue) so the preview is
          representative of production.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="type">Notification type</Label>
          <Select v-model="selectedType">
            <SelectTrigger id="type" class="w-full">
              <SelectValue placeholder="Select a notification type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="t in TYPES" :key="t.value" :value="t.value">
                {{ t.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="target">Target user (optional)</Label>
          <Input
            id="target"
            v-model="targetUserId"
            placeholder="Leave blank to send to yourself"
          />
          <p class="text-xs text-muted-foreground">
            User ID (UUID). The notification respects the target's preferences.
          </p>
        </div>

        <div class="space-y-2">
          <Label class="text-sm font-medium">Channels</Label>
          <div class="flex items-center justify-between py-1">
            <span class="text-sm">Email</span>
            <Switch v-model="channels.email" />
          </div>
          <div class="flex items-center justify-between py-1">
            <span class="text-sm">SMS</span>
            <Switch v-model="channels.sms" />
          </div>
          <div class="flex items-center justify-between py-1">
            <span class="text-sm">In-app</span>
            <Switch v-model="channels.inApp" />
          </div>
        </div>

        <div class="pt-4">
          <Button :disabled="sending" @click="send">
            <span v-if="sending">Sending...</span>
            <span v-else>Send test notification</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

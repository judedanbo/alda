<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Input } from "~/components/ui/input";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

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
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <AppPageHeader
      title="Test notifications"
      description="Send a sample notification to verify rendering and delivery without driving a real declaration."
    />

    <Alert v-if="result" :variant="result.ok ? undefined : 'destructive'" class="mb-4">
      <AlertDescription>{{ result.message }}</AlertDescription>
    </Alert>

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
          <select
            id="type"
            v-model="selectedType"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option v-for="t in TYPES" :key="t.value" :value="t.value">
              {{ t.label }}
            </option>
          </select>
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

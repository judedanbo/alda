<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { TONE_BADGE } from "~/utils/statusStyles";

interface Field {
  key: string;
  group: "smtp" | "sms";
  label: string;
  secret: boolean;
  kind: "text" | "number" | "select";
  options?: string[];
  source: "db" | "env" | "unset";
  value?: string;
}

const smtpFields = ref<Field[]>([]);
const smsFields = ref<Field[]>([]);
const allFields = computed(() => [...smtpFields.value, ...smsFields.value]);

// form[key] = current input; original[key] = loaded value (non-secret only);
// pendingClear[key] = queued to revert to env on save.
const form = reactive<Record<string, string>>({});
const original = reactive<Record<string, string>>({});
const pendingClear = reactive<Record<string, boolean>>({});

const loading = ref(true);
const saving = ref(false);
const banner = ref<{ ok: boolean; message: string } | null>(null);

async function load() {
  loading.value = true;
  try {
    const res = await authFetch<{ success: boolean; data: { smtp: Field[]; sms: Field[] } }>(
      "/api/admin/notifications/credentials",
    );
    smtpFields.value = res.data.smtp;
    smsFields.value = res.data.sms;
    for (const f of [...res.data.smtp, ...res.data.sms]) {
      original[f.key] = f.secret ? "" : (f.value ?? "");
      form[f.key] = original[f.key];
      pendingClear[f.key] = false;
    }
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    banner.value = { ok: false, message: e.data?.message || e.data?.statusMessage || "Failed to load" };
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function sourceBadge(source: Field["source"]) {
  if (source === "db") return { label: "In-app", class: TONE_BADGE.green! };
  if (source === "env") return { label: "Env fallback", class: TONE_BADGE.blue! };
  return { label: "Not set", class: TONE_BADGE.neutral! };
}
function secretStatus(source: Field["source"]) {
  if (source === "db") return "Set in-app";
  if (source === "env") return "Using env fallback";
  return "Not configured";
}

function markClear(f: Field) {
  pendingClear[f.key] = true;
  form[f.key] = "";
}
function undoClear(f: Field) {
  pendingClear[f.key] = false;
  form[f.key] = original[f.key];
}

const hasChanges = computed(() => {
  for (const f of allFields.value) {
    if (pendingClear[f.key]) return true;
    const v = form[f.key] ?? "";
    if (f.secret ? v !== "" : v !== original[f.key]) return true;
  }
  return false;
});

async function save() {
  saving.value = true;
  banner.value = null;
  const set: Record<string, string> = {};
  const clear: string[] = [];
  for (const f of allFields.value) {
    if (pendingClear[f.key]) {
      clear.push(f.key);
      continue;
    }
    const v = form[f.key] ?? "";
    if (f.secret) {
      if (v !== "") set[f.key] = v;
    } else if (v !== original[f.key]) {
      if (v === "") clear.push(f.key); // emptied a non-secret → revert to env
      else set[f.key] = v;
    }
  }
  if (Object.keys(set).length === 0 && clear.length === 0) {
    banner.value = { ok: false, message: "No changes to save." };
    saving.value = false;
    return;
  }
  try {
    await authFetch("/api/admin/notifications/credentials", { method: "PUT", body: { set, clear } });
    banner.value = { ok: true, message: "Credentials saved. They take effect immediately (env remains the fallback)." };
    await load();
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    banner.value = { ok: false, message: e.data?.message || e.data?.statusMessage || "Save failed" };
  } finally {
    saving.value = false;
  }
}

// Reuse the SMTP connection probe so admins can test right after saving.
type SmtpCheck = { ok: boolean; authConfigured: boolean; host?: string; port?: number; hint?: string; code?: string };
const checkingSmtp = ref(false);
const smtpResult = ref<SmtpCheck | null>(null);
async function checkSmtp() {
  checkingSmtp.value = true;
  smtpResult.value = null;
  try {
    smtpResult.value = await authFetch<SmtpCheck>("/api/admin/smtp-check");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    smtpResult.value = { ok: false, authConfigured: false, hint: e.data?.message || e.data?.statusMessage || "SMTP check failed" };
  } finally {
    checkingSmtp.value = false;
  }
}
</script>

<template>
  <div class="space-y-6 max-w-3xl">
    <Alert v-if="banner" :variant="banner.ok ? undefined : 'destructive'">
      <AlertDescription>{{ banner.message }}</AlertDescription>
    </Alert>

    <p class="text-xs text-muted-foreground">
      In-app values take precedence over environment/configmap; secrets are encrypted at rest and
      never shown again. Leave a field on its env fallback to keep using the deployment secret.
    </p>

    <Card v-for="grp in [{ title: 'Email (SMTP)', fields: smtpFields }, { title: 'SMS providers', fields: smsFields }]" :key="grp.title">
      <CardHeader>
        <CardTitle>{{ grp.title }}</CardTitle>
        <CardDescription>Set in-app to override the environment value, or clear to revert.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-5">
        <div v-for="f in grp.fields" :key="f.key" class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label :for="f.key">{{ f.label }}</Label>
            <Badge :class="sourceBadge(f.source).class">{{ sourceBadge(f.source).label }}</Badge>
          </div>

          <!-- Secret: write-only -->
          <template v-if="f.secret">
            <p class="text-xs text-muted-foreground">{{ secretStatus(f.source) }}</p>
            <template v-if="pendingClear[f.key]">
              <p class="text-xs text-amber-600">Will revert to env fallback on save.</p>
              <Button variant="outline" size="sm" @click="undoClear(f)">Undo</Button>
            </template>
            <template v-else>
              <Input
:id="f.key" v-model="form[f.key]" type="password" autocomplete="new-password"
                     placeholder="Enter a new value to override" />
              <Button v-if="f.source === 'db'" variant="ghost" size="sm" @click="markClear(f)">Clear override</Button>
            </template>
          </template>

          <!-- Non-secret: provider select or text/number, prefilled with effective value -->
          <template v-else>
            <select
              v-if="f.kind === 'select'"
              :id="f.key"
              v-model="form[f.key]"
              class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option v-for="opt in f.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <!-- Always text so v-model stays a string (type=number coerces to a
                 Number, which the string-only API schema rejects); numeric input
                 hint + server-side validation cover the port field. -->
            <Input
              v-else
              :id="f.key"
              v-model="form[f.key]"
              type="text"
              :inputmode="f.kind === 'number' ? 'numeric' : undefined"
              placeholder="Leave blank to use env fallback"
            />
          </template>
        </div>
      </CardContent>
    </Card>

    <div class="flex flex-wrap items-center gap-3">
      <Button :disabled="saving || !hasChanges" @click="save">
        {{ saving ? 'Saving…' : 'Save changes' }}
      </Button>
      <Button variant="outline" :disabled="checkingSmtp" @click="checkSmtp">
        {{ checkingSmtp ? 'Checking…' : 'Check email delivery' }}
      </Button>
    </div>

    <Alert v-if="smtpResult" :variant="smtpResult.ok ? undefined : 'destructive'">
      <AlertDescription>
        <span class="font-medium">{{ smtpResult.ok ? '🟢 SMTP connection OK' : '🔴 SMTP check failed' }}</span>
        <span v-if="smtpResult.host" class="block text-xs mt-1 font-mono">{{ smtpResult.host }}:{{ smtpResult.port }}</span>
        <span v-if="smtpResult.hint" class="block text-xs mt-1">{{ smtpResult.hint }}</span>
      </AlertDescription>
    </Alert>
  </div>
</template>

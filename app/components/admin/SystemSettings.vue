<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { TONE_BADGE } from "~/utils/statusStyles";

interface Setting {
  key: string;
  envVar: string;
  label: string;
  description: string;
  kind: "boolean" | "number";
  min?: number;
  max?: number;
  source: "db" | "env";
  value: boolean | number;
}

const settings = ref<Setting[]>([]);
// form[key] / original[key] hold the raw string representation ("true"/"false"
// for booleans, the integer for numbers) so v-model stays string-typed and the
// values map 1:1 onto what the API stores. original tracks the loaded value for
// change detection.
const form = reactive<Record<string, string>>({});
const original = reactive<Record<string, string>>({});

const loading = ref(true);
const saving = ref(false);
const reverting = reactive<Record<string, boolean>>({});
const banner = ref<{ ok: boolean; message: string } | null>(null);

function toRaw(s: Setting): string {
  return s.kind === "boolean" ? (s.value ? "true" : "false") : String(s.value);
}

function apply(list: Setting[]) {
  settings.value = list;
  for (const s of list) {
    original[s.key] = toRaw(s);
    form[s.key] = original[s.key]!;
  }
}

async function load() {
  loading.value = true;
  try {
    const res = await authFetch<{ success: boolean; data: { settings: Setting[] } }>(
      "/api/admin/settings",
    );
    apply(res.data.settings);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    banner.value = { ok: false, message: e.data?.message || e.data?.statusMessage || "Failed to load" };
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function sourceBadge(source: Setting["source"]) {
  return source === "db"
    ? { label: "In-app", class: TONE_BADGE.green! }
    : { label: "Env default", class: TONE_BADGE.blue! };
}

const dbKeys = computed(() => settings.value.filter((s) => s.source === "db").map((s) => s.key));

function isChanged(s: Setting): boolean {
  return form[s.key] !== original[s.key];
}
const hasChanges = computed(() => settings.value.some(isChanged));

async function clearKeys(keys: string[]): Promise<boolean> {
  if (keys.length === 0) return false;
  banner.value = null;
  try {
    const res = await authFetch<{ success: boolean; data: { settings: Setting[] } }>(
      "/api/admin/settings",
      { method: "PUT", body: { clear: keys } },
    );
    apply(res.data.settings);
    return true;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    banner.value = { ok: false, message: e.data?.message || e.data?.statusMessage || "Revert failed" };
    return false;
  }
}

async function revertSetting(s: Setting) {
  reverting[s.key] = true;
  const ok = await clearKeys([s.key]);
  if (ok) banner.value = { ok: true, message: `Reverted "${s.label}" to its environment default.` };
  reverting[s.key] = false;
}

async function save() {
  saving.value = true;
  banner.value = null;
  const set: Record<string, string> = {};
  for (const s of settings.value) {
    if (isChanged(s)) set[s.key] = s.kind === "number" ? form[s.key]!.trim() : form[s.key]!;
  }
  if (Object.keys(set).length === 0) {
    banner.value = { ok: false, message: "No changes to save." };
    saving.value = false;
    return;
  }
  try {
    const res = await authFetch<{ success: boolean; data: { settings: Setting[] } }>(
      "/api/admin/settings",
      { method: "PUT", body: { set } },
    );
    apply(res.data.settings);
    banner.value = { ok: true, message: "Settings saved. They take effect within ~30s across all instances." };
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    banner.value = { ok: false, message: e.data?.message || e.data?.statusMessage || "Save failed" };
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-6 max-w-3xl">
    <Alert v-if="banner" :variant="banner.ok ? undefined : 'destructive'">
      <AlertDescription>{{ banner.message }}</AlertDescription>
    </Alert>

    <p class="text-xs text-muted-foreground">
      In-app values override the deployment's environment / configmap and take effect at runtime
      (no redeploy). Reverting a setting removes the override so it falls back to its environment
      default. Changes propagate across instances within ~30 seconds.
    </p>

    <Card>
      <CardHeader>
        <CardTitle>Global settings</CardTitle>
        <CardDescription>Operational toggles that apply across the whole application.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <div v-if="loading" class="text-sm text-muted-foreground">Loading…</div>
        <template v-else>
          <div v-for="s in settings" :key="s.key" class="space-y-2 border-b pb-5 last:border-b-0 last:pb-0">
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <Label :for="s.key" class="font-medium">{{ s.label }}</Label>
                <p class="text-xs text-muted-foreground">{{ s.description }}</p>
                <p class="text-[11px] font-mono text-muted-foreground/80">{{ s.envVar }}</p>
              </div>
              <div class="flex flex-col items-end gap-2 shrink-0">
                <Badge :class="sourceBadge(s.source).class">{{ sourceBadge(s.source).label }}</Badge>
                <Button
                  v-if="s.source === 'db'"
                  variant="outline"
                  size="sm"
                  class="h-7 px-2 text-xs"
                  :disabled="reverting[s.key]"
                  @click="revertSetting(s)"
                >
                  {{ reverting[s.key] ? 'Reverting…' : 'Revert to default' }}
                </Button>
              </div>
            </div>

            <Switch
              v-if="s.kind === 'boolean'"
              :id="s.key"
              :model-value="form[s.key] === 'true'"
              @update:model-value="(v: boolean) => (form[s.key] = v ? 'true' : 'false')"
            />
            <Input
              v-else
              :id="s.key"
              v-model="form[s.key]"
              type="text"
              inputmode="numeric"
              class="max-w-[10rem]"
            />
          </div>
        </template>
      </CardContent>
    </Card>

    <div class="flex flex-wrap items-center gap-3">
      <Button :disabled="saving || loading || !hasChanges" @click="save">
        {{ saving ? 'Saving…' : 'Save changes' }}
      </Button>
      <Button variant="outline" :disabled="loading || dbKeys.length === 0" @click="clearKeys(dbKeys)">
        Revert all to defaults
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface ChannelFlags {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
}

interface ApiGroup {
  key: string;
  label: string;
  description: string;
  types: { type: string; label: string }[];
}

interface PreferencesData {
  channels: ChannelFlags;
  mode: "category" | "type";
  groups: ApiGroup[];
  typePreferences: Record<string, ChannelFlags>;
}

interface TypeRow extends ChannelFlags {
  type: string;
  label: string;
}

interface GroupState {
  key: string;
  label: string;
  description: string;
  types: TypeRow[];
}

const loading = ref(true);
const saving = ref(false);
const successMessage = ref("");
const errorMessage = ref("");

const channels = reactive<ChannelFlags>({
  emailEnabled: true,
  smsEnabled: true,
  inAppEnabled: true,
});
const mode = ref<"category" | "type">("category");
const groups = ref<GroupState[]>([]);

let successTimer: ReturnType<typeof setTimeout> | null = null;
const savedSnapshot = ref("");

function takeSnapshot(): string {
  return JSON.stringify({
    channels: { ...channels },
    types: groups.value.flatMap((g) =>
      g.types.map((t) => ({ type: t.type, e: t.emailEnabled, s: t.smsEnabled, i: t.inAppEnabled })),
    ),
  });
}

const isDirty = computed(() => savedSnapshot.value !== "" && takeSnapshot() !== savedSnapshot.value);

function applyData(data: PreferencesData) {
  channels.emailEnabled = data.channels.emailEnabled;
  channels.smsEnabled = data.channels.smsEnabled;
  channels.inAppEnabled = data.channels.inAppEnabled;
  mode.value = data.mode;
  groups.value = data.groups.map((group) => ({
    key: group.key,
    label: group.label,
    description: group.description,
    types: group.types.map((item) => {
      const flags = data.typePreferences[item.type] ?? {
        emailEnabled: true,
        smsEnabled: true,
        inAppEnabled: true,
      };
      return {
        type: item.type,
        label: item.label,
        emailEnabled: flags.emailEnabled,
        smsEnabled: flags.smsEnabled,
        inAppEnabled: flags.inAppEnabled,
      };
    }),
  }));
}

onMounted(async () => {
  try {
    const response = await authFetch<{ success: boolean; data: PreferencesData }>(
      "/api/notifications/preferences",
    );
    if (response.success) {
      applyData(response.data);
      savedSnapshot.value = takeSnapshot();
    }
  } catch (err: any) {
    errorMessage.value = err.data?.message || "Failed to load notification preferences.";
  } finally {
    loading.value = false;
  }
});

// A category is "on" when at least one of its types would still deliver.
function isCategoryEnabled(group: GroupState): boolean {
  return group.types.some((t) => t.emailEnabled || t.smsEnabled || t.inAppEnabled);
}

function setCategoryEnabled(group: GroupState, value: boolean) {
  for (const t of group.types) {
    t.emailEnabled = value;
    t.smsEnabled = value;
    t.inAppEnabled = value;
  }
}

const savePreferences = async () => {
  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const typePreferences = groups.value.flatMap((group) =>
      group.types.map((t) => ({
        type: t.type,
        emailEnabled: t.emailEnabled,
        smsEnabled: t.smsEnabled,
        inAppEnabled: t.inAppEnabled,
      })),
    );

    const response = await authFetch<{ success: boolean; data: PreferencesData }>(
      "/api/notifications/preferences",
      {
        method: "PATCH",
        body: {
          channels: {
            emailEnabled: channels.emailEnabled,
            smsEnabled: channels.smsEnabled,
            inAppEnabled: channels.inAppEnabled,
          },
          typePreferences,
        },
      },
    );

    if (response.success) {
      applyData(response.data);
      savedSnapshot.value = takeSnapshot();
    }

    successMessage.value = "Your notification preferences have been saved.";

    if (successTimer) clearTimeout(successTimer);
    successTimer = setTimeout(() => {
      successMessage.value = "";
    }, 3000);
  } catch (err: any) {
    errorMessage.value =
      err.data?.message || err.data?.statusMessage || "Failed to save preferences. Please try again.";
  } finally {
    saving.value = false;
  }
};

onUnmounted(() => {
  if (successTimer) clearTimeout(successTimer);
});
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <AppPageHeader
      title="Settings"
      description="Manage your notification preferences"
    />

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>

    <template v-else>
      <!-- Success alert -->
      <Alert v-if="successMessage" class="mb-4 border-green-200 bg-green-50 text-green-800">
        <AlertDescription>{{ successMessage }}</AlertDescription>
      </Alert>

      <!-- Error alert -->
      <Alert v-if="errorMessage" variant="destructive" class="mb-4">
        <AlertDescription>{{ errorMessage }}</AlertDescription>
      </Alert>

      <!-- Notification channels -->
      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>
            Choose how you would like to receive notifications about your declarations and updates.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-0">
          <div class="flex items-center justify-between py-4">
            <div class="space-y-1">
              <Label for="email-notifications" class="text-sm font-medium">Email Notifications</Label>
              <p class="text-sm text-muted-foreground">Receive updates and alerts via email.</p>
            </div>
            <Switch id="email-notifications" v-model="channels.emailEnabled" />
          </div>

          <Separator />

          <div class="flex items-center justify-between py-4">
            <div class="space-y-1">
              <Label for="sms-notifications" class="text-sm font-medium">SMS Notifications</Label>
              <p class="text-sm text-muted-foreground">Receive important alerts via text message.</p>
            </div>
            <Switch id="sms-notifications" v-model="channels.smsEnabled" />
          </div>

          <Separator />

          <div class="flex items-center justify-between py-4">
            <div class="space-y-1">
              <Label for="inapp-notifications" class="text-sm font-medium">In-App Notifications</Label>
              <p class="text-sm text-muted-foreground">Show notifications within the application.</p>
            </div>
            <Switch id="inapp-notifications" v-model="channels.inAppEnabled" />
          </div>
        </CardContent>
      </Card>

      <!-- Notification types / categories -->
      <Card class="mt-6">
        <CardHeader>
          <CardTitle>
            {{ mode === "category" ? "Notification Categories" : "Notification Types" }}
          </CardTitle>
          <CardDescription>
            {{
              mode === "category"
                ? "Choose which kinds of updates you want to receive."
                : "Fine-tune which channel each notification uses."
            }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-0">
          <!-- Category view -->
          <template v-if="mode === 'category'">
            <div v-for="(group, index) in groups" :key="group.key">
              <Separator v-if="index > 0" />
              <div class="flex items-center justify-between py-4">
                <div class="space-y-1 pr-4">
                  <Label :for="`cat-${group.key}`" class="text-sm font-medium">{{ group.label }}</Label>
                  <p class="text-sm text-muted-foreground">{{ group.description }}</p>
                </div>
                <Switch
                  :id="`cat-${group.key}`"
                  :model-value="isCategoryEnabled(group)"
                  @update:model-value="(value: boolean) => setCategoryEnabled(group, value)"
                />
              </div>
            </div>
          </template>

          <!-- Per-type view -->
          <template v-else>
            <div v-for="(group, index) in groups" :key="group.key" :class="index > 0 ? 'mt-6' : ''">
              <h3 class="text-sm font-semibold text-foreground">{{ group.label }}</h3>
              <p class="text-xs text-muted-foreground mb-2">{{ group.description }}</p>

              <div
                class="grid grid-cols-[1fr_3.5rem_3.5rem_3.5rem] items-center gap-2 border-b py-2 text-xs font-medium text-muted-foreground"
              >
                <span />
                <span class="text-center">Email</span>
                <span class="text-center">SMS</span>
                <span class="text-center">In-app</span>
              </div>

              <div
                v-for="item in group.types"
                :key="item.type"
                class="grid grid-cols-[1fr_3.5rem_3.5rem_3.5rem] items-center gap-2 border-b py-3 last:border-b-0"
              >
                <span class="text-sm">{{ item.label }}</span>
                <div class="flex justify-center">
                  <Switch v-model="item.emailEnabled" />
                </div>
                <div class="flex justify-center">
                  <Switch v-model="item.smsEnabled" />
                </div>
                <div class="flex justify-center">
                  <Switch v-model="item.inAppEnabled" />
                </div>
              </div>
            </div>
          </template>

          <p class="text-xs text-muted-foreground pt-4">
            A notification is only delivered on a channel you have enabled under Notification
            Channels. Security messages such as password resets are always sent.
          </p>
        </CardContent>
      </Card>

      <!-- Save button -->
      <div class="flex justify-end pt-6">
        <Button :disabled="saving || !isDirty" @click="savePreferences">
          <span v-if="saving">Saving...</span>
          <span v-else>Save Preferences</span>
        </Button>
      </div>
    </template>
  </div>
</template>

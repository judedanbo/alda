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


const loading = ref(true);
const saving = ref(false);
const successMessage = ref("");
const errorMessage = ref("");

const preferences = reactive({
  emailEnabled: true,
  smsEnabled: true,
  inAppEnabled: true,
});

let successTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  try {
    const response = await authFetch<{
      success: boolean;
      data: { emailEnabled: boolean; smsEnabled: boolean; inAppEnabled: boolean };
    }>("/api/notifications/preferences");
    if (response.success) {
      preferences.emailEnabled = response.data.emailEnabled;
      preferences.smsEnabled = response.data.smsEnabled;
      preferences.inAppEnabled = response.data.inAppEnabled;
    }
  } catch (err: any) {
    errorMessage.value = err.data?.message || "Failed to load notification preferences.";
  } finally {
    loading.value = false;
  }
});

const savePreferences = async () => {
  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    await authFetch("/api/notifications/preferences", {
      method: "PATCH",
      body: {
        emailEnabled: preferences.emailEnabled,
        smsEnabled: preferences.smsEnabled,
        inAppEnabled: preferences.inAppEnabled,
      },
    });

    successMessage.value = "Your notification preferences have been saved.";

    if (successTimer) clearTimeout(successTimer);
    successTimer = setTimeout(() => {
      successMessage.value = "";
    }, 3000);
  } catch (err: any) {
    errorMessage.value = err.data?.message || "Failed to save preferences. Please try again.";
  } finally {
    saving.value = false;
  }
};

onUnmounted(() => {
  if (successTimer) clearTimeout(successTimer);
});
</script>

<template>
  <div class="max-w-2xl mx-auto">
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

      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>
            Choose how you would like to receive notifications about your declarations and updates.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-0">
          <!-- Email Notifications -->
          <div class="flex items-center justify-between py-4">
            <div class="space-y-1">
              <Label for="email-notifications" class="text-sm font-medium">Email Notifications</Label>
              <p class="text-sm text-muted-foreground">
                Receive updates and alerts via email.
              </p>
            </div>
            <Switch
              id="email-notifications"
              v-model:checked="preferences.emailEnabled"
            />
          </div>

          <Separator />

          <!-- SMS Notifications -->
          <div class="flex items-center justify-between py-4">
            <div class="space-y-1">
              <Label for="sms-notifications" class="text-sm font-medium">SMS Notifications</Label>
              <p class="text-sm text-muted-foreground">
                Receive important alerts via text message.
              </p>
            </div>
            <Switch
              id="sms-notifications"
              v-model:checked="preferences.smsEnabled"
            />
          </div>

          <Separator />

          <!-- In-App Notifications -->
          <div class="flex items-center justify-between py-4">
            <div class="space-y-1">
              <Label for="inapp-notifications" class="text-sm font-medium">In-App Notifications</Label>
              <p class="text-sm text-muted-foreground">
                Show notifications within the application.
              </p>
            </div>
            <Switch
              id="inapp-notifications"
              v-model:checked="preferences.inAppEnabled"
            />
          </div>

          <Separator />

          <!-- Save button -->
          <div class="flex justify-end pt-4">
            <Button :disabled="saving" @click="savePreferences">
              <span v-if="saving">Saving...</span>
              <span v-else>Save Preferences</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>

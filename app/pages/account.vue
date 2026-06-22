<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { useAuthStore } from "~/stores/auth";
import { ROLE_LABELS, type RoleName } from "~/utils/roles";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface AccountData {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  roles: string[];
  createdAt: string | null;
  lastLoginAt: string | null;
}

const authStore = useAuthStore();
const { toast } = useToast();

const loading = ref(true);
const account = ref<AccountData | null>(null);

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role as RoleName] ?? role;
}

async function loadAccount() {
  try {
    const response = await authFetch<{ success: boolean; data: AccountData }>("/api/auth/me");
    if (response.success) {
      account.value = response.data;
      contact.email = response.data.email;
      contact.phone = response.data.phone ?? "";
      contactBaseline.email = response.data.email;
      contactBaseline.phone = response.data.phone ?? "";
    }
  } catch (err: unknown) {
    toast.fromError(err, "Failed to load your account.");
  } finally {
    loading.value = false;
  }
}

onMounted(loadAccount);

/* ------------------------------------------------------------------ */
/* Email verification (resend)                                         */
/* ------------------------------------------------------------------ */
const resendLoading = ref(false);

async function resendVerification() {
  resendLoading.value = true;
  try {
    await authFetch("/api/auth/resend-verification", { method: "POST" });
    toast.success("Verification email sent — check your inbox.");
  } catch (e) {
    toast.fromError(e, "Failed to send verification email.");
  } finally {
    resendLoading.value = false;
  }
}

/* ------------------------------------------------------------------ */
/* Contact information                                                 */
/* ------------------------------------------------------------------ */
const { fieldErrors, clearFieldError, clearAll, handleServerError } = useFieldErrors();
const contact = reactive({ email: "", phone: "" });
const contactBaseline = reactive({ email: "", phone: "" });
const savingContact = ref(false);
const emailVerificationSent = ref(false);

const contactDirty = computed(
  () => contact.email !== contactBaseline.email || contact.phone !== contactBaseline.phone,
);

async function saveContact() {
  clearAll();
  savingContact.value = true;
  emailVerificationSent.value = false;
  try {
    const body: { email?: string; phone?: string | null } = {};
    if (contact.email !== contactBaseline.email) body.email = contact.email;
    if (contact.phone !== contactBaseline.phone) body.phone = contact.phone.trim() === "" ? null : contact.phone;

    const response = await authFetch<{
      success: boolean;
      message: string;
      data?: { emailChanged: boolean; phoneChanged: boolean };
    }>("/api/account/contact", { method: "PATCH", body });

    if (response.success) {
      if (response.data?.emailChanged) emailVerificationSent.value = true;
      // Refresh the store so verification badges and the phone-verify section update.
      await authStore.fetchUser();
      await loadAccount();
      toast.success(response.message);
    }
  } catch (err: unknown) {
    const msg = handleServerError(err);
    if (msg) toast.error(msg);
  } finally {
    savingContact.value = false;
  }
}

/* ------------------------------------------------------------------ */
/* Phone verification (reuses the auth store flow)                     */
/* ------------------------------------------------------------------ */
const phoneCodeSent = ref(false);
const phoneCodeInput = ref("");
const phoneCodeError = ref("");
const phoneCodeSending = ref(false);
const phoneCodeVerifying = ref(false);
const phoneResendSeconds = ref(0);
let phoneResendTimer: ReturnType<typeof setInterval> | null = null;

function startResendCountdown(seconds: number) {
  phoneResendSeconds.value = seconds;
  if (phoneResendTimer) clearInterval(phoneResendTimer);
  phoneResendTimer = setInterval(() => {
    phoneResendSeconds.value -= 1;
    if (phoneResendSeconds.value <= 0 && phoneResendTimer) {
      clearInterval(phoneResendTimer);
      phoneResendTimer = null;
    }
  }, 1000);
}

onUnmounted(() => {
  if (phoneResendTimer) clearInterval(phoneResendTimer);
});

async function handleSendPhoneCode() {
  phoneCodeError.value = "";
  phoneCodeSending.value = true;
  const result = await authStore.sendPhoneCode();
  phoneCodeSending.value = false;
  if (result.success) {
    phoneCodeSent.value = true;
    startResendCountdown(60);
    toast.success("Verification code sent to your phone.");
  } else {
    phoneCodeError.value = result.error || "Failed to send code";
    if (result.retryInSec) startResendCountdown(result.retryInSec);
  }
}

async function handleVerifyPhone() {
  phoneCodeError.value = "";
  if (!/^\d{6}$/.test(phoneCodeInput.value)) {
    phoneCodeError.value = "Enter the 6-digit code from the SMS";
    return;
  }
  phoneCodeVerifying.value = true;
  const result = await authStore.verifyPhone(phoneCodeInput.value);
  phoneCodeVerifying.value = false;
  if (result.success) {
    phoneCodeSent.value = false;
    phoneCodeInput.value = "";
    if (phoneResendTimer) clearInterval(phoneResendTimer);
    await loadAccount();
    toast.success("Phone number verified.");
  } else {
    phoneCodeError.value = result.error || "Verification failed";
  }
}

/* ------------------------------------------------------------------ */
/* Password change                                                     */
/* ------------------------------------------------------------------ */
const pw = reactive({ current: "", next: "", confirm: "" });
const savingPassword = ref(false);

async function changePassword() {
  clearFieldError("currentPassword");
  clearFieldError("newPassword");
  clearFieldError("confirmPassword");

  if (pw.next !== pw.confirm) {
    fieldErrors.confirmPassword = "Passwords do not match";
    return;
  }

  savingPassword.value = true;
  try {
    const response = await authFetch<{ success: boolean; message: string }>(
      "/api/account/change-password",
      { method: "POST", body: { currentPassword: pw.current, newPassword: pw.next } },
    );
    if (response.success) {
      pw.current = "";
      pw.next = "";
      pw.confirm = "";
      toast.success(response.message);
    }
  } catch (err: unknown) {
    const msg = handleServerError(err);
    if (msg) toast.error(msg);
  } finally {
    savingPassword.value = false;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <AppPageHeader title="My Account" description="View and manage your account details and settings" />

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>

    <template v-else-if="account">
      <!-- Account overview -->
      <Card data-tour="account-overview">
        <CardHeader>
          <CardTitle>Account Overview</CardTitle>
          <CardDescription>Your account details and current roles.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1 min-w-0">
              <p class="text-sm text-muted-foreground">Email</p>
              <p class="text-sm font-medium break-all">{{ account.email }}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <Badge :variant="account.emailVerified ? 'default' : 'outline'">
                {{ account.emailVerified ? "Verified" : "Unverified" }}
              </Badge>
              <Button
                v-if="!account.emailVerified"
                size="sm"
                variant="outline"
                :disabled="resendLoading"
                @click="resendVerification"
              >
                {{ resendLoading ? "Sending…" : "Resend" }}
              </Button>
            </div>
          </div>

          <Separator />

          <div class="flex items-center justify-between gap-4">
            <div class="space-y-1 min-w-0">
              <p class="text-sm text-muted-foreground">Phone</p>
              <p class="text-sm font-medium">{{ account.phone || "Not set" }}</p>
            </div>
            <Badge v-if="account.phone" :variant="account.phoneVerified ? 'default' : 'outline'">
              {{ account.phoneVerified ? "Verified" : "Unverified" }}
            </Badge>
          </div>

          <Separator />

          <div class="space-y-1">
            <p class="text-sm text-muted-foreground">Roles</p>
            <div class="flex flex-wrap gap-2 pt-1">
              <Badge v-for="role in account.roles" :key="role" variant="secondary">
                {{ roleLabel(role) }}
              </Badge>
            </div>
          </div>

          <Separator />

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">Member since</p>
              <p class="text-sm font-medium">{{ formatDate(account.createdAt) }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">Last login</p>
              <p class="text-sm font-medium">{{ formatDate(account.lastLoginAt) }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Contact information -->
      <Card class="mt-6" data-tour="account-contact">
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>
            Update your email or phone number. Changing either requires re-verification.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-1.5">
            <Label for="account-email" class="flex items-center gap-1">Email <HelpTip field-id="account.email" /></Label>
            <Input
              id="account-email"
              v-model="contact.email"
              type="email"
              autocomplete="email"
              :aria-invalid="!!fieldErrors.email"
              @input="clearFieldError('email')"
            />
            <p v-if="fieldErrors.email" class="text-xs text-destructive">{{ fieldErrors.email }}</p>
          </div>

          <div class="space-y-1.5">
            <Label for="account-phone" class="flex items-center gap-1">Phone <HelpTip field-id="account.phone" /></Label>
            <Input
              id="account-phone"
              v-model="contact.phone"
              type="tel"
              autocomplete="tel"
              placeholder="+233 or 0XX XXX XXXX"
              :aria-invalid="!!fieldErrors.phone"
              @input="clearFieldError('phone')"
            />
            <p v-if="fieldErrors.phone" class="text-xs text-destructive">{{ fieldErrors.phone }}</p>
            <p v-else class="text-xs text-muted-foreground">Leave blank to remove your phone number.</p>
          </div>

          <div
            v-if="emailVerificationSent"
            class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            We've sent a verification link to your new email address. Please verify it to keep your
            account fully active.
          </div>

          <div class="flex justify-end">
            <Button :disabled="savingContact || !contactDirty" @click="saveContact">
              {{ savingContact ? "Saving…" : "Save changes" }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Phone verification -->
      <Card v-if="account.phone && !account.phoneVerified" class="mt-6">
        <CardHeader>
          <CardTitle>Verify your phone</CardTitle>
          <CardDescription>
            We'll send a 6-digit code to <span class="font-mono">{{ account.phone }}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="!phoneCodeSent" class="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              :disabled="phoneCodeSending || phoneResendSeconds > 0"
              @click="handleSendPhoneCode"
            >
              <template v-if="phoneCodeSending">Sending…</template>
              <template v-else-if="phoneResendSeconds > 0">Resend in {{ phoneResendSeconds }}s</template>
              <template v-else>Send code</template>
            </Button>
          </div>

          <div v-else class="flex items-center gap-2 flex-wrap">
            <Input
              v-model="phoneCodeInput"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              placeholder="123456"
              class="w-32 font-mono tracking-widest text-center"
              aria-label="6-digit SMS verification code"
              @input="phoneCodeError = ''"
            />
            <Button
              size="sm"
              :disabled="phoneCodeVerifying || phoneCodeInput.length !== 6"
              @click="handleVerifyPhone"
            >
              {{ phoneCodeVerifying ? "Verifying…" : "Verify" }}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              :disabled="phoneCodeSending || phoneResendSeconds > 0"
              @click="handleSendPhoneCode"
            >
              <template v-if="phoneResendSeconds > 0">Resend in {{ phoneResendSeconds }}s</template>
              <template v-else>Resend code</template>
            </Button>
          </div>

          <p v-if="phoneCodeError" class="text-xs text-destructive mt-2">{{ phoneCodeError }}</p>
        </CardContent>
      </Card>

      <!-- Password -->
      <Card class="mt-6" data-tour="account-password">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Change your password. This signs you out of all other devices.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-1.5">
            <Label for="pw-current" class="flex items-center gap-1">Current password <HelpTip field-id="account.currentPassword" /></Label>
            <Input
              id="pw-current"
              v-model="pw.current"
              type="password"
              autocomplete="current-password"
              :aria-invalid="!!fieldErrors.currentPassword"
              @input="clearFieldError('currentPassword')"
            />
            <p v-if="fieldErrors.currentPassword" class="text-xs text-destructive">
              {{ fieldErrors.currentPassword }}
            </p>
          </div>

          <div class="space-y-1.5">
            <Label for="pw-next">New password</Label>
            <Input
              id="pw-next"
              v-model="pw.next"
              type="password"
              autocomplete="new-password"
              :aria-invalid="!!fieldErrors.newPassword"
              @input="clearFieldError('newPassword')"
            />
            <p v-if="fieldErrors.newPassword" class="text-xs text-destructive">
              {{ fieldErrors.newPassword }}
            </p>
            <p v-else class="text-xs text-muted-foreground">
              At least 8 characters with an uppercase letter, a lowercase letter, and a number.
            </p>
          </div>

          <div class="space-y-1.5">
            <Label for="pw-confirm">Confirm new password</Label>
            <Input
              id="pw-confirm"
              v-model="pw.confirm"
              type="password"
              autocomplete="new-password"
              :aria-invalid="!!fieldErrors.confirmPassword"
              @input="clearFieldError('confirmPassword')"
            />
            <p v-if="fieldErrors.confirmPassword" class="text-xs text-destructive">
              {{ fieldErrors.confirmPassword }}
            </p>
          </div>

          <div class="flex justify-end">
            <Button
              :disabled="savingPassword || !pw.current || !pw.next || !pw.confirm"
              @click="changePassword"
            >
              {{ savingPassword ? "Changing…" : "Change password" }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Preferences link-out -->
      <Card class="mt-6">
        <CardHeader>
          <CardTitle>Notifications &amp; Accessibility</CardTitle>
          <CardDescription>
            Manage how you're notified and adjust display and accessibility options.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button as-child variant="outline">
            <NuxtLink to="/settings/preferences">Open preferences</NuxtLink>
          </Button>
        </CardContent>
      </Card>
    </template>
  </div>
</template>

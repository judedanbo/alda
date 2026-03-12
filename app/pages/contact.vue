<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

useSeoMeta({
  title: "Contact Us - Asset Declaration Portal",
  description: "Contact the Ghana Audit Service for support with the Asset Declaration Portal",
});

const categories = [
  { value: "GENERAL_INQUIRY", label: "General Inquiry" },
  { value: "TECHNICAL_SUPPORT", label: "Technical Support" },
  { value: "DECLARATION_HELP", label: "Help with Declaration" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "COMPLAINT", label: "Complaint" },
  { value: "OTHER", label: "Other" },
];

const form = reactive({
  name: "",
  email: "",
  phone: "",
  category: "GENERAL_INQUIRY",
  subject: "",
  message: "",
});

const isLoading = ref(false);
const error = ref("");
const success = ref(false);

const isFormValid = computed(() => {
  return (
    form.name.trim() &&
    form.email.trim() &&
    form.subject.trim() &&
    form.message.trim()
  );
});

const handleSubmit = async () => {
  if (!isFormValid.value) return;

  isLoading.value = true;
  error.value = "";
  success.value = false;

  try {
    const response = await $fetch("/api/contact", {
      method: "POST",
      body: {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
      },
    });

    if (response.success) {
      success.value = true;
      // Reset form
      form.name = "";
      form.email = "";
      form.phone = "";
      form.category = "GENERAL_INQUIRY";
      form.subject = "";
      form.message = "";
    }
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } };
    error.value = fetchError.data?.message || "Failed to submit your message. Please try again.";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="w-full max-w-2xl">
    <div class="bg-card rounded-lg shadow-lg border p-8">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-foreground">Contact Us</h1>
        <p class="text-muted-foreground mt-2">
          Have questions? We're here to help with any inquiries about the Asset Declaration Portal.
        </p>
      </div>

      <!-- Success Message -->
      <div
        v-if="success"
        class="mb-6 p-4 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
      >
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 class="font-medium text-green-800 dark:text-green-200">Message Sent Successfully</h3>
            <p class="text-sm text-green-700 dark:text-green-300 mt-1">
              Thank you for contacting us. We will respond to your inquiry within 2-3 business days.
            </p>
          </div>
        </div>
      </div>

      <form v-if="!success" @submit.prevent="handleSubmit" class="space-y-5">
        <!-- Error Alert -->
        <div
          v-if="error"
          class="p-4 rounded-md bg-destructive/10 text-destructive text-sm"
        >
          {{ error }}
        </div>

        <!-- Name Field -->
        <div class="space-y-2">
          <label for="name" class="text-sm font-medium text-foreground">
            Full Name <span class="text-destructive">*</span>
          </label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            required
            autocomplete="name"
            class="w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Your full name"
          />
        </div>

        <!-- Email and Phone Row -->
        <div class="grid md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <label for="email" class="text-sm font-medium text-foreground">
              Email Address <span class="text-destructive">*</span>
            </label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              autocomplete="email"
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div class="space-y-2">
            <label for="phone" class="text-sm font-medium text-foreground">
              Phone Number
            </label>
            <input
              id="phone"
              v-model="form.phone"
              type="tel"
              autocomplete="tel"
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="+233 XX XXX XXXX"
            />
          </div>
        </div>

        <!-- Category Field -->
        <div class="space-y-2">
          <label for="category" class="text-sm font-medium text-foreground">
            Category <span class="text-destructive">*</span>
          </label>
          <select
            id="category"
            v-model="form.category"
            required
            class="w-full px-4 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option v-for="cat in categories" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </option>
          </select>
        </div>

        <!-- Subject Field -->
        <div class="space-y-2">
          <label for="subject" class="text-sm font-medium text-foreground">
            Subject <span class="text-destructive">*</span>
          </label>
          <input
            id="subject"
            v-model="form.subject"
            type="text"
            required
            class="w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Brief description of your inquiry"
          />
        </div>

        <!-- Message Field -->
        <div class="space-y-2">
          <label for="message" class="text-sm font-medium text-foreground">
            Message <span class="text-destructive">*</span>
          </label>
          <textarea
            id="message"
            v-model="form.message"
            required
            rows="5"
            class="w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            placeholder="Please provide details about your inquiry..."
          ></textarea>
          <p class="text-xs text-muted-foreground">
            {{ form.message.length }}/2000 characters
          </p>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading || !isFormValid"
          class="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="isLoading">Sending Message...</span>
          <span v-else>Send Message</span>
        </button>
      </form>

      <!-- Send Another Message -->
      <div v-if="success" class="text-center">
        <button
          @click="success = false"
          class="text-primary hover:underline text-sm font-medium"
        >
          Send another message
        </button>
      </div>

      <!-- Contact Information -->
      <div class="mt-8 pt-6 border-t">
        <h2 class="text-lg font-semibold text-foreground mb-4">Other Ways to Reach Us</h2>
        <div class="grid md:grid-cols-2 gap-4 text-sm">
          <div class="p-4 bg-muted/50 rounded-md">
            <h3 class="font-medium text-foreground mb-2">Office Address</h3>
            <p class="text-muted-foreground">
              Ghana Audit Service<br />
              P.O. Box MB 96<br />
              Accra, Ghana
            </p>
          </div>
          <div class="p-4 bg-muted/50 rounded-md">
            <h3 class="font-medium text-foreground mb-2">Contact Details</h3>
            <p class="text-muted-foreground">
              Phone: +233 (0) 302 664928<br />
              Email: info@audit.gov.gh<br />
              Hours: Mon-Fri, 8:00 AM - 5:00 PM
            </p>
          </div>
        </div>
      </div>

      <div class="mt-6 flex items-center justify-center gap-4 text-sm">
        <NuxtLink
          to="/auth/login"
          class="text-primary hover:underline"
        >
          Back to Login
        </NuxtLink>
        <span class="text-muted-foreground">|</span>
        <NuxtLink
          to="/"
          class="text-primary hover:underline"
        >
          Home
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

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
    <Card class="shadow-lg">
      <CardHeader class="text-center">
        <CardTitle class="text-3xl">Contact Us</CardTitle>
        <CardDescription>
          Have questions? We're here to help with any inquiries about the Asset Declaration Portal.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <!-- Success Message -->
        <Alert v-if="success" class="mb-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200">
          <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <AlertTitle>Message Sent Successfully</AlertTitle>
          <AlertDescription class="text-green-700 dark:text-green-300">
            Thank you for contacting us. We will respond to your inquiry within 2-3 business days.
          </AlertDescription>
        </Alert>

        <form v-if="!success" class="space-y-5" @submit.prevent="handleSubmit">
          <!-- Error Alert -->
          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>

          <!-- Name Field -->
          <div class="space-y-2">
            <Label for="name">
              Full Name <span class="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              v-model="form.name"
              type="text"
              required
              autocomplete="name"
              placeholder="Your full name"
            />
          </div>

          <!-- Email and Phone Row -->
          <div class="grid md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="email">
                Email Address <span class="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                v-model="form.email"
                type="email"
                required
                autocomplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div class="space-y-2">
              <Label for="phone">
                Phone Number
              </Label>
              <Input
                id="phone"
                v-model="form.phone"
                type="tel"
                autocomplete="tel"
                placeholder="+233 XX XXX XXXX"
              />
            </div>
          </div>

          <!-- Category Field -->
          <div class="space-y-2">
            <Label for="category">
              Category <span class="text-destructive">*</span>
            </Label>
            <Select v-model="form.category">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="cat in categories" :key="cat.value" :value="cat.value">
                  {{ cat.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Subject Field -->
          <div class="space-y-2">
            <Label for="subject">
              Subject <span class="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              v-model="form.subject"
              type="text"
              required
              placeholder="Brief description of your inquiry"
            />
          </div>

          <!-- Message Field -->
          <div class="space-y-2">
            <Label for="message">
              Message <span class="text-destructive">*</span>
            </Label>
            <Textarea
              id="message"
              v-model="form.message"
              required
              :rows="5"
              class="resize-none"
              placeholder="Please provide details about your inquiry..."
            />
            <p class="text-xs text-muted-foreground">
              {{ form.message.length }}/2000 characters
            </p>
          </div>

          <!-- Submit Button -->
          <Button
            type="submit"
            class="w-full"
            :disabled="isLoading || !isFormValid"
          >
            <span v-if="isLoading">Sending Message...</span>
            <span v-else>Send Message</span>
          </Button>
        </form>

        <!-- Send Another Message -->
        <div v-if="success" class="text-center">
          <Button variant="link" @click="success = false">
            Send another message
          </Button>
        </div>

        <!-- Contact Information -->
        <Separator class="my-6" />
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
      </CardContent>

      <CardFooter class="flex items-center justify-center gap-4 text-sm">
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
      </CardFooter>
    </Card>
  </div>
</template>

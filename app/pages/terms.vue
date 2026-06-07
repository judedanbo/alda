<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "auth",
});

useSeoMeta({
  title: "Terms of Service - Asset Declaration Portal",
  description: "Terms of Service for the Ghana Audit Service Asset Declaration Portal",
});

const authStore = useAuthStore();
</script>

<template>
  <div class="w-full max-w-3xl">
    <Card class="shadow-lg">
      <CardHeader>
        <CardTitle class="text-3xl">Terms of Service</CardTitle>
        <CardDescription>
          Last updated: {{ new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div class="prose prose-sm max-w-none text-foreground space-y-6">
          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p class="text-muted-foreground leading-relaxed">
              By accessing and using the Asset Declaration Portal ("Portal") operated by the Ghana
              Audit Service, you agree to be bound by these Terms of Service. If you do not agree
              to these terms, you should not use this Portal. These terms are in addition to any
              obligations imposed by Article 286 of the 1992 Constitution of the Republic of Ghana
              and related legislation.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">2. Purpose of the Portal</h2>
            <p class="text-muted-foreground leading-relaxed">
              This Portal is established pursuant to Article 286(5) of the 1992 Constitution of
              Ghana to facilitate the submission, processing, and management of asset declarations
              by public officers. The Portal enables public officers to fulfill their constitutional
              obligation to declare their assets and liabilities before taking office, at the end
              of every four years, and at the end of their term.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">3. User Eligibility</h2>
            <p class="text-muted-foreground leading-relaxed mb-3">
              This Portal is intended for use by:
            </p>
            <ul class="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Public officers required to declare assets under Article 286(5)</li>
              <li>Authorized Ghana Audit Service personnel</li>
              <li>Other authorized government officials with legitimate access requirements</li>
            </ul>
            <p class="text-muted-foreground leading-relaxed mt-3">
              You must be at least 18 years of age and possess a valid Ghana Card to register
              and use this Portal.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">4. User Responsibilities</h2>
            <p class="text-muted-foreground leading-relaxed mb-3">
              As a user of this Portal, you agree to:
            </p>
            <ul class="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Provide accurate, complete, and truthful information in all declarations</li>
              <li>Maintain the confidentiality of your account credentials</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
              <li>Submit declarations within the timeframes required by law</li>
              <li>Update your information promptly when changes occur</li>
              <li>Use the Portal only for its intended lawful purposes</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">5. Accuracy of Information</h2>
            <p class="text-muted-foreground leading-relaxed">
              You acknowledge that asset declarations submitted through this Portal are official
              documents with legal significance. Providing false, misleading, or incomplete
              information in your declaration is a serious offense under Ghanaian law and may
              result in criminal prosecution, removal from office, and other penalties as
              prescribed by the Constitution and relevant legislation.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">6. Account Security</h2>
            <p class="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the security of your account and password.
              You must not share your login credentials with any other person. The Ghana Audit
              Service will never ask for your password via email or phone. You agree to accept
              responsibility for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">7. Intellectual Property</h2>
            <p class="text-muted-foreground leading-relaxed">
              The Portal, including its design, text, graphics, and software, is the property
              of the Ghana Audit Service or its licensors and is protected by copyright and
              other intellectual property laws. You may not copy, modify, distribute, or
              reverse engineer any part of the Portal without prior written authorization.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">8. System Availability</h2>
            <p class="text-muted-foreground leading-relaxed">
              While we strive to maintain continuous availability of the Portal, we do not
              guarantee uninterrupted access. The Portal may be temporarily unavailable due
              to maintenance, updates, or circumstances beyond our control. We will endeavor
              to provide advance notice of scheduled maintenance when possible.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">9. Prohibited Activities</h2>
            <p class="text-muted-foreground leading-relaxed mb-3">
              You agree not to:
            </p>
            <ul class="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Attempt to gain unauthorized access to the Portal or its systems</li>
              <li>Use automated systems or software to access the Portal without permission</li>
              <li>Interfere with or disrupt the Portal's operation or servers</li>
              <li>Transmit viruses, malware, or other malicious code</li>
              <li>Impersonate another person or misrepresent your affiliation</li>
              <li>Use the Portal for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">10. Data Processing</h2>
            <p class="text-muted-foreground leading-relaxed">
              Your use of this Portal is subject to our Privacy Policy, which describes how
              we collect, use, and protect your personal information. By using the Portal,
              you consent to the data practices described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">11. Limitation of Liability</h2>
            <p class="text-muted-foreground leading-relaxed">
              To the fullest extent permitted by law, the Ghana Audit Service shall not be
              liable for any indirect, incidental, special, consequential, or punitive damages
              arising from your use of the Portal. Our total liability for any claims arising
              from your use of the Portal shall not exceed the amount you paid to use the Portal
              (if any).
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">12. Indemnification</h2>
            <p class="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless the Ghana Audit Service, its officers,
              employees, and agents from any claims, damages, losses, or expenses arising from
              your use of the Portal, your violation of these Terms, or your violation of any
              rights of another party.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">13. Modifications to Terms</h2>
            <p class="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. Changes will
              be effective immediately upon posting to the Portal. Your continued use of the
              Portal after any modifications indicates your acceptance of the modified terms.
              We encourage you to review these terms periodically.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">14. Governing Law</h2>
            <p class="text-muted-foreground leading-relaxed">
              These Terms of Service shall be governed by and construed in accordance with
              the laws of the Republic of Ghana. Any disputes arising from these terms or
              your use of the Portal shall be subject to the exclusive jurisdiction of the
              courts of Ghana.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">15. Contact Information</h2>
            <p class="text-muted-foreground leading-relaxed">
              If you have questions about these Terms of Service, please contact:
            </p>
            <div class="mt-3 p-4 bg-muted/50 rounded-md text-muted-foreground">
              <p class="font-medium text-foreground">Ghana Audit Service</p>
              <p>Legal and Compliance Unit</p>
              <p>P.O. Box MB 96, Accra</p>
              <p>Email: legal@audit.gov.gh</p>
              <p>Phone: +233 (0) 302 664928</p>
            </div>
          </section>
        </div>
      </CardContent>

      <CardFooter class="flex items-center justify-between">
        <ClientOnly>
          <NuxtLink
            v-if="authStore.isAuthenticated"
            :to="authStore.dashboardPath"
            class="text-primary hover:underline text-sm"
          >
            Back to Dashboard
          </NuxtLink>
          <NuxtLink
            v-else
            to="/auth/login"
            class="text-primary hover:underline text-sm"
          >
            Back to Login
          </NuxtLink>
          <template #fallback>
            <NuxtLink
              to="/auth/login"
              class="text-primary hover:underline text-sm"
            >
              Back to Login
            </NuxtLink>
          </template>
        </ClientOnly>
        <NuxtLink
          to="/privacy"
          class="text-primary hover:underline text-sm"
        >
          Privacy Policy
        </NuxtLink>
      </CardFooter>
    </Card>
  </div>
</template>

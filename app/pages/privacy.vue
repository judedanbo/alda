<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

useSeoMeta({
  title: "Privacy Policy - Asset Declaration Portal",
  description: "Privacy Policy for the Ghana Audit Service Asset Declaration Portal",
});
</script>

<template>
  <div class="w-full max-w-3xl">
    <Card class="shadow-lg">
      <CardHeader>
        <CardTitle class="text-3xl">Privacy Policy</CardTitle>
        <CardDescription>
          Last updated: {{ new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div class="prose prose-sm max-w-none text-foreground space-y-6">
          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
            <p class="text-muted-foreground leading-relaxed">
              The Ghana Audit Service ("we", "our", or "us") operates the Asset Declaration Portal
              in accordance with Article 286(5) of the 1992 Constitution of the Republic of Ghana.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your personal
              information when you use our online asset declaration system.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">2. Information We Collect</h2>
            <p class="text-muted-foreground leading-relaxed mb-3">
              We collect information that you provide directly to us, including:
            </p>
            <ul class="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Personal identification information (name, Ghana Card number, date of birth)</li>
              <li>Contact information (email address, phone number, residential address)</li>
              <li>Employment information (institution, designation, public office category)</li>
              <li>Financial information (assets, liabilities, income sources)</li>
              <li>Family information (spouse and dependent details as required by law)</li>
              <li>Supporting documents (Ghana Card images, employment letters)</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">3. Legal Basis for Processing</h2>
            <p class="text-muted-foreground leading-relaxed">
              We process your personal data in compliance with Article 286 of the 1992 Constitution
              of the Republic of Ghana, which mandates public officers to declare their assets and
              liabilities. The processing is necessary for compliance with legal obligations and for
              the performance of tasks carried out in the public interest.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">4. How We Use Your Information</h2>
            <p class="text-muted-foreground leading-relaxed mb-3">
              We use the information we collect to:
            </p>
            <ul class="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Process and maintain your asset declarations as required by law</li>
              <li>Verify the authenticity of submitted declarations</li>
              <li>Generate official receipts and verification codes</li>
              <li>Communicate with you regarding your declarations</li>
              <li>Comply with legal and regulatory requirements</li>
              <li>Maintain audit trails for transparency and accountability</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">5. Data Protection and Security</h2>
            <p class="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal
              data against unauthorized access, alteration, disclosure, or destruction. These measures
              include encryption, access controls, secure data storage, and regular security assessments.
              Access to personal data is restricted to authorized personnel who require it to perform
              their official duties.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">6. Data Retention</h2>
            <p class="text-muted-foreground leading-relaxed">
              Asset declarations and related personal data are retained in accordance with the
              constitutional requirements and applicable retention policies. Declarations are maintained
              for the duration required by law and may be archived for historical and audit purposes.
              We will securely dispose of personal data when it is no longer required for the purposes
              for which it was collected.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">7. Information Sharing</h2>
            <p class="text-muted-foreground leading-relaxed mb-3">
              We do not sell or rent your personal information. We may share your information only:
            </p>
            <ul class="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>With authorized government agencies as required by law</li>
              <li>With law enforcement when required by valid legal process</li>
              <li>To protect the rights and safety of the Ghana Audit Service and the public</li>
              <li>With service providers who assist in operating our systems under strict confidentiality agreements</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">8. Your Rights</h2>
            <p class="text-muted-foreground leading-relaxed mb-3">
              Subject to applicable law, you have the right to:
            </p>
            <ul class="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Access your personal data held by us</li>
              <li>Request correction of inaccurate information</li>
              <li>Receive a copy of your submitted declarations</li>
              <li>Be informed about how your data is processed</li>
            </ul>
            <p class="text-muted-foreground leading-relaxed mt-3">
              Note: Due to the statutory nature of asset declarations, certain rights such as erasure
              or objection to processing may be limited.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">9. Cookies and Tracking</h2>
            <p class="text-muted-foreground leading-relaxed">
              Our portal uses essential cookies to maintain your session and ensure secure access.
              These cookies are necessary for the operation of the system and cannot be disabled.
              We do not use tracking cookies for advertising purposes.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">10. Changes to This Policy</h2>
            <p class="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices
              or legal requirements. We will notify users of any material changes through the portal
              or via email. Your continued use of the portal after such modifications constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold text-foreground mb-3">11. Contact Us</h2>
            <p class="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, please contact:
            </p>
            <div class="mt-3 p-4 bg-muted/50 rounded-md text-muted-foreground">
              <p class="font-medium text-foreground">Ghana Audit Service</p>
              <p>Data Protection Officer</p>
              <p>P.O. Box MB 96, Accra</p>
              <p>Email: privacy@audit.gov.gh</p>
              <p>Phone: +233 (0) 302 664928</p>
            </div>
          </section>
        </div>
      </CardContent>

      <CardFooter class="flex items-center justify-between">
        <NuxtLink
          to="/auth/login"
          class="text-primary hover:underline text-sm"
        >
          Back to Login
        </NuxtLink>
        <NuxtLink
          to="/terms"
          class="text-primary hover:underline text-sm"
        >
          Terms of Service
        </NuxtLink>
      </CardFooter>
    </Card>
  </div>
</template>

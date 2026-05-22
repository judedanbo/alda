<script setup lang="ts">
const faqs = [
  {
    question: 'What documents do I need to register?',
    answer:
      "You'll need your Ghana Card (front and back images), a valid email address, and a phone number. During registration, you'll upload photos of your Ghana Card for identity verification.",
  },
  {
    question: 'How long does the declaration process take?',
    answer:
      'The timeline varies by review workload. The portal tracks the status of your declaration at each stage, so you always know exactly where it stands — from submission through review to final receipt.',
  },
  {
    question: 'What happens after I submit my declaration?',
    answer:
      'Your declaration enters the review pipeline. A Schedule Officer processes the submission, then the Legal Unit verifies authenticity. Once approved and sealed, you receive an official receipt.',
  },
  {
    question: 'What if I lose my declaration form?',
    answer:
      'You can request a form reissue through the portal. The process requires offline approval from the Auditor General or a Regional Auditor. Once approved, a Legal Unit officer records the decision and reissues your form.',
  },
  {
    question: 'Is my declaration information confidential?',
    answer:
      'Yes. All declaration data is handled in accordance with constitutional requirements and data protection standards. Access is strictly limited to authorized officers, and all actions are logged in a tamper-proof audit trail.',
  },
]
</script>

<template>
  <section class="py-20 bg-muted/50">
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-foreground mb-4">
          Frequently Asked Questions
        </h2>
        <p class="text-muted-foreground">
          Everything you need to know about the declaration process
        </p>
      </div>

      <Accordion type="single" collapsible class="space-y-3">
        <AccordionItem
          v-for="(faq, index) in faqs"
          :key="index"
          :value="`faq-${index}`"
          class="bg-card rounded-xl border px-5"
        >
          <AccordionTrigger class="text-left font-semibold text-sm">
            {{ faq.question }}
          </AccordionTrigger>
          <AccordionContent class="text-sm text-muted-foreground leading-relaxed">
            {{ faq.answer }}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </section>
</template>

<script setup lang="ts">
const faqs = [
  {
    question: 'When am I required to declare under Act 550?',
    answer:
      'Section 1(4) of Act 550 requires a declaration before taking office, at the end of every four years in office, and at the end of your term. Each declaration must be submitted not later than six months from the date of the triggering event.',
  },
  {
    question: 'What properties and liabilities must I declare?',
    answer:
      'Section 4 covers lands, houses and buildings; farms; concessions; trust or family property in which you have beneficial interest; vehicles, plant and machinery, fishing boats and generating plants; business interests; securities and bank balances; bonds and treasury bills; jewellery and objects of art valued at ¢5 million or above; life and other insurance policies; and any other items listed on the Schedule II form. All liabilities — loans, overdrafts, mortgages and unpaid bills — must also be declared.',
  },
  {
    question: 'Who is required to declare?',
    answer:
      'Schedule I of Act 550 lists the offices subject to declaration, including the President and Vice-President, Speaker, MPs, Ministers and Deputies, Chief Justice and judges, Ambassadors, heads of MDAs, MMDA Chief Executives, senior officers of revenue and security services, and any public officer whose salary equals or exceeds that of a Director in the Civil Service. The Armed Forces are excluded from the asset-declaration requirement.',
  },
  {
    question: 'What documents do I need to register?',
    answer:
      "You'll need your Ghana Card (front and back images), a valid email address, and a phone number. During registration, you'll upload photos of your Ghana Card for identity verification.",
  },
  {
    question: 'What happens if I fail to declare or make a false declaration?',
    answer:
      'Under Section 7, failing to declare without reasonable excuse or knowingly making a false declaration is a contravention of Act 550. Section 8 directs complaints to the Commissioner for Human Rights and Administrative Justice (CHRAJ) — or, where the Commissioner is the subject, to the Chief Justice — who must investigate. Section 5 treats any later asset that cannot reasonably be attributed to income, gift, loan or inheritance as illegally acquired.',
  },
  {
    question: 'What happens after I submit my declaration?',
    answer:
      'Your declaration enters the review pipeline. A Schedule Officer processes the submission and reviews each section, the Legal Unit verifies authenticity, and once approved and sealed you receive an official receipt. The portal tracks every status change so you always know where things stand.',
  },
  {
    question: 'What if I lose my declaration form?',
    answer:
      'You can request a form reissue through the portal. The process requires offline approval from the Auditor-General or a Regional Auditor. Once approved, a Legal Unit officer records the decision and reissues your form.',
  },
  {
    question: 'Is my declaration information confidential?',
    answer:
      'Yes. Declarations are held by the Auditor-General and may only be produced in evidence before a competent court, a commission of inquiry under Article 278, or a CHRAJ investigator (Section 6). Access in the portal is restricted to authorised officers and every action is recorded in a tamper-proof audit trail.',
  },
]
</script>

<template>
  <section id="faq" class="py-20 bg-muted/50">
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

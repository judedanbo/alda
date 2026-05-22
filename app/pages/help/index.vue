<script setup lang="ts">
import { BookOpenIcon, ClockIcon, ArrowRightIcon } from "lucide-vue-next";
import type { HelpRole } from "~/help";
import {
  getArticlesForRole,
  getGuidesForRole,
  getFaqsForRole,
  getGlossaryForRole,
  ROLE_META,
} from "~/help";
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { currentRole, resolveRole } = useHelp();

const validTabs = ["articles", "guides", "faq", "glossary"];

const selectedRole = ref<HelpRole>(
  authStore.isAdmin
    ? resolveRole(route.query.role, currentRole.value)
    : currentRole.value,
);
const activeTab = ref(
  typeof route.query.tab === "string" && validTabs.includes(route.query.tab)
    ? route.query.tab
    : "articles",
);

watch([selectedRole, activeTab], () => {
  router.replace({
    query: { role: selectedRole.value, tab: activeTab.value },
  });
});

const articles = computed(() => getArticlesForRole(selectedRole.value));
const guides = computed(() => getGuidesForRole(selectedRole.value));
const faqs = computed(() => getFaqsForRole(selectedRole.value));
const glossaryTerms = computed(() => getGlossaryForRole(selectedRole.value));

useSeoMeta({
  title: "Help Centre - Asset Declaration Portal",
  description:
    "Guides, articles, FAQs and a glossary for the Asset Declaration Portal.",
});
</script>

<template>
  <div>
    <PageHeader
      title="Help Centre"
      description="Guides, articles, and answers — scoped to what your role needs."
    />

    <!-- Role + search -->
    <Card class="mb-6">
      <CardContent class="space-y-4 pt-6">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p class="text-foreground text-sm font-medium">
              Showing help for: {{ ROLE_META[selectedRole].label }}
            </p>
            <p class="text-muted-foreground text-xs">
              {{ ROLE_META[selectedRole].description }}
            </p>
          </div>
          <HelpRoleSwitcher v-if="authStore.isAdmin" v-model="selectedRole" />
        </div>
        <HelpSearch :role="selectedRole" />
      </CardContent>
    </Card>

    <!-- Content tabs -->
    <Tabs v-model="activeTab" class="space-y-6">
      <TabsList class="h-auto gap-1 rounded-xl bg-muted/60 p-1.5">
        <TabsTrigger
          value="articles"
          class="rounded-lg px-5 py-5 text-base font-semibold data-active:bg-primary data-active:text-primary-foreground"
          >Articles</TabsTrigger
        >
        <TabsTrigger
          value="guides"
          class="rounded-lg px-5 py-5 text-base font-semibold data-active:bg-primary data-active:text-primary-foreground"
          >Guides</TabsTrigger
        >
        <TabsTrigger
          value="faq"
          class="rounded-lg px-5 py-5 text-base font-semibold data-active:bg-primary data-active:text-primary-foreground"
          >FAQ</TabsTrigger
        >
        <TabsTrigger
          value="glossary"
          class="rounded-lg px-5 py-5 text-base font-semibold data-active:bg-primary data-active:text-primary-foreground"
          >Glossary</TabsTrigger
        >
      </TabsList>

      <!-- Articles -->
      <TabsContent value="articles" class="space-y-3">
        <p
          v-if="articles.length === 0"
          class="text-muted-foreground py-8 text-center text-sm"
        >
          No articles for this role yet.
        </p>
        <NuxtLink
          v-for="article in articles"
          :key="article.id"
          :to="`/help/articles/${article.id}`"
          class="block"
        >
          <Card class="hover:border-primary/50 transition-colors">
            <CardContent class="flex items-start gap-4 py-4">
              <div
                class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <BookOpenIcon class="size-5" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-foreground font-medium">{{ article.title }}</p>
                <p class="text-muted-foreground mt-0.5 text-sm">
                  {{ article.summary }}
                </p>
              </div>
              <ArrowRightIcon
                class="text-muted-foreground mt-1 size-4 shrink-0"
              />
            </CardContent>
          </Card>
        </NuxtLink>
      </TabsContent>

      <!-- Guides -->
      <TabsContent value="guides" class="space-y-3">
        <p
          v-if="guides.length === 0"
          class="text-muted-foreground py-8 text-center text-sm"
        >
          No guides for this role yet.
        </p>
        <NuxtLink
          v-for="guide in guides"
          :key="guide.id"
          :to="`/help/guides/${guide.id}`"
          class="block"
        >
          <Card class="hover:border-primary/50 transition-colors">
            <CardContent class="py-4">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-foreground font-medium">{{ guide.title }}</p>
                  <p class="text-muted-foreground mt-0.5 text-sm">
                    {{ guide.description }}
                  </p>
                </div>
                <Badge variant="outline" class="shrink-0">
                  {{ guide.steps.length }} steps
                </Badge>
              </div>
              <p
                v-if="guide.estimatedMinutes"
                class="text-muted-foreground mt-2 flex items-center gap-1 text-xs"
              >
                <ClockIcon class="size-3.5" />
                About {{ guide.estimatedMinutes }} min
              </p>
            </CardContent>
          </Card>
        </NuxtLink>
      </TabsContent>

      <!-- FAQ -->
      <TabsContent value="faq">
        <Card>
          <CardContent class="py-2">
            <p
              v-if="faqs.length === 0"
              class="text-muted-foreground py-6 text-center text-sm"
            >
              No FAQs for this role yet.
            </p>
            <Accordion v-else type="single" collapsible>
              <AccordionItem v-for="faq in faqs" :key="faq.id" :value="faq.id">
                <AccordionTrigger>{{ faq.question }}</AccordionTrigger>
                <AccordionContent>
                  <p class="text-muted-foreground leading-relaxed">
                    {{ faq.answer }}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Glossary -->
      <TabsContent value="glossary">
        <Card>
          <CardHeader>
            <CardTitle>Glossary</CardTitle>
            <CardDescription>
              Key terms used across the Asset Declaration Portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HelpGlossaryList :terms="glossaryTerms" />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>

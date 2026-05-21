<script setup lang="ts">
import { ArrowLeftIcon } from "lucide-vue-next";
import type { HelpArticle, HelpGuide } from "~/help";
import { getArticleById, getGuideById } from "~/help";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const article = computed(() => getArticleById(route.params.id as string));

const relatedGuides = computed<HelpGuide[]>(() =>
  (article.value?.relatedGuideIds ?? [])
    .map((id) => getGuideById(id))
    .filter((g): g is HelpGuide => !!g),
);

const relatedArticles = computed<HelpArticle[]>(() =>
  (article.value?.relatedArticleIds ?? [])
    .map((id) => getArticleById(id))
    .filter((a): a is HelpArticle => !!a),
);

useSeoMeta({
  title: () =>
    article.value
      ? `${article.value.title} - Help`
      : "Help - Asset Declaration Portal",
});
</script>

<template>
  <div>
    <NuxtLink
      to="/help"
      class="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
    >
      <ArrowLeftIcon class="size-4" />
      Back to Help Centre
    </NuxtLink>

    <!-- Not found -->
    <Card v-if="!article" class="py-12 text-center">
      <CardContent>
        <h2 class="text-foreground text-lg font-medium">Article not found</h2>
        <p class="text-muted-foreground mt-1 text-sm">
          This help article does not exist or has been moved.
        </p>
        <Button as-child class="mt-4">
          <NuxtLink to="/help">Open Help Centre</NuxtLink>
        </Button>
      </CardContent>
    </Card>

    <template v-else>
      <Card>
        <CardHeader>
          <CardTitle class="text-2xl">{{ article.title }}</CardTitle>
          <CardDescription>{{ article.summary }}</CardDescription>
        </CardHeader>
        <CardContent>
          <HelpArticleBody :blocks="article.body" />
        </CardContent>
      </Card>

      <!-- Related -->
      <div
        v-if="relatedGuides.length || relatedArticles.length"
        class="mt-6 space-y-3"
      >
        <h2 class="text-foreground text-sm font-semibold">Related</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <NuxtLink
            v-for="guide in relatedGuides"
            :key="guide.id"
            :to="`/help/guides/${guide.id}`"
          >
            <Card class="hover:border-primary/50 h-full transition-colors">
              <CardContent class="py-4">
                <Badge variant="outline" class="mb-2">Guide</Badge>
                <p class="text-foreground text-sm font-medium">
                  {{ guide.title }}
                </p>
                <p class="text-muted-foreground mt-0.5 text-xs">
                  {{ guide.description }}
                </p>
              </CardContent>
            </Card>
          </NuxtLink>
          <NuxtLink
            v-for="related in relatedArticles"
            :key="related.id"
            :to="`/help/articles/${related.id}`"
          >
            <Card class="hover:border-primary/50 h-full transition-colors">
              <CardContent class="py-4">
                <Badge variant="outline" class="mb-2">Article</Badge>
                <p class="text-foreground text-sm font-medium">
                  {{ related.title }}
                </p>
                <p class="text-muted-foreground mt-0.5 text-xs">
                  {{ related.summary }}
                </p>
              </CardContent>
            </Card>
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PlayIcon, LifeBuoyIcon } from "lucide-vue-next";
import { getContextualHelp, getArticleById, getGuideById } from "~/help";
import { useHelpStore } from "~/stores/help";

const helpStore = useHelpStore();
const route = useRoute();
const { start } = useTour();

const open = computed({
  get: () => helpStore.contextualOpen,
  set: (v: boolean) =>
    v ? helpStore.openContextual() : helpStore.closeContextual(),
});

const help = computed(() => getContextualHelp(route.path));

interface ReadMoreLink {
  kind: string;
  title: string;
  to: string;
}

const readMore = computed<ReadMoreLink[]>(() => {
  if (!help.value) return [];
  const links: ReadMoreLink[] = [];
  for (const id of help.value.articleIds ?? []) {
    const a = getArticleById(id);
    if (a) {
      links.push({ kind: "Article", title: a.title, to: `/help/articles/${a.id}` });
    }
  }
  for (const id of help.value.guideIds ?? []) {
    const g = getGuideById(id);
    if (g) {
      links.push({ kind: "Guide", title: g.title, to: `/help/guides/${g.id}` });
    }
  }
  return links;
});

// Close the panel on any navigation (read-more link, tour navigation).
watch(
  () => route.fullPath,
  () => helpStore.closeContextual(),
);

function startTour(tourId: string) {
  helpStore.closeContextual();
  start(tourId);
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-md">
      <SheetHeader>
        <SheetTitle>{{ help ? help.title : "Help" }}</SheetTitle>
        <SheetDescription>
          {{
            help
              ? help.summary
              : "Browse the help centre for guides and answers."
          }}
        </SheetDescription>
      </SheetHeader>

      <div class="flex-1 space-y-6 overflow-y-auto p-4">
        <template v-if="help">
          <HelpArticleBody :blocks="help.blocks" />

          <Button
            v-if="help.tourId"
            variant="outline"
            class="w-full"
            @click="startTour(help.tourId)"
          >
            <PlayIcon class="size-4" />
            Start a tour of this page
          </Button>

          <div v-if="readMore.length" class="space-y-2">
            <p class="text-foreground text-sm font-semibold">Read more</p>
            <NuxtLink
              v-for="link in readMore"
              :key="link.to"
              :to="link.to"
              class="hover:border-primary/50 hover:bg-muted/40 flex flex-col gap-0.5 rounded-md border p-2.5 transition-colors"
            >
              <Badge variant="outline" class="w-fit">{{ link.kind }}</Badge>
              <span class="text-foreground text-sm font-medium">
                {{ link.title }}
              </span>
            </NuxtLink>
          </div>
        </template>

        <p v-else class="text-muted-foreground text-sm">
          There is no page-specific help here yet. The Help Centre has guides,
          articles, FAQs and a glossary for your role.
        </p>
      </div>

      <SheetFooter>
        <Button as-child variant="secondary" class="w-full">
          <NuxtLink to="/help">
            <LifeBuoyIcon class="size-4" />
            Open the Help Centre
          </NuxtLink>
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>

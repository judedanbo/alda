<script setup lang="ts">
import { SearchIcon } from "lucide-vue-next";
import type { HelpRole, HelpSearchKind } from "~/help";
import { searchHelp } from "~/help";

const props = defineProps<{ role?: HelpRole }>();

const query = ref("");
const results = computed(() => searchHelp(query.value, props.role).slice(0, 12));

const kindLabel: Record<HelpSearchKind, string> = {
  article: "Article",
  guide: "Guide",
  faq: "FAQ",
  glossary: "Term",
};
</script>

<template>
  <div class="space-y-3">
    <div class="relative">
      <SearchIcon
        class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <Input
        v-model="query"
        type="search"
        placeholder="Search articles, guides, FAQs and the glossary..."
        class="pl-9"
      />
    </div>

    <div v-if="query.trim()" class="overflow-hidden rounded-lg border">
      <p
        v-if="results.length === 0"
        class="text-muted-foreground p-4 text-sm"
      >
        No results for "{{ query.trim() }}".
      </p>
      <ul v-else class="divide-y">
        <li v-for="r in results" :key="r.kind + r.id">
          <NuxtLink
            :to="r.to"
            class="hover:bg-muted/50 flex flex-col gap-1 p-3 transition-colors"
          >
            <div class="flex items-center gap-2">
              <Badge variant="outline" class="shrink-0">
                {{ kindLabel[r.kind] }}
              </Badge>
              <span class="text-foreground text-sm font-medium">
                {{ r.title }}
              </span>
            </div>
            <span class="text-muted-foreground text-xs">{{ r.snippet }}</span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeftIcon } from "lucide-vue-next";
import { glossary, getGlossaryForRole } from "~/help";
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
});

const authStore = useAuthStore();
const { currentRole } = useHelp();

if (!authStore.isAuthenticated) {
  setPageLayout("auth");
}

const filteredGlossary = computed(() =>
  authStore.isAdmin ? glossary : getGlossaryForRole(currentRole.value),
);

useSeoMeta({
  title: "Glossary - Asset Declaration Portal",
  description: "Definitions of the key terms used in the Asset Declaration Portal.",
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

    <Card>
      <CardHeader>
        <CardTitle class="text-2xl">Glossary</CardTitle>
        <CardDescription>
          Definitions of the key terms used across the Asset Declaration Portal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <HelpGlossaryList :terms="filteredGlossary" />
      </CardContent>
    </Card>
  </div>
</template>

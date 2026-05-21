<script setup lang="ts">
import { ArrowLeftIcon } from "lucide-vue-next";
import { glossary } from "~/help";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

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
        <HelpGlossaryList :terms="glossary" />
      </CardContent>
    </Card>
  </div>
</template>

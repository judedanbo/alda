<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Settings"
      description="Override global application behaviour at runtime. Environment values remain the fallback."
    />
    <AdminSystemSettings />
  </div>
</template>

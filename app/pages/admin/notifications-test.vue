<script setup lang="ts">
// The send-test form + SMTP check moved into the Notifications hub's Tools tab.
// Keep this route working by redirecting to it.
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

await navigateTo("/admin/notifications?tab=tools", { redirectCode: 301 });
</script>

<template>
  <div />
</template>

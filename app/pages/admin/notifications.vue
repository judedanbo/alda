<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const router = useRouter();

const VALID_TABS = ["overview", "log", "settings", "tools"] as const;
type Tab = (typeof VALID_TABS)[number];

const initial = String(route.query.tab ?? "");
const activeTab = ref<Tab>(
  (VALID_TABS as readonly string[]).includes(initial) ? (initial as Tab) : "overview",
);

// Persist the active tab in the URL so the old /admin/notifications-test
// redirect can deep-link straight to the Tools tab.
watch(activeTab, (t) => {
  router.replace({ query: { ...route.query, tab: t } });
});

const overviewRef = ref<{ refresh: () => void } | null>(null);
// After a retry, refresh the Overview metrics so KPIs reflect the change.
function onChanged() {
  overviewRef.value?.refresh?.();
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Notifications"
      description="Monitor sent notifications and delivery status, retry failures, and run email/SMS tools."
    />

    <Tabs v-model="activeTab" default-value="overview" class="flex-col">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="log">Log</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="tools">Tools</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" class="pt-4">
        <AdminNotificationOverview ref="overviewRef" />
      </TabsContent>
      <TabsContent value="log" class="pt-4">
        <AdminNotificationLog @changed="onChanged" />
      </TabsContent>
      <TabsContent value="settings" class="pt-4">
        <AdminNotificationSettings />
      </TabsContent>
      <TabsContent value="tools" class="pt-4">
        <AdminNotificationTools />
      </TabsContent>
    </Tabs>
  </div>
</template>

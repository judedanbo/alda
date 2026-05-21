export default defineNuxtPlugin(async (nuxtApp) => {
  const VueApexCharts = (await import("vue3-apexcharts")).default;
  nuxtApp.vueApp.use(VueApexCharts);
});

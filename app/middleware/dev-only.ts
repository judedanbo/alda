export default defineNuxtRouteMiddleware(() => {
  if (!useRuntimeConfig().public.devMode) {
    return abortNavigation(createError({ statusCode: 404, statusMessage: "Not Found" }));
  }
});

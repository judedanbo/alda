<script setup lang="ts">
const config = useRuntimeConfig();

// Runs synchronously in <head> before first paint. Mirrors what
// stores/accessibility.ts does, but with no Vue/Pinia available yet — so it
// has to be inline JS reading localStorage directly. Keep the storage key
// and class names here aligned with utils/accessibility.ts.
const a11yFoucScript = `(function(){try{
var raw=localStorage.getItem('adla-a11y');var p=raw?JSON.parse(raw):null;
var sizes=['base','lg','xl','2xl'];
var size=p&&sizes.indexOf(p.textSize)!==-1?p.textSize:'base';
var html=document.documentElement;
html.setAttribute('data-a11y-text-size',size);
if(p&&p.reduceMotion)html.classList.add('a11y-reduce-motion');
else if(!p&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)html.classList.add('a11y-reduce-motion');
if(p&&p.underlineLinks)html.classList.add('a11y-underline-links');
if(p&&p.readableFont)html.classList.add('a11y-readable-font');
}catch(e){}})();`;

useHead({
  title: "Asset Declaration Portal",
  meta: [
    { name: "description", content: "Ghana Asset Declaration System under Article 286(5)" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "color-scheme", content: "light dark" },
  ],
  htmlAttrs: {
    lang: "en",
  },
  script: [
    { innerHTML: a11yFoucScript, tagPosition: "head", tagPriority: "critical" },
  ],
});
</script>

<template>
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ring"
  >
    Skip to main content
  </a>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <AppAccessibilityWidget />
    <DevUserSwitcher v-if="config.public.devMode" />
  </ClientOnly>
</template>

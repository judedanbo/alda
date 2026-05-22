import { defineStore } from "pinia";
import { ref } from "vue";

// Drives the contextual help slide-over. Content is route-derived, so the
// store only needs to track whether the panel is open.
export const useHelpStore = defineStore("help", () => {
  const contextualOpen = ref(false);

  function openContextual() {
    contextualOpen.value = true;
  }

  function closeContextual() {
    contextualOpen.value = false;
  }

  return { contextualOpen, openContextual, closeContextual };
});

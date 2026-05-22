<script setup lang="ts">
withDefaults(defineProps<{
  opacity?: number
  patternSize?: number
}>(), {
  opacity: 0.06,
  patternSize: 40,
})
</script>

<template>
  <div class="absolute inset-0 pointer-events-none" :style="{ opacity }">
    <svg
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="kente"
          x="0"
          y="0"
          :width="patternSize"
          :height="patternSize"
          patternUnits="userSpaceOnUse"
        >
          <rect
            :width="patternSize / 2"
            :height="patternSize / 2"
            fill="#FCD116"
          />
          <rect
            :x="patternSize / 2"
            :y="patternSize / 2"
            :width="patternSize / 2"
            :height="patternSize / 2"
            fill="#FCD116"
          />
          <rect
            :x="patternSize / 2"
            :width="patternSize / 2"
            :height="patternSize / 2"
            fill="#CE1126"
          />
          <rect
            :y="patternSize / 2"
            :width="patternSize / 2"
            :height="patternSize / 2"
            fill="#CE1126"
          />
          <line
            x1="0"
            y1="0"
            :x2="patternSize"
            :y2="patternSize"
            stroke="white"
            stroke-width="1"
          />
          <line
            :x1="patternSize"
            y1="0"
            x2="0"
            :y2="patternSize"
            stroke="white"
            stroke-width="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#kente)" />
    </svg>
  </div>
</template>

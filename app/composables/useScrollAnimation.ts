import { useIntersectionObserver, usePreferredReducedMotion } from '@vueuse/core'
import { ref, type Ref } from 'vue'

export function useScrollAnimation(
  target: Ref<HTMLElement | null>,
  options: { threshold?: number; delay?: number } = {},
) {
  const { threshold = 0.2, delay = 0 } = options
  const isVisible = ref(false)
  const prefersReducedMotion = usePreferredReducedMotion()

  useIntersectionObserver(
    target,
    ([entry]) => {
      if (entry?.isIntersecting) {
        if (prefersReducedMotion.value === 'reduce') {
          isVisible.value = true
        } else {
          setTimeout(() => {
            isVisible.value = true
          }, delay)
        }
      }
    },
    { threshold },
  )

  return { isVisible, prefersReducedMotion }
}

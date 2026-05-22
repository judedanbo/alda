import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Avatar } from './Avatar.vue'

export const avatarVariants = cva(
  'relative inline-flex shrink-0 select-none overflow-hidden rounded-full',
  {
    variants: {
      size: {
        sm: 'size-8 text-xs',
        default: 'size-12 text-sm',
        lg: 'size-16 text-lg',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)
export type AvatarVariants = VariantProps<typeof avatarVariants>

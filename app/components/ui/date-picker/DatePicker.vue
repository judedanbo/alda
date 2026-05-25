<script setup lang="ts">
import type { DateValue } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import {
  CalendarDate,
  CalendarDateTime,
  DateFormatter,
  getLocalTimeZone,
  parseDate,
  parseDateTime,
  today,
} from '@internationalized/date'
import { CalendarIcon } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Granularity = 'day' | 'minute'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  defaultValue?: string
  placeholder?: string
  /** "day" stores YYYY-MM-DD, "minute" stores YYYY-MM-DDTHH:mm */
  granularity?: Granularity
  disabled?: boolean
  /** ISO date string for the earliest selectable date. */
  min?: string
  /** ISO date string for the latest selectable date. */
  max?: string
  id?: string
  class?: HTMLAttributes['class']
  triggerClass?: HTMLAttributes['class']
  /** Render the trigger as full-width (matches Input width). */
  block?: boolean
  /** Visible weeks have outside-of-month days hidden. */
  fixedWeeks?: boolean
  /** Display format override; defaults to a locale-friendly format. */
  format?: Intl.DateTimeFormatOptions
}>(), {
  granularity: 'day',
  placeholder: 'Select a date',
  fixedWeeks: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
}>()

const open = ref(false)

const isDateTime = computed(() => props.granularity === 'minute')

function parseValue(value: string | null | undefined): CalendarDate | CalendarDateTime | undefined {
  if (!value)
    return undefined
  try {
    return isDateTime.value ? parseDateTime(value) : parseDate(value)
  }
  catch {
    // Permit a YYYY-MM-DD string in datetime mode by widening it.
    if (isDateTime.value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      try {
        const d = parseDate(value)
        return new CalendarDateTime(d.year, d.month, d.day)
      }
      catch {
        return undefined
      }
    }
    return undefined
  }
}

const internal = ref<CalendarDate | CalendarDateTime | undefined>(
  parseValue(props.modelValue ?? props.defaultValue ?? null),
)

watch(
  () => props.modelValue,
  (value) => {
    internal.value = parseValue(value)
  },
)

const dateFormatter = computed(() => new DateFormatter('en-US', props.format ?? {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  ...(isDateTime.value ? { hour: '2-digit', minute: '2-digit' } : {}),
}))

const formatted = computed(() => {
  if (!internal.value)
    return ''
  return dateFormatter.value.format(internal.value.toDate(getLocalTimeZone()))
})

const minDate = computed(() => parseValue(props.min))
const maxDate = computed(() => parseValue(props.max))

function toIsoString(value: CalendarDate | CalendarDateTime | undefined): string | null {
  if (!value)
    return null
  if (value instanceof CalendarDateTime)
    // Format: YYYY-MM-DDTHH:mm (drop seconds for native-input compatibility).
    return value.toString().slice(0, 16)
  return value.toString()
}

function onCalendarUpdate(next: DateValue | undefined) {
  if (!next) {
    internal.value = undefined
    emit('update:modelValue', null)
    return
  }
  if (isDateTime.value) {
    const existing = internal.value instanceof CalendarDateTime
      ? internal.value
      : new CalendarDateTime(next.year, next.month, next.day, 0, 0)
    const merged = new CalendarDateTime(
      next.year,
      next.month,
      next.day,
      existing.hour,
      existing.minute,
    )
    internal.value = merged
    emit('update:modelValue', toIsoString(merged))
    return
  }
  // Day granularity — store as CalendarDate (YYYY-MM-DD).
  const calendarDate = next instanceof CalendarDate
    ? next
    : new CalendarDate(next.year, next.month, next.day)
  internal.value = calendarDate
  emit('update:modelValue', toIsoString(calendarDate))
  open.value = false
}

const timeValue = computed({
  get(): string {
    if (!(internal.value instanceof CalendarDateTime))
      return ''
    const h = String(internal.value.hour).padStart(2, '0')
    const m = String(internal.value.minute).padStart(2, '0')
    return `${h}:${m}`
  },
  set(value: string) {
    if (!value)
      return
    const [h, m] = value.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m))
      return
    const base = internal.value instanceof CalendarDateTime
      ? internal.value
      : internal.value instanceof CalendarDate
        ? new CalendarDateTime(internal.value.year, internal.value.month, internal.value.day, 0, 0)
        : (() => {
            const t = today(getLocalTimeZone())
            return new CalendarDateTime(t.year, t.month, t.day, 0, 0)
          })()
    const updated = new CalendarDateTime(base.year, base.month, base.day, h, m)
    internal.value = updated
    emit('update:modelValue', toIsoString(updated))
  },
})

function clear() {
  internal.value = undefined
  emit('update:modelValue', null)
}

const placeholderDate = computed(() => internal.value ?? today(getLocalTimeZone()))

const calendarModel = computed<DateValue | undefined>(() => internal.value as unknown as DateValue | undefined)
const calendarPlaceholder = computed<DateValue>(() => placeholderDate.value as unknown as DateValue)
const calendarMin = computed<DateValue | undefined>(() => minDate.value as unknown as DateValue | undefined)
const calendarMax = computed<DateValue | undefined>(() => maxDate.value as unknown as DateValue | undefined)
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        :id="id"
        type="button"
        variant="outline"
        :disabled="disabled"
        data-slot="date-picker-trigger"
        :class="cn(
          'h-8 justify-start gap-2 px-2.5 font-normal text-sm',
          block && 'w-full',
          !internal && 'text-muted-foreground',
          props.triggerClass,
          props.class,
        )"
      >
        <CalendarIcon class="size-4 opacity-60" />
        <span class="truncate">
          {{ formatted || placeholder }}
        </span>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar
        :model-value="calendarModel"
        :placeholder="calendarPlaceholder"
        :min-value="calendarMin"
        :max-value="calendarMax"
        :fixed-weeks="fixedWeeks"
        @update:model-value="onCalendarUpdate"
      />
      <div v-if="isDateTime" class="flex items-center justify-between gap-2 border-t px-3 py-2">
        <span class="text-xs text-muted-foreground">Time</span>
        <Input
          v-model="timeValue"
          type="time"
          class="h-7 w-32"
        />
      </div>
      <div v-if="internal" class="flex items-center justify-end gap-2 border-t px-3 py-2">
        <Button size="sm" variant="ghost" @click="clear">
          Clear
        </Button>
        <Button size="sm" @click="open = false">
          Done
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>

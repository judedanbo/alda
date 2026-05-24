<script setup lang="ts">
import type { CalendarDate } from '@internationalized/date'
import type { DateRange, DateValue } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import {
  DateFormatter,
  getLocalTimeZone,
  parseDate,
  today,
} from '@internationalized/date'
import { CalendarIcon } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RangeCalendar } from '@/components/ui/range-calendar'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  from?: string | null
  to?: string | null
  placeholder?: string
  disabled?: boolean
  min?: string
  max?: string
  id?: string
  class?: HTMLAttributes['class']
  triggerClass?: HTMLAttributes['class']
  block?: boolean
  /** Show two months side-by-side. */
  numberOfMonths?: number
}>(), {
  placeholder: 'Pick a date range',
  numberOfMonths: 2,
})

const emit = defineEmits<{
  (e: 'update:from' | 'update:to', value: string | null): void
}>()

const open = ref(false)

function parseValue(value: string | null | undefined): CalendarDate | undefined {
  if (!value)
    return undefined
  try {
    return parseDate(value)
  }
  catch {
    return undefined
  }
}

const internal = ref<DateRange>({
  start: parseValue(props.from),
  end: parseValue(props.to),
})

watch(
  () => [props.from, props.to],
  ([from, to]) => {
    internal.value = {
      start: parseValue(from),
      end: parseValue(to),
    }
  },
)

const dateFormatter = new DateFormatter('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const formatted = computed(() => {
  const { start, end } = internal.value
  if (!start && !end)
    return ''
  const tz = getLocalTimeZone()
  if (start && !end)
    return `${dateFormatter.format(start.toDate(tz))} – …`
  if (!start && end)
    return `… – ${dateFormatter.format(end.toDate(tz))}`
  return `${dateFormatter.format(start!.toDate(tz))} – ${dateFormatter.format(end!.toDate(tz))}`
})

const minDate = computed(() => parseValue(props.min))
const maxDate = computed(() => parseValue(props.max))

function onRangeUpdate(next: DateRange) {
  internal.value = next
  emit('update:from', next.start ? next.start.toString() : null)
  emit('update:to', next.end ? next.end.toString() : null)
}

function clear() {
  internal.value = { start: undefined, end: undefined }
  emit('update:from', null)
  emit('update:to', null)
}

const placeholderDate = computed(() => internal.value.start ?? today(getLocalTimeZone()))

const calendarPlaceholder = computed<DateValue>(() => placeholderDate.value as unknown as DateValue)
const calendarMin = computed<DateValue | undefined>(() => minDate.value as unknown as DateValue | undefined)
const calendarMax = computed<DateValue | undefined>(() => maxDate.value as unknown as DateValue | undefined)
const calendarRange = computed<DateRange>(() => internal.value as unknown as DateRange)
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        :id="id"
        type="button"
        variant="outline"
        :disabled="disabled"
        data-slot="date-range-picker-trigger"
        :class="cn(
          'h-8 justify-start gap-2 px-2.5 font-normal text-sm',
          block && 'w-full',
          !internal.start && !internal.end && 'text-muted-foreground',
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
      <RangeCalendar
        :model-value="calendarRange"
        :placeholder="calendarPlaceholder"
        :min-value="calendarMin"
        :max-value="calendarMax"
        :number-of-months="numberOfMonths"
        @update:model-value="onRangeUpdate"
      />
      <div v-if="internal.start || internal.end" class="flex items-center justify-end gap-2 border-t px-3 py-2">
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

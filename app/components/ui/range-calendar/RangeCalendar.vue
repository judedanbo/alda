<script setup lang="ts">
import type { RangeCalendarRootEmits, RangeCalendarRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { RangeCalendarRoot, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'
import {
  RangeCalendarCell,
  RangeCalendarCellTrigger,
  RangeCalendarGrid,
  RangeCalendarGridBody,
  RangeCalendarGridHead,
  RangeCalendarGridRow,
  RangeCalendarHeadCell,
  RangeCalendarHeader,
  RangeCalendarHeading,
  RangeCalendarNext,
  RangeCalendarPrev,
} from '.'

const props = defineProps<RangeCalendarRootProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<RangeCalendarRootEmits>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <RangeCalendarRoot
    v-slot="{ grid, weekDays }"
    data-slot="range-calendar"
    :class="cn('p-3', props.class)"
    v-bind="forwarded"
  >
    <RangeCalendarHeader>
      <RangeCalendarPrev />
      <RangeCalendarHeading />
      <RangeCalendarNext />
    </RangeCalendarHeader>
    <div class="mt-3 flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
      <RangeCalendarGrid v-for="month in grid" :key="month.value.toString()">
        <RangeCalendarGridHead>
          <RangeCalendarGridRow>
            <RangeCalendarHeadCell v-for="day in weekDays" :key="day">
              {{ day }}
            </RangeCalendarHeadCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridHead>
        <RangeCalendarGridBody>
          <RangeCalendarGridRow
            v-for="(weekDates, index) in month.rows"
            :key="`weekDate-${index}`"
            class="mt-2 w-full"
          >
            <RangeCalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
            >
              <RangeCalendarCellTrigger :day="weekDate" :month="month.value" />
            </RangeCalendarCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridBody>
      </RangeCalendarGrid>
    </div>
  </RangeCalendarRoot>
</template>

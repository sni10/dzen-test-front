<script setup lang="ts">
import type { Comment } from '@/api/types'
import AppIcon from '@/components/ui/AppIcon.vue'
import type { SortColumn, SortState } from '@/utils/sort'

import CommentThread from './CommentThread.vue'

defineProps<{ comments: Comment[]; sort: SortState; loading?: boolean }>()
const emit = defineEmits<{ sort: [column: SortColumn] }>()

const COLUMNS: { column: SortColumn; label: string; width: string }[] = [
  { column: 'user_name', label: 'User Name', width: 'sm:w-40 sm:shrink-0' },
  { column: 'email', label: 'E-mail', width: 'sm:w-52 sm:shrink-0' },
  { column: 'created_at', label: 'Date', width: 'sm:w-36 sm:shrink-0' },
]
</script>

<template>
  <section>
    <!-- Column header of the table: aligned with the name / e-mail / date of top-level comments -->
    <div
      class="sticky top-0 z-10 flex items-center gap-x-4 rounded-xl border border-line bg-card/95 px-3 py-2 sm:px-7 text-sm font-semibold backdrop-blur"
      role="toolbar"
      aria-label="Sort comments"
    >
      <span class="hidden w-11 sm:block" aria-hidden="true" />
      <div class="flex flex-1 flex-wrap gap-x-4 gap-y-1 sm:flex-nowrap">
        <button
          v-for="item in COLUMNS"
          :key="item.column"
          type="button"
          class="flex items-center gap-1 rounded-md text-left transition-colors hover:text-accent"
          :class="[item.width, sort.column === item.column ? 'text-accent' : 'text-muted']"
          :aria-pressed="sort.column === item.column"
          :aria-label="`Sort by ${item.label}`"
          @click="emit('sort', item.column)"
        >
          {{ item.label }}
          <AppIcon
            v-if="sort.column === item.column"
            :name="sort.descending ? 'sortDesc' : 'sortAsc'"
            :size="14"
          />
        </button>
      </div>
    </div>

    <div class="mt-4 space-y-6 transition-opacity" :class="{ 'opacity-50': loading }">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="rounded-2xl border border-line bg-card p-3 shadow-sm sm:p-4"
      >
        <CommentThread :comment="comment" top-level />
      </div>
    </div>
  </section>
</template>

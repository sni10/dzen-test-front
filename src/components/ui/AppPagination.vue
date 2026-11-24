<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from './AppIcon.vue'

const props = defineProps<{ page: number; pageCount: number }>()
const emit = defineEmits<{ change: [page: number] }>()

/** 1 … 4 5 [6] 7 8 … 20 */
const pages = computed<(number | null)[]>(() => {
  const { page, pageCount } = props
  const wanted = new Set([1, pageCount, page - 2, page - 1, page, page + 1, page + 2])
  const list = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)
  const result: (number | null)[] = []
  list.forEach((p, index) => {
    if (index > 0 && p - list[index - 1]! > 1) result.push(null)
    result.push(p)
  })
  return result
})
</script>

<template>
  <nav v-if="pageCount > 1" class="flex items-center justify-center gap-1" aria-label="Pages">
    <button
      type="button"
      class="page-button"
      :disabled="page <= 1"
      aria-label="Previous page"
      @click="emit('change', page - 1)"
    >
      <AppIcon name="chevronLeft" />
    </button>
    <template v-for="(item, index) in pages" :key="item ?? `gap-${index}`">
      <span v-if="item === null" class="px-2 text-muted">…</span>
      <button
        v-else
        type="button"
        class="page-button"
        :class="{ 'bg-accent text-white hover:bg-accent': item === page }"
        :aria-current="item === page ? 'page' : undefined"
        @click="emit('change', item)"
      >
        {{ item }}
      </button>
    </template>
    <button
      type="button"
      class="page-button"
      :disabled="page >= pageCount"
      aria-label="Next page"
      @click="emit('change', page + 1)"
    >
      <AppIcon name="chevronRight" />
    </button>
  </nav>
</template>

<style scoped>
@reference '@/assets/main.css';

.page-button {
  @apply inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium text-ink transition-colors hover:bg-card-header disabled:pointer-events-none disabled:opacity-40;
}
</style>

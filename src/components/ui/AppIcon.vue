<script setup lang="ts">
// Line icons (24x24, stroke) for the comment header, close to the reference
const PATHS = {
  hash: 'M5 9h14M5 15h14M10 3 8 21M16 3l-2 18',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  reply: 'M7 4v9a4 4 0 0 0 4 4h8M15 13l4 4-4 4',
  parent: 'M12 16V8M8.5 11.5 12 8l3.5 3.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  sortAsc: 'M12 19V5M7 10l5-5 5 5',
  sortDesc: 'M12 5v14M7 14l5 5 5-5',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
} as const

export type IconName = keyof typeof PATHS

defineProps<{ name: IconName; size?: number }>()
</script>

<template>
  <svg
    :width="size ?? 18"
    :height="size ?? 18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>

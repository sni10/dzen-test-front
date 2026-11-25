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
  close: 'M6 6l12 12M18 6 6 18',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  paperclip:
    'M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15.5 8',
  refresh: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
} as const

export type IconName = keyof typeof PATHS

defineProps<{ name: IconName; size?: number; filled?: boolean }>()
</script>

<template>
  <svg
    :width="size ?? 18"
    :height="size ?? 18"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>

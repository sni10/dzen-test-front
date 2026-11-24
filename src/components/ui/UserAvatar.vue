<script setup lang="ts">
import { computed } from 'vue'

import { avatarColor, initials } from '@/utils/avatar'

const props = defineProps<{ name: string; size?: number }>()

const style = computed(() => {
  const size = props.size ?? 44
  return {
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${Math.round(size * 0.38)}px`,
    background: avatarColor(props.name),
  }
})
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-ink/80 ring-2 ring-white shadow-sm select-none"
    :style="style"
    aria-hidden="true"
  >
    {{ initials(name) }}
  </span>
</template>

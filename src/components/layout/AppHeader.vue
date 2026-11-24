<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useLiveStore } from '@/stores/live'

const live = useLiveStore()

const indicator = computed(
  () =>
    ({
      online: { label: 'Live', dot: 'bg-emerald-500' },
      connecting: { label: 'Connecting…', dot: 'bg-amber-400 animate-pulse' },
      offline: { label: 'Reconnecting…', dot: 'bg-amber-400 animate-pulse' },
    })[live.status],
)
</script>

<template>
  <header class="border-b border-line bg-card">
    <div class="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
      <RouterLink to="/" class="text-lg font-bold text-ink hover:text-accent">Comments</RouterLink>
      <span
        class="flex items-center gap-2 text-xs text-muted"
        role="status"
        :title="live.status === 'online' ? 'New comments appear without reloading' : ''"
      >
        <span class="h-2 w-2 rounded-full" :class="indicator.dot" aria-hidden="true" />
        {{ indicator.label }}
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { Attachment } from '@/api/types'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useLightboxStore } from '@/stores/lightbox'
import { useLiveStore } from '@/stores/live'
import { formatSize } from '@/utils/format'

const props = defineProps<{ commentId: string; attachments: Attachment[] }>()

const lightbox = useLightboxStore()
const live = useLiveStore()

/** The loaded attachments, replaced by their live updates (attachment.updated: an image finished resizing) */
const items = computed(() => {
  const updates = live.attachments[props.commentId] ?? []
  const merged = props.attachments.map(
    (item) => updates.find((update) => update.id === item.id) ?? item,
  )
  return [...merged, ...updates.filter((update) => !merged.some((item) => item.id === update.id))]
})
</script>

<template>
  <ul v-if="items.length" class="mt-3 flex flex-wrap gap-3">
    <li v-for="item in items" :key="item.id">
      <div
        v-if="item.status === 'processing'"
        class="flex h-24 w-32 animate-pulse items-center justify-center rounded-lg bg-card-header text-xs text-muted"
        role="status"
      >
        Processing image…
      </div>
      <p v-else-if="item.status === 'failed'" class="text-sm text-danger">
        {{ item.originalName }}: the file could not be processed
      </p>
      <button
        v-else-if="item.kind === 'image'"
        type="button"
        class="group block overflow-hidden rounded-lg border border-line bg-card-header transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent"
        :data-lightbox-url="item.url"
        data-lightbox-kind="image"
        :data-lightbox-name="item.originalName"
        :aria-label="`Open image ${item.originalName}`"
        @click="lightbox.open(item.url)"
      >
        <img
          :src="item.url"
          :alt="item.originalName"
          :width="item.width ?? undefined"
          :height="item.height ?? undefined"
          loading="lazy"
          class="max-h-32 w-auto transition-transform duration-300 group-hover:scale-105"
        />
      </button>
      <button
        v-else
        type="button"
        class="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
        :data-lightbox-url="item.url"
        data-lightbox-kind="text"
        :data-lightbox-name="item.originalName"
        :aria-label="`Open text file ${item.originalName}`"
        @click="lightbox.open(item.url)"
      >
        <AppIcon name="file" :size="18" />
        <span class="max-w-48 truncate">{{ item.originalName }}</span>
        <span class="text-muted">{{ formatSize(item.size) }}</span>
      </button>
    </li>
  </ul>
</template>

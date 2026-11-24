<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { fetchAttachments } from '@/api/comments'
import type { Attachment } from '@/api/types'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useLightboxStore } from '@/stores/lightbox'
import { formatSize } from '@/utils/format'

const POLL_MS = 1500
const POLL_TRIES = 20

const props = defineProps<{ commentId: string; attachments: Attachment[] }>()

const lightbox = useLightboxStore()
const items = ref<Attachment[]>(props.attachments)
const processing = computed(() => items.value.some((item) => item.status === 'processing'))

// ponytail: polls while an image is being resized; replace with the WebSocket attachment.ready event
let timer: ReturnType<typeof setTimeout> | undefined
let tries = 0

async function poll() {
  tries += 1
  try {
    items.value = await fetchAttachments(props.commentId)
  } catch {
    // a missed poll is fine, the next one or a reload catches up
  }
  schedule()
}

function schedule() {
  clearTimeout(timer)
  if (processing.value && tries < POLL_TRIES) timer = setTimeout(poll, POLL_MS)
}

watch(
  () => props.attachments,
  (next) => {
    items.value = next
    tries = 0
    schedule()
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(timer))
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

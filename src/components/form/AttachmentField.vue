<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import AppIcon from '@/components/ui/AppIcon.vue'
import { formatSize } from '@/utils/format'
import { ACCEPT, attachmentKind } from '@/utils/validation'

defineProps<{ error?: string; inputId: string }>()
const file = defineModel<File | null>({ required: true })
const emit = defineEmits<{ change: [] }>()

const input = ref<HTMLInputElement | null>(null)
const previewUrl = ref<string | null>(null)
const kind = computed(() => (file.value ? attachmentKind(file.value) : null))

// A local thumbnail of the chosen image; the server fits it into 320x240 after posting
watch(file, (next) => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = next && attachmentKind(next) === 'image' ? URL.createObjectURL(next) : null
  if (!next && input.value) input.value.value = ''
})
onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

function onPick(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
  emit('change')
}

function remove() {
  file.value = null
  emit('change')
}
</script>

<template>
  <div>
    <span class="mb-1 block text-sm font-medium">Attachment</span>
    <div class="flex flex-wrap items-center gap-3">
      <label
        :for="inputId"
        class="btn-ghost cursor-pointer border border-dashed border-line focus-within:ring-2 focus-within:ring-accent/30"
      >
        <AppIcon name="paperclip" :size="16" />
        {{ file ? 'Choose another' : 'Image or TXT' }}
        <input
          :id="inputId"
          ref="input"
          type="file"
          :accept="ACCEPT"
          class="sr-only"
          :aria-invalid="Boolean(error)"
          @change="onPick"
        />
      </label>

      <div v-if="file" class="flex items-center gap-2 text-sm">
        <img
          v-if="previewUrl"
          :src="previewUrl"
          alt="Chosen image"
          class="h-12 w-auto rounded border border-line object-cover"
        />
        <AppIcon v-else-if="kind === 'text'" name="file" :size="20" class="text-accent" />
        <span class="max-w-48 truncate">{{ file.name }}</span>
        <span class="text-muted">{{ formatSize(file.size) }}</span>
        <button
          type="button"
          class="rounded p-1 text-muted hover:text-danger"
          aria-label="Remove the attachment"
          @click="remove"
        >
          <AppIcon name="close" :size="16" />
        </button>
      </div>
      <span v-else class="text-xs text-muted">
        JPG, GIF, PNG up to 5 MB (shown at most 320×240) or TXT up to 100 KB
      </span>
    </div>
    <p v-if="error" class="mt-1 text-sm text-danger">{{ error }}</p>
  </div>
</template>

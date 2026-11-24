<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useLightboxStore } from '@/stores/lightbox'

import AppIcon from './AppIcon.vue'

const lightbox = useLightboxStore()

const text = ref<string | null>(null)
const textError = ref<string | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
let opener: HTMLElement | null = null

async function loadText(url: string) {
  text.value = null
  textError.value = null
  try {
    const response = await fetch(url, { credentials: 'same-origin' })
    if (!response.ok) throw new Error(String(response.status))
    text.value = await response.text()
  } catch {
    textError.value = 'Could not load the file'
  }
}

watch(
  () => lightbox.current,
  async (item, previous) => {
    document.documentElement.classList.toggle('overflow-hidden', Boolean(item))
    if (item?.kind === 'text') void loadText(item.url)
    if (item && !previous) {
      opener = document.activeElement as HTMLElement | null
      await nextTick()
      closeButton.value?.focus()
    }
    if (!item && previous) opener?.focus()
  },
)

function onKey(event: KeyboardEvent) {
  if (!lightbox.current) return
  if (event.key === 'Escape') lightbox.close()
  else if (event.key === 'ArrowRight') lightbox.step(1)
  else if (event.key === 'ArrowLeft') lightbox.step(-1)
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.classList.remove('overflow-hidden')
})
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div
        v-if="lightbox.current"
        class="lightbox fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        :aria-label="lightbox.current.name || 'Attachment'"
        @click.self="lightbox.close()"
      >
        <button
          ref="closeButton"
          type="button"
          class="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25"
          aria-label="Close"
          @click="lightbox.close()"
        >
          <AppIcon name="close" :size="22" />
        </button>

        <button
          v-if="lightbox.items.length > 1"
          type="button"
          class="nav-button left-4"
          aria-label="Previous attachment"
          @click="lightbox.step(-1)"
        >
          <AppIcon name="chevronLeft" :size="26" />
        </button>

        <figure class="lightbox-content flex max-h-full max-w-full flex-col items-center gap-3">
          <Transition name="swap" mode="out-in">
            <img
              v-if="lightbox.current.kind === 'image'"
              :key="lightbox.current.url"
              :src="lightbox.current.url"
              :alt="lightbox.current.name"
              class="max-h-[80vh] max-w-full rounded-lg bg-white shadow-2xl"
            />
            <div
              v-else
              :key="lightbox.current.url"
              class="flex max-h-[80vh] w-[min(48rem,90vw)] flex-col rounded-xl bg-card shadow-2xl"
            >
              <p v-if="textError" class="p-6 text-danger">{{ textError }}</p>
              <p v-else-if="text === null" class="p-6 text-muted">Loading…</p>
              <pre
                v-else
                class="overflow-auto p-5 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap text-ink"
                >{{ text }}</pre>
            </div>
          </Transition>
          <figcaption class="text-sm text-white/90">
            {{ lightbox.current.name }}
            <span v-if="lightbox.items.length > 1" class="text-white/60">
              · {{ lightbox.index + 1 }} / {{ lightbox.items.length }}
            </span>
          </figcaption>
        </figure>

        <button
          v-if="lightbox.items.length > 1"
          type="button"
          class="nav-button right-4"
          aria-label="Next attachment"
          @click="lightbox.step(1)"
        >
          <AppIcon name="chevronRight" :size="26" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@reference '@/assets/main.css';

.nav-button {
  @apply absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25;
}

/* Backdrop fades, the content zooms in — the lightbox2 feel */
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.25s ease;
}
.lightbox-enter-active .lightbox-content,
.lightbox-leave-active .lightbox-content {
  transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
.lightbox-enter-from .lightbox-content,
.lightbox-leave-to .lightbox-content {
  transform: scale(0.85);
}

.swap-enter-active,
.swap-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.swap-enter-from {
  opacity: 0;
  transform: translateX(12px);
}
.swap-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>

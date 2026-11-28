<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'

import { hideComment, restoreComment, shadowban } from '@/api/moderation'
import type { Comment } from '@/api/types'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useLiveStore } from '@/stores/live'
import { useStatsStore } from '@/stores/stats'

const props = defineProps<{ comment: Comment }>()

const live = useLiveStore()
const id = useId()
const open = ref(false)
const banning = ref(false)
const hidePast = ref(true)
const reason = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const root = ref<HTMLElement | null>(null)

function close() {
  open.value = false
  banning.value = false
  error.value = null
}

async function act(run: () => Promise<void>) {
  busy.value = true
  error.value = null
  try {
    await run()
    useStatsStore().refresh()
    close()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Something went wrong'
  } finally {
    busy.value = false
  }
}

const toggleUfo = () =>
  act(async () => {
    const state = props.comment.isUfo
      ? await restoreComment(props.comment.id)
      : await hideComment(props.comment.id, reason.value.trim())
    live.patch(props.comment.id, state)
  })

const ban = () =>
  act(async () => {
    // All of the author's comments on the page, not only this one
    const { commentIds } = await shadowban(props.comment.id, hidePast.value, reason.value.trim())
    for (const commentId of commentIds) live.patch(commentId, { isShadowed: true })
  })

/** composedPath() is taken when the click happens: a menu item that re-rendered away during the click
 * ("Shadow-ban…" turns into the form) still counts as inside, while contains() on its detached node would not */
function onOutside(event: MouseEvent) {
  if (open.value && root.value && !event.composedPath().includes(root.value)) close()
}
onMounted(() => document.addEventListener('click', onOutside))
onBeforeUnmount(() => document.removeEventListener('click', onOutside))
</script>

<template>
  <div ref="root" class="relative" @keydown.esc="close">
    <button
      type="button"
      class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-accent transition-colors hover:bg-white"
      :class="{ 'bg-white': open }"
      title="Moderate"
      aria-label="Moderate"
      :aria-expanded="open"
      :aria-controls="`${id}-menu`"
      @click="open ? close() : (open = true)"
    >
      <AppIcon name="shield" />
    </button>

    <Transition name="pop">
      <div
        v-if="open"
        :id="`${id}-menu`"
        class="absolute top-full right-0 z-20 mt-2 w-72 space-y-3 rounded-xl border border-line bg-card p-3 text-sm shadow-lg"
        role="menu"
      >
        <label class="block">
          <span class="mb-1 block text-xs text-muted">Reason (optional, for the journal)</span>
          <input v-model="reason" maxlength="255" class="field w-full py-1 text-sm" />
        </label>

        <button
          type="button"
          role="menuitem"
          class="btn-ghost w-full justify-start"
          :disabled="busy"
          @click="toggleUfo"
        >
          {{ comment.isUfo ? 'Restore the text' : 'Hide the text (UFO)' }}
        </button>

        <template v-if="!banning">
          <button
            type="button"
            role="menuitem"
            class="btn-ghost w-full justify-start text-danger"
            :disabled="busy"
            @click="banning = true"
          >
            Shadow-ban the author…
          </button>
        </template>
        <div v-else class="space-y-2 rounded-lg bg-danger/5 p-2">
          <p>
            <strong>{{ comment.userName }}</strong> will keep posting, but only they and moderators
            will see it.
          </p>
          <label class="flex items-center gap-2">
            <input v-model="hidePast" type="checkbox" />
            Hide their earlier comments too
          </label>
          <div class="flex gap-2">
            <button
              type="button"
              class="btn-primary bg-danger hover:bg-danger/90"
              :disabled="busy"
              @click="ban"
            >
              Ban
            </button>
            <button type="button" class="btn-ghost" @click="banning = false">Cancel</button>
          </div>
        </div>

        <p v-if="error" class="text-danger" role="alert">{{ error }}</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.pop-enter-active,
.pop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

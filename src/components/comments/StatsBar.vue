<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'

import AppIcon, { type IconName } from '@/components/ui/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useLiveStore } from '@/stores/live'
import { useStatsStore } from '@/stores/stats'

const auth = useAuthStore()
const live = useLiveStore()
const store = useStatsStore()

interface Card {
  key: string
  label: string
  value: number
  icon: IconName
  tone: string
}

/** Only what this viewer may know: the server answers null for the rest, those cards are not shown */
const cards = computed<Card[]>(() => {
  const s = store.stats
  if (!s) return []
  const all: (Card | null)[] = [
    { key: 'comments', label: 'Comments', value: s.comments, icon: 'message', tone: 'text-accent' },
    { key: 'ufo', label: 'Hidden by UFO', value: s.ufo, icon: 'ufo', tone: 'text-violet-500' },
    { key: 'shadowed', label: 'Shadowed', value: s.shadowed, icon: 'eyeOff', tone: 'text-muted' },
    s.myComments === null
      ? null
      : {
          key: 'mine',
          label: 'My comments',
          value: s.myComments,
          icon: 'user',
          tone: 'text-emerald-600',
        },
    s.myBookmarks === null
      ? null
      : {
          key: 'bookmarks',
          label: 'My bookmarks',
          value: s.myBookmarks,
          icon: 'bookmark',
          tone: 'text-amber-500',
        },
  ]
  return all.filter((card): card is Card => card !== null)
})

onMounted(() => void store.load())
// A new comment anywhere, signing in or out: the numbers change
watch(
  () => [live.topLevel.length, Object.values(live.replies).flat().length],
  () => store.refresh(),
)
watch(
  () => auth.user?.id,
  () => store.refresh(),
)
</script>

<template>
  <TransitionGroup
    v-if="cards.length"
    tag="ul"
    name="card"
    class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    aria-label="Statistics"
  >
    <li
      v-for="card in cards"
      :key="card.key"
      class="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-sm"
    >
      <span class="rounded-xl bg-card-header p-2" :class="card.tone">
        <AppIcon :name="card.icon" :size="20" />
      </span>
      <span class="min-w-0">
        <Transition name="count" mode="out-in">
          <span :key="card.value" class="block text-xl leading-tight font-bold">{{
            card.value
          }}</span>
        </Transition>
        <span class="block truncate text-xs text-muted">{{ card.label }}</span>
      </span>
    </li>
  </TransitionGroup>
</template>

<style scoped>
.card-enter-active {
  transition: all 0.3s ease-out;
}
.card-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.count-enter-active,
.count-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.count-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.count-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>

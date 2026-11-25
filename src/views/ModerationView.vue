<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { type ShadowBan, fetchShadowBans, unban } from '@/api/moderation'
import AppIcon from '@/components/ui/AppIcon.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { useStatsStore } from '@/stores/stats'
import { formatDate, pluralize } from '@/utils/format'

const auth = useAuthStore()
const bans = useAsync((signal) => fetchShadowBans(signal))
const lifting = ref<string | null>(null)
const error = ref<string | null>(null)

watch(
  () => auth.user?.isModerator,
  (isModerator) => {
    if (isModerator) void bans.run()
  },
  { immediate: true },
)

async function lift(ban: ShadowBan) {
  lifting.value = ban.id
  error.value = null
  try {
    await unban(ban.id)
    bans.data.value = (bans.data.value ?? []).filter((item) => item.id !== ban.id)
    useStatsStore().refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not lift the ban'
  } finally {
    lifting.value = null
  }
}
</script>

<template>
  <div class="space-y-5">
    <RouterLink to="/" class="btn-back">
      <AppIcon name="chevronLeft" :size="16" />
      All comments
    </RouterLink>
    <h1 class="text-2xl font-bold">Moderation</h1>

    <p v-if="!auth.ready" class="h-24 animate-pulse rounded-2xl bg-card-header" aria-busy="true" />
    <p
      v-else-if="!auth.user?.isModerator"
      class="rounded-2xl border border-line bg-card p-8 text-center text-muted"
    >
      Moderators only.
    </p>
    <template v-else>
      <p class="text-sm text-muted">
        Shadow-banned authors keep posting, but only they and moderators see it. Hide a comment's
        text or ban its author from the shield menu on the comment.
      </p>
      <p v-if="error" class="text-danger" role="alert">{{ error }}</p>
      <p v-if="bans.error.value" class="text-danger">{{ bans.error.value }}</p>
      <p
        v-else-if="bans.data.value && !bans.data.value.length"
        class="rounded-2xl border border-line bg-card p-8 text-center text-muted"
      >
        Nobody is banned.
      </p>
      <TransitionGroup v-else-if="bans.data.value" tag="ul" name="ban" class="space-y-3">
        <li
          v-for="ban in bans.data.value"
          :key="ban.id"
          class="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm"
        >
          <UserAvatar :name="ban.userName" :size="40" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold">
              {{ ban.userName }}
              <span class="ml-1 text-xs font-normal text-muted">{{
                ban.isGuest ? 'guest' : 'account'
              }}</span>
            </p>
            <p class="truncate text-sm text-muted">{{ ban.email }}</p>
            <p class="text-xs text-muted">
              since {{ formatDate(ban.createdAt) }} ·
              {{ pluralize(ban.commentsCount, 'hidden comment', 'hidden comments') }}
              <template v-if="ban.reason"> · “{{ ban.reason }}”</template>
            </p>
          </div>
          <button type="button" class="btn-ghost" :disabled="lifting === ban.id" @click="lift(ban)">
            {{ lifting === ban.id ? 'Lifting…' : 'Lift ban' }}
          </button>
        </li>
      </TransitionGroup>
      <div v-else class="h-24 animate-pulse rounded-2xl bg-card-header" aria-busy="true" />
    </template>
  </div>
</template>

<style scoped>
.ban-leave-active {
  transition: all 0.3s ease;
}
.ban-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>

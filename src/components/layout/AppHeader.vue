<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import AuthDialog from '@/components/auth/AuthDialog.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { type AuthMode, useAuthStore } from '@/stores/auth'
import { useLiveStore } from '@/stores/live'

const auth = useAuthStore()
const live = useLiveStore()
const dialog = ref<AuthMode | null>(null)

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
    <div class="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
      <RouterLink to="/" class="text-lg font-bold text-ink hover:text-accent">Comments</RouterLink>
      <span
        class="flex items-center gap-2 text-xs text-muted"
        role="status"
        :title="live.status === 'online' ? 'New comments appear without reloading' : ''"
      >
        <span class="h-2 w-2 rounded-full" :class="indicator.dot" aria-hidden="true" />
        {{ indicator.label }}
      </span>

      <!-- Nothing until the session restore finishes: no "Sign in" flash for a signed-in user -->
      <div v-if="auth.ready" class="ml-auto flex items-center gap-2 text-sm">
        <template v-if="auth.user">
          <RouterLink
            :to="{ name: 'me' }"
            class="flex items-center gap-2 rounded-lg px-1 text-ink hover:text-accent"
            title="My cabinet"
          >
            <UserAvatar :name="auth.user.username" :size="30" />
            <span class="hidden font-semibold sm:inline">{{ auth.user.username }}</span>
          </RouterLink>
          <button type="button" class="btn-ghost px-2 py-1" @click="auth.logout()">Sign out</button>
        </template>
        <template v-else>
          <button type="button" class="btn-ghost px-3 py-1" @click="dialog = 'login'">
            Sign in
          </button>
          <button type="button" class="btn-primary px-3 py-1" @click="dialog = 'register'">
            Sign up
          </button>
        </template>
      </div>
    </div>
    <AuthDialog v-model="dialog" />
  </header>
</template>

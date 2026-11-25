<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterView } from 'vue-router'

import AppHeader from '@/components/layout/AppHeader.vue'
import AppLightbox from '@/components/ui/AppLightbox.vue'
import { useAuthStore } from '@/stores/auth'
import { useLiveStore } from '@/stores/live'

const auth = useAuthStore()
// One WebSocket for the whole app: new comments and finished images arrive without reloading
const live = useLiveStore()

onMounted(async () => {
  await auth.restore() // the session from the refresh cookie first: the socket opens as the right user
  await live.connect()
  // Signing in or out changes what this visitor may see (own shadowed comments): reopen as the new user
  watch(
    () => auth.user?.id,
    () => void live.reconnect(),
  )
})
onBeforeUnmount(() => live.disconnect())
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <!-- The feed stays alive while a thread is open: back to it without reloading or losing the place -->
      <RouterView v-slot="{ Component }">
        <KeepAlive include="HomeView">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </main>
    <AppLightbox />
  </div>
</template>

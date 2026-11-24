<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView } from 'vue-router'

import AppHeader from '@/components/layout/AppHeader.vue'
import AppLightbox from '@/components/ui/AppLightbox.vue'
import { useLiveStore } from '@/stores/live'

// One WebSocket for the whole app: new comments and finished images arrive without reloading
const live = useLiveStore()
onMounted(() => live.connect())
onBeforeUnmount(() => live.disconnect())
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <RouterView />
    </main>
    <AppLightbox />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { fetchThread } from '@/api/comments'
import { feedPath } from '@/router'
import AppIcon from '@/components/ui/AppIcon.vue'
import CommentThread from '@/components/comments/CommentThread.vue'
import { useAsync } from '@/composables/useAsync'

const route = useRoute()
const id = computed(() => String(route.params.id))

const thread = useAsync((signal) => fetchThread(id.value, signal))

watch(
  id,
  async () => {
    await thread.run()
    await nextTick()
    document.getElementById(`c-${id.value}`)?.classList.add('flash')
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-5">
    <RouterLink :to="feedPath" class="btn-back">
      <AppIcon name="chevronLeft" :size="16" />
      All comments
    </RouterLink>

    <p
      v-if="thread.error.value"
      class="rounded-xl border border-danger/30 bg-danger/5 p-4 text-danger"
    >
      {{ thread.error.value }}
    </p>
    <div
      v-else-if="thread.data.value"
      class="rounded-2xl border border-line bg-card p-3 shadow-sm sm:p-4"
    >
      <CommentThread
        :key="id"
        :comment="thread.data.value"
        :top-level="!thread.data.value.parentId"
      />
    </div>
    <p
      v-else-if="!thread.loading.value"
      class="rounded-xl border border-line bg-card p-8 text-center text-muted"
    >
      This comment does not exist or was removed.
    </p>
    <div v-else class="h-28 animate-pulse rounded-2xl bg-card-header" aria-busy="true" />
  </div>
</template>

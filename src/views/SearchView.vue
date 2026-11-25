<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { searchComments } from '@/api/comments'
import { feedPath } from '@/router'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { formatDate, pluralize } from '@/utils/format'
import { parsePage } from '@/utils/sort'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// The query and the page live in the URL: a search can be shared and Back works
const query = computed(() => String(route.query.q ?? '').trim())
const page = computed(() => parsePage(route.query.page))
const draft = ref(query.value)

const results = useAsync((signal) => searchComments(query.value, page.value, signal))

// Signing in or out changes what may be found (own shadowed comments)
watch(
  [query, page, () => auth.user?.id],
  () => {
    draft.value = query.value
    if (query.value) void results.run()
  },
  { immediate: true },
)

function submit() {
  const q = draft.value.trim()
  if (q) void router.push({ name: 'search', query: { q } })
}

function onPage(next: number) {
  void router.push({
    name: 'search',
    query: { q: query.value, ...(next > 1 ? { page: next } : {}) },
  })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="space-y-5">
    <RouterLink :to="feedPath" class="btn-back">
      <AppIcon name="chevronLeft" :size="16" />
      All comments
    </RouterLink>

    <form class="flex gap-2" role="search" @submit.prevent="submit">
      <label for="search-page-input" class="sr-only">Search comments</label>
      <input
        id="search-page-input"
        v-model="draft"
        type="search"
        maxlength="200"
        placeholder="Words from comments or an author's name"
        class="field flex-1"
      />
      <button type="submit" class="btn-primary">
        <AppIcon name="search" :size="16" />
        Search
      </button>
    </form>

    <p v-if="!query" class="text-muted">Russian and English word forms are found too.</p>
    <p
      v-else-if="results.error.value"
      class="rounded-xl border border-danger/30 bg-danger/5 p-4 text-danger"
      role="alert"
    >
      {{ results.error.value }}
    </p>
    <template v-else-if="results.data.value">
      <p class="text-sm text-muted" role="status">
        {{ pluralize(results.data.value.totalCount, 'comment', 'comments') }} found for “{{
          query
        }}”
      </p>
      <p
        v-if="!results.data.value.items.length"
        class="rounded-2xl border border-line bg-card p-8 text-center text-muted"
      >
        Nothing found. Try other words.
      </p>
      <ul v-else class="space-y-3" :class="{ 'opacity-50': results.loading.value }">
        <li
          v-for="hit in results.data.value.items"
          :key="hit.comment.id"
          class="rounded-2xl border border-line bg-card p-4 shadow-sm"
        >
          <div class="flex items-center gap-3 text-sm">
            <UserAvatar :name="hit.comment.userName" :size="32" />
            <span class="font-semibold">{{ hit.comment.userName }}</span>
            <span class="text-muted">{{ formatDate(hit.comment.createdAt) }}</span>
            <RouterLink
              :to="{ name: 'thread', params: { id: hit.comment.id } }"
              class="ml-auto text-sm font-medium"
            >
              Open thread →
            </RouterLink>
          </div>
          <!-- Escaped by the search server, only <mark> tags inside; otherwise the sanitized comment text -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p class="mt-2 leading-relaxed break-words" v-html="hit.highlight ?? hit.comment.text" />
        </li>
      </ul>
      <AppPagination :page="page" :page-count="results.data.value.pageCount" @change="onPage" />
    </template>
    <div v-else class="space-y-3" aria-busy="true">
      <div v-for="n in 3" :key="n" class="h-20 animate-pulse rounded-2xl bg-card-header" />
    </div>
  </div>
</template>

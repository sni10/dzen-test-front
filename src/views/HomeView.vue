<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { fetchFeed } from '@/api/comments'
import type { Comment } from '@/api/types'
import CommentTable from '@/components/comments/CommentTable.vue'
import CommentForm from '@/components/form/CommentForm.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import { useAsync } from '@/composables/useAsync'
import { pluralize } from '@/utils/format'
import { highlightComment } from '@/utils/highlight'
import {
  type SortColumn,
  parsePage,
  DEFAULT_SORT,
  parseSort,
  sortToEnum,
  sortToQuery,
  toggleSort,
} from '@/utils/sort'

const route = useRoute()
const router = useRouter()

// Page and sort live in the URL: a link reproduces the view, Back/Forward work
const page = computed(() => parsePage(route.query.page))
const sort = computed(() => parseSort(route.query.sort))

const feed = useAsync((signal) => fetchFeed(page.value, sortToEnum(sort.value), signal))
watch([page, sort], () => void feed.run(), { immediate: true })

function setQuery(next: { page?: number; sort?: string }) {
  const query = { ...route.query, ...next }
  if (!query.page || query.page === 1) delete query.page
  if (!query.sort) delete query.sort
  void router.push({ query })
}

function onSort(column: SortColumn) {
  setQuery({ sort: sortToQuery(toggleSort(sort.value, column)), page: 1 })
}

/** Where my last comment went if it is not visible here (another page or sort) */
const postedElsewhere = ref<Comment | null>(null)

/** Newest-first first page: insert the comment on top at once; otherwise offer a link to it */
async function onCreated(comment: Comment) {
  const current = feed.data.value
  const isDefaultView = page.value === 1 && sortToQuery(sort.value) === sortToQuery(DEFAULT_SORT)
  if (!current || !isDefaultView) {
    postedElsewhere.value = comment
    return
  }
  postedElsewhere.value = null
  feed.data.value = {
    ...current,
    items: [comment, ...current.items].slice(0, current.pageSize),
    totalCount: current.totalCount + 1,
  }
  await nextTick()
  highlightComment(comment.id)
}

function onPage(next: number) {
  setQuery({ page: next })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-baseline justify-between">
      <h1 class="text-2xl font-bold">Comments</h1>
      <span v-if="feed.data.value" class="text-sm text-muted">
        {{ pluralize(feed.data.value.totalCount, 'comment', 'comments') }}
      </span>
    </div>

    <section class="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
      <h2 class="mb-4 text-lg font-semibold">Leave a comment</h2>
      <CommentForm @created="onCreated" />
    </section>

    <Transition name="fade">
      <p
        v-if="postedElsewhere"
        class="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm"
        role="status"
      >
        Your comment is posted.
        <RouterLink
          :to="{ name: 'thread', params: { id: postedElsewhere.id } }"
          class="font-semibold"
        >
          Show it
        </RouterLink>
        <button
          type="button"
          class="ml-auto text-muted hover:text-ink"
          aria-label="Dismiss"
          @click="postedElsewhere = null"
        >
          ✕
        </button>
      </p>
    </Transition>

    <p
      v-if="feed.error.value"
      class="rounded-xl border border-danger/30 bg-danger/5 p-4 text-danger"
    >
      {{ feed.error.value }}
      <button type="button" class="ml-2 underline" @click="feed.run()">Retry</button>
    </p>

    <template v-else-if="feed.data.value">
      <p
        v-if="!feed.data.value.items.length"
        class="rounded-xl border border-line bg-card p-8 text-center text-muted"
      >
        {{ page > 1 ? 'No comments on this page.' : 'No comments yet — be the first.' }}
      </p>
      <template v-else>
        <CommentTable
          :comments="feed.data.value.items"
          :sort="sort"
          :loading="feed.loading.value"
          @sort="onSort"
        />
        <AppPagination :page="page" :page-count="feed.data.value.pageCount" @change="onPage" />
      </template>
    </template>

    <div v-else class="space-y-4" aria-busy="true">
      <div v-for="n in 3" :key="n" class="h-28 animate-pulse rounded-2xl bg-card-header" />
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { fetchFeed } from '@/api/comments'
import type { Comment } from '@/api/types'
import CommentTable from '@/components/comments/CommentTable.vue'
import StatsBar from '@/components/comments/StatsBar.vue'
import CommentForm from '@/components/form/CommentForm.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { useLiveStore } from '@/stores/live'
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
const auth = useAuthStore()

// Page and sort live in the URL: a link reproduces the view, Back/Forward work
const page = computed(() => parsePage(route.query.page))
const sort = computed(() => parseSort(route.query.sort))

const feed = useAsync((signal) => fetchFeed(page.value, sortToEnum(sort.value), signal))
// Signing in or out changes what this visitor may see (own shadowed comments): reload the page too
watch([page, sort, () => auth.user?.id], () => void feed.run(), { immediate: true })

function setQuery(next: { page?: number; sort?: string }) {
  const query = { ...route.query, ...next }
  if (!query.page || query.page === 1) delete query.page
  if (!query.sort) delete query.sort
  void router.push({ query })
}

function onSort(column: SortColumn) {
  setQuery({ sort: sortToQuery(toggleSort(sort.value, column)), page: 1 })
}

const live = useLiveStore()

/** Newest-first first page: new top-level comments (mine or live) slide in on top */
const isDefaultView = computed(
  () => page.value === 1 && sortToQuery(sort.value) === sortToQuery(DEFAULT_SORT),
)

/** Where my last comment went if it is not visible here (another page or sort) */
const postedElsewhere = ref<Comment | null>(null)

const shownIds = computed(() => new Set(feed.data.value?.items.map((comment) => comment.id)))
/** Live comments this view does not show: another page or sort — offered as a banner, not inserted */
const pending = computed(() =>
  live.topLevel.filter(
    (comment) => !shownIds.value.has(comment.id) && comment.id !== postedElsewhere.value?.id,
  ),
)

function collectIds(comments: Comment[]): string[] {
  return comments.flatMap((c) => [c.id, ...collectIds(c.replies?.items ?? [])])
}

watch(
  () => feed.data.value,
  (data) => live.remember(collectIds(data?.items ?? [])),
)

watch([() => live.topLevel, () => feed.data.value], async () => {
  const current = feed.data.value
  if (!current || !isDefaultView.value || !pending.value.length) return
  const fresh = pending.value
  feed.data.value = {
    ...current,
    items: [...fresh, ...current.items].slice(0, current.pageSize),
    totalCount: current.totalCount + fresh.length,
  }
  await nextTick()
  fresh.forEach((comment) => highlightComment(comment.id))
})

function onCreated(comment: Comment) {
  postedElsewhere.value = isDefaultView.value ? null : comment
  live.addComment(comment) // the same path as comments of other people: no duplicate when the event arrives
}

function showPending() {
  void router.push({ query: {} })
  window.scrollTo({ top: 0, behavior: 'smooth' })
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
        {{ pluralize(feed.data.value.totalCount, 'thread', 'threads') }}
      </span>
    </div>

    <StatsBar />

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

    <Transition name="fade">
      <button
        v-if="!isDefaultView && pending.length"
        type="button"
        class="w-full rounded-xl border border-accent/30 bg-accent/5 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10"
        @click="showPending"
      >
        {{ pluralize(pending.length, 'new comment', 'new comments') }} — show the newest
      </button>
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

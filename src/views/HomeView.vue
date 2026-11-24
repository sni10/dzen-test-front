<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { fetchFeed } from '@/api/comments'
import CommentTable from '@/components/comments/CommentTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import { useAsync } from '@/composables/useAsync'
import { pluralize } from '@/utils/format'
import {
  type SortColumn,
  parsePage,
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

<script setup lang="ts">
import { computed, ref } from 'vue'

import { fetchReplies } from '@/api/comments'
import type { Comment } from '@/api/types'
import { pluralize } from '@/utils/format'

import CommentCard from './CommentCard.vue'

// Visual indent stops growing after this depth so deep threads still fit on a phone
const MAX_INDENT_DEPTH = 6

const props = defineProps<{ comment: Comment; topLevel?: boolean }>()

const loaded = ref<Comment[]>([])
const cursor = ref<string | null>(props.comment.replies?.endCursor ?? null)
const hasMore = ref(
  props.comment.replies ? props.comment.replies.hasMore : props.comment.repliesCount > 0,
)
const loading = ref(false)
const error = ref<string | null>(null)

const replies = computed(() => [...(props.comment.replies?.items ?? []), ...loaded.value])
const remaining = computed(() => Math.max(props.comment.repliesCount - replies.value.length, 0))
const indent = computed(() => props.comment.depth < MAX_INDENT_DEPTH)

async function loadMore() {
  loading.value = true
  error.value = null
  try {
    const page = await fetchReplies(props.comment.id, cursor.value)
    loaded.value = [...loaded.value, ...page.items]
    cursor.value = page.endCursor
    hasMore.value = page.hasMore
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not load replies'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <CommentCard :comment="comment" :top-level="topLevel" />

    <div v-if="replies.length || hasMore" :class="indent ? 'pl-4 sm:pl-11' : ''">
      <TransitionGroup tag="div" name="reply" class="mt-3 space-y-4">
        <CommentThread v-for="reply in replies" :key="reply.id" :comment="reply" />
      </TransitionGroup>

      <button
        v-if="hasMore"
        type="button"
        class="mt-2 text-sm font-medium text-accent hover:text-accent-strong disabled:opacity-60"
        :disabled="loading"
        @click="loadMore"
      >
        {{
          loading
            ? 'Loading…'
            : remaining
              ? `Show ${pluralize(remaining, 'more reply', 'more replies')}`
              : 'Show more replies'
        }}
      </button>
      <p v-if="error" class="mt-1 text-sm text-danger">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.reply-enter-active {
  transition: all 0.25s ease-out;
}
.reply-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
</style>

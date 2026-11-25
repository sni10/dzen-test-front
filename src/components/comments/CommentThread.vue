<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import { fetchReplies } from '@/api/comments'
import type { Comment } from '@/api/types'
import CommentForm from '@/components/form/CommentForm.vue'
import { useLiveStore } from '@/stores/live'
import { useReplyStore } from '@/stores/replies'
import { pluralize } from '@/utils/format'
import { highlightComment } from '@/utils/highlight'

import CommentCard from './CommentCard.vue'

// Visual indent stops growing after this depth so deep threads still fit on a phone
const MAX_INDENT_DEPTH = 6

const props = defineProps<{ comment: Comment; topLevel?: boolean }>()

const replyStore = useReplyStore()
const live = useLiveStore()

const loaded = ref<Comment[]>([])
const cursor = ref<string | null>(props.comment.replies?.endCursor ?? null)
const hasMore = ref(
  props.comment.replies ? props.comment.replies.hasMore : props.comment.repliesCount > 0,
)
const loading = ref(false)
const error = ref<string | null>(null)

const replying = computed(() => replyStore.activeId === props.comment.id)
const replies = computed(() => {
  const known = [...(props.comment.replies?.items ?? []), ...loaded.value]
  const ids = new Set(known.map((reply) => reply.id))
  // New replies (mine and live ones) go last, oldest first; skip them once a page brings them too
  const fresh = (live.replies[props.comment.id] ?? []).filter((reply) => !ids.has(reply.id))
  return [...known, ...fresh]
})
const freshCount = computed(() => live.replies[props.comment.id]?.length ?? 0)
const remaining = computed(() =>
  Math.max(props.comment.repliesCount + freshCount.value - replies.value.length, 0),
)
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

function toggleReply() {
  if (replying.value) replyStore.close(props.comment.id)
  else replyStore.open(props.comment.id)
}

async function onReplied(reply: Comment) {
  replyStore.close(props.comment.id)
  const parent = {
    id: props.comment.id,
    userName: props.comment.userName,
    text: props.comment.text,
  }
  live.addComment({ ...reply, parent })
  await nextTick()
  highlightComment(reply.id)
}
</script>

<template>
  <div>
    <CommentCard
      :comment="comment"
      :top-level="topLevel"
      :replying="replying"
      @reply="toggleReply"
    />

    <Transition name="expand">
      <div
        v-if="replying"
        class="mt-3 rounded-xl border border-line bg-card p-4 shadow-sm"
        :class="indent ? 'ml-4 sm:ml-11' : ''"
      >
        <CommentForm
          :parent="comment"
          @created="onReplied"
          @cancel="replyStore.close(comment.id)"
        />
      </div>
    </Transition>

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
  transition: all 0.3s ease-out;
}
.reply-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.expand-enter-active,
.expand-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>

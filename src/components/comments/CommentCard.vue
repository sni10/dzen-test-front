<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import type { Comment } from '@/api/types'
import AppIcon from '@/components/ui/AppIcon.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { formatDate, quoteText } from '@/utils/format'
import { highlightComment } from '@/utils/highlight'

import CommentAttachments from './CommentAttachments.vue'

const props = defineProps<{
  comment: Comment
  topLevel?: boolean
  replying?: boolean
  /** Lists outside the tree (my comments) have nowhere to open a reply form */
  noReply?: boolean
}>()
const emit = defineEmits<{ reply: [] }>()

const router = useRouter()

// Top-level cards line up with the table header (fixed column widths, see CommentTable);
// replies are indented and narrower, so their fields just flow
const columns = computed(() =>
  props.topLevel
    ? { name: 'sm:w-40 sm:shrink-0', email: 'sm:w-52 sm:shrink-0', date: 'sm:w-36 sm:shrink-0' }
    : { name: 'sm:shrink-0', email: 'sm:min-w-0 sm:flex-1', date: 'sm:shrink-0' },
)

const quote = computed(() => (props.comment.parent ? quoteText(props.comment.parent.text) : ''))

/** Scroll to the parent if it is on the page, otherwise open its thread */
function goToParent() {
  const id = props.comment.parentId
  if (!id) return
  if (!highlightComment(id, 'center')) void router.push({ name: 'thread', params: { id } })
}
</script>

<template>
  <article :id="`c-${comment.id}`" class="comment rounded-xl transition-colors">
    <header
      class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-card-header px-3 py-2 sm:flex-nowrap"
    >
      <UserAvatar :name="comment.userName" :size="topLevel ? 44 : 40" />

      <div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-0.5 sm:flex-nowrap">
        <a
          v-if="comment.homePage"
          :href="comment.homePage"
          target="_blank"
          rel="nofollow ugc noopener noreferrer"
          class="truncate font-bold text-ink hover:text-accent"
          :class="columns.name"
          :title="comment.homePage"
          >{{ comment.userName }}</a
        >
        <span v-else class="truncate font-bold" :class="columns.name">{{ comment.userName }}</span>

        <span class="truncate text-sm text-muted" :class="columns.email" :title="comment.email">{{
          comment.email
        }}</span>

        <time
          :datetime="comment.createdAt"
          class="text-sm whitespace-nowrap text-muted"
          :class="columns.date"
          >{{ formatDate(comment.createdAt) }}</time
        >
      </div>

      <div class="flex items-center gap-1 text-accent">
        <RouterLink
          :to="{ name: 'thread', params: { id: comment.id } }"
          class="icon-button"
          title="Link to this comment"
          aria-label="Link to this comment"
        >
          <AppIcon name="hash" />
        </RouterLink>
        <button
          type="button"
          class="icon-button"
          disabled
          title="Bookmarks: sign in (coming soon)"
          aria-label="Bookmark"
        >
          <AppIcon name="bookmark" />
        </button>
        <button
          v-if="!noReply"
          type="button"
          class="icon-button"
          :class="{ 'bg-white': replying }"
          title="Reply"
          aria-label="Reply"
          :aria-expanded="replying"
          @click="emit('reply')"
        >
          <AppIcon name="reply" />
        </button>
        <button
          v-if="comment.parentId"
          type="button"
          class="icon-button"
          title="Go to the comment this one replies to"
          aria-label="Go to parent comment"
          @click="goToParent"
        >
          <AppIcon name="parent" />
        </button>
      </div>

      <div class="ml-auto flex items-center gap-1 text-muted" aria-label="Rating">
        <button type="button" class="icon-button" disabled aria-label="Vote up">
          <AppIcon name="up" :size="16" />
        </button>
        <span class="min-w-4 text-center font-semibold text-ink">{{ comment.score }}</span>
        <button type="button" class="icon-button" disabled aria-label="Vote down">
          <AppIcon name="down" :size="16" />
        </button>
      </div>
    </header>

    <div class="px-3 pt-3 pb-1">
      <blockquote
        v-if="quote"
        class="mb-3 truncate border-l-2 border-quote pl-3 text-muted"
        :title="quote"
      >
        {{ quote }}
      </blockquote>

      <p v-if="comment.isUfo" class="text-muted italic">
        A UFO flew in and published this inscription here.
      </p>
      <!-- Sanitized on the server (allowlist: a, code, i, strong); the only v-html in the app -->
      <template v-else>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="comment-text leading-relaxed break-words" v-html="comment.text" />
        <CommentAttachments
          v-if="comment.attachments?.length"
          :comment-id="comment.id"
          :attachments="comment.attachments"
        />
      </template>
    </div>
  </article>
</template>

<style scoped>
@reference '@/assets/main.css';

.icon-button {
  @apply inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent;
}

.comment-text {
  white-space: pre-line;
}

.comment.flash {
  animation: flash 1.6s ease-out;
}

@keyframes flash {
  0% {
    background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  }
  100% {
    background: transparent;
  }
}
</style>

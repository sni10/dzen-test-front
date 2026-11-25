<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import type { Comment } from '@/api/types'
import AppIcon from '@/components/ui/AppIcon.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useReactions } from '@/composables/useReactions'
import { useAuthStore } from '@/stores/auth'
import { useLiveStore } from '@/stores/live'
import { formatDate, quoteText } from '@/utils/format'
import { highlightComment } from '@/utils/highlight'

import CommentAttachments from './CommentAttachments.vue'
import ModerationMenu from './ModerationMenu.vue'

const props = defineProps<{
  comment: Comment
  topLevel?: boolean
  replying?: boolean
  /** Lists outside the tree (my comments) have nowhere to open a reply form */
  noReply?: boolean
}>()
const emit = defineEmits<{ reply: []; unbookmarked: [] }>()

const router = useRouter()
const live = useLiveStore()
const auth = useAuthStore()
/** The comment as loaded, with whatever changed since (a moderator hid or restored it, the author was banned) */
const shown = computed<Comment>(() => ({ ...props.comment, ...live.updates[props.comment.id] }))
const reactions = useReactions(() => shown.value)
const { myVote, bookmarked, score, canReact, canVote } = reactions

/** Tells the list once the bookmark is really gone (the bookmarks tab drops the comment) */
async function onBookmark() {
  const was = bookmarked.value
  const now = await reactions.toggleBookmark()
  if (was && !now) emit('unbookmarked')
}

// Top-level cards line up with the table header (fixed column widths, see CommentTable);
// replies are indented and narrower, so their fields just flow
const columns = computed(() =>
  props.topLevel
    ? { name: 'sm:w-40 sm:shrink-0', email: 'sm:w-52 sm:shrink-0', date: 'sm:w-36 sm:shrink-0' }
    : { name: 'sm:shrink-0', email: 'sm:min-w-0 sm:flex-1', date: 'sm:shrink-0' },
)

const quote = computed(() => (shown.value.parent ? quoteText(shown.value.parent.text) : ''))

/** Scroll to the parent if it is on the page, otherwise open its thread */
function goToParent() {
  const id = shown.value.parentId
  if (!id) return
  if (!highlightComment(id, 'center')) void router.push({ name: 'thread', params: { id } })
}
</script>

<template>
  <article :id="`c-${shown.id}`" class="comment rounded-xl transition-colors">
    <header
      class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-2 sm:flex-nowrap"
      :class="shown.byModerator ? 'bg-accent/10 ring-1 ring-accent/30' : 'bg-card-header'"
    >
      <UserAvatar :name="shown.userName" :size="topLevel ? 44 : 40" />

      <div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-0.5 sm:flex-nowrap">
        <!-- The name column keeps its width (top-level cards line up with the table header): the badge lives inside -->
        <span class="flex min-w-0 items-center gap-2" :class="columns.name">
          <a
            v-if="shown.homePage"
            :href="shown.homePage"
            target="_blank"
            rel="nofollow ugc noopener noreferrer"
            class="truncate font-bold text-ink hover:text-accent"
            :title="shown.homePage"
            >{{ shown.userName }}</a
          >
          <span v-else class="truncate font-bold">{{ shown.userName }}</span>
          <span
            v-if="shown.byModerator"
            class="inline-flex shrink-0 items-center rounded-full bg-accent p-1 text-white"
            title="A message from the administration"
            aria-label="Moderator"
          >
            <AppIcon name="shield" :size="12" />
          </span>
        </span>

        <span class="truncate text-sm text-muted" :class="columns.email" :title="shown.email">{{
          shown.email
        }}</span>

        <time
          :datetime="shown.createdAt"
          class="text-sm whitespace-nowrap text-muted"
          :class="columns.date"
          >{{ formatDate(shown.createdAt) }}</time
        >
      </div>

      <div class="flex items-center gap-1 text-accent">
        <RouterLink
          :to="{ name: 'thread', params: { id: shown.id } }"
          class="icon-button"
          title="Link to this comment"
          aria-label="Link to this comment"
        >
          <AppIcon name="hash" />
        </RouterLink>
        <button
          type="button"
          class="icon-button"
          :disabled="!canReact"
          :title="
            canReact
              ? bookmarked
                ? 'Remove from bookmarks'
                : 'Add to bookmarks'
              : 'Sign in to bookmark'
          "
          aria-label="Bookmark"
          :aria-pressed="bookmarked"
          @click="onBookmark"
        >
          <AppIcon name="bookmark" :filled="bookmarked" />
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
          v-if="shown.parentId"
          type="button"
          class="icon-button"
          title="Go to the comment this one replies to"
          aria-label="Go to parent comment"
          @click="goToParent"
        >
          <AppIcon name="parent" />
        </button>
        <ModerationMenu v-if="auth.user?.isModerator" :comment="shown" />
      </div>

      <div
        class="ml-auto flex items-center gap-1 text-muted"
        role="group"
        aria-label="Rating"
        :title="canVote ? '' : shown.isMine ? 'Your own comment' : 'Sign in to vote'"
      >
        <button
          type="button"
          class="icon-button"
          :class="{ 'text-emerald-600': myVote === 1 }"
          :disabled="!canVote"
          aria-label="Vote up"
          :aria-pressed="myVote === 1"
          @click="reactions.toggleVote(1)"
        >
          <AppIcon name="up" :size="16" />
        </button>
        <Transition name="score" mode="out-in">
          <span
            :key="score"
            class="min-w-4 text-center font-semibold"
            :class="score > 0 ? 'text-emerald-600' : score < 0 ? 'text-danger' : 'text-ink'"
            aria-live="polite"
            >{{ score }}</span
          >
        </Transition>
        <button
          type="button"
          class="icon-button"
          :class="{ 'text-danger': myVote === -1 }"
          :disabled="!canVote"
          aria-label="Vote down"
          :aria-pressed="myVote === -1"
          @click="reactions.toggleVote(-1)"
        >
          <AppIcon name="down" :size="16" />
        </button>
      </div>
    </header>

    <p v-if="reactions.error.value" class="px-3 pt-2 text-xs text-danger" role="alert">
      {{ reactions.error.value }}
    </p>
    <div class="px-3 pt-3 pb-1">
      <blockquote
        v-if="quote"
        class="mb-3 truncate border-l-2 border-quote pl-3 text-muted"
        :title="quote"
      >
        {{ quote }}
      </blockquote>

      <p
        v-if="shown.isShadowed"
        class="mb-2 inline-block rounded bg-ink/5 px-2 py-0.5 text-xs font-medium text-muted"
      >
        shadowed: only the author and moderators see it
      </p>
      <template v-if="shown.isUfo">
        <p class="text-muted italic">A UFO flew in and published this inscription here.</p>
        <details v-if="shown.originalText" class="mt-2 text-sm">
          <summary class="cursor-pointer text-muted">Original text (moderators only)</summary>
          <!-- Sanitized on the server like any comment text -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            class="comment-text mt-1 rounded bg-card-header p-2 break-words"
            v-html="shown.originalText"
          />
        </details>
      </template>
      <!-- Sanitized on the server (allowlist: a, code, i, strong) -->
      <template v-else>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="comment-text leading-relaxed break-words" v-html="shown.text" />
        <CommentAttachments
          v-if="shown.attachments?.length"
          :comment-id="shown.id"
          :attachments="shown.attachments"
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

.score-enter-active,
.score-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.score-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.score-leave-to {
  opacity: 0;
  transform: translateY(4px);
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

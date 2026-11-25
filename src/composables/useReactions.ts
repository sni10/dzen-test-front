import { computed, ref, watch } from 'vue'

import { setBookmark, vote } from '@/api/reactions'
import type { Comment } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useLiveStore } from '@/stores/live'
import { useStatsStore } from '@/stores/stats'

/**
 * Votes and the bookmark of one comment, optimistic: the arrow and the score change at once and roll back
 * if the server refuses. The shown score is the latest known one — mine or anyone's (live comment.score).
 */
export function useReactions(comment: () => Comment) {
  const auth = useAuthStore()
  const live = useLiveStore()

  const myVote = ref<number | null>(comment().myVote ?? null)
  const bookmarked = ref(comment().bookmarked ?? false)
  const error = ref<string | null>(null)
  let busy = false

  watch(comment, (next) => {
    myVote.value = next.myVote ?? null
    bookmarked.value = next.bookmarked ?? false
  })

  const score = computed(() => live.scores[comment().id] ?? comment().score)
  const canReact = computed(() => auth.isSignedIn)
  const canVote = computed(() => auth.isSignedIn && !comment().isMine)

  function fail(err: unknown) {
    error.value = err instanceof Error ? err.message : 'Something went wrong'
    setTimeout(() => (error.value = null), 4000)
  }

  /** The same arrow again takes the vote back, the other one changes it */
  async function toggleVote(direction: 1 | -1) {
    if (!canVote.value || busy) return
    busy = true
    error.value = null
    const id = comment().id
    const before = { vote: myVote.value, score: score.value }
    const next = myVote.value === direction ? null : direction
    myVote.value = next
    live.scores[id] = before.score + (next ?? 0) - (before.vote ?? 0)
    try {
      const result = await vote(id, next)
      myVote.value = result.myVote
      live.scores[id] = result.score
    } catch (err) {
      myVote.value = before.vote
      live.scores[id] = before.score
      fail(err)
    } finally {
      busy = false
    }
  }

  /** Resolves to the bookmark state once the server has answered (unchanged when it refused) */
  async function toggleBookmark(): Promise<boolean> {
    if (!canReact.value || busy) return bookmarked.value
    busy = true
    error.value = null
    const before = bookmarked.value
    bookmarked.value = !before
    try {
      bookmarked.value = await setBookmark(comment().id, !before)
      useStatsStore().refresh() // the bookmarks card
    } catch (err) {
      bookmarked.value = before
      fail(err)
    } finally {
      busy = false
    }
    return bookmarked.value
  }

  return { myVote, bookmarked, score, canReact, canVote, error, toggleVote, toggleBookmark }
}

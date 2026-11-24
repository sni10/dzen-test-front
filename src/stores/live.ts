import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import { fetchSince } from '@/api/comments'
import type { Attachment, Comment } from '@/api/types'

type LiveEvent =
  | { type: 'comment.created'; comment: Comment }
  | { type: 'attachment.updated'; commentId: string; attachment: Attachment }

export type LiveStatus = 'connecting' | 'online' | 'offline'

const MAX_BACKOFF_MS = 30_000

/**
 * Live updates from /ws/comments/ (same origin). Components read what arrived:
 * `topLevel` — new top-level comments, `replies[parentId]` — new replies, `attachments[commentId]` — the
 * current attachments of a comment (e.g. an image that finished resizing). After a dropped connection the
 * gap is filled with GraphQL `commentsSince`.
 */
export const useLiveStore = defineStore('live', () => {
  const status = ref<LiveStatus>('offline')
  const topLevel = ref<Comment[]>([])
  const replies = reactive<Record<string, Comment[]>>({})
  const attachments = reactive<Record<string, Attachment[]>>({})

  let lastId = 0
  let socket: WebSocket | null = null
  let backoff = 1000
  let wasOnline = false
  let retry: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  /** The newest comment id this page knows about: the start of the catch-up after a reconnect */
  function remember(ids: string[]) {
    for (const id of ids) lastId = Math.max(lastId, Number(id))
  }

  function addComment(comment: Comment) {
    remember([comment.id])
    const list = comment.parentId ? (replies[comment.parentId] ??= []) : topLevel.value
    if (list.some((known) => known.id === comment.id)) return
    if (comment.parentId) list.push(comment)
    else topLevel.value = [comment, ...list]
  }

  function apply(event: LiveEvent) {
    if (event.type === 'comment.created') addComment(event.comment)
    else if (event.type === 'attachment.updated') {
      const current = attachments[event.commentId] ?? []
      attachments[event.commentId] = [
        ...current.filter((item) => item.id !== event.attachment.id),
        event.attachment,
      ]
    }
  }

  async function catchUp() {
    if (!lastId) return
    try {
      for (const comment of await fetchSince(String(lastId))) addComment(comment)
    } catch {
      // the next reconnect tries again
    }
  }

  function connect() {
    stopped = false
    clearTimeout(retry)
    status.value = 'connecting'
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
    socket = new WebSocket(`${scheme}://${location.host}/ws/comments/`)
    socket.onopen = () => {
      status.value = 'online'
      backoff = 1000
      if (wasOnline) void catchUp()
      wasOnline = true
    }
    socket.onmessage = (message) => {
      try {
        apply(JSON.parse(String(message.data)) as LiveEvent)
      } catch {
        // ignore a malformed message
      }
    }
    socket.onclose = () => {
      socket = null
      status.value = 'offline'
      if (stopped) return
      retry = setTimeout(connect, backoff)
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
    }
  }

  function disconnect() {
    stopped = true
    clearTimeout(retry)
    socket?.close()
  }

  return { status, topLevel, replies, attachments, remember, addComment, connect, disconnect }
})

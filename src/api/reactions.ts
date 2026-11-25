import { COMMENT_FIELDS } from './comments'
import { gql } from './graphql'
import type { CommentPage } from './types'

export interface VoteResult {
  score: number
  myVote: number | null
}

/** value 1 / -1, or null to take the vote back */
export async function vote(commentId: string, value: 1 | -1 | null): Promise<VoteResult> {
  if (value === null) {
    const data = await gql<{ unvote: VoteResult }>(
      'mutation($id: ID!) { unvote(commentId: $id) { score myVote } }',
      { id: commentId },
    )
    return data.unvote
  }
  const data = await gql<{ vote: VoteResult }>(
    'mutation($id: ID!, $value: Int!) { vote(commentId: $id, value: $value) { score myVote } }',
    { id: commentId, value },
  )
  return data.vote
}

export async function setBookmark(commentId: string, on: boolean): Promise<boolean> {
  const name = on ? 'bookmark' : 'unbookmark'
  const data = await gql<Record<string, boolean>>(
    `mutation($id: ID!) { ${name}(commentId: $id) }`,
    { id: commentId },
  )
  return data[name] ?? on
}

export async function fetchMyBookmarks(page: number, signal?: AbortSignal): Promise<CommentPage> {
  const data = await gql<{ myBookmarks: CommentPage }>(
    `query Bookmarks($page: Int!) {
      myBookmarks(page: $page) { totalCount page pageSize pageCount items { ${COMMENT_FIELDS} } }
    }`,
    { page },
    signal,
  )
  return data.myBookmarks
}

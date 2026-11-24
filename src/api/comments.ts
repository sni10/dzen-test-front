import { gql } from './graphql'
import type { Comment, CommentPage, CommentSort, ReplyPage } from './types'

/** How many replies to show per level before "show more" */
export const REPLIES_PAGE = 10

const FIELDS = `
  id userName email homePage text isUfo score repliesCount depth createdAt parentId rootId
`
const REPLY_FIELDS = `${FIELDS} parent { id userName text }`

// The feed brings two levels of replies at once (one SQL query per level on the server);
// deeper levels and "show more" are loaded on demand with REPLIES_QUERY.
const FEED_QUERY = `
query Feed($page: Int!, $sort: CommentSort!, $first: Int!) {
  comments(page: $page, sort: $sort) {
    totalCount page pageSize pageCount
    items {
      ${FIELDS}
      replies(first: $first) {
        hasMore endCursor
        items {
          ${REPLY_FIELDS}
          replies(first: $first) { hasMore endCursor items { ${REPLY_FIELDS} } }
        }
      }
    }
  }
}`

const REPLIES_QUERY = `
query Replies($id: ID!, $first: Int!, $after: ID) {
  comment(id: $id) {
    replies(first: $first, after: $after) {
      hasMore endCursor
      items {
        ${REPLY_FIELDS}
        replies(first: $first) { hasMore endCursor items { ${REPLY_FIELDS} } }
      }
    }
  }
}`

const THREAD_QUERY = `
query Thread($id: ID!, $first: Int!) {
  comment(id: $id) {
    ${REPLY_FIELDS}
    replies(first: $first) {
      hasMore endCursor
      items {
        ${REPLY_FIELDS}
        replies(first: $first) { hasMore endCursor items { ${REPLY_FIELDS} } }
      }
    }
  }
}`

export async function fetchFeed(
  page: number,
  sort: CommentSort,
  signal?: AbortSignal,
): Promise<CommentPage> {
  const data = await gql<{ comments: CommentPage }>(
    FEED_QUERY,
    { page, sort, first: REPLIES_PAGE },
    signal,
  )
  return data.comments
}

export async function fetchReplies(id: string, after: string | null): Promise<ReplyPage> {
  const data = await gql<{ comment: { replies: ReplyPage } | null }>(REPLIES_QUERY, {
    id,
    after,
    first: REPLIES_PAGE,
  })
  return data.comment?.replies ?? { items: [], hasMore: false, endCursor: after }
}

export async function fetchThread(id: string, signal?: AbortSignal): Promise<Comment | null> {
  const data = await gql<{ comment: Comment | null }>(
    THREAD_QUERY,
    { id, first: REPLIES_PAGE },
    signal,
  )
  return data.comment
}

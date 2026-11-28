import { gql } from './graphql'

export interface ShadowBan {
  id: string
  userName: string
  email: string
  isGuest: boolean
  reason: string
  createdAt: string
  liftedAt: string | null
  commentsCount: number
  /** shadowban / unban only: every comment of the author this call hid or showed again */
  commentIds: string[]
}

const BAN_FIELDS = 'id userName email isGuest reason createdAt liftedAt commentsCount commentIds'

export interface HiddenState {
  text: string
  isUfo: boolean
  originalText: string | null
}

export async function hideComment(commentId: string, reason = ''): Promise<HiddenState> {
  const data = await gql<{ ufoComment: HiddenState }>(
    'mutation($id: ID!, $reason: String!) { ufoComment(commentId: $id, reason: $reason) { text isUfo originalText } }',
    { id: commentId, reason },
  )
  return data.ufoComment
}

export async function restoreComment(commentId: string): Promise<HiddenState> {
  const data = await gql<{ restoreComment: HiddenState }>(
    'mutation($id: ID!) { restoreComment(commentId: $id) { text isUfo originalText } }',
    { id: commentId },
  )
  return data.restoreComment
}

export async function shadowban(
  commentId: string,
  hidePast: boolean,
  reason: string,
): Promise<ShadowBan> {
  const data = await gql<{ shadowban: ShadowBan }>(
    `mutation($id: ID!, $hidePast: Boolean!, $reason: String!) {
      shadowban(commentId: $id, hidePast: $hidePast, reason: $reason) { ${BAN_FIELDS} }
    }`,
    { id: commentId, hidePast, reason },
  )
  return data.shadowban
}

export async function unban(banId: string): Promise<ShadowBan> {
  const data = await gql<{ unban: ShadowBan }>(
    `mutation($id: ID!) { unban(banId: $id) { ${BAN_FIELDS} } }`,
    { id: banId },
  )
  return data.unban
}

export async function fetchShadowBans(signal?: AbortSignal): Promise<ShadowBan[]> {
  const data = await gql<{ shadowBans: ShadowBan[] }>(
    `{ shadowBans { ${BAN_FIELDS} } }`,
    {},
    signal,
  )
  return data.shadowBans
}

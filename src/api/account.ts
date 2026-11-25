import { COMMENT_FIELDS } from './comments'
import { gql } from './graphql'
import type { CommentPage } from './types'

export interface Profile {
  username: string
  email: string
  homePage: string
  isModerator: boolean
  commentsCount: number
}

export async function fetchProfile(): Promise<Profile | null> {
  const data = await gql<{ me: Profile | null }>(
    '{ me { username email homePage isModerator commentsCount } }',
  )
  return data.me
}

export async function fetchMyComments(page: number, signal?: AbortSignal): Promise<CommentPage> {
  const data = await gql<{ myComments: CommentPage }>(
    `query Mine($page: Int!) {
      myComments(page: $page) { totalCount page pageSize pageCount items { ${COMMENT_FIELDS} } }
    }`,
    { page },
    signal,
  )
  return data.myComments
}

export async function updateProfile(homePage: string): Promise<Profile> {
  const data = await gql<{ updateProfile: Profile }>(
    `mutation($homePage: String!) {
      updateProfile(homePage: $homePage) { username email homePage isModerator commentsCount }
    }`,
    { homePage },
  )
  return data.updateProfile
}

/** Returns a new access token: every other session of this user is signed out */
export async function changePassword(oldPassword: string, newPassword: string): Promise<string> {
  const data = await gql<{ changePassword: string }>(
    'mutation($old: String!, $new: String!) { changePassword(oldPassword: $old, newPassword: $new) }',
    { old: oldPassword, new: newPassword },
  )
  return data.changePassword
}

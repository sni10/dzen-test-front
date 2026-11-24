import { request } from './rest'
import type { Comment } from './types'

export interface Captcha {
  key: string
  /** PNG as a data: URI */
  image: string
  ttl: number
}

export interface NewComment {
  userName: string
  email: string
  homePage: string
  text: string
  parentId: string | null
  captchaKey: string
  captchaAnswer: string
}

/** The REST representation (snake_case) of a created comment */
interface RestComment {
  id: number
  parent: number | null
  root: number | null
  depth: number
  user_name: string
  email: string
  home_page: string
  text: string
  is_ufo: boolean
  replies_count: number
  score: number
  created_at: string
}

/** REST field names -> form field names, to show server errors under the right input */
export const FIELD_NAMES: Record<string, keyof NewComment | 'form'> = {
  user_name: 'userName',
  email: 'email',
  home_page: 'homePage',
  text: 'text',
  parent: 'form',
  captcha: 'captchaAnswer',
  captcha_key: 'captchaAnswer',
  captcha_answer: 'captchaAnswer',
  non_field_errors: 'form',
}

function fromRest(comment: RestComment): Comment {
  return {
    id: String(comment.id),
    userName: comment.user_name,
    email: comment.email,
    homePage: comment.home_page,
    text: comment.text,
    isUfo: comment.is_ufo,
    score: comment.score,
    repliesCount: comment.replies_count,
    depth: comment.depth,
    createdAt: comment.created_at,
    parentId: comment.parent === null ? null : String(comment.parent),
    rootId: comment.root === null ? null : String(comment.root),
    replies: { items: [], hasMore: false, endCursor: null },
  }
}

export function getCaptcha(): Promise<Captcha> {
  return request<Captcha>('/api/captcha/')
}

export async function postComment(data: NewComment): Promise<Comment> {
  const created = await request<RestComment>('/api/comments/', {
    method: 'POST',
    body: {
      user_name: data.userName,
      email: data.email,
      home_page: data.homePage,
      text: data.text,
      parent: data.parentId === null ? null : Number(data.parentId),
      captcha_key: data.captchaKey,
      captcha_answer: data.captchaAnswer,
    },
  })
  return fromRest(created)
}

export async function previewComment(text: string): Promise<string> {
  const result = await request<{ text: string }>('/api/comments/preview/', {
    method: 'POST',
    body: { text },
  })
  return result.text
}

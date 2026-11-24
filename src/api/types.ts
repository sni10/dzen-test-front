export type CommentSort =
  | 'USER_NAME_ASC'
  | 'USER_NAME_DESC'
  | 'EMAIL_ASC'
  | 'EMAIL_DESC'
  | 'CREATED_AT_ASC'
  | 'CREATED_AT_DESC'

export interface ReplyPage {
  items: Comment[]
  hasMore: boolean
  endCursor: string | null
}

export interface Comment {
  id: string
  userName: string
  email: string
  homePage: string
  /** Sanitized HTML from the server: only <a>, <code>, <i>, <strong> */
  text: string
  isUfo: boolean
  score: number
  repliesCount: number
  depth: number
  createdAt: string
  parentId: string | null
  rootId: string | null
  parent?: Pick<Comment, 'id' | 'userName' | 'text'> | null
  replies?: ReplyPage
}

export interface CommentPage {
  items: Comment[]
  totalCount: number
  page: number
  pageSize: number
  pageCount: number
}

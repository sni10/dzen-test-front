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

export interface Attachment {
  id: string
  /** image: JPG / GIF / PNG fitted into 320x240 on the server; text: TXT up to 100 KB */
  kind: 'image' | 'text'
  /** Relative URL on the same origin (/media/...) */
  url: string
  originalName: string
  size: number
  width: number | null
  height: number | null
  /** processing: the image is being resized in the background */
  status: 'processing' | 'ready' | 'failed'
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
  attachments?: Attachment[]
  /** Signed-in viewers only: my vote (1 / -1 / null), in my bookmarks, posted by me */
  myVote?: number | null
  bookmarked?: boolean
  isMine?: boolean
  /** Moderators only (null for everyone else): the hidden text, the author is shadow-banned */
  originalText?: string | null
  isShadowed?: boolean | null
  replies?: ReplyPage
}

export interface CommentPage {
  items: Comment[]
  totalCount: number
  page: number
  pageSize: number
  pageCount: number
}

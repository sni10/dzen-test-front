import { vi, type Mock } from 'vitest'

import type { Comment, CommentPage } from '@/api/types'

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>
export type FetchMock = Mock<FetchFn>

/** A typed fetch mock for vi.stubGlobal('fetch', ...) */
export const mockFetch = (impl: FetchFn): FetchMock => vi.fn<FetchFn>(impl)

/** Variables of the last GraphQL request that had any (the CAPTCHA and the stats query are skipped) */
export function lastVariables(fetchMock: FetchMock): Record<string, unknown> {
  const variables = fetchMock.mock.calls
    .filter(([url]) => url === '/graphql')
    .map(([, init]) => JSON.parse(String(init.body)).variables ?? {})
    .filter((vars) => Object.keys(vars).length)
  return variables[variables.length - 1]
}

let seq = 0

export function makeComment(overrides: Partial<Comment> = {}): Comment {
  seq += 1
  return {
    id: String(seq),
    userName: `user${seq}`,
    email: `user${seq}@example.com`,
    homePage: '',
    text: `Comment ${seq}`,
    isUfo: false,
    score: 0,
    repliesCount: 0,
    depth: 0,
    createdAt: '2022-05-22T22:30:00',
    parentId: null,
    rootId: null,
    ...overrides,
  }
}

export function makePage(items: Comment[], overrides: Partial<CommentPage> = {}): CommentPage {
  return { items, totalCount: items.length, page: 1, pageSize: 25, pageCount: 1, ...overrides }
}

/** A fetch mock answering GraphQL with `data` (or a function of the request body) */
export function graphqlFetch(
  data: unknown | ((body: { query: string; variables: Record<string, unknown> }) => unknown),
) {
  return async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    const payload = typeof data === 'function' ? (data as (b: typeof body) => unknown)(body) : data
    return new Response(JSON.stringify({ data: payload }), { status: 200 })
  }
}

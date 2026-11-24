import { afterEach, describe, expect, it, vi } from 'vitest'

import { GraphQLRequestError, gql } from '@/api/graphql'

import { mockFetch } from './helpers/comments'

afterEach(() => vi.unstubAllGlobals())

describe('gql', () => {
  it('posts the query to /graphql on the same origin and returns data', async () => {
    const fetchMock = mockFetch(async () => new Response(JSON.stringify({ data: { ok: true } })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(gql('{ ok }', { a: 1 })).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledWith(
      '/graphql',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ query: '{ ok }', variables: { a: 1 } }),
      }),
    )
  })

  it('throws GraphQL errors with their messages', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ errors: [{ message: 'page must be 1 or greater' }] })),
    )

    await expect(gql('{ x }')).rejects.toThrow(new GraphQLRequestError('page must be 1 or greater'))
  })

  it('reports HTTP and network failures', async () => {
    vi.stubGlobal('fetch', async () => new Response('oops', { status: 502 }))
    await expect(gql('{ x }')).rejects.toThrow('Server error (502)')

    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(gql('{ x }')).rejects.toThrow('Network error')
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../App.vue'
import router from '../router'

import {
  type FetchMock,
  graphqlFetch,
  lastVariables,
  makeComment,
  makePage,
  mockFetch,
} from './helpers/comments'

afterEach(() => vi.unstubAllGlobals())

async function mountAt(path: string, fetchMock: FetchMock) {
  vi.stubGlobal('fetch', fetchMock)
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const variablesOf = lastVariables

describe('home page', () => {
  it('loads the first page newest first and shows the table', async () => {
    const comments = [makeComment({ userName: 'Anonym' }), makeComment({ userName: 'Rum8' })]
    const fetchMock = mockFetch(
      graphqlFetch({ comments: makePage(comments, { totalCount: 30, pageCount: 2 }) }),
    )

    const wrapper = await mountAt('/', fetchMock)

    expect(variablesOf(fetchMock)).toMatchObject({ page: 1, sort: 'CREATED_AT_DESC' })
    expect(wrapper.text()).toContain('30 comments')
    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.find('[aria-label="Pages"]').exists()).toBe(true)
  })

  it('sorting by a column updates the URL and reloads from page 1', async () => {
    const fetchMock = mockFetch(
      graphqlFetch({ comments: makePage([makeComment()], { pageCount: 3 }) }),
    )
    const wrapper = await mountAt('/?page=2', fetchMock)

    await wrapper.find('[aria-label="Sort by E-mail"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ sort: 'email' })
    expect(variablesOf(fetchMock)).toMatchObject({ page: 1, sort: 'EMAIL_ASC' })

    await wrapper.find('[aria-label="Sort by E-mail"]').trigger('click')
    await flushPromises()
    expect(variablesOf(fetchMock)).toMatchObject({ sort: 'EMAIL_DESC' })
  })

  it('reads page and sort from the URL', async () => {
    const fetchMock = mockFetch(
      graphqlFetch({ comments: makePage([makeComment()], { page: 3, pageCount: 3 }) }),
    )

    await mountAt('/?page=3&sort=-user_name', fetchMock)

    expect(variablesOf(fetchMock)).toMatchObject({ page: 3, sort: 'USER_NAME_DESC' })
  })

  it('shows an error with retry', async () => {
    const fetchMock = mockFetch(async () => new Response('down', { status: 503 }))

    const wrapper = await mountAt('/?sort=email', fetchMock)

    expect(wrapper.text()).toContain('Server error (503)')
    expect(wrapper.find('button.underline').text()).toBe('Retry')
  })
})

describe('thread page', () => {
  it('loads one comment with its replies', async () => {
    const comment = makeComment({ userName: 'Deep', parentId: '1', depth: 1 })
    const fetchMock = mockFetch(graphqlFetch({ comment }))

    const wrapper = await mountAt(`/c/${comment.id}`, fetchMock)

    expect(variablesOf(fetchMock)).toMatchObject({ id: comment.id })
    expect(wrapper.text()).toContain('Deep')
    expect(wrapper.text()).toContain('All comments')
  })

  it('says when the comment does not exist', async () => {
    const wrapper = await mountAt('/c/424242', mockFetch(graphqlFetch({ comment: null })))

    expect(wrapper.text()).toContain('does not exist')
  })
})

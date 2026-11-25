import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { gql, GraphQLRequestError } from '@/api/graphql'
import { useAuthStore } from '@/stores/auth'
import MeView from '@/views/MeView.vue'

import { type FetchMock, makeComment, makePage, mockFetch } from './helpers/comments'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const PROFILE = {
  username: 'Rum8',
  email: 'rum@example.com',
  homePage: 'https://rum.dev',
  isModerator: false,
  commentsCount: 2,
}
const USER = {
  id: 7,
  username: 'Rum8',
  email: 'rum@example.com',
  home_page: '',
  is_moderator: false,
}

/** A GraphQL backend answering by the operation in the query text */
function backend(
  answer: (query: string, variables: Record<string, unknown>) => unknown,
): FetchMock {
  return mockFetch(async (url, init) => {
    if (url === '/api/auth/login/')
      return json({ access: 'x.eyJleHAiOjk5OTk5OTk5OTl9.y', user: USER })
    const body = JSON.parse(String(init.body))
    return json(answer(body.query, body.variables))
  })
}

const defaultAnswer = (query: string) => {
  if (query.includes('myComments')) {
    return { data: { myComments: makePage([makeComment({ id: '3', text: 'Mine' })]) } }
  }
  return { data: { me: PROFILE } }
}

async function mountCabinet(fetchMock: FetchMock, signedIn = true, path = '/me') {
  vi.stubGlobal('fetch', fetchMock)
  const auth = useAuthStore()
  if (signedIn) await auth.login('Rum8', 'pw')
  auth.ready = true
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/me', name: 'me', component: MeView },
      { path: '/c/:id', name: 'thread', component: stub },
    ],
  })
  await router.push(path)
  const wrapper = mount(MeView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const graphqlCalls = (fetchMock: FetchMock) =>
  fetchMock.mock.calls
    .filter(([url]) => url === '/graphql')
    .map(([, init]) => JSON.parse(String(init.body)))

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('gql field errors', () => {
  it('keeps extensions.field of each error', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(async () =>
        json({
          errors: [{ message: 'Wrong current password', extensions: { field: 'oldPassword' } }],
        }),
      ),
    )

    const error = await gql('mutation { x }').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(GraphQLRequestError)
    expect((error as GraphQLRequestError).fields).toEqual({ oldPassword: 'Wrong current password' })
  })
})

describe('cabinet', () => {
  it('asks a guest to sign in', async () => {
    const wrapper = await mountCabinet(backend(defaultAnswer), false)

    expect(wrapper.text()).toContain('Sign in to see your cabinet')
  })

  it('shows the profile and my comments without a reply button', async () => {
    const wrapper = await mountCabinet(backend(defaultAnswer))

    expect(wrapper.text()).toContain('rum@example.com')
    expect(wrapper.text()).toContain('2 comments')
    expect((wrapper.find('#me-home-page').element as HTMLInputElement).value).toBe(
      'https://rum.dev',
    )
    expect(wrapper.find('#c-3').text()).toContain('Mine')
    expect(wrapper.find('#c-3 [aria-label="Reply"]').exists()).toBe(false)
  })

  it('saves the home page and updates the session user', async () => {
    const fetchMock = backend((query) =>
      query.includes('updateProfile')
        ? { data: { updateProfile: { ...PROFILE, homePage: 'https://new.dev' } } }
        : defaultAnswer(query),
    )
    const wrapper = await mountCabinet(fetchMock)

    await wrapper.find('#me-home-page').setValue('https://new.dev')
    await wrapper.find('form[aria-label="Profile"]').trigger('submit')
    await flushPromises()

    const calls = graphqlCalls(fetchMock)
    expect(calls[calls.length - 1]!.variables).toEqual({ homePage: 'https://new.dev' })
    expect(wrapper.text()).toContain('Saved')
    expect(useAuthStore().user!.homePage).toBe('https://new.dev')
  })

  it('checks the home page before sending', async () => {
    const fetchMock = backend(defaultAnswer)
    const wrapper = await mountCabinet(fetchMock)
    const before = graphqlCalls(fetchMock).length

    await wrapper.find('#me-home-page').setValue('rum.dev')
    await wrapper.find('form[aria-label="Profile"]').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('An http:// or https:// address')
    expect(graphqlCalls(fetchMock)).toHaveLength(before)
  })

  it('changes the password and keeps this session with the new token', async () => {
    const fetchMock = backend((query) =>
      query.includes('changePassword')
        ? { data: { changePassword: 'new-access' } }
        : defaultAnswer(query),
    )
    const wrapper = await mountCabinet(fetchMock)

    await wrapper.find('#me-old-password').setValue('old-secret')
    await wrapper.find('#me-new-password').setValue('new-long-secret')
    await wrapper.find('form[aria-label="Change password"]').trigger('submit')
    await flushPromises()

    expect(useAuthStore().access).toBe('new-access')
    expect(wrapper.text()).toContain('other devices are signed out')
  })

  it('shows a wrong current password under its field', async () => {
    const fetchMock = backend((query) =>
      query.includes('changePassword')
        ? { errors: [{ message: 'Wrong current password', extensions: { field: 'oldPassword' } }] }
        : defaultAnswer(query),
    )
    const wrapper = await mountCabinet(fetchMock)

    await wrapper.find('#me-old-password').setValue('wrong-one')
    await wrapper.find('#me-new-password').setValue('new-long-secret')
    await wrapper.find('form[aria-label="Change password"]').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Wrong current password')
    expect(useAuthStore().access).not.toBe('new-access')
  })
})

describe('bookmarks tab', () => {
  const bookmarks = (query: string, unbookmark: () => unknown) => {
    if (query.includes('myBookmarks')) {
      const items = ['5', '6'].map((id) =>
        makeComment({ id, text: `Saved ${id}`, bookmarked: true }),
      )
      return { data: { myBookmarks: makePage(items) } }
    }
    if (query.includes('unbookmark')) return unbookmark()
    return { data: { me: PROFILE } }
  }

  it('drops a comment from the list once its bookmark is removed', async () => {
    const wrapper = await mountCabinet(
      backend((query) => bookmarks(query, () => ({ data: { unbookmark: false } }))),
      true,
      '/me?tab=bookmarks',
    )

    await wrapper.find('#c-5 [aria-label="Bookmark"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('#c-5').exists()).toBe(false)
    expect(wrapper.find('#c-6').exists()).toBe(true)
  })

  it('keeps it when the server refuses', async () => {
    const wrapper = await mountCabinet(
      backend((query) => bookmarks(query, () => ({ errors: [{ message: 'Try again later' }] }))),
      true,
      '/me?tab=bookmarks',
    )

    await wrapper.find('#c-5 [aria-label="Bookmark"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('#c-5').exists()).toBe(true)
    expect(wrapper.find('#c-5 [aria-label="Bookmark"]').attributes('aria-pressed')).toBe('true')
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { Comment } from '@/api/types'
import CommentCard from '@/components/comments/CommentCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useLiveStore } from '@/stores/live'
import MeView from '@/views/MeView.vue'

import { type FetchMock, makeComment, makePage, mockFetch } from './helpers/comments'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const USER = {
  id: 7,
  username: 'Rum8',
  email: 'rum@example.com',
  home_page: '',
  is_moderator: false,
}

/** GraphQL answers by operation; login for signing in */
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

const stub = { template: '<div />' }
const router = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/me', name: 'me', component: MeView },
      { path: '/c/:id', name: 'thread', component: stub },
    ],
  })

async function mountCard(comment: Comment, fetchMock: FetchMock, signedIn = true) {
  vi.stubGlobal('fetch', fetchMock)
  if (signedIn) await useAuthStore().login('Rum8', 'pw')
  const wrapper = mount(CommentCard, {
    props: { comment },
    global: { plugins: [router()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const score = (wrapper: ReturnType<typeof mount>) =>
  wrapper.find('[aria-label="Rating"] [aria-live]').text()
const pressed = (wrapper: ReturnType<typeof mount>, label: string) =>
  wrapper.find(`[aria-label="${label}"]`).attributes('aria-pressed')

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('votes', () => {
  it('a guest sees the rating but cannot vote or bookmark', async () => {
    const wrapper = await mountCard(
      makeComment({ score: 3 }),
      backend(() => ({})),
      false,
    )

    expect(score(wrapper)).toBe('3')
    expect(wrapper.find('[aria-label="Vote up"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[aria-label="Bookmark"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[aria-label="Rating"]').attributes('title')).toBe('Sign in to vote')
  })

  it('no voting on my own comment', async () => {
    const wrapper = await mountCard(
      makeComment({ isMine: true }),
      backend(() => ({})),
    )

    expect(wrapper.find('[aria-label="Vote up"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[aria-label="Bookmark"]').attributes('disabled')).toBeUndefined()
  })

  it('votes up at once, then takes the vote back with the same arrow', async () => {
    const fetchMock = backend((query, variables) =>
      query.includes('unvote')
        ? { data: { unvote: { score: 2, myVote: null } } }
        : { data: { vote: { score: 3, myVote: variables.value } } },
    )
    const wrapper = await mountCard(makeComment({ id: '5', score: 2, myVote: null }), fetchMock)

    await wrapper.find('[aria-label="Vote up"]').trigger('click')
    expect(score(wrapper)).toBe('3') // optimistic, before the answer
    await flushPromises()
    expect(pressed(wrapper, 'Vote up')).toBe('true')

    await wrapper.find('[aria-label="Vote up"]').trigger('click')
    await flushPromises()
    expect(score(wrapper)).toBe('2')
    expect(pressed(wrapper, 'Vote up')).toBe('false')
  })

  it('switching from up to down moves the score by two', async () => {
    const fetchMock = backend(() => ({ data: { vote: { score: 0, myVote: -1 } } }))
    const wrapper = await mountCard(makeComment({ score: 2, myVote: 1 }), fetchMock)

    await wrapper.find('[aria-label="Vote down"]').trigger('click')

    expect(score(wrapper)).toBe('0')
    await flushPromises()
    expect(pressed(wrapper, 'Vote down')).toBe('true')
  })

  it('rolls back and explains when the server refuses', async () => {
    const fetchMock = backend(() => ({ errors: [{ message: 'The comment does not exist' }] }))
    const wrapper = await mountCard(makeComment({ score: 4 }), fetchMock)

    await wrapper.find('[aria-label="Vote up"]').trigger('click')
    await flushPromises()

    expect(score(wrapper)).toBe('4')
    expect(pressed(wrapper, 'Vote up')).toBe('false')
    expect(wrapper.find('[role="alert"]').text()).toBe('The comment does not exist')
  })

  it("shows other people's votes live", async () => {
    const wrapper = await mountCard(
      makeComment({ id: '9', score: 1 }),
      backend(() => ({})),
    )

    useLiveStore().scores['9'] = 6
    await flushPromises()

    expect(score(wrapper)).toBe('6')
  })
})

describe('bookmarks', () => {
  it('toggles the bookmark', async () => {
    const fetchMock = backend((query) =>
      query.includes('unbookmark') ? { data: { unbookmark: false } } : { data: { bookmark: true } },
    )
    const wrapper = await mountCard(makeComment({ bookmarked: false }), fetchMock)

    await wrapper.find('[aria-label="Bookmark"]').trigger('click')
    await flushPromises()
    expect(pressed(wrapper, 'Bookmark')).toBe('true')

    await wrapper.find('[aria-label="Bookmark"]').trigger('click')
    await flushPromises()
    expect(pressed(wrapper, 'Bookmark')).toBe('false')
  })

  it('the cabinet lists them on the Bookmarks tab', async () => {
    const fetchMock = backend((query) => {
      if (query.includes('myBookmarks')) {
        return { data: { myBookmarks: makePage([makeComment({ id: '21', text: 'Saved one' })]) } }
      }
      if (query.includes('myComments')) return { data: { myComments: makePage([]) } }
      return {
        data: {
          me: {
            username: 'Rum8',
            email: 'rum@example.com',
            homePage: '',
            isModerator: false,
            commentsCount: 0,
          },
        },
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const auth = useAuthStore()
    await auth.login('Rum8', 'pw')
    auth.ready = true
    const appRouter = router()
    await appRouter.push('/me')
    const wrapper = mount(MeView, { global: { plugins: [appRouter] }, attachTo: document.body })
    await flushPromises()

    await wrapper
      .findAll('[role="tab"]')
      .find((t) => t.text() === 'Bookmarks')!
      .trigger('click')
    await flushPromises()

    expect(appRouter.currentRoute.value.query).toEqual({ tab: 'bookmarks' })
    expect(wrapper.find('#c-21').text()).toContain('Saved one')
  })
})

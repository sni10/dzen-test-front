import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { ShadowBan } from '@/api/moderation'
import type { Comment } from '@/api/types'
import CommentCard from '@/components/comments/CommentCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useLiveStore } from '@/stores/live'
import ModerationView from '@/views/ModerationView.vue'

import { type FetchMock, makeComment, mockFetch } from './helpers/comments'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const user = (isModerator: boolean) => ({
  id: 1,
  username: isModerator ? 'Mod' : 'Rum8',
  email: 'x@example.com',
  home_page: '',
  is_moderator: isModerator,
})

function backend(
  isModerator: boolean,
  answer: (query: string, variables: Record<string, unknown>) => unknown,
) {
  return mockFetch(async (url, init) => {
    if (url === '/api/auth/login/') {
      return json({ access: 'x.eyJleHAiOjk5OTk5OTk5OTl9.y', user: user(isModerator) })
    }
    const body = JSON.parse(String(init.body))
    return json(answer(body.query, body.variables))
  })
}

const graphqlCalls = (fetchMock: FetchMock) =>
  fetchMock.mock.calls
    .filter(([url]) => url === '/graphql')
    .map(([, init]) => JSON.parse(String(init.body)))

const stub = { template: '<div />' }
const router = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/c/:id', name: 'thread', component: stub },
    ],
  })

async function mountCard(comment: Comment, fetchMock: FetchMock, signedIn = true) {
  vi.stubGlobal('fetch', fetchMock)
  if (signedIn) await useAuthStore().login('x', 'pw')
  const wrapper = mount(CommentCard, {
    props: { comment },
    global: { plugins: [router()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('moderation menu', () => {
  it('only moderators get it', async () => {
    const asUser = await mountCard(
      makeComment(),
      backend(false, () => ({})),
    )
    expect(asUser.find('[aria-label="Moderate"]').exists()).toBe(false)
    asUser.unmount()

    const asModerator = await mountCard(
      makeComment(),
      backend(true, () => ({})),
    )
    expect(asModerator.find('[aria-label="Moderate"]').exists()).toBe(true)
  })

  it('hides the text (UFO) and restores it', async () => {
    const fetchMock = backend(true, (query) =>
      query.includes('ufoComment')
        ? { data: { ufoComment: { text: '', isUfo: true, originalText: 'Rude words' } } }
        : { data: { restoreComment: { text: 'Rude words', isUfo: false, originalText: null } } },
    )
    const wrapper = await mountCard(makeComment({ id: '4', text: 'Rude words' }), fetchMock)

    await wrapper.find('[aria-label="Moderate"]').trigger('click')
    await wrapper.find('[role="menu"] input').setValue('spam')
    await wrapper.findAll('[role="menuitem"]')[0]!.trigger('click')
    await flushPromises()

    expect(graphqlCalls(fetchMock).at(-1)!.variables).toEqual({ id: '4', reason: 'spam' })
    expect(wrapper.text()).toContain('A UFO flew in')
    expect(wrapper.find('details').text()).toContain('Rude words') // moderators can peek

    await wrapper.find('[aria-label="Moderate"]').trigger('click')
    expect(wrapper.findAll('[role="menuitem"]')[0]!.text()).toBe('Restore the text')
    await wrapper.findAll('[role="menuitem"]')[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('A UFO flew in')
  })

  it('shadow-bans the author after a confirmation', async () => {
    const fetchMock = backend(true, () => ({
      data: { shadowban: { id: '1', commentIds: ['8', '12'] } },
    }))
    const wrapper = await mountCard(makeComment({ id: '8', userName: 'Spammer' }), fetchMock)

    await wrapper.find('[aria-label="Moderate"]').trigger('click')
    await wrapper.findAll('[role="menuitem"]')[1]!.trigger('click')
    expect(wrapper.text()).toContain('Spammer will keep posting')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Ban')!
      .trigger('click')
    await flushPromises()

    expect(graphqlCalls(fetchMock).at(-1)!.variables).toEqual({
      id: '8',
      hidePast: true,
      reason: '',
    })
    expect(wrapper.text()).toContain('shadowed: only the author and moderators see it')
    expect(useLiveStore().updates['12']).toEqual({ isShadowed: true }) // another comment of the author
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('stays open when the clicked item re-renders away (the browser order of events)', async () => {
    const wrapper = await mountCard(
      makeComment(),
      backend(true, () => ({})),
    )
    await wrapper.find('[aria-label="Moderate"]').trigger('click')
    const item = wrapper.findAll('[role="menuitem"]')[1]!.element
    // In a browser Vue re-renders between this listener and the document one: the button is gone by then
    item.addEventListener('click', () => item.remove())

    item.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
  })

  it('closes on a click outside', async () => {
    const wrapper = await mountCard(
      makeComment(),
      backend(true, () => ({})),
    )
    await wrapper.find('[aria-label="Moderate"]').trigger('click')

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('shows the server refusal in the menu', async () => {
    const fetchMock = backend(true, () => ({
      errors: [{ message: 'A moderator cannot be banned' }],
    }))
    const wrapper = await mountCard(makeComment(), fetchMock)

    await wrapper.find('[aria-label="Moderate"]').trigger('click')
    await wrapper.findAll('[role="menuitem"]')[1]!.trigger('click')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Ban')!
      .trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="menu"] [role="alert"]').text()).toBe('A moderator cannot be banned')
  })
})

describe('everyone else', () => {
  it('sees the card change live when a moderator hides it', async () => {
    const wrapper = await mountCard(
      makeComment({ id: '6', text: 'Visible' }),
      backend(false, () => ({})),
      false,
    )

    useLiveStore().patch('6', { isUfo: true, text: '' })
    await flushPromises()

    expect(wrapper.text()).toContain('A UFO flew in')
    expect(wrapper.text()).not.toContain('Visible')
    expect(wrapper.find('details').exists()).toBe(false)
  })
})

describe('moderation page', () => {
  const BAN: ShadowBan = {
    id: '3',
    userName: 'Spammer',
    email: 'spam@example.com',
    isGuest: true,
    reason: 'ads',
    createdAt: '2022-05-22T22:30:00',
    liftedAt: null,
    commentsCount: 4,
    commentIds: [],
  }

  async function mountPage(isModerator: boolean, fetchMock: FetchMock) {
    vi.stubGlobal('fetch', fetchMock)
    const auth = useAuthStore()
    await auth.login('x', 'pw')
    auth.ready = true
    const wrapper = mount(ModerationView, {
      global: { plugins: [router()] },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('lists the bans and lifts one', async () => {
    const fetchMock = backend(true, (query) =>
      query.includes('unban')
        ? { data: { unban: { ...BAN, liftedAt: '2022-05-23T00:00:00', commentIds: ['5', '7'] } } }
        : { data: { shadowBans: [BAN] } },
    )
    const wrapper = await mountPage(true, fetchMock)

    expect(wrapper.text()).toContain('Spammer')
    expect(wrapper.text()).toContain('4 hidden comments')
    expect(wrapper.text()).toContain('“ads”')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Lift ban')!
      .trigger('click')
    await flushPromises()

    expect(graphqlCalls(fetchMock).at(-1)!.variables).toEqual({ id: '3' })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Nobody is banned'))
    expect(useLiveStore().updates['7']).toEqual({ isShadowed: false })
  })

  it('is closed to other users', async () => {
    const wrapper = await mountPage(
      false,
      backend(false, () => ({})),
    )

    expect(wrapper.text()).toContain('Moderators only.')
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '@/App.vue'
import CommentThread from '@/components/comments/CommentThread.vue'
import appRouter from '@/router'
import { useLiveStore } from '@/stores/live'

import { graphqlFetch, lastVariables, makeComment, makePage, mockFetch } from './helpers/comments'
import { FakeWebSocket } from './setup'

const socket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('live store', () => {
  it('connects to /ws/comments/ on the same origin and reports its status', async () => {
    const live = useLiveStore()

    await live.connect()
    expect(socket().url).toBe(`ws://${location.host}/ws/comments/`)
    expect(live.status).toBe('connecting')
    socket().open()
    expect(live.status).toBe('online')
  })

  it('collects new comments and replies once each, and attachment updates', async () => {
    const live = useLiveStore()
    await live.connect()
    socket().open()
    const top = makeComment({ id: '10' })
    const reply = makeComment({ id: '11', parentId: '10' })

    socket().emit({ type: 'comment.created', comment: top })
    socket().emit({ type: 'comment.created', comment: top }) // a duplicate (e.g. my own comment)
    socket().emit({ type: 'comment.created', comment: reply })
    socket().emit({
      type: 'attachment.updated',
      commentId: '10',
      attachment: { id: '1', status: 'ready' },
    })
    socket().onmessage?.({ data: 'not json' })

    expect(live.topLevel.map((c) => c.id)).toEqual(['10'])
    expect(live.replies['10']!.map((c) => c.id)).toEqual(['11'])
    expect(live.attachments['10']).toEqual([{ id: '1', status: 'ready' }])
  })

  it('reconnects with a growing delay and fetches what it missed', async () => {
    vi.useFakeTimers()
    const missed = makeComment({ id: '42' })
    const fetchMock = mockFetch(graphqlFetch({ commentsSince: [missed] }))
    vi.stubGlobal('fetch', fetchMock)
    const live = useLiveStore()
    live.remember(['7', '30'])
    await live.connect()
    socket().open()

    socket().drop()
    expect(live.status).toBe('offline')
    await vi.advanceTimersByTimeAsync(999)
    expect(FakeWebSocket.instances).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(FakeWebSocket.instances).toHaveLength(2)
    socket().drop() // never opened: the next try waits twice as long
    await vi.advanceTimersByTimeAsync(1999)
    expect(FakeWebSocket.instances).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    socket().open()
    await flushPromises()

    expect(lastVariables(fetchMock)).toEqual({ lastId: '30' })
    expect(live.topLevel.map((c) => c.id)).toEqual(['42'])
  })

  it('stops reconnecting after disconnect()', async () => {
    vi.useFakeTimers()
    const live = useLiveStore()
    await live.connect()

    live.disconnect()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(socket().closed).toBe(true)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
})

describe('live comments on the page', () => {
  async function mountApp(path: string, items = [makeComment({ id: '1' })]) {
    vi.stubGlobal('fetch', mockFetch(graphqlFetch({ comments: makePage(items) })))
    await appRouter.push(path)
    await appRouter.isReady()
    const wrapper = mount(App, { global: { plugins: [appRouter] }, attachTo: document.body })
    await flushPromises()
    socket().open()
    return wrapper
  }

  it('shows the live status in the header', async () => {
    const wrapper = await mountApp('/')
    await flushPromises()

    expect(wrapper.find('header [role="status"]').text()).toBe('Live')
  })

  it('puts a new comment on top of the newest-first first page', async () => {
    const wrapper = await mountApp('/')

    socket().emit({ type: 'comment.created', comment: makeComment({ id: '99', text: 'Hot' }) })
    await flushPromises()

    expect(wrapper.findAll('article').map((a) => a.attributes('id'))).toEqual(['c-99', 'c-1'])
    expect(wrapper.text()).toContain('2 threads')
  })

  it('offers a banner instead when another sort is shown', async () => {
    const wrapper = await mountApp('/?sort=email')

    socket().emit({ type: 'comment.created', comment: makeComment({ id: '99' }) })
    socket().emit({ type: 'comment.created', comment: makeComment({ id: '100' }) })
    await flushPromises()

    expect(wrapper.findAll('article')).toHaveLength(1) // the list does not jump under the reader
    const banner = wrapper.findAll('button').find((b) => b.text().includes('new comments'))!
    expect(banner.text()).toContain('2 new comments')
    await banner.trigger('click')
    await flushPromises()
    expect(appRouter.currentRoute.value.query).toEqual({})
  })

  it('adds a live reply under its parent in a thread', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/c/:id', name: 'thread', component: { template: '<div />' } }],
    })
    const wrapper = mount(CommentThread, {
      props: { comment: makeComment({ id: '5' }) },
      global: { plugins: [router] },
      attachTo: document.body,
    })

    useLiveStore().addComment(makeComment({ id: '6', parentId: '5', text: 'Live reply' }))
    await flushPromises()

    expect(wrapper.find('#c-6').text()).toContain('Live reply')
  })
})

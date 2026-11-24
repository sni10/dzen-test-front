import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'

import CommentCard from '@/components/comments/CommentCard.vue'
import CommentThread from '@/components/comments/CommentThread.vue'
import AppPagination from '@/components/ui/AppPagination.vue'

import { graphqlFetch, makeComment, mockFetch } from './helpers/comments'

let router: Router

beforeEach(async () => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/c/:id', name: 'thread', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
})

afterEach(() => vi.unstubAllGlobals())

function mountCard(props: Record<string, unknown>) {
  return mount(CommentCard, {
    props: props as never,
    global: { plugins: [router] },
    attachTo: document.body,
  })
}

function mountThread(props: Record<string, unknown>) {
  return mount(CommentThread, {
    props: props as never,
    global: { plugins: [router] },
    attachTo: document.body,
  })
}

describe('CommentCard', () => {
  it('shows the author, e-mail, date and the sanitized HTML', () => {
    const comment = makeComment({ userName: 'Anonym', text: 'Hi <strong>there</strong>' })
    const wrapper = mountCard({ comment, topLevel: true })

    expect(wrapper.text()).toContain('Anonym')
    expect(wrapper.text()).toContain(comment.email)
    expect(wrapper.text()).toContain('22.05.22 at 22:30')
    expect(wrapper.find('strong').text()).toBe('there')
    expect(wrapper.find(`a[href="/c/${comment.id}"]`).exists()).toBe(true)
  })

  it('links the name to the home page with safe rel', () => {
    const wrapper = mountCard({ comment: makeComment({ homePage: 'https://e.com' }) })
    const link = wrapper.find('a[href="https://e.com"]')

    expect(link.attributes('rel')).toContain('nofollow')
    expect(link.attributes('target')).toBe('_blank')
  })

  it('quotes the parent and offers to jump to it', () => {
    const reply = makeComment({
      parentId: '7',
      parent: { id: '7', userName: 'x', text: 'Parent <i>text</i>' },
    })
    const wrapper = mountCard({ comment: reply })

    expect(wrapper.find('blockquote').text()).toBe('Parent text')
    expect(wrapper.find('[aria-label="Go to parent comment"]').exists()).toBe(true)
  })

  it('opens the parent thread when the parent is not on the page', async () => {
    const wrapper = mountCard({ comment: makeComment({ parentId: '999' }) })

    await wrapper.find('[aria-label="Go to parent comment"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/c/999')
  })

  it('hides the text of a UFO comment', () => {
    const wrapper = mountCard({ comment: makeComment({ isUfo: true, text: 'secret' }) })

    expect(wrapper.text()).toContain('A UFO flew in')
    expect(wrapper.text()).not.toContain('secret')
  })
})

describe('CommentThread', () => {
  it('renders preloaded replies recursively', () => {
    const deep = makeComment({ depth: 2 })
    const reply = makeComment({
      depth: 1,
      replies: { items: [deep], hasMore: false, endCursor: deep.id },
    })
    const root = makeComment({
      repliesCount: 1,
      replies: { items: [reply], hasMore: false, endCursor: reply.id },
    })

    const wrapper = mountThread({ comment: root, topLevel: true })

    expect(wrapper.findAll('article').map((a) => a.attributes('id'))).toEqual([
      `c-${root.id}`,
      `c-${reply.id}`,
      `c-${deep.id}`,
    ])
    expect(wrapper.text()).not.toContain('Show')
  })

  it('loads more replies after the cursor', async () => {
    const first = makeComment({ depth: 1 })
    const more = makeComment({ depth: 1 })
    const root = makeComment({
      repliesCount: 2,
      replies: { items: [first], hasMore: true, endCursor: first.id },
    })
    const fetchMock = mockFetch(
      graphqlFetch({ comment: { replies: { items: [more], hasMore: false, endCursor: more.id } } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountThread({ comment: root })
    const button = wrapper.find('button.mt-2')
    expect(button.text()).toBe('Show 1 more reply')
    await button.trigger('click')
    await flushPromises()

    const variables = JSON.parse(String(fetchMock.mock.calls[0]![1].body)).variables
    expect(variables).toMatchObject({ id: root.id, after: first.id })
    expect(wrapper.findAll('article')).toHaveLength(3)
    expect(wrapper.find('button.mt-2').exists()).toBe(false)
  })

  it('offers to load replies that were not preloaded', () => {
    const wrapper = mountThread({ comment: makeComment({ depth: 3, repliesCount: 4 }) })

    expect(wrapper.text()).toContain('Show 4 more replies')
  })
})

describe('AppPagination', () => {
  it('shows neighbours and the ends with gaps', () => {
    const wrapper = mount(AppPagination, { props: { page: 6, pageCount: 20 } })
    const labels = wrapper
      .findAll('button, span')
      .map((el) => el.text())
      .filter(Boolean)

    expect(labels).toEqual(['1', '…', '4', '5', '6', '7', '8', '…', '20'])
    expect(wrapper.find('[aria-current="page"]').text()).toBe('6')
  })

  it('emits the chosen page and disables the ends', async () => {
    const wrapper = mount(AppPagination, { props: { page: 1, pageCount: 3 } })

    expect(wrapper.find('[aria-label="Previous page"]').attributes('disabled')).toBeDefined()
    await wrapper.find('[aria-label="Next page"]').trigger('click')
    expect(wrapper.emitted('change')).toEqual([[2]])
  })

  it('is hidden for a single page', () => {
    expect(
      mount(AppPagination, { props: { page: 1, pageCount: 1 } })
        .find('nav')
        .exists(),
    ).toBe(false)
  })
})

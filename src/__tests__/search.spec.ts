import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { SearchPage } from '@/api/comments'
import AppHeader from '@/components/layout/AppHeader.vue'
import SearchView from '@/views/SearchView.vue'

import { type FetchMock, lastVariables, makeComment, mockFetch } from './helpers/comments'

const json = (body: unknown) => new Response(JSON.stringify(body))

function page(overrides: Partial<SearchPage> = {}): SearchPage {
  return {
    items: [
      {
        comment: makeComment({ id: '7', userName: 'Rum8', text: 'GraphQL search works' }),
        highlight: 'GraphQL <mark>search</mark> works &lt;3',
      },
    ],
    totalCount: 1,
    page: 1,
    pageCount: 1,
    ...overrides,
  }
}

const stub = { template: '<div />' }
const makeRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/me', name: 'me', component: stub },
      { path: '/moderation', name: 'moderation', component: stub },
      { path: '/search', name: 'search', component: SearchView },
      { path: '/c/:id', name: 'thread', component: stub },
    ],
  })

async function mountSearch(path: string, fetchMock: FetchMock) {
  vi.stubGlobal('fetch', fetchMock)
  const router = makeRouter()
  await router.push(path)
  const wrapper = mount(SearchView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('search page', () => {
  it('searches the query from the URL and shows highlighted snippets', async () => {
    const fetchMock = mockFetch(async () => json({ data: { search: page() } }))
    const { wrapper } = await mountSearch('/search?q=search', fetchMock)

    expect(lastVariables(fetchMock)).toEqual({ query: 'search', page: 1 })
    expect(wrapper.text()).toContain('1 comment found for “search”')
    expect(wrapper.find('mark').text()).toBe('search')
    expect(wrapper.find('li p').text()).toBe('GraphQL search works <3') // escaped by the server, shown as text
    expect(wrapper.find('a[href="/c/7"]').exists()).toBe(true)
  })

  it('submits a new query into the URL', async () => {
    const { wrapper, router } = await mountSearch(
      '/search?q=old',
      mockFetch(async () => json({ data: { search: page() } })),
    )

    await wrapper.find('#search-page-input').setValue('  new words ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ q: 'new words' })
  })

  it('says when nothing is found', async () => {
    const { wrapper } = await mountSearch(
      '/search?q=zzz',
      mockFetch(async () => json({ data: { search: page({ items: [], totalCount: 0 }) } })),
    )

    expect(wrapper.text()).toContain('Nothing found')
  })

  it('reports an unavailable search', async () => {
    const { wrapper } = await mountSearch(
      '/search?q=x',
      mockFetch(async () =>
        json({
          errors: [
            {
              message: 'Search is unavailable, try again later',
              extensions: { code: 'SEARCH_UNAVAILABLE' },
            },
          ],
        }),
      ),
    )

    expect(wrapper.find('[role="alert"]').text()).toBe('Search is unavailable, try again later')
  })

  it('asks nothing of the server without a query', async () => {
    const fetchMock = mockFetch(async () => json({}))
    const { wrapper } = await mountSearch('/search', fetchMock)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('word forms are found too')
  })
})

describe('header search', () => {
  it('opens the results page', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(async () => json({ detail: 'no' })),
    )
    const router = makeRouter()
    await router.push('/')
    const header = mount(AppHeader, { global: { plugins: [router] }, attachTo: document.body })

    await header.find('#header-search').setValue('комментарий')
    await header.find('form[role="search"]').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe(
      '/search?q=%D0%BA%D0%BE%D0%BC%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%80%D0%B8%D0%B9',
    )
    expect((header.find('#header-search').element as HTMLInputElement).value).toBe('')
  })
})

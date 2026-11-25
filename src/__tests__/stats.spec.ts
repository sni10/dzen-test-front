import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Stats } from '@/api/comments'
import StatsBar from '@/components/comments/StatsBar.vue'
import { useLiveStore } from '@/stores/live'
import { useStatsStore } from '@/stores/stats'

import { makeComment, mockFetch } from './helpers/comments'

const answer = (stats: Stats) =>
  mockFetch(async () => new Response(JSON.stringify({ data: { stats } })))

const GUEST: Stats = { comments: 12, ufo: 2, shadowed: 4, myComments: null, myBookmarks: null }

async function mountBar(stats: Stats) {
  const fetchMock = answer(stats)
  vi.stubGlobal('fetch', fetchMock)
  const wrapper = mount(StatsBar, { attachTo: document.body })
  await flushPromises()
  return { wrapper, fetchMock }
}

/** "12 Comments": the number and the label of each card */
const labels = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('li').map((li) =>
    li
      .findAll('span.block')
      .map((part) => part.text())
      .join(' '),
  )

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('stats cards', () => {
  it('everyone sees the three public cards, shadowed included', async () => {
    const { wrapper } = await mountBar(GUEST)

    expect(labels(wrapper)).toEqual(['12 Comments', '2 Hidden by UFO', '4 Shadowed'])
  })

  it('a signed-in user also sees own comments and bookmarks', async () => {
    const { wrapper } = await mountBar({ ...GUEST, myComments: 3, myBookmarks: 5 })

    expect(labels(wrapper)).toEqual([
      '12 Comments',
      '2 Hidden by UFO',
      '4 Shadowed',
      '3 My comments',
      '5 My bookmarks',
    ])
  })

  it('refreshes once after a burst of live comments', async () => {
    vi.useFakeTimers()
    const { fetchMock } = await mountBar(GUEST)
    const live = useLiveStore()

    live.addComment(makeComment({ id: '501' }))
    live.addComment(makeComment({ id: '502' }))
    live.addComment(makeComment({ id: '503', parentId: '501' }))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1000)

    expect(fetchMock).toHaveBeenCalledTimes(2) // the first load + one refresh for the whole burst
  })

  it('keeps the last numbers when a refresh fails', async () => {
    await mountBar(GUEST)
    vi.stubGlobal(
      'fetch',
      mockFetch(async () => Promise.reject(new TypeError('offline'))),
    )

    await useStatsStore().load()

    expect(useStatsStore().stats).toEqual(GUEST)
  })
})

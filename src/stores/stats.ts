import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { type Stats, fetchStats } from '@/api/comments'

const DEBOUNCE_MS = 800

/** The stats cards. refresh() may be called on every live event: calls within a moment become one request */
export const useStatsStore = defineStore('stats', () => {
  const stats = shallowRef<Stats | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function load() {
    try {
      stats.value = await fetchStats()
    } catch {
      // keep the last numbers; the next event or reload tries again
    }
  }

  function refresh() {
    clearTimeout(timer)
    timer = setTimeout(() => void load(), DEBOUNCE_MS)
  }

  return { stats, load, refresh }
})

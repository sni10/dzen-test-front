import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import * as api from '@/api/auth'
import type { Me, Session } from '@/api/auth'
import { setSessionHooks } from '@/api/session'

export type AuthMode = 'login' | 'register'

/** Refresh this long before the access token expires (it lives 15 minutes) */
const EARLY_MS = 60_000

/** Seconds since the epoch when the JWT expires; 0 when it cannot be read */
export function tokenExpiry(token: string): number {
  try {
    const payload = token.split('.')[1] ?? ''
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return Number(JSON.parse(json).exp) || 0
  } catch {
    return 0
  }
}

/**
 * The signed-in user. The access token lives only in memory (not localStorage: a script injected into the page
 * could read it there); after a reload the session comes back from the httpOnly refresh cookie.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = shallowRef<Me | null>(null)
  const access = ref<string | null>(null)
  /** true once the first restore attempt finished (the header waits for it instead of flashing "Sign in") */
  const ready = ref(false)
  let refreshing: Promise<boolean> | null = null

  const isSignedIn = computed(() => user.value !== null)

  function apply(session: Session | null) {
    user.value = session?.user ?? null
    access.value = session?.access ?? null
  }

  /** One refresh at a time: the refresh token rotates, a second parallel call would use a revoked one */
  function refresh(): Promise<boolean> {
    refreshing ??= api
      .refresh()
      .then((session) => {
        apply(session)
        return true
      })
      .catch(() => {
        apply(null)
        return false
      })
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  /** A valid access token for the next request, refreshed shortly before it expires; null for guests */
  async function token(): Promise<string | null> {
    if (refreshing) await refreshing
    if (!access.value) return null
    if (tokenExpiry(access.value) * 1000 - Date.now() < EARLY_MS) await refresh()
    return access.value
  }

  async function restore() {
    await refresh()
    ready.value = true
  }

  async function login(loginName: string, password: string) {
    apply(await api.login(loginName, password))
  }

  async function register(data: Parameters<typeof api.register>[0]) {
    apply(await api.register(data))
  }

  async function logout() {
    try {
      await api.logout()
    } finally {
      apply(null) // signed out locally even if the network failed
    }
  }

  setSessionHooks(token, refresh)

  /** After a password change the server signs out every other session and hands this one a new token */
  function setAccess(token: string) {
    access.value = token
  }

  function setHomePage(homePage: string) {
    if (user.value) user.value = { ...user.value, homePage }
  }

  return {
    user,
    access,
    ready,
    isSignedIn,
    token,
    refresh,
    restore,
    login,
    register,
    logout,
    setAccess,
    setHomePage,
  }
})

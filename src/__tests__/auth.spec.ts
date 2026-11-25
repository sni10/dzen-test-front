import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { gql } from '@/api/graphql'
import { request } from '@/api/rest'
import AuthDialog from '@/components/auth/AuthDialog.vue'
import CommentForm from '@/components/form/CommentForm.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { tokenExpiry, useAuthStore } from '@/stores/auth'
import { useLiveStore } from '@/stores/live'

import { type FetchMock, mockFetch } from './helpers/comments'
import { FakeWebSocket } from './setup'

/** A JWT-shaped token expiring in `seconds` (only the payload matters to the SPA) */
function jwt(seconds: number, name = 'a'): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds, n: name }))
  return `x.${payload.replace(/=+$/, '')}.y`
}

const USER = {
  id: 7,
  username: 'Rum8',
  email: 'rum@example.com',
  home_page: '',
  is_moderator: false,
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

interface Server {
  refresh?: () => Response
  login?: (body: Record<string, unknown>) => Response
}

/** A fake backend for the auth endpoints, CAPTCHA, GraphQL and one protected REST call */
function backend({ refresh, login }: Server = {}): FetchMock {
  return mockFetch(async (url, init) => {
    const body = init.body ? JSON.parse(String(init.body)) : {}
    if (url === '/api/auth/refresh/') return refresh?.() ?? json({ detail: 'no' }, 401)
    if (url === '/api/auth/login/') return login?.(body) ?? json({ access: jwt(900), user: USER })
    if (url === '/api/auth/register/') return json({ access: jwt(900), user: USER }, 201)
    if (url === '/api/auth/logout/') return new Response(null, { status: 204 })
    if (url === '/api/captcha/')
      return json({ key: 'k', image: 'data:image/png;base64,1', ttl: 300 })
    return json({ data: { ok: true } })
  })
}

const callsTo = (fetchMock: FetchMock, url: string) =>
  fetchMock.mock.calls.filter(([called]) => called === url)

const bearer = (init: RequestInit) => new Headers(init.headers).get('Authorization')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('tokenExpiry', () => {
  it('reads exp from the payload', () => {
    const token = jwt(100)
    expect(tokenExpiry(token)).toBeGreaterThan(Date.now() / 1000 + 90)
    expect(tokenExpiry('garbage')).toBe(0)
  })
})

describe('auth store', () => {
  it('restores the session from the refresh cookie on start', async () => {
    vi.stubGlobal('fetch', backend({ refresh: () => json({ access: jwt(900), user: USER }) }))
    const auth = useAuthStore()

    await auth.restore()

    expect(auth.ready).toBe(true)
    expect(auth.user).toMatchObject({ id: '7', username: 'Rum8', isModerator: false })
  })

  it('stays a guest when there is no session', async () => {
    vi.stubGlobal('fetch', backend())
    const auth = useAuthStore()

    await auth.restore()

    expect(auth.ready).toBe(true)
    expect(auth.user).toBeNull()
    expect(await auth.token()).toBeNull()
  })

  it('refreshes an access token that is about to expire, once for parallel callers', async () => {
    const fresh = jwt(900, 'fresh')
    const fetchMock = backend({
      login: () => json({ access: jwt(30), user: USER }), // expires in 30 s: inside the safety margin
      refresh: () => json({ access: fresh, user: USER }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const auth = useAuthStore()
    await auth.login('Rum8', 'pw')

    const tokens = await Promise.all([auth.token(), auth.token(), auth.token()])

    expect(tokens).toEqual([fresh, fresh, fresh])
    expect(callsTo(fetchMock, '/api/auth/refresh/')).toHaveLength(1) // the refresh token rotates: one at a time
  })

  it('signs out locally even when the network fails', async () => {
    vi.stubGlobal('fetch', backend())
    const auth = useAuthStore()
    await auth.login('Rum8', 'pw')
    vi.stubGlobal(
      'fetch',
      mockFetch(async () => Promise.reject(new TypeError('offline'))),
    )

    await auth.logout().catch(() => undefined)

    expect(auth.user).toBeNull()
  })
})

describe('the token on requests', () => {
  it('sends the bearer token on REST and GraphQL, not on the auth endpoints', async () => {
    const fetchMock = backend()
    vi.stubGlobal('fetch', fetchMock)
    const auth = useAuthStore()
    await auth.login('Rum8', 'pw')

    await request('/api/protected/')
    await gql('{ ok }')

    expect(bearer(callsTo(fetchMock, '/api/protected/')[0]![1])).toBe(`Bearer ${auth.access}`)
    expect(bearer(callsTo(fetchMock, '/graphql')[0]![1])).toBe(`Bearer ${auth.access}`)
    expect(bearer(callsTo(fetchMock, '/api/auth/login/')[0]![1])).toBeNull()
  })

  it('refreshes and repeats a REST call answered with 401', async () => {
    const fresh = jwt(900, 'fresh')
    let protectedCalls = 0
    const fetchMock = mockFetch(async (url, init) => {
      if (url === '/api/auth/login/') return json({ access: jwt(900), user: USER })
      if (url === '/api/auth/refresh/') return json({ access: fresh, user: USER })
      protectedCalls += 1
      return bearer(init) === `Bearer ${fresh}` ? json({ ok: 1 }) : json({ detail: 'expired' }, 401)
    })
    vi.stubGlobal('fetch', fetchMock)
    await useAuthStore().login('Rum8', 'pw')

    await expect(request('/api/protected/')).resolves.toEqual({ ok: 1 })
    expect(protectedCalls).toBe(2)
  })

  it('opens the WebSocket with the token once signed in', async () => {
    vi.stubGlobal('fetch', backend())
    const auth = useAuthStore()
    const live = useLiveStore()
    await live.connect()
    expect(FakeWebSocket.instances[0]!.url).not.toContain('token=')

    await auth.login('Rum8', 'pw')
    await live.reconnect()

    const url = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!.url
    expect(url).toContain(`?token=${encodeURIComponent(auth.access!)}`)
    expect(FakeWebSocket.instances[0]!.closed).toBe(true)
  })
})

describe('auth dialog and header', () => {
  const stub = { template: '<div />' }
  const router = () =>
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: stub },
        { path: '/me', name: 'me', component: stub },
      ],
    })

  async function mountHeader(fetchMock: FetchMock) {
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mount(AppHeader, { global: { plugins: [router()] }, attachTo: document.body })
    await useAuthStore().restore()
    await flushPromises()
    return wrapper
  }

  const dialog = () => document.querySelector('[role="dialog"]') as HTMLFormElement | null
  const input = (name: string) =>
    document.querySelector(`[role="dialog"] input[autocomplete="${name}"]`) as HTMLInputElement

  async function type(name: string, value: string) {
    const element = input(name)
    element.value = value
    element.dispatchEvent(new Event('input'))
    await flushPromises()
  }

  async function submit() {
    dialog()!.dispatchEvent(new Event('submit'))
    await flushPromises()
  }

  it('signs in and shows the user in the header', async () => {
    const fetchMock = backend()
    const header = await mountHeader(fetchMock)

    await header
      .findAll('button')
      .find((b) => b.text() === 'Sign in')!
      .trigger('click')
    await flushPromises()
    await type('username', 'rum@example.com')
    await type('current-password', 'secret-pass')
    await submit()

    expect(JSON.parse(String(callsTo(fetchMock, '/api/auth/login/')[0]![1].body))).toEqual({
      login: 'rum@example.com',
      password: 'secret-pass',
    })
    expect(dialog()).toBeNull()
    expect(header.text()).toContain('Rum8')
    expect(header.text()).toContain('Sign out')
  })

  it('checks the fields before sending', async () => {
    const fetchMock = backend()
    const header = await mountHeader(fetchMock)
    await header
      .findAll('button')
      .find((b) => b.text() === 'Sign up')!
      .trigger('click')
    await flushPromises()

    await type('username', 'bad name')
    await type('new-password', 'short')
    await submit()

    expect(dialog()!.textContent).toContain('Only Latin letters and digits')
    expect(dialog()!.textContent).toContain('At least 8 characters')
    expect(callsTo(fetchMock, '/api/auth/register/')).toHaveLength(0)
  })

  it('shows the server message on a wrong password', async () => {
    const header = await mountHeader(
      backend({
        login: () => json({ non_field_errors: ['Wrong name, e-mail or password'] }, 400),
      }),
    )
    await header
      .findAll('button')
      .find((b) => b.text() === 'Sign in')!
      .trigger('click')
    await flushPromises()
    await type('username', 'Rum8')
    await type('current-password', 'wrong-pass')
    await submit()

    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toContain(
      'Wrong name, e-mail or password',
    )
  })

  it('a signed-in author posts under the profile name and e-mail', async () => {
    vi.stubGlobal('fetch', backend())
    await useAuthStore().login('Rum8', 'pw')

    const form = mount(CommentForm, { global: { plugins: [router()] }, attachTo: document.body })
    await flushPromises()

    const name = form.find('input[autocomplete="nickname"]').element as HTMLInputElement
    const email = form.find('input[autocomplete="email"]').element as HTMLInputElement
    expect([name.value, name.readOnly, email.value, email.readOnly]).toEqual([
      'Rum8',
      true,
      'rum@example.com',
      true,
    ])
  })

  it('AuthDialog closes on Escape', async () => {
    const wrapper = mount(AuthDialog, { props: { modelValue: 'login' }, attachTo: document.body })
    await flushPromises()

    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toEqual([[null]])
  })
})

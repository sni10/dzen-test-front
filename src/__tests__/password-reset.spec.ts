import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import AuthDialog from '@/components/auth/AuthDialog.vue'
import { useAuthStore } from '@/stores/auth'
import ResetPasswordView from '@/views/ResetPasswordView.vue'

import { type FetchMock, mockFetch } from './helpers/comments'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const USER = {
  id: 7,
  username: 'Rum8',
  email: 'rum@example.com',
  home_page: '',
  is_moderator: false,
}

const bodyOf = (fetchMock: FetchMock, url: string) =>
  JSON.parse(String(fetchMock.mock.calls.find(([called]) => called === url)![1].body))

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function type(selector: string, value: string) {
  const input = document.querySelector(selector) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

const submitDialog = async () => {
  document.querySelector('[role="dialog"]')!.dispatchEvent(new Event('submit'))
  await flushPromises()
}

describe('forgot password in the sign-in dialog', () => {
  it('asks for the e-mail and always answers the same', async () => {
    const fetchMock = mockFetch(async () => json({ detail: 'ok' }, 202))
    vi.stubGlobal('fetch', fetchMock)
    mount(AuthDialog, { props: { modelValue: 'login' }, attachTo: document.body })
    await flushPromises()

    const forgot = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Forgot'),
    )!
    forgot.click()
    await flushPromises()
    await type('input[type="email"]', 'rum@example.com')
    await submitDialog()

    expect(bodyOf(fetchMock, '/api/auth/password-reset/')).toEqual({ email: 'rum@example.com' })
    expect(document.querySelector('[role="status"]')!.textContent).toContain(
      'If an account uses this e-mail',
    )
  })

  it('checks the e-mail before sending', async () => {
    const fetchMock = mockFetch(async () => json({}, 202))
    vi.stubGlobal('fetch', fetchMock)
    mount(AuthDialog, { props: { modelValue: 'forgot' }, attachTo: document.body })
    await flushPromises()

    await type('input[type="email"]', 'not-an-email')
    await submitDialog()

    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Enter a valid e-mail')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('reset password page', () => {
  async function mountPage(query: Record<string, string>, fetchMock: FetchMock) {
    vi.stubGlobal('fetch', fetchMock)
    const stub = { template: '<div />' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: stub },
        { path: '/reset-password', name: 'reset-password', component: ResetPasswordView },
      ],
    })
    await router.push({ name: 'reset-password', query })
    const wrapper = mount(ResetPasswordView, {
      global: { plugins: [router] },
      attachTo: document.body,
    })
    await flushPromises()
    return { wrapper, router }
  }

  it('sets the new password, signs in and leaves the page', async () => {
    const fetchMock = mockFetch(async () =>
      json({ access: 'x.eyJleHAiOjk5OTk5OTk5OTl9.y', user: USER }),
    )
    const { wrapper, router } = await mountPage({ uid: 'Nw', token: 'abc-123' }, fetchMock)

    await wrapper.find('#reset-password').setValue('a-brand-new-secret')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(bodyOf(fetchMock, '/api/auth/password-reset/confirm/')).toEqual({
      uid: 'Nw',
      token: 'abc-123',
      password: 'a-brand-new-secret',
    })
    expect(useAuthStore().user!.username).toBe('Rum8')
    expect(router.currentRoute.value.name).toBe('home') // the token leaves the address bar
  })

  it('explains a used or expired link', async () => {
    const fetchMock = mockFetch(async () =>
      json({ token: ['The link is invalid or expired, ask for a new one'] }, 400),
    )
    const { wrapper } = await mountPage({ uid: 'Nw', token: 'old' }, fetchMock)

    await wrapper.find('#reset-password').setValue('a-brand-new-secret')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('invalid or expired')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('shows a weak password under the field and keeps the form', async () => {
    const fetchMock = mockFetch(async () =>
      json({ password: ['This password is too common.'] }, 400),
    )
    const { wrapper } = await mountPage({ uid: 'Nw', token: 'abc' }, fetchMock)

    await wrapper.find('#reset-password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('This password is too common.')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('without the link parameters it points to "Forgot password?"', async () => {
    const { wrapper } = await mountPage(
      {},
      mockFetch(async () => json({})),
    )

    expect(wrapper.find('[role="alert"]').text()).toContain('opens from the link in the e-mail')
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { postComment } from '@/api/posting'
import type { Attachment } from '@/api/types'
import CommentAttachments from '@/components/comments/CommentAttachments.vue'
import CommentForm from '@/components/form/CommentForm.vue'
import AppLightbox from '@/components/ui/AppLightbox.vue'
import { useLightboxStore } from '@/stores/lightbox'
import { useLiveStore } from '@/stores/live'
import { validateAttachment } from '@/utils/validation'

import { mockFetch } from './helpers/comments'

const file = (name: string, size: number, type = '') =>
  new File([new Uint8Array(size)], name, { type })

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: '1',
    kind: 'image',
    url: '/media/attachments/aa/1.png',
    originalName: 'cat.png',
    size: 2048,
    width: 320,
    height: 240,
    status: 'ready',
    ...overrides,
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('validateAttachment', () => {
  it('accepts images up to 5 MB and TXT up to 100 KB', () => {
    expect(validateAttachment(null)).toBeUndefined()
    expect(validateAttachment(file('a.JPG', 10, 'image/jpeg'))).toBeUndefined()
    expect(validateAttachment(file('a.gif', 5 * 1024 * 1024, 'image/gif'))).toBeUndefined()
    expect(validateAttachment(file('a.txt', 100 * 1024, 'text/plain'))).toBeUndefined()
  })

  it.each([
    ['a.bmp', 10, 'image/bmp'],
    ['a.webp', 10, 'image/webp'],
    ['a.exe', 10, 'application/x-msdownload'],
    ['a.png', 10, 'application/x-php'],
    ['a.png', 5 * 1024 * 1024 + 1, 'image/png'],
    ['a.txt', 100 * 1024 + 1, 'text/plain'],
    ['a.txt', 0, 'text/plain'],
  ])('rejects %s (%i bytes, %s)', (name, size, type) => {
    expect(validateAttachment(file(name, size, type))).toBeTruthy()
  })
})

describe('postComment', () => {
  it('sends multipart form data with the file; a top-level comment has no parent field', async () => {
    const fetchMock = mockFetch(async () =>
      json(
        {
          id: 9,
          parent: null,
          root: null,
          depth: 0,
          user_name: 'Rum8',
          email: 'r@e.com',
          home_page: '',
          text: 'x',
          is_ufo: false,
          replies_count: 0,
          score: 0,
          created_at: '2022-05-22T22:30:00',
          attachments: [
            {
              id: 3,
              kind: 'image',
              url: '/media/a.png',
              original_name: 'cat.png',
              size: 5,
              width: null,
              height: null,
              status: 'processing',
            },
          ],
        },
        201,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const cat = file('cat.png', 5, 'image/png')

    const created = await postComment({
      userName: 'Rum8',
      email: 'r@e.com',
      homePage: '',
      text: 'x',
      parentId: null,
      captchaKey: 'k',
      captchaAnswer: 'a',
      attachment: cat,
    })

    const init = fetchMock.mock.calls[0]![1]
    expect(init.body).toBeInstanceOf(FormData)
    const body = init.body as FormData
    expect(body.get('attachment')).toBeInstanceOf(File)
    expect(body.has('parent')).toBe(false)
    expect(new Headers(init.headers).has('Content-Type')).toBe(false) // the browser sets the boundary
    expect(created.attachments).toEqual([
      {
        id: '3',
        kind: 'image',
        url: '/media/a.png',
        originalName: 'cat.png',
        size: 5,
        width: null,
        height: null,
        status: 'processing',
      },
    ])
  })
})

describe('attachment field in the form', () => {
  async function mountForm() {
    vi.stubGlobal(
      'fetch',
      mockFetch(async () => json({ key: 'k', image: 'data:image/png;base64,1', ttl: 300 })),
    )
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    const wrapper = mount(CommentForm, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  async function pick(wrapper: Awaited<ReturnType<typeof mountForm>>, chosen: File) {
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [chosen], configurable: true })
    await input.trigger('change')
  }

  it('shows the chosen image with a local preview and can remove it', async () => {
    const wrapper = await mountForm()

    await pick(wrapper, file('cat.png', 2048, 'image/png'))

    expect(wrapper.find('img[alt="Chosen image"]').attributes('src')).toBe('blob:preview')
    expect(wrapper.text()).toContain('cat.png')
    expect(wrapper.text()).toContain('2 KB')
    await wrapper.find('[aria-label="Remove the attachment"]').trigger('click')
    expect(wrapper.text()).not.toContain('cat.png')
  })

  it('reports a wrong file at once', async () => {
    const wrapper = await mountForm()

    await pick(wrapper, file('big.txt', 200 * 1024, 'text/plain'))

    expect(wrapper.text()).toContain('A text file must be at most 100 KB')
  })
})

describe('CommentAttachments', () => {
  function mountAttachments(attachments: Attachment[]) {
    return mount(CommentAttachments, {
      props: { commentId: '7', attachments },
      attachTo: document.body,
    })
  }

  it('shows a ready image as a lightbox thumbnail and a text file as a chip', () => {
    const wrapper = mountAttachments([
      attachment(),
      attachment({
        id: '2',
        kind: 'text',
        url: '/media/n.txt',
        originalName: 'notes.txt',
        size: 3000,
      }),
    ])

    const image = wrapper.find('[data-lightbox-kind="image"]')
    expect(image.attributes('data-lightbox-url')).toBe('/media/attachments/aa/1.png')
    expect(image.find('img').attributes()).toMatchObject({ width: '320', height: '240' })
    expect(wrapper.find('[data-lightbox-kind="text"]').text()).toContain('notes.txt')
    expect(wrapper.text()).toContain('3 KB')
  })

  it('shows a placeholder until the live update says the image is ready', async () => {
    const wrapper = mountAttachments([
      attachment({ status: 'processing', width: null, height: null }),
    ])
    expect(wrapper.text()).toContain('Processing image')

    useLiveStore().attachments['7'] = [attachment()]
    await flushPromises()

    expect(wrapper.find('[data-lightbox-kind="image"]').exists()).toBe(true)
  })

  it('says when the file could not be processed', () => {
    const wrapper = mountAttachments([attachment({ status: 'failed' })])

    expect(wrapper.text()).toContain('could not be processed')
  })
})

describe('lightbox', () => {
  function mountPage() {
    const page = mount(
      {
        components: { CommentAttachments, AppLightbox },
        template: `<div>
          <CommentAttachments comment-id="1" :attachments="first" />
          <CommentAttachments comment-id="2" :attachments="second" />
          <AppLightbox />
        </div>`,
        data: () => ({
          first: [attachment({ id: '1', url: '/media/1.png', originalName: 'one.png' })],
          second: [
            attachment({ id: '2', url: '/media/2.png', originalName: 'two.png' }),
            attachment({ id: '3', kind: 'text', url: '/media/3.txt', originalName: 'three.txt' }),
          ],
        }),
      },
      { attachTo: document.body },
    )
    return page
  }

  const dialog = () => document.querySelector('[role="dialog"]')

  it('opens the clicked image and browses every attachment on the page', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(async () => new Response('Hello from TXT')),
    )
    const page = mountPage()

    await page.find('[data-lightbox-url="/media/2.png"]').trigger('click')
    await flushPromises()

    expect(dialog()?.querySelector('img')?.getAttribute('src')).toBe('/media/2.png')
    expect(dialog()?.textContent).toContain('2 / 3')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await flushPromises()
    expect(dialog()?.querySelector('pre')?.textContent).toBe('Hello from TXT')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await flushPromises()
    expect(dialog()?.querySelector('img')?.getAttribute('src')).toBe('/media/1.png') // wraps around

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(useLightboxStore().current).toBeNull()
    page.unmount()
  })

  it('locks page scrolling while open and closes on the backdrop', async () => {
    const page = mountPage()

    await page.find('[data-lightbox-url="/media/1.png"]').trigger('click')
    await flushPromises()
    expect(document.documentElement.classList.contains('overflow-hidden')).toBe(true)

    ;(dialog() as HTMLElement).click()
    await flushPromises()
    expect(useLightboxStore().current).toBeNull()
    expect(document.documentElement.classList.contains('overflow-hidden')).toBe(false)
    page.unmount()
  })
})

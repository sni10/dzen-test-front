import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import App from '@/App.vue'
import CommentThread from '@/components/comments/CommentThread.vue'
import CommentForm from '@/components/form/CommentForm.vue'
import appRouter from '@/router'
import { useAuthorStore } from '@/stores/author'
import { cleanAttribute, wrapSelection } from '@/utils/markup-edit'

import { type FetchMock, makeComment, makePage, mockFetch } from './helpers/comments'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

interface Backend {
  created?: (body: Record<string, unknown>) => Response
  feed?: unknown
}

/** A fake backend: CAPTCHA, posting, preview and GraphQL */
function backend({ created, feed }: Backend = {}): FetchMock {
  let captchas = 0
  return mockFetch(async (url, init) => {
    const body = init.body ? JSON.parse(String(init.body)) : {}
    if (url === '/api/captcha/') {
      captchas += 1
      return json({ key: `key${captchas}`, image: `data:image/png;base64,${captchas}`, ttl: 300 })
    }
    if (url === '/api/comments/preview/') return json({ text: `<i>${body.text}</i>` })
    if (url === '/api/comments/') {
      return (
        created?.(body) ??
        json(
          {
            id: 500,
            parent: body.parent,
            root: body.parent,
            depth: body.parent ? 1 : 0,
            user_name: body.user_name,
            email: body.email,
            home_page: body.home_page,
            text: body.text,
            is_ufo: false,
            replies_count: 0,
            score: 0,
            created_at: '2022-05-22T22:30:00',
          },
          201,
        )
      )
    }
    return json({ data: feed ?? { comments: makePage([]) } })
  })
}

const posts = (fetchMock: FetchMock) =>
  fetchMock.mock.calls
    .filter(([url]) => url === '/api/comments/')
    .map(([, init]) => JSON.parse(String(init.body)))

async function fill(wrapper: VueWrapper, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    const field = wrapper.find(label)
    await field.setValue(value)
    await field.trigger('blur')
  }
}

const VALID = {
  'input[autocomplete="nickname"]': 'Rum8',
  'input[type="email"]': 'rum@example.com',
  textarea: 'Hello <i>world</i>',
  'input[autocomplete="off"]': 'Ab3Cd',
}

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

async function mountForm(fetchMock: FetchMock, props: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', fetchMock)
  const wrapper = mount(CommentForm, {
    props: props as never,
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('wrapSelection (toolbar)', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(wrapSelection('say hello now', 4, 9, 'strong')).toEqual({
      text: 'say <strong>hello</strong> now',
      selectionStart: 12,
      selectionEnd: 17,
    })
  })

  it('inserts an empty pair with the caret inside', () => {
    expect(wrapSelection('ab', 1, 1, 'code')).toEqual({
      text: 'a<code></code>b',
      selectionStart: 7,
      selectionEnd: 7,
    })
  })

  it('builds a link; without a selection the title (or address) becomes the text', () => {
    expect(wrapSelection('', 0, 0, 'a', { href: 'https://e.com', title: 'Site' }).text).toBe(
      '<a href="https://e.com" title="Site">Site</a>',
    )
    expect(wrapSelection('x', 0, 1, 'a', { href: 'https://e.com' }).text).toBe(
      '<a href="https://e.com">x</a>',
    )
  })

  it('strips characters that would break the attribute', () => {
    expect(cleanAttribute(' a "quoted" <b> ')).toBe('a quoted b')
  })
})

describe('CommentForm', () => {
  it('loads a CAPTCHA and posts a valid comment', async () => {
    const fetchMock = backend()
    const wrapper = await mountForm(fetchMock)

    expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,1')
    await fill(wrapper, { ...VALID, 'input[type="url"]': 'https://rum.dev' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(posts(fetchMock)).toEqual([
      {
        user_name: 'Rum8',
        email: 'rum@example.com',
        home_page: 'https://rum.dev',
        text: 'Hello <i>world</i>',
        parent: null,
        captcha_key: 'key1',
        captcha_answer: 'Ab3Cd',
      },
    ])
    const created = wrapper.emitted('created')![0]![0] as { id: string; userName: string }
    expect(created).toMatchObject({ id: '500', userName: 'Rum8' })
    // the text is cleared, a new CAPTCHA shown, the author remembered
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,2')
    expect(useAuthorStore().fields.userName).toBe('Rum8')
  })

  it('does not send an invalid form and shows every problem', async () => {
    const fetchMock = backend()
    const wrapper = await mountForm(fetchMock)

    await fill(wrapper, { textarea: 'bad <b>tag</b>' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(posts(fetchMock)).toEqual([])
    const text = wrapper.text()
    expect(text).toContain('Enter your name')
    expect(text).toContain('Enter your e-mail')
    expect(text).toContain('<b> is not allowed')
    expect(text).toContain('Type the characters from the picture')
  })

  it('checks a field when leaving it and again on every change', async () => {
    const wrapper = await mountForm(backend())
    const name = wrapper.find('input[autocomplete="nickname"]')

    await name.setValue('bad name')
    expect(wrapper.text()).not.toContain('Only Latin letters')
    await name.trigger('blur')
    expect(wrapper.text()).toContain('Only Latin letters and digits')
    await name.setValue('good')
    await name.trigger('input')
    expect(wrapper.text()).not.toContain('Only Latin letters')
  })

  it('shows server field errors under the fields and takes a new CAPTCHA', async () => {
    const fetchMock = backend({
      created: () =>
        json(
          {
            text: ['<i> is not closed'],
            markup: { code: 'unclosed_tag', position: 0 },
            captcha: ['Wrong or expired CAPTCHA, enter the new one'],
          },
          400,
        ),
    })
    const wrapper = await mountForm(fetchMock)

    await fill(wrapper, VALID)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('<i> is not closed')
    expect(wrapper.text()).toContain('Wrong or expired CAPTCHA')
    expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,2')
    expect(wrapper.emitted('created')).toBeUndefined()
  })

  it('reports rate limiting', async () => {
    const wrapper = await mountForm(backend({ created: () => json({ detail: 'Slow down.' }, 429) }))

    await fill(wrapper, VALID)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('Slow down.')
  })

  it('wraps the selected text with a toolbar button', async () => {
    const wrapper = await mountForm(backend())
    const area = wrapper.find('textarea')
    await area.setValue('make this bold')
    ;(area.element as HTMLTextAreaElement).setSelectionRange(10, 14)

    await wrapper.find('[aria-label="Bold <strong>"]').trigger('click')

    expect((area.element as HTMLTextAreaElement).value).toBe('make this <strong>bold</strong>')
  })

  it('inserts a link from the link popover', async () => {
    const wrapper = await mountForm(backend())

    await wrapper.find('[aria-label=\'Link <a href="" title="">\']').trigger('click')
    await wrapper.find('[aria-label="Link address"]').setValue('https://e.com')
    await wrapper.find('[aria-label="Link title"]').setValue('Site')
    await wrapper.find('form[aria-label="Insert a link"]').trigger('submit')
    await flushPromises()

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe(
      '<a href="https://e.com" title="Site">Site</a>',
    )
  })

  it('previews the sanitized text without posting', async () => {
    const fetchMock = backend()
    const wrapper = await mountForm(fetchMock)
    await fill(wrapper, { textarea: 'hello' })

    const previewButton = wrapper.findAll('button').find((b) => b.text().includes('Preview'))!
    await previewButton.trigger('click')
    await flushPromises()

    expect(wrapper.find('.comment-preview').html()).toContain('<i>hello</i>')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(posts(fetchMock)).toEqual([])

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Edit'))!
      .trigger('click')
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('fills the author fields remembered from the last comment', async () => {
    useAuthorStore().remember({ userName: 'Saved', email: 's@example.com', homePage: '' })

    const wrapper = await mountForm(backend())

    expect((wrapper.find('input[autocomplete="nickname"]').element as HTMLInputElement).value).toBe(
      'Saved',
    )
  })
})

describe('replying in a thread', () => {
  it('opens one reply form, posts the reply and shows it under the comment', async () => {
    const fetchMock = backend()
    vi.stubGlobal('fetch', fetchMock)
    const root = makeComment({ id: '42', userName: 'Anonym', text: 'Root text' })
    const other = makeComment({ id: '43' })
    const wrapper = mount(
      {
        components: { CommentThread },
        props: ['a', 'b'],
        template: '<div><CommentThread :comment="a" /><CommentThread :comment="b" /></div>',
      },
      { props: { a: root, b: other }, global: { plugins: [router] }, attachTo: document.body },
    )

    const replyButtons = wrapper.findAll('[aria-label="Reply"]')
    await replyButtons[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('form[aria-label^="Reply to"]')).toHaveLength(1)
    await replyButtons[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('form[aria-label^="Reply to"]')).toHaveLength(1) // only one open at a time
    await replyButtons[0]!.trigger('click')
    await flushPromises()

    await fill(wrapper, VALID)
    await wrapper.find('form[aria-label="Reply to Anonym"]').trigger('submit')
    await flushPromises()

    expect(posts(fetchMock)[0]).toMatchObject({ parent: 42 })
    expect(wrapper.find('form[aria-label^="Reply to"]').exists()).toBe(false)
    const reply = wrapper.find('#c-500')
    expect(reply.exists()).toBe(true)
    expect(reply.find('blockquote').text()).toBe('Root text')
  })
})

describe('posting from the feed', () => {
  async function mountApp(path: string, fetchMock: FetchMock) {
    vi.stubGlobal('fetch', fetchMock)
    await appRouter.push(path)
    await appRouter.isReady()
    const wrapper = mount(App, { global: { plugins: [appRouter] }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('puts the new comment on top of the newest-first first page at once', async () => {
    const existing = makeComment({ id: '7' })
    const wrapper = await mountApp('/', backend({ feed: { comments: makePage([existing]) } }))

    await fill(wrapper, VALID)
    await wrapper.find('form[aria-label="New comment"]').trigger('submit')
    await flushPromises()

    expect(wrapper.findAll('article').map((a) => a.attributes('id'))).toEqual(['c-500', 'c-7'])
    expect(wrapper.text()).toContain('2 comments')
  })

  it('links to the comment when another sort is shown', async () => {
    const wrapper = await mountApp(
      '/?sort=email',
      backend({ feed: { comments: makePage([makeComment()]) } }),
    )

    await fill(wrapper, VALID)
    await wrapper.find('form[aria-label="New comment"]').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="status"]').text()).toContain('Your comment is posted')
    expect(wrapper.find('[role="status"] a').attributes('href')).toBe('/c/500')
  })
})

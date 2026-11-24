import { describe, expect, it } from 'vitest'

import { validateMarkup } from '@/utils/markup'
import cases from '@/utils/markup-cases.json'
import { validateField, validateForm } from '@/utils/validation'

const valid = cases.cases.filter((item) => item.error === null).map((item) => item.text)
const invalid = cases.cases.flatMap((item) =>
  item.error ? [[item.text, item.error] as const] : [],
)

describe('validateMarkup — the shared cases of the backend validator', () => {
  it('has both kinds of cases', () => {
    expect(valid.length).toBeGreaterThan(10)
    expect(invalid.length).toBeGreaterThan(20)
  })

  it.each(valid)('accepts %j', (text) => {
    expect(validateMarkup(text)).toBeNull()
  })

  it.each(invalid)('rejects %j', (text, expected) => {
    const error = validateMarkup(text)
    expect(error && { code: error.code, position: error.position }).toEqual(expected)
  })

  it('explains the problem', () => {
    expect(validateMarkup('<b>x</b>')?.message).toContain('<b> is not allowed')
    expect(validateMarkup('text <i>open')?.message).toBe('<i> is not closed')
  })

  it('is linear on hostile input', () => {
    const started = performance.now()
    validateMarkup('<i><strong>'.repeat(2000) + 'x' + '</strong></i>'.repeat(2000))
    validateMarkup('<a' + ' href="https://x.io"'.repeat(3000))
    expect(performance.now() - started).toBeLessThan(500)
  })
})

describe('form rules (same as the backend serializer)', () => {
  const valid = {
    userName: 'Rum8',
    email: 'rum@example.com',
    homePage: '',
    text: 'Hello <i>world</i>',
    captchaAnswer: 'Ab3Cd',
  }

  it('accepts a valid form', () => {
    expect(validateForm(valid)).toEqual({})
  })

  it.each([
    ['userName', ''],
    ['userName', 'a'],
    ['userName', 'bad name'],
    ['userName', 'юзер'],
    ['userName', 'x'.repeat(51)],
    ['email', ''],
    ['email', 'not-an-email'],
    ['email', 'a@'],
    ['homePage', 'example.com'],
    ['homePage', 'ftp://example.com'],
    ['homePage', 'javascript:alert(1)'],
    ['text', ''],
    ['text', '   '],
    ['text', 'x'.repeat(5001)],
    ['text', '<b>bold</b>'],
    ['captchaAnswer', ''],
    ['captchaAnswer', 'Ab-3'],
  ] as const)('rejects %s = %j', (field, value) => {
    expect(validateField(field, value)).toBeTruthy()
  })

  it('home page is optional', () => {
    expect(validateField('homePage', '')).toBeUndefined()
    expect(validateField('homePage', 'https://example.com/me')).toBeUndefined()
  })
})

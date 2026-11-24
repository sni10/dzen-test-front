/** Form rules — the same as the backend serializer (comments/serializers.py) and the CAPTCHA service. */
import type { NewComment } from '@/api/posting'

import { validateMarkup } from './markup'

export const TEXT_MAX_LENGTH = 5000

export type FormField = 'userName' | 'email' | 'homePage' | 'text' | 'captchaAnswer'
export type FieldErrors = Partial<Record<FormField | 'form', string>>

const USER_NAME = /^[A-Za-z0-9]+$/
// Pragmatic e-mail shape; the server runs Django's EmailValidator
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CAPTCHA = /^[A-Za-z0-9]+$/

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

export function validateField(field: FormField, value: string): string | undefined {
  const trimmed = value.trim()
  switch (field) {
    case 'userName':
      if (!trimmed) return 'Enter your name'
      if (!USER_NAME.test(trimmed)) return 'Only Latin letters and digits'
      if (trimmed.length < 2 || trimmed.length > 50) return 'From 2 to 50 characters'
      return undefined
    case 'email':
      if (!trimmed) return 'Enter your e-mail'
      if (trimmed.length > 254 || !EMAIL.test(trimmed)) return 'Enter a valid e-mail'
      return undefined
    case 'homePage':
      if (!trimmed) return undefined
      if (trimmed.length > 200 || !isHttpUrl(trimmed)) return 'An http:// or https:// address'
      return undefined
    case 'text': {
      if (!trimmed) return 'Write a comment'
      if (value.length > TEXT_MAX_LENGTH) return `At most ${TEXT_MAX_LENGTH} characters`
      return validateMarkup(value)?.message
    }
    case 'captchaAnswer':
      if (!trimmed) return 'Type the characters from the picture'
      if (!CAPTCHA.test(trimmed)) return 'Only Latin letters and digits'
      return undefined
  }
}

export function validateForm(data: Pick<NewComment, FormField>): FieldErrors {
  const errors: FieldErrors = {}
  for (const field of ['userName', 'email', 'homePage', 'text', 'captchaAnswer'] as const) {
    const error = validateField(field, data[field])
    if (error) errors[field] = error
  }
  return errors
}

/**
 * Strict XHTML check of comment text — a port of the backend XhtmlValidator (comments/markup/validator.py).
 * Both run the same cases (markup-cases.json, copied from the backend), so the form reports exactly what the
 * server would reject, before sending. The server stays the authority: it validates and sanitizes again.
 *
 * Allowed: <a href="" title="">, <code>, <i>, <strong>; lowercase tags, double-quoted attributes, every tag
 * closed and properly nested, no link inside a link, href only http/https/mailto.
 * A "<" that cannot start a tag ("a < b") is plain text.
 */

export type MarkupErrorCode =
  | 'malformed_tag'
  | 'unknown_tag'
  | 'unknown_attribute'
  | 'duplicate_attribute'
  | 'missing_attribute'
  | 'unsafe_url'
  | 'nested_tag'
  | 'unexpected_closing_tag'
  | 'mismatched_closing_tag'
  | 'unclosed_tag'

export interface MarkupError {
  code: MarkupErrorCode
  message: string
  /** 0-based offset in the text */
  position: number
}

interface TagRule {
  attributes: string[]
  required: string[]
  urlAttributes: string[]
  canNestInItself: boolean
}

const RULES: Record<string, TagRule> = {
  a: {
    attributes: ['href', 'title'],
    required: ['href'],
    urlAttributes: ['href'],
    canNestInItself: false,
  },
  code: { attributes: [], required: [], urlAttributes: [], canNestInItself: true },
  i: { attributes: [], required: [], urlAttributes: [], canNestInItself: true },
  strong: { attributes: [], required: [], urlAttributes: [], canNestInItself: true },
}
export const ALLOWED_TAGS = Object.keys(RULES)
const URL_SCHEMES = ['http', 'https', 'mailto']

const TAG_START = /<(?=[A-Za-z/!?])/g
const OPEN_TAG = /<([a-z][a-z0-9]*)((?:\s+[a-z][a-z-]*="[^"<>]*")*)\s*>/y
const CLOSE_TAG = /<\/([a-z][a-z0-9]*)\s*>/y
const ATTRIBUTE = /\s+([a-z][a-z-]*)="([^"<>]*)"/g
const URL = /^([a-z][a-z0-9+.-]*):\S+$/i

const fail = (code: MarkupErrorCode, message: string, position: number): MarkupError => ({
  code,
  message,
  position,
})

function matchAt(pattern: RegExp, text: string, position: number): RegExpExecArray | null {
  pattern.lastIndex = position
  return pattern.exec(text)
}

function rule(name: string, position: number): TagRule | MarkupError {
  return (
    RULES[name] ??
    fail(
      'unknown_tag',
      `<${name}> is not allowed; allowed: ${ALLOWED_TAGS.map((tag) => `<${tag}>`).join(', ')}`,
      position,
    )
  )
}

const isError = (value: TagRule | MarkupError | null): value is MarkupError =>
  value !== null && 'code' in value

function checkOpen(
  name: string,
  rawAttributes: string,
  position: number,
  stack: { name: string; position: number }[],
): MarkupError | null {
  const tag = rule(name, position)
  if (isError(tag)) return tag
  if (!tag.canNestInItself && stack.some((open) => open.name === name)) {
    return fail('nested_tag', `<${name}> cannot be placed inside another <${name}>`, position)
  }
  const seen = new Set<string>()
  for (const [, attribute = '', value = ''] of rawAttributes.matchAll(ATTRIBUTE)) {
    if (!tag.attributes.includes(attribute)) {
      return fail(
        'unknown_attribute',
        `Attribute "${attribute}" is not allowed in <${name}>`,
        position,
      )
    }
    if (seen.has(attribute)) {
      return fail(
        'duplicate_attribute',
        `Attribute "${attribute}" is repeated in <${name}>`,
        position,
      )
    }
    seen.add(attribute)
    if (tag.urlAttributes.includes(attribute)) {
      const scheme = URL.exec(value.trim())?.[1]?.toLowerCase()
      if (!scheme || !URL_SCHEMES.includes(scheme)) {
        return fail(
          'unsafe_url',
          `Link must start with one of: ${URL_SCHEMES.join(', ')}`,
          position,
        )
      }
    }
  }
  const missing = tag.required.filter((attribute) => !seen.has(attribute)).sort()[0]
  if (missing)
    return fail('missing_attribute', `<${name}> needs the attribute "${missing}"`, position)
  stack.push({ name, position })
  return null
}

function checkClose(
  name: string,
  position: number,
  stack: { name: string; position: number }[],
): MarkupError | null {
  const tag = rule(name, position)
  if (isError(tag)) return tag
  const top = stack[stack.length - 1]
  if (!top) return fail('unexpected_closing_tag', `</${name}> has no opening tag`, position)
  if (top.name !== name) {
    return fail(
      'mismatched_closing_tag',
      `</${name}> closes <${top.name}>: tags must be closed in reverse order`,
      position,
    )
  }
  stack.pop()
  return null
}

/** null when the markup is valid, otherwise the first problem */
export function validateMarkup(text: string): MarkupError | null {
  const stack: { name: string; position: number }[] = []
  for (const start of text.matchAll(TAG_START)) {
    const position = start.index
    const closing = matchAt(CLOSE_TAG, text, position)
    const opening = closing ? null : matchAt(OPEN_TAG, text, position)
    const error = closing
      ? checkClose(closing[1]!, position, stack)
      : opening
        ? checkOpen(opening[1]!, opening[2] ?? '', position, stack)
        : fail(
            'malformed_tag',
            'Malformed tag: use lowercase tags, double-quoted attributes and a separate closing tag; ' +
              'write &lt; for a literal "<"',
            position,
          )
    if (error) return error
  }
  const unclosed = stack[stack.length - 1]
  return unclosed
    ? fail('unclosed_tag', `<${unclosed.name}> is not closed`, unclosed.position)
    : null
}

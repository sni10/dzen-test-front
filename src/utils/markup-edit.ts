/** Inserting allowed tags into the comment text (the [i] [strong] [code] [a] toolbar). Pure functions. */

export type ToolbarTag = 'i' | 'strong' | 'code' | 'a'

export interface Edit {
  text: string
  /** Selection to restore in the textarea */
  selectionStart: number
  selectionEnd: number
}

/** Attribute values may not contain quotes or angle brackets (the validator would reject them) */
export function cleanAttribute(value: string): string {
  return value.replace(/["<>]/g, '').trim()
}

/**
 * Wrap the selection in a tag. With no selection, insert an empty pair and put the caret inside;
 * with a selection, keep the wrapped text selected.
 */
export function wrapSelection(
  text: string,
  start: number,
  end: number,
  tag: ToolbarTag,
  link?: { href: string; title?: string },
): Edit {
  const attributes =
    tag === 'a' && link
      ? ` href="${cleanAttribute(link.href)}"` +
        (link.title && cleanAttribute(link.title) ? ` title="${cleanAttribute(link.title)}"` : '')
      : ''
  const open = `<${tag}${attributes}>`
  const close = `</${tag}>`
  const selected = text.slice(start, end)
  const inner =
    selected ||
    (tag === 'a' && link ? cleanAttribute(link.title ?? '') || cleanAttribute(link.href) : '')
  const result = text.slice(0, start) + open + inner + close + text.slice(end)
  const innerStart = start + open.length
  return { text: result, selectionStart: innerStart, selectionEnd: innerStart + inner.length }
}

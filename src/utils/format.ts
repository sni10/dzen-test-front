const pad = (value: number) => String(value).padStart(2, '0')

/** 22.05.22 at 22:30 — the reference format, in the viewer's time zone */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const day = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)}`
  return `${day} at ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Plain-text first line of sanitized HTML, for the quote of the parent comment */
export function quoteText(html: string, length = 120): string {
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > length ? `${line.slice(0, length - 1)}…` : line
}

export function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

// Soft pastel backgrounds with dark initials, picked by a stable hash of the name
const PALETTE = ['#e9e7fb', '#e3f0fb', '#e5f6ee', '#fdf0e1', '#fbe7ef', '#efe9e3', '#e7f4f6']

export function avatarColor(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0]!
}

export function initials(name: string): string {
  const parts = name.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g) ?? [name]
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : name.slice(0, 2)
  return letters.toUpperCase()
}

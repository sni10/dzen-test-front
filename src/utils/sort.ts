import type { CommentSort } from '@/api/types'

/** Sortable columns of the top-level table; the URL keeps `?sort=-created_at` style values */
export type SortColumn = 'user_name' | 'email' | 'created_at'

export interface SortState {
  column: SortColumn
  descending: boolean
}

export const DEFAULT_SORT: SortState = { column: 'created_at', descending: true } // LIFO

const COLUMNS: SortColumn[] = ['user_name', 'email', 'created_at']

export function parseSort(value: unknown): SortState {
  if (typeof value !== 'string') return DEFAULT_SORT
  const descending = value.startsWith('-')
  const column = (descending ? value.slice(1) : value) as SortColumn
  return COLUMNS.includes(column) ? { column, descending } : DEFAULT_SORT
}

export function sortToQuery(sort: SortState): string | undefined {
  const value = `${sort.descending ? '-' : ''}${sort.column}`
  return value === '-created_at' ? undefined : value // keep the default out of the URL
}

export function sortToEnum(sort: SortState): CommentSort {
  return `${sort.column.toUpperCase()}_${sort.descending ? 'DESC' : 'ASC'}` as CommentSort
}

/** Clicking the active column flips the direction; another column starts ascending (dates: newest first) */
export function toggleSort(current: SortState, column: SortColumn): SortState {
  if (current.column === column) return { column, descending: !current.descending }
  return { column, descending: column === 'created_at' }
}

export function parsePage(value: unknown): number {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

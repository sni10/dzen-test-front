import { describe, expect, it } from 'vitest'

import { avatarColor, initials } from '@/utils/avatar'
import { formatDate, pluralize, quoteText } from '@/utils/format'
import {
  DEFAULT_SORT,
  parsePage,
  parseSort,
  sortToEnum,
  sortToQuery,
  toggleSort,
} from '@/utils/sort'

describe('sort', () => {
  it('defaults to LIFO and keeps it out of the URL', () => {
    expect(parseSort(undefined)).toEqual(DEFAULT_SORT)
    expect(sortToQuery(DEFAULT_SORT)).toBeUndefined()
    expect(sortToEnum(DEFAULT_SORT)).toBe('CREATED_AT_DESC')
  })

  it('round-trips every column and direction through the URL and the GraphQL enum', () => {
    for (const column of ['user_name', 'email', 'created_at'] as const) {
      for (const descending of [false, true]) {
        const sort = { column, descending }
        const query = sortToQuery(sort) ?? '-created_at'
        expect(parseSort(query)).toEqual(sort)
        expect(sortToEnum(sort)).toBe(`${column.toUpperCase()}_${descending ? 'DESC' : 'ASC'}`)
      }
    }
  })

  it('ignores unknown values', () => {
    expect(parseSort('text')).toEqual(DEFAULT_SORT)
    expect(parseSort(['email'])).toEqual(DEFAULT_SORT)
  })

  it('toggles the active column, starts others ascending (dates newest first)', () => {
    expect(toggleSort(DEFAULT_SORT, 'created_at')).toEqual({
      column: 'created_at',
      descending: false,
    })
    expect(toggleSort(DEFAULT_SORT, 'email')).toEqual({ column: 'email', descending: false })
    expect(toggleSort({ column: 'email', descending: false }, 'email')).toEqual({
      column: 'email',
      descending: true,
    })
    expect(toggleSort({ column: 'email', descending: false }, 'created_at')).toEqual(DEFAULT_SORT)
  })

  it('parses the page number', () => {
    expect(parsePage('3')).toBe(3)
    for (const bad of [undefined, '0', '-1', 'abc', '1.5']) expect(parsePage(bad)).toBe(1)
  })
})

describe('format', () => {
  it('formats dates like the reference', () => {
    expect(formatDate('2022-05-22T22:30:00')).toBe('22.05.22 at 22:30')
    expect(formatDate('nonsense')).toBe('')
  })

  it('quotes the plain text of sanitized HTML, shortened', () => {
    expect(quoteText('Hello <i>big</i>\n<strong>world</strong> &amp; 1 &lt; 2')).toBe(
      'Hello big world & 1 < 2',
    )
    expect(quoteText('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`)
  })

  it('pluralizes', () => {
    expect(pluralize(1, 'reply', 'replies')).toBe('1 reply')
    expect(pluralize(3, 'reply', 'replies')).toBe('3 replies')
  })
})

describe('avatar', () => {
  it('makes initials from the name', () => {
    expect(initials('BobSmith')).toBe('BS')
    expect(initials('Rum8')).toBe('R8')
    expect(initials('alice')).toBe('AL')
  })

  it('picks a stable colour', () => {
    expect(avatarColor('Anonym')).toBe(avatarColor('Anonym'))
  })
})

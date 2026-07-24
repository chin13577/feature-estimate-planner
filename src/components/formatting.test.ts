import { describe, expect, it } from 'vitest'

import { formatNumber, formatTotal, pluralize } from './formatting'

describe('formatTotal', () => {
  it('renders zero as a dash to match empty estimate cells', () => {
    expect(formatTotal(0)).toBe('-')
  })

  it('drops trailing zeros', () => {
    expect(formatTotal(5)).toBe('5')
    expect(formatTotal(5.5)).toBe('5.5')
    expect(formatTotal(5.25)).toBe('5.25')
  })

  it('rounds away floating-point noise', () => {
    expect(formatTotal(0.30000000000000004)).toBe('0.3')
  })
})

describe('formatNumber', () => {
  it('keeps zero numeric, unlike formatTotal', () => {
    // Summary totals read better as "0" than "-" in a total row.
    expect(formatNumber(0)).toBe('0')
  })

  it('formats decimals the same way as formatTotal', () => {
    expect(formatNumber(12.5)).toBe('12.5')
  })
})

describe('pluralize', () => {
  it('singularises exactly one', () => {
    expect(pluralize(1, 'task')).toBe('1 task')
  })

  it('pluralises zero and many', () => {
    expect(pluralize(0, 'task')).toBe('0 tasks')
    expect(pluralize(3, 'task')).toBe('3 tasks')
    expect(pluralize(2, 'main feature')).toBe('2 main features')
  })
})

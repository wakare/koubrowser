import { describe, expect, it } from 'vitest'
import { calculateTablePageSize } from '../table/use-responsive-table-page-size'

const options = {
  fallback: 18,
  min: 6,
  max: 40,
  rowHeight: 28
} as const

describe('calculateTablePageSize', () => {
  it('uses the visible table height to choose a page size', () => {
    expect(calculateTablePageSize(560, options)).toBe(20)
  })

  it('clamps very small and very large panels', () => {
    expect(calculateTablePageSize(40, options)).toBe(6)
    expect(calculateTablePageSize(5000, options)).toBe(40)
  })

  it('keeps the fallback before layout has a measurable height', () => {
    expect(calculateTablePageSize(0, options)).toBe(18)
    expect(calculateTablePageSize(Number.NaN, options)).toBe(18)
  })
})

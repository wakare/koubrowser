import { describe, expect, it } from 'vitest'
import { normalizeObservedHeight } from '../table/use-observed-element-height'

describe('normalizeObservedHeight', () => {
  it('uses a measurable element height', () => {
    expect(normalizeObservedHeight(412.8, 294)).toBe(412)
  })

  it('keeps the fallback before layout is measurable', () => {
    expect(normalizeObservedHeight(0, 294)).toBe(294)
    expect(normalizeObservedHeight(Number.NaN, 294)).toBe(294)
  })
})

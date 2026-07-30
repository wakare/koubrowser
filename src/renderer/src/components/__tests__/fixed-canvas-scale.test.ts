import { describe, expect, it } from 'vitest'
import { calculateFixedCanvasScale } from '../layout/fixed-canvas-scale'

describe('calculateFixedCanvasScale', () => {
  it('shrinks a fixed logical canvas to the available width', () => {
    expect(calculateFixedCanvasScale(480, 600)).toBe(0.8)
  })

  it('does not enlarge a logical canvas by default', () => {
    expect(calculateFixedCanvasScale(900, 600)).toBe(1)
  })

  it('can enlarge the canvas when explicitly requested', () => {
    expect(calculateFixedCanvasScale(900, 600, true)).toBe(1.5)
  })

  it('keeps a safe initial scale before layout is measurable', () => {
    expect(calculateFixedCanvasScale(0, 600)).toBe(1)
    expect(calculateFixedCanvasScale(480, 0)).toBe(1)
  })
})

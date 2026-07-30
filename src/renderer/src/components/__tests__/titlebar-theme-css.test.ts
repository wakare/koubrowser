import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(
  resolve(process.cwd(), 'src/renderer/src/assets/main.scss'),
  'utf8'
)

describe('titlebar theme CSS contract', () => {
  it('provides every optional palette on the constrained data attribute', () => {
    for (const color of ['navy', 'graphite', 'brown']) {
      expect(stylesheet).toContain(`[data-titlebar-color='${color}']`)
    }
  })

  it('keeps the taiha warning overlay above every selected base color', () => {
    expect(stylesheet).toMatch(
      /\.titlebar \{[\s\S]*?&::before \{[\s\S]*?linear-gradient\(180deg, #800000, #660000, #800000\)[\s\S]*?opacity: 0/
    )
    expect(stylesheet).toMatch(
      /&\.is-taiha-singeki::before \{[\s\S]*?opacity: 1/
    )
  })
})

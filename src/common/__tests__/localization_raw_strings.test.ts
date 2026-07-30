import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('localization raw-string gate', () => {
  it('rejects unreviewed renderer and main-process Japanese UI literals', () => {
    const output = execFileSync(
      process.execPath,
      [resolve(process.cwd(), 'scripts/check-localization-raw-strings.js')],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    )

    expect(output).toContain('Localization raw-string audit passed')
  })
})

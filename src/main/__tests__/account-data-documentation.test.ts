import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const documentationFiles = [
  'docs/account-data-acceptance.md',
  'docs/cross-pc-data-requirements.md',
  'docs/issue-readiness.md'
] as const

describe('account data documentation', () => {
  it('keeps the acceptance and readiness guidance aligned with the quest merge policy', () => {
    for (const filename of documentationFiles) {
      const source = readFileSync(resolve(process.cwd(), filename), 'utf8')

      expect(source, filename).toContain('quest-monotonic-v1')
      expect(source, filename).not.toMatch(
        /`quest`[^\n。]*専用規則がない/u
      )
    }
  })
})

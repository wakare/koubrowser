import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const component = readFileSync(
  resolve(process.cwd(), 'src/renderer/src/components/QuestGuide.vue'),
  'utf8'
)
const stylesheet = readFileSync(
  resolve(process.cwd(), 'src/renderer/src/assets/assist.scss'),
  'utf8'
)

describe('quest guide source-conflict UI contract', () => {
  it('shows each source claim and marks unresolved prerequisite lists', () => {
    expect(component).toContain('v-for="detail in conflict.details"')
    expect(component).toContain('detail.prerequisiteGroups')
    expect(component).toContain("detail.reviewStatus !== 'verified'")
    expect(component).toContain('conflictReviewNote(detail)')
    expect(component).toContain('conflictTitle(conflict)')
    expect(component).toContain("'source-disagreement'")
    expect(component).toContain("'quest.guide.conflict.pending'")
    expect(component).toContain("'quest.guide.conflict.underReview'")
    expect(component).toContain("'quest.guide.conflict.incomplete'")
    expect(component).not.toContain('前提情報を確認中')
    expect(component).toContain('@click="openExternalUrl(detail.url)"')
  })

  it('keeps long prerequisite titles inside the conflict card', () => {
    expect(stylesheet).toMatch(
      /\.quest-conflict-details \{[\s\S]*?grid-template-columns: repeat\(auto-fit,[\s\S]*?minmax\(min\(220px, 100%\), 1fr\)/
    )
    expect(stylesheet).toMatch(
      /\.quest-conflict-prerequisites \{[\s\S]*?grid-template-columns: max-content minmax\(0, 1fr\)[\s\S]*?overflow-wrap: anywhere/
    )
  })
})

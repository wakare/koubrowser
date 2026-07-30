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

describe('quest guide recommendation view controls', () => {
  it('connects filter and search controls to the paged recommendation view', () => {
    expect(component).toContain('v-model="viewFilter"')
    expect(component).toContain('v-model="searchQuery"')
    expect(component).toContain('filterQuestGuideRecommendations(')
    expect(component).toContain('filteredRecommendations.value.slice(')
    expect(component).toContain("translateApp('quest.guide.empty.filter')")
    expect(component).toContain('@click="clearViewFilter"')
    expect(component).toContain('value="recurring-unregistered"')
    expect(component).toContain("translateApp('quest.guide.filter.recurringUnregistered')")
    expect(component).toContain("translateApp('quest.guide.filter.recurringUnresolved')")
    expect(component).toContain("translateApp('quest.guide.filter.recurringReview')")
    expect(component).toContain("translateApp('quest.guide.filter.relationReview')")
    expect(component).toContain("'quest.guide.summary.recurringUnregistered'")
    expect(component).toContain("'quest.guide.summary.recurringUnresolved'")
    expect(component).toContain("translateApp('quest.guide.badge.relationUnregisteredHelp')")
  })

  it('keeps the controls usable in a bounded panel width', () => {
    expect(stylesheet).toMatch(/\.quest-guide-view-controls \{[\s\S]*?flex-wrap: wrap/)
    expect(stylesheet).toMatch(/\.quest-guide-search \{[\s\S]*?flex: 1 1 220px/)
    expect(stylesheet).toMatch(/\.quest-guide-search \{[\s\S]*?input \{[\s\S]*?min-width: 0/)
  })
})

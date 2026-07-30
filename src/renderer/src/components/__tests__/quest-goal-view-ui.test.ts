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

describe('quest goal route view controls', () => {
  it('renders the derived bounded route without changing the goal plan', () => {
    expect(component).toContain('buildQuestGoalStepView(')
    expect(component).toContain('v-for="step in goalStepView.steps"')
    expect(component).toContain("goalViewMode = 'current'")
    expect(component).toContain("goalViewMode = 'all'")
    expect(component).toContain("translateApp('quest.guide.goal.outsideCurrent'")
    expect(component).toContain('goalStepView.candidateCount > GoalStepsCollapsedLimit')
    expect(component).toContain('@click="showAllGoalSteps = !showAllGoalSteps"')
    expect(component).toContain('v-model="goalSearchQuery"')
    expect(component).toContain('filterQuestGoalOptions(')
    expect(component).toContain('v-for="option in goalOptionsForSelect"')
    expect(component).toContain("translateApp('quest.guide.goal.candidates'")
    expect(component).toContain("translateApp('quest.guide.goal.keepSelected')")
  })

  it('uses compact segmented and full-width expansion controls', () => {
    expect(stylesheet).toMatch(/\.quest-goal-view-mode \{[\s\S]*?display: inline-flex/)
    expect(stylesheet).toMatch(/\.quest-goal-route-toggle \{[\s\S]*?width: 100%/)
    expect(stylesheet).toMatch(
      /\.quest-goal-selector \{[\s\S]*?grid-template-columns: minmax\(120px, 0\.8fr\) minmax\(190px, 1\.2fr\)/
    )
    expect(stylesheet).toMatch(
      /@container assist-panel \(max-width: 720px\) \{[\s\S]*?\.quest-goal-selector \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/
    )
  })
})

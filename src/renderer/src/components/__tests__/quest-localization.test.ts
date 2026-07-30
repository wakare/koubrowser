import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('quest panel localization wiring', () => {
  const questList = source('src/renderer/src/components/QuestList.vue')
  const questGuide = source('src/renderer/src/components/QuestGuide.vue')
  const questGuideLogic = source('src/common/quest_guide.ts')
  const questLogic = source('src/common/kcquest.ts')

  it('routes both visible quest panels through the runtime translator', () => {
    expect(questList).toContain("import { translateApp }")
    expect(questList).toContain("translateApp('quest.list.summary'")
    expect(questGuide).toContain("import { translateApp }")
    expect(questGuide).toContain("translateApp('quest.guide.title')")
    expect(questGuide).toContain('translate: translateApp')
  })

  it('uses structured progress and stable category mappings', () => {
    expect(questList).toContain('questProgressDetailItems(quest')
    expect(questList).toContain('formatQuestProgressDetailsHtml(details)')
    expect(questList).toContain('getQuestCategoryText(')
    expect(questList).toContain('getQuestTypeText(')
    expect(questList).not.toContain('questProgressDetailFormat')
    expect(questGuide).not.toContain('questProgressDetailFormat')
    expect(questGuide).not.toContain('questGuideProgressMarkupText')
    expect(questLogic).toContain('translate?: AppTranslator')
    expect(questLogic).toContain("translate('quest.progress.map.victory'")
  })

  it('removes direct app-owned literals while preserving game-owned fields', () => {
    expect(questList).not.toContain('任務情報 遂行中:')
    expect(questGuide).not.toContain('表示条件に一致する任務候補がありません')
    expect(questGuide).toContain('recommendation.quest.api_title')
    expect(questGuide).toContain('recommendation.quest.api_detail')
    expect(questGuideLogic).toContain('context.translate ?? DefaultQuestGuideTranslator')
    expect(questGuideLogic).not.toContain("text: '準備OK'")
  })
})

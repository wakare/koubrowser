import {
  ApiQuestCategory,
  ApiQuestType
} from '@common/kcs'
import {
  InternalPseudoLocale,
  createAppTranslator
} from '@common/localization'
import {
  formatQuestProgressDetailsHtml,
  getQuestCategoryText,
  getQuestTypeText
} from '@renderer/common/quest-view'
import { describe, expect, it } from 'vitest'

const japanese = createAppTranslator(() => 'ja-JP')
const pseudo = createAppTranslator(() => InternalPseudoLocale)

describe('quest view localization', () => {
  it('maps stable quest category and cadence values', () => {
    expect(getQuestCategoryText(ApiQuestCategory.ensyu, japanese)).toBe('演習')
    expect(
      getQuestTypeText(
        { api_type: ApiQuestType.weekly, api_label_type: 0 },
        japanese
      )
    ).toBe('週')
    expect(
      getQuestTypeText(
        { api_type: ApiQuestType.single, api_label_type: 107 },
        japanese
      )
    ).toBe('年')
  })

  it('routes stable values through the pseudo locale', () => {
    expect(getQuestCategoryText(ApiQuestCategory.ensei, pseudo)).toMatch(
      /^［.+］$/u
    )
    expect(
      getQuestTypeText(
        { api_type: ApiQuestType.monthly, api_label_type: 0 },
        pseudo
      )
    ).toMatch(/^［.+］$/u)
  })

  it('escapes structured progress labels before rendering HTML', () => {
    expect(
      formatQuestProgressDetailsHtml([
        {
          kind: 'equipment',
          label: '<script>alert("x")</script> 装備',
          current: 1,
          required: 2,
          completed: false
        }
      ])
    ).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; 装備 1/2'
    )
  })
})

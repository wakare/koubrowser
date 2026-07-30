import {
  ApiQuestCategory,
  ApiQuestLabelTypeYearLy,
  ApiQuestType,
  type ApiQuest
} from '@common/kcs'
import type { AppMessageKey, AppTranslator } from '@common/localization'
import type { QuestProgressDetailItem } from '@common/kcquest'
import { escapeHtmlText } from '@renderer/common/localized-html'

type QuestCategoryMessageKey = Extract<AppMessageKey, `quest.category.${string}`>
type QuestTypeMessageKey = Extract<AppMessageKey, `quest.type.${string}`>

const QuestCategoryMessageKeys: Readonly<
  Partial<Record<number, QuestCategoryMessageKey>>
> = {
  [ApiQuestCategory.hensei]: 'quest.category.formation',
  [ApiQuestCategory.syutugeki]: 'quest.category.sortie',
  [ApiQuestCategory.ensyu]: 'quest.category.practice',
  [ApiQuestCategory.ensei]: 'quest.category.expedition',
  [ApiQuestCategory.hokyu_nukyo]: 'quest.category.supplyRepair',
  [ApiQuestCategory.kousyou]: 'quest.category.factory',
  [ApiQuestCategory.kaisou]: 'quest.category.remodel',
  [ApiQuestCategory.kakutyou]: 'quest.category.sortie',
  [ApiQuestCategory.kakutyou2]: 'quest.category.sortie',
  [ApiQuestCategory.kakutyou3]: 'quest.category.sortie',
  [ApiQuestCategory.kousyou2]: 'quest.category.factory'
}

const QuestTypeMessageKeys: Readonly<
  Partial<Record<number, QuestTypeMessageKey>>
> = {
  [ApiQuestType.daily]: 'quest.type.daily',
  [ApiQuestType.weekly]: 'quest.type.weekly',
  [ApiQuestType.monthly]: 'quest.type.monthly',
  [ApiQuestType.single]: 'quest.type.single',
  [ApiQuestType.quarterly]: 'quest.type.quarterly'
}

export function getQuestCategoryText(category: number, translate: AppTranslator): string {
  const key = QuestCategoryMessageKeys[category]
  return key ? translate(key) : '?'
}

export function getQuestTypeText(
  quest: Pick<ApiQuest, 'api_type' | 'api_label_type'>,
  translate: AppTranslator
): string {
  if (quest.api_label_type > ApiQuestLabelTypeYearLy) {
    return translate('quest.type.yearly')
  }
  const key = QuestTypeMessageKeys[quest.api_type]
  return key ? translate(key) : '?'
}

export function formatQuestProgressDetailsHtml(
  items: readonly QuestProgressDetailItem[]
): string {
  return items
    .map(
      (item) =>
        `${escapeHtmlText(item.label)} ${item.current}/${item.required}`
    )
    .join(' ')
}

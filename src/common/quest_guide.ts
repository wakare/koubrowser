import {
  ApiQuestLabelTypeYearLy,
  ApiQuestState,
  ApiQuestType,
  KcsUtil,
  SlotitemType,
  type ApiQuest
} from '@common/kcs'
import {
  getQuestStuff,
  questSlotitemTypeLabel,
  QuestType,
  type DestroyItemCondition,
  type QuestConditionCheck,
  type QuestFleetCheck,
  type QuestProgressDetailItem,
  type QuestType as QuestTypeValue,
  type QuestMapOrCell
} from '@common/kcquest'
import {
  getCuratedQuestKnowledge,
  type QuestCuratedConflict,
  type QuestCuratedDownstream,
  type QuestCuratedResolvedGroup
} from '@common/quest_knowledge'
import {
  createAppTranslator,
  type AppMessageKey,
  type AppTranslator
} from '@common/localization'

const DefaultQuestGuideTranslator = createAppTranslator(() => 'ja-JP')

export type QuestGuideWikiSource = 'wikiwiki' | 'kcwiki'

export const QuestGuideWikiUrls: Readonly<Record<QuestGuideWikiSource, string>> = {
  wikiwiki: 'https://wikiwiki.jp/kancolle/任務',
  kcwiki: 'https://zh.kcwiki.cn/wiki/任务'
}

export function normalizeQuestGuideWikiSource(value: unknown): QuestGuideWikiSource {
  return value === 'kcwiki' ? 'kcwiki' : 'wikiwiki'
}

export function questGuideWikiUrl(source: QuestGuideWikiSource): string {
  return QuestGuideWikiUrls[source]
}

export type QuestGuideStatus = 'claim' | 'active' | 'available'
export type QuestGuideMapState = 'ready' | 'blocked' | 'unknown'
export type QuestGuideReadiness =
  | 'ready'
  | 'needs-preparation'
  | 'blocked'
  | 'unknown'
export type QuestGuideDeadlineUrgency = 'normal' | 'soon' | 'urgent' | 'expired'
export type QuestGuideSlotPressureLevel = 'unknown' | 'free' | 'tight' | 'full'
export type QuestGuideEquipmentRequirementKind = 'hold' | 'discard' | 'equip'
export type QuestGuideLocalMatchKind = 'fleet' | 'condition'
export type QuestGuideLimitedEvidenceSource =
  | 'game-api'
  | 'cached-game-data'
  | 'official-announcement'
export type QuestKnowledgeSourceId =
  | 'game-api'
  | 'cached-game-data'
  | 'bundled-definition'
  | 'curated-reference'
  | 'local-observation'
export type QuestKnowledgeConfidence = 'verified' | 'supported' | 'observed'

export interface QuestKnowledgeEvidence {
  source: QuestKnowledgeSourceId
  sourceLabel: string
  confidence: QuestKnowledgeConfidence
  summary: string
}

export interface QuestKnowledgeRelation {
  questId: number
  title: string
  observedCount: number
  evidence: QuestKnowledgeEvidence
}

export interface QuestKnowledgeReference {
  source: QuestGuideWikiSource
  label: string
  url: string
  structured: false
}

export type QuestRelationCoverageStatus =
  | 'represented'
  | 'unresolved'
  | 'unregistered'

export interface QuestKnowledgeEntry {
  questId: number
  relationCoverageStatus: QuestRelationCoverageStatus
  evidence: QuestKnowledgeEvidence[]
  curatedPrerequisiteGroups: QuestCuratedResolvedGroup[]
  curatedDownstream: QuestCuratedDownstream[]
  conflicts: QuestCuratedConflict[]
  prerequisites: QuestKnowledgeRelation[]
  downstream: QuestKnowledgeRelation[]
  references: QuestKnowledgeReference[]
}

export interface QuestGuideSnapshotEntry {
  no: number
  title: string
  state: number
  type: number
}

export interface QuestGuideLearnedUnlock {
  from: number
  fromTitle: string
  to: number
  title: string
  count: number
  lastSeenAt: string
}

export interface QuestGuideHistory {
  version: 1
  updatedAt: string
  snapshot: QuestGuideSnapshotEntry[]
  learnedUnlocks: QuestGuideLearnedUnlock[]
}

export interface QuestGuideContext {
  translate?: AppTranslator
  progressById?: ReadonlyMap<number, number>
  progressDetailsById?: ReadonlyMap<
    number,
    readonly QuestProgressDetailItem[]
  >
  progressDetailById?: ReadonlyMap<number, string>
  deckMatchById?: ReadonlyMap<number, boolean | undefined>
  fleetChecksById?: ReadonlyMap<number, readonly QuestFleetCheck[]>
  conditionChecksById?: ReadonlyMap<
    number,
    readonly QuestConditionCheck[]
  >
  availableMapKeys?: ReadonlySet<string>
  learnedUnlocks?: readonly QuestGuideLearnedUnlock[]
  questDataSource?: 'live' | 'cache'
  now?: Date
  equipmentStock?: readonly QuestGuideEquipmentStockEntry[]
  consumableStock?: readonly QuestGuideConsumableStockEntry[]
  equipmentConditionById?: ReadonlyMap<number, DestroyItemCondition | undefined>
  limitedEvidenceById?: ReadonlyMap<
    number,
    readonly QuestGuideLimitedEvidence[]
  >
}

export interface QuestGuideCadenceDeadline {
  resetsAt: string
  hoursRemaining: number
  text: string
  urgency: QuestGuideDeadlineUrgency
}

export interface QuestGuideLimitedEvidence {
  source: QuestGuideLimitedEvidenceSource
  sourceLabel: string
  confidence: QuestKnowledgeConfidence
  summary: string
  observedAt?: string
  endsAt?: string
  url?: string
}

export interface QuestGuideLimitedDeadline {
  endsAt: string
  hoursRemaining: number
  text: string
  urgency: QuestGuideDeadlineUrgency
  evidence: QuestGuideLimitedEvidence
}

export interface QuestGuideSlotPressure {
  active: number
  capacity: number
  remaining: number | undefined
  level: QuestGuideSlotPressureLevel
  text: string
}

export interface QuestGuideEquipmentStockEntry {
  itemId: number
  name: string
  type: SlotitemType
  owned: number
  disposable: number
  ownedByProficiency?: Readonly<Record<number, number>>
  disposableByProficiency?: Readonly<Record<number, number>>
  ownedVariants?: readonly QuestGuideEquipmentVariant[]
}

export interface QuestGuideEquipmentVariant {
  level: number
  proficiency: number
}

export interface QuestGuideEquipmentCatalogEntry {
  itemId: number
  name: string
  type: SlotitemType
}

export interface QuestGuideEquipmentInventoryItem {
  instanceId: number
  itemId: number
  locked: boolean
  level?: number
  proficiency?: number
}

export interface QuestGuideEquipmentRequirement {
  kind: QuestGuideEquipmentRequirementKind
  label: string
  required: number
  available: number
  missing: number
}

export interface QuestGuideConsumableStockEntry {
  itemId: number
  name: string
  owned: number
}

export interface QuestGuideConsumableRequirement {
  itemId: number
  label: string
  required: number
  available: number
  missing: number
}

export interface QuestGuideRecommendation {
  quest: ApiQuest
  score: number
  status: QuestGuideStatus
  statusText: string
  cadenceText: string
  cadenceDeadline: QuestGuideCadenceDeadline | undefined
  limitedEvidence: readonly QuestGuideLimitedEvidence[]
  limitedDeadline: QuestGuideLimitedDeadline | undefined
  equipmentRequirements: QuestGuideEquipmentRequirement[]
  consumableRequirements: QuestGuideConsumableRequirement[]
  progress: number
  progressDetails: readonly QuestProgressDetailItem[]
  progressDetail: string | undefined
  materialTotal: number
  isLimited: boolean
  deckMatch: boolean | undefined
  matchKind: QuestGuideLocalMatchKind | undefined
  fleetChecks: readonly QuestFleetCheck[]
  conditionChecks: readonly QuestConditionCheck[]
  mapState: QuestGuideMapState
  readiness: QuestGuideReadiness
  readinessText: string
  readinessDetail: string
  maps: string[]
  reasons: string[]
  cautions: string[]
  learnedPrerequisites: QuestGuideLearnedUnlock[]
  learnedDownstream: QuestGuideLearnedUnlock[]
  knowledge: QuestKnowledgeEntry
}

export function questGuideProgressDetailText(
  count: readonly number[],
  countMax: readonly number[],
  translate: AppTranslator = DefaultQuestGuideTranslator
): string | undefined {
  if (
    count.length === 0 ||
    count.length !== countMax.length ||
    count.some((value) => !Number.isFinite(value)) ||
    countMax.some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    return undefined
  }

  if (count.length === 1) {
    return `${Math.max(0, count[0])}/${countMax[0]}`
  }

  return count
    .map(
      (value, index) =>
        `${translate('quest.progress.condition', {
          params: { index: index + 1 }
        })} ${Math.max(0, value)}/${countMax[index]}`
    )
    .join(' / ')
}

export function questGuideProgressMarkupText(value: string): string | undefined {
  const text = value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return text || undefined
}

export function questGuideProgressDetailsText(
  items: readonly QuestProgressDetailItem[]
): string | undefined {
  if (items.length === 0) {
    return undefined
  }
  return items
    .map((item) => `${item.label} ${item.current}/${item.required}`)
    .join(' / ')
}

const emptyHistory = (now: string): QuestGuideHistory => ({
  version: 1,
  updatedAt: now,
  snapshot: [],
  learnedUnlocks: []
})

export function createQuestGuideHistory(now = new Date().toISOString()): QuestGuideHistory {
  return emptyHistory(now)
}

export function normalizeQuestGuideHistory(
  value: unknown,
  now = new Date().toISOString()
): QuestGuideHistory {
  if (!value || typeof value !== 'object') {
    return emptyHistory(now)
  }

  const history = value as Partial<QuestGuideHistory>
  if (
    history.version !== 1 ||
    !Array.isArray(history.snapshot) ||
    !Array.isArray(history.learnedUnlocks)
  ) {
    return emptyHistory(now)
  }

  return {
    version: 1,
    updatedAt: typeof history.updatedAt === 'string' ? history.updatedAt : now,
    snapshot: history.snapshot.filter(isSnapshotEntry),
    learnedUnlocks: history.learnedUnlocks.filter(isLearnedUnlock)
  }
}

function isSnapshotEntry(value: unknown): value is QuestGuideSnapshotEntry {
  if (!value || typeof value !== 'object') {
    return false
  }
  const entry = value as Partial<QuestGuideSnapshotEntry>
  return (
    typeof entry.no === 'number' &&
    typeof entry.title === 'string' &&
    typeof entry.state === 'number' &&
    typeof entry.type === 'number'
  )
}

function isLearnedUnlock(value: unknown): value is QuestGuideLearnedUnlock {
  if (!value || typeof value !== 'object') {
    return false
  }
  const entry = value as Partial<QuestGuideLearnedUnlock>
  return (
    typeof entry.from === 'number' &&
    typeof entry.fromTitle === 'string' &&
    typeof entry.to === 'number' &&
    typeof entry.title === 'string' &&
    typeof entry.count === 'number' &&
    typeof entry.lastSeenAt === 'string'
  )
}

/**
 * 「達成」状態だった任務が消え、同時に新しい任務が現れた場合だけ、
 * ローカル観測による後続関係として記録する。公式の開放条件ではない。
 */
export function updateQuestGuideHistory(
  historyValue: unknown,
  quests: readonly ApiQuest[],
  now = new Date().toISOString()
): QuestGuideHistory {
  const history = normalizeQuestGuideHistory(historyValue, now)
  const current = quests.map<QuestGuideSnapshotEntry>((quest) => ({
    no: quest.api_no,
    title: quest.api_title,
    state: quest.api_state,
    type: quest.api_type
  }))

  if (history.snapshot.length === 0) {
    return {
      ...history,
      updatedAt: now,
      snapshot: current
    }
  }

  const previousById = new Map(history.snapshot.map((entry) => [entry.no, entry]))
  const currentIds = new Set(current.map((entry) => entry.no))
  const removedCompleted = history.snapshot.filter(
    (entry) => entry.state === ApiQuestState.completed && !currentIds.has(entry.no)
  )
  const added = current.filter((entry) => !previousById.has(entry.no))
  const learnedUnlocks = history.learnedUnlocks.map((entry) => ({ ...entry }))

  for (const from of removedCompleted) {
    for (const to of added) {
      const found = learnedUnlocks.find((entry) => entry.from === from.no && entry.to === to.no)
      if (found) {
        found.count += 1
        found.lastSeenAt = now
        found.title = to.title
      } else {
        learnedUnlocks.push({
          from: from.no,
          fromTitle: from.title,
          to: to.no,
          title: to.title,
          count: 1,
          lastSeenAt: now
        })
      }
    }
  }

  return {
    version: 1,
    updatedAt: now,
    snapshot: current,
    learnedUnlocks
  }
}

export function questGuideMapKey(areaId: number, areaNo: number): string {
  return `${areaId}-${areaNo}`
}

export function questGuideMapText(areaId: number, areaNo: number): string {
  return areaId > 10 ? `E-${areaNo}` : `${areaId}-${areaNo}`
}

export function questGuideWikiSearchUrl(
  title: string,
  source: QuestGuideWikiSource = 'wikiwiki'
): string {
  if (source === 'kcwiki') {
    return `https://zh.kcwiki.cn/index.php?title=Special%3ASearch&fulltext=1&search=${encodeURIComponent(title)}`
  }

  return `https://wikiwiki.jp/kancolle/?cmd=search&type=AND&word=${encodeURIComponent(title)}`
}

export function questGuideIsLimited(quest: ApiQuest): boolean {
  return (
    KcsUtil.questIsSpecial(quest.api_no) ||
    /期間限定|限定任務|節分|バレンタイン|桃の節句|春季|梅雨|夏季|秋季|冬季|新春/.test(
      quest.api_title
    )
  )
}

const EXPLICIT_LIMITED_TITLE_PATTERN = /期間限定|限定任務/

export function questGuideLimitedEvidence(
  quest: ApiQuest,
  questDataSource: QuestGuideContext['questDataSource'] = 'live',
  observedAt = new Date(),
  translate: AppTranslator = DefaultQuestGuideTranslator
): QuestGuideLimitedEvidence[] {
  if (!EXPLICIT_LIMITED_TITLE_PATTERN.test(quest.api_title)) {
    return []
  }

  const isLive = questDataSource === 'live'
  return [
    {
      source: isLive ? 'game-api' : 'cached-game-data',
      sourceLabel: translate(
        isLive
          ? 'quest.guide.evidence.gameList'
          : 'quest.guide.evidence.cachedList'
      ),
      confidence: isLive ? 'verified' : 'supported',
      summary: translate('quest.guide.evidence.explicitLimited'),
      observedAt: observedAt.toISOString()
    }
  ]
}

export function questGuideCadenceText(
  quest: ApiQuest,
  translate: AppTranslator = DefaultQuestGuideTranslator
): string {
  if (quest.api_label_type > ApiQuestLabelTypeYearLy) {
    return translate('quest.guide.cadence.yearlyMonth', {
      params: {
        month: quest.api_label_type - ApiQuestLabelTypeYearLy
      }
    })
  }

  switch (quest.api_type) {
    case ApiQuestType.daily:
      return translate('quest.guide.cadence.daily')
    case ApiQuestType.weekly:
      return translate('quest.guide.cadence.weekly')
    case ApiQuestType.monthly:
      return translate('quest.guide.cadence.monthly')
    case ApiQuestType.single:
      return translate('quest.guide.cadence.single')
    case ApiQuestType.quarterly:
      return translate('quest.guide.cadence.quarterly')
    default:
      return translate('quest.guide.cadence.unknown')
  }
}

export function questGuideIsRecurring(
  quest: Pick<ApiQuest, 'api_type' | 'api_label_type'>
): boolean {
  return (
    quest.api_type !== ApiQuestType.single ||
    quest.api_label_type > ApiQuestLabelTypeYearLy
  )
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

interface JstDateParts {
  year: number
  monthIndex: number
  day: number
  dayOfWeek: number
}

function jstDateParts(date: Date): JstDateParts {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    monthIndex: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay()
  }
}

function atJstReset(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 5) - JST_OFFSET_MS)
}

function nextDailyReset(now: Date, parts: JstDateParts): Date {
  const today = atJstReset(parts.year, parts.monthIndex, parts.day)
  return today.getTime() > now.getTime()
    ? today
    : atJstReset(parts.year, parts.monthIndex, parts.day + 1)
}

function nextWeeklyReset(now: Date, parts: JstDateParts): Date {
  const daysUntilMonday = (8 - parts.dayOfWeek) % 7
  let candidate = atJstReset(parts.year, parts.monthIndex, parts.day + daysUntilMonday)
  if (candidate.getTime() <= now.getTime()) {
    candidate = atJstReset(parts.year, parts.monthIndex, parts.day + daysUntilMonday + 7)
  }
  return candidate
}

function nextMonthlyReset(now: Date, parts: JstDateParts): Date {
  const currentMonth = atJstReset(parts.year, parts.monthIndex, 1)
  return currentMonth.getTime() > now.getTime()
    ? currentMonth
    : atJstReset(parts.year, parts.monthIndex + 1, 1)
}

function nextQuarterlyReset(now: Date, parts: JstDateParts): Date {
  const resetMonths = [2, 5, 8, 11]
  for (const year of [parts.year, parts.year + 1]) {
    for (const monthIndex of resetMonths) {
      const candidate = atJstReset(year, monthIndex, 1)
      if (candidate.getTime() > now.getTime()) {
        return candidate
      }
    }
  }
  return atJstReset(parts.year + 1, 2, 1)
}

function nextYearlyReset(now: Date, parts: JstDateParts, resetMonth: number): Date {
  const monthIndex = resetMonth - 1
  const currentYear = atJstReset(parts.year, monthIndex, 1)
  return currentYear.getTime() > now.getTime()
    ? currentYear
    : atJstReset(parts.year + 1, monthIndex, 1)
}

function cadenceResetAt(quest: ApiQuest, now: Date): Date | undefined {
  const parts = jstDateParts(now)
  const resetMonth = quest.api_label_type - ApiQuestLabelTypeYearLy
  if (quest.api_label_type > ApiQuestLabelTypeYearLy && resetMonth <= 12) {
    return nextYearlyReset(now, parts, resetMonth)
  }

  switch (quest.api_type) {
    case ApiQuestType.daily:
      return nextDailyReset(now, parts)
    case ApiQuestType.weekly:
      return nextWeeklyReset(now, parts)
    case ApiQuestType.monthly:
      return nextMonthlyReset(now, parts)
    case ApiQuestType.quarterly:
      return nextQuarterlyReset(now, parts)
    default:
      return undefined
  }
}

export function questGuideCadenceDeadline(
  quest: ApiQuest,
  now = new Date(),
  translate: AppTranslator = DefaultQuestGuideTranslator
): QuestGuideCadenceDeadline | undefined {
  const resetAt = cadenceResetAt(quest, now)
  if (!resetAt) {
    return undefined
  }

  const hoursRemaining = Math.max(0, Math.ceil((resetAt.getTime() - now.getTime()) / HOUR_MS))
  const urgency: QuestGuideDeadlineUrgency =
    hoursRemaining <= 6 ? 'urgent' : hoursRemaining <= 24 ? 'soon' : 'normal'
  const text =
    hoursRemaining <= 48
      ? translate('quest.guide.deadline.resetHours', {
          params: { count: hoursRemaining }
        })
      : translate('quest.guide.deadline.resetDays', {
          params: { count: Math.ceil(hoursRemaining / 24) }
        })

  return {
    resetsAt: resetAt.toISOString(),
    hoursRemaining,
    text,
    urgency
  }
}

export function questGuideLimitedDeadline(
  evidence: readonly QuestGuideLimitedEvidence[],
  now = new Date(),
  translate: AppTranslator = DefaultQuestGuideTranslator
): QuestGuideLimitedDeadline | undefined {
  const valid = evidence
    .map((entry) => {
      if (!entry.endsAt) {
        return undefined
      }
      const endsAt = new Date(entry.endsAt)
      return Number.isFinite(endsAt.getTime()) ? { entry, endsAt } : undefined
    })
    .filter(
      (
        entry
      ): entry is {
        entry: QuestGuideLimitedEvidence
        endsAt: Date
      } => entry !== undefined
    )
    .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime())

  if (valid.length === 0) {
    return undefined
  }

  const next =
    valid.find((entry) => entry.endsAt.getTime() > now.getTime()) ??
    valid[valid.length - 1]
  const remainingMs = next.endsAt.getTime() - now.getTime()
  const hoursRemaining = Math.max(0, Math.ceil(remainingMs / HOUR_MS))
  const urgency: QuestGuideDeadlineUrgency =
    remainingMs <= 0
      ? 'expired'
      : hoursRemaining <= 6
        ? 'urgent'
        : hoursRemaining <= 24
          ? 'soon'
          : 'normal'
  const text =
    urgency === 'expired'
      ? translate('quest.guide.deadline.endPassed')
      : hoursRemaining <= 48
        ? translate('quest.guide.deadline.endHours', {
            params: { count: hoursRemaining }
          })
        : translate('quest.guide.deadline.endDays', {
            params: { count: Math.ceil(hoursRemaining / 24) }
          })

  return {
    endsAt: next.endsAt.toISOString(),
    hoursRemaining,
    text,
    urgency,
    evidence: next.entry
  }
}

export function questGuideSlotPressure(
  active: number,
  capacity: number,
  translate: AppTranslator = DefaultQuestGuideTranslator
): QuestGuideSlotPressure {
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return {
      active,
      capacity,
      remaining: undefined,
      level: 'unknown',
      text: translate('quest.guide.slotPressure.unknown', {
        params: { active }
      })
    }
  }

  const remaining = Math.max(0, capacity - active)
  const level: QuestGuideSlotPressureLevel =
    remaining === 0 ? 'full' : remaining === 1 ? 'tight' : 'free'
  return {
    active,
    capacity,
    remaining,
    level,
    text:
      remaining === 0
        ? translate('quest.guide.slotPressure.full', {
            params: { active, capacity }
          })
        : translate('quest.guide.slotPressure.available', {
            params: { active, capacity, remaining }
          })
  }
}

export function buildQuestGuideEquipmentStock(
  catalog: readonly QuestGuideEquipmentCatalogEntry[],
  inventory: readonly QuestGuideEquipmentInventoryItem[],
  equippedInstanceIds: ReadonlySet<number>
): QuestGuideEquipmentStockEntry[] {
  type MutableStockEntry = Omit<
    QuestGuideEquipmentStockEntry,
    'ownedByProficiency' | 'disposableByProficiency' | 'ownedVariants'
  > & {
    ownedByProficiency: Record<number, number>
    disposableByProficiency: Record<number, number>
    ownedVariants: QuestGuideEquipmentVariant[]
  }

  const byItemId = new Map<number, MutableStockEntry>()
  for (const item of catalog) {
    byItemId.set(item.itemId, {
      ...item,
      owned: 0,
      disposable: 0,
      ownedByProficiency: {},
      disposableByProficiency: {},
      ownedVariants: []
    })
  }

  for (const item of inventory) {
    const entry = byItemId.get(item.itemId)
    if (!entry) {
      continue
    }

    entry.owned += 1
    entry.ownedVariants.push({
      level: item.level ?? 0,
      proficiency: item.proficiency ?? 0
    })
    if (item.proficiency !== undefined) {
      entry.ownedByProficiency[item.proficiency] =
        (entry.ownedByProficiency[item.proficiency] ?? 0) + 1
    }

    if (item.locked || equippedInstanceIds.has(item.instanceId)) {
      continue
    }

    entry.disposable += 1
    if (item.proficiency !== undefined) {
      entry.disposableByProficiency[item.proficiency] =
        (entry.disposableByProficiency[item.proficiency] ?? 0) + 1
    }
  }

  return [...byItemId.values()]
}

function equipmentStockCount(
  stock: readonly QuestGuideEquipmentStockEntry[],
  kind: QuestGuideEquipmentRequirementKind,
  predicate: (entry: QuestGuideEquipmentStockEntry) => boolean,
  proficiency?: number
): number {
  return stock.filter(predicate).reduce((total, entry) => {
    if (proficiency !== undefined) {
      const counts = kind === 'discard' ? entry.disposableByProficiency : entry.ownedByProficiency
      return total + (counts?.[proficiency] ?? 0)
    }
    return total + (kind === 'discard' ? entry.disposable : entry.owned)
  }, 0)
}

function equipmentRequirement(
  kind: QuestGuideEquipmentRequirementKind,
  label: string,
  required: number,
  available: number
): QuestGuideEquipmentRequirement {
  return {
    kind,
    label,
    required,
    available,
    missing: Math.max(0, required - available)
  }
}

export function questGuideEquipmentRequirements(
  questId: number,
  stock: readonly QuestGuideEquipmentStockEntry[] = [],
  condition?: DestroyItemCondition,
  translate: AppTranslator = DefaultQuestGuideTranslator
): QuestGuideEquipmentRequirement[] {
  const stuff = getQuestStuff(questId)
  if (!stuff) {
    return []
  }

  const requirements: QuestGuideEquipmentRequirement[] = []

  if (stuff.questType === QuestType.slotitemCondition) {
    requirements.push(
      ...stuff.slotitem_ids.map((itemId, index) => {
        const entry = stock.find((candidate) => candidate.itemId === itemId)
        return equipmentRequirement(
          'hold',
          entry?.name ??
            translate('quest.progress.equipment.unknown', {
              params: { id: itemId }
            }),
          stuff.max[index] ?? 0,
          entry?.owned ?? 0
        )
      })
    )
  } else if (stuff.questType === QuestType.destroyItem) {
    requirements.push(
      equipmentRequirement(
        'discard',
        translate('quest.guide.equipment.any'),
        stuff.max[0] ?? 0,
        stock.reduce((total, entry) => total + entry.disposable, 0)
      )
    )
  } else if (stuff.questType === QuestType.destroyItemIdOrType) {
    requirements.push(
      ...stuff.id_or_types.flatMap((matcher, index) => {
        const required = stuff.max[index] ?? 0
        if (matcher.id) {
          const entry = stock.find((candidate) => candidate.itemId === matcher.id)
          return [
            equipmentRequirement(
              'discard',
              entry?.name ??
                translate('quest.progress.equipment.unknown', {
                  params: { id: matcher.id }
                }),
              required,
              entry?.disposable ?? 0
            )
          ]
        }
        if (matcher.type !== undefined) {
          return [
            equipmentRequirement(
              'discard',
              questSlotitemTypeLabel(matcher.type, translate),
              required,
              equipmentStockCount(stock, 'discard', (entry) => entry.type === matcher.type)
            )
          ]
        }
        if (matcher.types?.length) {
          const types = matcher.types
          return [
            equipmentRequirement(
              'discard',
              types
                .map((type) => questSlotitemTypeLabel(type, translate))
                .join(' / '),
              required,
              equipmentStockCount(stock, 'discard', (entry) => types.includes(entry.type))
            )
          ]
        }
        if (matcher.id_with_alv) {
          const { id, alv } = matcher.id_with_alv
          const entry = stock.find((candidate) => candidate.itemId === id)
          return [
            equipmentRequirement(
              'discard',
              translate('quest.guide.equipment.proficiency', {
                params: {
                  name:
                    entry?.name ??
                    translate('quest.progress.equipment.unknown', {
                      params: { id }
                    }),
                  level: alv
                }
              }),
              required,
              equipmentStockCount(stock, 'discard', (candidate) => candidate.itemId === id, alv)
            )
          ]
        }
        return []
      })
    )
  }

  if (condition) {
    requirements.push(
      ...questGuideConditionEquipmentRequirements(
        condition,
        stock,
        translate
      )
    )
  }

  return requirements
}

export function questGuideConsumableRequirements(
  questId: number,
  stock: readonly QuestGuideConsumableStockEntry[] = [],
  translate: AppTranslator = DefaultQuestGuideTranslator
): QuestGuideConsumableRequirement[] {
  const stuff = getQuestStuff(questId)
  if (
    !stuff ||
    (stuff.questType !== QuestType.collectItem &&
      stuff.questType !== QuestType.collectItemCondition)
  ) {
    return []
  }

  const entry = stock.find((candidate) => candidate.itemId === stuff.item_id)
  const required = stuff.max[0] ?? 0
  const available = entry?.owned ?? 0
  return [
    {
      itemId: stuff.item_id,
      label:
        entry?.name ||
        translate('quest.guide.item.unknown', {
          params: { id: stuff.item_id }
        }),
      required,
      available,
      missing: Math.max(0, required - available)
    }
  ]
}

function questGuideConditionEquipmentRequirements(
  condition: DestroyItemCondition,
  stock: readonly QuestGuideEquipmentStockEntry[],
  translate: AppTranslator
): QuestGuideEquipmentRequirement[] {
  interface EquipmentConditionGroup {
    itemId: number
    level: number
    proficiencyMax: boolean
    required: number
  }

  const groupsByKey = new Map<string, EquipmentConditionGroup>()
  condition.flagship_slotitem_ids.forEach((itemId, index) => {
    if (itemId <= 0) {
      return
    }
    const level = condition.flagship_slotitem_lvl[index] ?? 0
    const proficiencyMax = condition.flagship_slotitem_alv_max === true && index === 0
    const key = `${itemId}:${level}:${proficiencyMax ? 1 : 0}`
    const group = groupsByKey.get(key)
    if (group) {
      group.required += 1
    } else {
      groupsByKey.set(key, {
        itemId,
        level,
        proficiencyMax,
        required: 1
      })
    }
  })

  const availableVariants = new Map(
    stock.map((entry) => [
      entry.itemId,
      (entry.ownedVariants ?? []).map((variant) => ({ ...variant, used: false }))
    ])
  )

  return [...groupsByKey.values()]
    .sort(
      (a, b) =>
        Number(b.proficiencyMax) - Number(a.proficiencyMax) ||
        b.level - a.level ||
        a.itemId - b.itemId
    )
    .map((group) => {
      const entry = stock.find((candidate) => candidate.itemId === group.itemId)
      const variants = availableVariants.get(group.itemId) ?? []
      let available = 0
      for (const variant of variants) {
        if (
          available >= group.required ||
          variant.used ||
          variant.level < group.level ||
          (group.proficiencyMax && variant.proficiency !== 7)
        ) {
          continue
        }
        variant.used = true
        available += 1
      }

      const fallbackName = translate('quest.progress.equipment.unknown', {
        params: { id: group.itemId }
      })
      let label = entry?.name ?? fallbackName
      if (group.level > 0) {
        label = translate('quest.guide.equipment.level', {
          params: { name: label, level: group.level }
        })
      }
      if (group.proficiencyMax) {
        label = translate('quest.guide.equipment.proficiency', {
          params: {
            name: label,
            level: translate('quest.progress.proficiency.max')
          }
        })
      }
      return equipmentRequirement(
        'equip',
        label,
        group.required,
        available
      )
    })
}

function questGuideMaps(questId: number): QuestMapOrCell[] {
  const stuff = getQuestStuff(questId)
  if (!stuff) {
    return []
  }

  if ('maps' in stuff && Array.isArray(stuff.maps)) {
    return stuff.maps
  }

  if (
    'area_id' in stuff &&
    'area_no' in stuff &&
    typeof stuff.area_id === 'number' &&
    typeof stuff.area_no === 'number'
  ) {
    return [[stuff.area_id, stuff.area_no, '']]
  }

  return []
}

type QuestKnowledgeTypeMessageKey = Extract<
  AppMessageKey,
  `quest.guide.knowledge.type.${string}`
>

const QuestKnowledgeTypeMessageKeys: Readonly<
  Record<QuestTypeValue, QuestKnowledgeTypeMessageKey>
> = {
  [QuestType.practice]: 'quest.guide.knowledge.type.practice',
  [QuestType.practiceDeck]: 'quest.guide.knowledge.type.practiceDeck',
  [QuestType.nyukyo]: 'quest.guide.knowledge.type.repair',
  [QuestType.collectItem]: 'quest.guide.knowledge.type.collectItem',
  [QuestType.collectItemCondition]:
    'quest.guide.knowledge.type.collectItemCondition',
  [QuestType.mapStart]: 'quest.guide.knowledge.type.mapStart',
  [QuestType.mapStartDeck]: 'quest.guide.knowledge.type.mapStartDeck',
  [QuestType.battle]: 'quest.guide.knowledge.type.battle',
  [QuestType.battleEnemy]: 'quest.guide.knowledge.type.battleEnemy',
  [QuestType.battle214]: 'quest.guide.knowledge.type.battleSpecial',
  [QuestType.battleMap]: 'quest.guide.knowledge.type.battleMap',
  [QuestType.battleMapDeck]: 'quest.guide.knowledge.type.battleMapDeck',
  [QuestType.mapGoal]: 'quest.guide.knowledge.type.mapGoal',
  [QuestType.gaugeClear]: 'quest.guide.knowledge.type.gauge',
  [QuestType.missionStart]: 'quest.guide.knowledge.type.expeditionStart',
  [QuestType.mission]: 'quest.guide.knowledge.type.expedition',
  [QuestType.missionSpecific]:
    'quest.guide.knowledge.type.expeditionSpecific',
  [QuestType.kaisou]: 'quest.guide.knowledge.type.modernization',
  [QuestType.kaisouUseType]:
    'quest.guide.knowledge.type.modernizationShipType',
  [QuestType.kaisouUseId]:
    'quest.guide.knowledge.type.modernizationShip',
  [QuestType.kaisouUseIdToId]:
    'quest.guide.knowledge.type.modernizationTargetMaterial',
  [QuestType.kaisouUseTypeToId]:
    'quest.guide.knowledge.type.modernizationMaterialType',
  [QuestType.kaisouUseCategoryToCategory]:
    'quest.guide.knowledge.type.modernizationCategory',
  [QuestType.kaisouUseCategoryToType]:
    'quest.guide.knowledge.type.modernizationCategoryType',
  [QuestType.hokyu]: 'quest.guide.knowledge.type.supply',
  [QuestType.remodel]: 'quest.guide.knowledge.type.remodel',
  [QuestType.createItem]: 'quest.guide.knowledge.type.develop',
  [QuestType.destroyItem]: 'quest.guide.knowledge.type.discard',
  [QuestType.destroyItemIdOrType]:
    'quest.guide.knowledge.type.discardSpecified',
  [QuestType.createShip]: 'quest.guide.knowledge.type.construct',
  [QuestType.destroyShip]: 'quest.guide.knowledge.type.scrap',
  [QuestType.hensei]: 'quest.guide.knowledge.type.formation',
  [QuestType.slotitemCondition]:
    'quest.guide.knowledge.type.equipmentCondition'
}

function bundledDefinitionSummary(
  questId: number,
  translate: AppTranslator
): string | undefined {
  const stuff = getQuestStuff(questId)
  if (!stuff) {
    return undefined
  }

  const parts = [translate(QuestKnowledgeTypeMessageKeys[stuff.questType])]
  if (stuff.max.length > 0) {
    parts.push(
      translate('quest.guide.knowledge.definition.unit', {
        params: { units: stuff.max.join(' / ') }
      })
    )
  }

  const maps = [...new Set(questGuideMaps(questId).map((map) => questGuideMapText(map[0], map[1])))]
  if (maps.length > 0) {
    parts.push(
      translate('quest.guide.knowledge.definition.maps', {
        params: { maps: maps.join('・') }
      })
    )
  }
  if ('isDeckMatch' in stuff || 'getCondition' in stuff) {
    parts.push(translate('quest.guide.knowledge.definition.condition'))
  }

  return parts.join(' / ')
}

function observationRelation(
  relation: QuestGuideLearnedUnlock,
  direction: 'prerequisite' | 'downstream',
  translate: AppTranslator
): QuestKnowledgeRelation {
  const questId = direction === 'prerequisite' ? relation.from : relation.to
  const title = direction === 'prerequisite' ? relation.fromTitle : relation.title
  return {
    questId,
    title,
    observedCount: relation.count,
    evidence: {
      source: 'local-observation',
      sourceLabel: translate('quest.guide.evidence.localObservation'),
      confidence: 'observed',
      summary: translate('quest.guide.evidence.localObservationSummary', {
        params: { count: relation.count }
      })
    }
  }
}

export function buildQuestKnowledgeEntry(
  quest: ApiQuest,
  learnedUnlocks: readonly QuestGuideLearnedUnlock[] = [],
  questDataSource: 'live' | 'cache' = 'live',
  translate: AppTranslator = DefaultQuestGuideTranslator
): QuestKnowledgeEntry {
  const evidence: QuestKnowledgeEvidence[] = [
    {
      source: questDataSource === 'live' ? 'game-api' : 'cached-game-data',
      sourceLabel: translate(
        questDataSource === 'live'
          ? 'quest.guide.evidence.liveData'
          : 'quest.guide.evidence.cachedData'
      ),
      confidence: questDataSource === 'live' ? 'verified' : 'supported',
      summary:
        questDataSource === 'live'
          ? translate('quest.guide.evidence.liveDataSummary')
          : translate('quest.guide.evidence.cachedDataSummary')
    }
  ]
  const bundledSummary = bundledDefinitionSummary(quest.api_no, translate)
  if (bundledSummary) {
    evidence.push({
      source: 'bundled-definition',
      sourceLabel: translate('quest.guide.evidence.bundledDefinition'),
      confidence: 'supported',
      summary: bundledSummary
    })
  }
  const curated = getCuratedQuestKnowledge(quest.api_no)
  if (
    curated &&
    (curated.prerequisiteGroups.length > 0 ||
      curated.downstream.length > 0 ||
      curated.conflicts.length > 0)
  ) {
    const sourceCount = new Set(
      [
        ...curated.prerequisiteGroups.flatMap((group) => group.provenance),
        ...curated.downstream.flatMap((downstream) => downstream.provenance),
        ...curated.conflicts.flatMap((conflict) => conflict.provenance)
      ].map((reference) => reference.source)
    ).size
    evidence.push({
      source: 'curated-reference',
      sourceLabel: translate('quest.guide.evidence.curated'),
      confidence: 'supported',
      summary:
        curated.conflicts.length > 0
          ? translate('quest.guide.evidence.curatedConflict', {
              params: { count: sourceCount }
            })
          : translate('quest.guide.evidence.curatedVerified', {
              params: { count: sourceCount }
            })
    })
  }

  return {
    questId: quest.api_no,
    relationCoverageStatus: !curated
      ? 'unregistered'
      : curated.conflicts.length > 0
        ? 'unresolved'
        : 'represented',
    evidence,
    curatedPrerequisiteGroups: curated?.prerequisiteGroups ?? [],
    curatedDownstream: curated?.downstream ?? [],
    conflicts: curated?.conflicts ?? [],
    prerequisites: learnedUnlocks
      .filter((relation) => relation.to === quest.api_no)
      .map((relation) =>
        observationRelation(relation, 'prerequisite', translate)
      ),
    downstream: learnedUnlocks
      .filter((relation) => relation.from === quest.api_no)
      .map((relation) =>
        observationRelation(relation, 'downstream', translate)
      ),
    references: [
      {
        source: 'wikiwiki',
        label: translate('quest.guide.reference.japaneseSearch'),
        url: questGuideWikiSearchUrl(quest.api_title, 'wikiwiki'),
        structured: false
      },
      {
        source: 'kcwiki',
        label: translate('quest.guide.reference.chineseSearch'),
        url: questGuideWikiSearchUrl(quest.api_title, 'kcwiki'),
        structured: false
      }
    ]
  }
}

function questGuideStatus(quest: ApiQuest): QuestGuideStatus {
  if (quest.api_state === ApiQuestState.completed) {
    return 'claim'
  }
  if (quest.api_state === ApiQuestState.in_progress) {
    return 'active'
  }
  return 'available'
}

function questGuideStatusText(
  status: QuestGuideStatus,
  translate: AppTranslator
): string {
  switch (status) {
    case 'claim':
      return translate('quest.guide.status.claim')
    case 'active':
      return translate('quest.guide.status.active')
    case 'available':
      return translate('quest.guide.status.available')
  }
}

interface QuestGuideReadinessInput {
  status: QuestGuideStatus
  invalid: boolean
  mapState: QuestGuideMapState
  deckMatch: boolean | undefined
  matchKind: QuestGuideLocalMatchKind | undefined
  fleetChecks: readonly QuestFleetCheck[]
  conditionChecks: readonly QuestConditionCheck[]
  equipmentRequirements: readonly QuestGuideEquipmentRequirement[]
  consumableRequirements: readonly QuestGuideConsumableRequirement[]
}

function questGuideReadiness(
  input: QuestGuideReadinessInput,
  translate: AppTranslator
): {
  readiness: QuestGuideReadiness
  text: string
  detail: string
} {
  if (input.invalid) {
    return {
      readiness: 'blocked',
      text: translate('quest.guide.readiness.invalid'),
      detail: translate('quest.guide.readiness.invalidDetail')
    }
  }
  if (input.status === 'claim') {
    return {
      readiness: 'ready',
      text: translate('quest.guide.readiness.claim'),
      detail: translate('quest.guide.readiness.claimDetail')
    }
  }
  if (input.mapState === 'blocked') {
    return {
      readiness: 'blocked',
      text: translate('quest.guide.readiness.mapBlocked'),
      detail: translate('quest.guide.readiness.mapBlockedDetail')
    }
  }

  const failedFleetChecks = input.fleetChecks.filter(
    (check) => check.satisfied === false
  ).length
  const failedConditionChecks = input.conditionChecks.filter(
    (check) => check.satisfied === false
  ).length
  const missingEquipment = input.equipmentRequirements.filter(
    (requirement) => requirement.missing > 0
  ).length
  const missingConsumables = input.consumableRequirements.filter(
    (requirement) => requirement.missing > 0
  ).length
  const fallbackMatchFailure =
    input.deckMatch === false &&
    (input.matchKind === 'fleet'
      ? input.fleetChecks.length === 0
      : input.matchKind === 'condition'
        ? input.conditionChecks.length === 0
        : true)
      ? 1
      : 0
  const unmetCount =
    failedFleetChecks +
    failedConditionChecks +
    missingEquipment +
    missingConsumables +
    fallbackMatchFailure
  if (unmetCount > 0) {
    return {
      readiness: 'needs-preparation',
      text: translate('quest.guide.readiness.preparation'),
      detail: translate('quest.guide.readiness.preparationDetail', {
        params: { count: unmetCount }
      })
    }
  }

  const checks = [...input.fleetChecks, ...input.conditionChecks]
  const hasUnknownCheck = checks.some((check) => check.satisfied === undefined)
  if (hasUnknownCheck) {
    return {
      readiness: 'unknown',
      text: translate('quest.guide.readiness.unknown'),
      detail: translate('quest.guide.readiness.unknownDetail')
    }
  }

  const hasKnownPositiveSignal =
    input.mapState === 'ready' ||
    input.deckMatch === true ||
    input.equipmentRequirements.length > 0 ||
    input.consumableRequirements.length > 0 ||
    checks.some((check) => check.satisfied === true)
  if (hasKnownPositiveSignal) {
    return {
      readiness: 'ready',
      text: translate('quest.guide.readiness.ready'),
      detail: translate('quest.guide.readiness.readyDetail')
    }
  }

  return {
    readiness: 'unknown',
    text: translate('quest.guide.readiness.unknown'),
    detail: translate('quest.guide.readiness.noLocalCheck')
  }
}

function readinessScore(readiness: QuestGuideReadiness): number {
  switch (readiness) {
    case 'ready':
      return 40
    case 'needs-preparation':
      return -40
    case 'blocked':
      return -240
    case 'unknown':
      return 0
  }
}

function cadenceScore(quest: ApiQuest): number {
  if (quest.api_label_type > ApiQuestLabelTypeYearLy) {
    return 180
  }

  switch (quest.api_type) {
    case ApiQuestType.single:
      return 150
    case ApiQuestType.quarterly:
      return 140
    case ApiQuestType.monthly:
      return 100
    case ApiQuestType.weekly:
      return 60
    case ApiQuestType.daily:
      return 20
    default:
      return 0
  }
}

function deadlineScore(
  deadline:
    | QuestGuideCadenceDeadline
    | QuestGuideLimitedDeadline
    | undefined
): number {
  if (!deadline) {
    return 0
  }
  switch (deadline.urgency) {
    case 'urgent':
      return 260
    case 'soon':
      return 140
    case 'normal':
    case 'expired':
      return 0
  }
}

function statusScore(status: QuestGuideStatus, progress: number): number {
  switch (status) {
    case 'claim':
      return 1200
    case 'active':
      return 360 + progress * 2
    case 'available':
      return 100
  }
}

function materialTotal(quest: ApiQuest): number {
  return quest.api_get_material.reduce((sum, value) => sum + Math.max(0, value), 0)
}

export function buildQuestGuideRecommendations(
  quests: readonly ApiQuest[],
  context: QuestGuideContext = {}
): QuestGuideRecommendation[] {
  const translate = context.translate ?? DefaultQuestGuideTranslator
  return quests
    .filter((quest) => !!quest && typeof quest.api_no === 'number')
    .map((quest) => {
      const status = questGuideStatus(quest)
      const stuff = getQuestStuff(quest.api_no)
      const cadenceDeadline = questGuideCadenceDeadline(
        quest,
        context.now,
        translate
      )
      const limitedEvidence = [
        ...questGuideLimitedEvidence(
          quest,
          context.questDataSource,
          context.now,
          translate
        ),
        ...(context.limitedEvidenceById?.get(quest.api_no) ?? [])
      ]
      const limitedDeadline = questGuideLimitedDeadline(
        limitedEvidence,
        context.now,
        translate
      )
      const equipmentRequirements = context.equipmentStock
        ? questGuideEquipmentRequirements(
            quest.api_no,
            context.equipmentStock,
            context.equipmentConditionById?.get(quest.api_no),
            translate
          )
        : []
      const equipmentMissing = equipmentRequirements.reduce(
        (total, requirement) => total + requirement.missing,
        0
      )
      const consumableRequirements = context.consumableStock
        ? questGuideConsumableRequirements(
            quest.api_no,
            context.consumableStock,
            translate
          )
        : []
      const consumableMissing = consumableRequirements.reduce(
        (total, requirement) => total + requirement.missing,
        0
      )
      const progress = context.progressById?.get(quest.api_no) ?? KcsUtil.questCount(quest)
      const progressDetails =
        status === 'active'
          ? context.progressDetailsById?.get(quest.api_no) ?? []
          : []
      const progressDetail =
        status === 'active'
          ? questGuideProgressDetailsText(progressDetails) ??
            context.progressDetailById?.get(quest.api_no)
          : undefined
      const isLimited =
        limitedEvidence.length > 0 || questGuideIsLimited(quest)
      const deckMatch = context.deckMatchById?.get(quest.api_no)
      const fleetChecks =
        context.fleetChecksById?.get(quest.api_no) ?? []
      const conditionChecks =
        context.conditionChecksById?.get(quest.api_no) ?? []
      const matchKind: QuestGuideLocalMatchKind | undefined =
        stuff &&
        'isDeckMatch' in stuff &&
        typeof stuff.isDeckMatch === 'function'
          ? 'fleet'
          : stuff &&
              'getCondition' in stuff &&
              typeof stuff.getCondition === 'function'
            ? 'condition'
            : undefined
      const mapDefs = questGuideMaps(quest.api_no)
      const mapKeys = [...new Set(mapDefs.map((map) => questGuideMapKey(map[0], map[1])))]
      const maps = [...new Set(mapDefs.map((map) => questGuideMapText(map[0], map[1])))]
      const missingMaps = context.availableMapKeys
        ? mapKeys.filter((key) => !context.availableMapKeys!.has(key))
        : []
      const mapState: QuestGuideMapState =
        mapKeys.length === 0 || !context.availableMapKeys
          ? 'unknown'
          : missingMaps.length > 0
            ? 'blocked'
            : 'ready'
      const readiness = questGuideReadiness({
        status,
        invalid: quest.api_invalid_flag !== 0,
        mapState,
        deckMatch,
        matchKind,
        fleetChecks,
        conditionChecks,
        equipmentRequirements,
        consumableRequirements
      }, translate)
      const learnedPrerequisites = (context.learnedUnlocks ?? []).filter(
        (entry) => entry.to === quest.api_no
      )
      const learnedDownstream = (context.learnedUnlocks ?? []).filter(
        (entry) => entry.from === quest.api_no
      )
      const knowledge = buildQuestKnowledgeEntry(
        quest,
        context.learnedUnlocks,
        context.questDataSource,
        translate
      )
      const materials = materialTotal(quest)
      const selectRewardCount = quest.api_select_rewards?.length ?? 0
      const senka = KcsUtil.questSenka(quest.api_no)
      const reasons: string[] = []
      const cautions: string[] = []

      reasons.push(
        status === 'claim'
          ? translate('quest.guide.reason.claim')
          : status === 'active'
            ? translate('quest.guide.reason.progress', {
                params: { progress }
              })
            : translate('quest.guide.reason.available')
      )
      if (limitedEvidence.length > 0) {
        reasons.push(
          translate('quest.guide.reason.limitedVerified', {
            params: { source: limitedEvidence[0].sourceLabel }
          })
        )
      } else if (isLimited) {
        reasons.push(translate('quest.guide.reason.limitedCandidate'))
      }
      if (isLimited && !limitedDeadline) {
        cautions.push(translate('quest.guide.caution.endUnknown'))
      }
      if (limitedDeadline?.urgency === 'urgent') {
        reasons.push(
          translate('quest.guide.reason.deadlineEnd', {
            params: { deadline: limitedDeadline.text }
          })
        )
      } else if (
        limitedDeadline?.urgency === 'soon' ||
        limitedDeadline?.urgency === 'normal'
      ) {
        reasons.push(limitedDeadline.text)
      } else if (limitedDeadline?.urgency === 'expired') {
        cautions.push(
          `${limitedDeadline.text}（${limitedDeadline.evidence.sourceLabel}）`
        )
      }
      if (cadenceDeadline?.urgency === 'urgent') {
        reasons.push(
          translate('quest.guide.reason.deadlineReset', {
            params: { deadline: cadenceDeadline.text }
          })
        )
      } else if (cadenceDeadline?.urgency === 'soon') {
        reasons.push(cadenceDeadline.text)
      }
      if (equipmentRequirements.length > 0 && equipmentMissing === 0) {
        reasons.push(
          translate('quest.guide.reason.equipmentReady', {
            params: { count: equipmentRequirements.length }
          })
        )
      } else if (equipmentMissing > 0) {
        cautions.push(
          translate('quest.guide.caution.equipmentMissing', {
            params: { count: equipmentMissing }
          })
        )
      }
      if (consumableRequirements.length > 0 && consumableMissing === 0) {
        reasons.push(
          translate('quest.guide.reason.itemsReady', {
            params: { count: consumableRequirements.length }
          })
        )
      } else if (consumableMissing > 0) {
        cautions.push(
          translate('quest.guide.caution.itemsMissing', {
            params: { count: consumableMissing }
          })
        )
      }
      if (quest.api_type === ApiQuestType.single) {
        reasons.push(translate('quest.guide.reason.single'))
      }
      if (selectRewardCount > 0) {
        reasons.push(
          translate('quest.guide.reason.selectReward', {
            params: { count: selectRewardCount }
          })
        )
      } else if (quest.api_bonus_flag > 0) {
        reasons.push(translate('quest.guide.reason.otherReward'))
      }
      if (materials > 0) {
        reasons.push(
          translate('quest.guide.reason.materials', {
            params: { count: materials }
          })
        )
      }
      if (senka > 0) {
        reasons.push(
          translate('quest.guide.reason.senka', {
            params: { value: senka }
          })
        )
      }
      if (matchKind === 'fleet') {
        const failedFleetChecks = fleetChecks.filter(
          (check) => check.satisfied === false
        ).length
        const knownFleetChecks = fleetChecks.filter(
          (check) => check.satisfied !== undefined
        ).length
        if (
          fleetChecks.length > 0 &&
          knownFleetChecks === fleetChecks.length &&
          failedFleetChecks === 0 &&
          deckMatch === true
        ) {
          reasons.push(
            translate('quest.guide.reason.fleetChecksReady', {
              params: { count: fleetChecks.length }
            })
          )
        } else if (failedFleetChecks > 0) {
          cautions.push(
            translate('quest.guide.caution.fleetChecksMissing', {
              params: {
                failed: failedFleetChecks,
                total: fleetChecks.length
              }
            })
          )
        } else if (deckMatch === true) {
          reasons.push(translate('quest.guide.reason.fleetMatch'))
        } else if (deckMatch === false) {
          cautions.push(translate('quest.guide.caution.fleetMismatch'))
        }
      } else if (matchKind === 'condition') {
        const failedConditions = conditionChecks.filter(
          (check) => check.satisfied === false
        ).length
        const knownConditions = conditionChecks.filter(
          (check) => check.satisfied !== undefined
        ).length
        if (
          conditionChecks.length > 0 &&
          knownConditions === conditionChecks.length &&
          failedConditions === 0
        ) {
          reasons.push(
            translate('quest.guide.reason.executionChecksReady', {
              params: { count: conditionChecks.length }
            })
          )
        } else if (failedConditions > 0) {
          cautions.push(
            translate('quest.guide.caution.executionChecksMissing', {
              params: {
                failed: failedConditions,
                total: conditionChecks.length
              }
            })
          )
        } else if (deckMatch === false) {
          cautions.push(
            translate('quest.guide.caution.executionMismatch')
          )
        }
      }
      if (maps.length > 0) {
        reasons.push(
          translate('quest.guide.reason.maps', {
            params: { maps: maps.join('・') }
          })
        )
      }
      if (mapState === 'blocked') {
        cautions.push(
          translate('quest.guide.caution.mapsBlocked', {
            params: { maps: missingMaps.join('・') }
          })
        )
      }
      if (learnedPrerequisites.length > 0) {
        reasons.push(
          translate('quest.guide.reason.learnedBefore', {
            params: { count: learnedPrerequisites.length }
          })
        )
      }
      if (learnedDownstream.length > 0) {
        reasons.push(
          translate('quest.guide.reason.learnedAfter', {
            params: { count: learnedDownstream.length }
          })
        )
      }
      if (knowledge.curatedPrerequisiteGroups.length > 0) {
        reasons.push(
          translate('quest.guide.reason.curatedBefore', {
            params: {
              count: knowledge.curatedPrerequisiteGroups.reduce(
                (total, group) => total + group.quests.length,
                0
              )
            }
          })
        )
      }
      if (knowledge.curatedDownstream.length > 0) {
        reasons.push(
          translate('quest.guide.reason.curatedAfter', {
            params: { count: knowledge.curatedDownstream.length }
          })
        )
      }
      if (knowledge.conflicts.length > 0) {
        cautions.push(translate('quest.guide.caution.curatedConflict'))
      }
      if (quest.api_invalid_flag !== 0) {
        cautions.push(translate('quest.guide.caution.invalid'))
      }

      let score =
        statusScore(status, progress) +
        cadenceScore(quest) +
        deadlineScore(cadenceDeadline) +
        deadlineScore(limitedDeadline) +
        readinessScore(readiness.readiness)
      score += Math.min(100, Math.floor(materials / 20))
      score += selectRewardCount > 0 ? 110 : quest.api_bonus_flag > 0 ? 50 : 0
      score += Math.min(180, Math.floor(senka / 3))
      score += isLimited ? 320 : 0
      score += limitedEvidence.length > 0 ? 80 : 0
      score += deckMatch === true ? 70 : deckMatch === false ? -20 : 0
      score += learnedDownstream.length * 30
      score += learnedPrerequisites.length * 10
      score += knowledge.curatedDownstream.length * 20
      score -= Math.min(80, equipmentMissing * 10)
      score -= Math.min(80, consumableMissing * 10)
      if (mapState === 'blocked') {
        score -= 220
      }

      return {
        quest,
        score,
        status,
        statusText: questGuideStatusText(status, translate),
        cadenceText: questGuideCadenceText(quest, translate),
        cadenceDeadline,
        limitedEvidence,
        limitedDeadline,
        equipmentRequirements,
        consumableRequirements,
        progress,
        progressDetails,
        progressDetail,
        materialTotal: materials,
        isLimited,
        deckMatch,
        matchKind,
        fleetChecks,
        conditionChecks,
        mapState,
        readiness: readiness.readiness,
        readinessText: readiness.text,
        readinessDetail: readiness.detail,
        maps,
        reasons,
        cautions,
        learnedPrerequisites,
        learnedDownstream,
        knowledge
      }
    })
    .sort((a, b) => b.score - a.score || a.quest.api_no - b.quest.api_no)
}

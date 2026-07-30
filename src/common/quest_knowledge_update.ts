import type {
  QuestCuratedClaim,
  QuestCuratedPrerequisiteGroup,
  QuestCuratedQuestRef,
  QuestCuratedSource,
  QuestPrerequisiteReviewStatus
} from '@common/quest_knowledge'
import {
  validateQuestStrategyKnowledgeBundle,
  type QuestStrategyKnowledgeBundle
} from '@common/quest_strategy_knowledge'

const QuestKnowledgeSchemaVersion = 1
const MaxQuestKnowledgeBytes = 2 * 1024 * 1024
const MaxClaims = 4096
const MaxPrerequisiteGroups = 16
const MaxQuestsPerGroup = 32
const MaxQuestId = 9_999_999
const DatePattern = /^\d{4}-\d{2}-\d{2}$/

export interface QuestKnowledgeUpdate {
  readonly schemaVersion: 1
  /**
   * Every bundled claim for a quest ID present here is replaced as one unit.
   * Claims for all other quest IDs continue to use the bundled fallback.
   */
  readonly claims: QuestCuratedClaim[]
  /**
   * Optional signed strategy knowledge. Missing or invalid data never replaces
   * the application-bundled fallback.
   */
  readonly strategy?: QuestStrategyKnowledgeBundle
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireExactKeys(
  value: Record<string, unknown>,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
  description: string
): void {
  const allowed = new Set([...requiredKeys, ...optionalKeys])
  if (
    requiredKeys.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) ||
    Object.keys(value).some((key) => !allowed.has(key))
  ) {
    throw new Error(`${description} has unsupported or missing fields`)
  }
}

function requireString(value: unknown, description: string, maxLength: number): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function requireQuestId(value: unknown, description: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MaxQuestId
  ) {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function parseSource(value: unknown, description: string): QuestCuratedSource {
  if (value !== 'wikiwiki' && value !== 'kcwiki') {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function parseReferenceUrl(
  value: unknown,
  source: QuestCuratedSource,
  description: string
): string {
  const text = requireString(value, description, 2048)
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new Error(`invalid ${description}`)
  }
  const expectedHostname = source === 'wikiwiki' ? 'wikiwiki.jp' : 'zh.kcwiki.cn'
  if (
    url.protocol !== 'https:' ||
    url.hostname !== expectedHostname ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new Error(`invalid ${description}`)
  }
  return text
}

function parseVerifiedDate(value: unknown, description: string): string {
  const text = requireString(value, description, 10)
  if (
    !DatePattern.test(text) ||
    new Date(`${text}T00:00:00.000Z`).toISOString().slice(0, 10) !== text
  ) {
    throw new Error(`invalid ${description}`)
  }
  return text
}

function parseQuestRef(value: unknown, description: string): QuestCuratedQuestRef {
  if (!isRecord(value)) {
    throw new Error(`${description} must be an object`)
  }
  requireExactKeys(value, ['questId', 'title'], [], description)
  return {
    questId: requireQuestId(value.questId, `${description} quest ID`),
    title: requireString(value.title, `${description} title`, 200)
  }
}

function parsePrerequisiteGroup(
  value: unknown,
  questId: number,
  description: string
): QuestCuratedPrerequisiteGroup {
  if (!isRecord(value)) {
    throw new Error(`${description} must be an object`)
  }
  requireExactKeys(value, ['mode', 'quests'], [], description)
  if (value.mode !== 'all' && value.mode !== 'any') {
    throw new Error(`invalid ${description} mode`)
  }
  if (
    !Array.isArray(value.quests) ||
    value.quests.length === 0 ||
    value.quests.length > MaxQuestsPerGroup
  ) {
    throw new Error(`invalid ${description} quest list`)
  }
  const quests = value.quests.map((quest, index) =>
    parseQuestRef(quest, `${description} quest ${index}`)
  )
  const seenQuestIds = new Set<number>()
  for (const quest of quests) {
    if (quest.questId === questId) {
      throw new Error(`${description} contains a self prerequisite`)
    }
    if (seenQuestIds.has(quest.questId)) {
      throw new Error(`${description} contains a duplicate quest`)
    }
    seenQuestIds.add(quest.questId)
  }
  return { mode: value.mode, quests }
}

function parseReviewStatus(
  value: unknown,
  description: string
): QuestPrerequisiteReviewStatus | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value !== 'verified' && value !== 'incomplete' && value !== 'under-review') {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function parseClaim(value: unknown, index: number): QuestCuratedClaim {
  const description = `quest knowledge claim ${index}`
  if (!isRecord(value)) {
    throw new Error(`${description} must be an object`)
  }
  requireExactKeys(
    value,
    [
      'source',
      'sourceLabel',
      'url',
      'lastVerifiedAt',
      'dataVersion',
      'questId',
      'questTitle',
      'prerequisites'
    ],
    ['prerequisitesComplete', 'reviewStatus', 'reviewNote'],
    description
  )

  const source = parseSource(value.source, `${description} source`)
  const sourceLabel = requireString(value.sourceLabel, `${description} source label`, 100)
  const expectedSourceLabel = source === 'wikiwiki' ? '日本語攻略Wiki' : '中文KCWiki'
  if (sourceLabel !== expectedSourceLabel) {
    throw new Error(`invalid ${description} source label`)
  }
  const questId = requireQuestId(value.questId, `${description} quest ID`)
  if (!Array.isArray(value.prerequisites) || value.prerequisites.length > MaxPrerequisiteGroups) {
    throw new Error(`invalid ${description} prerequisite groups`)
  }
  const prerequisites = value.prerequisites.map((group, groupIndex) =>
    parsePrerequisiteGroup(group, questId, `${description} group ${groupIndex}`)
  )
  const groupSignatures = prerequisites.map(
    (group) =>
      `${group.mode}:${group.quests
        .map((quest) => quest.questId)
        .sort((left, right) => left - right)
        .join(',')}`
  )
  if (new Set(groupSignatures).size !== groupSignatures.length) {
    throw new Error(`${description} contains a duplicate prerequisite group`)
  }

  if (
    value.prerequisitesComplete !== undefined &&
    typeof value.prerequisitesComplete !== 'boolean'
  ) {
    throw new Error(`invalid ${description} prerequisitesComplete`)
  }
  const reviewStatus = parseReviewStatus(value.reviewStatus, `${description} review status`)
  const reviewNote =
    value.reviewNote === undefined
      ? undefined
      : requireString(value.reviewNote, `${description} review note`, 1000)
  if (
    (value.prerequisitesComplete === false ||
      reviewStatus === 'incomplete' ||
      reviewStatus === 'under-review') &&
    reviewNote === undefined
  ) {
    throw new Error(`${description} requires a review note`)
  }

  return {
    source,
    sourceLabel,
    url: parseReferenceUrl(value.url, source, `${description} URL`),
    lastVerifiedAt: parseVerifiedDate(value.lastVerifiedAt, `${description} verification date`),
    dataVersion: requireString(value.dataVersion, `${description} data version`, 200),
    questId,
    questTitle: requireString(value.questTitle, `${description} quest title`, 200),
    prerequisites,
    ...(value.prerequisitesComplete === undefined
      ? {}
      : { prerequisitesComplete: value.prerequisitesComplete }),
    ...(reviewStatus === undefined ? {} : { reviewStatus }),
    ...(reviewNote === undefined ? {} : { reviewNote })
  }
}

export function validateQuestKnowledgeUpdate(value: unknown): QuestKnowledgeUpdate {
  if (!isRecord(value)) {
    throw new Error('quest knowledge update must be an object')
  }
  requireExactKeys(value, ['schemaVersion', 'claims'], ['strategy'], 'quest knowledge update')
  if (value.schemaVersion !== QuestKnowledgeSchemaVersion) {
    throw new Error('unsupported quest knowledge schema')
  }
  if (
    !Array.isArray(value.claims) ||
    value.claims.length === 0 ||
    value.claims.length > MaxClaims
  ) {
    throw new Error('invalid quest knowledge claim list')
  }

  const claims = value.claims.map(parseClaim)
  const seenSources = new Set<string>()
  for (const claim of claims) {
    const key = `${claim.questId}:${claim.source}`
    if (seenSources.has(key)) {
      throw new Error(`duplicate quest knowledge source: ${key}`)
    }
    seenSources.add(key)
  }
  return {
    schemaVersion: QuestKnowledgeSchemaVersion,
    claims,
    ...(value.strategy === undefined
      ? {}
      : { strategy: validateQuestStrategyKnowledgeBundle(value.strategy) })
  }
}

export function parseQuestKnowledgeUpdate(text: string): QuestKnowledgeUpdate {
  if (new TextEncoder().encode(text).byteLength > MaxQuestKnowledgeBytes) {
    throw new Error('quest knowledge update is too large')
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('quest knowledge update is not valid JSON')
  }
  return validateQuestKnowledgeUpdate(value)
}

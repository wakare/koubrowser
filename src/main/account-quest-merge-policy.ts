import { isDeepStrictEqual } from 'node:util'

export const AccountQuestMergePolicyVersion = 1 as const

export type AccountQuestMergeDecisionKind =
  | 'safe-merge'
  | 'skip'
  | 'manual-review'

export interface AccountQuestMergeDecision {
  readonly kind: AccountQuestMergeDecisionKind
  readonly reason:
    | 'same-record'
    | 'current-progress-dominates'
    | 'monotonic-counter-progress'
    | 'metadata-record'
    | 'different-period'
    | 'unsupported-record-shape'
    | 'incompatible-quest-metadata'
    | 'incompatible-counter-shape'
  readonly replacement?: Record<string, unknown>
}

const QuestRecordKeys = [
  '_id',
  'date',
  'dateKey',
  'no',
  'quest',
  'state'
] as const
const QuestCounterKeys = ['count', 'countMax'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[]
): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  )
}

function withoutNeDbId(
  record: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== '_id')
  )
}

function questMetadataComparableValue(
  value: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => key !== 'api_state' && key !== 'api_progress_flag'
    )
  )
}

interface QuestCounter {
  readonly count: readonly number[]
  readonly countMax: readonly number[]
}

function parseQuestCounter(value: unknown): QuestCounter | null {
  if (!isRecord(value) || !hasExactKeys(value, QuestCounterKeys)) {
    return null
  }
  const count = value.count
  const countMax = value.countMax
  if (
    !Array.isArray(count) ||
    !Array.isArray(countMax) ||
    count.length === 0 ||
    count.length !== countMax.length ||
    count.some(
      (entry) => !Number.isSafeInteger(entry) || (entry as number) < 0
    ) ||
    countMax.some(
      (entry) => !Number.isSafeInteger(entry) || (entry as number) < 0
    ) ||
    count.some(
      (entry, index) => (entry as number) > (countMax[index] as number)
    )
  ) {
    return null
  }
  return {
    count: count as number[],
    countMax: countMax as number[]
  }
}

function isSupportedQuestRecord(
  record: Record<string, unknown>
): boolean {
  return (
    hasExactKeys(record, QuestRecordKeys) &&
    typeof record._id === 'string' &&
    Number.isSafeInteger(record.no) &&
    (record.no as number) > 0 &&
    typeof record.date === 'string' &&
    Number.isFinite(Date.parse(record.date)) &&
    typeof record.dateKey === 'string' &&
    record.dateKey.length > 0 &&
    isRecord(record.quest) &&
    record.quest.api_no === record.no
  )
}

/**
 * Return the logical key used by the mutable quest database. Invalid legacy
 * records deliberately have no logical key and remain manual-review only.
 */
export function accountQuestRecordKey(
  record: Record<string, unknown>
): string | null {
  if (record.key === 'meta') {
    return 'meta'
  }
  return Number.isSafeInteger(record.no) && (record.no as number) > 0
    ? `quest:${record.no as number}`
    : null
}

/**
 * Merge only monotonic counter evidence for the same quest and reset period.
 *
 * The current record remains authoritative for its NeDB id, timestamp, API
 * state and task metadata. Counter values are never added across devices;
 * taking the component-wise maximum cannot exceed progress observed by at
 * least one device. Unknown shapes fail closed to manual review.
 */
export function accountQuestMergeDecision(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>
): AccountQuestMergeDecision {
  if (
    isDeepStrictEqual(
      withoutNeDbId(current),
      withoutNeDbId(incoming)
    )
  ) {
    return { kind: 'skip', reason: 'same-record' }
  }

  if (
    accountQuestRecordKey(current) === 'meta' ||
    accountQuestRecordKey(incoming) === 'meta'
  ) {
    return { kind: 'manual-review', reason: 'metadata-record' }
  }

  if (
    !isSupportedQuestRecord(current) ||
    !isSupportedQuestRecord(incoming) ||
    current.no !== incoming.no
  ) {
    return {
      kind: 'manual-review',
      reason: 'unsupported-record-shape'
    }
  }
  if (current.dateKey !== incoming.dateKey) {
    return { kind: 'manual-review', reason: 'different-period' }
  }

  const currentQuest = current.quest as Record<string, unknown>
  const incomingQuest = incoming.quest as Record<string, unknown>
  if (
    !isDeepStrictEqual(
      questMetadataComparableValue(currentQuest),
      questMetadataComparableValue(incomingQuest)
    )
  ) {
    return {
      kind: 'manual-review',
      reason: 'incompatible-quest-metadata'
    }
  }

  const currentCounter = parseQuestCounter(current.state)
  const incomingCounter = parseQuestCounter(incoming.state)
  if (
    currentCounter === null ||
    incomingCounter === null ||
    !isDeepStrictEqual(currentCounter.countMax, incomingCounter.countMax)
  ) {
    return {
      kind: 'manual-review',
      reason: 'incompatible-counter-shape'
    }
  }

  const count = currentCounter.count.map((currentValue, index) =>
    Math.max(currentValue, incomingCounter.count[index])
  )
  if (isDeepStrictEqual(count, currentCounter.count)) {
    return {
      kind: 'skip',
      reason: 'current-progress-dominates'
    }
  }

  return {
    kind: 'safe-merge',
    reason: 'monotonic-counter-progress',
    replacement: {
      ...current,
      state: {
        count,
        countMax: [...currentCounter.countMax]
      }
    }
  }
}

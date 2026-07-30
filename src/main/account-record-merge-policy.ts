import { DbName } from '@common/record'
import type { AccountBackupMergeConflictGroup } from '@common/account-backup'
import { isDeepStrictEqual } from 'node:util'

export const AccountRecordMergeComparisonPolicyVersion = 1 as const
export const AccountRecordMergeConflictPolicyVersion = 1 as const
export const AccountRecordMergeConflictResolution =
  'preserve-current-v1' as const

const NonSemanticFields = {
  [DbName.port]: [],
  [DbName.drop]: [
    'origin',
    'shipName',
    'questName',
    'enemyDeckName'
  ],
  [DbName.battle]: [
    'origin',
    'questName',
    'enemyDeckName'
  ],
  [DbName.item]: ['origin'],
  [DbName.ship]: ['origin'],
  [DbName.remodel]: ['origin'],
  [DbName.mission]: [
    'origin',
    'mapareaName',
    'questName'
  ],
  [DbName.quest]: null,
  [DbName.clearitemget]: [
    'origin',
    'questName'
  ]
} as const satisfies Record<DbName, readonly string[] | null>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function omitFields(
  record: Record<string, unknown>,
  fields: readonly string[]
): Record<string, unknown> {
  const omitted = new Set(['_id', 'recordIdentity', ...fields])
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !omitted.has(key))
  )
}

function omitNeDbId(
  record: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== '_id')
  )
}

/**
 * Normalize only fields that are explicitly known to be NeDB identity,
 * stable-record identity, app provenance, or derived display text.
 *
 * Every unlisted field, including a field introduced by a future version,
 * remains in the comparison and therefore fails closed as a conflict when it
 * differs.
 */
export function accountRecordMergeComparableValue(
  dbName: DbName,
  record: Record<string, unknown>
): Record<string, unknown> {
  const fields = NonSemanticFields[dbName]
  if (fields === null) {
    throw new Error(`Database has no append-record merge policy: ${dbName}`)
  }
  const comparable = omitFields(record, fields)
  if (dbName === DbName.battle && isRecord(comparable.drop)) {
    comparable.drop = accountRecordMergeComparableValue(
      DbName.drop,
      comparable.drop
    )
  }
  return comparable
}

export type AccountRecordMergeConflictComparisonMode =
  | 'stable-identity'
  | 'legacy-exact'

type ConflictFieldGroups = Readonly<
  Record<string, AccountBackupMergeConflictGroup>
>

const CommonConflictFieldGroups = {
  recordIdentity: 'identity'
} as const satisfies ConflictFieldGroups

const ConflictFieldGroupsByDb = {
  [DbName.port]: {
    ...CommonConflictFieldGroups,
    date: 'timestamp'
  },
  [DbName.drop]: {
    ...CommonConflictFieldGroups,
    date: 'timestamp',
    origin: 'provenance',
    shipName: 'display',
    questName: 'display',
    enemyDeckName: 'display',
    mapId: 'location',
    cellId: 'location',
    isBoss: 'location',
    enemyFormation: 'location',
    mapLv: 'location',
    teitokuLv: 'context',
    enemyShips1: 'context',
    enemyShips2: 'context',
    shipId: 'result',
    shipCounts: 'result',
    rank: 'result',
    exp: 'result',
    baseExp: 'result',
    firstClear: 'result',
    itemId: 'result',
    itemCount: 'result'
  },
  [DbName.battle]: {
    ...CommonConflictFieldGroups,
    date: 'timestamp',
    origin: 'provenance',
    questName: 'display',
    enemyDeckName: 'display',
    uuid: 'location',
    index: 'location',
    mapId: 'location',
    cellId: 'location',
    fromCellId: 'location',
    portReturn: 'location',
    isBoss: 'location',
    type: 'location',
    eventId: 'location',
    eventKind: 'location',
    mapLv: 'location',
    airsearchResult: 'location',
    ships1: 'fleet',
    ships2: 'fleet',
    teitokuLv: 'context',
    rank: 'result',
    exp: 'result',
    baseExp: 'result',
    firstClear: 'result',
    formations: 'result',
    seiku: 'result',
    drop: 'result',
    items: 'reward',
    middayJson: 'raw-response',
    midnightJson: 'raw-response',
    happeningJson: 'raw-response'
  },
  [DbName.item]: {
    ...CommonConflictFieldGroups,
    date: 'timestamp',
    origin: 'provenance',
    items: 'input',
    secretary: 'context',
    teitokuLv: 'context',
    itemId: 'result',
    successful: 'result'
  },
  [DbName.ship]: {
    ...CommonConflictFieldGroups,
    date: 'timestamp',
    origin: 'provenance',
    kdockId: 'input',
    highspeed: 'input',
    largeFlag: 'input',
    items: 'input',
    secretary: 'context',
    teitokuLv: 'context',
    shipId: 'result'
  },
  [DbName.remodel]: {
    ...CommonConflictFieldGroups,
    date: 'timestamp',
    origin: 'provenance',
    itemId: 'input',
    itemLevel: 'input',
    certain: 'input',
    flagshipId: 'context',
    flagshipLevel: 'context',
    flagshipCond: 'context',
    consortId: 'context',
    consortLevel: 'context',
    consortCond: 'context',
    teitokuLv: 'context',
    successful: 'result'
  },
  [DbName.mission]: {
    ...CommonConflictFieldGroups,
    date: 'timestamp',
    origin: 'provenance',
    mapareaName: 'display',
    questName: 'display',
    ships: 'fleet',
    clearResult: 'result',
    getMaterial: 'reward',
    getItem1: 'reward',
    getItem2: 'reward'
  },
  [DbName.quest]: null,
  [DbName.clearitemget]: {
    ...CommonConflictFieldGroups,
    date: 'timestamp',
    origin: 'provenance',
    questName: 'display',
    questNo: 'context',
    material: 'reward',
    bonuses: 'reward'
  }
} as const satisfies Record<DbName, ConflictFieldGroups | null>

export const AccountRecordMergeConflictGroupOrder = [
  'identity',
  'timestamp',
  'provenance',
  'display',
  'snapshot',
  'location',
  'context',
  'input',
  'result',
  'fleet',
  'raw-response',
  'reward',
  'unknown-field'
] as const satisfies readonly AccountBackupMergeConflictGroup[]

function conflictComparableValue(
  dbName: DbName,
  record: Record<string, unknown>,
  mode: AccountRecordMergeConflictComparisonMode
): Record<string, unknown> {
  return mode === 'stable-identity'
    ? accountRecordMergeComparableValue(dbName, record)
    : omitNeDbId(record)
}

function conflictGroupForField(
  dbName: DbName,
  field: string
): AccountBackupMergeConflictGroup {
  if (dbName === DbName.port && /^\d+$/.test(field)) {
    return 'snapshot'
  }
  const policy = ConflictFieldGroupsByDb[dbName]
  if (policy === null) {
    throw new Error('Quest records require a dedicated merge policy')
  }
  return (policy as ConflictFieldGroups)[field] ?? 'unknown-field'
}

/**
 * Classify a conflict without exposing either payload. The default mode
 * follows stable-identity comparison. Legacy same-id conflicts use exact
 * content so provenance and derived display changes remain visible.
 */
export function accountRecordMergeConflictGroups(
  dbName: DbName,
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
  mode: AccountRecordMergeConflictComparisonMode = 'stable-identity'
): AccountBackupMergeConflictGroup[] {
  if (dbName === DbName.quest) {
    throw new Error('Quest records require a dedicated merge policy')
  }
  const left = conflictComparableValue(dbName, current, mode)
  const right = conflictComparableValue(dbName, incoming, mode)
  const groups = new Set<AccountBackupMergeConflictGroup>()

  for (const field of new Set([
    ...Object.keys(left),
    ...Object.keys(right)
  ])) {
    if (isDeepStrictEqual(left[field], right[field])) {
      continue
    }
    if (
      dbName === DbName.battle &&
      field === 'drop' &&
      isRecord(left.drop) &&
      isRecord(right.drop)
    ) {
      for (const group of accountRecordMergeConflictGroups(
        DbName.drop,
        left.drop,
        right.drop,
        mode
      )) {
        groups.add(group)
      }
      continue
    }
    groups.add(conflictGroupForField(dbName, field))
  }

  return AccountRecordMergeConflictGroupOrder.filter((group) =>
    groups.has(group)
  )
}

export function isAccountRecordMergeConflictGroup(
  dbName: DbName,
  group: unknown
): group is AccountBackupMergeConflictGroup {
  if (
    typeof group !== 'string' ||
    !AccountRecordMergeConflictGroupOrder.includes(
      group as AccountBackupMergeConflictGroup
    ) ||
    dbName === DbName.quest
  ) {
    return false
  }
  if (group === 'unknown-field') {
    return true
  }
  if (dbName === DbName.port && group === 'snapshot') {
    return true
  }
  const policy = ConflictFieldGroupsByDb[dbName]
  return (
    policy !== null &&
    (Object.values(policy) as AccountBackupMergeConflictGroup[])
      .includes(group as AccountBackupMergeConflictGroup)
  )
}

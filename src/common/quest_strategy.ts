export type StrategyKnowledgeStatus = 'approved' | 'draft' | 'withdrawn'
export type StrategyConfidence = 'verified' | 'supported'
export type StrategyQuestState = 'active' | 'available' | 'completed' | 'unknown'
export type StrategyReadiness = 'ready' | 'needs-preparation' | 'blocked' | 'unknown'
export type StrategyPrerequisiteState = 'ready' | 'blocked' | 'unknown'
export type StrategyMapAvailability = 'available' | 'unavailable' | 'unknown'
export type StrategyDeadlineUrgency = 'normal' | 'soon' | 'urgent' | 'expired'
export type StrategyCostLevel = 'low' | 'medium' | 'high'
export type StrategyRiskLevel = 'low' | 'medium' | 'high'
export type StrategyAirState = 'denial' | 'parity' | 'superiority' | 'supremacy'
export type StrategyPreferencePreset = 'balanced' | 'deadline' | 'resource-saving' | 'risk-averse'

export interface StrategyEvidence {
  sourceId: string
  sourceLabel: string
  url: string
  reviewedAt: string
  validUntil?: string
  confidence: StrategyConfidence
  summary: string
}

export interface StrategyValidity {
  startsAt?: string
  endsAt?: string
  reviewBy?: string
  eventOnly?: boolean
}

export interface StrategyShipTypeConstraint {
  shipTypeIds: number[]
  minimum: number
  label: string
}

export interface StrategyEquipmentTypeConstraint {
  equipmentTypeIds: number[]
  minimum: number
  required: boolean
  label: string
}

export interface StrategyFormation {
  formationId: number
  label: string
  when?: string
}

export interface StrategyPrerequisiteAlternative {
  groupId: string
  optionId: string
  requiredQuestIds: number[]
}

export interface StrategyQuestObjective {
  questId: number
  result: 'arrival' | 'victory' | 'A' | 'S'
  requiredCount: number
}

export interface QuestStrategyRecipe {
  schemaVersion: 1
  id: string
  revision: number
  title: string
  status: StrategyKnowledgeStatus
  questIds: number[]
  objectives: StrategyQuestObjective[]
  mapKey: string
  routeLabels: string[]
  targetNodes: string[]
  fleet: {
    minimumShips: number
    maximumShips: number
    shipTypeConstraints: StrategyShipTypeConstraint[]
  }
  equipmentTypeConstraints: StrategyEquipmentTypeConstraint[]
  formations: StrategyFormation[]
  airState?: {
    target: StrategyAirState
    summary: string
  }
  actions: string[]
  cost: StrategyCostLevel
  risk: StrategyRiskLevel
  evidence: StrategyEvidence[]
  validity: StrategyValidity
  prerequisiteAlternative?: StrategyPrerequisiteAlternative
}

export interface StrategyQuestSnapshot {
  questId: number
  state: StrategyQuestState
  deadlineUrgency: StrategyDeadlineUrgency
  readiness: StrategyReadiness
  prerequisiteState: StrategyPrerequisiteState
}

/**
 * 攻略計画に必要な集計値だけを保持する。艦娘 ID、装備 ID、提督名などの識別情報は含めない。
 */
export interface StrategyLocalSnapshot {
  schemaVersion: 1
  capturedAt: string
  selectedQuestIds: number[]
  quests: StrategyQuestSnapshot[]
  mapAvailability: Record<string, StrategyMapAvailability>
  shipTypeCounts?: Record<string, number>
  equipmentTypeCounts?: Record<string, number>
  questCapacity?: {
    active: number
    maximum: number
  }
}

export interface StrategyPreferences {
  preset: StrategyPreferencePreset
  maximumRoutes: number
}

export type StrategyCheckState = 'pass' | 'fail' | 'unknown'

export interface StrategyHardCheck {
  code:
    | 'knowledge-approved'
    | 'evidence-valid'
    | 'validity-window'
    | 'quest-selected'
    | 'quest-deadline'
    | 'prerequisite-ready'
    | 'map-available'
    | 'fleet-ready'
    | 'equipment-ready'
    | 'quest-slot-capacity'
  state: StrategyCheckState
  message: string
}

export interface StrategyScoreBreakdown {
  coCompletion: number
  deadlineUrgency: number
  prerequisiteProgress: number
  readiness: number
  preferenceAdjustment: number
  unknownInputPenalty: number
  staleEvidencePenalty: number
  total: number
}

export interface StrategyRouteStep {
  recipeId: string
  recipeRevision: number
  title: string
  questIds: number[]
  coveredQuestIds: number[]
  objectives: StrategyQuestObjective[]
  mapKey: string
  routeLabels: string[]
  targetNodes: string[]
  fleet: QuestStrategyRecipe['fleet']
  equipmentTypeConstraints: StrategyEquipmentTypeConstraint[]
  formations: StrategyFormation[]
  airState?: QuestStrategyRecipe['airState']
  actions: string[]
  score: StrategyScoreBreakdown
  checks: StrategyHardCheck[]
  warnings: string[]
  evidence: StrategyEvidence[]
  prerequisiteAlternative?: StrategyPrerequisiteAlternative
}

export interface StrategyBlockedCandidate {
  recipeId: string
  title: string
  reasons: string[]
}

export interface StrategyRoutePlan {
  schemaVersion: 1
  generatedAt: string
  knowledgeVersion: string
  inputFingerprint: string
  selectedQuestIds: number[]
  coveredQuestIds: number[]
  uncoveredQuestIds: number[]
  steps: StrategyRouteStep[]
  alternatives: StrategyRouteStep[]
  blocked: StrategyBlockedCandidate[]
  warnings: string[]
}

export interface BuildQuestStrategyRoutePlanInput {
  knowledgeVersion: string
  generatedAt: string
  recipes: readonly QuestStrategyRecipe[]
  snapshot: StrategyLocalSnapshot
  preferences: StrategyPreferences
}

export class QuestStrategyValidationError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'QuestStrategyValidationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordAt(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new QuestStrategyValidationError(path, 'object expected')
  }
  return value
}

function assertKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string
): void {
  const allowedKeys = new Set(allowed)
  const unknown = Object.keys(value).find((key) => !allowedKeys.has(key))
  if (unknown) {
    throw new QuestStrategyValidationError(`${path}.${unknown}`, 'unknown field')
  }
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new QuestStrategyValidationError(path, 'non-empty string expected')
  }
  return value.trim()
}

function integerAt(value: unknown, path: string, minimum = 0): number {
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new QuestStrategyValidationError(
      path,
      `integer greater than or equal to ${minimum} expected`
    )
  }
  return value as number
}

function enumAt<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new QuestStrategyValidationError(path, `one of ${values.join(', ')} expected`)
  }
  return value as T
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new QuestStrategyValidationError(path, 'boolean expected')
  }
  return value
}

function timestampAt(value: unknown, path: string): string {
  const timestamp = stringAt(value, path)
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) ||
    !Number.isFinite(Date.parse(timestamp))
  ) {
    throw new QuestStrategyValidationError(path, 'valid timestamp expected')
  }
  return timestamp
}

function httpsUrlAt(value: unknown, path: string): string {
  const url = stringAt(value, path)
  try {
    if (new URL(url).protocol !== 'https:') {
      throw new Error()
    }
  } catch {
    throw new QuestStrategyValidationError(path, 'HTTPS URL expected')
  }
  return url
}

function arrayAt<T>(
  value: unknown,
  path: string,
  read: (item: unknown, itemPath: string) => T,
  minimumLength = 0
): T[] {
  if (!Array.isArray(value) || value.length < minimumLength) {
    throw new QuestStrategyValidationError(
      path,
      `array with at least ${minimumLength} item(s) expected`
    )
  }
  return value.map((item, index) => read(item, `${path}[${index}]`))
}

function uniqueIntegersAt(value: unknown, path: string, minimumLength = 1): number[] {
  const integers = arrayAt(
    value,
    path,
    (item, itemPath) => integerAt(item, itemPath, 1),
    minimumLength
  )
  if (new Set(integers).size !== integers.length) {
    throw new QuestStrategyValidationError(path, 'duplicate values are not allowed')
  }
  return integers
}

function uniqueStringsAt(value: unknown, path: string, minimumLength = 1): string[] {
  const strings = arrayAt(value, path, stringAt, minimumLength)
  if (new Set(strings).size !== strings.length) {
    throw new QuestStrategyValidationError(path, 'duplicate values are not allowed')
  }
  return strings
}

function readEvidence(value: unknown, path: string): StrategyEvidence {
  const record = recordAt(value, path)
  assertKeys(
    record,
    ['sourceId', 'sourceLabel', 'url', 'reviewedAt', 'validUntil', 'confidence', 'summary'],
    path
  )
  return {
    sourceId: stringAt(record.sourceId, `${path}.sourceId`),
    sourceLabel: stringAt(record.sourceLabel, `${path}.sourceLabel`),
    url: httpsUrlAt(record.url, `${path}.url`),
    reviewedAt: timestampAt(record.reviewedAt, `${path}.reviewedAt`),
    ...(record.validUntil === undefined
      ? {}
      : { validUntil: timestampAt(record.validUntil, `${path}.validUntil`) }),
    confidence: enumAt(record.confidence, ['verified', 'supported'] as const, `${path}.confidence`),
    summary: stringAt(record.summary, `${path}.summary`)
  }
}

function readValidity(value: unknown, path: string): StrategyValidity {
  const record = recordAt(value, path)
  assertKeys(record, ['startsAt', 'endsAt', 'reviewBy', 'eventOnly'], path)
  const validity: StrategyValidity = {
    ...(record.startsAt === undefined
      ? {}
      : { startsAt: timestampAt(record.startsAt, `${path}.startsAt`) }),
    ...(record.endsAt === undefined
      ? {}
      : { endsAt: timestampAt(record.endsAt, `${path}.endsAt`) }),
    ...(record.reviewBy === undefined
      ? {}
      : { reviewBy: timestampAt(record.reviewBy, `${path}.reviewBy`) }),
    ...(record.eventOnly === undefined
      ? {}
      : { eventOnly: booleanAt(record.eventOnly, `${path}.eventOnly`) })
  }
  if (
    validity.startsAt &&
    validity.endsAt &&
    Date.parse(validity.startsAt) >= Date.parse(validity.endsAt)
  ) {
    throw new QuestStrategyValidationError(path, 'startsAt must precede endsAt')
  }
  if (validity.eventOnly && (!validity.startsAt || !validity.endsAt)) {
    throw new QuestStrategyValidationError(
      path,
      'event-only knowledge requires startsAt and endsAt'
    )
  }
  return validity
}

function readShipTypeConstraint(value: unknown, path: string): StrategyShipTypeConstraint {
  const record = recordAt(value, path)
  assertKeys(record, ['shipTypeIds', 'minimum', 'label'], path)
  return {
    shipTypeIds: uniqueIntegersAt(record.shipTypeIds, `${path}.shipTypeIds`),
    minimum: integerAt(record.minimum, `${path}.minimum`, 1),
    label: stringAt(record.label, `${path}.label`)
  }
}

function readEquipmentTypeConstraint(
  value: unknown,
  path: string
): StrategyEquipmentTypeConstraint {
  const record = recordAt(value, path)
  assertKeys(record, ['equipmentTypeIds', 'minimum', 'required', 'label'], path)
  return {
    equipmentTypeIds: uniqueIntegersAt(record.equipmentTypeIds, `${path}.equipmentTypeIds`),
    minimum: integerAt(record.minimum, `${path}.minimum`, 1),
    required: booleanAt(record.required, `${path}.required`),
    label: stringAt(record.label, `${path}.label`)
  }
}

function readQuestObjective(value: unknown, path: string): StrategyQuestObjective {
  const record = recordAt(value, path)
  assertKeys(record, ['questId', 'result', 'requiredCount'], path)
  return {
    questId: integerAt(record.questId, `${path}.questId`, 1),
    result: enumAt(record.result, ['arrival', 'victory', 'A', 'S'] as const, `${path}.result`),
    requiredCount: integerAt(record.requiredCount, `${path}.requiredCount`, 1)
  }
}

function readFormation(value: unknown, path: string): StrategyFormation {
  const record = recordAt(value, path)
  assertKeys(record, ['formationId', 'label', 'when'], path)
  return {
    formationId: integerAt(record.formationId, `${path}.formationId`, 1),
    label: stringAt(record.label, `${path}.label`),
    ...(record.when === undefined ? {} : { when: stringAt(record.when, `${path}.when`) })
  }
}

function readPrerequisiteAlternative(
  value: unknown,
  path: string
): StrategyPrerequisiteAlternative {
  const record = recordAt(value, path)
  assertKeys(record, ['groupId', 'optionId', 'requiredQuestIds'], path)
  return {
    groupId: stringAt(record.groupId, `${path}.groupId`),
    optionId: stringAt(record.optionId, `${path}.optionId`),
    requiredQuestIds: uniqueIntegersAt(record.requiredQuestIds, `${path}.requiredQuestIds`)
  }
}

function readRecipe(value: unknown, path: string): QuestStrategyRecipe {
  const record = recordAt(value, path)
  assertKeys(
    record,
    [
      'schemaVersion',
      'id',
      'revision',
      'title',
      'status',
      'questIds',
      'objectives',
      'mapKey',
      'routeLabels',
      'targetNodes',
      'fleet',
      'equipmentTypeConstraints',
      'formations',
      'airState',
      'actions',
      'cost',
      'risk',
      'evidence',
      'validity',
      'prerequisiteAlternative'
    ],
    path
  )
  if (record.schemaVersion !== 1) {
    throw new QuestStrategyValidationError(`${path}.schemaVersion`, 'version 1 expected')
  }
  const mapKey = stringAt(record.mapKey, `${path}.mapKey`)
  if (!/^[1-9]\d*-[1-9]\d*$/.test(mapKey)) {
    throw new QuestStrategyValidationError(`${path}.mapKey`, 'normal map key expected')
  }
  const fleetRecord = recordAt(record.fleet, `${path}.fleet`)
  assertKeys(fleetRecord, ['minimumShips', 'maximumShips', 'shipTypeConstraints'], `${path}.fleet`)
  const minimumShips = integerAt(fleetRecord.minimumShips, `${path}.fleet.minimumShips`, 1)
  const maximumShips = integerAt(
    fleetRecord.maximumShips,
    `${path}.fleet.maximumShips`,
    minimumShips
  )
  let airState: QuestStrategyRecipe['airState']
  if (record.airState !== undefined) {
    const airStateRecord = recordAt(record.airState, `${path}.airState`)
    assertKeys(airStateRecord, ['target', 'summary'], `${path}.airState`)
    airState = {
      target: enumAt(
        airStateRecord.target,
        ['denial', 'parity', 'superiority', 'supremacy'] as const,
        `${path}.airState.target`
      ),
      summary: stringAt(airStateRecord.summary, `${path}.airState.summary`)
    }
  }
  const questIds = uniqueIntegersAt(record.questIds, `${path}.questIds`)
  const objectives = arrayAt(record.objectives, `${path}.objectives`, readQuestObjective, 1)
  if (new Set(objectives.map((objective) => objective.questId)).size !== objectives.length) {
    throw new QuestStrategyValidationError(`${path}.objectives`, 'duplicate questId values')
  }
  const sortedQuestIds = [...questIds].sort((a, b) => a - b)
  const objectiveQuestIds = objectives.map((objective) => objective.questId).sort((a, b) => a - b)
  if (
    objectiveQuestIds.length !== sortedQuestIds.length ||
    objectiveQuestIds.some((questId, index) => questId !== sortedQuestIds[index])
  ) {
    throw new QuestStrategyValidationError(
      `${path}.objectives`,
      'questIds and objective questId values must match'
    )
  }
  return {
    schemaVersion: 1,
    id: stringAt(record.id, `${path}.id`),
    revision: integerAt(record.revision, `${path}.revision`, 1),
    title: stringAt(record.title, `${path}.title`),
    status: enumAt(record.status, ['approved', 'draft', 'withdrawn'] as const, `${path}.status`),
    questIds,
    objectives,
    mapKey,
    routeLabels: uniqueStringsAt(record.routeLabels, `${path}.routeLabels`),
    targetNodes: uniqueStringsAt(record.targetNodes, `${path}.targetNodes`),
    fleet: {
      minimumShips,
      maximumShips,
      shipTypeConstraints: arrayAt(
        fleetRecord.shipTypeConstraints,
        `${path}.fleet.shipTypeConstraints`,
        readShipTypeConstraint
      )
    },
    equipmentTypeConstraints: arrayAt(
      record.equipmentTypeConstraints,
      `${path}.equipmentTypeConstraints`,
      readEquipmentTypeConstraint
    ),
    formations: arrayAt(record.formations, `${path}.formations`, readFormation, 1),
    ...(airState === undefined ? {} : { airState }),
    actions: uniqueStringsAt(record.actions, `${path}.actions`),
    cost: enumAt(record.cost, ['low', 'medium', 'high'] as const, `${path}.cost`),
    risk: enumAt(record.risk, ['low', 'medium', 'high'] as const, `${path}.risk`),
    evidence: arrayAt(record.evidence, `${path}.evidence`, readEvidence),
    validity: readValidity(record.validity, `${path}.validity`),
    ...(record.prerequisiteAlternative === undefined
      ? {}
      : {
          prerequisiteAlternative: readPrerequisiteAlternative(
            record.prerequisiteAlternative,
            `${path}.prerequisiteAlternative`
          )
        })
  }
}

export function normalizeQuestStrategyRecipes(value: unknown): QuestStrategyRecipe[] {
  const recipes = arrayAt(value, 'recipes', readRecipe)
  const identities = new Set<string>()
  for (const recipe of recipes) {
    if (identities.has(recipe.id)) {
      throw new QuestStrategyValidationError('recipes', `duplicate recipe ${recipe.id}`)
    }
    identities.add(recipe.id)
  }
  return recipes
}

function readQuestSnapshot(value: unknown, path: string): StrategyQuestSnapshot {
  const record = recordAt(value, path)
  assertKeys(
    record,
    ['questId', 'state', 'deadlineUrgency', 'readiness', 'prerequisiteState'],
    path
  )
  return {
    questId: integerAt(record.questId, `${path}.questId`, 1),
    state: enumAt(
      record.state,
      ['active', 'available', 'completed', 'unknown'] as const,
      `${path}.state`
    ),
    deadlineUrgency: enumAt(
      record.deadlineUrgency,
      ['normal', 'soon', 'urgent', 'expired'] as const,
      `${path}.deadlineUrgency`
    ),
    readiness: enumAt(
      record.readiness,
      ['ready', 'needs-preparation', 'blocked', 'unknown'] as const,
      `${path}.readiness`
    ),
    prerequisiteState: enumAt(
      record.prerequisiteState,
      ['ready', 'blocked', 'unknown'] as const,
      `${path}.prerequisiteState`
    )
  }
}

function readCountRecord(value: unknown, path: string): Record<string, number> {
  const record = recordAt(value, path)
  const normalized: Record<string, number> = {}
  for (const [key, count] of Object.entries(record)) {
    if (!/^[1-9]\d*$/.test(key)) {
      throw new QuestStrategyValidationError(`${path}.${key}`, 'positive integer key expected')
    }
    normalized[key] = integerAt(count, `${path}.${key}`)
  }
  return normalized
}

export function normalizeStrategyLocalSnapshot(value: unknown): StrategyLocalSnapshot {
  const record = recordAt(value, 'snapshot')
  assertKeys(
    record,
    [
      'schemaVersion',
      'capturedAt',
      'selectedQuestIds',
      'quests',
      'mapAvailability',
      'shipTypeCounts',
      'equipmentTypeCounts',
      'questCapacity'
    ],
    'snapshot'
  )
  if (record.schemaVersion !== 1) {
    throw new QuestStrategyValidationError('snapshot.schemaVersion', 'version 1 expected')
  }
  const quests = arrayAt(record.quests, 'snapshot.quests', readQuestSnapshot)
  if (new Set(quests.map((quest) => quest.questId)).size !== quests.length) {
    throw new QuestStrategyValidationError('snapshot.quests', 'duplicate questId values')
  }
  const mapAvailabilityRecord = recordAt(record.mapAvailability, 'snapshot.mapAvailability')
  const mapAvailability: Record<string, StrategyMapAvailability> = {}
  for (const [key, availability] of Object.entries(mapAvailabilityRecord)) {
    if (!/^[1-9]\d*-[1-9]\d*$/.test(key)) {
      throw new QuestStrategyValidationError(
        `snapshot.mapAvailability.${key}`,
        'normal map key expected'
      )
    }
    mapAvailability[key] = enumAt(
      availability,
      ['available', 'unavailable', 'unknown'] as const,
      `snapshot.mapAvailability.${key}`
    )
  }
  let questCapacity: StrategyLocalSnapshot['questCapacity']
  if (record.questCapacity !== undefined) {
    const capacityRecord = recordAt(record.questCapacity, 'snapshot.questCapacity')
    assertKeys(capacityRecord, ['active', 'maximum'], 'snapshot.questCapacity')
    const active = integerAt(capacityRecord.active, 'snapshot.questCapacity.active')
    const maximum = integerAt(capacityRecord.maximum, 'snapshot.questCapacity.maximum', active)
    questCapacity = { active, maximum }
  }
  return {
    schemaVersion: 1,
    capturedAt: timestampAt(record.capturedAt, 'snapshot.capturedAt'),
    selectedQuestIds: uniqueIntegersAt(record.selectedQuestIds, 'snapshot.selectedQuestIds', 1),
    quests,
    mapAvailability,
    ...(record.shipTypeCounts === undefined
      ? {}
      : {
          shipTypeCounts: readCountRecord(record.shipTypeCounts, 'snapshot.shipTypeCounts')
        }),
    ...(record.equipmentTypeCounts === undefined
      ? {}
      : {
          equipmentTypeCounts: readCountRecord(
            record.equipmentTypeCounts,
            'snapshot.equipmentTypeCounts'
          )
        }),
    ...(questCapacity === undefined ? {} : { questCapacity })
  }
}

const costLevelValue: Readonly<Record<StrategyCostLevel, number>> = {
  low: 0,
  medium: 1,
  high: 2
}

const riskLevelValue: Readonly<Record<StrategyRiskLevel, number>> = {
  low: 0,
  medium: 1,
  high: 2
}

const deadlineValue: Readonly<Record<StrategyDeadlineUrgency, number>> = {
  normal: 0,
  soon: 1,
  urgent: 2,
  expired: 0
}

function hardCheck(
  code: StrategyHardCheck['code'],
  state: StrategyCheckState,
  message: string
): StrategyHardCheck {
  return { code, state, message }
}

function sumCounts(counts: Readonly<Record<string, number>>, typeIds: readonly number[]): number {
  return typeIds.reduce((total, typeId) => total + (counts[String(typeId)] ?? 0), 0)
}

function compareRecipeIdentity(a: QuestStrategyRecipe, b: QuestStrategyRecipe): number {
  return (
    a.id.localeCompare(b.id) ||
    a.mapKey.localeCompare(b.mapKey) ||
    a.questIds.join(',').localeCompare(b.questIds.join(','))
  )
}

function preferenceAdjustment(
  recipe: QuestStrategyRecipe,
  preset: StrategyPreferencePreset
): number {
  const cost = costLevelValue[recipe.cost]
  const risk = riskLevelValue[recipe.risk]
  switch (preset) {
    case 'deadline':
      return -(cost * 2 + risk * 4)
    case 'resource-saving':
      return -(cost * 15 + risk * 4)
    case 'risk-averse':
      return -(cost * 4 + risk * 15)
    default:
      return -(cost * 6 + risk * 6)
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue)
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    )
  }
  return value
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function evaluateRecipe(
  recipe: QuestStrategyRecipe,
  snapshot: StrategyLocalSnapshot,
  preferences: StrategyPreferences,
  now: number
): StrategyRouteStep {
  const selectedQuestIds = new Set(snapshot.selectedQuestIds)
  const questById = new Map(snapshot.quests.map((quest) => [quest.questId, quest]))
  const coveredQuestIds = recipe.questIds
    .filter((questId) => selectedQuestIds.has(questId))
    .sort((a, b) => a - b)
  const checks: StrategyHardCheck[] = []
  const warnings: string[] = []

  checks.push(
    hardCheck(
      'knowledge-approved',
      recipe.status === 'approved' ? 'pass' : 'fail',
      recipe.status === 'approved'
        ? '審査済みの攻略知識です'
        : `攻略知識の状態は ${recipe.status} です`
    )
  )

  const validEvidence = recipe.evidence.filter(
    (evidence) => !evidence.validUntil || Date.parse(evidence.validUntil) > now
  )
  checks.push(
    hardCheck(
      'evidence-valid',
      validEvidence.length > 0 ? 'pass' : 'fail',
      validEvidence.length > 0
        ? `${validEvidence.length} 件の有効な根拠があります`
        : '有効な根拠がありません'
    )
  )

  const beforeStart = recipe.validity.startsAt ? now < Date.parse(recipe.validity.startsAt) : false
  const afterEnd = recipe.validity.endsAt ? now >= Date.parse(recipe.validity.endsAt) : false
  checks.push(
    hardCheck(
      'validity-window',
      beforeStart || afterEnd ? 'fail' : 'pass',
      beforeStart
        ? '攻略知識の有効期間がまだ始まっていません'
        : afterEnd
          ? '攻略知識の有効期間が終了しています'
          : '攻略知識の有効期間内です'
    )
  )

  checks.push(
    hardCheck(
      'quest-selected',
      coveredQuestIds.length > 0 ? 'pass' : 'fail',
      coveredQuestIds.length > 0
        ? `${coveredQuestIds.length} 件の選択任務を対象にします`
        : '選択した任務を対象にしていません'
    )
  )

  const coveredQuests = coveredQuestIds.map((questId) => questById.get(questId))
  const expiredQuest = coveredQuests.find((quest) => quest?.deadlineUrgency === 'expired')
  checks.push(
    hardCheck(
      'quest-deadline',
      expiredQuest ? 'fail' : 'pass',
      expiredQuest ? `任務 ${expiredQuest.questId} の期限が終了しています` : '対象任務の期限内です'
    )
  )

  const blockedPrerequisite = coveredQuests.find((quest) => quest?.prerequisiteState === 'blocked')
  const unknownPrerequisite = coveredQuests.some(
    (quest) => !quest || quest.prerequisiteState === 'unknown'
  )
  checks.push(
    hardCheck(
      'prerequisite-ready',
      blockedPrerequisite ? 'fail' : unknownPrerequisite ? 'unknown' : 'pass',
      blockedPrerequisite
        ? `任務 ${blockedPrerequisite.questId} の前提条件を満たしていません`
        : unknownPrerequisite
          ? '一部の前提条件を確認できません'
          : '前提条件を確認済みです'
    )
  )

  const mapAvailability = snapshot.mapAvailability[recipe.mapKey] ?? 'unknown'
  checks.push(
    hardCheck(
      'map-available',
      mapAvailability === 'unavailable'
        ? 'fail'
        : mapAvailability === 'unknown'
          ? 'unknown'
          : 'pass',
      mapAvailability === 'unavailable'
        ? `海域 ${recipe.mapKey} は未開放です`
        : mapAvailability === 'unknown'
          ? `海域 ${recipe.mapKey} の開放状態を確認できません`
          : `海域 ${recipe.mapKey} は開放済みです`
    )
  )

  let fleetState: StrategyCheckState = 'pass'
  let fleetMessage = '艦種条件を満たせます'
  if (recipe.fleet.shipTypeConstraints.length > 0 && !snapshot.shipTypeCounts) {
    fleetState = 'unknown'
    fleetMessage = '艦種別の保有数を確認できません'
  } else if (snapshot.shipTypeCounts) {
    const failed = recipe.fleet.shipTypeConstraints.find((constraint) => {
      const count = sumCounts(snapshot.shipTypeCounts!, constraint.shipTypeIds)
      return count < constraint.minimum
    })
    if (failed) {
      fleetState = 'fail'
      fleetMessage = `艦種条件「${failed.label}」を満たせません`
    }
  }
  checks.push(hardCheck('fleet-ready', fleetState, fleetMessage))

  const requiredEquipment = recipe.equipmentTypeConstraints.filter(
    (constraint) => constraint.required
  )
  const recommendedEquipment = recipe.equipmentTypeConstraints.filter(
    (constraint) => !constraint.required
  )
  let equipmentState: StrategyCheckState = 'pass'
  let equipmentMessage = '装備カテゴリ条件を満たせます'
  if (recipe.equipmentTypeConstraints.length > 0 && !snapshot.equipmentTypeCounts) {
    if (requiredEquipment.length > 0) {
      equipmentState = 'unknown'
      equipmentMessage = '必須装備カテゴリ別の保有数を確認できません'
    }
    if (recommendedEquipment.length > 0) {
      warnings.push('推奨装備カテゴリ別の保有数を確認できません')
    }
  } else if (snapshot.equipmentTypeCounts) {
    const failed = requiredEquipment.find(
      (constraint) =>
        sumCounts(snapshot.equipmentTypeCounts!, constraint.equipmentTypeIds) < constraint.minimum
    )
    if (failed) {
      equipmentState = 'fail'
      equipmentMessage = `装備条件「${failed.label}」を満たせません`
    }
    const missingRecommended = recommendedEquipment.filter(
      (constraint) =>
        sumCounts(snapshot.equipmentTypeCounts!, constraint.equipmentTypeIds) < constraint.minimum
    )
    if (missingRecommended.length > 0) {
      warnings.push(
        `推奨装備を確認してください：${missingRecommended
          .map((constraint) => constraint.label)
          .join('、')}`
      )
    }
  }
  checks.push(hardCheck('equipment-ready', equipmentState, equipmentMessage))

  const inactiveQuestCount = coveredQuestIds.filter(
    (questId) => questById.get(questId)?.state !== 'active'
  ).length
  const availableQuestSlots = snapshot.questCapacity
    ? snapshot.questCapacity.maximum - snapshot.questCapacity.active
    : undefined
  const capacityState: StrategyCheckState =
    availableQuestSlots === undefined
      ? 'unknown'
      : inactiveQuestCount > availableQuestSlots
        ? 'fail'
        : 'pass'
  checks.push(
    hardCheck(
      'quest-slot-capacity',
      capacityState,
      availableQuestSlots === undefined
        ? '任務枠の空きを確認できません'
        : inactiveQuestCount > availableQuestSlots
          ? `必要な任務枠 ${inactiveQuestCount} 件に対して空きは ${availableQuestSlots} 件です`
          : `必要な任務枠 ${inactiveQuestCount} 件を確保できます`
    )
  )

  const expiredEvidenceCount = recipe.evidence.length - validEvidence.length
  const overdueReviewCount =
    recipe.validity.reviewBy && now >= Date.parse(recipe.validity.reviewBy) ? 1 : 0
  const staleEvidenceCount = expiredEvidenceCount + overdueReviewCount
  if (expiredEvidenceCount > 0) {
    warnings.push(`${expiredEvidenceCount} 件の根拠が失効しています`)
  }
  if (overdueReviewCount > 0) {
    warnings.push('攻略知識の再確認期限を過ぎています')
  }
  for (const check of checks) {
    if (check.state === 'unknown') {
      warnings.push(check.message)
    }
  }
  const unknownInputCount = checks.filter((check) => check.state === 'unknown').length
  const urgency = Math.max(
    0,
    ...coveredQuests.map((quest) => (quest ? deadlineValue[quest.deadlineUrgency] : 0))
  )
  const prerequisiteProgress = coveredQuests.filter(
    (quest) => quest?.prerequisiteState === 'ready'
  ).length
  const readiness = coveredQuests.filter((quest) => quest?.readiness === 'ready').length
  const coCompletion = coveredQuestIds.length * 40
  const deadlineUrgency = urgency * 30
  const prerequisiteProgressScore = prerequisiteProgress * 20
  const readinessScore = readiness * 20
  const preference = preferenceAdjustment(recipe, preferences.preset)
  const unknownInputPenalty = unknownInputCount * -8
  const staleEvidencePenalty = staleEvidenceCount * -12
  const total =
    coCompletion +
    deadlineUrgency +
    prerequisiteProgressScore +
    readinessScore +
    preference +
    unknownInputPenalty +
    staleEvidencePenalty

  return {
    recipeId: recipe.id,
    recipeRevision: recipe.revision,
    title: recipe.title,
    questIds: [...recipe.questIds],
    coveredQuestIds,
    objectives: recipe.objectives.map((objective) => ({ ...objective })),
    mapKey: recipe.mapKey,
    routeLabels: [...recipe.routeLabels],
    targetNodes: [...recipe.targetNodes],
    fleet: {
      minimumShips: recipe.fleet.minimumShips,
      maximumShips: recipe.fleet.maximumShips,
      shipTypeConstraints: recipe.fleet.shipTypeConstraints.map((constraint) => ({
        ...constraint,
        shipTypeIds: [...constraint.shipTypeIds]
      }))
    },
    equipmentTypeConstraints: recipe.equipmentTypeConstraints.map((constraint) => ({
      ...constraint,
      equipmentTypeIds: [...constraint.equipmentTypeIds]
    })),
    formations: recipe.formations.map((formation) => ({ ...formation })),
    ...(recipe.airState ? { airState: { ...recipe.airState } } : {}),
    actions: [...recipe.actions],
    score: {
      coCompletion,
      deadlineUrgency,
      prerequisiteProgress: prerequisiteProgressScore,
      readiness: readinessScore,
      preferenceAdjustment: preference,
      unknownInputPenalty,
      staleEvidencePenalty,
      total
    },
    checks,
    warnings,
    evidence: recipe.evidence.map((evidence) => ({ ...evidence })),
    ...(recipe.prerequisiteAlternative
      ? {
          prerequisiteAlternative: {
            ...recipe.prerequisiteAlternative,
            requiredQuestIds: [...recipe.prerequisiteAlternative.requiredQuestIds]
          }
        }
      : {})
  }
}

function compareSteps(a: StrategyRouteStep, b: StrategyRouteStep): number {
  return (
    b.score.total - a.score.total ||
    a.recipeId.localeCompare(b.recipeId) ||
    a.mapKey.localeCompare(b.mapKey) ||
    a.questIds.join(',').localeCompare(b.questIds.join(','))
  )
}

function validateBuildInput(input: BuildQuestStrategyRoutePlanInput): void {
  timestampAt(input.generatedAt, 'input.generatedAt')
  stringAt(input.knowledgeVersion, 'input.knowledgeVersion')
  if (!Number.isInteger(input.preferences.maximumRoutes) || input.preferences.maximumRoutes < 1) {
    throw new QuestStrategyValidationError(
      'input.preferences.maximumRoutes',
      'positive integer expected'
    )
  }
  enumAt(
    input.preferences.preset,
    ['balanced', 'deadline', 'resource-saving', 'risk-averse'] as const,
    'input.preferences.preset'
  )
}

export function buildQuestStrategyRoutePlan(
  input: BuildQuestStrategyRoutePlanInput
): StrategyRoutePlan {
  validateBuildInput(input)
  const now = Date.parse(input.generatedAt)
  const snapshot = normalizeStrategyLocalSnapshot(input.snapshot)
  const recipes = normalizeQuestStrategyRecipes(input.recipes).sort(compareRecipeIdentity)
  const evaluated = recipes.map((recipe) =>
    evaluateRecipe(recipe, snapshot, input.preferences, now)
  )
  const blocked: StrategyBlockedCandidate[] = evaluated
    .filter(
      (step) =>
        step.coveredQuestIds.length > 0 && step.checks.some((check) => check.state === 'fail')
    )
    .map((step) => ({
      recipeId: step.recipeId,
      title: step.title,
      reasons: step.checks.filter((check) => check.state === 'fail').map((check) => check.message)
    }))
  const eligible = evaluated
    .filter((step) => step.checks.every((check) => check.state !== 'fail'))
    .sort(compareSteps)
  const coveredQuestIds = new Set<number>()
  const selectedAlternatives = new Map<string, string>()
  const steps: StrategyRouteStep[] = []
  const alternatives: StrategyRouteStep[] = []

  for (const candidate of eligible) {
    const alternative = candidate.prerequisiteAlternative
    if (
      alternative &&
      selectedAlternatives.has(alternative.groupId) &&
      selectedAlternatives.get(alternative.groupId) !== alternative.optionId
    ) {
      alternatives.push(candidate)
      continue
    }
    const addsCoverage = candidate.coveredQuestIds.some((questId) => !coveredQuestIds.has(questId))
    if (!addsCoverage || steps.length >= input.preferences.maximumRoutes) {
      alternatives.push(candidate)
      continue
    }
    steps.push(candidate)
    candidate.coveredQuestIds.forEach((questId) => coveredQuestIds.add(questId))
    if (alternative) {
      selectedAlternatives.set(alternative.groupId, alternative.optionId)
    }
  }

  const selectedQuestIds = [...snapshot.selectedQuestIds].sort((a, b) => a - b)
  const uncoveredQuestIds = selectedQuestIds.filter((questId) => !coveredQuestIds.has(questId))
  const warnings = [
    ...(uncoveredQuestIds.length > 0
      ? [`${uncoveredQuestIds.length} 件の選択任務に利用可能な攻略手順がありません`]
      : []),
    ...new Set(steps.flatMap((step) => step.warnings))
  ]
  const fingerprintInput = {
    knowledgeVersion: input.knowledgeVersion,
    generatedAt: input.generatedAt,
    recipes: recipes.map((recipe) => `${recipe.id}@${recipe.revision}`),
    snapshot,
    preferences: input.preferences
  }

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    knowledgeVersion: input.knowledgeVersion,
    inputFingerprint: `fnv1a32:${fnv1a32(JSON.stringify(stableValue(fingerprintInput)))}`,
    selectedQuestIds,
    coveredQuestIds: [...coveredQuestIds].sort((a, b) => a - b),
    uncoveredQuestIds,
    steps,
    alternatives,
    blocked,
    warnings
  }
}

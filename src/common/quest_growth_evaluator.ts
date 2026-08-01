export type QuestGrowthFreshness = 'fresh' | 'stale' | 'unknown' | 'unavailable'

type SafetyState = 'clear' | 'blocked' | 'unknown'
type ConstraintState = 'pass' | 'blocked' | 'unknown'

interface BaseInput {
  freshness: QuestGrowthFreshness
}

export type QuestGrowthFallbackInput =
  | (BaseInput & {
      observableId: 'modernization.material-summary'
      visibleUnlockedShipCount: number
    })
  | (BaseInput & {
      observableId: 'fleet.safety-state'
      damage: SafetyState
      supply: SafetyState
      repair: SafetyState
    })
  | (BaseInput & {
      observableId: 'quest.visible-chain'
      visibleUnlockQuestCount: number
      viewCoverage: 'live-all-tabs' | 'live-partial-tabs' | 'cached-session' | 'unknown'
      graphCoverage: 'reviewed-complete' | 'reviewed-partial' | 'unresolved'
    })
  | (BaseInput & {
      observableId: 'resources.bands'
      totalsAvailable: boolean
      posture: 'conserve' | 'balanced' | 'spend' | 'unset'
    })
  | (BaseInput & {
      observableId: 'ships.asw-capable-summary'
      sonarCount: number
      depthChargeCount: number
      targetSelected: boolean
      reviewedTargetRule: boolean
      intendedFleetConfirmed: boolean
    })
  | (BaseInput & {
      observableId: 'capability.surface-air-los-gaps'
      airEquipmentCount: number
      losEquipmentCount: number
      targetSelected: boolean
      routeVariantSelected: boolean
      reviewedTargetRule: boolean
      versionedFormulaAvailable: boolean
    })
  | (BaseInput & {
      observableId: 'maps.eo-affordability'
      unlockedEoCount: number
      targetSelected: boolean
      reviewedRouteKnowledge: boolean
      safety: ConstraintState
      resources: ConstraintState
      capability: ConstraintState
      time: ConstraintState
    })
  | (BaseInput & {
      observableId: 'capability.breadth-summary'
      eventGoalSelected: boolean
      categorySelected: boolean
    })
  | (BaseInput & {
      observableId: 'practice.available-count'
    })
  | (BaseInput & {
      observableId: 'event.overlay-status'
      overlayStatus: 'unavailable' | 'expired' | 'unreviewed' | 'malformed'
    })

export type QuestGrowthFallbackOutcome =
  | {
      kind: 'manual-check'
      observableId: QuestGrowthFallbackInput['observableId']
      checks: readonly string[]
      blockers: readonly string[]
      contractRefs: readonly string[]
    }
  | {
      kind: 'data-acquisition'
      observableId: QuestGrowthFallbackInput['observableId']
      steps: readonly string[]
      blockers: readonly string[]
      contractRefs: readonly string[]
    }

interface ObservableContract {
  rubricRef?: string
  acquisitionStep: string
}

const NoRouteBlocker = 'ROUTE_OUTPUT_PROHIBITED_IN_PURE_EVALUATOR'

const ObservableContracts: Record<QuestGrowthFallbackInput['observableId'], ObservableContract> = {
  'modernization.material-summary': {
    rubricRef: 'rubric:modernization-material-safety@1',
    acquisitionStep: 'OPEN_SHIP_AND_MODERNIZATION_VIEWS'
  },
  'fleet.safety-state': {
    rubricRef: 'rubric:fleet-safety-gate@1',
    acquisitionStep: 'REFRESH_DAMAGE_SUPPLY_AND_REPAIR_STATE'
  },
  'quest.visible-chain': {
    rubricRef: 'rubric:visible-quest-chain@2',
    acquisitionStep: 'OPEN_ALL_RELEVANT_QUEST_TABS_AND_REFRESH'
  },
  'resources.bands': {
    rubricRef: 'rubric:resource-posture@2',
    acquisitionStep: 'OPEN_OR_REFRESH_LOCAL_RESOURCE_VIEW'
  },
  'ships.asw-capable-summary': {
    rubricRef: 'rubric:asw-capability-facts@2',
    acquisitionStep: 'SELECT_TARGET_AND_INSPECT_INTENDED_FLEET'
  },
  'capability.surface-air-los-gaps': {
    rubricRef: 'rubric:surface-air-los-gaps@2',
    acquisitionStep: 'SELECT_TARGET_CONTEXT_AND_REVIEWED_FORMULA'
  },
  'maps.eo-affordability': {
    rubricRef: 'rubric:eo-affordability@2',
    acquisitionStep: 'OPEN_MAP_VIEW_AND_RESOLVE_EO_CONSTRAINTS'
  },
  'capability.breadth-summary': {
    rubricRef: 'rubric:evergreen-breadth@2',
    acquisitionStep: 'REFRESH_EVERGREEN_CAPABILITY_FACTS'
  },
  'practice.available-count': {
    acquisitionStep: 'OPEN_PRACTICE_SCREEN_AND_CHECK_AVAILABILITY'
  },
  'event.overlay-status': {
    acquisitionStep: 'WAIT_FOR_REVIEWED_VERSIONED_EVENT_OVERLAY'
  }
}

function contractRefs(observableId: QuestGrowthFallbackInput['observableId']): string[] {
  const contract = ObservableContracts[observableId]
  return [
    `observable:${observableId}`,
    ...(contract.rubricRef ? [contract.rubricRef] : []),
    'stage:pure-fallback-evaluator'
  ]
}

function manualCheck(
  observableId: QuestGrowthFallbackInput['observableId'],
  checks: string[],
  blockers: string[] = []
): QuestGrowthFallbackOutcome {
  return {
    kind: 'manual-check',
    observableId,
    checks,
    blockers: [NoRouteBlocker, ...blockers],
    contractRefs: contractRefs(observableId)
  }
}

function dataAcquisition(
  observableId: QuestGrowthFallbackInput['observableId'],
  steps: string[],
  blockers: string[]
): QuestGrowthFallbackOutcome {
  return {
    kind: 'data-acquisition',
    observableId,
    steps,
    blockers: [NoRouteBlocker, ...blockers],
    contractRefs: contractRefs(observableId)
  }
}

function assertEnum(value: string, allowed: readonly string[], field: string): void {
  if (!allowed.includes(value)) throw new Error(`Invalid quest growth fallback input: ${field}`)
}

function assertCount(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid quest growth fallback input: ${field}`)
  }
}

function assertBoolean(value: boolean, field: string): void {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid quest growth fallback input: ${field}`)
  }
}

function validateInput(input: QuestGrowthFallbackInput): void {
  assertEnum(input.observableId, Object.keys(ObservableContracts), 'observableId')
  assertEnum(input.freshness, ['fresh', 'stale', 'unknown', 'unavailable'], 'freshness')
  switch (input.observableId) {
    case 'modernization.material-summary':
      assertCount(input.visibleUnlockedShipCount, 'visibleUnlockedShipCount')
      return
    case 'fleet.safety-state':
      assertEnum(input.damage, ['clear', 'blocked', 'unknown'], 'damage')
      assertEnum(input.supply, ['clear', 'blocked', 'unknown'], 'supply')
      assertEnum(input.repair, ['clear', 'blocked', 'unknown'], 'repair')
      return
    case 'quest.visible-chain':
      assertCount(input.visibleUnlockQuestCount, 'visibleUnlockQuestCount')
      assertEnum(
        input.viewCoverage,
        ['live-all-tabs', 'live-partial-tabs', 'cached-session', 'unknown'],
        'viewCoverage'
      )
      assertEnum(
        input.graphCoverage,
        ['reviewed-complete', 'reviewed-partial', 'unresolved'],
        'graphCoverage'
      )
      return
    case 'resources.bands':
      assertBoolean(input.totalsAvailable, 'totalsAvailable')
      assertEnum(input.posture, ['conserve', 'balanced', 'spend', 'unset'], 'posture')
      return
    case 'ships.asw-capable-summary':
      assertCount(input.sonarCount, 'sonarCount')
      assertCount(input.depthChargeCount, 'depthChargeCount')
      assertBoolean(input.targetSelected, 'targetSelected')
      assertBoolean(input.reviewedTargetRule, 'reviewedTargetRule')
      assertBoolean(input.intendedFleetConfirmed, 'intendedFleetConfirmed')
      return
    case 'capability.surface-air-los-gaps':
      assertCount(input.airEquipmentCount, 'airEquipmentCount')
      assertCount(input.losEquipmentCount, 'losEquipmentCount')
      assertBoolean(input.targetSelected, 'targetSelected')
      assertBoolean(input.routeVariantSelected, 'routeVariantSelected')
      assertBoolean(input.reviewedTargetRule, 'reviewedTargetRule')
      assertBoolean(input.versionedFormulaAvailable, 'versionedFormulaAvailable')
      return
    case 'maps.eo-affordability':
      assertCount(input.unlockedEoCount, 'unlockedEoCount')
      assertBoolean(input.targetSelected, 'targetSelected')
      assertBoolean(input.reviewedRouteKnowledge, 'reviewedRouteKnowledge')
      assertEnum(input.safety, ['pass', 'blocked', 'unknown'], 'safety')
      assertEnum(input.resources, ['pass', 'blocked', 'unknown'], 'resources')
      assertEnum(input.capability, ['pass', 'blocked', 'unknown'], 'capability')
      assertEnum(input.time, ['pass', 'blocked', 'unknown'], 'time')
      return
    case 'capability.breadth-summary':
      assertBoolean(input.eventGoalSelected, 'eventGoalSelected')
      assertBoolean(input.categorySelected, 'categorySelected')
      return
    case 'practice.available-count':
      return
    case 'event.overlay-status':
      assertEnum(
        input.overlayStatus,
        ['unavailable', 'expired', 'unreviewed', 'malformed'],
        'overlayStatus'
      )
  }
}

function staleOrUnknown(input: QuestGrowthFallbackInput): QuestGrowthFallbackOutcome | undefined {
  if (input.freshness === 'fresh') return undefined
  return dataAcquisition(
    input.observableId,
    [ObservableContracts[input.observableId].acquisitionStep],
    [`INPUT_${input.freshness.toUpperCase()}`]
  )
}

/**
 * Evaluates approved fallback semantics only. This function deliberately has no
 * executable-suggestion or route result variant and performs no I/O.
 */
export function evaluateQuestGrowthFallback(
  input: QuestGrowthFallbackInput
): QuestGrowthFallbackOutcome {
  validateInput(input)
  const freshnessFallback = staleOrUnknown(input)
  if (freshnessFallback) return freshnessFallback

  switch (input.observableId) {
    case 'modernization.material-summary':
      assertCount(input.visibleUnlockedShipCount, 'visibleUnlockedShipCount')
      return manualCheck(
        input.observableId,
        ['CONFIRM_EACH_MATERIAL_SHIP_IS_NOT_RARE_UNIQUE_QUEST_REQUIRED_OR_RETAINED'],
        ['MATERIAL_SAFETY_REQUIRES_USER_CONFIRMATION']
      )

    case 'fleet.safety-state': {
      assertEnum(input.damage, ['clear', 'blocked', 'unknown'], 'damage')
      assertEnum(input.supply, ['clear', 'blocked', 'unknown'], 'supply')
      assertEnum(input.repair, ['clear', 'blocked', 'unknown'], 'repair')
      const entries = [
        ['DAMAGE', input.damage],
        ['SUPPLY', input.supply],
        ['REPAIR', input.repair]
      ] as const
      const unknown = entries.filter(([, state]) => state === 'unknown').map(([name]) => name)
      if (unknown.length > 0) {
        return dataAcquisition(
          input.observableId,
          ['REFRESH_DAMAGE_SUPPLY_AND_REPAIR_STATE'],
          unknown.map((name) => `${name}_STATE_UNKNOWN`)
        )
      }
      const blocked = entries.filter(([, state]) => state === 'blocked').map(([name]) => name)
      return manualCheck(
        input.observableId,
        ['REVIEW_DAMAGE_SUPPLY_AND_REPAIR_FACTS_SEPARATELY'],
        blocked.map((name) => `${name}_STATE_BLOCKED`)
      )
    }

    case 'quest.visible-chain':
      assertCount(input.visibleUnlockQuestCount, 'visibleUnlockQuestCount')
      assertEnum(
        input.viewCoverage,
        ['live-all-tabs', 'live-partial-tabs', 'cached-session', 'unknown'],
        'viewCoverage'
      )
      assertEnum(
        input.graphCoverage,
        ['reviewed-complete', 'reviewed-partial', 'unresolved'],
        'graphCoverage'
      )
      if (input.viewCoverage !== 'live-all-tabs' || input.graphCoverage !== 'reviewed-complete') {
        return dataAcquisition(
          input.observableId,
          ['OPEN_ALL_RELEVANT_QUEST_TABS_AND_REFRESH'],
          [
            `VIEW_COVERAGE_${input.viewCoverage.toUpperCase().replaceAll('-', '_')}`,
            `GRAPH_COVERAGE_${input.graphCoverage.toUpperCase().replaceAll('-', '_')}`
          ]
        )
      }
      return manualCheck(input.observableId, ['REVIEW_VISIBLE_UNLOCK_QUESTS_AS_CURRENT_VIEW_ONLY'])

    case 'resources.bands':
      assertEnum(input.posture, ['conserve', 'balanced', 'spend', 'unset'], 'posture')
      if (!input.totalsAvailable || input.posture === 'unset') {
        return dataAcquisition(
          input.observableId,
          ['OPEN_OR_REFRESH_LOCAL_RESOURCE_VIEW', 'SELECT_RESOURCE_POSTURE'],
          [
            ...(!input.totalsAvailable ? ['RESOURCE_TOTALS_UNAVAILABLE'] : []),
            ...(input.posture === 'unset' ? ['RESOURCE_POSTURE_UNSET'] : [])
          ]
        )
      }
      return manualCheck(
        input.observableId,
        ['REVIEW_MEASURED_TOTALS_AND_USER_POSTURE_SEPARATELY'],
        ['RESOURCE_POSTURE_DOES_NOT_PROVE_AFFORDABILITY']
      )

    case 'ships.asw-capable-summary':
      assertCount(input.sonarCount, 'sonarCount')
      assertCount(input.depthChargeCount, 'depthChargeCount')
      if (!input.reviewedTargetRule) {
        return dataAcquisition(
          input.observableId,
          ['SELECT_TARGET_AND_OBTAIN_REVIEWED_TARGET_RULE'],
          ['REVIEWED_TARGET_RULE_UNAVAILABLE']
        )
      }
      return manualCheck(
        input.observableId,
        [
          ...(!input.targetSelected ? ['SELECT_TARGET_MAP_OR_MECHANIC'] : []),
          ...(!input.intendedFleetConfirmed ? ['INSPECT_AND_CONFIRM_INTENDED_FLEET'] : []),
          'REVIEW_ASW_CATEGORY_FACTS_WITHOUT_READINESS_VERDICT'
        ],
        [
          ...(!input.targetSelected ? ['TARGET_NOT_SELECTED'] : []),
          ...(!input.intendedFleetConfirmed ? ['INTENDED_FLEET_NOT_CONFIRMED'] : [])
        ]
      )

    case 'capability.surface-air-los-gaps':
      assertCount(input.airEquipmentCount, 'airEquipmentCount')
      assertCount(input.losEquipmentCount, 'losEquipmentCount')
      if (!input.reviewedTargetRule || !input.versionedFormulaAvailable) {
        return dataAcquisition(
          input.observableId,
          ['SELECT_TARGET_CONTEXT_AND_OBTAIN_REVIEWED_VERSIONED_RULE'],
          [
            ...(!input.reviewedTargetRule ? ['REVIEWED_TARGET_RULE_UNAVAILABLE'] : []),
            ...(!input.versionedFormulaAvailable ? ['VERSIONED_FORMULA_UNAVAILABLE'] : [])
          ]
        )
      }
      return manualCheck(
        input.observableId,
        [
          ...(!input.targetSelected ? ['SELECT_TARGET_MAP'] : []),
          ...(!input.routeVariantSelected ? ['SELECT_ROUTE_VARIANT_CONTEXT'] : []),
          'REVIEW_CATEGORY_FACTS_SEPARATELY_FROM_TARGET_CALCULATION'
        ],
        [
          ...(!input.targetSelected ? ['TARGET_NOT_SELECTED'] : []),
          ...(!input.routeVariantSelected ? ['ROUTE_VARIANT_CONTEXT_NOT_SELECTED'] : [])
        ]
      )

    case 'maps.eo-affordability': {
      assertCount(input.unlockedEoCount, 'unlockedEoCount')
      const constraints = [
        ['SAFETY', input.safety],
        ['RESOURCES', input.resources],
        ['CAPABILITY', input.capability],
        ['TIME', input.time]
      ] as const
      for (const [name, state] of constraints) {
        assertEnum(state, ['pass', 'blocked', 'unknown'], name.toLowerCase())
      }
      if (!input.reviewedRouteKnowledge || constraints.some(([, state]) => state === 'unknown')) {
        return dataAcquisition(
          input.observableId,
          ['RESOLVE_EO_SAFETY_RESOURCE_CAPABILITY_ROUTE_AND_TIME_CHECKS'],
          [
            ...(!input.reviewedRouteKnowledge ? ['REVIEWED_ROUTE_KNOWLEDGE_UNAVAILABLE'] : []),
            ...constraints
              .filter(([, state]) => state === 'unknown')
              .map(([name]) => `${name}_CONSTRAINT_UNKNOWN`)
          ]
        )
      }
      return manualCheck(
        input.observableId,
        [
          ...(!input.targetSelected ? ['SELECT_ONE_OPTIONAL_EO_TARGET'] : []),
          'REVIEW_EO_CONSTRAINTS_WITHOUT_AFFORDABILITY_OR_ROUTE_VERDICT'
        ],
        [
          ...(!input.targetSelected ? ['EO_TARGET_NOT_SELECTED'] : []),
          ...constraints
            .filter(([, state]) => state === 'blocked')
            .map(([name]) => `${name}_CONSTRAINT_BLOCKED`)
        ]
      )
    }

    case 'capability.breadth-summary':
      return manualCheck(
        input.observableId,
        [
          ...(!input.categorySelected ? ['SELECT_ONE_EVERGREEN_CAPABILITY_CATEGORY'] : []),
          'REVIEW_EVERGREEN_COVERAGE_WITHOUT_EVENT_READINESS_VERDICT'
        ],
        input.eventGoalSelected ? ['EVENT_GUIDANCE_REQUIRES_REVIEWED_OVERLAY'] : []
      )

    case 'practice.available-count':
      return dataAcquisition(
        input.observableId,
        ['OPEN_PRACTICE_SCREEN_AND_CHECK_AVAILABILITY'],
        ['OBSERVABLE_UNAVAILABLE']
      )

    case 'event.overlay-status':
      assertEnum(
        input.overlayStatus,
        ['unavailable', 'expired', 'unreviewed', 'malformed'],
        'overlayStatus'
      )
      return dataAcquisition(
        input.observableId,
        ['RETURN_TO_EVERGREEN_PREPARATION'],
        [`EVENT_OVERLAY_${input.overlayStatus.toUpperCase()}`]
      )
  }
}

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  evaluateQuestGrowthFallback,
  type QuestGrowthFallbackInput,
  type QuestGrowthFallbackOutcome
} from '../quest_growth_evaluator'

const Gate = 'ROUTE_OUTPUT_PROHIBITED_IN_PURE_EVALUATOR'

function expectFallbackOnly(outcome: QuestGrowthFallbackOutcome): void {
  expect(['manual-check', 'data-acquisition']).toContain(outcome.kind)
  expect(outcome.blockers).toContain(Gate)
  expect(outcome.blockers.length).toBeGreaterThan(0)
  expect(outcome.contractRefs).toContain('stage:pure-fallback-evaluator')
  expect(outcome.contractRefs.some((item) => item.startsWith('observable:'))).toBe(true)
  expect(Object.keys(outcome)).not.toContain('routeId')
  expect(Object.keys(outcome)).not.toContain('routeSteps')
  expect(Object.keys(outcome)).not.toContain('executable')
  if (outcome.kind === 'manual-check') expect(outcome.checks.length).toBeGreaterThan(0)
  else expect(outcome.steps.length).toBeGreaterThan(0)
}

const FreshInputs: QuestGrowthFallbackInput[] = [
  {
    observableId: 'modernization.material-summary',
    freshness: 'fresh',
    visibleUnlockedShipCount: 3
  },
  {
    observableId: 'ships.level-bands',
    freshness: 'fresh',
    level1To19Count: 4,
    level20To49Count: 8,
    level50PlusCount: 12
  },
  {
    observableId: 'ships.remodel-ready',
    freshness: 'fresh',
    levelReadyShipCount: 2,
    specialMaterialReadiness: 'unknown'
  },
  {
    observableId: 'modernization.gaps',
    freshness: 'fresh',
    normalStatGapShipCount: 9,
    normalStatMaxedShipCount: 15
  },
  {
    observableId: 'fleet.safety-state',
    freshness: 'fresh',
    damage: 'clear',
    supply: 'clear',
    repair: 'clear'
  },
  {
    observableId: 'quest.visible-chain',
    freshness: 'fresh',
    visibleUnlockQuestCount: 2,
    unlockedFleetCount: 3,
    visibleFleetUnlockQuestCount: 1,
    viewCoverage: 'live-all-tabs',
    graphCoverage: 'reviewed-complete'
  },
  {
    observableId: 'resources.bands',
    freshness: 'fresh',
    totals: { fuel: 1000, ammunition: 1000, steel: 1000, bauxite: 1000, repairBuckets: 10 },
    posture: 'balanced'
  },
  {
    observableId: 'ships.asw-capable-summary',
    freshness: 'fresh',
    sonarCount: 1,
    depthChargeCount: 1,
    targetSelected: true,
    reviewedTargetRule: true,
    intendedFleetConfirmed: true
  },
  {
    observableId: 'capability.surface-air-los-gaps',
    freshness: 'fresh',
    airEquipmentCount: 1,
    losEquipmentCount: 1,
    targetSelected: true,
    routeVariantSelected: true,
    reviewedTargetRule: true,
    versionedFormulaAvailable: true
  },
  {
    observableId: 'maps.eo-affordability',
    freshness: 'fresh',
    unlockedEoCount: 1,
    targetSelected: true,
    reviewedRouteKnowledge: true,
    safety: 'pass',
    resources: 'pass',
    capability: 'pass',
    time: 'pass'
  },
  {
    observableId: 'capability.breadth-summary',
    freshness: 'fresh',
    ownedShipCount: 24,
    shipTypeCount: 8,
    minimumLevel: 1,
    maximumLevel: 55,
    equipmentCategoryCount: 12,
    resourceTotalsAvailable: true,
    eventGoalSelected: false,
    categorySelected: true
  },
  {
    observableId: 'practice.available-count',
    freshness: 'fresh'
  },
  {
    observableId: 'event.overlay-status',
    freshness: 'fresh',
    overlayStatus: 'unavailable'
  }
]

describe('quest growth pure fallback evaluator', () => {
  it('is deterministic and exposes no executable or route result variant', () => {
    for (const input of FreshInputs) {
      const first = evaluateQuestGrowthFallback(input)
      const second = evaluateQuestGrowthFallback(structuredClone(input))
      expect(second).toEqual(first)
      expectFallbackOnly(first)
    }
  })

  it.each(['stale', 'unknown', 'unavailable'] as const)(
    'turns %s state into a non-empty data-acquisition result',
    (freshness) => {
      const outcome = evaluateQuestGrowthFallback({
        observableId: 'resources.bands',
        freshness,
        totals: {
          fuel: 1000,
          ammunition: 1000,
          steel: 1000,
          bauxite: 1000,
          repairBuckets: 10
        },
        posture: 'spend'
      })

      expect(outcome.kind).toBe('data-acquisition')
      expectFallbackOnly(outcome)
      expect(outcome.blockers).toContain(`INPUT_${freshness.toUpperCase()}`)
    }
  )

  it('keeps partial and cached quest views unknown instead of inferring completion', () => {
    for (const viewCoverage of ['live-partial-tabs', 'cached-session'] as const) {
      const outcome = evaluateQuestGrowthFallback({
        observableId: 'quest.visible-chain',
        freshness: 'fresh',
        visibleUnlockQuestCount: 0,
        unlockedFleetCount: 2,
        visibleFleetUnlockQuestCount: 0,
        viewCoverage,
        graphCoverage: 'reviewed-complete'
      })

      expect(outcome.kind).toBe('data-acquisition')
      expectFallbackOnly(outcome)
      expect(outcome.blockers).toContain(
        `VIEW_COVERAGE_${viewCoverage.toUpperCase().replaceAll('-', '_')}`
      )
    }
  })

  it('does not let resource posture alter safety or route eligibility', () => {
    const outcomes = (['conserve', 'balanced', 'spend'] as const).map((posture) =>
      evaluateQuestGrowthFallback({
        observableId: 'resources.bands',
        freshness: 'fresh',
        totals: {
          fuel: 1000,
          ammunition: 1000,
          steel: 1000,
          bauxite: 1000,
          repairBuckets: 10
        },
        posture
      })
    )

    expect(outcomes.every((outcome) => outcome.kind === 'manual-check')).toBe(true)
    for (const outcome of outcomes) {
      expectFallbackOnly(outcome)
      expect(outcome.blockers).toContain('RESOURCE_POSTURE_DOES_NOT_PROVE_AFFORDABILITY')
    }
  })

  it('keeps EO facts optional when route knowledge or current constraints are missing', () => {
    const outcome = evaluateQuestGrowthFallback({
      observableId: 'maps.eo-affordability',
      freshness: 'fresh',
      unlockedEoCount: 4,
      targetSelected: true,
      reviewedRouteKnowledge: false,
      safety: 'pass',
      resources: 'unknown',
      capability: 'pass',
      time: 'pass'
    })

    expect(outcome.kind).toBe('data-acquisition')
    expectFallbackOnly(outcome)
    expect(outcome.blockers).toContain('REVIEWED_ROUTE_KNOWLEDGE_UNAVAILABLE')
    expect(outcome.blockers).toContain('RESOURCES_CONSTRAINT_UNKNOWN')
  })

  it('never converts an unavailable practice or event observable into advice', () => {
    const practice = evaluateQuestGrowthFallback({
      observableId: 'practice.available-count',
      freshness: 'unavailable'
    })
    const event = evaluateQuestGrowthFallback({
      observableId: 'event.overlay-status',
      freshness: 'fresh',
      overlayStatus: 'expired'
    })

    expect(practice.kind).toBe('data-acquisition')
    expect(event.kind).toBe('data-acquisition')
    expectFallbackOnly(practice)
    expectFallbackOnly(event)
    expect(event.blockers).toContain('EVENT_OVERLAY_EXPIRED')
  })

  it('rejects invalid numeric and enum input at the evaluator boundary', () => {
    expect(() =>
      evaluateQuestGrowthFallback({
        observableId: 'ships.asw-capable-summary',
        freshness: 'fresh',
        sonarCount: -1,
        depthChargeCount: 1,
        targetSelected: false,
        reviewedTargetRule: false,
        intendedFleetConfirmed: false
      })
    ).toThrow('Invalid quest growth fallback input: sonarCount')

    expect(() =>
      evaluateQuestGrowthFallback({
        observableId: 'fleet.safety-state',
        freshness: 'fresh',
        damage: 'healthy' as never,
        supply: 'clear',
        repair: 'clear'
      })
    ).toThrow('Invalid quest growth fallback input: damage')

    expect(() =>
      evaluateQuestGrowthFallback({
        observableId: 'modernization.material-summary',
        freshness: 'stale',
        visibleUnlockedShipCount: Number.NaN
      })
    ).toThrow('Invalid quest growth fallback input: visibleUnlockedShipCount')

    expect(() =>
      evaluateQuestGrowthFallback({
        observableId: 'unknown.observable',
        freshness: 'fresh'
      } as never)
    ).toThrow('Invalid quest growth fallback input: observableId')

    expect(() =>
      evaluateQuestGrowthFallback({
        observableId: 'resources.bands',
        freshness: 'fresh',
        totals: {
          fuel: 1000,
          ammunition: 1000,
          steel: 1000,
          bauxite: 1000,
          repairBuckets: -1
        },
        posture: 'conserve'
      })
    ).toThrow('Invalid quest growth fallback input: totals.repairBuckets')

    expect(() =>
      evaluateQuestGrowthFallback({
        observableId: 'capability.breadth-summary',
        freshness: 'fresh',
        ownedShipCount: 10,
        shipTypeCount: 4,
        minimumLevel: 99,
        maximumLevel: 1,
        equipmentCategoryCount: 6,
        resourceTotalsAvailable: true,
        eventGoalSelected: false,
        categorySelected: true
      })
    ).toThrow('Invalid quest growth fallback input: levelRange')
  })

  it('has no I/O or renderer dependency in the pure evaluator source', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'common', 'quest_growth_evaluator.ts'),
      'utf8'
    )

    expect(source).not.toMatch(/^import /m)
    expect(source).not.toContain('node:fs')
    expect(source).not.toContain('electron')
    expect(source).not.toContain('src/renderer')
    expect(source).not.toContain('queryDb')
    expect(source).not.toContain('SvData')
  })
})

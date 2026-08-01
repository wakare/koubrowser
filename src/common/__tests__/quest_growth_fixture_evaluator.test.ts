import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  evaluateQuestGrowthFallback,
  type QuestGrowthFallbackInput,
  type QuestGrowthFallbackOutcome
} from '../quest_growth_evaluator'

interface GrowthFixture {
  schemaVersion: 2
  fixtureId: string
  observables: Record<string, Record<string, unknown>>
  privacy: {
    containsAccountIdentifier: boolean
    containsRawPayload: boolean
  }
  expectations: {
    nonEmptyFallbackRequired: true
    expectedOutcomeKinds: Record<string, QuestGrowthFallbackOutcome['kind']>
  }
}

const FixtureDirectory = path.resolve(process.cwd(), 'knowledge', 'quest-growth', 'fixtures')

function readFixtures(): GrowthFixture[] {
  return fs
    .readdirSync(FixtureDirectory)
    .filter((filename) => filename.endsWith('.json'))
    .sort()
    .map((filename) =>
      JSON.parse(fs.readFileSync(path.join(FixtureDirectory, filename), 'utf8'))
    ) as GrowthFixture[]
}

describe('quest growth synthetic fixture evaluator contract', () => {
  it('drives every approved fallback fixture without route output', () => {
    const fixtures = readFixtures()
    let evaluatedObservableCount = 0

    expect(fixtures).toHaveLength(6)
    for (const fixture of fixtures) {
      expect(fixture.schemaVersion).toBe(2)
      expect(fixture.privacy).toEqual({
        containsAccountIdentifier: false,
        containsRawPayload: false
      })
      expect(fixture.expectations.nonEmptyFallbackRequired).toBe(true)
      expect(Object.keys(fixture.expectations.expectedOutcomeKinds).sort()).toEqual(
        Object.keys(fixture.observables).sort()
      )

      for (const [observableId, value] of Object.entries(fixture.observables)) {
        const outcome = evaluateQuestGrowthFallback({
          observableId,
          ...value
        } as QuestGrowthFallbackInput)
        evaluatedObservableCount += 1

        expect(outcome.kind, `${fixture.fixtureId}:${observableId}`).toBe(
          fixture.expectations.expectedOutcomeKinds[observableId]
        )
        expect(outcome.blockers).toContain('ROUTE_OUTPUT_PROHIBITED_IN_PURE_EVALUATOR')
        expect(Object.keys(outcome)).not.toContain('routeId')
        expect(Object.keys(outcome)).not.toContain('routeSteps')
        expect(Object.keys(outcome)).not.toContain('executable')
        if (outcome.kind === 'manual-check') expect(outcome.checks.length).toBeGreaterThan(0)
        else expect(outcome.steps.length).toBeGreaterThan(0)
      }
    }

    expect(evaluatedObservableCount).toBe(12)
  })

  it('does not preserve the superseded low-band, practice-count, or active-overlay semantics', () => {
    const fixtures = new Map(readFixtures().map((fixture) => [fixture.fixtureId, fixture]))
    const resource = fixtures.get('growth-fixture:resource-conservation-posture')!
    const early = fixtures.get('growth-fixture:early-maps-only')!
    const event = fixtures.get('growth-fixture:event-active-not-ready')!

    expect(JSON.stringify(resource.observables)).not.toMatch(/"(low|normal|high)"/)
    expect(early.observables['practice.available-count']).toEqual({
      freshness: 'unavailable'
    })
    expect(event.observables['event.overlay-status']).toEqual({
      freshness: 'unavailable',
      overlayStatus: 'unavailable'
    })
  })
})

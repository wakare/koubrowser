import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { evaluateCoverageSnapshot, validateAuthoringManifest, validateCoveragePolicy } =
  require('../../../scripts/validate-quest-strategy-authoring.js') as {
    evaluateCoverageSnapshot: (value: unknown) => {
      status: 'PASS' | 'FAIL'
      failures: string[]
    }
    validateAuthoringManifest: (value: unknown) => unknown
    validateCoveragePolicy: (value: unknown) => unknown
  }

const Commit = 'c0ebff002433dc49e0ffade36c3b90ec0b138450'
const Digest = `sha256:${'0'.repeat(64)}`
const ReviewedAt = '2026-07-31T00:00:00.000Z'
const ReviewBy = '2026-10-29T00:00:00.000Z'
const ValidUntil = '2027-07-31T00:00:00.000Z'

function reviewedManifest() {
  const review = {
    author: 'fixture-author',
    approver: 'fixture-approver',
    reviewedAt: ReviewedAt,
    reviewBy: ReviewBy,
    validUntil: ValidUntil,
    evidenceReviewIds: ['fixture:evidence']
  }
  return {
    authoringSchema: 'QuestStrategyAuthoring/2alpha',
    manifestVersion: 'fixture-1',
    sourceSnapshot: {
      repositoryCommit: Commit,
      questCatalogDigest: Digest,
      curatedKnowledgeDigest: Digest
    },
    coveragePolicyId: 'QSTRAT_RECURRING_NORMAL_SORTIE_V1',
    questFacts: [
      {
        factId: 'quest:101:objective',
        questId: 101,
        revision: 1,
        status: 'approved',
        origin: 'canonical-projection',
        lineage: {
          module: 'src/common/kcquest',
          accessor: 'getQuestStuff',
          sourceCommit: Commit,
          projectionDigest: Digest
        },
        classification: 'lossless-v1',
        objectiveStages: [
          {
            mapKey: '1-1',
            result: 'S',
            requiredCount: 1
          }
        ],
        review
      }
    ],
    mapTemplates: [
      {
        templateId: 'normal-map:1-1:fixture',
        revision: 1,
        status: 'approved',
        mapKey: '1-1',
        routeLabels: ['A', 'B'],
        targetNodes: ['B'],
        formations: [{ formationId: 1, label: '単縦陣' }],
        actions: ['対象地点へ出撃する'],
        cost: 'low',
        risk: 'low',
        review
      }
    ],
    composabilityRules: [
      {
        ruleId: 'SAME_ROUTE_SIGNATURE_V1',
        revision: 1,
        status: 'approved',
        conditions: [
          'same-map-key',
          'complete-objective-representable-in-v1',
          'hard-constraint-intersection-satisfiable',
          'no-hard-evidence-conflict'
        ],
        unknownPolicy: 'reject-combination',
        review
      }
    ],
    evidenceReviews: [
      {
        reviewId: 'fixture:evidence',
        status: 'approved',
        sourceUrl: 'https://example.com/reviewed-source',
        sourceLabel: 'テスト用審査資料',
        reviewer: 'fixture-reviewer',
        reviewedAt: ReviewedAt,
        validUntil: ValidUntil,
        confidence: 'verified'
      }
    ],
    withdrawals: []
  }
}

function coverageSnapshot(
  overrides: Partial<{
    visibleNonClaimCount: number
    primaryEligibleVisibleCount: number
    routeReadyCount: number
    fallbackEntryCount: number
    containsAccountIdentifier: boolean
    containsQuestTitle: boolean
    containsRawPayload: boolean
  }> = {}
) {
  return {
    schemaVersion: 1,
    sampleId: 'redacted-local-sample-001',
    visibleNonClaimCount: 105,
    primaryEligibleVisibleCount: 0,
    routeReadyCount: 0,
    fallbackEntryCount: 0,
    containsAccountIdentifier: false,
    containsQuestTitle: false,
    containsRawPayload: false,
    ...overrides
  }
}

describe('quest strategy coverage contract', () => {
  it('validates the checked-in policy and authoring schema', () => {
    const output = execFileSync(
      process.execPath,
      [resolve(process.cwd(), 'scripts/validate-quest-strategy-authoring.js')],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    )

    expect(output).toContain('Quest strategy authoring contract validation passed')
  })

  it('accepts independently reviewed synthetic authoring entries', () => {
    expect(validateAuthoringManifest(reviewedManifest())).toBeTruthy()
  })

  it('rejects self-approved knowledge and permissive unknown-hard-fact handling', () => {
    const selfApproved = reviewedManifest()
    selfApproved.questFacts[0].review.approver = selfApproved.questFacts[0].review.author
    expect(() => validateAuthoringManifest(selfApproved)).toThrow('author and approver must differ')

    const policy = require('../../../knowledge/quest-strategy/coverage-policy.json')
    const permissivePolicy = structuredClone(policy)
    permissivePolicy.compilation.unknownHardFact = 'allow-combination'
    expect(() => validateCoveragePolicy(permissivePolicy)).toThrow(
      'compilation policy must remain deterministic, lossless and bounded'
    )
  })

  it('turns the redacted 105/0 aggregate into a mechanical failure', () => {
    expect(evaluateCoverageSnapshot(coverageSnapshot())).toEqual({
      status: 'FAIL',
      failures: ['FAIL_EMPTY_STRATEGY_WITH_NONEMPTY_SOURCE', 'FAIL_INCOMPLETE_FALLBACK_COVERAGE']
    })
  })

  it('passes when every visible item has an honest fallback entry', () => {
    expect(evaluateCoverageSnapshot(coverageSnapshot({ fallbackEntryCount: 105 }))).toEqual({
      status: 'PASS',
      failures: []
    })
  })

  it('fails a primary-eligible snapshot with no reviewed route', () => {
    expect(
      evaluateCoverageSnapshot(
        coverageSnapshot({
          primaryEligibleVisibleCount: 12,
          fallbackEntryCount: 105
        })
      )
    ).toEqual({
      status: 'FAIL',
      failures: ['FAIL_PRIMARY_DENOMINATOR_ZERO_HIT']
    })
  })

  it('rejects identifying or raw-data coverage fixtures', () => {
    expect(() =>
      evaluateCoverageSnapshot(coverageSnapshot({ containsAccountIdentifier: true }))
    ).toThrow('coverage snapshot contains prohibited identifying or raw data')
  })
})

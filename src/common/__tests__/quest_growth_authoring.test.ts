import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  buildQuestGrowthArtifacts,
  validateEvidenceLedger,
  validateFixture,
  validateMilestoneCatalog
} = require('../../../scripts/compile-quest-growth.js') as {
  buildQuestGrowthArtifacts: (root: string) => Record<string, unknown>
  validateEvidenceLedger: (value: unknown) => {
    value: unknown
    sources: Map<string, unknown>
    claims: Map<string, unknown>
  }
  validateFixture: (value: unknown, filename: string) => string
  validateMilestoneCatalog: (
    value: unknown,
    evidence: ReturnType<typeof validateEvidenceLedger>
  ) => { value: unknown; milestones: Map<string, unknown> }
}

const GrowthDirectory = path.resolve(process.cwd(), 'knowledge', 'quest-growth')

function read<T>(...segments: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(GrowthDirectory, ...segments), 'utf8')) as T
}

describe('quest growth authoring contract', () => {
  it('reproduces the checked-in authoring audit artifacts', () => {
    const output = execFileSync(
      process.execPath,
      [path.resolve(process.cwd(), 'scripts', 'compile-quest-growth.js'), '--check'],
      { cwd: process.cwd(), encoding: 'utf8' }
    )

    expect(output).toContain(
      '14 sources, 9 claims, 8 draft milestones, 6 fixtures, 0 runtime-eligible'
    )
  })

  it('keeps every candidate in draft until independent approval and observability audit', () => {
    const report = read<{
      runtimePromotionStatus: string
      milestoneGaps: { milestoneId: string; reasonCodes: string[] }[]
      globalStops: string[]
    }>('generated', 'conflict-and-gap-report.json')

    expect(report.runtimePromotionStatus).toBe('blocked')
    expect(report.milestoneGaps).toHaveLength(8)
    expect(
      report.milestoneGaps.every((gap) =>
        gap.reasonCodes.includes('MILESTONE_NOT_INDEPENDENTLY_APPROVED')
      )
    ).toBe(true)
    expect(
      report.milestoneGaps.every((gap) =>
        gap.reasonCodes.includes('LOCAL_OBSERVABILITY_NOT_AUDITED')
      )
    ).toBe(true)
    expect(report.globalStops).toContain('NO_RUNTIME_BUNDLE_IN_WAVE_1')
  })

  it('does not count prompt-only NGA observations as independent readable evidence', () => {
    const report = buildQuestGrowthArtifacts(process.cwd())['conflict-and-gap-report.json'] as {
      claimAudits: {
        claimId: string
        readableIndependentSourceIds: string[]
        blockers: string[]
      }[]
    }
    const periodic = report.claimAudits.find(
      (claim) => claim.claimId === 'claim:nga-periodic-map-combinations'
    )!

    expect(periodic.readableIndependentSourceIds).toEqual([])
    expect(periodic.blockers).toContain('CLAIM_NOT_PROMOTION_CANDIDATE')
    expect(periodic.blockers).toContain('CLAIM_LACKS_TWO_INDEPENDENT_READABLE_SOURCES')
  })

  it('requires a non-empty fallback for every milestone candidate', () => {
    const ledger = validateEvidenceLedger(read('authoring', 'evidence-ledger.json'))
    const catalog = validateMilestoneCatalog(read('authoring', 'milestone-candidates.json'), ledger)

    for (const milestone of catalog.milestones.values()) {
      expect(
        (milestone as { guidance: { fallback: string } }).guidance.fallback.trim().length
      ).toBeGreaterThan(0)
    }
  })

  it('rejects self approval and identifying fixture data', () => {
    const ledger = validateEvidenceLedger(read('authoring', 'evidence-ledger.json'))
    const catalog = read<{
      milestones: {
        status: string
        review: { author: string; approver: string | null; reviewedAt: string | null }
      }[]
    }>('authoring', 'milestone-candidates.json')
    const selfApproved = structuredClone(catalog)
    selfApproved.milestones[0].status = 'approved'
    selfApproved.milestones[0].review.approver = selfApproved.milestones[0].review.author
    selfApproved.milestones[0].review.reviewedAt = '2026-08-01T00:00:00.000Z'

    expect(() => validateMilestoneCatalog(selfApproved, ledger)).toThrow(
      'author and approver must differ'
    )

    const unsafeFixture = read<{
      privacy: { containsAccountIdentifier: boolean }
    }>('fixtures', 'unknown-state.json')
    unsafeFixture.privacy.containsAccountIdentifier = true
    expect(() => validateFixture(unsafeFixture, 'unsafe.json')).toThrow(
      'contains prohibited identifying or raw data'
    )
  })
})

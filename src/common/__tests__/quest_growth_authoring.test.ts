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
  validateMilestoneCatalog,
  validateObservabilityAudit,
  validateDecisionRubrics
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
  validateObservabilityAudit: (
    value: unknown,
    root: string
  ) => { value: unknown; observables: Map<string, unknown> }
  validateDecisionRubrics: (
    value: unknown,
    root: string
  ) => { value: unknown; rubrics: Map<string, unknown> }
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
      '14 sources, 9 claims, 8 draft milestones, 6 fixtures, ' +
        '29 observables (19 complete, 8 partial, 2 unavailable), ' +
        '8 draft rubrics, 0 runtime-eligible'
    )
  })

  it('keeps every candidate blocked after the completed audit exposes observability gaps', () => {
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
        gap.reasonCodes.some((reason) => reason.startsWith('OBSERVABLE_'))
      )
    ).toBe(true)
    expect(
      report.milestoneGaps.some((gap) =>
        gap.reasonCodes.includes('LOCAL_OBSERVABILITY_NOT_AUDITED')
      )
    ).toBe(false)
    expect(report.globalStops).toContain('NO_RUNTIME_BUNDLE_IN_WAVE_1')
    expect(report.globalStops).toContain('OBSERVABILITY_GAPS_REMAIN')
    expect(report.globalStops).not.toContain('LOCAL_OBSERVABILITY_AUDIT_REQUIRED')
  })

  it('audits every referenced observable without adding communication hooks or data export', () => {
    const audit = read<{
      policy: {
        newCommunicationHooksAllowed: boolean
        accountDataExportAllowed: boolean
        prohibitedData: string[]
      }
      observables: {
        id: string
        coverage: 'complete' | 'partial' | 'unavailable'
        runtimeUse: 'candidate' | 'fallback-only' | 'blocked'
        unknownFallback: string
      }[]
    }>('authoring', 'observability-map.json')
    const validated = validateObservabilityAudit(audit, process.cwd())
    const catalog = read<{
      milestones: {
        requiredObservables: string[]
        prerequisites: { observable: string }[]
        triggers: { observable: string }[]
      }[]
    }>('authoring', 'milestone-candidates.json')
    const referenced = new Set(
      catalog.milestones.flatMap((milestone) => [
        ...milestone.requiredObservables,
        ...milestone.prerequisites.map((predicate) => predicate.observable),
        ...milestone.triggers.map((predicate) => predicate.observable)
      ])
    )

    expect(validated.observables.size).toBe(29)
    expect(new Set(validated.observables.keys())).toEqual(referenced)
    expect(audit.policy.newCommunicationHooksAllowed).toBe(false)
    expect(audit.policy.accountDataExportAllowed).toBe(false)
    expect(audit.policy.prohibitedData).toEqual(
      expect.arrayContaining(['account-identifier', 'raw-game-payload', 'cookie-or-session'])
    )
    expect(audit.observables.every((observable) => observable.unknownFallback.trim())).toBe(true)

    const practice = audit.observables.find(
      (observable) => observable.id === 'practice.available-count'
    )!
    expect(practice.coverage).toBe('unavailable')
    expect(practice.runtimeUse).toBe('fallback-only')
    const eventOverlay = audit.observables.find(
      (observable) => observable.id === 'event.overlay-status'
    )!
    expect(eventOverlay.coverage).toBe('unavailable')
    expect(eventOverlay.runtimeUse).toBe('blocked')

    const unlockedEo = audit.observables.find((observable) => observable.id === 'maps.unlocked-eo')!
    expect(unlockedEo.coverage).toBe('complete')
    expect(unlockedEo.runtimeUse).toBe('candidate')

    const manifest = read<{
      source: { observabilityAuditedBaseCommit: string; observabilityAuditDigest: string }
    }>('generated', 'source-manifest.json')
    expect(manifest.source.observabilityAuditedBaseCommit).toMatch(/^[0-9a-f]{40}$/)
    expect(manifest.source.observabilityAuditDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('provides one independently reviewable draft rubric for every partial observable', () => {
    const audit = read<{
      observables: { id: string; coverage: string }[]
    }>('authoring', 'observability-map.json')
    const packet = read<{
      rubrics: {
        observableId: string
        status: string
        fallback: string
        acceptanceTests: string[]
        review: { author: string; approver: string | null }
      }[]
    }>('authoring', 'decision-rubrics.json')
    const validated = validateDecisionRubrics(packet, process.cwd())
    const partialIds = new Set(
      audit.observables
        .filter((observable) => observable.coverage === 'partial')
        .map((observable) => observable.id)
    )

    expect(validated.rubrics.size).toBe(8)
    expect(new Set(validated.rubrics.keys())).toEqual(partialIds)
    expect(packet.rubrics.every((rubric) => rubric.status === 'draft')).toBe(true)
    expect(packet.rubrics.every((rubric) => rubric.review.approver === null)).toBe(true)
    expect(packet.rubrics.every((rubric) => rubric.fallback.trim())).toBe(true)
    expect(packet.rubrics.every((rubric) => rubric.acceptanceTests.length >= 2)).toBe(true)

    const report = read<{ globalStops: string[] }>('generated', 'conflict-and-gap-report.json')
    expect(report.globalStops).toContain('DECISION_RUBRICS_NOT_INDEPENDENTLY_APPROVED')
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

  it('rejects an observability audit that permits new hooks or exports account state', () => {
    const audit = read<{
      policy: {
        newCommunicationHooksAllowed: boolean
        accountDataExportAllowed: boolean
      }
    }>('authoring', 'observability-map.json')
    audit.policy.newCommunicationHooksAllowed = true
    expect(() => validateObservabilityAudit(audit, process.cwd())).toThrow(
      'must not allow new communication hooks'
    )

    const exportable = read<{
      policy: { accountDataExportAllowed: boolean }
    }>('authoring', 'observability-map.json')
    exportable.policy.accountDataExportAllowed = true
    expect(() => validateObservabilityAudit(exportable, process.cwd())).toThrow(
      'must not allow account data export'
    )
  })
})

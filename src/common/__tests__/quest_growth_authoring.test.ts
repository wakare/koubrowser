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
const { findForbiddenFields, semanticApprovalDigest, validatePolicy } =
  require('../../../scripts/quest-growth-route-lineage.js') as {
    findForbiddenFields: (value: unknown, forbiddenFields: Set<string>) => string[]
    semanticApprovalDigest: (value: Record<string, unknown>) => string
    validatePolicy: (
      value: Record<string, unknown>,
      expectedCommit: string
    ) => { approvalDigest: string }
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
      '14 sources, 9 claims, 8/8 approved milestones, 6 fixtures, ' +
        '29 observables (19 complete, 8 partial, 2 unavailable), ' +
        '8/8 approved rubrics, 6 route lineages, 6 route units ' +
        '(6 manual-check-only), 0 runtime-eligible'
    )
  })

  it('keeps every candidate blocked after the completed audit exposes observability gaps', () => {
    const manifest = read<{
      output: {
        approvedMilestoneCount: number
        approvedDecisionRubricCount: number
        eligibleForRuntimeCount: number
      }
      runtimePromotion: { status: string; reason: string }
    }>('generated', 'source-manifest.json')
    const report = read<{
      runtimePromotionStatus: string
      milestoneGaps: { milestoneId: string; reasonCodes: string[] }[]
      globalStops: string[]
    }>('generated', 'conflict-and-gap-report.json')

    expect(manifest.output).toMatchObject({
      approvedMilestoneCount: 8,
      approvedDecisionRubricCount: 8,
      eligibleForRuntimeCount: 0
    })
    expect(manifest.runtimePromotion).toEqual({
      status: 'blocked',
      reason: 'R6_AUTHORING_ONLY_R7_NOT_AUTHORIZED'
    })
    expect(report.runtimePromotionStatus).toBe('blocked')
    expect(report.milestoneGaps).toHaveLength(8)
    expect(
      report.milestoneGaps.every(
        (gap) => !gap.reasonCodes.includes('MILESTONE_NOT_INDEPENDENTLY_APPROVED')
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
    expect(report.globalStops).toContain('NO_ROUTE_KNOWLEDGE_RUNTIME_BUNDLE_IN_CONTEXT_UI_STAGE')
    expect(report.globalStops).toContain('OBSERVABILITY_GAPS_REMAIN')
    expect(report.globalStops).toContain('R7_NOT_AUTHORIZED_NO_CONCRETE_ROUTE_OUTPUT')
    expect(report.globalStops).not.toContain('INDEPENDENT_APPROVER_REQUIRED')
    expect(report.globalStops).not.toContain('LOCAL_OBSERVABILITY_AUDIT_REQUIRED')
  })

  it('keeps every R6 route unit non-executable until independent review and R7 approval', () => {
    const manifest = read<{
      output: {
        independenceGroupCount: number
        claimSupportCount: number
        routeLineageCount: number
        routeUnitCount: number
        reviewedRouteUnitCount: number
        manualCheckOnlyCount: number
        r7CandidateCount: number
        runtimeEligibleCount: number
        validationCaseCount: number
      }
      publicationAuthorization: string
    }>('generated', 'route-lineage-manifest.json')
    const report = read<{
      policyStatus: string
      publicationAuthorization: string
      routeUnitAudits: {
        contentDecision: string
        effectiveState: string
        reasonCodes: string[]
        fallback: string
      }[]
    }>('generated', 'route-eligibility-report.json')
    const matrix = read<{ passed: boolean; cases: { passed: boolean }[] }>(
      'generated',
      'route-validation-matrix.json'
    )

    expect(manifest.output).toEqual({
      independenceGroupCount: 5,
      claimSupportCount: 16,
      routeLineageCount: 6,
      routeUnitCount: 6,
      reviewedRouteUnitCount: 0,
      manualCheckOnlyCount: 6,
      r7CandidateCount: 0,
      runtimeEligibleCount: 0,
      validationCaseCount: 8
    })
    expect(manifest.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(report.policyStatus).toBe('draft')
    expect(report.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(report.routeUnitAudits).toHaveLength(6)
    expect(
      report.routeUnitAudits.every(
        (audit) =>
          audit.contentDecision === 'MANUAL_CHECK_ONLY' &&
          audit.effectiveState === 'BLOCKED' &&
          audit.reasonCodes.includes('R7_AUTHORIZATION_MISSING') &&
          audit.fallback.trim().length > 0
      )
    ).toBe(true)
    expect(matrix.passed).toBe(true)
    expect(matrix.cases).toHaveLength(8)
    expect(matrix.cases.every((item) => item.passed)).toBe(true)
  })

  it('rejects concrete route fields from the R6 authoring surface', () => {
    const policy = read<{ forbiddenFields: string[] }>('authoring', 'route-eligibility-policy.json')
    const units = read<{ units: unknown[] }>('authoring', 'route-units.json')
    const forbidden = new Set(policy.forbiddenFields)

    expect(findForbiddenFields(units.units, forbidden)).toEqual([])
    expect(findForbiddenFields([{ objective: 'invalid', mapKey: '1-5' }], forbidden)).toEqual([
      '$[0].mapKey'
    ])
  })

  it('generates a digest-bound R6 approval packet without authorizing R7', () => {
    const packet = read<{
      status: string
      scope: string
      publicationAuthorization: string
      evidenceLineageDigest: string
      policy: { currentStatus: string; semanticDigest: string }
      lineages: { currentStatus: string; semanticDigest: string }[]
      routeUnits: { currentStatus: string; semanticDigest: string }[]
      approvalRequirements: {
        requiredApprover: string
        authorApproverMustDiffer: boolean
        exactDigestMatchRequired: boolean
        r7AuthorizationIncluded: boolean
        runtimePublicationIncluded: boolean
        realAccountAcceptanceIncluded: boolean
      }
    }>('generated', 'route-approval-packet.json')

    expect(packet.status).toBe('AWAITING_PROJECT_OWNER_REVIEW')
    expect(packet.scope).toBe('R6_AUTHORING_REVIEW_ONLY')
    expect(packet.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(packet.evidenceLineageDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(packet.policy.currentStatus).toBe('draft')
    expect(packet.policy.semanticDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(packet.lineages).toHaveLength(6)
    expect(packet.routeUnits).toHaveLength(6)
    expect(packet.lineages.every((item) => item.currentStatus === 'draft')).toBe(true)
    expect(packet.routeUnits.every((item) => item.currentStatus === 'draft')).toBe(true)
    expect(packet.approvalRequirements).toEqual({
      requiredApprover: 'project-owner',
      authorApproverMustDiffer: true,
      exactDigestMatchRequired: true,
      r7AuthorizationIncluded: false,
      runtimePublicationIncluded: false,
      realAccountAcceptanceIncluded: false
    })
  })

  it('binds approval to semantic content while excluding approval metadata', () => {
    const policy = read<Record<string, unknown>>('authoring', 'route-eligibility-policy.json')
    const baselineDigest = semanticApprovalDigest(policy)
    const approved = structuredClone(policy) as Record<string, unknown> & {
      status: string
      sourceSnapshot: { auditedBaseCommit: string }
      review: {
        author: string
        approver: string | null
        reviewedAt: string | null
        approvalDigest: string | null
      }
      evidenceThresholds: { editorialGroups: number }
    }
    approved.status = 'approved'
    approved.review.approver = 'project-owner'
    approved.review.reviewedAt = '2026-08-02T00:00:00.000Z'
    approved.review.approvalDigest = baselineDigest

    expect(semanticApprovalDigest(approved)).toBe(baselineDigest)
    expect(validatePolicy(approved, approved.sourceSnapshot.auditedBaseCommit).approvalDigest).toBe(
      baselineDigest
    )

    approved.evidenceThresholds.editorialGroups += 1
    expect(semanticApprovalDigest(approved)).not.toBe(baselineDigest)
    expect(() => validatePolicy(approved, approved.sourceSnapshot.auditedBaseCommit)).toThrow(
      'approval digest mismatch'
    )
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

  it('provides one independently approved rubric for every partial observable', () => {
    const audit = read<{
      observables: { id: string; coverage: string }[]
    }>('authoring', 'observability-map.json')
    const packet = read<{
      rubrics: {
        rubricId: string
        observableId: string
        revision: number
        status: string
        proposal: {
          automaticOutputs: string[]
          manualInputs: string[]
          prohibitedInferences: string[]
        }
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
    expect(packet.rubrics.every((rubric) => rubric.status === 'approved')).toBe(true)
    expect(packet.rubrics.every((rubric) => rubric.review.approver === 'project-owner')).toBe(true)
    expect(packet.rubrics.every((rubric) => rubric.fallback.trim())).toBe(true)
    expect(packet.rubrics.every((rubric) => rubric.acceptanceTests.length >= 2)).toBe(true)

    const rubricById = new Map(packet.rubrics.map((rubric) => [rubric.rubricId, rubric]))
    expect(
      Object.fromEntries(packet.rubrics.map((rubric) => [rubric.rubricId, rubric.revision]))
    ).toEqual({
      'rubric:modernization-material-safety': 1,
      'rubric:fleet-safety-gate': 1,
      'rubric:visible-quest-chain': 2,
      'rubric:resource-posture': 2,
      'rubric:asw-capability-facts': 2,
      'rubric:surface-air-los-gaps': 2,
      'rubric:eo-affordability': 2,
      'rubric:evergreen-breadth': 2
    })

    const visibleChain = rubricById.get('rubric:visible-quest-chain')!
    expect(visibleChain.proposal.automaticOutputs.join(' ')).toContain('view-coverage')
    expect(visibleChain.proposal.automaticOutputs.join(' ')).toContain('graph-coverage')
    expect(visibleChain.proposal.prohibitedInferences.join(' ')).toContain(
      'missing from a partial or cached list'
    )
    expect(visibleChain.fallback).toContain('data-acquisition step')
    expect(visibleChain.acceptanceTests).toHaveLength(5)

    const resourcePosture = rubricById.get('rubric:resource-posture')!
    expect(resourcePosture.proposal.automaticOutputs.join(' ')).toContain(
      'measured, unknown, or stale'
    )
    expect(resourcePosture.proposal.manualInputs.join(' ')).toContain('preference only')
    expect(resourcePosture.fallback).toContain('keep the posture unset')
    expect(resourcePosture.acceptanceTests).toHaveLength(4)

    const aswFacts = rubricById.get('rubric:asw-capability-facts')!
    expect(aswFacts.proposal.automaticOutputs.join(' ')).toContain('category absent')
    expect(aswFacts.proposal.prohibitedInferences.join(' ')).toContain('target selection alone')
    expect(aswFacts.acceptanceTests).toHaveLength(5)

    const surfaceAirLos = rubricById.get('rubric:surface-air-los-gaps')!
    expect(surfaceAirLos.proposal.automaticOutputs.join(' ')).toContain('presence or absence')
    expect(surfaceAirLos.proposal.prohibitedInferences.join(' ')).toContain(
      'without a reviewed target rule'
    )
    expect(surfaceAirLos.acceptanceTests).toHaveLength(5)

    const eoAffordability = rubricById.get('rubric:eo-affordability')!
    expect(eoAffordability.proposal.automaticOutputs.join(' ')).not.toContain('prior local clear')
    expect(eoAffordability.proposal.prohibitedInferences.join(' ')).toContain('EO unlock state')
    expect(eoAffordability.acceptanceTests).toHaveLength(6)

    const evergreenBreadth = rubricById.get('rubric:evergreen-breadth')!
    expect(evergreenBreadth.proposal.manualInputs.join(' ')).toContain(
      'chooses one evergreen capability category'
    )
    expect(evergreenBreadth.fallback).toContain('one explicit manual next step')
    expect(evergreenBreadth.acceptanceTests).toHaveLength(5)

    const report = read<{ globalStops: string[] }>('generated', 'conflict-and-gap-report.json')
    expect(report.globalStops).not.toContain('DECISION_RUBRICS_NOT_INDEPENDENTLY_APPROVED')
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
      expect((milestone as { status: string }).status).toBe('approved')
      expect((milestone as { review: { approver: string } }).review.approver).toBe('project-owner')
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

    const incompleteFixture = read<{
      expectations: { expectedOutcomeKinds: Record<string, string> }
    }>('fixtures', 'unknown-state.json')
    delete incompleteFixture.expectations.expectedOutcomeKinds['resources.bands']
    expect(() => validateFixture(incompleteFixture, 'incomplete.json')).toThrow(
      'expected outcomes must cover every observable'
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

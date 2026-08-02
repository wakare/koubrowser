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
const { authorizationRequestSemanticDigest, validateR7AuthorizationRequest } =
  require('../../../scripts/quest-growth-r7-decision.js') as {
    authorizationRequestSemanticDigest: (value: Record<string, unknown>) => string
    validateR7AuthorizationRequest: (
      value: Record<string, unknown>,
      routeApprovalPacket: Record<string, unknown>,
      routeEligibilityReport: Record<string, unknown>
    ) => { recommendedFamilies: string[]; semanticDigest: string }
  }
const { validateCatalog, validateEvidenceSnapshots, validateFixturePacket } =
  require('../../../scripts/quest-growth-r7-schema.js') as {
    validateCatalog: (
      catalog: Record<string, unknown>,
      request: Record<string, unknown>,
      report: Record<string, unknown>,
      contentRequest: Record<string, unknown>,
      evidence: { sourcesByDigest: Map<string, unknown> }
    ) => Record<string, unknown>
    validateEvidenceSnapshots: (
      value: Record<string, unknown>,
      knownIndependenceGroups: Set<string>
    ) => { sourcesByDigest: Map<string, unknown> }
    validateFixturePacket: (value: Record<string, unknown>) => Record<string, unknown>[]
  }
const { contentAuthorizationSemanticDigest, validateR7ContentAuthorizationRequest } =
  require('../../../scripts/quest-growth-r7-content-decision.js') as {
    contentAuthorizationSemanticDigest: (value: Record<string, unknown>) => string
    validateR7ContentAuthorizationRequest: (
      value: Record<string, unknown>,
      dependencies: {
        base: string
        routeApprovalPacket: Record<string, unknown>
        r7AuthorizationReport: Record<string, unknown>
        r7SchemaReport: Record<string, unknown>
      }
    ) => { semanticDigest: string }
  }
const {
  routeReviewRequestSemanticDigest,
  routeReviewSemanticDigest,
  validateR7RouteReviewRequest
} = require('../../../scripts/quest-growth-r7-route-review-decision.js') as {
  routeReviewRequestSemanticDigest: (value: Record<string, unknown>) => string
  routeReviewSemanticDigest: (value: Record<string, unknown>) => string
  validateR7RouteReviewRequest: (
    value: Record<string, unknown>,
    dependencies: {
      base: string
      r7ContentAuthorizationReport: Record<string, unknown>
      r7SchemaReport: Record<string, unknown>
    }
  ) => { semanticDigest: string }
}
const { rendererRequestSemanticDigest, validateR7RendererIntegrationRequest } = require('../../../scripts/quest-growth-r7-renderer-decision.js') as {
  rendererRequestSemanticDigest: (value: Record<string, unknown>) => string
  validateR7RendererIntegrationRequest: (
    value: Record<string, unknown>,
    dependencies: {
      root: string
      base: string
      r7AuthorizationReport: Record<string, unknown>
      r7SchemaReport: Record<string, unknown>
      r7RouteReviewReport: Record<string, unknown>
    }
  ) => { semanticDigest: string }
}
const {
  realAccountRequestSemanticDigest,
  validateR7RealAccountAcceptanceRequest
} = require('../../../scripts/quest-growth-r7-real-account-decision.js') as {
  realAccountRequestSemanticDigest: (value: Record<string, unknown>) => string
  validateR7RealAccountAcceptanceRequest: (
    value: Record<string, unknown>,
    dependencies: {
      root: string
      base: string
      r7AuthorizationReport: Record<string, unknown>
      r7RendererReport: Record<string, unknown>
    }
  ) => { semanticDigest: string }
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
        '(1 manual-check-only), 0 runtime-eligible'
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
      reason: 'R7_REAL_ACCOUNT_ACCEPTANCE_RETRY_OWNER_DECISION_REQUIRED'
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
    expect(report.globalStops).toContain(
      'R7_REAL_ACCOUNT_ACCEPTANCE_RETRY_OWNER_DECISION_REQUIRED'
    )
    expect(report.globalStops).not.toContain('INDEPENDENT_APPROVER_REQUIRED')
    expect(report.globalStops).not.toContain('LOCAL_OBSERVABILITY_AUDIT_REQUIRED')
  })

  it('keeps reviewed R6 route units non-executable until separate R7 approval', () => {
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
      reviewedRouteUnitCount: 6,
      manualCheckOnlyCount: 1,
      r7CandidateCount: 5,
      runtimeEligibleCount: 0,
      validationCaseCount: 8
    })
    expect(manifest.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(report.policyStatus).toBe('approved')
    expect(report.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(report.routeUnitAudits).toHaveLength(6)
    expect(
      report.routeUnitAudits.filter((audit) => audit.contentDecision === 'R7_CANDIDATE')
    ).toHaveLength(5)
    expect(
      report.routeUnitAudits.filter((audit) => audit.contentDecision === 'MANUAL_CHECK_ONLY')
    ).toHaveLength(1)
    expect(
      report.routeUnitAudits.every(
        (audit) =>
          audit.effectiveState !== 'RUNTIME_ELIGIBLE' &&
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

    expect(packet.status).toBe('R6_AUTHORING_APPROVED')
    expect(packet.scope).toBe('R6_AUTHORING_REVIEW_ONLY')
    expect(packet.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(packet.evidenceLineageDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(packet.policy.currentStatus).toBe('approved')
    expect(packet.policy.semanticDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(packet.lineages).toHaveLength(6)
    expect(packet.routeUnits).toHaveLength(6)
    expect(packet.lineages.every((item) => item.currentStatus === 'reviewed')).toBe(true)
    expect(packet.routeUnits.every((item) => item.currentStatus === 'reviewed')).toBe(true)
    expect(packet.approvalRequirements).toEqual({
      requiredApprover: 'project-owner',
      authorApproverMustDiffer: true,
      exactDigestMatchRequired: true,
      r7AuthorizationIncluded: false,
      runtimePublicationIncluded: false,
      realAccountAcceptanceIncluded: false
    })
  })

  it('authorizes the first four R7 gates while keeping publication blocked', () => {
    const report = read<{
      status: string
      scope: string
      requestDigest: string
      semanticDigest: string
      authorizationGates: {
        gateId: string
        authorizationState: string
        semanticDigest: string
      }[]
      pilotProposal: {
        selectionState: string
        maximumInitialFamilies: number
        recommendedFamilies: string[]
        selectedInitialFamilies: string[]
      }
      implementationAuthorization: string
      concreteRouteArtifactCount: number
      runtimeEligibleCount: number
    }>('generated', 'r7-authorization-report.json')

    expect(report.status).toBe('REAL_ACCOUNT_READONLY_ACCEPTANCE_AUTHORIZED')
    expect(report.scope).toBe('R7_DECISION_ONLY')
    expect(report.requestDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(report.semanticDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(report.authorizationGates).toHaveLength(6)
    expect(report.authorizationGates[0]).toEqual({
      gateId: 'r7-schema-output-class',
      authorizationState: 'authorized',
      semanticDigest: 'sha256:bbc64d5f81725d2a15c2b986047dde40518c3a5d76745fb6cc81d6c221b455ed'
    })
    expect(report.authorizationGates[1]).toEqual({
      gateId: 'r7-pilot-content-authoring',
      authorizationState: 'authorized',
      semanticDigest: 'sha256:2b0276b3f43adb54d4cce3fb831150872cc39d211fb9d87410957f08d1e434f3'
    })
    expect(report.authorizationGates[2]).toEqual({
      gateId: 'r7-renderer-opt-in-integration',
      authorizationState: 'authorized',
      semanticDigest: 'sha256:c2f7ce617eaaf00bb8aded393734af42bbe75a8d3a9480ea31f4b31a7f1f6be3'
    })
    expect(
      report.authorizationGates
        .slice(4)
        .every(
          (gate) =>
            gate.authorizationState === 'not-authorized' &&
            /^sha256:[0-9a-f]{64}$/.test(gate.semanticDigest)
        )
    ).toBe(true)
    expect(report.authorizationGates[3]).toEqual({
      gateId: 'r7-real-account-readonly-acceptance',
      authorizationState: 'authorized',
      semanticDigest: 'sha256:9217b655328ce8a1c4e0558c744b7eb6fb35f1226331d1b3960ad3055c66ffdb'
    })
    expect(report.pilotProposal).toEqual({
      selectionState: 'selected',
      maximumInitialFamilies: 2,
      recommendedFamilies: ['expedition-resource-periodic-loop', 'anti-submarine-foundation'],
      selectedInitialFamilies: ['expedition-resource-periodic-loop', 'anti-submarine-foundation']
    })
    expect(report.implementationAuthorization).toBe(
      'R7_REAL_ACCOUNT_READONLY_ACCEPTANCE_AUTHORIZED'
    )
    expect(report.concreteRouteArtifactCount).toBe(2)
    expect(report.runtimeEligibleCount).toBe(0)
  })

  it('fails closed if another R7 gate is marked authorized without owner approval', () => {
    const request = read<
      Record<string, unknown> & {
        authorizationGates: { authorizationState: string }[]
      }
    >('decisions', 'r7-authorization-request.json')
    const approvalPacket = read<Record<string, unknown>>('generated', 'route-approval-packet.json')
    const eligibilityReport = read<Record<string, unknown>>(
      'generated',
      'route-eligibility-report.json'
    )
    const tampered = structuredClone(request)
    tampered.authorizationGates[4].authorizationState = 'authorized'

    expect(authorizationRequestSemanticDigest(tampered)).toBe(
      authorizationRequestSemanticDigest(request)
    )
    expect(() =>
      validateR7AuthorizationRequest(tampered, approvalPacket, eligibilityReport)
    ).toThrow('only the first four R7 gates are authorized')
  })

  it('validates two reviewed pilot routes and keeps publication blocked', () => {
    const report = read<
      Record<string, unknown> & {
        status: string
        selectedPilotFamilies: string[]
        catalogRouteCount: number
        concreteRouteArtifactCount: number
        draftConcreteRouteArtifactCount: number
        reviewedConcreteRouteArtifactCount: number
        fixtureCaseCount: number
        fixtureValidationPassed: boolean
        publicationAuthorization: string
        runtimeEligibleCount: number
        evidenceSnapshotDigest: string
        evidenceSourceCount: number
      }
    >('generated', 'r7-schema-validation-report.json')
    const catalog = read<Record<string, unknown> & { routes: unknown[] }>(
      'r7',
      'route-catalog.json'
    )
    const fixtures = read<Record<string, unknown>>('fixtures', 'r7-schema', 'schema-cases.json')

    expect(report.status).toBe('CONTENT_AUTHORING_AUTHORIZED_DRAFT_ONLY')
    expect(report.selectedPilotFamilies).toEqual([
      'expedition-resource-periodic-loop',
      'anti-submarine-foundation'
    ])
    expect(catalog.routes).toHaveLength(2)
    expect(report.catalogRouteCount).toBe(2)
    expect(report.concreteRouteArtifactCount).toBe(2)
    expect(report.draftConcreteRouteArtifactCount).toBe(0)
    expect(report.reviewedConcreteRouteArtifactCount).toBe(2)
    expect(report.evidenceSnapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(report.evidenceSourceCount).toBe(4)
    expect(report.fixtureCaseCount).toBe(4)
    expect(report.fixtureValidationPassed).toBe(true)
    expect(report.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(report.runtimeEligibleCount).toBe(0)
    expect(validateFixturePacket(fixtures)).toHaveLength(4)
  })

  it('rejects reviewed R7 status without its exact route approval digest', () => {
    const request = read<Record<string, unknown>>('decisions', 'r7-authorization-request.json')
    const report = read<Record<string, unknown>>('generated', 'r7-authorization-report.json')
    const catalog = read<Record<string, unknown> & { routes: unknown[] }>(
      'r7',
      'route-catalog.json'
    )
    const contentRequest = read<Record<string, unknown>>(
      'decisions',
      'r7-pilot-content-authorization-request.json'
    )
    const routeEvidenceLineage = read<{
      independenceGroups: { independenceGroupId: string }[]
    }>('authoring', 'route-evidence-lineage.json')
    const evidence = validateEvidenceSnapshots(
      read<Record<string, unknown>>('r7', 'evidence-snapshots.json'),
      new Set(routeEvidenceLineage.independenceGroups.map((group) => group.independenceGroupId))
    )
    const tampered = structuredClone(catalog)
    ;(tampered.routes[0] as { review: { approvalDigest: string | null } }).review.approvalDigest =
      null

    expect(() => validateCatalog(tampered, request, report, contentRequest, evidence)).toThrow(
      'R7 route approval digest mismatch'
    )
  })

  it('generates a digest-bound R7 pilot content authorization report', () => {
    const report = read<{
      status: string
      scope: string
      semanticDigest: string
      gateId: string
      gateSemanticDigest: string
      authorizationState: string
      selectedPilotFamilies: string[]
      maximumRouteArtifacts: number
      maximumRouteArtifactsPerFamily: number
      maximumAuthoringStatus: string
      currentCatalogRouteCount: number
      draftConcreteRouteArtifactCount: number
      reviewedConcreteRouteArtifactCount: number
      runtimeEligibleCount: number
      publicationAuthorization: string
      stillProhibited: string[]
    }>('generated', 'r7-pilot-content-authorization-report.json')

    expect(report.status).toBe('CONTENT_AUTHORING_AUTHORIZED_DRAFT_ONLY')
    expect(report.scope).toBe('R7_PILOT_CONTENT_AUTHORING_REVIEW_ONLY')
    expect(report.semanticDigest).toBe(
      'sha256:d2c474af9b09a959cb9e9a1532ba954e1f11da8669feb2fc5049421715a972fc'
    )
    expect(report.gateId).toBe('r7-pilot-content-authoring')
    expect(report.gateSemanticDigest).toBe(
      'sha256:2b0276b3f43adb54d4cce3fb831150872cc39d211fb9d87410957f08d1e434f3'
    )
    expect(report.authorizationState).toBe('authorized')
    expect(report.selectedPilotFamilies).toEqual([
      'expedition-resource-periodic-loop',
      'anti-submarine-foundation'
    ])
    expect(report.maximumRouteArtifacts).toBe(2)
    expect(report.maximumRouteArtifactsPerFamily).toBe(1)
    expect(report.maximumAuthoringStatus).toBe('draft')
    expect(report.currentCatalogRouteCount).toBe(2)
    expect(report.draftConcreteRouteArtifactCount).toBe(0)
    expect(report.reviewedConcreteRouteArtifactCount).toBe(2)
    expect(report.runtimeEligibleCount).toBe(0)
    expect(report.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(report.stillProhibited).toContain('renderer-integration')
    expect(report.stillProhibited).toContain('runtime-publication')
  })

  it('fails closed when the R7 pilot content authoring limit is changed', () => {
    const request = read<
      Record<string, unknown> & {
        requestedAuthorization: { maximumRouteArtifacts: number }
      }
    >('decisions', 'r7-pilot-content-authorization-request.json')
    const tampered = structuredClone(request)
    tampered.requestedAuthorization.maximumRouteArtifacts = 3
    const dependencies = {
      base: GrowthDirectory,
      routeApprovalPacket: read<Record<string, unknown>>('generated', 'route-approval-packet.json'),
      r7AuthorizationReport: read<Record<string, unknown>>(
        'generated',
        'r7-authorization-report.json'
      ),
      r7SchemaReport: read<Record<string, unknown>>('generated', 'r7-schema-validation-report.json')
    }

    expect(contentAuthorizationSemanticDigest(tampered)).not.toBe(
      contentAuthorizationSemanticDigest(request)
    )
    expect(() => validateR7ContentAuthorizationRequest(tampered, dependencies)).toThrow(
      'R7 requested content authorization boundary mismatch'
    )
  })

  it('generates an approved digest-bound review decision for both R7 pilot routes', () => {
    const report = read<{
      status: string
      semanticDigest: string
      authorizationState: string
      currentDraftRouteCount: number
      reviewedRouteCount: number
      runtimeEligibleCount: number
      publicationAuthorization: string
      routeReviews: {
        routeId: string
        routeSemanticDigest: string
        evidenceBindingCount: number
        independenceGroupCount: number
        reviewDecision: string
      }[]
    }>('generated', 'r7-pilot-route-review-report.json')

    expect(report.status).toBe('PILOT_ROUTE_AUTHORING_REVIEW_APPROVED')
    expect(report.semanticDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(report.authorizationState).toBe('authorized')
    expect(report.currentDraftRouteCount).toBe(0)
    expect(report.reviewedRouteCount).toBe(2)
    expect(report.runtimeEligibleCount).toBe(0)
    expect(report.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(report.routeReviews).toHaveLength(2)
    expect(
      report.routeReviews.every(
        (route) =>
          /^sha256:[0-9a-f]{64}$/.test(route.routeSemanticDigest) &&
          route.evidenceBindingCount === 2 &&
          route.independenceGroupCount === 2 &&
          route.reviewDecision === 'REVIEWED'
      )
    ).toBe(true)
  })

  it('fails closed when reviewed route content no longer matches the fixed digest', () => {
    const request = read<
      Record<string, unknown> & {
        routeReviews: { routeSemanticDigest: string }[]
      }
    >('decisions', 'r7-pilot-route-review-request.json')
    const catalog = read<{ routes: Record<string, unknown>[] }>('r7', 'route-catalog.json')
    const tamperedRoute = structuredClone(catalog.routes[0])
    tamperedRoute.summary = 'tampered route content'
    expect(routeReviewSemanticDigest(tamperedRoute)).not.toBe(
      request.routeReviews[0].routeSemanticDigest
    )

    const tamperedRequest = structuredClone(request)
    tamperedRequest.routeReviews[0].routeSemanticDigest = routeReviewSemanticDigest(tamperedRoute)
    expect(() =>
      validateR7RouteReviewRequest(tamperedRequest, {
        base: GrowthDirectory,
        r7ContentAuthorizationReport: read<Record<string, unknown>>(
          'generated',
          'r7-pilot-content-authorization-report.json'
        ),
        r7SchemaReport: read<Record<string, unknown>>(
          'generated',
          'r7-schema-validation-report.json'
        )
      })
    ).toThrow('R7 route review semantic binding mismatch')
  })

  it('keeps the R7 route review summary stable across approval metadata only', () => {
    const request = read<
      Record<string, unknown> & {
        status: string
        requestedReview: { authorizationState: string }
        review: {
          approver: string | null
          reviewedAt: string | null
          approvalDigest: string | null
        }
      }
    >('decisions', 'r7-pilot-route-review-request.json')
    const pending = structuredClone(request)
    pending.status = 'draft'
    pending.requestedReview.authorizationState = 'owner-decision-required'
    pending.review.approver = null
    pending.review.reviewedAt = null
    pending.review.approvalDigest = null

    expect(routeReviewRequestSemanticDigest(pending)).toBe(
      routeReviewRequestSemanticDigest(request)
    )
  })

  it('generates a bounded approved renderer integration decision for two reviewed routes', () => {
    const report = read<{
      status: string
      semanticDigest: string
      authorizationState: string
      implementationAuthorization: string
      integrationMode: string
      maximumDisplayedRoutes: number
      reviewedRouteCount: number
      rendererEligibleRouteCount: number
      runtimeEligibleCount: number
      publicationAuthorization: string
      routeBindings: { focus: string; presentationClass: string }[]
      optIn: { defaultVisible: boolean; selectionPersistence: string; focusRequired: boolean }
    }>('generated', 'r7-renderer-integration-report.json')

    expect(report.status).toBe('RENDERER_OPT_IN_INTEGRATION_AUTHORIZED')
    expect(report.semanticDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(report.authorizationState).toBe('authorized')
    expect(report.implementationAuthorization).toBe('authorized')
    expect(report.integrationMode).toBe('session-only-explicit-expand')
    expect(report.maximumDisplayedRoutes).toBe(2)
    expect(report.reviewedRouteCount).toBe(2)
    expect(report.rendererEligibleRouteCount).toBe(2)
    expect(report.runtimeEligibleCount).toBe(0)
    expect(report.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(report.optIn).toMatchObject({
      defaultVisible: false,
      selectionPersistence: 'none',
      focusRequired: true
    })
    expect(report.routeBindings).toEqual([
      expect.objectContaining({ focus: 'resources', presentationClass: 'manual-check-route' }),
      expect.objectContaining({ focus: 'asw', presentationClass: 'manual-check-route' })
    ])
  })

  it('fails closed when the renderer opt-in contract is widened', () => {
    const request = read<
      Record<string, unknown> & { rendererContract: { defaultVisible: boolean } }
    >('decisions', 'r7-renderer-integration-request.json')
    const tampered = structuredClone(request)
    tampered.rendererContract.defaultVisible = true

    expect(rendererRequestSemanticDigest(tampered)).not.toBe(
      rendererRequestSemanticDigest(request)
    )
    expect(() =>
      validateR7RendererIntegrationRequest(tampered, {
        root: process.cwd(),
        base: GrowthDirectory,
        r7AuthorizationReport: read<Record<string, unknown>>(
          'generated',
          'r7-authorization-report.json'
        ),
        r7SchemaReport: read<Record<string, unknown>>(
          'generated',
          'r7-schema-validation-report.json'
        ),
        r7RouteReviewReport: read<Record<string, unknown>>(
          'generated',
          'r7-pilot-route-review-report.json'
        )
      })
    ).toThrow('R7 renderer display contract mismatch')
  })

  it('keeps the renderer request digest stable across approval metadata only', () => {
    const request = read<
      Record<string, unknown> & {
        status: string
        requestedAuthorization: {
          authorizationState: string
          implementationAuthorization: string
        }
        review: {
          approver: string | null
          reviewedAt: string | null
          approvalDigest: string | null
        }
      }
    >('decisions', 'r7-renderer-integration-request.json')
    const pending = structuredClone(request)
    pending.status = 'draft'
    pending.requestedAuthorization.authorizationState = 'owner-decision-required'
    pending.requestedAuthorization.implementationAuthorization = 'not-authorized'
    pending.review.approver = null
    pending.review.reviewedAt = null
    pending.review.approvalDigest = null

    expect(rendererRequestSemanticDigest(pending)).toBe(
      rendererRequestSemanticDigest(request)
    )
  })

  it('requires owner approval for the bounded revision 4 retry', () => {
    const report = read<{
      status: string
      semanticDigest: string
      authorizationState: string
      executionAuthorization: string
      acceptanceMode: string
      maximumAcceptedRoutes: number
      requiredCheckCount: number
      actualAcceptanceStatus: string
      accountDataReady: boolean
      screenshotCaptureAllowed: boolean
      rawLogRetentionAllowed: boolean
      accountDataExportAllowed: boolean
      runtimeEligibleCount: number
      publicationAuthorization: string
      defaultEnablementAuthorization: string
      routeBindings: { focus: string }[]
      priorAttemptReasonCode: string
      harnessAmendmentReasonCode: string
      anonymousHiddenLayoutFixtureRequired: boolean
      anonymousTallLayoutFixtureRequired: boolean
      acceptanceReasonCode: string
      routeInspectionStarted: boolean
      checkedRouteCount: number
      pageFilterPanelWindowStateRestored: boolean
      applicationProcessClosed: boolean
      retryAuthorizationReasonCode: string
      maximumRetryExecutions: number
      harnessChangesAuthorized: boolean
    }>('generated', 'r7-real-account-acceptance-report.json')

    expect(report.status).toBe('OWNER_DECISION_REQUIRED_REAL_ACCOUNT_ACCEPTANCE_RETRY')
    expect(report.semanticDigest).toBe(
      'sha256:8fec2825a32362949041fd2c13c3aadca9bd900988f4f829b8eff4af6d92820c'
    )
    expect(report.authorizationState).toBe('authorized')
    expect(report.executionAuthorization).toBe('not-authorized')
    expect(report.acceptanceMode).toBe('owner-login-readonly-redacted')
    expect(report.maximumAcceptedRoutes).toBe(2)
    expect(report.requiredCheckCount).toBe(12)
    expect(report.actualAcceptanceStatus).toBe('fail-closed')
    expect(report.acceptanceReasonCode).toBe('MANUAL_LOGIN_TIMEOUT_BEFORE_ACCOUNT_DATA')
    expect(report.accountDataReady).toBe(false)
    expect(report.routeInspectionStarted).toBe(false)
    expect(report.checkedRouteCount).toBe(0)
    expect(report.pageFilterPanelWindowStateRestored).toBe(true)
    expect(report.applicationProcessClosed).toBe(true)
    expect(report.retryAuthorizationReasonCode).toBe(
      'ACCOUNT_DATA_NOT_READY_WITHIN_MANUAL_WINDOW'
    )
    expect(report.maximumRetryExecutions).toBe(1)
    expect(report.harnessChangesAuthorized).toBe(false)
    expect(report.priorAttemptReasonCode).toBe('TASK_WORKSPACE_PAGE_NOT_VISIBLE')
    expect(report.harnessAmendmentReasonCode).toBe(
      'TALL_AND_COMPACT_TASK_GUIDE_LAYOUT_SELECTION'
    )
    expect(report.anonymousHiddenLayoutFixtureRequired).toBe(true)
    expect(report.anonymousTallLayoutFixtureRequired).toBe(true)
    expect(report.screenshotCaptureAllowed).toBe(false)
    expect(report.rawLogRetentionAllowed).toBe(false)
    expect(report.accountDataExportAllowed).toBe(false)
    expect(report.runtimeEligibleCount).toBe(0)
    expect(report.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(report.defaultEnablementAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(report.routeBindings.map((item) => item.focus)).toEqual(['resources', 'asw'])
  })

  it('fails closed when real-account evidence capture is widened', () => {
    const request = read<
      Record<string, unknown> & { evidenceContract: { screenshotCaptureAllowed: boolean } }
    >('decisions', 'r7-real-account-acceptance-request.json')
    const tampered = structuredClone(request)
    tampered.evidenceContract.screenshotCaptureAllowed = true

    expect(realAccountRequestSemanticDigest(tampered)).not.toBe(
      realAccountRequestSemanticDigest(request)
    )
    expect(() =>
      validateR7RealAccountAcceptanceRequest(tampered, {
        root: process.cwd(),
        base: GrowthDirectory,
        r7AuthorizationReport: read<Record<string, unknown>>(
          'generated',
          'r7-authorization-report.json'
        ),
        r7RendererReport: read<Record<string, unknown>>(
          'generated',
          'r7-renderer-integration-report.json'
        )
      })
    ).toThrow('R7 real-account evidence contract mismatch')
  })

  it('keeps the real-account request digest stable across approval metadata only', () => {
    const request = read<
      Record<string, unknown> & {
        status: string
        requestedAuthorization: {
          authorizationState: string
          executionAuthorization: string
        }
        review: {
          approver: string | null
          reviewedAt: string | null
          approvalDigest: string | null
        }
      }
    >('decisions', 'r7-real-account-acceptance-request.json')
    const approved = structuredClone(request)
    approved.status = 'approved'
    approved.requestedAuthorization.authorizationState = 'authorized'
    approved.requestedAuthorization.executionAuthorization = 'authorized'
    approved.review.approver = 'project-owner'
    approved.review.reviewedAt = '2026-08-02T03:20:00.000Z'
    approved.review.approvalDigest = realAccountRequestSemanticDigest(request)

    expect(realAccountRequestSemanticDigest(approved)).toBe(
      realAccountRequestSemanticDigest(request)
    )
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

const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const R7RouteReviewDecisionCompilerVersion = 'quest-growth-r7-route-review-decision-compiler/2'
const R7RouteReviewDecisionOutputFilenames = ['r7-pilot-route-review-report.json']
const CommitPattern = /^[0-9a-f]{40}$/
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const SelectedRouteIds = [
  'route:expedition-05-resource-loop:draft-1',
  'route:1-5-basic-asw-three-battle:draft-1'
]
const ApprovedRouteReviewSemanticDigest =
  'sha256:7a3ef3fc63abbad4db8ed8d3368e9f6279a40f279363600c5e97c1d00d7631c3'
const ApprovedReviewBasis = {
  contentAuthorizationSemanticDigest:
    'sha256:d2c474af9b09a959cb9e9a1532ba954e1f11da8669feb2fc5049421715a972fc',
  contentAuthorizationRequestDigest:
    'sha256:e952cc1d4e7ab563e69bd9bd91838d889788f1029780dcb23530cbcc1ac16961',
  routeCatalogDigest: 'sha256:97a7fea3cda3598361d16940405bfc458db32fe79707e962e44cddb7327d3269',
  evidenceSnapshotDigest:
    'sha256:877cc52a7dcaaf661cb3a90d5b2579657de84e12612ee5bc5ecdb62fa761bc53',
  schemaValidationReportDigest:
    'sha256:120238e9fb3c788e9668a4331b2a01b5ada54747f5ab404a60d10fbb30f8f587'
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    )
  }
  return value
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`
}

function digest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function exactKeys(value, required, description) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`invalid ${description}`)
  }
  const allowed = new Set(required)
  for (const key of required) {
    if (!(key in value)) throw new Error(`missing ${description} ${key}`)
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`unexpected ${description} ${key}`)
  }
}

function requiredText(value, description) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`invalid ${description}`)
  return value
}

function identifier(value, description) {
  const result = requiredText(value, description)
  if (!IdentifierPattern.test(result)) throw new Error(`invalid ${description}`)
  return result
}

function timestamp(value, description) {
  const result = requiredText(value, description)
  if (!TimestampPattern.test(result) || !Number.isFinite(Date.parse(result))) {
    throw new Error(`invalid ${description}`)
  }
  return result
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function routeReviewSemanticDigest(route) {
  return digest(
    canonicalJson(
      Object.fromEntries(
        Object.entries(route).filter(([key]) => key !== 'status' && key !== 'review')
      )
    )
  )
}

function routeReviewRequestSemanticDigest(value) {
  const payload = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'status' && key !== 'review')
  )
  return digest(
    canonicalJson({
      ...payload,
      requestedReview: Object.fromEntries(
        Object.entries(payload.requestedReview).filter(([key]) => key !== 'authorizationState')
      )
    })
  )
}

function expectedRouteReview(route, contentAuthorizationReport) {
  const binding = contentAuthorizationReport.pilotBindings.find(
    (item) => item.routeFamily === route.routeFamily
  )
  if (!binding) throw new Error(`missing R7 pilot binding ${route.routeFamily}`)
  return {
    routeId: route.routeId,
    routeFamily: route.routeFamily,
    routeRevision: route.revision,
    title: route.title,
    routeAuthor: route.review.author,
    routeSemanticDigest: routeReviewSemanticDigest(route),
    lineage: binding.lineage,
    evidenceBindings: route.segments.flatMap((segment) => segment.concreteEvidenceRefs),
    currentness: route.currentness
  }
}

function validateR7RouteReviewRequest(
  value,
  { base, r7ContentAuthorizationReport, r7SchemaReport }
) {
  exactKeys(
    value,
    [
      'authoringSchema',
      'requestId',
      'revision',
      'status',
      'scope',
      'sourceSnapshot',
      'approvalBasis',
      'requestedReview',
      'routeReviews',
      'reviewRequirements',
      'stillProhibited',
      'review'
    ],
    'R7 pilot route review request'
  )
  if (value.authoringSchema !== 'QuestGrowthR7PilotRouteReviewRequest/1alpha') {
    throw new Error('unsupported R7 pilot route review request schema')
  }
  identifier(value.requestId, 'R7 route review request id')
  if (value.revision !== 1) throw new Error('invalid R7 route review request revision')
  if (!['draft', 'approved'].includes(value.status) || value.scope !== 'R7_ROUTE_AUTHORING_REVIEW_ONLY') {
    throw new Error('R7 route review request must remain review-only')
  }
  const approved = value.status === 'approved'
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R7 review source snapshot')
  if (!CommitPattern.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R7 review audited base commit')
  }
  const checkedAt = timestamp(value.sourceSnapshot.checkedAt, 'R7 review checkedAt')

  const contentRequestRaw = fs.readFileSync(
    path.join(base, 'decisions', 'r7-pilot-content-authorization-request.json')
  )
  const catalogRaw = fs.readFileSync(path.join(base, 'r7', 'route-catalog.json'))
  const evidenceRaw = fs.readFileSync(path.join(base, 'r7', 'evidence-snapshots.json'))
  const schemaReportRaw = fs.readFileSync(
    path.join(base, 'generated', 'r7-schema-validation-report.json')
  )
  const expectedBasis = {
    contentAuthorizationSemanticDigest: r7ContentAuthorizationReport.semanticDigest,
    contentAuthorizationRequestDigest: digest(contentRequestRaw),
    routeCatalogDigest: digest(catalogRaw),
    evidenceSnapshotDigest: digest(evidenceRaw),
    schemaValidationReportDigest: digest(schemaReportRaw)
  }
  exactKeys(
    value.approvalBasis,
    [
      'contentAuthorizationSemanticDigest',
      'contentAuthorizationRequestDigest',
      'routeCatalogDigest',
      'evidenceSnapshotDigest',
      'schemaValidationReportDigest'
    ],
    'R7 route review approval basis'
  )
  for (const [key, item] of Object.entries(value.approvalBasis)) {
    if (!DigestPattern.test(item)) throw new Error(`invalid R7 route review basis ${key}`)
  }
  if (
    (!approved && !same(value.approvalBasis, expectedBasis)) ||
    (approved && !same(value.approvalBasis, ApprovedReviewBasis))
  ) {
    throw new Error('R7 route review approval basis mismatch')
  }
  if (
    r7ContentAuthorizationReport.status !== 'CONTENT_AUTHORING_AUTHORIZED_DRAFT_ONLY' ||
    r7ContentAuthorizationReport.authorizationState !== 'authorized' ||
    r7SchemaReport.status !== 'CONTENT_AUTHORING_AUTHORIZED_DRAFT_ONLY' ||
    r7SchemaReport.catalogRouteCount !== 2 ||
    r7SchemaReport.runtimeEligibleCount !== 0
  ) {
    throw new Error('R7 route review prerequisites are invalid')
  }

  exactKeys(
    value.requestedReview,
    [
      'authorizationState',
      'maximumReviewedRoutes',
      'requiredCurrentStatus',
      'requestedTargetStatus',
      'selectedRouteIds'
    ],
    'R7 requested route review'
  )
  if (
    value.requestedReview.authorizationState !==
      (approved ? 'authorized' : 'owner-decision-required') ||
    value.requestedReview.maximumReviewedRoutes !== 2 ||
    value.requestedReview.requiredCurrentStatus !== 'draft' ||
    value.requestedReview.requestedTargetStatus !== 'reviewed' ||
    !same(value.requestedReview.selectedRouteIds, SelectedRouteIds)
  ) {
    throw new Error('R7 requested route review boundary mismatch')
  }

  const catalog = JSON.parse(catalogRaw)
  if (!Array.isArray(catalog.routes) || catalog.routes.length !== 2) {
    throw new Error('R7 route review requires exactly two pilot drafts')
  }
  if (!Array.isArray(value.routeReviews) || value.routeReviews.length !== 2) {
    throw new Error('R7 route review count mismatch')
  }
  for (const [index, route] of catalog.routes.entries()) {
    if (
      route.routeId !== SelectedRouteIds[index] ||
      route.status !== (approved ? 'reviewed' : 'draft')
    ) {
      throw new Error(`R7 route review status mismatch ${route.routeId}`)
    }
    const expectedReview = expectedRouteReview(route, r7ContentAuthorizationReport)
    const review = value.routeReviews[index]
    exactKeys(
      review,
      [
        'routeId',
        'routeFamily',
        'routeRevision',
        'title',
        'routeAuthor',
        'routeSemanticDigest',
        'lineage',
        'evidenceBindings',
        'currentness'
      ],
      `R7 route review ${index}`
    )
    if (!same(review, expectedReview)) {
      throw new Error(`R7 route review semantic binding mismatch ${route.routeId}`)
    }
    if (!DigestPattern.test(review.routeSemanticDigest)) {
      throw new Error(`invalid R7 route semantic digest ${route.routeId}`)
    }
    const evidenceGroups = new Set(
      review.evidenceBindings.map((reference) => reference.independenceGroupId)
    )
    if (review.evidenceBindings.length < 2 || evidenceGroups.size < 2) {
      throw new Error(`R7 route review lacks independent evidence ${route.routeId}`)
    }
    if (
      Date.parse(checkedAt) >= Date.parse(review.currentness.reviewBy) ||
      Date.parse(review.currentness.reviewBy) >= Date.parse(review.currentness.validUntil)
    ) {
      throw new Error(`R7 route review currentness window is invalid ${route.routeId}`)
    }
    if (approved) {
      const routeApprover = identifier(route.review.approver, 'R7 route approver')
      const routeReviewedAt = timestamp(route.review.reviewedAt, 'R7 route reviewedAt')
      if (
        routeApprover !== value.reviewRequirements.requiredApprover ||
        routeApprover === route.review.author ||
        route.review.approvalDigest !== review.routeSemanticDigest ||
        Date.parse(routeReviewedAt) < Date.parse(checkedAt) ||
        Date.parse(routeReviewedAt) >= Date.parse(review.currentness.reviewBy)
      ) {
        throw new Error(`R7 reviewed route approval mismatch ${route.routeId}`)
      }
    } else if (
      route.review.approver !== null ||
      route.review.reviewedAt !== null ||
      route.review.approvalDigest !== null
    ) {
      throw new Error(`R7 draft route must remain unreviewed ${route.routeId}`)
    }
  }

  exactKeys(
    value.reviewRequirements,
    [
      'requiredApprover',
      'routeAuthorApproverMustDiffer',
      'packetAuthorApproverMustDiffer',
      'exactRouteDigestMatchRequired',
      'currentnessMustBeValid',
      'approvalDoesNotAuthorizeRendererOrPublication'
    ],
    'R7 route review requirements'
  )
  if (
    value.reviewRequirements.requiredApprover !== 'project-owner' ||
    value.reviewRequirements.routeAuthorApproverMustDiffer !== true ||
    value.reviewRequirements.packetAuthorApproverMustDiffer !== true ||
    value.reviewRequirements.exactRouteDigestMatchRequired !== true ||
    value.reviewRequirements.currentnessMustBeValid !== true ||
    value.reviewRequirements.approvalDoesNotAuthorizeRendererOrPublication !== true
  ) {
    throw new Error('R7 route review requirement boundary mismatch')
  }

  if (!Array.isArray(value.stillProhibited) || value.stillProhibited.length !== 10) {
    throw new Error('R7 route review prohibited behavior count mismatch')
  }
  for (const prohibited of [
    'route-content-mutation-after-approval',
    'self-approval',
    'renderer-integration',
    'real-account-acceptance',
    'runtime-publication',
    'default-enablement',
    'automatic-game-operation',
    'game-communication-mutation',
    'runtime-web-scraping',
    'account-data-export'
  ]) {
    if (!value.stillProhibited.includes(prohibited)) {
      throw new Error(`R7 route review prohibited behavior missing ${prohibited}`)
    }
  }

  exactKeys(value.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'R7 review')
  identifier(value.review.author, 'R7 review packet author')
  const semanticDigest = routeReviewRequestSemanticDigest(value)
  if (approved) {
    const approver = identifier(value.review.approver, 'R7 review approver')
    const reviewedAt = timestamp(value.review.reviewedAt, 'R7 review reviewedAt')
    if (
      approver !== value.reviewRequirements.requiredApprover ||
      approver === value.review.author ||
      Date.parse(reviewedAt) < Date.parse(checkedAt) ||
      value.review.approvalDigest !== semanticDigest ||
      semanticDigest !== ApprovedRouteReviewSemanticDigest
    ) {
      throw new Error('approved R7 route review semantic digest mismatch')
    }
  } else if (
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 route review packet must not claim owner approval')
  }
  return {
    value,
    semanticDigest,
    approved
  }
}

function buildR7RouteReviewDecisionArtifacts({
  base,
  r7ContentAuthorizationReport,
  r7SchemaReport
}) {
  const requestPath = path.join(base, 'decisions', 'r7-pilot-route-review-request.json')
  const requestRaw = fs.readFileSync(requestPath)
  const request = validateR7RouteReviewRequest(JSON.parse(requestRaw), {
    base,
    r7ContentAuthorizationReport,
    r7SchemaReport
  })
  const report = {
    schemaVersion: 1,
    compilerVersion: R7RouteReviewDecisionCompilerVersion,
    generatedAt: request.approved
      ? request.value.review.reviewedAt
      : request.value.sourceSnapshot.checkedAt,
    status: request.approved
      ? 'PILOT_ROUTE_AUTHORING_REVIEW_APPROVED'
      : 'OWNER_DECISION_REQUIRED_ROUTE_REVIEW',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    authorizationState: request.approved ? 'authorized' : 'not-authorized',
    maximumReviewedRoutes: request.value.requestedReview.maximumReviewedRoutes,
    requestedTargetStatus: request.value.requestedReview.requestedTargetStatus,
    routeReviews: request.value.routeReviews.map((route) => ({
      routeId: route.routeId,
      routeFamily: route.routeFamily,
      routeRevision: route.routeRevision,
      title: route.title,
      routeAuthor: route.routeAuthor,
      routeSemanticDigest: route.routeSemanticDigest,
      lineage: route.lineage,
      evidenceBindingCount: route.evidenceBindings.length,
      independenceGroupCount: new Set(
        route.evidenceBindings.map((reference) => reference.independenceGroupId)
      ).size,
      currentness: route.currentness,
      reviewDecision: request.approved ? 'REVIEWED' : 'OWNER_DECISION_REQUIRED'
    })),
    requiredApprover: request.value.reviewRequirements.requiredApprover,
    stillProhibited: request.value.stillProhibited,
    currentDraftRouteCount: request.approved ? 0 : request.value.routeReviews.length,
    reviewedRouteCount: request.approved ? request.value.routeReviews.length : 0,
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED'
  }
  return {
    artifacts: { 'r7-pilot-route-review-report.json': report },
    source: { r7PilotRouteReviewRequestDigest: digest(requestRaw) },
    output: {
      r7PilotRouteReviewDecisionCount: report.routeReviews.length,
      r7PilotRouteReviewAuthorizedCount: request.approved ? report.routeReviews.length : 0,
      r7PilotRouteReviewPendingCount: request.approved ? 0 : report.routeReviews.length,
      r7ReviewedConcreteRouteCount: request.approved ? report.routeReviews.length : 0
    }
  }
}

module.exports = {
  R7RouteReviewDecisionOutputFilenames,
  buildR7RouteReviewDecisionArtifacts,
  routeReviewRequestSemanticDigest,
  routeReviewSemanticDigest,
  validateR7RouteReviewRequest
}

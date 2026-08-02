const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const R7RouteReviewDecisionCompilerVersion = 'quest-growth-r7-route-review-decision-compiler/1'
const R7RouteReviewDecisionOutputFilenames = ['r7-pilot-route-review-report.json']
const CommitPattern = /^[0-9a-f]{40}$/
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const SelectedRouteIds = [
  'route:expedition-05-resource-loop:draft-1',
  'route:1-5-basic-asw-three-battle:draft-1'
]

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
  if (value.status !== 'draft' || value.scope !== 'R7_ROUTE_AUTHORING_REVIEW_ONLY') {
    throw new Error('R7 route review request must remain draft and review-only')
  }
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
  if (!same(value.approvalBasis, expectedBasis)) {
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
    value.requestedReview.authorizationState !== 'owner-decision-required' ||
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
      route.status !== 'draft' ||
      route.review.approver !== null ||
      route.review.reviewedAt !== null ||
      route.review.approvalDigest !== null
    ) {
      throw new Error(`R7 route is not an unreviewed pilot draft ${route.routeId}`)
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
  if (
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 route review packet must not claim owner approval')
  }
  return {
    value,
    semanticDigest: routeReviewRequestSemanticDigest(value)
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
    generatedAt: request.value.sourceSnapshot.checkedAt,
    status: 'OWNER_DECISION_REQUIRED_ROUTE_REVIEW',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    authorizationState: 'not-authorized',
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
      reviewDecision: 'OWNER_DECISION_REQUIRED'
    })),
    requiredApprover: request.value.reviewRequirements.requiredApprover,
    stillProhibited: request.value.stillProhibited,
    currentDraftRouteCount: request.value.routeReviews.length,
    reviewedRouteCount: 0,
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED'
  }
  return {
    artifacts: { 'r7-pilot-route-review-report.json': report },
    source: { r7PilotRouteReviewRequestDigest: digest(requestRaw) },
    output: {
      r7PilotRouteReviewDecisionCount: report.routeReviews.length,
      r7PilotRouteReviewAuthorizedCount: 0,
      r7PilotRouteReviewPendingCount: report.routeReviews.length,
      r7ReviewedConcreteRouteCount: 0
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

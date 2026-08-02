const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const R7RendererDecisionCompilerVersion = 'quest-growth-r7-renderer-decision-compiler/1'
const R7RendererDecisionOutputFilenames = ['r7-renderer-integration-report.json']
const CommitPattern = /^[0-9a-f]{40}$/
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const FocusByFamily = {
  'expedition-resource-periodic-loop': 'resources',
  'anti-submarine-foundation': 'asw'
}
const ExpectedDisplaySections = [
  'title',
  'summary',
  'applicability-checklist',
  'fleet-and-equipment-constraints',
  'branch-conditions',
  'manual-instructions',
  'fallback',
  'review-currentness'
]
const ExpectedLabels = [
  'reviewed-route',
  'manual-confirmation-required',
  'selected-focus-candidate'
]
const ExpectedForbiddenClaims = [
  'account-is-ready',
  'route-is-currently-executable',
  'route-is-optimal',
  'success-is-guaranteed',
  'all-applicability-conditions-are-satisfied'
]
const ExpectedHideReasons = [
  'status-is-not-reviewed',
  'semantic-digest-mismatch',
  'review-metadata-invalid',
  'review-by-reached',
  'valid-until-reached',
  'focus-not-selected-or-not-mapped',
  'unsupported-output-class',
  'route-count-exceeds-two'
]
const ExpectedAcceptanceChecks = [
  'default-closed-opt-in',
  'focus-to-route-filtering',
  'digest-and-currentness-fail-closed',
  'manual-check-labels',
  'no-route-fallback',
  'narrow-and-wide-layout-without-horizontal-overflow',
  'no-main-preload-network-storage-or-account-data-dependency'
]
const ExpectedProhibited = [
  'real-account-acceptance',
  'runtime-publication',
  'default-enablement',
  'route-content-mutation',
  'unreviewed-route-display',
  'automatic-game-operation',
  'game-communication-mutation',
  'runtime-web-scraping',
  'account-data-export',
  'persistent-opt-in-state'
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

function rendererRequestSemanticDigest(value) {
  const payload = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'status' && key !== 'review')
  )
  return digest(
    canonicalJson({
      ...payload,
      requestedAuthorization: Object.fromEntries(
        Object.entries(payload.requestedAuthorization).filter(
          ([key]) => !['authorizationState', 'implementationAuthorization'].includes(key)
        )
      )
    })
  )
}

function validateR7RendererIntegrationRequest(
  value,
  { root, base, r7AuthorizationReport, r7SchemaReport, r7RouteReviewReport }
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
      'requestedAuthorization',
      'routeBindings',
      'rendererContract',
      'failClosedPolicy',
      'implementationBoundary',
      'acceptanceBoundary',
      'stillProhibited',
      'review'
    ],
    'R7 renderer integration request'
  )
  if (value.authoringSchema !== 'QuestGrowthR7RendererIntegrationRequest/1alpha') {
    throw new Error('unsupported R7 renderer integration request schema')
  }
  identifier(value.requestId, 'R7 renderer request id')
  if (value.revision !== 1) throw new Error('invalid R7 renderer request revision')
  if (value.status !== 'draft' || value.scope !== 'R7_RENDERER_OPT_IN_INTEGRATION_ONLY') {
    throw new Error('R7 renderer request must remain draft and integration-only')
  }
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R7 renderer snapshot')
  if (!CommitPattern.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R7 renderer audited commit')
  }
  timestamp(value.sourceSnapshot.checkedAt, 'R7 renderer checkedAt')

  const authorizationRequestRaw = fs.readFileSync(
    path.join(base, 'decisions', 'r7-authorization-request.json')
  )
  const growthComponentRaw = fs.readFileSync(
    path.join(root, 'src', 'renderer', 'src', 'components', 'QuestGrowthCheck.vue')
  )
  const growthSnapshotRaw = fs.readFileSync(
    path.join(root, 'src', 'renderer', 'src', 'common', 'quest-growth-snapshot.ts')
  )
  const questGuideRaw = fs.readFileSync(
    path.join(root, 'src', 'renderer', 'src', 'components', 'QuestGuide.vue')
  )
  const rendererGate = r7AuthorizationReport.authorizationGates.find(
    (gate) => gate.gateId === 'r7-renderer-opt-in-integration'
  )
  const expectedBasis = {
    rendererGateSemanticDigest: rendererGate?.semanticDigest,
    authorizationRequestDigest: digest(authorizationRequestRaw),
    routeReviewSemanticDigest: r7RouteReviewReport.semanticDigest,
    routeReviewRequestDigest: r7RouteReviewReport.requestDigest,
    routeCatalogDigest: r7SchemaReport.catalogDigest,
    routeSchemaDigest: r7SchemaReport.schemaDigest,
    growthComponentDigest: digest(growthComponentRaw),
    growthSnapshotDigest: digest(growthSnapshotRaw),
    questGuideDigest: digest(questGuideRaw)
  }
  exactKeys(value.approvalBasis, Object.keys(expectedBasis), 'R7 renderer approval basis')
  for (const [key, item] of Object.entries(value.approvalBasis)) {
    if (!DigestPattern.test(item)) throw new Error(`invalid R7 renderer basis ${key}`)
  }
  if (!same(value.approvalBasis, expectedBasis)) {
    throw new Error('R7 renderer approval basis mismatch')
  }
  if (
    rendererGate?.authorizationState !== 'not-authorized' ||
    r7RouteReviewReport.authorizationState !== 'authorized' ||
    r7RouteReviewReport.reviewedRouteCount !== 2 ||
    r7RouteReviewReport.runtimeEligibleCount !== 0 ||
    r7RouteReviewReport.publicationAuthorization !== 'R7_NOT_AUTHORIZED' ||
    r7SchemaReport.reviewedConcreteRouteArtifactCount !== 2 ||
    r7SchemaReport.runtimeEligibleCount !== 0
  ) {
    throw new Error('R7 renderer prerequisites are invalid')
  }

  exactKeys(
    value.requestedAuthorization,
    [
      'gateId',
      'authorizationState',
      'maximumDisplayedRoutes',
      'integrationMode',
      'implementationAuthorization'
    ],
    'R7 renderer requested authorization'
  )
  if (
    value.requestedAuthorization.gateId !== 'r7-renderer-opt-in-integration' ||
    value.requestedAuthorization.authorizationState !== 'owner-decision-required' ||
    value.requestedAuthorization.maximumDisplayedRoutes !== 2 ||
    value.requestedAuthorization.integrationMode !== 'session-only-explicit-expand' ||
    value.requestedAuthorization.implementationAuthorization !== 'not-authorized'
  ) {
    throw new Error('R7 renderer authorization boundary mismatch')
  }

  const catalog = JSON.parse(fs.readFileSync(path.join(base, 'r7', 'route-catalog.json')))
  if (!Array.isArray(value.routeBindings) || value.routeBindings.length !== 2) {
    throw new Error('R7 renderer route binding count mismatch')
  }
  const routesById = new Map(catalog.routes.map((route) => [route.routeId, route]))
  for (const [index, binding] of value.routeBindings.entries()) {
    exactKeys(
      binding,
      [
        'routeId',
        'routeFamily',
        'routeRevision',
        'routeSemanticDigest',
        'focus',
        'presentationClass'
      ],
      `R7 renderer route binding ${index}`
    )
    const reviewed = r7RouteReviewReport.routeReviews[index]
    const route = routesById.get(binding.routeId)
    const expected = {
      routeId: reviewed.routeId,
      routeFamily: reviewed.routeFamily,
      routeRevision: reviewed.routeRevision,
      routeSemanticDigest: reviewed.routeSemanticDigest,
      focus: FocusByFamily[reviewed.routeFamily],
      presentationClass: route?.outputClass
    }
    if (!same(binding, expected) || route?.status !== 'reviewed') {
      throw new Error(`R7 renderer route binding mismatch ${binding.routeId}`)
    }
  }

  exactKeys(
    value.rendererContract,
    [
      'targetComponent',
      'defaultVisible',
      'activation',
      'selectionPersistence',
      'focusRequired',
      'allowedDisplaySections',
      'requiredLabels',
      'forbiddenClaims',
      'fallbackBehavior'
    ],
    'R7 renderer contract'
  )
  if (
    value.rendererContract.targetComponent !==
      'src/renderer/src/components/QuestGrowthCheck.vue' ||
    value.rendererContract.defaultVisible !== false ||
    value.rendererContract.activation !== 'explicit-details-open' ||
    value.rendererContract.selectionPersistence !== 'none' ||
    value.rendererContract.focusRequired !== true ||
    !same(value.rendererContract.allowedDisplaySections, ExpectedDisplaySections) ||
    !same(value.rendererContract.requiredLabels, ExpectedLabels) ||
    !same(value.rendererContract.forbiddenClaims, ExpectedForbiddenClaims) ||
    value.rendererContract.fallbackBehavior !==
      'keep-existing-growth-check-and-hide-concrete-route'
  ) {
    throw new Error('R7 renderer display contract mismatch')
  }

  exactKeys(
    value.failClosedPolicy,
    [
      'hideRouteWhen',
      'unknownLocalFactBehavior',
      'expiredRouteBehavior',
      'emptyMatchBehavior'
    ],
    'R7 renderer fail-closed policy'
  )
  if (
    !same(value.failClosedPolicy.hideRouteWhen, ExpectedHideReasons) ||
    value.failClosedPolicy.unknownLocalFactBehavior !==
      'show-manual-check-without-eligibility-verdict' ||
    value.failClosedPolicy.expiredRouteBehavior !==
      'hide-route-and-show-knowledge-review-required' ||
    value.failClosedPolicy.emptyMatchBehavior !== 'show-existing-non-route-fallback'
  ) {
    throw new Error('R7 renderer fail-closed policy mismatch')
  }

  exactKeys(
    value.implementationBoundary,
    [
      'rendererOnly',
      'allowedProductionAreas',
      'forbiddenProductionAreas',
      'newMainOrPreloadBridgeAllowed',
      'networkAccessAllowed',
      'databaseAccessAllowed',
      'storageAllowed',
      'gameCommunicationAccessAllowed',
      'automaticGameOperationAllowed',
      'rawAccountDataInRouteModelAllowed'
    ],
    'R7 renderer implementation boundary'
  )
  if (
    value.implementationBoundary.rendererOnly !== true ||
    !same(value.implementationBoundary.allowedProductionAreas, ['src/common', 'src/renderer']) ||
    !same(value.implementationBoundary.forbiddenProductionAreas, ['src/main', 'src/preload']) ||
    [
      'newMainOrPreloadBridgeAllowed',
      'networkAccessAllowed',
      'databaseAccessAllowed',
      'storageAllowed',
      'gameCommunicationAccessAllowed',
      'automaticGameOperationAllowed',
      'rawAccountDataInRouteModelAllowed'
    ].some((key) => value.implementationBoundary[key] !== false)
  ) {
    throw new Error('R7 renderer implementation boundary mismatch')
  }

  exactKeys(
    value.acceptanceBoundary,
    [
      'syntheticFixturesOnly',
      'requiredChecks',
      'realAccountAcceptanceAuthorized',
      'runtimePublicationAuthorized',
      'defaultEnablementAuthorized'
    ],
    'R7 renderer acceptance boundary'
  )
  if (
    value.acceptanceBoundary.syntheticFixturesOnly !== true ||
    !same(value.acceptanceBoundary.requiredChecks, ExpectedAcceptanceChecks) ||
    value.acceptanceBoundary.realAccountAcceptanceAuthorized !== false ||
    value.acceptanceBoundary.runtimePublicationAuthorized !== false ||
    value.acceptanceBoundary.defaultEnablementAuthorized !== false
  ) {
    throw new Error('R7 renderer acceptance boundary mismatch')
  }
  if (!same(value.stillProhibited, ExpectedProhibited)) {
    throw new Error('R7 renderer prohibited behavior mismatch')
  }
  exactKeys(value.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'R7 renderer review')
  identifier(value.review.author, 'R7 renderer packet author')
  if (
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 renderer packet must not claim approval')
  }
  return { value, semanticDigest: rendererRequestSemanticDigest(value) }
}

function buildR7RendererDecisionArtifacts({
  root,
  base,
  r7AuthorizationReport,
  r7SchemaReport,
  r7RouteReviewReport
}) {
  const requestPath = path.join(base, 'decisions', 'r7-renderer-integration-request.json')
  const requestRaw = fs.readFileSync(requestPath)
  const request = validateR7RendererIntegrationRequest(JSON.parse(requestRaw), {
    root,
    base,
    r7AuthorizationReport,
    r7SchemaReport,
    r7RouteReviewReport
  })
  const report = {
    schemaVersion: 1,
    compilerVersion: R7RendererDecisionCompilerVersion,
    generatedAt: request.value.sourceSnapshot.checkedAt,
    status: 'OWNER_DECISION_REQUIRED_RENDERER_INTEGRATION',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    gateId: request.value.requestedAuthorization.gateId,
    gateSemanticDigest: request.value.approvalBasis.rendererGateSemanticDigest,
    authorizationState: 'not-authorized',
    implementationAuthorization: 'not-authorized',
    integrationMode: request.value.requestedAuthorization.integrationMode,
    maximumDisplayedRoutes: request.value.requestedAuthorization.maximumDisplayedRoutes,
    routeBindings: request.value.routeBindings,
    optIn: {
      defaultVisible: request.value.rendererContract.defaultVisible,
      activation: request.value.rendererContract.activation,
      selectionPersistence: request.value.rendererContract.selectionPersistence,
      focusRequired: request.value.rendererContract.focusRequired
    },
    failClosedReasonCount: request.value.failClosedPolicy.hideRouteWhen.length,
    requiredSyntheticCheckCount: request.value.acceptanceBoundary.requiredChecks.length,
    stillProhibited: request.value.stillProhibited,
    reviewedRouteCount: r7RouteReviewReport.reviewedRouteCount,
    rendererEligibleRouteCount: 0,
    realAccountAcceptanceAuthorization: 'R7_NOT_AUTHORIZED',
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED',
    defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED'
  }
  return {
    artifacts: { 'r7-renderer-integration-report.json': report },
    source: { r7RendererIntegrationRequestDigest: digest(requestRaw) },
    output: {
      r7RendererDecisionRouteCount: report.routeBindings.length,
      r7RendererAuthorizedRouteCount: 0,
      r7RendererRequiredSyntheticCheckCount: report.requiredSyntheticCheckCount
    }
  }
}

module.exports = {
  R7RendererDecisionOutputFilenames,
  buildR7RendererDecisionArtifacts,
  rendererRequestSemanticDigest,
  validateR7RendererIntegrationRequest
}

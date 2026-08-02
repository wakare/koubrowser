const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const CompilerVersion = 'quest-growth-r7-publication-candidate-review-decision-compiler/1'
const OutputFilenames = ['r7-publication-candidate-review-report.json']
const FixedSemanticDigest =
  'sha256:bc9d096f70338ad46de385ca9b1855d291956a8c6984748a7843836616244d33'
const CommitPattern = /^[0-9a-f]{40}$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ProtectedPaths = [
  'src/main/kcbrowser.ts',
  'src/preload/xhr-hook.ts',
  'src/common/kcsapi_hook.ts'
]
const AuthorizedPaths = [
  'knowledge/quest-growth/r7/runtime-publication-candidate.json',
  'knowledge/quest-growth/reviews/r7-runtime-publication-candidate-review.json',
  'scripts/quest-growth-r7-publication-candidate.js',
  'src/common/__tests__/quest_growth_publication_candidate.test.ts'
]
const RequiredRouteBindings = [
  {
    routeId: 'route:expedition-05-resource-loop:draft-1',
    routeFamily: 'expedition-resource-periodic-loop',
    revision: 1,
    semanticDigest:
      'sha256:05e4cdbbcbdbf7a781ba73bbe1bb3498cc7c0bab6985fef4b1cae6173acda55a',
    status: 'reviewed'
  },
  {
    routeId: 'route:1-5-basic-asw-three-battle:draft-1',
    routeFamily: 'anti-submarine-foundation',
    revision: 1,
    semanticDigest:
      'sha256:9b675d5c8a33b3ec974c678a3f258200324222f1e7bec1c2b2ba5e4c3512e78d',
    status: 'reviewed'
  }
]
const RequiredChecks = [
  'candidate-has-exactly-two-fixed-reviewed-route-bindings',
  'candidate-schema-version-and-fields-are-strict',
  'candidate-canonical-digest-is-reproducible',
  'route-content-and-reviewed-route-digests-are-unchanged',
  'both-route-currentness-windows-cover-the-review-time',
  'reviewer-is-independent-from-candidate-author',
  'no-signature-private-key-or-distribution-endpoint-is-used',
  'protected-game-communication-digests-remain-fixed'
]
const ExpectedProhibited = [
  'bundle-signing',
  'private-key-or-credential-handling',
  'production-manifest-or-payload-generation',
  'runtime-publication',
  'default-enablement',
  'production-url-or-public-key-configuration',
  'real-distribution-endpoint',
  'real-account-execution',
  'route-content-mutation',
  'withdrawal-authoring',
  'other-route-family-authoring',
  'game-communication-mutation',
  'automatic-game-operation',
  'installer-publication'
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

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function publicationCandidateReviewRequestSemanticDigest(value) {
  const payload = Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => key !== 'status' && key !== 'review' && key !== 'implementationResult'
    )
  )
  return digest(
    canonicalJson({
      ...payload,
      requestedAuthorization: Object.fromEntries(
        Object.entries(payload.requestedAuthorization).filter(
          ([key]) => !['authorizationState', 'authoringAuthorization'].includes(key)
        )
      )
    })
  )
}

function validateR7PublicationCandidateReviewRequest(value, { root, base }) {
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
      'candidateContract',
      'independentReviewContract',
      'implementationResult',
      'executionBoundary',
      'stillProhibited',
      'review'
    ],
    'R7 publication candidate review request'
  )
  if (
    value.authoringSchema !== 'QuestGrowthR7PublicationCandidateReviewRequest/1alpha' ||
    value.requestId !== 'decision:quest-growth-r7-publication-candidate-review-authoring' ||
    value.revision !== 1 ||
    !['draft', 'approved'].includes(value.status) ||
    value.scope !== 'R7_PUBLICATION_CANDIDATE_REVIEW_AUTHORING_ONLY'
  ) {
    throw new Error('R7 publication candidate review scope mismatch')
  }
  const approved = value.status === 'approved'
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R7 candidate snapshot')
  if (
    !CommitPattern.test(value.sourceSnapshot.auditedBaseCommit) ||
    !TimestampPattern.test(value.sourceSnapshot.checkedAt) ||
    !Number.isFinite(Date.parse(value.sourceSnapshot.checkedAt))
  ) {
    throw new Error('invalid R7 publication candidate source snapshot')
  }

  const authoringReportRaw = fs.readFileSync(
    path.join(base, 'generated', 'r7-runtime-publication-authoring-report.json')
  )
  const authoringReport = JSON.parse(authoringReportRaw)
  const expectedBasis = {
    runtimeAuthoringSemanticDigest:
      'sha256:580d7002173588b74d1e6327adf4235a20eeb12477d43689a9599adb86b42104',
    runtimeAuthoringReportDigest: digest(authoringReportRaw),
    runtimeAuthoringStatus:
      'R7_RUNTIME_PUBLICATION_AUTHORING_IMPLEMENTED_ANONYMOUSLY_VERIFIED',
    runtimeAuthoringImplementationCommit: '221a1643730ba6da4dee831602ea7c06682f4632',
    routeCatalogDigest: digest(
      fs.readFileSync(path.join(base, 'r7', 'route-catalog.json'))
    ),
    routeSelectorDigest: digest(
      fs.readFileSync(path.join(root, 'src', 'common', 'quest_growth_reviewed_routes.ts'))
    ),
    questKnowledgeUpdateDigest: digest(
      fs.readFileSync(path.join(root, 'src', 'common', 'quest_knowledge_update.ts'))
    ),
    dataUpdatePublisherDigest: digest(
      fs.readFileSync(path.join(root, 'scripts', 'create-data-update-bundle.js'))
    ),
    protectedCommunicationDigests: Object.fromEntries(
      ProtectedPaths.map((item) => [
        item,
        digest(fs.readFileSync(path.join(root, ...item.split('/'))))
      ])
    )
  }
  exactKeys(value.approvalBasis, Object.keys(expectedBasis), 'R7 candidate approval basis')
  exactKeys(
    value.approvalBasis.protectedCommunicationDigests,
    ProtectedPaths,
    'R7 candidate protected communication digests'
  )
  if (
    !same(value.approvalBasis, expectedBasis) ||
    authoringReport.status !== expectedBasis.runtimeAuthoringStatus ||
    authoringReport.implementationCommit !==
      expectedBasis.runtimeAuthoringImplementationCommit ||
    authoringReport.implementationAuthorization !== 'consumed' ||
    authoringReport.runtimeEligibleCount !== 0 ||
    authoringReport.publicationAuthorization !== 'R7_NOT_AUTHORIZED'
  ) {
    throw new Error('R7 publication candidate approval basis mismatch')
  }

  exactKeys(
    value.requestedAuthorization,
    [
      'gateId',
      'authorizationState',
      'authoringAuthorization',
      'maximumCandidateRoutes',
      'authorizedPaths'
    ],
    'R7 candidate requested authorization'
  )
  if (
    value.requestedAuthorization.gateId !==
      'r7-publication-candidate-review-authoring' ||
    value.requestedAuthorization.authorizationState !==
      (approved ? 'authorized' : 'not-authorized') ||
    value.requestedAuthorization.authoringAuthorization !==
      (approved ? 'authorized' : 'not-authorized') ||
    value.requestedAuthorization.maximumCandidateRoutes !== 2 ||
    !same(value.requestedAuthorization.authorizedPaths, AuthorizedPaths)
  ) {
    throw new Error('R7 publication candidate authoring authorization mismatch')
  }

  exactKeys(
    value.candidateContract,
    [
      'candidateVersion',
      'schemaVersion',
      'publicationAuthorizationToken',
      'signatureMode',
      'requiredRouteBindings',
      'routeContentMutationAuthorized',
      'withdrawalAuthoringAuthorized'
    ],
    'R7 candidate contract'
  )
  if (
    value.candidateContract.candidateVersion !== 'r7.candidate.20260802.1' ||
    value.candidateContract.schemaVersion !== 1 ||
    value.candidateContract.publicationAuthorizationToken !==
      'R7_RUNTIME_SIGNED_CANDIDATE' ||
    value.candidateContract.signatureMode !== 'none-canonical-payload-only' ||
    !same(value.candidateContract.requiredRouteBindings, RequiredRouteBindings) ||
    value.candidateContract.routeContentMutationAuthorized !== false ||
    value.candidateContract.withdrawalAuthoringAuthorized !== false
  ) {
    throw new Error('R7 publication candidate contract mismatch')
  }

  exactKeys(
    value.independentReviewContract,
    [
      'reviewAuthorMustDifferFromCandidateAuthor',
      'requiredReviewerRole',
      'approvalDecision',
      'requiredChecks'
    ],
    'R7 candidate independent review contract'
  )
  if (
    value.independentReviewContract.reviewAuthorMustDifferFromCandidateAuthor !== true ||
    value.independentReviewContract.requiredReviewerRole !== 'project-owner' ||
    value.independentReviewContract.approvalDecision !==
      'separate-fixed-digest-required' ||
    !same(value.independentReviewContract.requiredChecks, RequiredChecks)
  ) {
    throw new Error('R7 publication candidate independent review mismatch')
  }
  if (value.implementationResult !== null) {
    throw new Error('R7 publication candidate request must not claim implementation')
  }

  exactKeys(
    value.executionBoundary,
    [
      'bundleSigningAuthorized',
      'privateKeyHandlingAuthorized',
      'productionManifestOrPayloadAuthorized',
      'runtimePublicationAuthorized',
      'defaultEnablementAuthorized',
      'productionUrlOrPublicKeyConfigurationAuthorized',
      'realDistributionEndpointAuthorized',
      'realAccountExecutionAuthorized',
      'otherRouteFamiliesAuthorized',
      'gameCommunicationChangesAuthorized',
      'installerBuildRequiredAtThisGate'
    ],
    'R7 candidate execution boundary'
  )
  if (Object.values(value.executionBoundary).some((item) => item !== false)) {
    throw new Error('R7 publication candidate execution boundary widened')
  }
  if (!same(value.stillProhibited, ExpectedProhibited)) {
    throw new Error('R7 publication candidate prohibited behavior mismatch')
  }
  exactKeys(value.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'R7 candidate review')
  const semanticDigest = publicationCandidateReviewRequestSemanticDigest(value)
  if (semanticDigest !== FixedSemanticDigest) {
    throw new Error('R7 publication candidate semantic digest mismatch')
  }
  if (approved) {
    if (
      value.review.approver !== 'project-owner' ||
      !TimestampPattern.test(value.review.reviewedAt) ||
      value.review.approvalDigest !== semanticDigest
    ) {
      throw new Error('approved R7 publication candidate digest mismatch')
    }
  } else if (
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 publication candidate request must not claim approval')
  }
  return { value, semanticDigest, approved }
}

function buildR7PublicationCandidateReviewDecisionArtifacts({ root, base }) {
  const requestPath = path.join(
    base,
    'decisions',
    'r7-publication-candidate-review-request.json'
  )
  const requestRaw = fs.readFileSync(requestPath)
  const request = validateR7PublicationCandidateReviewRequest(JSON.parse(requestRaw), {
    root,
    base
  })
  const report = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    generatedAt: request.approved
      ? request.value.review.reviewedAt
      : request.value.sourceSnapshot.checkedAt,
    status: request.approved
      ? 'R7_PUBLICATION_CANDIDATE_REVIEW_AUTHORING_AUTHORIZED'
      : 'OWNER_DECISION_REQUIRED_R7_PUBLICATION_CANDIDATE_REVIEW_AUTHORING',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    gateId: request.value.requestedAuthorization.gateId,
    authorizationState: request.approved ? 'authorized' : 'not-authorized',
    authoringAuthorization: request.approved ? 'authorized' : 'not-authorized',
    maximumCandidateRoutes: request.value.requestedAuthorization.maximumCandidateRoutes,
    authorizedPaths: request.value.requestedAuthorization.authorizedPaths,
    candidateVersion: request.value.candidateContract.candidateVersion,
    signatureMode: request.value.candidateContract.signatureMode,
    requiredRouteCount: request.value.candidateContract.requiredRouteBindings.length,
    requiredCheckCount: request.value.independentReviewContract.requiredChecks.length,
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED',
    defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED',
    stillProhibited: request.value.stillProhibited
  }
  return {
    artifacts: { 'r7-publication-candidate-review-report.json': report },
    source: { r7PublicationCandidateReviewRequestDigest: digest(requestRaw) },
    output: {
      r7PublicationCandidateReviewOwnerDecisionRequired: !request.approved,
      r7PublicationCandidateReviewAuthorizedNotImplemented: request.approved,
      r7PublicationCandidateReviewAuthorizedPathCount: request.approved
        ? report.authorizedPaths.length
        : 0,
      r7PublicationCandidateReviewRequiredCheckCount: report.requiredCheckCount
    }
  }
}

module.exports = {
  R7PublicationCandidateReviewDecisionOutputFilenames: OutputFilenames,
  buildR7PublicationCandidateReviewDecisionArtifacts,
  publicationCandidateReviewRequestSemanticDigest,
  validateR7PublicationCandidateReviewRequest
}

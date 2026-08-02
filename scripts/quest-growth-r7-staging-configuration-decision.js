const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const {
  validateStagingConfigurationFiles
} = require('./quest-growth-r7-staging-configuration')

const CompilerVersion = 'quest-growth-r7-staging-configuration-decision-compiler/2'
const R7StagingConfigurationDecisionOutputFilenames = [
  'r7-staging-configuration-authoring-report.json'
]
const RequestPath =
  'knowledge/quest-growth/decisions/r7-staging-configuration-authoring-request.json'
const CandidatePath = 'knowledge/quest-growth/r7/runtime-publication-candidate.json'
const CandidateReviewPath =
  'knowledge/quest-growth/reviews/r7-runtime-publication-candidate-review.json'
const DeploymentPath = 'src/main/data-update-deployment.ts'
const ProtectedPaths = [
  'src/main/kcbrowser.ts',
  'src/preload/xhr-hook.ts',
  'src/common/kcsapi_hook.ts'
]
const AuthorizedDraftPaths = [
  'knowledge/quest-growth/r7/staging-configuration.schema.json',
  'knowledge/quest-growth/r7/fixtures/staging-configuration-anonymous.json',
  'scripts/quest-growth-r7-staging-configuration.js',
  'src/common/__tests__/quest_growth_staging_configuration.test.ts'
]
const FixedDraftDigests = {
  'knowledge/quest-growth/r7/staging-configuration.schema.json':
    'sha256:d62f7197690a034edfd339550e08698152ff023d2854d0447e2a5302829f67d3',
  'knowledge/quest-growth/r7/fixtures/staging-configuration-anonymous.json':
    'sha256:194df1cb97abd2af38ff39cf44dda6879ca43b55b10a2bbe45f74f0475271b70',
  'scripts/quest-growth-r7-staging-configuration.js':
    'sha256:aa601746a16fc4547221d49a75aca5d9edb2e6037c1e59b42ffaa180277b8b43',
  'src/common/__tests__/quest_growth_staging_configuration.test.ts':
    'sha256:7eeddf9f31890e3ce2ddf327cc44f038bbd082e91619fc641892a4b4443ab7db'
}
const RequiredRouteIds = [
  'route:expedition-05-resource-loop:draft-1',
  'route:1-5-basic-asw-three-battle:draft-1'
]
const RequiredChecks = [
  'strict-schema-rejects-unknown-fields',
  'exactly-two-fixed-reviewed-route-bindings',
  'candidate-version-and-canonical-digest-remain-fixed',
  'reserved-invalid-placeholder-is-the-only-url',
  'key-material-and-fingerprint-values-are-absent',
  'external-connection-and-publication-remain-unauthorized',
  'default-enabled-remains-false-and-runtime-eligible-count-remains-zero',
  'session-only-and-bundled-fallback-remain-fixed',
  'protected-game-communication-digests-remain-fixed'
]
const ExpectedProhibited = [
  'key-material',
  'bundle-signing',
  'real-staging-or-production-url',
  'external-endpoint-connection',
  'runtime-publication',
  'default-enablement',
  'other-route-family',
  'game-communication-mutation',
  'installer-build'
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

function readDigest(root, filename) {
  return digest(fs.readFileSync(path.join(root, ...filename.split('/'))))
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

function stagingConfigurationRequestSemanticDigest(value) {
  const payload = Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => !['status', 'draftingResult', 'review'].includes(key)
    )
  )
  return digest(
    canonicalJson({
      ...payload,
      requestedAuthorization: Object.fromEntries(
        Object.entries(payload.requestedAuthorization).filter(
          ([key]) => !['draftingAuthorization', 'ownerFixedDigestReview'].includes(key)
        )
      )
    })
  )
}

function validateR7StagingConfigurationAuthoringRequest(value, root) {
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
      'configurationContract',
      'verificationContract',
      'draftingResult',
      'executionBoundary',
      'stillProhibited',
      'review'
    ],
    'R7 staging configuration request'
  )
  if (
    value.authoringSchema !== 'QuestGrowthR7StagingConfigurationAuthoringRequest/1alpha' ||
    value.requestId !== 'decision:quest-growth-r7-staging-configuration-authoring' ||
    value.revision !== 1 ||
    !['draft-artifacts-authored', 'approved'].includes(value.status) ||
    value.scope !== 'R7_STAGING_CONFIGURATION_AUTHORING_DRAFT_ONLY'
  ) {
    throw new Error('R7 staging configuration request scope mismatch')
  }
  const approved = value.status === 'approved'

  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R7 staging source')
  if (
    value.sourceSnapshot.auditedBaseCommit !==
      'a85c78f74d286562417ee2ed0c15e202e08d60b1' ||
    value.sourceSnapshot.checkedAt !== '2026-08-02T11:39:32.000Z'
  ) {
    throw new Error('R7 staging configuration source mismatch')
  }

  const expectedBasis = {
    candidateVersion: 'r7.candidate.20260802.1',
    candidateCanonicalDigest:
      'sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c',
    candidateFileDigest: readDigest(root, CandidatePath),
    candidateReviewSemanticDigest:
      'sha256:4e0d52638b60b90e2aec0bfdc9f9c2eaca500d4c32751245e649a5e43adac94c',
    candidateReviewFileDigest: readDigest(root, CandidateReviewPath),
    candidateReviewStatus: 'approved',
    dataUpdateDeploymentDigest: readDigest(root, DeploymentPath),
    protectedCommunicationDigests: Object.fromEntries(
      ProtectedPaths.map((item) => [item, readDigest(root, item)])
    )
  }
  exactKeys(value.approvalBasis, Object.keys(expectedBasis), 'R7 staging approval basis')
  exactKeys(
    value.approvalBasis.protectedCommunicationDigests,
    ProtectedPaths,
    'R7 staging protected communication digests'
  )
  if (!same(value.approvalBasis, expectedBasis)) {
    throw new Error('R7 staging configuration approval basis mismatch')
  }

  exactKeys(
    value.requestedAuthorization,
    [
      'gateId',
      'draftingAuthorization',
      'ownerFixedDigestReview',
      'maximumRouteCount',
      'authorizedDraftPaths'
    ],
    'R7 staging requested authorization'
  )
  if (
    value.requestedAuthorization.gateId !== 'r7-staging-configuration-authoring' ||
    value.requestedAuthorization.draftingAuthorization !== 'consumed' ||
    value.requestedAuthorization.ownerFixedDigestReview !==
      (approved ? 'consumed' : 'required') ||
    value.requestedAuthorization.maximumRouteCount !== 2 ||
    !same(value.requestedAuthorization.authorizedDraftPaths, AuthorizedDraftPaths)
  ) {
    throw new Error('R7 staging drafting authorization mismatch')
  }

  exactKeys(
    value.configurationContract,
    [
      'schemaVersion',
      'configurationId',
      'mode',
      'candidateVersion',
      'candidateCanonicalDigest',
      'requiredRouteIds',
      'endpointClass',
      'placeholderManifestUrl',
      'trustAlgorithmLabel',
      'keyMaterialState',
      'fingerprintState',
      'publicationAuthorized',
      'defaultEnabled',
      'runtimeEligibleCount',
      'sessionOnly',
      'fallback'
    ],
    'R7 staging configuration contract'
  )
  if (
    value.configurationContract.schemaVersion !== 1 ||
    value.configurationContract.configurationId !== 'r7.staging.anonymous.20260802.1' ||
    value.configurationContract.mode !== 'anonymous-authoring-fixture' ||
    value.configurationContract.candidateVersion !== 'r7.candidate.20260802.1' ||
    value.configurationContract.candidateCanonicalDigest !==
      expectedBasis.candidateCanonicalDigest ||
    !same(value.configurationContract.requiredRouteIds, RequiredRouteIds) ||
    value.configurationContract.endpointClass !== 'reserved-invalid-placeholder' ||
    value.configurationContract.placeholderManifestUrl !==
      'https://r7-staging.invalid/data/manifest.json' ||
    value.configurationContract.trustAlgorithmLabel !== 'Ed25519' ||
    value.configurationContract.keyMaterialState !== 'absent-separate-gate-required' ||
    value.configurationContract.fingerprintState !== 'absent-separate-gate-required' ||
    value.configurationContract.publicationAuthorized !== false ||
    value.configurationContract.defaultEnabled !== false ||
    value.configurationContract.runtimeEligibleCount !== 0 ||
    value.configurationContract.sessionOnly !== true ||
    value.configurationContract.fallback !== 'bundled-opt-in-catalog'
  ) {
    throw new Error('R7 staging configuration contract mismatch')
  }

  exactKeys(
    value.verificationContract,
    ['offlineOnly', 'requiredChecks'],
    'R7 staging verification contract'
  )
  if (
    value.verificationContract.offlineOnly !== true ||
    !same(value.verificationContract.requiredChecks, RequiredChecks)
  ) {
    throw new Error('R7 staging verification contract mismatch')
  }

  exactKeys(
    value.draftingResult,
    [
      'recordedAt',
      'implementationCommit',
      'changedPathDigests',
      'validatorTestCount',
      'fullTestCount',
      'typecheckPassed',
      'genericQuestGrowthCompileCheckPassed',
      'keyMaterialHandled',
      'bundleSigningPerformed',
      'realUrlConfigured',
      'externalEndpointConnected',
      'runtimePublicationPerformed',
      'defaultEnablementChanged',
      'runtimeEligibleCount',
      'installerBuilt',
      'gameCommunicationChangesMade'
    ],
    'R7 staging drafting result'
  )
  exactKeys(
    value.draftingResult.changedPathDigests,
    AuthorizedDraftPaths,
    'R7 staging draft digests'
  )
  if (
    value.draftingResult.recordedAt !== '2026-08-02T11:39:32.000Z' ||
    value.draftingResult.implementationCommit !==
      '1ce9d17064f852c0c10b19d99bdc12bd7406d628' ||
    !same(value.draftingResult.changedPathDigests, FixedDraftDigests) ||
    value.draftingResult.validatorTestCount !== 9 ||
    value.draftingResult.fullTestCount !== 1259 ||
    value.draftingResult.typecheckPassed !== true ||
    value.draftingResult.genericQuestGrowthCompileCheckPassed !== true ||
    value.draftingResult.runtimeEligibleCount !== 0
  ) {
    throw new Error('R7 staging configuration drafting evidence mismatch')
  }
  for (const item of AuthorizedDraftPaths) {
    if (readDigest(root, item) !== value.draftingResult.changedPathDigests[item]) {
      throw new Error(`R7 staging draft file drift: ${item}`)
    }
  }
  for (const item of [
    'keyMaterialHandled',
    'bundleSigningPerformed',
    'realUrlConfigured',
    'externalEndpointConnected',
    'runtimePublicationPerformed',
    'defaultEnablementChanged',
    'installerBuilt',
    'gameCommunicationChangesMade'
  ]) {
    if (value.draftingResult[item] !== false) {
      throw new Error(`R7 staging drafting boundary widened: ${item}`)
    }
  }

  exactKeys(
    value.executionBoundary,
    [
      'keyMaterialHandlingAuthorized',
      'bundleSigningAuthorized',
      'realStagingOrProductionUrlAuthorized',
      'externalEndpointConnectionAuthorized',
      'runtimePublicationAuthorized',
      'defaultEnablementAuthorized',
      'otherRouteFamiliesAuthorized',
      'gameCommunicationChangesAuthorized',
      'installerBuildRequiredAtThisGate'
    ],
    'R7 staging execution boundary'
  )
  if (Object.values(value.executionBoundary).some((item) => item !== false)) {
    throw new Error('R7 staging execution boundary widened')
  }
  if (!same(value.stillProhibited, ExpectedProhibited)) {
    throw new Error('R7 staging prohibited behavior mismatch')
  }

  exactKeys(
    value.review,
    [
      'author',
      'requiredReviewerRole',
      'decision',
      'approver',
      'reviewedAt',
      'approvalDigest'
    ],
    'R7 staging review'
  )
  const semanticDigest = stagingConfigurationRequestSemanticDigest(value)
  if (
    value.review.author !== 'codex-r7-staging-configuration-author' ||
    value.review.requiredReviewerRole !== 'project-owner'
  ) {
    throw new Error('R7 staging configuration reviewer contract mismatch')
  }
  if (approved) {
    if (
      value.review.decision !== 'approved' ||
      value.review.approver !== 'project-owner' ||
      value.review.reviewedAt !== '2026-08-02T11:48:01.276Z' ||
      value.review.approvalDigest !== semanticDigest
    ) {
      throw new Error('approved R7 staging configuration digest mismatch')
    }
  } else if (
    value.review.decision !== 'fixed-semantic-digest-required' ||
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 staging configuration must not claim owner approval')
  }

  validateStagingConfigurationFiles(root)
  return {
    value,
    semanticDigest,
    approved
  }
}

function buildR7StagingConfigurationDecisionArtifacts({ root }) {
  const requestRaw = fs.readFileSync(path.join(root, ...RequestPath.split('/')))
  const request = validateR7StagingConfigurationAuthoringRequest(
    JSON.parse(requestRaw),
    root
  )
  const report = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    generatedAt: request.approved
      ? request.value.review.reviewedAt
      : request.value.draftingResult.recordedAt,
    status: request.approved
      ? 'R7_STAGING_CONFIGURATION_AUTHORING_APPROVED'
      : 'R7_STAGING_CONFIGURATION_DRAFTED_OWNER_FIXED_DIGEST_REQUIRED',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    gateId: request.value.requestedAuthorization.gateId,
    draftingAuthorization: request.value.requestedAuthorization.draftingAuthorization,
    ownerReviewStatus: request.approved ? 'approved' : 'fixed-semantic-digest-required',
    reviewApprovalDigest: request.approved ? request.value.review.approvalDigest : null,
    reviewedAt: request.approved ? request.value.review.reviewedAt : null,
    implementationCommit: request.value.draftingResult.implementationCommit,
    authorizedDraftPaths: request.value.requestedAuthorization.authorizedDraftPaths,
    requiredCheckCount: request.value.verificationContract.requiredChecks.length,
    validatorTestCount: request.value.draftingResult.validatorTestCount,
    fullTestCount: request.value.draftingResult.fullTestCount,
    candidateVersion: request.value.configurationContract.candidateVersion,
    candidateCanonicalDigest:
      request.value.configurationContract.candidateCanonicalDigest,
    routeCount: request.value.requestedAuthorization.maximumRouteCount,
    placeholderHost: 'r7-staging.invalid',
    keyMaterialPresent: false,
    externalConnectionAuthorized: false,
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED',
    defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED',
    stillProhibited: request.value.stillProhibited
  }
  return {
    artifacts: {
      'r7-staging-configuration-authoring-report.json': report
    },
    source: {
      r7StagingConfigurationAuthoringRequestDigest: digest(requestRaw)
    },
    output: {
      r7StagingConfigurationOwnerDecisionRequired: !request.approved,
      r7StagingConfigurationApproved: request.approved,
      r7StagingConfigurationDrafted: true,
      r7StagingConfigurationRequiredCheckCount: report.requiredCheckCount,
      r7StagingConfigurationRouteCount: report.routeCount
    }
  }
}

module.exports = {
  R7StagingConfigurationDecisionOutputFilenames,
  buildR7StagingConfigurationDecisionArtifacts,
  stagingConfigurationRequestSemanticDigest,
  validateR7StagingConfigurationAuthoringRequest
}

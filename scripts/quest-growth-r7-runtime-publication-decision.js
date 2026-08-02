const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const R7RuntimePublicationDecisionCompilerVersion =
  'quest-growth-r7-runtime-publication-decision-compiler/1'
const R7RuntimePublicationDecisionOutputFilenames = [
  'r7-runtime-publication-authoring-report.json'
]
const FixedSemanticDigest =
  'sha256:580d7002173588b74d1e6327adf4235a20eeb12477d43689a9599adb86b42104'
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const CommitPattern = /^[0-9a-f]{40}$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ProtectedPaths = [
  'src/main/kcbrowser.ts',
  'src/preload/xhr-hook.ts',
  'src/common/kcsapi_hook.ts'
]
const AuthorizedPaths = [
  'src/common/quest_growth_reviewed_routes.ts',
  'src/common/quest_knowledge_update.ts',
  'src/renderer/src/stream.ts',
  'scripts/create-data-update-bundle.js',
  'scripts/electron-smoke.js',
  'src/common/__tests__/quest_growth_reviewed_routes.test.ts',
  'src/common/__tests__/quest_knowledge_update.test.ts',
  'src/main/__tests__/data-update.test.ts',
  'src/main/__tests__/electron-smoke-script.test.ts'
]
const ExpectedChanges = [
  'add-a-strict-versioned-growth-route-catalog-to-signed-quest-knowledge-updates',
  'accept-only-the-two-fixed-reviewed-route-digests',
  'feed-verified-route-updates-to-the-existing-session-only-renderer-selector',
  'reject-draft-expired-withdrawn-unknown-version-and-unknown-field-content',
  'restore-the-bundled-opt-in-catalog-when-no-valid-signed-route-update-is-active',
  'extend-the-existing-anonymous-signed-data-update-fixture-with-growth-routes'
]
const ExpectedChecks = [
  'valid-signed-bundle-exposes-only-the-two-fixed-reviewed-routes',
  'invalid-signature-hash-schema-version-or-unknown-field-is-rejected',
  'draft-expired-withdrawn-or-digest-mismatched-route-is-not-displayable',
  'missing-growth-route-update-restores-bundled-opt-in-catalog',
  'newer-signed-withdrawal-hides-the-route-without-reenabling-an-older-bundle',
  'resources-asw-and-unset-fallback-remain-session-only',
  'typecheck-full-tests-production-build-and-anonymous-electron-smoke-pass',
  'protected-game-communication-digests-remain-fixed'
]
const ExpectedProhibited = [
  'runtime-publication',
  'default-enablement',
  'real-distribution-endpoint',
  'production-url-or-public-key-configuration',
  'private-key-or-credential-handling',
  'real-account-execution',
  'route-content-mutation',
  'other-route-family-authoring',
  'game-communication-mutation',
  'automatic-game-operation'
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

function runtimePublicationRequestSemanticDigest(value) {
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
          ([key]) => !['authorizationState', 'implementationAuthorization'].includes(key)
        )
      )
    })
  )
}

function validateR7RuntimePublicationAuthoringRequest(value, { root, base }) {
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
      'changeContract',
      'rollbackContract',
      'verificationContract',
      'implementationResult',
      'executionBoundary',
      'stillProhibited',
      'review'
    ],
    'R7 runtime publication authoring request'
  )
  if (
    value.authoringSchema !== 'QuestGrowthR7RuntimePublicationAuthoringRequest/1alpha' ||
    value.requestId !== 'decision:quest-growth-r7-runtime-publication-authoring' ||
    value.revision !== 1 ||
    !['draft', 'approved'].includes(value.status) ||
    value.scope !== 'R7_RUNTIME_PUBLICATION_AUTHORING_ONLY'
  ) {
    throw new Error('R7 runtime publication authoring scope mismatch')
  }
  const approved = value.status === 'approved'
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R7 publication source')
  if (
    !CommitPattern.test(value.sourceSnapshot.auditedBaseCommit) ||
    !TimestampPattern.test(value.sourceSnapshot.checkedAt) ||
    !Number.isFinite(Date.parse(value.sourceSnapshot.checkedAt))
  ) {
    throw new Error('invalid R7 publication source snapshot')
  }

  const acceptancePath = path.join(base, 'generated', 'r7-real-account-acceptance-report.json')
  const acceptanceRaw = fs.readFileSync(acceptancePath)
  const acceptance = JSON.parse(acceptanceRaw)
  const expectedBasis = {
    runtimePublicationGateSemanticDigest:
      'sha256:1cafef68f4fa841168fc733742100058bb7481a984b041303f03072312f3c3a5',
    runtimePublicationGateAuthorization: 'not-authorized',
    defaultEnablementGateSemanticDigest:
      'sha256:b982afd1d510f5eaed2e17900f703dcc2e3cb2619259d7ffdc32676d766081b8',
    defaultEnablementGateAuthorization: 'not-authorized',
    realAccountAcceptanceSemanticDigest:
      'sha256:497bc51162e26ac696db7219bc876ff56dd0bbfd932e5dddec89a5460a405930',
    realAccountAcceptanceReportDigest: digest(acceptanceRaw),
    realAccountAcceptanceStatus: 'REAL_ACCOUNT_READONLY_ACCEPTANCE_PASSED',
    routeCatalogDigest: digest(
      fs.readFileSync(path.join(base, 'r7', 'route-catalog.json'))
    ),
    routeSelectorDigest: digest(
      fs.readFileSync(path.join(root, 'src', 'common', 'quest_growth_reviewed_routes.ts'))
    ),
    questKnowledgeUpdateDigest: digest(
      fs.readFileSync(path.join(root, 'src', 'common', 'quest_knowledge_update.ts'))
    ),
    dataUpdateRuntimeDigest: digest(
      fs.readFileSync(path.join(root, 'src', 'main', 'data-update.ts'))
    ),
    dataUpdatePublisherDigest: digest(
      fs.readFileSync(path.join(root, 'scripts', 'create-data-update-bundle.js'))
    ),
    dataUpdateDeploymentDigest: digest(
      fs.readFileSync(path.join(root, 'src', 'main', 'data-update-deployment.ts'))
    ),
    protectedCommunicationDigests: Object.fromEntries(
      ProtectedPaths.map((item) => [
        item,
        digest(fs.readFileSync(path.join(root, ...item.split('/'))))
      ])
    )
  }
  exactKeys(value.approvalBasis, Object.keys(expectedBasis), 'R7 publication approval basis')
  exactKeys(
    value.approvalBasis.protectedCommunicationDigests,
    ProtectedPaths,
    'R7 publication protected communication digests'
  )
  if (
    !same(value.approvalBasis, expectedBasis) ||
    acceptance.status !== expectedBasis.realAccountAcceptanceStatus ||
    acceptance.actualAcceptanceStatus !== 'pass' ||
    acceptance.checkedRouteCount !== 2 ||
    acceptance.runtimeEligibleCount !== 0 ||
    acceptance.publicationAuthorization !== 'R7_NOT_AUTHORIZED'
  ) {
    throw new Error('R7 runtime publication approval basis mismatch')
  }

  exactKeys(
    value.requestedAuthorization,
    [
      'gateId',
      'authorizationState',
      'implementationAuthorization',
      'maximumPublishedRoutes',
      'authorizedPaths'
    ],
    'R7 publication requested authorization'
  )
  if (
    value.requestedAuthorization.gateId !== 'r7-runtime-publication-authoring' ||
    value.requestedAuthorization.authorizationState !==
      (approved ? 'authorized' : 'not-authorized') ||
    value.requestedAuthorization.implementationAuthorization !==
      (approved ? 'authorized' : 'not-authorized') ||
    value.requestedAuthorization.maximumPublishedRoutes !== 2 ||
    !same(value.requestedAuthorization.authorizedPaths, AuthorizedPaths)
  ) {
    throw new Error('R7 runtime publication authoring authorization mismatch')
  }

  exactKeys(
    value.changeContract,
    [
      'changes',
      'runtimeSchemaVersion',
      'signedEnvelope',
      'productionDeploymentConfigurationChangesAuthorized',
      'routeContentChangesAuthorized',
      'rendererLayoutOrTextChangesAuthorized',
      'mainOrPreloadProductionChangesAuthorized'
    ],
    'R7 publication change contract'
  )
  if (
    !same(value.changeContract.changes, ExpectedChanges) ||
    value.changeContract.runtimeSchemaVersion !== 1 ||
    value.changeContract.signedEnvelope !==
      'existing-ed25519-data-manifest-and-quest-knowledge-payload' ||
    Object.entries(value.changeContract)
      .filter(([key]) => key.endsWith('Authorized'))
      .some(([, item]) => item !== false)
  ) {
    throw new Error('R7 runtime publication authoring change contract mismatch')
  }

  exactKeys(
    value.rollbackContract,
    [
      'invalidOrMissingUpdateBehavior',
      'withdrawalBehavior',
      'olderBundleBehavior',
      'activePointerOrPayloadCorruptionBehavior',
      'persistentAccountStateMutationAllowed'
    ],
    'R7 publication rollback contract'
  )
  if (
    value.rollbackContract.invalidOrMissingUpdateBehavior !==
      'restore-bundled-opt-in-catalog' ||
    value.rollbackContract.withdrawalBehavior !==
      'newer-signed-bundle-hides-route-and-shows-knowledge-review-required' ||
    value.rollbackContract.olderBundleBehavior !==
      'existing-data-update-anti-rollback-remains-enforced' ||
    value.rollbackContract.activePointerOrPayloadCorruptionBehavior !==
      'reject-active-update-and-use-bundled-fallback' ||
    value.rollbackContract.persistentAccountStateMutationAllowed !== false
  ) {
    throw new Error('R7 runtime publication rollback contract mismatch')
  }

  exactKeys(
    value.verificationContract,
    ['anonymousSignedFixtureRequired', 'realDistributionEndpointRequired', 'requiredChecks'],
    'R7 publication verification contract'
  )
  if (
    value.verificationContract.anonymousSignedFixtureRequired !== true ||
    value.verificationContract.realDistributionEndpointRequired !== false ||
    !same(value.verificationContract.requiredChecks, ExpectedChecks)
  ) {
    throw new Error('R7 runtime publication verification contract mismatch')
  }
  if (value.implementationResult !== null) {
    throw new Error('draft R7 runtime publication request must not claim implementation')
  }
  exactKeys(
    value.executionBoundary,
    [
      'runtimePublicationAuthorized',
      'defaultEnablementAuthorized',
      'realDistributionEndpointAuthorized',
      'productionUrlOrPublicKeyAuthorized',
      'privateKeyHandlingByAgentAuthorized',
      'realAccountExecutionAuthorized',
      'otherRouteFamiliesAuthorized',
      'gameCommunicationChangesAuthorized',
      'automaticGameOperationAuthorized',
      'installerBuildRequiredAtThisAuthoringGate'
    ],
    'R7 publication execution boundary'
  )
  if (Object.values(value.executionBoundary).some((item) => item !== false)) {
    throw new Error('R7 runtime publication execution boundary widened')
  }
  if (!same(value.stillProhibited, ExpectedProhibited)) {
    throw new Error('R7 runtime publication prohibited behavior mismatch')
  }
  exactKeys(value.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'R7 publication review')
  const semanticDigest = runtimePublicationRequestSemanticDigest(value)
  if (semanticDigest !== FixedSemanticDigest) {
    throw new Error('R7 runtime publication semantic digest mismatch')
  }
  if (approved) {
    if (
      value.review.approver !== 'project-owner' ||
      !TimestampPattern.test(value.review.reviewedAt) ||
      value.review.approvalDigest !== semanticDigest
    ) {
      throw new Error('approved R7 runtime publication digest mismatch')
    }
  } else if (
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 runtime publication request must not claim approval')
  }
  return { value, semanticDigest, approved }
}

function buildR7RuntimePublicationDecisionArtifacts({ root, base }) {
  const requestPath = path.join(
    base,
    'decisions',
    'r7-runtime-publication-authoring-request.json'
  )
  const requestRaw = fs.readFileSync(requestPath)
  const request = validateR7RuntimePublicationAuthoringRequest(JSON.parse(requestRaw), {
    root,
    base
  })
  const report = {
    schemaVersion: 1,
    compilerVersion: R7RuntimePublicationDecisionCompilerVersion,
    generatedAt: request.approved
      ? request.value.review.reviewedAt
      : request.value.sourceSnapshot.checkedAt,
    status: request.approved
      ? 'R7_RUNTIME_PUBLICATION_AUTHORING_AUTHORIZED'
      : 'OWNER_DECISION_REQUIRED_R7_RUNTIME_PUBLICATION_AUTHORING',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    gateId: request.value.requestedAuthorization.gateId,
    authorizationState: request.approved ? 'authorized' : 'not-authorized',
    implementationAuthorization: request.approved ? 'authorized' : 'not-authorized',
    maximumPublishedRoutes: request.value.requestedAuthorization.maximumPublishedRoutes,
    authorizedPaths: request.value.requestedAuthorization.authorizedPaths,
    changeCount: request.value.changeContract.changes.length,
    requiredCheckCount: request.value.verificationContract.requiredChecks.length,
    anonymousSignedFixtureRequired:
      request.value.verificationContract.anonymousSignedFixtureRequired,
    rollbackMode: request.value.rollbackContract.invalidOrMissingUpdateBehavior,
    realAccountAcceptanceStatus:
      request.value.approvalBasis.realAccountAcceptanceStatus,
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED',
    defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED',
    productionDeploymentConfigurationAuthorization: 'R7_NOT_AUTHORIZED',
    stillProhibited: request.value.stillProhibited
  }
  return {
    artifacts: { 'r7-runtime-publication-authoring-report.json': report },
    source: { r7RuntimePublicationAuthoringRequestDigest: digest(requestRaw) },
    output: {
      r7RuntimePublicationAuthoringOwnerDecisionRequired: !request.approved,
      r7RuntimePublicationAuthoringAuthorizedPathCount: request.approved
        ? report.authorizedPaths.length
        : 0,
      r7RuntimePublicationAuthoringRequiredCheckCount: report.requiredCheckCount
    }
  }
}

module.exports = {
  R7RuntimePublicationDecisionOutputFilenames,
  buildR7RuntimePublicationDecisionArtifacts,
  runtimePublicationRequestSemanticDigest,
  validateR7RuntimePublicationAuthoringRequest
}

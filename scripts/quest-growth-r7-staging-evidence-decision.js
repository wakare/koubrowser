const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const {
  validateStagingEvidenceFiles
} = require('./quest-growth-r7-staging-evidence')

const CompilerVersion = 'quest-growth-r7-staging-evidence-decision-compiler/2'
const R7StagingEvidenceDecisionOutputFilenames = [
  'r7-staging-evidence-authoring-report.json'
]
const RequestPath =
  'knowledge/quest-growth/decisions/r7-staging-evidence-authoring-request.json'
const ProtectedPaths = [
  'src/main/kcbrowser.ts',
  'src/preload/xhr-hook.ts',
  'src/common/kcsapi_hook.ts'
]
const AuthorizedPaths = [
  'knowledge/quest-growth/r7/staging-evidence.schema.json',
  'knowledge/quest-growth/r7/fixtures/staging-evidence-anonymous.json',
  'scripts/quest-growth-r7-staging-evidence.js',
  'src/common/__tests__/quest_growth_staging_evidence.test.ts'
]
const FixedImplementationDigests = {
  'knowledge/quest-growth/r7/staging-evidence.schema.json':
    'sha256:bfaccc42c1ec101a8d14ebc09e6583ccd2a3fe3a5f11431f76cadd5e8b37a12c',
  'knowledge/quest-growth/r7/fixtures/staging-evidence-anonymous.json':
    'sha256:c1b1963f3f2eb6f16503edf9cb35361e38285c1c6a771782e4c88a6c8227171c',
  'scripts/quest-growth-r7-staging-evidence.js':
    'sha256:12cb4eec9cda6b8fbce7686fad819c92026ea22b96d1751098727bf75003fabc',
  'src/common/__tests__/quest_growth_staging_evidence.test.ts':
    'sha256:754d8f870ca24612fece47de2d1875a7ba2bd6fbf13b5b367d77c3f008046ef8'
}
const AllowedPublicEvidenceFields = [
  'dataVersion',
  'publishedAt',
  'manifestSha256',
  'questKnowledgeSha256',
  'publicKeySha256',
  'fileCount',
  'payloadBytes',
  'routeCount',
  'requiredCheckCount',
  'redactedAcceptanceStatus'
]
const ProhibitedEvidenceFields = [
  'privateKey',
  'passphrase',
  'credential',
  'token',
  'publicKeyBytes',
  'manifestUrl',
  'localPath',
  'accountData',
  'personalIdentifier',
  'rawLog',
  'screenshot'
]
const RequiredRoles = [
  'external-release-author',
  'independent-evidence-reviewer',
  'staging-acceptance-operator'
]
const RequiredChecks = [
  'strict-schema-rejects-unknown-fields',
  'evidence-binds-approved-candidate-and-staging-configuration',
  'evidence-binds-exactly-two-reviewed-routes',
  'only-approved-public-evidence-fields-are-accepted',
  'secret-url-path-account-and-personal-fields-are-rejected',
  'release-author-reviewer-and-staging-operator-are-distinct',
  'reviewer-recomputes-evidence-without-private-key-access',
  'reserved-invalid-placeholder-is-the-only-endpoint-representation',
  'publication-default-enablement-and-runtime-eligibility-remain-unauthorized',
  'protected-game-communication-digests-remain-fixed'
]
const ExpectedProhibited = [
  'key-material-or-passphrase',
  'bundle-signing',
  'real-public-key-or-fingerprint',
  'real-staging-or-production-url',
  'external-endpoint-connection',
  'staging-acceptance-execution',
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

function stagingEvidenceRequestSemanticDigest(value) {
  const payload = Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => !['status', 'implementationResult', 'review'].includes(key)
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

function validateR7StagingEvidenceAuthoringRequest(value, root) {
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
      'evidenceContract',
      'roleSeparationContract',
      'verificationContract',
      'implementationResult',
      'executionBoundary',
      'stillProhibited',
      'review'
    ],
    'R7 staging evidence request'
  )
  if (
    value.authoringSchema !== 'QuestGrowthR7StagingEvidenceAuthoringRequest/1alpha' ||
    value.requestId !== 'decision:quest-growth-r7-staging-evidence-authoring' ||
    value.revision !== 1 ||
    !['draft', 'implemented'].includes(value.status) ||
    value.scope !== 'R7_STAGING_EVIDENCE_AUTHORING_ONLY'
  ) {
    throw new Error('R7 staging evidence authoring scope mismatch')
  }
  const implemented = value.status === 'implemented'

  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R7 evidence source')
  if (
    value.sourceSnapshot.auditedBaseCommit !==
      '341b1edfb3c1e9b74c99368f15d3adcd599aac09' ||
    value.sourceSnapshot.checkedAt !== '2026-08-02T12:04:18.616Z'
  ) {
    throw new Error('R7 staging evidence source mismatch')
  }

  const stagingReportPath =
    'knowledge/quest-growth/generated/r7-staging-configuration-authoring-report.json'
  const stagingReport = JSON.parse(
    fs.readFileSync(path.join(root, ...stagingReportPath.split('/')), 'utf8')
  )
  const expectedBasis = {
    stagingConfigurationSemanticDigest:
      'sha256:3873731e2d84a85dde4685da9625fe2e4ed072f41c0de8973fa5c94e7e8cec93',
    stagingConfigurationReportDigest: readDigest(root, stagingReportPath),
    stagingConfigurationStatus: 'R7_STAGING_CONFIGURATION_AUTHORING_APPROVED',
    candidateVersion: 'r7.candidate.20260802.1',
    candidateCanonicalDigest:
      'sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c',
    candidateFileDigest: readDigest(
      root,
      'knowledge/quest-growth/r7/runtime-publication-candidate.json'
    ),
    candidateReviewSemanticDigest:
      'sha256:4e0d52638b60b90e2aec0bfdc9f9c2eaca500d4c32751245e649a5e43adac94c',
    releaseRecordAuthorDigest: readDigest(
      root,
      'scripts/create-data-update-release-record.js'
    ),
    releaseRecordVerifierDigest: readDigest(
      root,
      'scripts/verify-data-update-release-record.js'
    ),
    dataUpdateDeploymentDigest: readDigest(root, 'src/main/data-update-deployment.ts'),
    protectedCommunicationDigests: Object.fromEntries(
      ProtectedPaths.map((item) => [item, readDigest(root, item)])
    )
  }
  exactKeys(value.approvalBasis, Object.keys(expectedBasis), 'R7 evidence approval basis')
  exactKeys(
    value.approvalBasis.protectedCommunicationDigests,
    ProtectedPaths,
    'R7 evidence protected communication digests'
  )
  if (
    !same(value.approvalBasis, expectedBasis) ||
    stagingReport.status !== expectedBasis.stagingConfigurationStatus ||
    stagingReport.ownerReviewStatus !== 'approved' ||
    stagingReport.runtimeEligibleCount !== 0 ||
    stagingReport.publicationAuthorization !== 'R7_NOT_AUTHORIZED'
  ) {
    throw new Error('R7 staging evidence approval basis mismatch')
  }

  exactKeys(
    value.requestedAuthorization,
    [
      'gateId',
      'authorizationState',
      'authoringAuthorization',
      'maximumRouteCount',
      'authorizedPaths'
    ],
    'R7 evidence requested authorization'
  )
  if (
    value.requestedAuthorization.gateId !== 'r7-staging-evidence-authoring' ||
    value.requestedAuthorization.authorizationState !==
      (implemented ? 'consumed' : 'not-authorized') ||
    value.requestedAuthorization.authoringAuthorization !==
      (implemented ? 'consumed' : 'not-authorized') ||
    value.requestedAuthorization.maximumRouteCount !== 2 ||
    !same(value.requestedAuthorization.authorizedPaths, AuthorizedPaths)
  ) {
    throw new Error('R7 staging evidence authorization mismatch')
  }

  exactKeys(
    value.evidenceContract,
    [
      'schemaVersion',
      'fixtureMode',
      'candidateVersion',
      'candidateCanonicalDigest',
      'stagingConfigurationSemanticDigest',
      'requiredRouteCount',
      'allowedPublicEvidenceFields',
      'prohibitedEvidenceFields',
      'endpointRepresentation',
      'publicKeyRepresentation',
      'realEvidenceValuesAuthorized'
    ],
    'R7 staging evidence contract'
  )
  if (
    value.evidenceContract.schemaVersion !== 1 ||
    value.evidenceContract.fixtureMode !== 'anonymous-offline-evidence-only' ||
    value.evidenceContract.candidateVersion !== expectedBasis.candidateVersion ||
    value.evidenceContract.candidateCanonicalDigest !==
      expectedBasis.candidateCanonicalDigest ||
    value.evidenceContract.stagingConfigurationSemanticDigest !==
      expectedBasis.stagingConfigurationSemanticDigest ||
    value.evidenceContract.requiredRouteCount !== 2 ||
    !same(value.evidenceContract.allowedPublicEvidenceFields, AllowedPublicEvidenceFields) ||
    !same(value.evidenceContract.prohibitedEvidenceFields, ProhibitedEvidenceFields) ||
    value.evidenceContract.endpointRepresentation !==
      'reserved-invalid-placeholder-only' ||
    value.evidenceContract.publicKeyRepresentation !==
      'sha256-fingerprint-only-synthetic-in-fixture' ||
    value.evidenceContract.realEvidenceValuesAuthorized !== false
  ) {
    throw new Error('R7 staging evidence contract mismatch')
  }

  exactKeys(
    value.roleSeparationContract,
    [
      'requiredRoles',
      'allRolesMustBeDistinct',
      'codexMayAssumeReleaseAuthor',
      'codexMayHandlePrivateKeyOrPassphrase',
      'evidenceReviewerMayAccessPrivateKey',
      'stagingOperatorMayAccessPrivateKey',
      'releaseAuthorMayPublishToStaging',
      'reviewerMustRecomputePublicEvidence'
    ],
    'R7 staging evidence role separation'
  )
  if (
    !same(value.roleSeparationContract.requiredRoles, RequiredRoles) ||
    value.roleSeparationContract.allRolesMustBeDistinct !== true ||
    value.roleSeparationContract.reviewerMustRecomputePublicEvidence !== true ||
    Object.entries(value.roleSeparationContract)
      .filter(([key]) => key.endsWith('PrivateKey') || key.startsWith('codexMay') || key === 'releaseAuthorMayPublishToStaging')
      .some(([, item]) => item !== false)
  ) {
    throw new Error('R7 staging evidence role separation mismatch')
  }

  exactKeys(
    value.verificationContract,
    ['offlineOnly', 'anonymousFixtureRequired', 'requiredChecks'],
    'R7 staging evidence verification'
  )
  if (
    value.verificationContract.offlineOnly !== true ||
    value.verificationContract.anonymousFixtureRequired !== true ||
    !same(value.verificationContract.requiredChecks, RequiredChecks)
  ) {
    throw new Error('R7 staging evidence verification mismatch')
  }

  if (implemented) {
    exactKeys(
      value.implementationResult,
      [
        'recordedAt',
        'implementationCommit',
        'changedPathDigests',
        'validatorTestCount',
        'fullTestCount',
        'typecheckPassed',
        'genericQuestGrowthCompileCheckPassed',
        'publicEvidenceFieldCount',
        'prohibitedEvidenceFieldCount',
        'distinctRoleCount',
        'requiredCheckCount',
        'syntheticOnly',
        'keyMaterialHandled',
        'realFingerprintHandled',
        'credentialHandled',
        'bundleSigningPerformed',
        'realUrlConfigured',
        'externalEndpointConnected',
        'stagingAcceptancePerformed',
        'runtimePublicationPerformed',
        'defaultEnablementChanged',
        'runtimeEligibleCount',
        'installerBuilt',
        'gameCommunicationChangesMade'
      ],
      'R7 staging evidence implementation result'
    )
    exactKeys(
      value.implementationResult.changedPathDigests,
      AuthorizedPaths,
      'R7 staging evidence implementation digests'
    )
    if (
      value.implementationResult.recordedAt !== '2026-08-02T12:16:38.725Z' ||
      value.implementationResult.implementationCommit !==
        '6082e74f8445953bd762ce1549565c819c03aca9' ||
      !same(value.implementationResult.changedPathDigests, FixedImplementationDigests) ||
      value.implementationResult.validatorTestCount !== 10 ||
      value.implementationResult.fullTestCount !== 1274 ||
      value.implementationResult.typecheckPassed !== true ||
      value.implementationResult.genericQuestGrowthCompileCheckPassed !== true ||
      value.implementationResult.publicEvidenceFieldCount !== 10 ||
      value.implementationResult.prohibitedEvidenceFieldCount !== 11 ||
      value.implementationResult.distinctRoleCount !== 3 ||
      value.implementationResult.requiredCheckCount !== 10 ||
      value.implementationResult.syntheticOnly !== true ||
      value.implementationResult.runtimeEligibleCount !== 0
    ) {
      throw new Error('R7 staging evidence implementation evidence mismatch')
    }
    for (const item of AuthorizedPaths) {
      if (readDigest(root, item) !== value.implementationResult.changedPathDigests[item]) {
        throw new Error(`R7 staging evidence implementation file drift: ${item}`)
      }
    }
    for (const item of [
      'keyMaterialHandled',
      'realFingerprintHandled',
      'credentialHandled',
      'bundleSigningPerformed',
      'realUrlConfigured',
      'externalEndpointConnected',
      'stagingAcceptancePerformed',
      'runtimePublicationPerformed',
      'defaultEnablementChanged',
      'installerBuilt',
      'gameCommunicationChangesMade'
    ]) {
      if (value.implementationResult[item] !== false) {
        throw new Error(`R7 staging evidence implementation boundary widened: ${item}`)
      }
    }
    validateStagingEvidenceFiles(root)
  } else if (value.implementationResult !== null) {
    throw new Error('draft R7 staging evidence request must not claim implementation')
  }

  exactKeys(
    value.executionBoundary,
    [
      'keyMaterialHandlingAuthorized',
      'bundleSigningAuthorized',
      'realFingerprintOrPublicKeyAuthorized',
      'realStagingOrProductionUrlAuthorized',
      'externalEndpointConnectionAuthorized',
      'runtimePublicationAuthorized',
      'defaultEnablementAuthorized',
      'stagingAcceptanceExecutionAuthorized',
      'otherRouteFamiliesAuthorized',
      'gameCommunicationChangesAuthorized',
      'installerBuildRequiredAtThisGate'
    ],
    'R7 staging evidence execution boundary'
  )
  if (Object.values(value.executionBoundary).some((item) => item !== false)) {
    throw new Error('R7 staging evidence execution boundary widened')
  }
  if (!same(value.stillProhibited, ExpectedProhibited)) {
    throw new Error('R7 staging evidence prohibited behavior mismatch')
  }

  exactKeys(value.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'R7 evidence review')
  const semanticDigest = stagingEvidenceRequestSemanticDigest(value)
  if (value.review.author !== 'codex-r7-staging-evidence-decision-author') {
    throw new Error('R7 staging evidence reviewer contract mismatch')
  }
  if (implemented) {
    if (
      value.review.approver !== 'project-owner' ||
      value.review.reviewedAt !== '2026-08-02T12:16:38.725Z' ||
      value.review.approvalDigest !== semanticDigest
    ) {
      throw new Error('implemented R7 staging evidence approval digest mismatch')
    }
  } else if (
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 staging evidence request must not claim approval')
  }

  return {
    value,
    semanticDigest,
    implemented
  }
}

function buildR7StagingEvidenceDecisionArtifacts({ root }) {
  const requestRaw = fs.readFileSync(path.join(root, ...RequestPath.split('/')))
  const request = validateR7StagingEvidenceAuthoringRequest(JSON.parse(requestRaw), root)
  const report = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    generatedAt: request.value.sourceSnapshot.checkedAt,
    status: request.implemented
      ? 'R7_STAGING_EVIDENCE_AUTHORED_REAL_EVIDENCE_NOT_AUTHORIZED'
      : 'OWNER_DECISION_REQUIRED_R7_STAGING_EVIDENCE_AUTHORING',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    gateId: request.value.requestedAuthorization.gateId,
    authorizationState: request.value.requestedAuthorization.authorizationState,
    authoringAuthorization: request.value.requestedAuthorization.authoringAuthorization,
    authorizedPaths: request.value.requestedAuthorization.authorizedPaths,
    routeCount: request.value.requestedAuthorization.maximumRouteCount,
    allowedPublicEvidenceFieldCount:
      request.value.evidenceContract.allowedPublicEvidenceFields.length,
    prohibitedEvidenceFieldCount:
      request.value.evidenceContract.prohibitedEvidenceFields.length,
    requiredRoleCount: request.value.roleSeparationContract.requiredRoles.length,
    requiredCheckCount: request.value.verificationContract.requiredChecks.length,
    anonymousFixtureRequired: true,
    keyMaterialPresent: false,
    realEndpointPresent: false,
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED',
    defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED',
    stillProhibited: request.value.stillProhibited
  }
  return {
    artifacts: {
      'r7-staging-evidence-authoring-report.json': report
    },
    source: {
      r7StagingEvidenceAuthoringRequestDigest: digest(requestRaw)
    },
    output: {
      r7StagingEvidenceOwnerDecisionRequired: !request.implemented,
      r7StagingEvidenceAuthorizedNotImplemented: false,
      r7StagingEvidenceImplemented: request.implemented,
      r7StagingEvidenceRequiredCheckCount: report.requiredCheckCount,
      r7StagingEvidenceAuthorizedPathCount: request.implemented
        ? report.authorizedPaths.length
        : 0
    }
  }
}

module.exports = {
  R7StagingEvidenceDecisionOutputFilenames,
  buildR7StagingEvidenceDecisionArtifacts,
  stagingEvidenceRequestSemanticDigest,
  validateR7StagingEvidenceAuthoringRequest
}

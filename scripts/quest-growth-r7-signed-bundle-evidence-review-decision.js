const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const {
  validateReviewFiles
} = require('./quest-growth-r7-signed-bundle-evidence-review')

const CompilerVersion =
  'quest-growth-r7-signed-bundle-evidence-review-decision-compiler/2'
const R7SignedBundleEvidenceReviewDecisionOutputFilenames = [
  'r7-signed-bundle-evidence-review-authoring-report.json'
]
const RequestPath =
  'knowledge/quest-growth/decisions/r7-signed-bundle-evidence-review-authoring-request.json'
const ProtectedPaths = [
  'src/main/kcbrowser.ts',
  'src/preload/xhr-hook.ts',
  'src/common/kcsapi_hook.ts'
]
const AuthorizedPaths = [
  'knowledge/quest-growth/r7/signed-bundle-evidence-review.schema.json',
  'knowledge/quest-growth/r7/fixtures/signed-bundle-evidence-review-anonymous.json',
  'scripts/quest-growth-r7-signed-bundle-evidence-review.js',
  'src/common/__tests__/quest_growth_signed_bundle_evidence_review.test.ts'
]
const FixedImplementationDigests = {
  'knowledge/quest-growth/r7/signed-bundle-evidence-review.schema.json':
    'sha256:20fb4b269ca49b680f669cfa317222de0485a1e84a863979e009a1ddd8b25139',
  'knowledge/quest-growth/r7/fixtures/signed-bundle-evidence-review-anonymous.json':
    'sha256:00728ca5562ce6ebf79cbc14ec43fffc13ed7a361ffd5082973db915bf1e0076',
  'scripts/quest-growth-r7-signed-bundle-evidence-review.js':
    'sha256:2f8a916cb066840ce863fe6059fa04e05bd793bf3f47bf277162e399026d1554',
  'src/common/__tests__/quest_growth_signed_bundle_evidence_review.test.ts':
    'sha256:9d39cbd700dcc9bc5634408f5b867ec04494c2e9f05dd24893ce8491bf736144'
}
const FixedRouteIds = [
  'route:expedition-05-resource-loop:draft-1',
  'route:1-5-basic-asw-three-battle:draft-1'
]
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
const ProhibitedOutputFields = [
  'privateKey',
  'passphrase',
  'credential',
  'token',
  'publicKeyBytes',
  'manifestUrl',
  'stagingUrl',
  'productionUrl',
  'localPath',
  'accountData',
  'personalIdentifier',
  'rawLog',
  'screenshot',
  'bundleBytes',
  'signatureBytes'
]
const RequiredRoles = [
  'external-release-author',
  'independent-bundle-evidence-reviewer',
  'staging-acceptance-operator'
]
const RequiredChecks = [
  'strict-result-schema-rejects-unknown-fields',
  'existing-ed25519-bundle-signature-and-file-hashes-are-verified',
  'bundle-growth-routes-bind-exactly-to-the-two-approved-candidate-routes',
  'public-key-fingerprint-is-recomputed-without-emitting-public-key-bytes',
  'only-the-ten-approved-public-evidence-fields-are-emitted',
  'secret-url-path-account-personal-raw-and-signature-fields-are-rejected',
  'release-author-reviewer-and-staging-operator-remain-distinct',
  'review-is-offline-read-only-and-emits-no-raw-log-or-local-path',
  'real-review-publication-default-enablement-and-runtime-eligibility-remain-unauthorized',
  'protected-game-communication-digests-remain-fixed'
]
const ExpectedProhibited = [
  'real-signed-bundle-review-execution',
  'real-public-key-or-fingerprint-review',
  'real-private-key-or-passphrase',
  'real-bundle-signing',
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

function signedBundleEvidenceReviewRequestSemanticDigest(value) {
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

function validateR7SignedBundleEvidenceReviewAuthoringRequest(value, root) {
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
      'reviewHarnessContract',
      'roleSeparationContract',
      'verificationContract',
      'implementationResult',
      'executionBoundary',
      'stillProhibited',
      'review'
    ],
    'R7 signed bundle evidence review request'
  )
  if (
    value.authoringSchema !==
      'QuestGrowthR7SignedBundleEvidenceReviewAuthoringRequest/1alpha' ||
    value.requestId !==
      'decision:quest-growth-r7-signed-bundle-evidence-review-authoring' ||
    value.revision !== 1 ||
    !['draft', 'implemented'].includes(value.status) ||
    value.scope !== 'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_AUTHORING_ONLY'
  ) {
    throw new Error('R7 signed bundle evidence review authoring scope mismatch')
  }
  const implemented = value.status === 'implemented'

  exactKeys(
    value.sourceSnapshot,
    ['auditedBaseCommit', 'checkedAt'],
    'R7 signed bundle review source'
  )
  if (
    value.sourceSnapshot.auditedBaseCommit !==
      'c9eb677382256f5c7734e76185a951af43eed521' ||
    value.sourceSnapshot.checkedAt !== '2026-08-02T12:43:25.142Z'
  ) {
    throw new Error('R7 signed bundle evidence review source mismatch')
  }

  const stagingEvidenceReportPath =
    'knowledge/quest-growth/generated/r7-staging-evidence-authoring-report.json'
  const stagingEvidenceReport = JSON.parse(
    fs.readFileSync(path.join(root, ...stagingEvidenceReportPath.split('/')), 'utf8')
  )
  const expectedBasis = {
    stagingEvidenceSemanticDigest:
      'sha256:17bb4894a614e0f07157a3aa38a956d3d86b586a134fb2e301a249da4e4b63b3',
    stagingEvidenceReportDigest: readDigest(root, stagingEvidenceReportPath),
    stagingEvidenceStatus:
      'R7_STAGING_EVIDENCE_AUTHORED_REAL_EVIDENCE_NOT_AUTHORIZED',
    candidateVersion: 'r7.candidate.20260802.1',
    candidateCanonicalDigest:
      'sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c',
    candidateFileDigest: readDigest(
      root,
      'knowledge/quest-growth/r7/runtime-publication-candidate.json'
    ),
    candidateReviewSemanticDigest:
      'sha256:4e0d52638b60b90e2aec0bfdc9f9c2eaca500d4c32751245e649a5e43adac94c',
    candidateReviewFileDigest: readDigest(
      root,
      'knowledge/quest-growth/reviews/r7-runtime-publication-candidate-review.json'
    ),
    stagingEvidenceSchemaDigest: readDigest(
      root,
      'knowledge/quest-growth/r7/staging-evidence.schema.json'
    ),
    stagingEvidenceValidatorDigest: readDigest(
      root,
      'scripts/quest-growth-r7-staging-evidence.js'
    ),
    bundleAuthorDigest: readDigest(root, 'scripts/create-data-update-bundle.js'),
    bundleVerifierDigest: readDigest(root, 'scripts/verify-data-update-bundle.js'),
    releaseRecordAuthorDigest: readDigest(
      root,
      'scripts/create-data-update-release-record.js'
    ),
    releaseRecordVerifierDigest: readDigest(
      root,
      'scripts/verify-data-update-release-record.js'
    ),
    protectedCommunicationDigests: Object.fromEntries(
      ProtectedPaths.map((item) => [item, readDigest(root, item)])
    )
  }
  exactKeys(value.approvalBasis, Object.keys(expectedBasis), 'R7 review approval basis')
  exactKeys(
    value.approvalBasis.protectedCommunicationDigests,
    ProtectedPaths,
    'R7 review protected communication digests'
  )
  if (
    !same(value.approvalBasis, expectedBasis) ||
    stagingEvidenceReport.status !== expectedBasis.stagingEvidenceStatus ||
    stagingEvidenceReport.runtimeEligibleCount !== 0 ||
    stagingEvidenceReport.publicationAuthorization !== 'R7_NOT_AUTHORIZED'
  ) {
    throw new Error('R7 signed bundle evidence review approval basis mismatch')
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
    'R7 signed bundle review requested authorization'
  )
  if (
    value.requestedAuthorization.gateId !==
      'r7-signed-bundle-evidence-review-authoring' ||
    value.requestedAuthorization.authorizationState !==
      (implemented ? 'consumed' : 'not-authorized') ||
    value.requestedAuthorization.authoringAuthorization !==
      (implemented ? 'consumed' : 'not-authorized') ||
    value.requestedAuthorization.maximumRouteCount !== 2 ||
    !same(value.requestedAuthorization.authorizedPaths, AuthorizedPaths)
  ) {
    throw new Error('R7 signed bundle evidence review authorization mismatch')
  }

  exactKeys(
    value.reviewHarnessContract,
    [
      'schemaVersion',
      'mode',
      'candidateVersion',
      'candidateCanonicalDigest',
      'requiredRouteIds',
      'anonymousFixtureKeyMode',
      'privateKeyPersistenceAllowed',
      'networkAccessAllowed',
      'allowedPublicEvidenceFields',
      'prohibitedOutputFields'
    ],
    'R7 signed bundle review harness contract'
  )
  if (
    value.reviewHarnessContract.schemaVersion !== 1 ||
    value.reviewHarnessContract.mode !==
      'anonymous-offline-signed-bundle-review-authoring' ||
    value.reviewHarnessContract.candidateVersion !== expectedBasis.candidateVersion ||
    value.reviewHarnessContract.candidateCanonicalDigest !==
      expectedBasis.candidateCanonicalDigest ||
    !same(value.reviewHarnessContract.requiredRouteIds, FixedRouteIds) ||
    value.reviewHarnessContract.anonymousFixtureKeyMode !==
      'ephemeral-synthetic-ed25519-test-only' ||
    value.reviewHarnessContract.privateKeyPersistenceAllowed !== false ||
    value.reviewHarnessContract.networkAccessAllowed !== false ||
    !same(
      value.reviewHarnessContract.allowedPublicEvidenceFields,
      AllowedPublicEvidenceFields
    ) ||
    !same(value.reviewHarnessContract.prohibitedOutputFields, ProhibitedOutputFields)
  ) {
    throw new Error('R7 signed bundle evidence review harness contract mismatch')
  }

  exactKeys(
    value.roleSeparationContract,
    [
      'requiredRoles',
      'allRolesMustBeDistinct',
      'codexMayAssumeReleaseAuthor',
      'codexMayHandleRealPrivateKeyOrPassphrase',
      'reviewerMayAccessPrivateKey',
      'stagingOperatorMayAccessPrivateKey',
      'releaseAuthorMayApproveOwnEvidence'
    ],
    'R7 signed bundle review role separation'
  )
  if (
    !same(value.roleSeparationContract.requiredRoles, RequiredRoles) ||
    value.roleSeparationContract.allRolesMustBeDistinct !== true ||
    Object.entries(value.roleSeparationContract)
      .filter(([key]) => key !== 'requiredRoles' && key !== 'allRolesMustBeDistinct')
      .some(([, item]) => item !== false)
  ) {
    throw new Error('R7 signed bundle evidence review role separation mismatch')
  }

  exactKeys(
    value.verificationContract,
    ['offlineOnly', 'anonymousSignedFixtureRequired', 'requiredChecks'],
    'R7 signed bundle review verification contract'
  )
  if (
    value.verificationContract.offlineOnly !== true ||
    value.verificationContract.anonymousSignedFixtureRequired !== true ||
    !same(value.verificationContract.requiredChecks, RequiredChecks)
  ) {
    throw new Error('R7 signed bundle evidence review verification mismatch')
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
        'allowedPublicEvidenceFieldCount',
        'prohibitedOutputFieldCount',
        'distinctRoleCount',
        'requiredCheckCount',
        'anonymousEphemeralEd25519FixturePassed',
        'privateKeyPersisted',
        'realSignedBundleReviewed',
        'realPublicKeyOrFingerprintReviewed',
        'realPrivateKeyHandled',
        'realUrlConfigured',
        'externalEndpointConnected',
        'stagingAcceptancePerformed',
        'runtimePublicationPerformed',
        'defaultEnablementChanged',
        'runtimeEligibleCount',
        'installerBuilt',
        'gameCommunicationChangesMade'
      ],
      'R7 signed bundle evidence review implementation result'
    )
    exactKeys(
      value.implementationResult.changedPathDigests,
      AuthorizedPaths,
      'R7 signed bundle evidence review implementation digests'
    )
    if (
      value.implementationResult.recordedAt !== '2026-08-02T13:05:40.609Z' ||
      value.implementationResult.implementationCommit !==
        '948dcb772ba21cf6fbb127d9ce249a4006fd1f03' ||
      !same(value.implementationResult.changedPathDigests, FixedImplementationDigests) ||
      value.implementationResult.validatorTestCount !== 10 ||
      value.implementationResult.fullTestCount !== 1289 ||
      value.implementationResult.typecheckPassed !== true ||
      value.implementationResult.genericQuestGrowthCompileCheckPassed !== true ||
      value.implementationResult.allowedPublicEvidenceFieldCount !== 10 ||
      value.implementationResult.prohibitedOutputFieldCount !== 15 ||
      value.implementationResult.distinctRoleCount !== 3 ||
      value.implementationResult.requiredCheckCount !== 10 ||
      value.implementationResult.anonymousEphemeralEd25519FixturePassed !== true ||
      value.implementationResult.runtimeEligibleCount !== 0
    ) {
      throw new Error('R7 signed bundle evidence review implementation evidence mismatch')
    }
    for (const item of AuthorizedPaths) {
      if (readDigest(root, item) !== value.implementationResult.changedPathDigests[item]) {
        throw new Error(`R7 signed bundle evidence review implementation file drift: ${item}`)
      }
    }
    for (const item of [
      'privateKeyPersisted',
      'realSignedBundleReviewed',
      'realPublicKeyOrFingerprintReviewed',
      'realPrivateKeyHandled',
      'realUrlConfigured',
      'externalEndpointConnected',
      'stagingAcceptancePerformed',
      'runtimePublicationPerformed',
      'defaultEnablementChanged',
      'installerBuilt',
      'gameCommunicationChangesMade'
    ]) {
      if (value.implementationResult[item] !== false) {
        throw new Error(`R7 signed bundle evidence review boundary widened: ${item}`)
      }
    }
    validateReviewFiles(root)
  } else if (value.implementationResult !== null) {
    throw new Error('draft R7 signed bundle review request must not claim implementation')
  }

  exactKeys(
    value.executionBoundary,
    [
      'realSignedBundleReviewExecutionAuthorized',
      'realPublicKeyOrFingerprintReviewAuthorized',
      'realPrivateKeyOrPassphraseHandlingAuthorized',
      'realBundleSigningAuthorized',
      'realStagingOrProductionUrlAuthorized',
      'externalEndpointConnectionAuthorized',
      'stagingAcceptanceExecutionAuthorized',
      'runtimePublicationAuthorized',
      'defaultEnablementAuthorized',
      'otherRouteFamiliesAuthorized',
      'gameCommunicationChangesAuthorized',
      'installerBuildRequiredAtThisGate'
    ],
    'R7 signed bundle review execution boundary'
  )
  if (Object.values(value.executionBoundary).some((item) => item !== false)) {
    throw new Error('R7 signed bundle evidence review execution boundary widened')
  }
  if (!same(value.stillProhibited, ExpectedProhibited)) {
    throw new Error('R7 signed bundle evidence review prohibited behavior mismatch')
  }

  exactKeys(
    value.review,
    ['author', 'approver', 'reviewedAt', 'approvalDigest'],
    'R7 signed bundle evidence review decision review'
  )
  const semanticDigest = signedBundleEvidenceReviewRequestSemanticDigest(value)
  if (
    value.review.author !==
    'codex-r7-signed-bundle-evidence-review-decision-author'
  ) {
    throw new Error('R7 signed bundle evidence review reviewer contract mismatch')
  }
  if (implemented) {
    if (
      value.review.approver !== 'project-owner' ||
      value.review.reviewedAt !== '2026-08-02T13:05:40.609Z' ||
      value.review.approvalDigest !== semanticDigest
    ) {
      throw new Error('implemented R7 signed bundle review approval digest mismatch')
    }
  } else if (
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 signed bundle review request must not claim approval')
  }

  return {
    value,
    semanticDigest,
    implemented
  }
}

function buildR7SignedBundleEvidenceReviewDecisionArtifacts({ root }) {
  const requestRaw = fs.readFileSync(path.join(root, ...RequestPath.split('/')))
  const request = validateR7SignedBundleEvidenceReviewAuthoringRequest(
    JSON.parse(requestRaw),
    root
  )
  const report = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    generatedAt: request.value.sourceSnapshot.checkedAt,
    status: request.implemented
      ? 'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_AUTHORED_REAL_REVIEW_NOT_AUTHORIZED'
      : 'OWNER_DECISION_REQUIRED_R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_AUTHORING',
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
      request.value.reviewHarnessContract.allowedPublicEvidenceFields.length,
    prohibitedOutputFieldCount:
      request.value.reviewHarnessContract.prohibitedOutputFields.length,
    requiredRoleCount: request.value.roleSeparationContract.requiredRoles.length,
    requiredCheckCount: request.value.verificationContract.requiredChecks.length,
    anonymousSignedFixtureRequired: true,
    realSignedBundleReviewed: false,
    realPublicKeyOrFingerprintReviewed: false,
    keyMaterialPresent: false,
    realEndpointPresent: false,
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED',
    defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED',
    stillProhibited: request.value.stillProhibited
  }
  return {
    artifacts: {
      'r7-signed-bundle-evidence-review-authoring-report.json': report
    },
    source: {
      r7SignedBundleEvidenceReviewAuthoringRequestDigest: digest(requestRaw)
    },
    output: {
      r7SignedBundleEvidenceReviewOwnerDecisionRequired: !request.implemented,
      r7SignedBundleEvidenceReviewAuthorizedNotImplemented: false,
      r7SignedBundleEvidenceReviewImplemented: request.implemented,
      r7SignedBundleEvidenceReviewExecuted: false,
      r7SignedBundleEvidenceReviewRequiredCheckCount: report.requiredCheckCount,
      r7SignedBundleEvidenceReviewAuthorizedPathCount: request.implemented
        ? report.authorizedPaths.length
        : 0
    }
  }
}

module.exports = {
  R7SignedBundleEvidenceReviewDecisionOutputFilenames,
  buildR7SignedBundleEvidenceReviewDecisionArtifacts,
  signedBundleEvidenceReviewRequestSemanticDigest,
  validateR7SignedBundleEvidenceReviewAuthoringRequest
}

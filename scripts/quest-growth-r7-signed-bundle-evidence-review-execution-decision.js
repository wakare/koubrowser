const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const CompilerVersion =
  'quest-growth-r7-signed-bundle-evidence-review-execution-decision-compiler/1'
const R7SignedBundleEvidenceReviewExecutionDecisionOutputFilenames = [
  'r7-signed-bundle-evidence-review-execution-report.json'
]
const RequestPath =
  'knowledge/quest-growth/decisions/r7-signed-bundle-evidence-review-execution-request.json'
const AuthoringRequestPath =
  'knowledge/quest-growth/decisions/r7-signed-bundle-evidence-review-authoring-request.json'
const AuthoringReportPath =
  'knowledge/quest-growth/generated/r7-signed-bundle-evidence-review-authoring-report.json'
const ProtectedPaths = [
  'src/main/kcbrowser.ts',
  'src/preload/xhr-hook.ts',
  'src/common/kcsapi_hook.ts'
]
const FixedRouteIds = [
  'route:expedition-05-resource-loop:draft-1',
  'route:1-5-basic-asw-three-battle:draft-1'
]
const RequiredInputs = [
  'signed-bundle-directory',
  'ed25519-public-key-file'
]
const AllowedInputClasses = [
  'public-signed-release-bundle',
  'public-ed25519-verification-key'
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
const PreflightRequirements = [
  'owner-explicitly-provides-bundle-and-public-key-paths',
  'fixed-harness-schema-candidate-and-protected-file-digests-match',
  'bundle-and-public-key-are-local-readable-inputs',
  'input-set-contains-no-private-key-passphrase-credential-or-account-data',
  'review-process-has-no-network-access',
  'runtime-eligible-count-is-zero'
]
const RequiredChecks = [
  'existing-ed25519-bundle-signature-and-file-hashes-pass',
  'bundle-growth-routes-match-exactly-the-two-reviewed-candidate-routes',
  'public-key-fingerprint-is-recomputed-without-outputting-key-bytes',
  'result-matches-strict-ten-field-schema',
  'result-contains-none-of-the-fifteen-prohibited-fields',
  'review-is-offline-read-only-and-does-not-persist-output',
  'release-author-reviewer-and-staging-operator-remain-distinct',
  'no-private-key-passphrase-credential-url-or-account-data-is-accessed',
  'publication-default-enablement-and-runtime-eligibility-remain-unchanged',
  'protected-game-communication-digests-remain-fixed'
]
const AbortConditions = [
  'owner-does-not-explicitly-provide-both-input-paths',
  'input-appears-to-contain-private-key-passphrase-credential-or-account-data',
  'approval-basis-or-protected-file-digest-mismatch',
  'bundle-signature-file-hash-candidate-or-route-binding-mismatch',
  'review-would-require-network-access-or-url-resolution',
  'redacted-output-cannot-be-guaranteed',
  'review-would-mutate-inputs-repository-game-state-or-game-communication'
]
const ExpectedProhibited = [
  'private-key-or-passphrase-handling',
  'credential-or-account-data-access',
  'bundle-signing-or-mutation',
  'real-url-or-external-endpoint',
  'output-or-raw-log-persistence',
  'staging-acceptance',
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

function signedBundleEvidenceReviewExecutionSemanticDigest(value) {
  const payload = Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => !['status', 'executionResult', 'review'].includes(key)
    )
  )
  return digest(
    canonicalJson({
      ...payload,
      requestedAuthorization: Object.fromEntries(
        Object.entries(payload.requestedAuthorization).filter(
          ([key]) => !['authorizationState', 'executionAuthorization'].includes(key)
        )
      )
    })
  )
}

function validateR7SignedBundleEvidenceReviewExecutionRequest(value, root) {
  exactKeys(
    value,
    [
      'requestSchema',
      'requestId',
      'revision',
      'status',
      'scope',
      'sourceSnapshot',
      'approvalBasis',
      'requestedAuthorization',
      'inputContract',
      'executionContract',
      'roleSeparationContract',
      'preflightRequirements',
      'requiredChecks',
      'abortConditions',
      'executionResult',
      'executionBoundary',
      'stillProhibited',
      'review'
    ],
    'R7 signed bundle evidence review execution request'
  )
  if (
    value.requestSchema !==
      'QuestGrowthR7SignedBundleEvidenceReviewExecutionRequest/1alpha' ||
    value.requestId !==
      'decision:quest-growth-r7-signed-bundle-evidence-review-execution' ||
    value.revision !== 1 ||
    value.status !== 'draft' ||
    value.scope !== 'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_EXECUTION_ONLY' ||
    value.executionResult !== null
  ) {
    throw new Error('R7 signed bundle evidence review execution scope mismatch')
  }

  exactKeys(
    value.sourceSnapshot,
    ['auditedBaseCommit', 'checkedAt'],
    'R7 signed bundle review execution source'
  )
  if (
    value.sourceSnapshot.auditedBaseCommit !==
      'ec1acf7361e79cdc1d773ee8960ddbfeec523f27' ||
    value.sourceSnapshot.checkedAt !== '2026-08-02T13:19:47.494Z'
  ) {
    throw new Error('R7 signed bundle evidence review execution source mismatch')
  }

  const authoringReport = JSON.parse(
    fs.readFileSync(path.join(root, ...AuthoringReportPath.split('/')), 'utf8')
  )
  const expectedBasis = {
    authoringSemanticDigest:
      'sha256:eb599466cdcf580d6a4fabad4439a274ca483d5f1d6888f80f3d467ed4ce2080',
    authoringRequestDigest: readDigest(root, AuthoringRequestPath),
    authoringReportDigest: readDigest(root, AuthoringReportPath),
    authoringStatus:
      'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_AUTHORED_REAL_REVIEW_NOT_AUTHORIZED',
    implementationCommit: '948dcb772ba21cf6fbb127d9ce249a4006fd1f03',
    reviewHarnessDigest: readDigest(
      root,
      'scripts/quest-growth-r7-signed-bundle-evidence-review.js'
    ),
    resultSchemaDigest: readDigest(
      root,
      'knowledge/quest-growth/r7/signed-bundle-evidence-review.schema.json'
    ),
    candidateVersion: 'r7.candidate.20260802.1',
    candidateCanonicalDigest:
      'sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c',
    candidateFileDigest: readDigest(
      root,
      'knowledge/quest-growth/r7/runtime-publication-candidate.json'
    ),
    candidateReviewFileDigest: readDigest(
      root,
      'knowledge/quest-growth/reviews/r7-runtime-publication-candidate-review.json'
    ),
    protectedCommunicationDigests: Object.fromEntries(
      ProtectedPaths.map((item) => [item, readDigest(root, item)])
    )
  }
  exactKeys(value.approvalBasis, Object.keys(expectedBasis), 'R7 execution basis')
  exactKeys(
    value.approvalBasis.protectedCommunicationDigests,
    ProtectedPaths,
    'R7 execution protected communication digests'
  )
  if (
    !same(value.approvalBasis, expectedBasis) ||
    authoringReport.status !== expectedBasis.authoringStatus ||
    authoringReport.runtimeEligibleCount !== 0 ||
    authoringReport.realSignedBundleReviewed !== false ||
    authoringReport.realPublicKeyOrFingerprintReviewed !== false
  ) {
    throw new Error('R7 signed bundle evidence review execution basis mismatch')
  }

  exactKeys(
    value.requestedAuthorization,
    [
      'gateId',
      'authorizationState',
      'executionAuthorization',
      'maximumExecutions',
      'maximumRouteCount',
      'repositoryMutationAuthorized'
    ],
    'R7 signed bundle review execution authorization'
  )
  if (
    value.requestedAuthorization.gateId !==
      'r7-signed-bundle-evidence-review-execution' ||
    value.requestedAuthorization.authorizationState !== 'not-authorized' ||
    value.requestedAuthorization.executionAuthorization !== 'not-authorized' ||
    value.requestedAuthorization.maximumExecutions !== 1 ||
    value.requestedAuthorization.maximumRouteCount !== 2 ||
    value.requestedAuthorization.repositoryMutationAuthorized !== false
  ) {
    throw new Error('R7 signed bundle evidence review execution authorization mismatch')
  }

  exactKeys(
    value.inputContract,
    [
      'ownerMustProvideExplicitPaths',
      'requiredInputs',
      'allowedInputClasses',
      'privateKeyAllowed',
      'passphraseAllowed',
      'credentialAllowed',
      'urlAllowed',
      'externalEndpointAllowed'
    ],
    'R7 signed bundle review input contract'
  )
  if (
    value.inputContract.ownerMustProvideExplicitPaths !== true ||
    !same(value.inputContract.requiredInputs, RequiredInputs) ||
    !same(value.inputContract.allowedInputClasses, AllowedInputClasses) ||
    Object.entries(value.inputContract)
      .filter(([key]) => key.endsWith('Allowed'))
      .some(([, item]) => item !== false)
  ) {
    throw new Error('R7 signed bundle evidence review input contract mismatch')
  }

  exactKeys(
    value.executionContract,
    [
      'mode',
      'fixedHarnessOnly',
      'networkAccessAllowed',
      'bundleMutationAllowed',
      'publicKeyMutationAllowed',
      'outputPersistenceAllowed',
      'rawLogRetentionAllowed',
      'screenshotCaptureAllowed',
      'accountDataAccessAllowed',
      'requiredRouteIds',
      'allowedPublicEvidenceFields',
      'prohibitedOutputFields'
    ],
    'R7 signed bundle review execution contract'
  )
  if (
    value.executionContract.mode !== 'single-offline-readonly-redacted-review' ||
    value.executionContract.fixedHarnessOnly !== true ||
    Object.entries(value.executionContract)
      .filter(([key]) => key.endsWith('Allowed'))
      .some(([, item]) => item !== false) ||
    !same(value.executionContract.requiredRouteIds, FixedRouteIds) ||
    !same(
      value.executionContract.allowedPublicEvidenceFields,
      AllowedPublicEvidenceFields
    ) ||
    !same(value.executionContract.prohibitedOutputFields, ProhibitedOutputFields)
  ) {
    throw new Error('R7 signed bundle evidence review execution contract mismatch')
  }

  exactKeys(
    value.roleSeparationContract,
    [
      'releaseAuthor',
      'reviewer',
      'stagingOperator',
      'allRolesMustBeDistinct',
      'codexMayActAsReviewerOnly',
      'reviewerMayAccessPrivateKey',
      'releaseAuthorMayApproveOwnEvidence'
    ],
    'R7 signed bundle review role separation'
  )
  if (
    value.roleSeparationContract.releaseAuthor !== 'external-release-author' ||
    value.roleSeparationContract.reviewer !==
      'independent-bundle-evidence-reviewer' ||
    value.roleSeparationContract.stagingOperator !==
      'staging-acceptance-operator' ||
    value.roleSeparationContract.allRolesMustBeDistinct !== true ||
    value.roleSeparationContract.codexMayActAsReviewerOnly !== true ||
    value.roleSeparationContract.reviewerMayAccessPrivateKey !== false ||
    value.roleSeparationContract.releaseAuthorMayApproveOwnEvidence !== false
  ) {
    throw new Error('R7 signed bundle evidence review role separation mismatch')
  }

  if (
    !same(value.preflightRequirements, PreflightRequirements) ||
    !same(value.requiredChecks, RequiredChecks) ||
    !same(value.abortConditions, AbortConditions)
  ) {
    throw new Error('R7 signed bundle evidence review execution checks mismatch')
  }

  exactKeys(
    value.executionBoundary,
    [
      'realSignedBundleReadAuthorizedAfterApproval',
      'realPublicKeyAndFingerprintReadAuthorizedAfterApproval',
      'privateKeyOrPassphraseHandlingAuthorized',
      'credentialHandlingAuthorized',
      'bundleSigningAuthorized',
      'realUrlAuthorized',
      'externalEndpointConnectionAuthorized',
      'stagingAcceptanceAuthorized',
      'runtimePublicationAuthorized',
      'defaultEnablementAuthorized',
      'otherRouteFamiliesAuthorized',
      'gameCommunicationChangesAuthorized',
      'installerBuildRequiredAtThisGate'
    ],
    'R7 signed bundle review execution boundary'
  )
  if (
    value.executionBoundary.realSignedBundleReadAuthorizedAfterApproval !== true ||
    value.executionBoundary.realPublicKeyAndFingerprintReadAuthorizedAfterApproval !==
      true ||
    Object.entries(value.executionBoundary)
      .filter(([key]) => !key.endsWith('AfterApproval'))
      .some(([, item]) => item !== false) ||
    !same(value.stillProhibited, ExpectedProhibited)
  ) {
    throw new Error('R7 signed bundle evidence review execution boundary widened')
  }

  exactKeys(
    value.review,
    ['author', 'approver', 'reviewedAt', 'approvalDigest'],
    'R7 signed bundle review execution decision review'
  )
  if (
    value.review.author !==
      'codex-r7-signed-bundle-evidence-review-execution-decision-author' ||
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 signed bundle review execution must not claim approval')
  }

  return {
    value,
    semanticDigest: signedBundleEvidenceReviewExecutionSemanticDigest(value)
  }
}

function buildR7SignedBundleEvidenceReviewExecutionDecisionArtifacts({ root }) {
  const requestRaw = fs.readFileSync(path.join(root, ...RequestPath.split('/')))
  const request = validateR7SignedBundleEvidenceReviewExecutionRequest(
    JSON.parse(requestRaw),
    root
  )
  const report = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    generatedAt: request.value.sourceSnapshot.checkedAt,
    status: 'OWNER_DECISION_REQUIRED_R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_EXECUTION',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    gateId: request.value.requestedAuthorization.gateId,
    authorizationState: 'not-authorized',
    executionAuthorization: 'not-authorized',
    maximumExecutions: request.value.requestedAuthorization.maximumExecutions,
    routeCount: request.value.requestedAuthorization.maximumRouteCount,
    requiredInputCount: request.value.inputContract.requiredInputs.length,
    allowedPublicEvidenceFieldCount:
      request.value.executionContract.allowedPublicEvidenceFields.length,
    prohibitedOutputFieldCount:
      request.value.executionContract.prohibitedOutputFields.length,
    requiredCheckCount: request.value.requiredChecks.length,
    abortConditionCount: request.value.abortConditions.length,
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
      'r7-signed-bundle-evidence-review-execution-report.json': report
    },
    source: {
      r7SignedBundleEvidenceReviewExecutionRequestDigest: digest(requestRaw)
    },
    output: {
      r7SignedBundleEvidenceReviewExecutionOwnerDecisionRequired: true,
      r7SignedBundleEvidenceReviewExecutionAuthorized: false,
      r7SignedBundleEvidenceReviewExecutionConsumed: false,
      r7SignedBundleEvidenceReviewExecutionPassed: false,
      r7SignedBundleEvidenceReviewExecutionMaximumExecutions:
        report.maximumExecutions,
      r7SignedBundleEvidenceReviewExecutionRequiredCheckCount:
        report.requiredCheckCount
    }
  }
}

module.exports = {
  R7SignedBundleEvidenceReviewExecutionDecisionOutputFilenames,
  buildR7SignedBundleEvidenceReviewExecutionDecisionArtifacts,
  signedBundleEvidenceReviewExecutionSemanticDigest,
  validateR7SignedBundleEvidenceReviewExecutionRequest
}

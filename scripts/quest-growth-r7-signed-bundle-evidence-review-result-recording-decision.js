const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const CompilerVersion =
  'quest-growth-r7-signed-bundle-evidence-review-result-recording-decision-compiler/1'
const R7SignedBundleEvidenceReviewResultRecordingDecisionOutputFilenames = [
  'r7-signed-bundle-evidence-review-result-recording-report.json'
]
const RequestPath =
  'knowledge/quest-growth/decisions/r7-signed-bundle-evidence-review-result-recording-request.json'
const ExecutionRequestPath =
  'knowledge/quest-growth/decisions/r7-signed-bundle-evidence-review-execution-request.json'
const ExecutionReportPath =
  'knowledge/quest-growth/generated/r7-signed-bundle-evidence-review-execution-report.json'
const ReviewHarnessPath = 'scripts/quest-growth-r7-signed-bundle-evidence-review.js'
const ResultSchemaPath =
  'knowledge/quest-growth/r7/signed-bundle-evidence-review.schema.json'
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
const ProhibitedRecordFields = [
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
const AuthorizedRepositoryPaths = [
  RequestPath,
  'knowledge/quest-growth/generated/r7-signed-bundle-evidence-review-result-recording-report.json',
  'knowledge/quest-growth/generated/source-manifest.json',
  'knowledge/quest-growth/generated/conflict-and-gap-report.json'
]
const RequiredChecks = [
  'prior-execution-approval-and-fixed-harness-digests-match',
  'completed-execution-count-is-exactly-one',
  'execution-is-not-rerun-and-inputs-are-not-read',
  'record-contains-exactly-the-ten-public-evidence-fields',
  'record-contains-none-of-the-fifteen-prohibited-fields',
  'recorded-acceptance-status-is-review-passed',
  'record-remains-bound-to-the-two-reviewed-routes',
  'publication-default-enablement-and-runtime-eligibility-remain-unchanged',
  'no-url-endpoint-secret-account-data-or-game-communication-is-accessed',
  'only-the-four-authorized-governance-artifacts-are-mutated'
]
const AbortConditions = [
  'approval-basis-or-fixed-digest-mismatch',
  'recording-would-require-rerunning-the-review-or-reading-inputs',
  'observed-result-cannot-be-represented-by-the-strict-ten-field-schema',
  'raw-output-path-url-secret-account-data-or-prohibited-field-would-be-persisted',
  'recording-would-change-publication-default-enablement-runtime-eligibility-or-route-content',
  'recording-would-mutate-outside-the-four-authorized-governance-artifacts'
]
const ExpectedProhibited = [
  'execution-rerun-or-input-reread',
  'private-key-or-passphrase-handling',
  'credential-or-account-data-access',
  'bundle-signing-or-mutation',
  'real-url-or-external-endpoint',
  'raw-output-or-prohibited-field-persistence',
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

function exactKeys(value, required, description) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`invalid ${description}`)
  }
  if (
    Object.keys(value).length !== required.length ||
    required.some((key) => !(key in value))
  ) {
    throw new Error(`invalid ${description} keys`)
  }
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function recordingSemanticDigest(value) {
  const copy = JSON.parse(JSON.stringify(value))
  delete copy.sourceSnapshot
  delete copy.review
  return digest(canonicalJson(copy))
}

function validateR7SignedBundleEvidenceReviewResultRecordingRequest(value, root) {
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
      'recordingContract',
      'requiredChecks',
      'abortConditions',
      'executionBoundary',
      'stillProhibited',
      'recordedResult',
      'review'
    ],
    'R7 result recording request'
  )
  if (
    value.requestSchema !==
      'QuestGrowthR7SignedBundleEvidenceReviewResultRecordingRequest/1alpha' ||
    value.requestId !==
      'decision:quest-growth-r7-signed-bundle-evidence-review-result-recording' ||
    value.revision !== 1 ||
    value.status !== 'draft' ||
    value.scope !== 'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_RESULT_RECORDING_ONLY' ||
    value.recordedResult !== null
  ) {
    throw new Error('R7 signed bundle review result recording request mismatch')
  }

  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'source snapshot')
  if (
    !/^[0-9a-f]{40}$/.test(value.sourceSnapshot.auditedBaseCommit) ||
    !Number.isFinite(Date.parse(value.sourceSnapshot.checkedAt))
  ) {
    throw new Error('invalid R7 result recording source snapshot')
  }

  exactKeys(
    value.approvalBasis,
    [
      'executionSemanticDigest',
      'executionRequestDigest',
      'executionReportDigest',
      'reviewHarnessDigest',
      'resultSchemaDigest',
      'candidateVersion',
      'maximumExecutions',
      'completedExecutionCount'
    ],
    'approval basis'
  )
  const executionRequestRaw = fs.readFileSync(path.join(root, ...ExecutionRequestPath.split('/')))
  const executionReportRaw = fs.readFileSync(path.join(root, ...ExecutionReportPath.split('/')))
  if (
    value.approvalBasis.executionSemanticDigest !==
      'sha256:dad3d775d17865f0f8f78000af1adc8b1d204e0d820e483638cc0c202d10c177' ||
    value.approvalBasis.executionRequestDigest !== digest(executionRequestRaw) ||
    value.approvalBasis.executionReportDigest !== digest(executionReportRaw) ||
    value.approvalBasis.reviewHarnessDigest !==
      digest(fs.readFileSync(path.join(root, ...ReviewHarnessPath.split('/')))) ||
    value.approvalBasis.resultSchemaDigest !==
      digest(fs.readFileSync(path.join(root, ...ResultSchemaPath.split('/')))) ||
    value.approvalBasis.candidateVersion !== 'r7.candidate.20260802.1' ||
    value.approvalBasis.maximumExecutions !== 1 ||
    value.approvalBasis.completedExecutionCount !== 1
  ) {
    throw new Error('R7 signed bundle review result recording approval basis mismatch')
  }

  exactKeys(
    value.requestedAuthorization,
    [
      'gateId',
      'authorizationState',
      'resultRecordingAuthorization',
      'maximumRecords',
      'repositoryMutationAuthorizedAfterApproval',
      'executionRerunAuthorized'
    ],
    'requested authorization'
  )
  if (
    value.requestedAuthorization.gateId !==
      'r7-signed-bundle-evidence-review-result-recording' ||
    value.requestedAuthorization.authorizationState !== 'not-authorized' ||
    value.requestedAuthorization.resultRecordingAuthorization !== 'not-authorized' ||
    value.requestedAuthorization.maximumRecords !== 1 ||
    value.requestedAuthorization.repositoryMutationAuthorizedAfterApproval !== true ||
    value.requestedAuthorization.executionRerunAuthorized !== false
  ) {
    throw new Error('R7 signed bundle review result recording authorization mismatch')
  }

  exactKeys(
    value.recordingContract,
    [
      'mode',
      'recordOnlyAlreadyObservedExecution',
      'bundleOrPublicKeyReadAllowed',
      'networkAccessAllowed',
      'rawOutputPersistenceAllowed',
      'redactedResultPersistenceAllowedAfterApproval',
      'requiredRouteIds',
      'allowedPublicEvidenceFields',
      'prohibitedRecordFields',
      'authorizedRepositoryPathsAfterApproval'
    ],
    'recording contract'
  )
  if (
    value.recordingContract.mode !== 'single-existing-redacted-pass-result-record' ||
    value.recordingContract.recordOnlyAlreadyObservedExecution !== true ||
    value.recordingContract.bundleOrPublicKeyReadAllowed !== false ||
    value.recordingContract.networkAccessAllowed !== false ||
    value.recordingContract.rawOutputPersistenceAllowed !== false ||
    value.recordingContract.redactedResultPersistenceAllowedAfterApproval !== true ||
    !same(value.recordingContract.requiredRouteIds, FixedRouteIds) ||
    !same(value.recordingContract.allowedPublicEvidenceFields, AllowedPublicEvidenceFields) ||
    !same(value.recordingContract.prohibitedRecordFields, ProhibitedRecordFields) ||
    !same(value.recordingContract.authorizedRepositoryPathsAfterApproval, AuthorizedRepositoryPaths)
  ) {
    throw new Error('R7 signed bundle review result recording contract mismatch')
  }

  if (!same(value.requiredChecks, RequiredChecks) || !same(value.abortConditions, AbortConditions)) {
    throw new Error('R7 signed bundle review result recording checks mismatch')
  }

  exactKeys(
    value.executionBoundary,
    [
      'existingRedactedResultRecordingAuthorizedAfterApproval',
      'executionRerunAuthorized',
      'bundleOrPublicKeyReadAuthorized',
      'privateKeyOrPassphraseHandlingAuthorized',
      'credentialHandlingAuthorized',
      'realUrlOrEndpointAuthorized',
      'stagingAcceptanceAuthorized',
      'runtimePublicationAuthorized',
      'defaultEnablementAuthorized',
      'otherRouteFamiliesAuthorized',
      'gameCommunicationChangesAuthorized',
      'installerBuildRequiredAtThisGate'
    ],
    'execution boundary'
  )
  if (
    value.executionBoundary.existingRedactedResultRecordingAuthorizedAfterApproval !== true ||
    Object.entries(value.executionBoundary)
      .filter(([key]) => key !== 'existingRedactedResultRecordingAuthorizedAfterApproval')
      .some(([, item]) => item !== false) ||
    !same(value.stillProhibited, ExpectedProhibited)
  ) {
    throw new Error('R7 signed bundle review result recording boundary widened')
  }

  exactKeys(value.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'review')
  if (
    value.review.author !==
      'codex-r7-signed-bundle-evidence-review-result-recording-decision-author' ||
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 result recording request must not claim approval')
  }

  return { value, semanticDigest: recordingSemanticDigest(value) }
}

function buildR7SignedBundleEvidenceReviewResultRecordingDecisionArtifacts({ root }) {
  const requestRaw = fs.readFileSync(path.join(root, ...RequestPath.split('/')))
  const request = validateR7SignedBundleEvidenceReviewResultRecordingRequest(
    JSON.parse(requestRaw),
    root
  )
  const report = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    generatedAt: request.value.sourceSnapshot.checkedAt,
    status: 'OWNER_DECISION_REQUIRED_R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_RESULT_RECORDING',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    gateId: request.value.requestedAuthorization.gateId,
    authorizationState: 'not-authorized',
    resultRecordingAuthorization: 'not-authorized',
    maximumRecords: request.value.requestedAuthorization.maximumRecords,
    completedExecutionCount: request.value.approvalBasis.completedExecutionCount,
    recordedResultCount: 0,
    allowedPublicEvidenceFieldCount:
      request.value.recordingContract.allowedPublicEvidenceFields.length,
    prohibitedRecordFieldCount: request.value.recordingContract.prohibitedRecordFields.length,
    authorizedRepositoryPathCount:
      request.value.recordingContract.authorizedRepositoryPathsAfterApproval.length,
    requiredCheckCount: request.value.requiredChecks.length,
    abortConditionCount: request.value.abortConditions.length,
    executionRerunAuthorized: false,
    inputRereadAuthorized: false,
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED',
    defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED',
    stillProhibited: request.value.stillProhibited
  }
  return {
    artifacts: {
      'r7-signed-bundle-evidence-review-result-recording-report.json': report
    },
    source: {
      r7SignedBundleEvidenceReviewResultRecordingRequestDigest: digest(requestRaw)
    },
    output: {
      r7SignedBundleEvidenceReviewResultRecordingOwnerDecisionRequired: true,
      r7SignedBundleEvidenceReviewResultRecordingAuthorized: false,
      r7SignedBundleEvidenceReviewResultRecorded: false,
      r7SignedBundleEvidenceReviewResultRecordingMaximumRecords: report.maximumRecords,
      r7SignedBundleEvidenceReviewResultRecordingAllowedFieldCount:
        report.allowedPublicEvidenceFieldCount
    }
  }
}

module.exports = {
  R7SignedBundleEvidenceReviewResultRecordingDecisionOutputFilenames,
  buildR7SignedBundleEvidenceReviewResultRecordingDecisionArtifacts,
  recordingSemanticDigest,
  validateR7SignedBundleEvidenceReviewResultRecordingRequest
}

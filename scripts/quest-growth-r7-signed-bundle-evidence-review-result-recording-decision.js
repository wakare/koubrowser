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
const FixedRecordedResult = {
  dataVersion: 'r7.20260802.1',
  publishedAt: '2026-08-02T14:00:30.121Z',
  manifestSha256:
    'sha256:b2490f595db0b01d8eec0a7211c0d1a64448bde8e02a30db5875e99b496b85df',
  questKnowledgeSha256:
    'sha256:0b0226c9bfc983b6f0da81684e14ff484ef383596fad0ac92b2302783dd49d14',
  publicKeySha256:
    'sha256:74937f3c0c5765c3ec15da217a63df0a23f6378d78383eacddfb047dbcc73b40',
  fileCount: 113,
  payloadBytes: 804189,
  routeCount: 2,
  requiredCheckCount: 10,
  redactedAcceptanceStatus: 'review-passed'
}
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
    !['draft', 'approved'].includes(value.status) ||
    value.scope !== 'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_RESULT_RECORDING_ONLY'
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
    !['not-authorized', 'consumed'].includes(
      value.requestedAuthorization.authorizationState
    ) ||
    !['not-authorized', 'consumed'].includes(
      value.requestedAuthorization.resultRecordingAuthorization
    ) ||
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
  const commonReviewValid =
    value.review.author ===
    'codex-r7-signed-bundle-evidence-review-result-recording-decision-author'
  const draftValid =
    value.status === 'draft' &&
    value.requestedAuthorization.authorizationState === 'not-authorized' &&
    value.requestedAuthorization.resultRecordingAuthorization ===
      'not-authorized' &&
    value.recordedResult === null &&
    value.review.approver === null &&
    value.review.reviewedAt === null &&
    value.review.approvalDigest === null
  const approvedValid =
    value.status === 'approved' &&
    value.requestedAuthorization.authorizationState === 'consumed' &&
    value.requestedAuthorization.resultRecordingAuthorization === 'consumed' &&
    same(value.recordedResult, FixedRecordedResult) &&
    value.review.approver === 'project-owner' &&
    typeof value.review.reviewedAt === 'string' &&
    Number.isFinite(Date.parse(value.review.reviewedAt)) &&
    value.review.approvalDigest ===
      'sha256:2f0dd74cbb96f119f89bd048b54a6fc98e19a3dd3db95ef8cab69e227cfd555d'
  if (!commonReviewValid || (!draftValid && !approvedValid)) {
    throw new Error('R7 result recording approval state mismatch')
  }

  return { value, semanticDigest: recordingSemanticDigest(value) }
}

function buildR7SignedBundleEvidenceReviewResultRecordingDecisionArtifacts({ root }) {
  const requestRaw = fs.readFileSync(path.join(root, ...RequestPath.split('/')))
  const request = validateR7SignedBundleEvidenceReviewResultRecordingRequest(
    JSON.parse(requestRaw),
    root
  )
  const recorded = request.value.status === 'approved'
  const report = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    generatedAt: request.value.sourceSnapshot.checkedAt,
    status: recorded
      ? 'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_RESULT_RECORDED'
      : 'OWNER_DECISION_REQUIRED_R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_RESULT_RECORDING',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    gateId: request.value.requestedAuthorization.gateId,
    authorizationState: recorded ? 'consumed' : 'not-authorized',
    resultRecordingAuthorization: recorded ? 'consumed' : 'not-authorized',
    maximumRecords: request.value.requestedAuthorization.maximumRecords,
    completedExecutionCount: request.value.approvalBasis.completedExecutionCount,
    recordedResultCount: recorded ? 1 : 0,
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
    recordedResult: recorded ? request.value.recordedResult : null,
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
      r7SignedBundleEvidenceReviewResultRecordingOwnerDecisionRequired:
        !recorded,
      r7SignedBundleEvidenceReviewResultRecordingAuthorized: recorded,
      r7SignedBundleEvidenceReviewResultRecorded: recorded,
      r7SignedBundleEvidenceReviewResultRecordingMaximumRecords: report.maximumRecords,
      r7SignedBundleEvidenceReviewResultRecordingAllowedFieldCount:
        report.allowedPublicEvidenceFieldCount,
      r7SignedBundleEvidenceReviewExecutionOwnerDecisionRequired: !recorded,
      r7SignedBundleEvidenceReviewExecutionAuthorized: recorded,
      r7SignedBundleEvidenceReviewExecutionConsumed: recorded,
      r7SignedBundleEvidenceReviewExecutionPassed: recorded
    }
  }
}

module.exports = {
  R7SignedBundleEvidenceReviewResultRecordingDecisionOutputFilenames,
  buildR7SignedBundleEvidenceReviewResultRecordingDecisionArtifacts,
  recordingSemanticDigest,
  validateR7SignedBundleEvidenceReviewResultRecordingRequest
}

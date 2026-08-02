const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const R7ResponsiveLayoutDecisionCompilerVersion =
  'quest-growth-r7-responsive-layout-decision-compiler/1'
const R7ResponsiveLayoutDecisionOutputFilenames = [
  'r7-responsive-layout-fix-report.json'
]
const ApprovedResponsiveLayoutSemanticDigest =
  'sha256:3b7c6d8b5806cb5c0e850d3a197d9f276d49a90a55cdf75a3a3d03ee031f1e43'
const FixedGrowthComponentDigest =
  'sha256:c50c847d7b392759d94f65a8dd8bbaea8a047b1d12b5f4a5f6f308cded1e9947'
const FixedQuestGuideDigest =
  'sha256:8d937c4c59c5cd4fb48cc8ee1a24c7637aabd6aa3d82a36387084b6de7f297e4'
const FixedSmokeHarnessDigest =
  'sha256:f2c35818aa8cb41d43fee52a5bd6582cdec2344d5ebf4b8f31aee3ae48775400'
const CommitPattern = /^[0-9a-f]{40}$/
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ProtectedPaths = [
  'src/main/kcbrowser.ts',
  'src/preload/xhr-hook.ts',
  'src/common/kcsapi_hook.ts'
]
const AuthorizedPaths = [
  'src/renderer/src/components/QuestGrowthCheck.vue',
  'src/renderer/src/components/__tests__/QuestGrowthCheck.test.ts',
  'scripts/electron-smoke.js',
  'src/main/__tests__/electron-smoke-script.test.ts'
]
const ExpectedChanges = [
  'add-component-inline-size-containment-to-quest-growth-root',
  'replace-viewport-only-responsive-collapse-with-container-aware-narrow-layout',
  'allow-header-counts-context-controls-and-route-badges-to-wrap-without-overflow',
  'preserve-existing-layout-at-non-narrow-container-widths',
  'add-anonymous-221px-route-panel-regression-for-resources-asw-and-unset'
]
const ExpectedChecks = [
  'closed-route-section-has-no-horizontal-overflow-at-221px',
  'resources-reviewed-route-has-no-horizontal-overflow-at-221px',
  'asw-reviewed-route-has-no-horizontal-overflow-at-221px',
  'unset-fallback-has-no-horizontal-overflow-at-221px',
  'session-only-focus-and-resource-posture-behavior-is-unchanged',
  'wide-container-layout-is-unchanged',
  'typecheck-and-full-tests-pass',
  'protected-game-communication-digests-remain-fixed'
]
const ExpectedImplementationResult = {
  recordedAt: '2026-08-02T08:09:45.165Z',
  approvedSemanticDigest:
    'sha256:3b7c6d8b5806cb5c0e850d3a197d9f276d49a90a55cdf75a3a3d03ee031f1e43',
  implementationCommit: 'dd6220f7efc4696a6bd8224b5f628dca7a4d08d7',
  changedPaths: AuthorizedPaths,
  growthComponentDigest:
    'sha256:60ea3622f93e058a00ad6d062eb3fcef5dbb1e5f1decd90e6a0e975023b9f60d',
  smokeHarnessDigest:
    'sha256:5de07f3430079efba6c710d4848463086643582821635eda73c2fc73be1e527c',
  componentTestCount: 10,
  harnessTestCount: 42,
  fullTestCount: 1224,
  typecheckPassed: true,
  productionBuildPassed: true,
  anonymousSignedFixturePassed: true,
  currentWindow: { width: 1316, height: 632 },
  controlledWindow: { width: 1600, height: 800 },
  panelClientWidth: 221,
  closedPanelScrollWidth: 221,
  resourcesPanelScrollWidth: 221,
  aswPanelScrollWidth: 221,
  unsetPanelScrollWidth: 221,
  routeContentWidth: 195,
  routeContentScrollWidth: 195,
  sessionOnlyStatePreserved: true,
  wideLayoutPreserved: true,
  pagePanelFilterWindowStateRestored: true,
  realAccountExecutionPerformed: false,
  routeContentChangesMade: false,
  localFactSemanticsChangesMade: false,
  gameCommunicationChangesMade: false
}

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

function responsiveLayoutRequestSemanticDigest(value) {
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

function validateR7ResponsiveLayoutFixRequest(value, { root, base }) {
  exactKeys(
    value,
    [
      'authoringSchema',
      'requestId',
      'revision',
      'status',
      'scope',
      'sourceSnapshot',
      'failureBasis',
      'diagnosis',
      'requestedAuthorization',
      'changeContract',
      'verificationContract',
      'implementationResult',
      'executionBoundary',
      'stillProhibited',
      'review'
    ],
    'R7 responsive layout fix request'
  )
  if (
    value.authoringSchema !== 'QuestGrowthR7ResponsiveLayoutFixRequest/1alpha' ||
    value.requestId !== 'decision:quest-growth-r7-route-panel-responsive-fix-authoring' ||
    value.revision !== 1 ||
    !['draft', 'approved'].includes(value.status) ||
    value.scope !== 'R7_ROUTE_PANEL_RESPONSIVE_FIX_AUTHORING_ONLY'
  ) {
    throw new Error('R7 responsive layout request scope mismatch')
  }
  const approved = value.status === 'approved'
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R7 layout source snapshot')
  if (!CommitPattern.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R7 layout source commit')
  }
  if (
    typeof value.sourceSnapshot.checkedAt !== 'string' ||
    !TimestampPattern.test(value.sourceSnapshot.checkedAt)
  ) {
    throw new Error('invalid R7 layout source timestamp')
  }

  const realAccountReportPath = path.join(
    base,
    'generated',
    'r7-real-account-acceptance-report.json'
  )
  const realAccountReportRaw = fs.readFileSync(realAccountReportPath)
  const realAccountReport = JSON.parse(realAccountReportRaw)
  const expectedFailureBasis = {
    acceptanceSemanticDigest: realAccountReport.semanticDigest,
    acceptanceReportDigest: digest(realAccountReportRaw),
    acceptanceResultCommit: value.sourceSnapshot.auditedBaseCommit,
    growthComponentDigest: FixedGrowthComponentDigest,
    questGuideDigest: FixedQuestGuideDigest,
    smokeHarnessDigest: FixedSmokeHarnessDigest,
    reasonCode: realAccountReport.acceptanceReasonCode,
    layoutDiagnostic: realAccountReport.layoutDiagnostic,
    protectedCommunicationDigests: Object.fromEntries(
      ProtectedPaths.map((item) => [
        item,
        digest(fs.readFileSync(path.join(root, ...item.split('/'))))
      ])
    )
  }
  exactKeys(value.failureBasis, Object.keys(expectedFailureBasis), 'R7 layout failure basis')
  exactKeys(
    value.failureBasis.protectedCommunicationDigests,
    ProtectedPaths,
    'R7 layout protected digests'
  )
  if (!same(value.failureBasis, expectedFailureBasis)) {
    throw new Error('R7 responsive layout failure basis mismatch')
  }
  if (
    realAccountReport.status !== 'REAL_ACCOUNT_READONLY_ACCEPTANCE_FAIL_CLOSED' ||
    realAccountReport.executionAuthorization !== 'consumed' ||
    realAccountReport.checkedRouteCount !== 0 ||
    value.failureBasis.layoutDiagnostic.clientWidth !== 221 ||
    value.failureBasis.layoutDiagnostic.scrollWidth !== 257
  ) {
    throw new Error('R7 responsive layout failure is not fixed to revision 6 evidence')
  }

  exactKeys(value.diagnosis, ['rootCause', 'observations'], 'R7 layout diagnosis')
  if (
    value.diagnosis.rootCause !==
      'viewport-media-query-does-not-reflect-narrow-workspace-container' ||
    !Array.isArray(value.diagnosis.observations) ||
    value.diagnosis.observations.length !== 4
  ) {
    throw new Error('R7 responsive layout diagnosis mismatch')
  }
  exactKeys(
    value.requestedAuthorization,
    ['gateId', 'authorizationState', 'implementationAuthorization', 'authorizedPaths'],
    'R7 layout requested authorization'
  )
  if (
    value.requestedAuthorization.gateId !== 'r7-route-panel-responsive-fix-authoring' ||
    value.requestedAuthorization.authorizationState !==
      (approved ? 'authorized' : 'not-authorized') ||
    value.requestedAuthorization.implementationAuthorization !==
      (approved ? 'consumed' : 'not-authorized') ||
    !same(value.requestedAuthorization.authorizedPaths, AuthorizedPaths)
  ) {
    throw new Error('R7 responsive layout authorization mismatch')
  }
  exactKeys(
    value.changeContract,
    [
      'changes',
      'routeContentChangesAuthorized',
      'localFactSemanticsChangesAuthorized',
      'translationChangesAuthorized'
    ],
    'R7 layout change contract'
  )
  if (
    !same(value.changeContract.changes, ExpectedChanges) ||
    value.changeContract.routeContentChangesAuthorized !== false ||
    value.changeContract.localFactSemanticsChangesAuthorized !== false ||
    value.changeContract.translationChangesAuthorized !== false
  ) {
    throw new Error('R7 responsive layout change contract mismatch')
  }
  exactKeys(
    value.verificationContract,
    [
      'minimumPanelWidth',
      'maximumOverflowTolerance',
      'anonymousSignedFixtureRequired',
      'requiredChecks'
    ],
    'R7 layout verification contract'
  )
  if (
    value.verificationContract.minimumPanelWidth !== 221 ||
    value.verificationContract.maximumOverflowTolerance !== 1 ||
    value.verificationContract.anonymousSignedFixtureRequired !== true ||
    !same(value.verificationContract.requiredChecks, ExpectedChecks)
  ) {
    throw new Error('R7 responsive layout verification contract mismatch')
  }
  exactKeys(
    value.implementationResult,
    Object.keys(ExpectedImplementationResult),
    'R7 responsive layout implementation result'
  )
  if (!same(value.implementationResult, ExpectedImplementationResult)) {
    throw new Error('R7 responsive layout implementation result mismatch')
  }
  exactKeys(
    value.executionBoundary,
    [
      'realAccountExecutionAuthorized',
      'runtimePublicationAuthorized',
      'defaultEnablementAuthorized',
      'otherRouteFamiliesAuthorized',
      'mainOrPreloadProductionChangesAuthorized',
      'gameCommunicationChangesAuthorized',
      'automaticGameOperationAuthorized',
      'installerBuildRequiredAtThisAuthoringGate'
    ],
    'R7 layout execution boundary'
  )
  if (Object.values(value.executionBoundary).some((item) => item !== false)) {
    throw new Error('R7 responsive layout execution boundary widened')
  }
  if (!Array.isArray(value.stillProhibited) || value.stillProhibited.length !== 11) {
    throw new Error('R7 responsive layout prohibited behavior mismatch')
  }
  exactKeys(value.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'R7 layout review')
  const semanticDigest = responsiveLayoutRequestSemanticDigest(value)
  if (approved) {
    if (
      value.review.approver !== 'project-owner' ||
      value.review.reviewedAt === null ||
      !TimestampPattern.test(value.review.reviewedAt) ||
      value.review.approvalDigest !== semanticDigest ||
      semanticDigest !== ApprovedResponsiveLayoutSemanticDigest
    ) {
      throw new Error('approved R7 responsive layout semantic digest mismatch')
    }
  } else if (
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 responsive layout packet must not claim approval')
  }
  return { value, semanticDigest, approved }
}

function buildR7ResponsiveLayoutDecisionArtifacts({ root, base }) {
  const requestPath = path.join(base, 'decisions', 'r7-responsive-layout-fix-request.json')
  const requestRaw = fs.readFileSync(requestPath)
  const request = validateR7ResponsiveLayoutFixRequest(JSON.parse(requestRaw), { root, base })
  const report = {
    schemaVersion: 1,
    compilerVersion: R7ResponsiveLayoutDecisionCompilerVersion,
    generatedAt: request.approved
      ? request.value.review.reviewedAt
      : request.value.sourceSnapshot.checkedAt,
    status: request.approved
      ? 'R7_ROUTE_PANEL_RESPONSIVE_FIX_IMPLEMENTED_ANONYMOUSLY_VERIFIED'
      : 'OWNER_DECISION_REQUIRED_R7_ROUTE_PANEL_RESPONSIVE_FIX',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    gateId: request.value.requestedAuthorization.gateId,
    authorizationState: request.approved ? 'authorized' : 'not-authorized',
    implementationAuthorization: request.approved ? 'consumed' : 'not-authorized',
    authorizedPaths: request.value.requestedAuthorization.authorizedPaths,
    reasonCode: request.value.failureBasis.reasonCode,
    layoutDiagnostic: request.value.failureBasis.layoutDiagnostic,
    rootCause: request.value.diagnosis.rootCause,
    changeCount: request.value.changeContract.changes.length,
    requiredCheckCount: request.value.verificationContract.requiredChecks.length,
    minimumPanelWidth: request.value.verificationContract.minimumPanelWidth,
    maximumOverflowTolerance:
      request.value.verificationContract.maximumOverflowTolerance,
    anonymousSignedFixtureRequired:
      request.value.verificationContract.anonymousSignedFixtureRequired,
    implementationCommit: request.value.implementationResult.implementationCommit,
    growthComponentDigest: request.value.implementationResult.growthComponentDigest,
    smokeHarnessDigest: request.value.implementationResult.smokeHarnessDigest,
    fullTestCount: request.value.implementationResult.fullTestCount,
    anonymousSignedFixturePassed:
      request.value.implementationResult.anonymousSignedFixturePassed,
    currentWindow: request.value.implementationResult.currentWindow,
    controlledWindow: request.value.implementationResult.controlledWindow,
    panelClientWidth: request.value.implementationResult.panelClientWidth,
    panelScrollWidths: {
      closed: request.value.implementationResult.closedPanelScrollWidth,
      resources: request.value.implementationResult.resourcesPanelScrollWidth,
      asw: request.value.implementationResult.aswPanelScrollWidth,
      unset: request.value.implementationResult.unsetPanelScrollWidth
    },
    pagePanelFilterWindowStateRestored:
      request.value.implementationResult.pagePanelFilterWindowStateRestored,
    realAccountExecutionAuthorization: 'R7_NOT_AUTHORIZED',
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED',
    defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED',
    stillProhibited: request.value.stillProhibited
  }
  return {
    artifacts: { 'r7-responsive-layout-fix-report.json': report },
    source: { r7ResponsiveLayoutFixRequestDigest: digest(requestRaw) },
    output: {
      r7ResponsiveLayoutFixOwnerDecisionRequired: !request.approved,
      r7ResponsiveLayoutFixAuthorizedPathCount: request.approved
        ? report.authorizedPaths.length
        : 0,
      r7ResponsiveLayoutFixRequiredCheckCount: report.requiredCheckCount
    }
  }
}

module.exports = {
  R7ResponsiveLayoutDecisionOutputFilenames,
  buildR7ResponsiveLayoutDecisionArtifacts,
  responsiveLayoutRequestSemanticDigest,
  validateR7ResponsiveLayoutFixRequest
}

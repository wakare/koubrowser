const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const R7RealAccountDecisionCompilerVersion =
  'quest-growth-r7-real-account-decision-compiler/14'
const R7RealAccountDecisionOutputFilenames = ['r7-real-account-acceptance-report.json']
const CommitPattern = /^[0-9a-f]{40}$/
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const FixedRendererSemanticDigest =
  'sha256:840a73bb1f72683756774b2a5e4403d0f91dc23410a67f4c5ed5dc417bb98363'
const ApprovedRealAccountSemanticDigest =
  'sha256:497bc51162e26ac696db7219bc876ff56dd0bbfd932e5dddec89a5460a405930'
const FixedGrowthComponentDigest =
  'sha256:60ea3622f93e058a00ad6d062eb3fcef5dbb1e5f1decd90e6a0e975023b9f60d'
const FixedQuestGuideDigest =
  'sha256:8d937c4c59c5cd4fb48cc8ee1a24c7637aabd6aa3d82a36387084b6de7f297e4'
const FixedSmokeHarnessDigest =
  'sha256:5de07f3430079efba6c710d4848463086643582821635eda73c2fc73be1e527c'
const FocusByFamily = {
  'expedition-resource-periodic-loop': 'resources',
  'anti-submarine-foundation': 'asw'
}
const ExpectedOwnerActions = [
  'close-normal-koubrowser-and-confirm-local-backup',
  'enter-all-credentials-and-complete-authentication',
  'click-game-start-once',
  'confirm-the-five-visible-acceptance-statements'
]
const ExpectedAgentActions = [
  'launch-the-fixed-commit-acceptance-harness',
  'wait-for-owner-to-complete-login-and-game-start',
  'inspect-rendered-route-dom-and-layout-metrics',
  'emit-redacted-pass-fail-summary',
  'restore-page-filter-panel-and-window-state'
]
const ExpectedPreflight = [
  'fixed-commit-and-all-approval-basis-digests-match',
  'typecheck-and-full-tests-pass',
  'quest-growth-authoring-verify-passes',
  'anonymous-signed-data-update-smoke-passes',
  'protected-game-communication-files-match-fixed-digests',
  'normal-koubrowser-is-closed-and-owner-confirms-backup'
]
const ExpectedChecks = [
  'route-section-is-closed-before-explicit-owner-expand',
  'resources-focus-shows-only-the-reviewed-resource-route',
  'asw-focus-shows-only-the-reviewed-asw-route',
  'route-content-matches-fixed-route-semantic-digests',
  'manual-confirmation-labels-do-not-claim-current-readiness-or-success',
  'missing-or-inapplicable-focus-keeps-the-existing-non-route-fallback',
  'route-dom-and-redacted-summary-contain-no-account-identifiers-or-raw-payload',
  'route-panel-has-no-horizontal-overflow-at-acceptance-window-sizes',
  'existing-quest-guide-current-and-all-views-remain-available',
  'route-expand-and-focus-selection-are-not-persisted-after-reopen',
  'page-filter-panel-and-window-state-are-restored',
  'no-game-action-or-game-communication-mutation-occurs'
]
const ExpectedAllowedOutput = [
  'fixed-commit',
  'knowledge-version',
  'route-ids-and-semantic-digests',
  'focus-and-route-counts',
  'boolean-check-results',
  'client-and-scroll-dimensions',
  'redacted-error-codes',
  'acceptance-started-at-and-completed-at'
]
const ExpectedForbiddenOutput = [
  'credentials',
  'cookies',
  'api-token',
  'member-id',
  'admiral-name',
  'server-id',
  'ship-instance-id',
  'equipment-instance-id',
  'raw-api-payload',
  'unredacted-dom',
  'unredacted-screenshot',
  'saved-account-snapshot'
]
const ExpectedAbortConditions = [
  'agent-is-asked-to-handle-credentials-or-click-game-start',
  'approval-basis-or-protected-file-digest-mismatch',
  'route-is-expired-withdrawn-unreviewed-or-digest-mismatched',
  'acceptance-requires-any-game-action-beyond-owner-game-start',
  'unredacted-account-data-would-be-written-or-exported',
  'page-filter-panel-or-window-state-cannot-be-restored',
  'owner-cannot-observe-or-confirm-the-required-ui'
]
const ExpectedPriorAttempt = {
  recordedAt: '2026-08-02T03:11:23.756Z',
  approvedSemanticDigest:
    'sha256:4518ded2c385593aa8fa046798b03f1c85f9ae2d18b51fed2fff467aa67cc5fe',
  result: 'blocked-before-route-inspection',
  reasonCode: 'TASK_WORKSPACE_PAGE_NOT_VISIBLE',
  accountDataReady: true,
  routeInspectionStarted: false,
  gameActionAfterOwnerGameStart: false,
  rawEvidenceRetained: false,
  applicationProcessClosed: true
}
const ExpectedHarnessAmendment = {
  revision: 3,
  supersedesRevision: 2,
  reasonCode: 'TALL_AND_COMPACT_TASK_GUIDE_LAYOUT_SELECTION',
  changes: [
    'inspect-primary-overview-quest-guide-when-primary-workspace-is-visible',
    'inspect-or-temporarily-restore-secondary-task-page-in-compact-layout',
    'remove-panel-text-from-timeout-diagnostics',
    'verify-tall-primary-and-compact-hidden-layouts-with-anonymous-signed-fixtures'
  ],
  anonymousHiddenLayoutFixtureRequired: true,
  anonymousTallLayoutFixtureRequired: true,
  productionCodeChangesAuthorized: false,
  routeContentChangesAuthorized: false
}
const ExpectedPreviousExecutionResult = {
  recordedAt: '2026-08-02T04:44:15.520Z',
  approvedSemanticDigest:
    'sha256:8fec2825a32362949041fd2c13c3aadca9bd900988f4f829b8eff4af6d92820c',
  requestRevision: 4,
  status: 'fail-closed',
  stage: 'post-route-responsive-layout-sweep',
  reasonCode: 'SURFACE_RESPONSIVE_WORKSPACE_MODE_TIMEOUT',
  accountDataReady: true,
  routeInspectionStarted: true,
  checkedRouteCount: 2,
  gameActionAfterOwnerGameStart: false,
  rawEvidenceRetained: false,
  screenshotCaptured: false,
  accountDataExported: false,
  pageFilterPanelWindowStateRestored: true,
  applicationProcessClosed: true
}
const ExpectedExecutionResult = {
  recordedAt: '2026-08-02T08:22:53.365Z',
  approvedSemanticDigest:
    'sha256:497bc51162e26ac696db7219bc876ff56dd0bbfd932e5dddec89a5460a405930',
  requestRevision: 7,
  status: 'pass',
  stage: 'reviewed-route-readonly-acceptance-complete',
  reasonCode: 'R7_REVIEWED_ROUTES_READONLY_ACCEPTANCE_PASSED',
  accountDataReady: true,
  routeInspectionStarted: true,
  checkedRouteCount: 2,
  layoutDiagnostic: { clientWidth: 146, scrollWidth: 146 },
  currentSizeNoHorizontalOverflow: true,
  controlledSizeNoHorizontalOverflow: true,
  routeContentMatches: true,
  manualConfirmationVisible: true,
  unsetFallbackChecked: true,
  sessionOnlyState: true,
  gameActionAfterOwnerGameStart: false,
  rawEvidenceRetained: false,
  screenshotCaptured: false,
  accountDataExported: false,
  pageFilterPanelWindowStateRestored: true,
  applicationProcessClosed: true
}
const ExpectedRetryAuthorization = {
  revision: 4,
  supersedesRevision: 3,
  reasonCode: 'ACCOUNT_DATA_NOT_READY_WITHIN_MANUAL_WINDOW',
  maximumExecutions: 1,
  manualLoginTimeoutMs: 300000,
  sameReviewedRoutesOnly: true,
  harnessChangesAuthorized: false,
  productionCodeChangesAuthorized: false,
  routeContentChangesAuthorized: false
}
const ExpectedProposedHarnessAmendment = {
  revision: 5,
  supersedesRevision: 4,
  reasonCode: 'SEPARATE_ROUTE_ACCEPTANCE_FROM_GENERIC_WORKSPACE_REGRESSION',
  changes: [
    'replace-real-account-wide-workspace-sweep-with-dedicated-route-panel-size-checks',
    'preserve-custom-page-label-order-visibility-and-active-page',
    'check-current-and-one-controlled-window-size-with-full-bounds-restore',
    'emit-only-redacted-layout-diagnostics',
    'verify-custom-layout-with-anonymous-signed-fixture'
  ],
  authorizedPaths: [
    'scripts/electron-smoke.js',
    'src/main/__tests__/electron-smoke-script.test.ts'
  ],
  anonymousCustomLayoutFixtureRequired: true,
  realAccountExecutionAuthorized: false,
  productionCodeChangesAuthorized: false,
  routeContentChangesAuthorized: false
}
const ExpectedHarnessAmendmentImplementation = {
  revision: 5,
  approvedSemanticDigest:
    'sha256:4914e3ab307c85db7d862700c587ce73c7b93950e6a441999dc860479c577402',
  implementationCommit: '5a220292cee3a595b7121712e45f7fac3a95bdc0',
  smokeHarnessDigest:
    'sha256:f2c35818aa8cb41d43fee52a5bd6582cdec2344d5ebf4b8f31aee3ae48775400',
  authorizedPathsChanged: [
    'scripts/electron-smoke.js',
    'src/main/__tests__/electron-smoke-script.test.ts'
  ],
  anonymousSignedCustomLayoutFixturePassed: true,
  currentSize: { width: 1316, height: 632 },
  controlledSize: { width: 1600, height: 800 },
  reviewedRouteCount: 2,
  unsetFallbackChecked: true,
  pageNamesOrderVisibilityRestored: true,
  activePagesRestored: true,
  panelEditorsRestored: true,
  questFilterRestored: true,
  windowBoundsRestored: true,
  typecheckPassed: true,
  targetedTestCount: 41,
  nonGovernanceTestsPassed: true,
  realAccountExecutionPerformed: false,
  productionCodeChangesMade: false,
  routeContentChangesMade: false,
  gameCommunicationChangesMade: false
}
const ExpectedRetryRequest = {
  revision: 6,
  supersedesRevision: 5,
  reasonCode: 'HARNESS_AMENDMENT_IMPLEMENTED_AND_ANONYMOUSLY_VERIFIED',
  maximumExecutions: 1,
  manualLoginTimeoutMs: 300000,
  sameReviewedRoutesOnly: true,
  fixedHarnessDigest:
    'sha256:f2c35818aa8cb41d43fee52a5bd6582cdec2344d5ebf4b8f31aee3ae48775400',
  genericWideWorkspaceRegressionExcluded: true,
  currentAndControlledSizeRequired: true,
  realAccountExecutionAuthorized: false,
  harnessChangesAuthorized: false,
  productionCodeChangesAuthorized: false,
  routeContentChangesAuthorized: false
}
const ExpectedResponsiveLayoutFixImplementation = {
  approvedSemanticDigest:
    'sha256:3b7c6d8b5806cb5c0e850d3a197d9f276d49a90a55cdf75a3a3d03ee031f1e43',
  implementationCommit: 'dd6220f7efc4696a6bd8224b5f628dca7a4d08d7',
  implementationReportDigest:
    'sha256:d438f3b7b352c9a59fab22ed4f44859847e490b1b7c7b4f018c7db30b1320c50',
  growthComponentDigest: FixedGrowthComponentDigest,
  smokeHarnessDigest: FixedSmokeHarnessDigest,
  anonymousSignedFixturePassed: true,
  panelClientWidth: 221,
  maximumPanelScrollWidth: 221,
  currentAndControlledWindowPassed: true,
  pagePanelFilterWindowStateRestored: true,
  realAccountExecutionPerformed: false
}
const ExpectedPostFixRetryRequest = {
  revision: 7,
  supersedesRevision: 6,
  reasonCode: 'RESPONSIVE_LAYOUT_FIX_IMPLEMENTED_AND_ANONYMOUSLY_VERIFIED',
  maximumExecutions: 1,
  manualLoginTimeoutMs: 300000,
  sameReviewedRoutesOnly: true,
  fixedGrowthComponentDigest: FixedGrowthComponentDigest,
  fixedHarnessDigest: FixedSmokeHarnessDigest,
  currentAndControlledSizeRequired: true,
  panelClientWidthRegression: 221,
  realAccountExecutionAuthorized: false,
  harnessChangesAuthorized: false,
  productionCodeChangesAuthorized: false,
  routeContentChangesAuthorized: false
}
const ExpectedProhibited = [
  'credential-handling-by-agent',
  'agent-click-game-start',
  'game-operation-after-game-start',
  'game-communication-mutation',
  'route-content-mutation',
  'unredacted-account-evidence-retention',
  'runtime-publication',
  'default-enablement',
  'other-route-family-acceptance'
]
const ProtectedPaths = [
  'src/main/kcbrowser.ts',
  'src/preload/xhr-hook.ts',
  'src/common/kcsapi_hook.ts'
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

function identifier(value, description) {
  if (typeof value !== 'string' || !IdentifierPattern.test(value)) {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function timestamp(value, description) {
  if (
    typeof value !== 'string' ||
    !TimestampPattern.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function realAccountRequestSemanticDigest(value) {
  const payload = Object.fromEntries(
    Object.entries(value).filter(
      ([key]) =>
        key !== 'status' &&
        key !== 'review' &&
        key !== 'executionResult' &&
        key !== 'previousExecutionResult'
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

function validateR7RealAccountAcceptanceRequest(
  value,
  { root, base, r7AuthorizationReport, r7RendererReport }
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
      'ownerOnlyActions',
      'agentReadOnlyActions',
      'preflightRequirements',
      'requiredChecks',
      'evidenceContract',
      'restoreContract',
      'abortConditions',
      'priorAttempt',
      'harnessAmendment',
      'retryAuthorization',
      'proposedHarnessAmendment',
      'harnessAmendmentImplementation',
      'retryRequest',
      'previousExecutionResult',
      'executionResult',
      'responsiveLayoutFixImplementation',
      'postFixRetryRequest',
      'executionBoundary',
      'stillProhibited',
      'review'
    ],
    'R7 real-account acceptance request'
  )
  if (
    value.authoringSchema !== 'QuestGrowthR7RealAccountAcceptanceRequest/1alpha' ||
    value.requestId !== 'decision:quest-growth-r7-real-account-readonly-acceptance' ||
    value.revision !== 7 ||
    !['draft', 'approved'].includes(value.status) ||
    value.scope !== 'R7_REAL_ACCOUNT_READONLY_ACCEPTANCE_ONLY'
  ) {
    throw new Error('R7 real-account request must remain acceptance-only')
  }
  const approved = value.status === 'approved'
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R7 real-account snapshot')
  if (!CommitPattern.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R7 real-account audited commit')
  }
  timestamp(value.sourceSnapshot.checkedAt, 'R7 real-account checkedAt')

  const authorizationRaw = fs.readFileSync(
    path.join(base, 'decisions', 'r7-authorization-request.json')
  )
  const realAccountGate = r7AuthorizationReport.authorizationGates.find(
    (gate) => gate.gateId === 'r7-real-account-readonly-acceptance'
  )
  const expectedBasis = {
    realAccountGateSemanticDigest: realAccountGate?.semanticDigest,
    authorizationRequestDigest: digest(authorizationRaw),
    rendererDecisionSemanticDigest: r7RendererReport.semanticDigest,
    rendererDecisionRequestDigest: r7RendererReport.requestDigest,
    routeCatalogDigest: digest(fs.readFileSync(path.join(base, 'r7', 'route-catalog.json'))),
    routeSelectorDigest: digest(
      fs.readFileSync(path.join(root, 'src', 'common', 'quest_growth_reviewed_routes.ts'))
    ),
    growthComponentDigest: FixedGrowthComponentDigest,
    questGuideDigest: FixedQuestGuideDigest,
    smokeHarnessDigest: FixedSmokeHarnessDigest,
    protectedCommunicationDigests: Object.fromEntries(
      ProtectedPaths.map((item) => [item, digest(fs.readFileSync(path.join(root, ...item.split('/'))))])
    )
  }
  exactKeys(value.approvalBasis, Object.keys(expectedBasis), 'R7 real-account approval basis')
  exactKeys(
    value.approvalBasis.protectedCommunicationDigests,
    ProtectedPaths,
    'R7 protected communication digests'
  )
  for (const [key, item] of Object.entries(value.approvalBasis)) {
    if (key === 'protectedCommunicationDigests') {
      for (const protectedDigest of Object.values(item)) {
        if (!DigestPattern.test(protectedDigest)) {
          throw new Error('invalid R7 protected communication digest')
        }
      }
    } else if (!DigestPattern.test(item)) {
      throw new Error(`invalid R7 real-account basis ${key}`)
    }
  }
  if (!same(value.approvalBasis, expectedBasis)) {
    throw new Error('R7 real-account approval basis mismatch')
  }
  if (
    realAccountGate?.authorizationState !== 'authorized' ||
    r7RendererReport.status !== 'RENDERER_OPT_IN_INTEGRATION_AUTHORIZED' ||
    r7RendererReport.semanticDigest !== FixedRendererSemanticDigest ||
    r7RendererReport.authorizationState !== 'authorized' ||
    r7RendererReport.rendererEligibleRouteCount !== 2 ||
    r7RendererReport.realAccountAcceptanceAuthorization !== 'R7_NOT_AUTHORIZED' ||
    r7RendererReport.runtimeEligibleCount !== 0 ||
    r7RendererReport.publicationAuthorization !== 'R7_NOT_AUTHORIZED'
  ) {
    throw new Error('R7 real-account prerequisites are invalid')
  }

  exactKeys(
    value.requestedAuthorization,
    [
      'gateId',
      'authorizationState',
      'executionAuthorization',
      'maximumAcceptedRoutes',
      'acceptanceMode'
    ],
    'R7 real-account requested authorization'
  )
  if (
    value.requestedAuthorization.gateId !== 'r7-real-account-readonly-acceptance' ||
    value.requestedAuthorization.authorizationState !== 'authorized' ||
    value.requestedAuthorization.executionAuthorization !==
      (approved
        ? value.executionResult.requestRevision === value.revision
          ? 'consumed'
          : 'authorized'
        : 'not-authorized') ||
    value.requestedAuthorization.maximumAcceptedRoutes !== 2 ||
    value.requestedAuthorization.acceptanceMode !== 'owner-login-readonly-redacted'
  ) {
    throw new Error('R7 real-account requested authorization mismatch')
  }

  if (!Array.isArray(value.routeBindings) || value.routeBindings.length !== 2) {
    throw new Error('R7 real-account route binding count mismatch')
  }
  for (const [index, binding] of value.routeBindings.entries()) {
    exactKeys(
      binding,
      ['routeId', 'routeFamily', 'routeRevision', 'routeSemanticDigest', 'focus'],
      `R7 real-account route binding ${index}`
    )
    const rendererBinding = r7RendererReport.routeBindings[index]
    const expected = {
      routeId: rendererBinding.routeId,
      routeFamily: rendererBinding.routeFamily,
      routeRevision: rendererBinding.routeRevision,
      routeSemanticDigest: rendererBinding.routeSemanticDigest,
      focus: FocusByFamily[rendererBinding.routeFamily]
    }
    if (!same(binding, expected)) throw new Error(`R7 real-account route binding mismatch ${index}`)
  }

  if (
    !same(value.ownerOnlyActions, ExpectedOwnerActions) ||
    !same(value.agentReadOnlyActions, ExpectedAgentActions) ||
    !same(value.preflightRequirements, ExpectedPreflight) ||
    !same(value.requiredChecks, ExpectedChecks)
  ) {
    throw new Error('R7 real-account acceptance procedure mismatch')
  }
  exactKeys(
    value.evidenceContract,
    [
      'allowedOutput',
      'forbiddenOutput',
      'screenshotCaptureAllowed',
      'rawLogRetentionAllowed',
      'accountDataExportAllowed'
    ],
    'R7 real-account evidence contract'
  )
  if (
    !same(value.evidenceContract.allowedOutput, ExpectedAllowedOutput) ||
    !same(value.evidenceContract.forbiddenOutput, ExpectedForbiddenOutput) ||
    value.evidenceContract.screenshotCaptureAllowed !== false ||
    value.evidenceContract.rawLogRetentionAllowed !== false ||
    value.evidenceContract.accountDataExportAllowed !== false
  ) {
    throw new Error('R7 real-account evidence contract mismatch')
  }
  exactKeys(
    value.restoreContract,
    [
      'restoreQuestFilter',
      'restoreWorkspacePage',
      'restorePanelVisibility',
      'restoreWindowBounds',
      'restoreRouteSectionClosed',
      'gameStateMutationToRestoreAllowed'
    ],
    'R7 real-account restore contract'
  )
  if (
    value.restoreContract.restoreQuestFilter !== true ||
    value.restoreContract.restoreWorkspacePage !== true ||
    value.restoreContract.restorePanelVisibility !== true ||
    value.restoreContract.restoreWindowBounds !== true ||
    value.restoreContract.restoreRouteSectionClosed !== true ||
    value.restoreContract.gameStateMutationToRestoreAllowed !== false
  ) {
    throw new Error('R7 real-account restore contract mismatch')
  }
  if (!same(value.abortConditions, ExpectedAbortConditions)) {
    throw new Error('R7 real-account abort policy mismatch')
  }
  exactKeys(value.priorAttempt, Object.keys(ExpectedPriorAttempt), 'R7 prior acceptance attempt')
  timestamp(value.priorAttempt.recordedAt, 'R7 prior acceptance attempt recordedAt')
  if (!same(value.priorAttempt, ExpectedPriorAttempt)) {
    throw new Error('R7 prior acceptance attempt mismatch')
  }
  exactKeys(
    value.harnessAmendment,
    Object.keys(ExpectedHarnessAmendment),
    'R7 acceptance harness amendment'
  )
  if (!same(value.harnessAmendment, ExpectedHarnessAmendment)) {
    throw new Error('R7 acceptance harness amendment mismatch')
  }
  exactKeys(
    value.retryAuthorization,
    Object.keys(ExpectedRetryAuthorization),
    'R7 acceptance retry authorization'
  )
  if (!same(value.retryAuthorization, ExpectedRetryAuthorization)) {
    throw new Error('R7 acceptance retry authorization mismatch')
  }
  exactKeys(
    value.proposedHarnessAmendment,
    Object.keys(ExpectedProposedHarnessAmendment),
    'R7 proposed acceptance harness amendment'
  )
  if (!same(value.proposedHarnessAmendment, ExpectedProposedHarnessAmendment)) {
    throw new Error('R7 proposed acceptance harness amendment mismatch')
  }
  exactKeys(
    value.harnessAmendmentImplementation,
    Object.keys(ExpectedHarnessAmendmentImplementation),
    'R7 acceptance harness amendment implementation'
  )
  if (!same(value.harnessAmendmentImplementation, ExpectedHarnessAmendmentImplementation)) {
    throw new Error('R7 acceptance harness amendment implementation mismatch')
  }
  exactKeys(value.retryRequest, Object.keys(ExpectedRetryRequest), 'R7 acceptance retry request')
  if (!same(value.retryRequest, ExpectedRetryRequest)) {
    throw new Error('R7 acceptance retry request mismatch')
  }
  exactKeys(
    value.previousExecutionResult,
    Object.keys(ExpectedPreviousExecutionResult),
    'R7 previous acceptance execution result'
  )
  timestamp(
    value.previousExecutionResult.recordedAt,
    'R7 previous acceptance execution result recordedAt'
  )
  if (!same(value.previousExecutionResult, ExpectedPreviousExecutionResult)) {
    throw new Error('R7 previous acceptance execution result mismatch')
  }
  exactKeys(
    value.executionResult,
    Object.keys(ExpectedExecutionResult),
    'R7 acceptance execution result'
  )
  timestamp(value.executionResult.recordedAt, 'R7 acceptance execution result recordedAt')
  if (!same(value.executionResult, ExpectedExecutionResult)) {
    throw new Error('R7 acceptance execution result mismatch')
  }
  exactKeys(
    value.responsiveLayoutFixImplementation,
    Object.keys(ExpectedResponsiveLayoutFixImplementation),
    'R7 responsive layout fix implementation'
  )
  if (!same(value.responsiveLayoutFixImplementation, ExpectedResponsiveLayoutFixImplementation)) {
    throw new Error('R7 responsive layout fix implementation mismatch')
  }
  exactKeys(
    value.postFixRetryRequest,
    Object.keys(ExpectedPostFixRetryRequest),
    'R7 post-fix retry request'
  )
  if (!same(value.postFixRetryRequest, ExpectedPostFixRetryRequest)) {
    throw new Error('R7 post-fix retry request mismatch')
  }
  exactKeys(
    value.executionBoundary,
    [
      'productionCodeChangesAuthorized',
      'routeContentChangesAuthorized',
      'mainOrPreloadChangesAuthorized',
      'gameCommunicationChangesAuthorized',
      'automaticGameOperationAuthorized',
      'runtimePublicationAuthorized',
      'defaultEnablementAuthorized',
      'otherRouteFamiliesAuthorized'
    ],
    'R7 real-account execution boundary'
  )
  if (Object.values(value.executionBoundary).some((item) => item !== false)) {
    throw new Error('R7 real-account execution boundary must remain read-only')
  }
  if (!same(value.stillProhibited, ExpectedProhibited)) {
    throw new Error('R7 real-account prohibited behavior mismatch')
  }
  exactKeys(value.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'R7 real-account review')
  identifier(value.review.author, 'R7 real-account packet author')
  const semanticDigest = realAccountRequestSemanticDigest(value)
  if (approved) {
    const approver = identifier(value.review.approver, 'R7 real-account approver')
    const reviewedAt = timestamp(value.review.reviewedAt, 'R7 real-account reviewedAt')
    if (
      approver !== 'project-owner' ||
      approver === value.review.author ||
      Date.parse(reviewedAt) < Date.parse(value.sourceSnapshot.checkedAt) ||
      value.review.approvalDigest !== semanticDigest ||
      semanticDigest !== ApprovedRealAccountSemanticDigest
    ) {
      throw new Error('approved R7 real-account semantic digest mismatch')
    }
  } else if (
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 real-account packet must not claim approval')
  }
  return { value, semanticDigest, approved }
}

function buildR7RealAccountDecisionArtifacts({ root, base, r7AuthorizationReport, r7RendererReport }) {
  const requestPath = path.join(base, 'decisions', 'r7-real-account-acceptance-request.json')
  const requestRaw = fs.readFileSync(requestPath)
  const request = validateR7RealAccountAcceptanceRequest(JSON.parse(requestRaw), {
    root,
    base,
    r7AuthorizationReport,
    r7RendererReport
  })
  const executionConsumed =
    request.approved && request.value.executionResult.requestRevision === request.value.revision
  const acceptancePassed = executionConsumed && request.value.executionResult.status === 'pass'
  const acceptanceFailClosed = executionConsumed && !acceptancePassed
  const report = {
    schemaVersion: 1,
    compilerVersion: R7RealAccountDecisionCompilerVersion,
    generatedAt: executionConsumed
      ? request.value.executionResult.recordedAt
      : request.approved
      ? request.value.review.reviewedAt
      : request.value.sourceSnapshot.checkedAt,
    status: executionConsumed
      ? acceptancePassed
        ? 'REAL_ACCOUNT_READONLY_ACCEPTANCE_PASSED'
        : 'REAL_ACCOUNT_READONLY_ACCEPTANCE_FAIL_CLOSED'
      : request.approved
      ? 'REAL_ACCOUNT_READONLY_ACCEPTANCE_AUTHORIZED'
      : 'OWNER_DECISION_REQUIRED_REAL_ACCOUNT_ACCEPTANCE_RETRY',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    gateId: request.value.requestedAuthorization.gateId,
    gateSemanticDigest: request.value.approvalBasis.realAccountGateSemanticDigest,
    authorizationState: 'authorized',
    executionAuthorization: executionConsumed
      ? 'consumed'
      : request.approved
      ? 'authorized'
      : 'not-authorized',
    acceptanceMode: request.value.requestedAuthorization.acceptanceMode,
    maximumAcceptedRoutes: request.value.requestedAuthorization.maximumAcceptedRoutes,
    routeBindings: request.value.routeBindings,
    ownerOnlyActionCount: request.value.ownerOnlyActions.length,
    agentReadOnlyActionCount: request.value.agentReadOnlyActions.length,
    preflightRequirementCount: request.value.preflightRequirements.length,
    requiredCheckCount: request.value.requiredChecks.length,
    screenshotCaptureAllowed: false,
    rawLogRetentionAllowed: false,
    accountDataExportAllowed: false,
    protectedCommunicationDigests: request.value.approvalBasis.protectedCommunicationDigests,
    actualAcceptanceStatus: request.value.executionResult.status,
    acceptanceStage: request.value.executionResult.stage,
    acceptanceReasonCode: request.value.executionResult.reasonCode,
    accountDataReady: request.value.executionResult.accountDataReady,
    routeInspectionStarted: request.value.executionResult.routeInspectionStarted,
    checkedRouteCount: request.value.executionResult.checkedRouteCount,
    layoutDiagnostic: request.value.executionResult.layoutDiagnostic,
    currentSizeNoHorizontalOverflow:
      request.value.executionResult.currentSizeNoHorizontalOverflow ?? false,
    controlledSizeNoHorizontalOverflow:
      request.value.executionResult.controlledSizeNoHorizontalOverflow ?? false,
    routeContentMatches: request.value.executionResult.routeContentMatches ?? false,
    manualConfirmationVisible: request.value.executionResult.manualConfirmationVisible ?? false,
    unsetFallbackChecked: request.value.executionResult.unsetFallbackChecked ?? false,
    sessionOnlyState: request.value.executionResult.sessionOnlyState ?? false,
    pageFilterPanelWindowStateRestored:
      request.value.executionResult.pageFilterPanelWindowStateRestored,
    applicationProcessClosed: request.value.executionResult.applicationProcessClosed,
    priorAttemptReasonCode: request.value.priorAttempt.reasonCode,
    previousAcceptanceReasonCode: request.value.previousExecutionResult.reasonCode,
    harnessAmendmentReasonCode: request.value.harnessAmendment.reasonCode,
    harnessAmendmentChangeCount: request.value.harnessAmendment.changes.length,
    retryAuthorizationReasonCode: request.value.retryAuthorization.reasonCode,
    maximumRetryExecutions: request.value.retryAuthorization.maximumExecutions,
    harnessChangesAuthorized: request.value.retryAuthorization.harnessChangesAuthorized,
    proposedHarnessAmendmentReasonCode:
      request.value.proposedHarnessAmendment.reasonCode,
    proposedHarnessAmendmentChangeCount:
      request.value.proposedHarnessAmendment.changes.length,
    proposedHarnessAmendmentAuthorizedPathCount:
      request.value.proposedHarnessAmendment.authorizedPaths.length,
    anonymousCustomLayoutFixtureRequired:
      request.value.proposedHarnessAmendment.anonymousCustomLayoutFixtureRequired,
    realAccountExecutionAuthorized:
      request.value.proposedHarnessAmendment.realAccountExecutionAuthorized,
    harnessAmendmentImplementationCommit:
      request.value.harnessAmendmentImplementation.implementationCommit,
    harnessAmendmentImplementationPassed:
      request.value.harnessAmendmentImplementation.anonymousSignedCustomLayoutFixturePassed,
    harnessAmendmentTargetedTestCount:
      request.value.harnessAmendmentImplementation.targetedTestCount,
    harnessAmendmentRealAccountExecutionPerformed:
      request.value.harnessAmendmentImplementation.realAccountExecutionPerformed,
    retryRequestReasonCode: request.value.retryRequest.reasonCode,
    retryRequestMaximumExecutions: request.value.retryRequest.maximumExecutions,
    retryRequestFixedHarnessDigest: request.value.retryRequest.fixedHarnessDigest,
    retryRequestGenericWideWorkspaceRegressionExcluded:
      request.value.retryRequest.genericWideWorkspaceRegressionExcluded,
    retryRequestCurrentAndControlledSizeRequired:
      request.value.retryRequest.currentAndControlledSizeRequired,
    retryRequestExecutionAuthorized: request.approved && !executionConsumed,
    responsiveLayoutFixImplementationCommit:
      request.value.responsiveLayoutFixImplementation.implementationCommit,
    responsiveLayoutFixAnonymousFixturePassed:
      request.value.responsiveLayoutFixImplementation.anonymousSignedFixturePassed,
    responsiveLayoutFixPanelClientWidth:
      request.value.responsiveLayoutFixImplementation.panelClientWidth,
    responsiveLayoutFixMaximumPanelScrollWidth:
      request.value.responsiveLayoutFixImplementation.maximumPanelScrollWidth,
    postFixRetryReasonCode: request.value.postFixRetryRequest.reasonCode,
    postFixRetryMaximumExecutions: request.value.postFixRetryRequest.maximumExecutions,
    postFixRetryFixedGrowthComponentDigest:
      request.value.postFixRetryRequest.fixedGrowthComponentDigest,
    postFixRetryFixedHarnessDigest: request.value.postFixRetryRequest.fixedHarnessDigest,
    postFixRetryPanelClientWidthRegression:
      request.value.postFixRetryRequest.panelClientWidthRegression,
    anonymousHiddenLayoutFixtureRequired:
      request.value.harnessAmendment.anonymousHiddenLayoutFixtureRequired,
    anonymousTallLayoutFixtureRequired:
      request.value.harnessAmendment.anonymousTallLayoutFixtureRequired,
    stillProhibited: request.value.stillProhibited,
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED',
    defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED'
  }
  return {
    artifacts: { 'r7-real-account-acceptance-report.json': report },
    source: { r7RealAccountAcceptanceRequestDigest: digest(requestRaw) },
    output: {
      r7RealAccountAcceptanceRouteCount: report.routeBindings.length,
      r7RealAccountAcceptanceRequiredCheckCount: report.requiredCheckCount,
      r7RealAccountAcceptanceOwnerDecisionRequired: !request.approved,
      r7RealAccountAcceptanceFailClosed: acceptanceFailClosed,
      r7RealAccountAcceptancePassed: acceptancePassed,
      r7RealAccountAcceptanceAuthorizedRouteCount: request.approved && !executionConsumed
        ? report.routeBindings.length
        : 0
    }
  }
}

module.exports = {
  R7RealAccountDecisionOutputFilenames,
  buildR7RealAccountDecisionArtifacts,
  realAccountRequestSemanticDigest,
  validateR7RealAccountAcceptanceRequest
}

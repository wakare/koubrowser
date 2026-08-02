const { execFile, spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const http = require('node:http')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { isDeepStrictEqual, promisify } = require('node:util')
const { publicKeySha256, verifyBundleDirectory } = require('./create-data-update-bundle')

const execFileAsync = promisify(execFile)
const DefaultPort = 9254
const DefaultTimeoutMs = 60_000
const DefaultTotalTimeoutMs = 600_000
const CdpCommandTimeoutMs = 10_000
const ScreenshotCommandTimeoutMs = 30_000
const GracefulExitTimeoutMs = 15_000
const GameStartSettleMs = 12_000
const GameStartPoint = Object.freeze({ x: 910, y: 600 })
const MinimumWorkspaceWidth = 1316
const MinimumWorkspaceHeight = 632
const SurfaceWorkspaceWidth = 1440
const SurfaceWorkspaceHeight = 928
const NarrowWorkspaceWidth = 1600
const NarrowWorkspaceHeight = 800
const IntermediateWorkspaceWidth = 1756
const IntermediateWorkspaceHeight = 900
const TallWorkspaceWidth = 1920
const TallWorkspaceHeight = 1200
const WideWorkspaceMinWidth = 2480
const WideWorkspaceMinHeight = 1150
const WorkspaceGameWidth = 1200
const WorkspaceGameHeight = 720
const WorkspacePanelMinWidth = 280
const WorkspaceGap = 12
const WorkspaceTitleBarHeight = 32
const DisplayAcceptanceProfiles = Object.freeze(['issue-23', 'issue-34'])
const LiveAcceptanceProfiles = Object.freeze(['issue-30'])
const WorkspaceResizeSweepSizes = Object.freeze([
  Object.freeze({ width: 1316, height: 632 }),
  Object.freeze({ width: 1380, height: 700 }),
  Object.freeze({ width: 1440, height: 928 }),
  Object.freeze({ width: 1516, height: 752 }),
  Object.freeze({ width: 1600, height: 800 }),
  Object.freeze({ width: 1700, height: 850 }),
  Object.freeze({ width: 1756, height: 900 }),
  Object.freeze({ width: 1680, height: 820 }),
  Object.freeze({ width: 1516, height: 752 }),
  Object.freeze({ width: 1380, height: 700 }),
  Object.freeze({ width: 1316, height: 632 })
])
const GameOnlyResizeSweepSteps = Object.freeze([
  Object.freeze({
    requestedWidth: 900,
    requestedHeight: 600,
    width: 900,
    height: 540,
    factor: 0.75
  }),
  Object.freeze({
    requestedWidth: 1000,
    requestedHeight: 760,
    width: 1000,
    height: 600,
    factor: 1000 / WorkspaceGameWidth
  }),
  Object.freeze({
    requestedWidth: 1200,
    requestedHeight: 680,
    width: 1200,
    height: 720,
    factor: 1
  }),
  Object.freeze({
    requestedWidth: 1050,
    requestedHeight: 800,
    width: 1050,
    height: 630,
    factor: 1050 / WorkspaceGameWidth
  }),
  Object.freeze({
    requestedWidth: 900,
    requestedHeight: 650,
    width: 900,
    height: 540,
    factor: 0.75
  })
])
const LayoutFixtureCapacityExpectation = Object.freeze({
  shipText: '7/12',
  shipTitle: '保有艦娘: 7/12（空き5） — 空き枠が少なくなっています',
  slotitemText: '18/23',
  slotitemTitle: '保有装備: 18/23（空き5） — 期間限定海域の目安は空き20以上です'
})
const LayoutFixtureCapacityBoundaryExpectations = Object.freeze({
  full: Object.freeze({
    mode: 'full',
    shipCount: 12,
    shipCapacity: 12,
    slotitemCount: 23,
    slotitemCapacity: 23,
    shipText: '12/12',
    shipTitle: '保有艦娘: 12/12（空き0） — 空き枠が少なくなっています',
    slotitemText: '23/23',
    slotitemTitle: '保有装備: 23/23（空き0） — 期間限定海域の目安は空き20以上です'
  }),
  overflow: Object.freeze({
    mode: 'overflow',
    shipCount: 13,
    shipCapacity: 12,
    slotitemCount: 24,
    slotitemCapacity: 23,
    shipText: '13/12',
    shipTitle: '保有艦娘: 13/12（上限超過1） — 空き枠が少なくなっています',
    slotitemText: '24/23',
    slotitemTitle: '保有装備: 24/23（上限超過1） — 期間限定海域の目安は空き20以上です'
  })
})
const CaptureFilenamePattern = /^\d{8}-\d{6}(?:-\d+)?\.png$/
const RecordingFilenamePattern = /^\d{8}-\d{6}\.webm$/
const PngSignature = '89504e470d0a1a0a'
const WebmSignature = '1a45dfa3'
const DataUpdateFixtureQuestId = 9_000_001
const DataUpdateFixtureQuestTitle = '署名更新スモーク任務'
const DataUpdateFixtureVersion = 'smoke.quest.1'
const DataUpdateFixtureStrategyVersion = 'smoke.strategy.1'
const DataUpdateFixtureStrategyRecipeId = 'signed-smoke-route'
const DataUpdateFixtureMapAreaId = 1
const DataUpdateFixtureMapNo = 1
const DataUpdateFixtureMapPath = 'map/001_01_map.json'
const DataUpdateFixtureMapSpot = Object.freeze({
  no: 987,
  label: '署名更新スモーク地点',
  x: 321,
  y: 654,
  type: 'boss'
})
const AccountRestoreFixtureBundleId = '11111111-1111-4111-8111-111111111111'
const AccountRestoreFailureFixtureBundleId = '33333333-3333-4333-8333-333333333333'
const AccountRestoreFixtureSourceDeviceId = '22222222-2222-4222-8222-222222222222'
const AccountMergeFixtureBundleId = '55555555-5555-4555-8555-555555555555'
const AccountMergeFixtureSourceDeviceId = '66666666-6666-4666-8666-666666666666'
const AccountRestoreRetentionFixtureBundleIds = Object.freeze([
  '44444444-4444-4444-8444-444444444441',
  '44444444-4444-4444-8444-444444444442',
  '44444444-4444-4444-8444-444444444443'
])
const BundleIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MaxAccountRestoreFixtureRecordsPerDatabase = 100_000
const AccountRestoreFixtureAccount = Object.freeze({
  serverId: 3,
  memberId: '12345678'
})
const AccountRestoreFixtureDatabases = Object.freeze([
  'port',
  'drop',
  'battle',
  'item',
  'ship',
  'remodel',
  'mission',
  'quest',
  'clearitemget'
])
const AccountBusinessFixtureDatabases = Object.freeze([
  'port',
  'battle',
  'drop',
  'mission',
  'quest',
  'clearitemget'
])

function usage() {
  return [
    'Usage: node scripts/electron-smoke.js [options]',
    '',
    'Options:',
    '  --allow-game-start  Allow one normal click on the verified GAME START surface.',
    '  --manual-game-start Wait for the user to click GAME START in the app window.',
    '  --layout-fixture    Use local synthetic readiness data without clicking GAME START.',
    '  --pseudo-locale     Use the internal en-XA locale with --layout-fixture.',
    '  --data-update-fixture Load a temporary signed quest-knowledge bundle.',
    '  --data-update-staging-manifest <https-url>',
    '                      Download and activate an externally staged signed bundle.',
    '  --data-update-public-key-file <path>',
    '                      Ed25519 DER SPKI Base64 public key for the staged bundle.',
    '  --account-restore-fixture Exercise restore and rollback in isolated user data.',
    '  --account-restore-records <number> Records per synthetic DB (default: 1).',
    '  --summary           Print a concise geometry report instead of full snapshots.',
    '  --workspace-pages   Inspect every available secondary workspace page.',
    '  --task-guide        Inspect the workspace task guide after game data is ready.',
    '  --wide-workspace    Temporarily inspect the complete available wide work area.',
    '  --require-display-profile <issue-23|issue-34>',
    '                      Require the exact physical display topology reported by that issue.',
    '  --require-live-profile <issue-30>',
    '                      Require issue-specific evidence from a manually loaded real account.',
    '  --screenshot-dir <path> Save viewport screenshots below this directory.',
    `  --port <number>     Layout-fixture DevTools port (default: ${DefaultPort}).`,
    `  --timeout <ms>      Per-stage readiness timeout (default: ${DefaultTimeoutMs}).`,
    `  --total-timeout <ms> Whole-run timeout (default: ${DefaultTotalTimeoutMs}).`,
    '  --help              Show this help.',
    '',
    'Without --allow-game-start, --manual-game-start, or --layout-fixture the script only checks the pre-game application shell.'
  ].join('\n')
}

function parseArgs(argv) {
  const options = {
    allowGameStart: false,
    manualGameStart: false,
    layoutFixture: false,
    pseudoLocale: false,
    dataUpdateFixture: false,
    dataUpdateStagingManifestUrl: undefined,
    dataUpdatePublicKeyFile: undefined,
    accountRestoreFixture: false,
    accountRestoreRecords: 1,
    summary: false,
    workspacePages: false,
    taskGuide: false,
    wideWorkspace: false,
    requireDisplayProfile: undefined,
    requireLiveProfile: undefined,
    screenshotDir: undefined,
    port: DefaultPort,
    timeoutMs: DefaultTimeoutMs,
    totalTimeoutMs: DefaultTotalTimeoutMs,
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--allow-game-start') {
      options.allowGameStart = true
    } else if (argument === '--manual-game-start') {
      options.manualGameStart = true
    } else if (argument === '--layout-fixture') {
      options.layoutFixture = true
    } else if (argument === '--pseudo-locale') {
      options.pseudoLocale = true
    } else if (argument === '--data-update-fixture') {
      options.dataUpdateFixture = true
    } else if (argument === '--account-restore-fixture') {
      options.accountRestoreFixture = true
    } else if (argument === '--summary') {
      options.summary = true
    } else if (argument === '--workspace-pages') {
      options.workspacePages = true
    } else if (argument === '--task-guide') {
      options.taskGuide = true
    } else if (argument === '--wide-workspace') {
      options.wideWorkspace = true
    } else if (argument === '--help') {
      options.help = true
    } else if (
      argument === '--port' ||
      argument === '--timeout' ||
      argument === '--total-timeout' ||
      argument === '--account-restore-records' ||
      argument === '--require-display-profile' ||
      argument === '--require-live-profile' ||
      argument === '--data-update-staging-manifest' ||
      argument === '--data-update-public-key-file' ||
      argument === '--screenshot-dir'
    ) {
      const value = argv[index + 1]
      if (value === undefined) {
        throw new Error(`${argument} requires a value`)
      }
      index += 1
      if (argument === '--port') {
        options.port = Number(value)
      } else if (argument === '--timeout') {
        options.timeoutMs = Number(value)
      } else if (argument === '--total-timeout') {
        options.totalTimeoutMs = Number(value)
      } else if (argument === '--account-restore-records') {
        options.accountRestoreRecords = Number(value)
      } else if (argument === '--require-display-profile') {
        options.requireDisplayProfile = value
      } else if (argument === '--require-live-profile') {
        options.requireLiveProfile = value
      } else if (argument === '--data-update-staging-manifest') {
        options.dataUpdateStagingManifestUrl = value
      } else if (argument === '--data-update-public-key-file') {
        options.dataUpdatePublicKeyFile = value
      } else {
        options.screenshotDir = value
      }
    } else {
      throw new Error(`Unknown option: ${argument}`)
    }
  }

  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65_535) {
    throw new Error(`Invalid DevTools port: ${options.port}`)
  }
  if (
    !Number.isInteger(options.timeoutMs) ||
    options.timeoutMs < 1_000 ||
    options.timeoutMs > 300_000
  ) {
    throw new Error(`Invalid timeout: ${options.timeoutMs}`)
  }
  if (
    !Number.isInteger(options.totalTimeoutMs) ||
    options.totalTimeoutMs < 1_000 ||
    options.totalTimeoutMs > 1_800_000
  ) {
    throw new Error(`Invalid total timeout: ${options.totalTimeoutMs}`)
  }
  if (options.totalTimeoutMs < options.timeoutMs) {
    throw new Error('Total timeout must be greater than or equal to the per-stage timeout')
  }
  if (options.screenshotDir !== undefined && options.screenshotDir.trim().length === 0) {
    throw new Error('Screenshot directory must not be empty')
  }
  if (
    options.requireDisplayProfile !== undefined &&
    !DisplayAcceptanceProfiles.includes(options.requireDisplayProfile)
  ) {
    throw new Error(`Invalid display acceptance profile: ${options.requireDisplayProfile}`)
  }
  if (
    options.requireLiveProfile !== undefined &&
    !LiveAcceptanceProfiles.includes(options.requireLiveProfile)
  ) {
    throw new Error(`Invalid live acceptance profile: ${options.requireLiveProfile}`)
  }
  if (options.dataUpdateFixture && !options.layoutFixture) {
    throw new Error('--data-update-fixture requires --layout-fixture')
  }
  const dataUpdateStagingArguments = [
    options.dataUpdateStagingManifestUrl,
    options.dataUpdatePublicKeyFile
  ].filter((value) => value !== undefined).length
  if (dataUpdateStagingArguments === 1) {
    throw new Error(
      '--data-update-staging-manifest and --data-update-public-key-file are both required'
    )
  }
  const dataUpdateStaging = dataUpdateStagingArguments === 2
  if (dataUpdateStaging) {
    let manifestUrl
    try {
      manifestUrl = new URL(options.dataUpdateStagingManifestUrl)
    } catch {
      throw new Error('Invalid data-update staging manifest URL')
    }
    if (
      manifestUrl.protocol !== 'https:' ||
      manifestUrl.username !== '' ||
      manifestUrl.password !== '' ||
      manifestUrl.hash !== ''
    ) {
      throw new Error(
        'Data-update staging manifest must be an HTTPS URL without credentials or a fragment'
      )
    }
    if (!options.dataUpdatePublicKeyFile.trim()) {
      throw new Error('Data-update public key file must not be empty')
    }
    if (!options.layoutFixture || !options.taskGuide) {
      throw new Error('Data-update staging acceptance requires --layout-fixture and --task-guide')
    }
  }
  if (options.accountRestoreFixture && !options.layoutFixture) {
    throw new Error('--account-restore-fixture requires --layout-fixture')
  }
  if (
    !Number.isSafeInteger(options.accountRestoreRecords) ||
    options.accountRestoreRecords < 1 ||
    options.accountRestoreRecords > MaxAccountRestoreFixtureRecordsPerDatabase
  ) {
    throw new Error(`Invalid account restore record count: ${options.accountRestoreRecords}`)
  }
  if (options.accountRestoreRecords !== 1 && !options.accountRestoreFixture) {
    throw new Error('--account-restore-records requires --account-restore-fixture')
  }
  if (options.accountRestoreFixture && (options.dataUpdateFixture || dataUpdateStaging)) {
    throw new Error('--account-restore-fixture and data-update acceptance are mutually exclusive')
  }
  if (options.dataUpdateFixture && dataUpdateStaging) {
    throw new Error(
      '--data-update-fixture and data-update staging acceptance are mutually exclusive'
    )
  }
  if (options.pseudoLocale && !options.layoutFixture) {
    throw new Error('--pseudo-locale requires --layout-fixture')
  }
  if (options.dataUpdateFixture && !options.taskGuide) {
    throw new Error('--data-update-fixture requires --task-guide')
  }
  if (
    options.taskGuide &&
    !options.allowGameStart &&
    !options.manualGameStart &&
    !options.layoutFixture
  ) {
    throw new Error(
      '--task-guide requires --allow-game-start, --manual-game-start, or --layout-fixture'
    )
  }
  const gameDataSources = [
    options.allowGameStart,
    options.manualGameStart,
    options.layoutFixture
  ].filter(Boolean).length
  if (gameDataSources > 1) {
    throw new Error(
      '--allow-game-start, --manual-game-start, and --layout-fixture are mutually exclusive'
    )
  }
  if (
    options.workspacePages &&
    !options.allowGameStart &&
    !options.manualGameStart &&
    !options.layoutFixture
  ) {
    throw new Error(
      '--workspace-pages requires --allow-game-start, --manual-game-start, or --layout-fixture'
    )
  }
  if (
    options.wideWorkspace &&
    !options.allowGameStart &&
    !options.manualGameStart &&
    !options.layoutFixture
  ) {
    throw new Error(
      '--wide-workspace requires --allow-game-start, --manual-game-start, or --layout-fixture'
    )
  }
  if (
    options.requireDisplayProfile !== undefined &&
    (!options.layoutFixture || !options.workspacePages || !options.wideWorkspace)
  ) {
    throw new Error(
      '--require-display-profile requires --layout-fixture, --workspace-pages, and --wide-workspace'
    )
  }
  if (
    options.requireLiveProfile !== undefined &&
    (!options.manualGameStart ||
      options.layoutFixture ||
      options.allowGameStart ||
      !options.workspacePages)
  ) {
    throw new Error(
      '--require-live-profile requires --manual-game-start and --workspace-pages with no synthetic or automatic GAME START source'
    )
  }

  return options
}

function settingsPathForPlatform(
  platform = process.platform,
  environment = process.env,
  homeDirectory = os.homedir()
) {
  if (platform === 'win32') {
    if (!environment.APPDATA) {
      throw new Error('APPDATA is not available')
    }
    return path.join(environment.APPDATA, 'koubrowser', 'koubrowser.json')
  }
  if (platform === 'darwin') {
    return path.join(
      homeDirectory,
      'Library',
      'Application Support',
      'koubrowser',
      'koubrowser.json'
    )
  }
  return path.join(homeDirectory, '.config', 'koubrowser', 'koubrowser.json')
}

function metricsAreContained(metrics, tolerance = 1) {
  return (
    metrics.scrollWidth <= metrics.clientWidth + tolerance &&
    metrics.scrollHeight <= metrics.clientHeight + tolerance
  )
}

function physicalDisplaySize(display) {
  const scaleFactor = Number(display?.scaleFactor)
  const width = Number(display?.bounds?.width)
  const height = Number(display?.bounds?.height)
  if (
    !Number.isFinite(scaleFactor) ||
    scaleFactor <= 0 ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    return undefined
  }
  return {
    width: Math.round(width * scaleFactor),
    height: Math.round(height * scaleFactor)
  }
}

function physicalDisplaySizeMatches(display, width, height, tolerance = 4) {
  const size = physicalDisplaySize(display)
  return (
    size !== undefined &&
    Math.abs(size.width - width) <= tolerance &&
    Math.abs(size.height - height) <= tolerance
  )
}

function displaySupportsWorkspace(display) {
  return (
    Number(display?.workArea?.width) >= MinimumWorkspaceWidth &&
    Number(display?.workArea?.height) >= MinimumWorkspaceHeight
  )
}

function inspectDisplayAcceptanceProfile(profile, topology) {
  if (!DisplayAcceptanceProfiles.includes(profile)) {
    throw new Error(`Unknown display acceptance profile: ${profile}`)
  }
  const displays = Array.isArray(topology?.displays) ? topology.displays : []
  if (profile === 'issue-23') {
    const surface = displays.find(
      (display) =>
        physicalDisplaySizeMatches(display, 2880, 1920) &&
        Math.abs(Number(display.scaleFactor) - 2) <= 0.01 &&
        display.touchSupport === 'available' &&
        displaySupportsWorkspace(display)
    )
    if (!surface) {
      return {
        failure:
          'Issue #23 requires a touch-enabled 2880x1920 display at 200% scaling ' +
          'with a workspace-capable logical work area',
        profile,
        displays
      }
    }
    return {
      profile,
      displayIds: [surface.id],
      displays: [surface]
    }
  }

  const primary = displays.find(
    (display) =>
      display.id === topology?.primaryDisplayId &&
      display.primary === true &&
      physicalDisplaySizeMatches(display, 1920, 1080) &&
      displaySupportsWorkspace(display)
  )
  const secondary = displays.find(
    (display) =>
      display.id !== primary?.id &&
      physicalDisplaySizeMatches(display, 1920, 1200) &&
      displaySupportsWorkspace(display)
  )
  if (!primary || !secondary) {
    return {
      failure:
        'Issue #34 requires a 1920x1080 primary display and a separate ' +
        '1920x1200 workspace-capable display',
      profile,
      displays
    }
  }
  return {
    profile,
    displayIds: [primary.id, secondary.id],
    displays: [primary, secondary]
  }
}

function pseudoLocaleFailure(result) {
  if (result?.localizationLocale !== 'en-XA') {
    return `Expected en-XA, received ${JSON.stringify(result?.localizationLocale)}`
  }
  const sample = result.localizationSample
  if (
    typeof sample !== 'string' ||
    !sample.startsWith('［') ||
    !sample.endsWith('］') ||
    [...sample.slice(1, -1)].length < [...'戦果'].length * 2
  ) {
    return `Pseudo-localized component sample is invalid: ${JSON.stringify(sample)}`
  }
  return null
}

function gameOnlyZoomStateMatches(value, expected, sizeTolerance = 1) {
  return (
    value?.surface === 'game-only' &&
    value.documentOverflow !== true &&
    Number.isFinite(value.factor) &&
    Math.abs(value.factor - expected.factor) <= 0.001 &&
    Number.isFinite(value.width) &&
    Math.abs(value.width - expected.width) <= sizeTolerance &&
    Number.isFinite(value.height) &&
    Math.abs(value.height - expected.height) <= sizeTolerance
  )
}

function muteReloadStateMatches(value, expectedMuted, previousTimeOrigin = undefined) {
  return (
    value?.ready === true &&
    value.muted === expectedMuted &&
    Number.isFinite(value.timeOrigin) &&
    (previousTimeOrigin === undefined || value.timeOrigin !== previousTimeOrigin)
  )
}

function rectIsContained(outer, inner, tolerance = 1) {
  return (
    inner.left >= outer.left - tolerance &&
    inner.top >= outer.top - tolerance &&
    inner.right <= outer.right + tolerance &&
    inner.bottom <= outer.bottom + tolerance
  )
}

function rectsOverlap(first, second, tolerance = 1) {
  return (
    first.left < second.right - tolerance &&
    first.right > second.left + tolerance &&
    first.top < second.bottom - tolerance &&
    first.bottom > second.top + tolerance
  )
}

function titlebarCapacityFailure(value, expected = LayoutFixtureCapacityExpectation) {
  if (
    !value?.titlebar ||
    !value.status ||
    !value.buttons ||
    !value.ship ||
    !value.ship.rect ||
    !value.slotitem ||
    !value.slotitem.rect
  ) {
    return `Titlebar capacity elements are missing: ${JSON.stringify(value)}`
  }
  if (
    value.ship.text !== expected.shipText ||
    value.ship.title !== expected.shipTitle ||
    value.ship.ariaLabel !== expected.shipTitle ||
    value.ship.danger !== true ||
    value.ship.textOverflow === true
  ) {
    return `Ship capacity display is invalid: ${JSON.stringify(value.ship)}`
  }
  if (
    value.slotitem.text !== expected.slotitemText ||
    value.slotitem.title !== expected.slotitemTitle ||
    value.slotitem.ariaLabel !== expected.slotitemTitle ||
    value.slotitem.danger !== true ||
    value.slotitem.warning !== false ||
    value.slotitem.textOverflow === true
  ) {
    return `Slotitem capacity display is invalid: ${JSON.stringify(value.slotitem)}`
  }
  if (
    !rectIsContained(value.titlebar, value.status) ||
    !rectIsContained(value.status, value.ship.rect) ||
    !rectIsContained(value.status, value.slotitem.rect) ||
    !rectIsContained(value.titlebar, value.buttons) ||
    rectsOverlap(value.status, value.buttons) ||
    rectsOverlap(value.ship.rect, value.slotitem.rect)
  ) {
    return `Titlebar capacity geometry is invalid: ${JSON.stringify(value)}`
  }
  return null
}

function capacityBoundaryFixtureFailure(value, expected) {
  if (
    !value?.parser ||
    value.parser.mode !== expected.mode ||
    value.parser.shipCount !== expected.shipCount ||
    value.parser.shipCapacity !== expected.shipCapacity ||
    value.parser.slotitemCount !== expected.slotitemCount ||
    value.parser.slotitemCapacity !== expected.slotitemCapacity
  ) {
    return `Capacity boundary parser state is invalid: ${JSON.stringify(value?.parser)}`
  }
  return titlebarCapacityFailure(value.renderer, expected)
}

function captureNoticeFailure(value) {
  if (
    !value?.button ||
    !value.document ||
    !value.notice ||
    !value.notice.rect ||
    !value.game ||
    !value.file ||
    value.customDirectory !== true ||
    value.defaultDirectoryUnused !== true
  ) {
    return `Screenshot completion evidence is incomplete: ${JSON.stringify(value)}`
  }
  if (
    typeof value.button.title !== 'string' ||
    value.button.title.length === 0 ||
    value.button.ariaLabel !== value.button.title
  ) {
    return `Screenshot button accessibility is invalid: ${JSON.stringify(value.button)}`
  }
  if (
    value.notice.success !== true ||
    value.notice.role !== 'status' ||
    value.notice.ariaLive !== 'polite' ||
    !rectIsContained(value.document, value.notice.rect)
  ) {
    return `Screenshot completion notice is invalid: ${JSON.stringify(value.notice)}`
  }
  if (
    typeof value.filename !== 'string' ||
    !CaptureFilenamePattern.test(value.filename) ||
    !value.notice.text.includes(value.filename)
  ) {
    return `Screenshot filename is not reflected by the notice: ${JSON.stringify({
      filename: value.filename,
      text: value.notice.text
    })}`
  }
  if (
    value.file.exists !== true ||
    value.file.filename !== value.filename ||
    !Number.isFinite(value.file.size) ||
    value.file.size <= 24 ||
    value.file.pngSignature !== PngSignature ||
    !Number.isInteger(value.file.width) ||
    value.file.width <= 0 ||
    !Number.isInteger(value.file.height) ||
    value.file.height <= 0
  ) {
    return `Saved screenshot PNG is invalid: ${JSON.stringify(value.file)}`
  }
  const gameAspectRatio = value.game.width / value.game.height
  const imageAspectRatio = value.file.width / value.file.height
  if (
    !Number.isFinite(gameAspectRatio) ||
    !Number.isFinite(imageAspectRatio) ||
    Math.abs(gameAspectRatio - imageAspectRatio) > 0.01 ||
    value.file.width + 1 < value.game.width ||
    value.file.height + 1 < value.game.height
  ) {
    return `Saved screenshot dimensions do not match the game stage: ${JSON.stringify({
      game: value.game,
      file: value.file
    })}`
  }
  return null
}

function recordingSaveFailure(value) {
  if (
    !value?.button ||
    !value.startedNotice ||
    !value.stoppedNotice ||
    !value.file ||
    !value.recordingSource ||
    value.customDirectory !== true ||
    value.defaultDirectoryUnused !== true
  ) {
    return `Recording save evidence is incomplete: ${JSON.stringify(value)}`
  }
  if (
    typeof value.button.startTitle !== 'string' ||
    value.button.startTitle.length === 0 ||
    value.button.startAriaLabel !== value.button.startTitle ||
    value.button.checkedWhileRecording !== true ||
    value.button.checkedAfterStop !== false
  ) {
    return `Recording button state is invalid: ${JSON.stringify(value.button)}`
  }
  for (const notice of [value.startedNotice, value.stoppedNotice]) {
    if (
      notice.success !== true ||
      notice.role !== 'status' ||
      notice.ariaLive !== 'polite' ||
      typeof notice.text !== 'string' ||
      notice.text.length === 0
    ) {
      return `Recording notice is invalid: ${JSON.stringify(notice)}`
    }
  }
  if (
    value.recordingSource.target !== 'game' ||
    value.recordingSource.mediaSource !== 'tab' ||
    !Number.isFinite(value.recordingSource.width) ||
    value.recordingSource.width <= 0 ||
    !Number.isFinite(value.recordingSource.height) ||
    value.recordingSource.height <= 0
  ) {
    return `Recording source is not game-only: ${JSON.stringify(value.recordingSource)}`
  }
  if (
    typeof value.filename !== 'string' ||
    !RecordingFilenamePattern.test(value.filename) ||
    value.file.filename !== value.filename ||
    value.file.exists !== true ||
    !Number.isFinite(value.file.size) ||
    value.file.size <= 100 ||
    value.file.webmSignature !== WebmSignature
  ) {
    return `Saved recording WebM is invalid: ${JSON.stringify(value.file)}`
  }
  return null
}

function transportFixtureFailure(value) {
  if (!value?.panel || !value.body || !value.header || !value.viewport || !value.seventhShip) {
    return `Transport fixture elements are missing: ${JSON.stringify(value)}`
  }
  if (value.label !== '輸送' || value.value !== '139/97' || value.title !== '輸送値') {
    return `Transport fixture value is invalid: ${JSON.stringify({
      label: value.label,
      value: value.value,
      title: value.title
    })}`
  }
  if (
    value.shipCount !== 7 ||
    !Array.isArray(value.shipIds) ||
    value.shipIds.join(',') !== '1,2,3,4,5,6,7'
  ) {
    return `Transport fixture fleet is invalid: ${JSON.stringify({
      shipCount: value.shipCount,
      shipIds: value.shipIds
    })}`
  }
  if (
    !rectIsContained(value.panel, value.body) ||
    !rectIsContained(value.panel, value.header) ||
    !rectIsContained(value.viewport, value.seventhShip)
  ) {
    return `Transport fixture geometry is invalid: ${JSON.stringify(value)}`
  }
  return null
}

function battleResultFixtureFailure(value, requireBypassEvidence = true) {
  if (!value?.renderer) {
    return `Battle-result fixture renderer state is missing: ${JSON.stringify(value)}`
  }
  if (
    value.mainShipId !== 1 ||
    value.mainHp !== 9 ||
    value.escortShipId !== 9 ||
    value.escortHp !== 8 ||
    value.battleType !== 14
  ) {
    return `Battle-result fixture parser state is invalid: ${JSON.stringify(value)}`
  }
  if (
    value.renderer.title !== '！大破艦があります！' ||
    value.renderer.warning !== true ||
    value.renderer.shipId !== 1 ||
    value.renderer.nowHp !== 9 ||
    value.renderer.maxHp !== 40 ||
    value.renderer.hpState !== 'taiha'
  ) {
    return `Battle-result fixture visible state is invalid: ${JSON.stringify(value.renderer)}`
  }
  const protection = value.renderer.protection
  if (
    protection?.role !== 'alertdialog' ||
    protection.modal !== 'true' ||
    protection.heading !== '大破艦があります' ||
    !protection.description?.includes('ゲーム画面への入力を保護しています') ||
    protection.button !== 'Ctrl + クリックで保護を解除' ||
    !rectIsContained(value.renderer.game, protection.rect) ||
    !rectIsContained(protection.rect, value.renderer.game)
  ) {
    return `Battle-result input protection is invalid: ${JSON.stringify(protection)}`
  }
  if (
    requireBypassEvidence &&
    (protection.ordinaryClickBlocked !== true || protection.ctrlBypass !== true)
  ) {
    return `Battle-result input protection bypass is invalid: ${JSON.stringify(protection)}`
  }
  return null
}

function proxyFixtureFailure(value) {
  if (
    value?.probeUrl !== 'https://koubrowser-proxy-smoke.invalid/' ||
    value.proxyRules !== 'http=127.0.0.1:65534;https=127.0.0.1:65534' ||
    value.resolutionOnly !== true
  ) {
    return `Proxy fixture metadata is invalid: ${JSON.stringify(value)}`
  }
  if (
    typeof value.fixedResolution !== 'string' ||
    !value.fixedResolution.includes('127.0.0.1:65534')
  ) {
    return `Fixed proxy rule was not resolved by Chromium: ${JSON.stringify(value)}`
  }
  if (
    typeof value.restoredResolution !== 'string' ||
    value.restoredResolution.includes('127.0.0.1:65534')
  ) {
    return `System proxy mode was not restored after inspection: ${JSON.stringify(value)}`
  }
  return null
}

function dataFolderFixtureFailure(value) {
  if (
    value?.rendererOpened !== true ||
    value.opened !== true ||
    value.parentIsElectronUserData !== true ||
    value.directoryName !== 'koubrowser' ||
    value.directoryExists !== true
  ) {
    return `Data-folder fixture state is invalid: ${JSON.stringify(value)}`
  }
  return null
}

function workspaceFrameFailure(frame, expectedGame, tolerance = 1) {
  if (!frame) return 'Workspace frame is unavailable'
  if (frame.surface !== 'workspace') {
    return `Expected workspace surface, received ${JSON.stringify(frame.surface)}`
  }
  if (!frame.ready) return 'Workspace frame is not ready'
  if (!metricsAreContained(frame.document, tolerance)) {
    return `Workspace document overflowed: ${JSON.stringify(frame.document)}`
  }
  if (
    !frame.scroll ||
    Math.abs(frame.scroll.x) > tolerance ||
    Math.abs(frame.scroll.y) > tolerance
  ) {
    return `Workspace required page scrolling: ${JSON.stringify(frame.scroll)}`
  }
  if (
    !frame.main ||
    !frame.primary ||
    !frame.game ||
    !frame.secondary ||
    !rectIsContained(frame.viewport, frame.main, tolerance) ||
    !rectIsContained(frame.main, frame.primary, tolerance) ||
    !rectIsContained(frame.primary, frame.game, tolerance) ||
    !rectIsContained(frame.main, frame.secondary, tolerance)
  ) {
    return `Workspace regions escaped their containers: ${JSON.stringify(frame)}`
  }
  if (
    Math.abs(frame.game.width - expectedGame.width) > tolerance ||
    Math.abs(frame.game.height - expectedGame.height) > tolerance
  ) {
    return (
      `Expected game ${expectedGame.width}x${expectedGame.height}, received ` +
      `${frame.game.width}x${frame.game.height}`
    )
  }
  if (
    Math.abs(frame.game.left - frame.primary.left) > tolerance ||
    Math.abs(frame.game.top - frame.primary.top) > tolerance ||
    Math.abs(frame.game.width - frame.primary.width) > tolerance
  ) {
    return `Game was not anchored to the responsive primary track: ${JSON.stringify(frame)}`
  }
  if (frame.game.right > frame.secondary.left + tolerance) {
    return `Game and assist tracks overlapped: ${JSON.stringify(frame)}`
  }
  const automaticSpacing = [
    frame.game.left - frame.main.left,
    frame.secondary.left - frame.game.right,
    frame.main.right - frame.secondary.right
  ]
  if (
    automaticSpacing.some((spacing) => spacing < -tolerance || spacing > 12 + tolerance) ||
    Math.max(...automaticSpacing) - Math.min(...automaticSpacing) > tolerance
  ) {
    return `Game and UI tracks were not automatically aligned: ${JSON.stringify({
      automaticSpacing,
      frame
    })}`
  }
  return null
}

function wideWorkspaceBounds(availableWorkArea) {
  const bounds = {
    left: Math.round(availableWorkArea.left),
    top: Math.round(availableWorkArea.top),
    width: Math.round(availableWorkArea.width),
    height: Math.round(availableWorkArea.height)
  }
  if (bounds.width < WideWorkspaceMinWidth || bounds.height < WideWorkspaceMinHeight) {
    throw new Error(
      `The current work area is too small for wide workspace inspection: ` +
        `${bounds.width}x${bounds.height}`
    )
  }
  return bounds
}

function workspaceBoundsForSize(
  availableWorkArea,
  width,
  height,
  preferredPosition = availableWorkArea
) {
  const workArea = {
    left: Math.round(availableWorkArea.left),
    top: Math.round(availableWorkArea.top),
    width: Math.round(availableWorkArea.width),
    height: Math.round(availableWorkArea.height)
  }
  const targetWidth = Math.round(width)
  const targetHeight = Math.round(height)
  if (
    targetWidth <= 0 ||
    targetHeight <= 0 ||
    targetWidth > workArea.width ||
    targetHeight > workArea.height
  ) {
    throw new Error(
      `The requested workspace size does not fit the current work area: ` +
        `${targetWidth}x${targetHeight} in ${workArea.width}x${workArea.height}`
    )
  }
  return {
    left: Math.min(
      Math.max(Math.round(preferredPosition.left), workArea.left),
      workArea.left + workArea.width - targetWidth
    ),
    top: Math.min(
      Math.max(Math.round(preferredPosition.top), workArea.top),
      workArea.top + workArea.height - targetHeight
    ),
    width: targetWidth,
    height: targetHeight
  }
}

function workspaceGameSizeForWindow(width, height) {
  const availableWidth = Math.max(1, Math.round(width) - WorkspacePanelMinWidth - WorkspaceGap * 3)
  const availableHeight = Math.max(1, Math.round(height) - WorkspaceTitleBarHeight)
  const gameRatio = WorkspaceGameWidth / WorkspaceGameHeight
  const gameWidth = Math.max(
    1,
    Math.min(WorkspaceGameWidth, availableWidth, Math.floor(availableHeight * gameRatio))
  )
  const scale = gameWidth / WorkspaceGameWidth

  return {
    width: gameWidth,
    height: Math.floor(WorkspaceGameHeight * scale),
    scale
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

let activeRunDeadline = Number.POSITIVE_INFINITY

async function waitFor(check, description, timeoutMs, intervalMs = 400) {
  const stageDeadline = Date.now() + timeoutMs
  const deadline = Math.min(stageDeadline, activeRunDeadline)
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await check()
      if (value) {
        return value
      }
    } catch (error) {
      if (error.fatal) {
        throw error
      }
      lastError = error
    }
    await delay(intervalMs)
  }
  const detail = lastError ? ` Last error: ${lastError.message}` : ''
  if (Date.now() >= activeRunDeadline) {
    throw new Error(`Whole-run timeout reached while waiting for ${description}.${detail}`)
  }
  throw new Error(`Timed out waiting for ${description}.${detail}`)
}

async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.close(resolve)
    })
  })
}

async function assertNoExistingWindowsApp(repoRoot, allowInstalledApp = false) {
  if (process.platform !== 'win32') {
    return
  }
  const processConditions = [
    allowInstalledApp ? undefined : "$_.Name -eq 'KouBrowser.exe'",
    "($_.Name -eq 'electron.exe' -and " + "$_.CommandLine -like ('*' + $env:KOU_SMOKE_REPO + '*'))"
  ].filter(Boolean)
  const command = [
    'Get-CimInstance Win32_Process |',
    '  Where-Object {',
    `    ${processConditions.join(' -or ')}`,
    '  } |',
    '  Select-Object -ExpandProperty ProcessId'
  ].join(' ')
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {
      env: {
        ...process.env,
        KOU_SMOKE_REPO: repoRoot
      },
      windowsHide: true
    }
  )
  const processIds = stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
  if (processIds.length > 0) {
    throw new Error(
      `KouBrowser is already running (PID ${processIds.join(', ')}). Close it before smoke testing.`
    )
  }
}

function electronExecutable(repoRoot, platform = process.platform) {
  if (platform === 'win32') {
    return path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
  }
  if (platform === 'darwin') {
    return path.join(
      repoRoot,
      'node_modules',
      'electron',
      'dist',
      'Electron.app',
      'Contents',
      'MacOS',
      'Electron'
    )
  }
  return path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron')
}

async function createSettingsBackup(settingsPath) {
  const existed = fs.existsSync(settingsPath)
  const backupPath = path.join(os.tmpdir(), `koubrowser-smoke-settings-${crypto.randomUUID()}.json`)
  let hash
  if (existed) {
    await fsPromises.copyFile(settingsPath, backupPath)
    hash = crypto
      .createHash('sha256')
      .update(await fsPromises.readFile(backupPath))
      .digest('hex')
  }
  return { settingsPath, backupPath, existed, hash }
}

async function restoreSettings(backup) {
  if (backup.existed) {
    if (!fs.existsSync(backup.backupPath)) {
      throw new Error(`Settings backup is missing: ${backup.backupPath}`)
    }
    await fsPromises.copyFile(backup.backupPath, backup.settingsPath)
    const restoredHash = crypto
      .createHash('sha256')
      .update(await fsPromises.readFile(backup.settingsPath))
      .digest('hex')
    if (restoredHash !== backup.hash) {
      throw new Error('Restored settings hash does not match the backup')
    }
  } else {
    await fsPromises.rm(backup.settingsPath, { force: true })
  }
  await fsPromises.rm(backup.backupPath, { force: true })
}

async function removeLayoutFixtureUserData(directory) {
  if (!directory) {
    return
  }
  const resolvedDirectory = path.resolve(directory)
  const expectedPrefix = path.join(path.resolve(os.tmpdir()), 'koubrowser-layout-smoke-')
  if (!resolvedDirectory.startsWith(expectedPrefix)) {
    throw new Error(`Refusing to remove unexpected layout fixture directory: ${resolvedDirectory}`)
  }
  await fsPromises.rm(resolvedDirectory, { recursive: true, force: true })
}

function dataManifestSigningPayload(manifest) {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    dataVersion: manifest.dataVersion,
    publishedAt: manifest.publishedAt,
    files: [...manifest.files]
      .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
      .map((file) => ({
        path: file.path,
        sha256: file.sha256,
        size: file.size
      }))
  })
}

function createSignedDataUpdateFixture() {
  const keys = crypto.generateKeyPairSync('ed25519')
  const map = {
    spots: [DataUpdateFixtureMapSpot],
    checks: []
  }
  const questKnowledge = {
    schemaVersion: 1,
    claims: [
      {
        source: 'wikiwiki',
        sourceLabel: '日本語攻略Wiki',
        url: 'https://wikiwiki.jp/kancolle/任務/出撃任務',
        lastVerifiedAt: '2026-07-29',
        dataVersion: 'Electron smoke fixture',
        questId: DataUpdateFixtureQuestId,
        questTitle: DataUpdateFixtureQuestTitle,
        prerequisites: []
      }
    ],
    strategy: {
      schemaVersion: 1,
      version: DataUpdateFixtureStrategyVersion,
      recipes: [
        {
          schemaVersion: 1,
          id: DataUpdateFixtureStrategyRecipeId,
          revision: 1,
          title: '署名更新スモーク攻略',
          status: 'approved',
          questIds: [DataUpdateFixtureQuestId],
          objectives: [
            {
              questId: DataUpdateFixtureQuestId,
              result: 'arrival',
              requiredCount: 1
            }
          ],
          mapKey: '1-1',
          routeLabels: ['A-B'],
          targetNodes: ['B'],
          fleet: {
            minimumShips: 1,
            maximumShips: 6,
            shipTypeConstraints: []
          },
          equipmentTypeConstraints: [],
          formations: [
            {
              formationId: 1,
              label: '単縦陣'
            }
          ],
          actions: ['署名済み攻略 fixture を表示する'],
          cost: 'low',
          risk: 'low',
          evidence: [
            {
              sourceId: 'wikiwiki-smoke-strategy',
              sourceLabel: '日本語攻略Wiki',
              url: 'https://wikiwiki.jp/kancolle/鎮守府海域/1-1',
              reviewedAt: '2026-07-31T00:00:00.000Z',
              validUntil: '2027-07-31T00:00:00.000Z',
              confidence: 'supported',
              summary: '署名更新経路の合成確認'
            }
          ],
          validity: {
            reviewBy: '2026-10-31T00:00:00.000Z'
          }
        }
      ]
    }
  }
  const mapData = Buffer.from(JSON.stringify(map), 'utf8')
  const data = Buffer.from(JSON.stringify(questKnowledge), 'utf8')
  const mapFile = {
    path: DataUpdateFixtureMapPath,
    sha256: crypto.createHash('sha256').update(mapData).digest('hex'),
    size: mapData.byteLength
  }
  const questFile = {
    path: 'quest/knowledge.json',
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
    size: data.byteLength
  }
  const manifest = {
    schemaVersion: 1,
    dataVersion: DataUpdateFixtureVersion,
    publishedAt: '2026-07-29T00:00:00.000Z',
    files: [mapFile, questFile],
    signature: ''
  }
  manifest.signature = crypto
    .sign(null, Buffer.from(dataManifestSigningPayload(manifest), 'utf8'), keys.privateKey)
    .toString('base64')

  return {
    publicKey: keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    dataVersion: DataUpdateFixtureVersion,
    mapAreaId: DataUpdateFixtureMapAreaId,
    mapNo: DataUpdateFixtureMapNo,
    mapPath: DataUpdateFixtureMapPath,
    mapSpot: DataUpdateFixtureMapSpot,
    questId: DataUpdateFixtureQuestId,
    questTitle: DataUpdateFixtureQuestTitle,
    strategyVersion: DataUpdateFixtureStrategyVersion,
    strategyRecipeId: DataUpdateFixtureStrategyRecipeId,
    manifest,
    mapData,
    data
  }
}

async function createDataUpdateFixture(cacheRoot) {
  const fixture = createSignedDataUpdateFixture()
  const root = path.join(cacheRoot, 'data-updates')
  const versionDirectory = path.join(root, 'versions', DataUpdateFixtureVersion)
  await fsPromises.mkdir(path.join(versionDirectory, 'map'), { recursive: true })
  await fsPromises.mkdir(path.join(versionDirectory, 'quest'), { recursive: true })
  await fsPromises.writeFile(path.join(versionDirectory, 'map', '001_01_map.json'), fixture.mapData)
  await fsPromises.writeFile(path.join(versionDirectory, 'quest', 'knowledge.json'), fixture.data)
  await fsPromises.writeFile(
    path.join(versionDirectory, 'manifest.json'),
    JSON.stringify(fixture.manifest),
    'utf8'
  )
  await fsPromises.writeFile(
    path.join(root, 'active.json'),
    JSON.stringify({ version: DataUpdateFixtureVersion }),
    'utf8'
  )

  return fixture
}

async function startDataUpdateFixtureServer(fixture) {
  const requests = []
  const manifestPath = '/koubrowser-smoke/manifest.json'
  const mapPath = '/koubrowser-smoke/map/001_01_map.json'
  const questPath = '/koubrowser-smoke/quest/knowledge.json'
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    requests.push({ method: request.method ?? '', path: pathname })
    if (request.method !== 'GET') {
      response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('method not allowed')
      return
    }
    if (pathname === manifestPath) {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify(fixture.manifest))
      return
    }
    if (pathname === mapPath) {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(fixture.mapData)
      return
    }
    if (pathname === questPath) {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(fixture.data)
      return
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('not found')
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Data-update fixture server did not expose a TCP address')
  }
  return {
    manifestUrl: `http://127.0.0.1:${address.port}${manifestPath}`,
    requests,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
  }
}

async function dataUpdateDownloadFixtureState(cacheRoot, fixture, serverFixture) {
  const root = path.join(cacheRoot, 'data-updates')
  const versionDirectory = path.join(root, 'versions', fixture.dataVersion)
  const manifestPath = path.join(versionDirectory, 'manifest.json')
  const mapPath = path.join(versionDirectory, fixture.mapPath)
  const questPath = path.join(versionDirectory, 'quest', 'knowledge.json')
  try {
    const pointer = JSON.parse(await fsPromises.readFile(path.join(root, 'active.json'), 'utf8'))
    const manifest = JSON.parse(await fsPromises.readFile(manifestPath, 'utf8'))
    const mapData = await fsPromises.readFile(mapPath)
    const questData = await fsPromises.readFile(questPath)
    const requestPaths = serverFixture.requests.map((request) => request.path)
    const ready =
      pointer.version === fixture.dataVersion &&
      manifest.dataVersion === fixture.dataVersion &&
      crypto.timingSafeEqual(
        crypto.createHash('sha256').update(mapData).digest(),
        crypto.createHash('sha256').update(fixture.mapData).digest()
      ) &&
      crypto.timingSafeEqual(
        crypto.createHash('sha256').update(questData).digest(),
        crypto.createHash('sha256').update(fixture.data).digest()
      ) &&
      requestPaths.includes('/koubrowser-smoke/manifest.json') &&
      requestPaths.includes('/koubrowser-smoke/map/001_01_map.json') &&
      requestPaths.includes('/koubrowser-smoke/quest/knowledge.json')
    return {
      ready,
      source: 'loopback-fixture',
      version: pointer.version,
      fileCount: manifest.files.length,
      hasQuestKnowledge: manifest.files.some((file) => file.path === 'quest/knowledge.json'),
      publicKeySha256: publicKeySha256(fixture.publicKey),
      requestPaths,
      manifestPath,
      mapPath,
      questPath
    }
  } catch {
    return {
      ready: false,
      requestPaths: serverFixture.requests.map((request) => request.path)
    }
  }
}

function loadDataUpdatePublicKeyFile(filename) {
  const resolved = path.resolve(filename)
  const stats = fs.lstatSync(resolved)
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error('Data-update public key path must be a real file')
  }
  const publicKey = fs.readFileSync(resolved, 'utf8').trim()
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(publicKey)) {
    throw new Error('Data-update public key file must contain an Ed25519 DER SPKI Base64 key')
  }
  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(publicKey, 'base64'),
      format: 'der',
      type: 'spki'
    })
    if (key.asymmetricKeyType !== 'ed25519') {
      throw new Error('unsupported key type')
    }
  } catch {
    throw new Error('Data-update public key file must contain an Ed25519 DER SPKI Base64 key')
  }
  return publicKey
}

async function dataUpdateInstalledBundleState(cacheRoot, publicKey) {
  const root = path.join(cacheRoot, 'data-updates')
  try {
    const pointer = JSON.parse(await fsPromises.readFile(path.join(root, 'active.json'), 'utf8'))
    if (
      !pointer ||
      typeof pointer !== 'object' ||
      Array.isArray(pointer) ||
      Object.keys(pointer).length !== 1 ||
      typeof pointer.version !== 'string' ||
      !/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/.test(pointer.version)
    ) {
      return { ready: false }
    }
    const versionDirectory = path.join(root, 'versions', pointer.version)
    const report = verifyBundleDirectory(versionDirectory, publicKey)
    if (report.dataVersion !== pointer.version || !report.hasQuestKnowledge) {
      return { ready: false }
    }
    const manifest = JSON.parse(
      await fsPromises.readFile(path.join(versionDirectory, 'manifest.json'), 'utf8')
    )
    let mapExpectation
    for (const file of manifest.files) {
      const match = /^map\/([0-9]{3})_([0-9]{2})_map\.json$/.exec(file.path)
      if (!match) {
        continue
      }
      const map = JSON.parse(
        await fsPromises.readFile(path.join(versionDirectory, ...file.path.split('/')), 'utf8')
      )
      const spot = map.spots?.[0]
      if (spot) {
        mapExpectation = {
          mapAreaId: Number(match[1]),
          mapNo: Number(match[2]),
          mapPath: file.path,
          mapSpot: spot
        }
        break
      }
    }
    const questKnowledge = JSON.parse(
      await fsPromises.readFile(path.join(versionDirectory, 'quest', 'knowledge.json'), 'utf8')
    )
    const claim = questKnowledge.claims?.[0]
    const strategy = questKnowledge.strategy
    if (!mapExpectation || !claim || typeof strategy?.version !== 'string') {
      return { ready: false }
    }
    return {
      ready: true,
      source: 'https-staging',
      version: report.dataVersion,
      fileCount: report.fileCount,
      totalSize: report.totalSize,
      hasQuestKnowledge: report.hasQuestKnowledge,
      publicKeySha256: publicKeySha256(publicKey),
      versionDirectory,
      ...mapExpectation,
      questId: claim.questId,
      questTitle: claim.questTitle,
      strategyVersion: strategy.version,
      strategyRecipeId: strategy.recipes?.[0]?.id ?? null
    }
  } catch {
    return { ready: false }
  }
}

function accountFixtureDatabase(label, dbName, recordCount = 1) {
  const records = new Array(recordCount)
  for (let index = 0; index < recordCount; index += 1) {
    const record = {
      _id: `${dbName}-${label}-${String(index).padStart(6, '0')}`,
      fixture: 'account-restore',
      value: label,
      sequence: index,
      payload: `${dbName}:${label}:${String(index).padStart(6, '0')}`
    }
    if (dbName === 'port') {
      Object.assign(record, {
        date: new Date(Date.UTC(2026, 0, 1) + index * 60 * 1000).toISOString(),
        1: 1000 + index,
        2: 2000 + index,
        3: 3000 + index,
        4: 4000 + index,
        31: 10000 + index,
        32: 20000 + index,
        33: 30000 + index,
        34: 40000 + index
      })
    } else if (dbName === 'drop') {
      Object.assign(record, {
        mapId: 11,
        cellId: 1,
        isBoss: false,
        mapLv: 0,
        shipId: 100,
        rank: 'S'
      })
    }
    records[index] = JSON.stringify(record)
  }
  return Buffer.from(`${records.join('\n')}\n`, 'utf8')
}

function accountMergeFixtureDatabase(dbName, databaseIndex) {
  if (dbName === 'quest') {
    return Buffer.from(
      `${JSON.stringify({
        _id: 'quest-monotonic-smoke-incoming',
        no: 900001,
        date: '2026-07-30T11:00:00+09:00',
        dateKey: 'daily-20260730',
        quest: {
          api_no: 900001,
          api_category: 3,
          api_type: 1,
          api_label_type: 2,
          api_state: 3,
          api_title: '合成任務進捗',
          api_detail: 'production smoke 用の合成任務',
          api_voice_id: 0,
          api_get_material: [0, 0, 0, 0],
          api_bonus_flag: 0,
          api_progress_flag: 2,
          api_invalid_flag: 0
        },
        state: {
          count: [2, 2],
          countMax: [5, 3]
        }
      })}\n`,
      'utf8'
    )
  }
  const record = {
    _id: `${dbName}-merge-safe`,
    fixture: 'account-merge',
    value: 'merge-safe',
    sequence: databaseIndex,
    recordIdentity: {
      schemaVersion: 1,
      recordId: `77777777-7777-4777-8777-${String(databaseIndex + 1).padStart(12, '0')}`,
      index: 0
    },
    payload: `${dbName}:merge-safe`
  }
  if (dbName === 'port') {
    Object.assign(record, {
      date: '2026-12-31T23:59:00.000Z',
      1: 9001,
      2: 9002,
      3: 9003,
      4: 9004,
      31: 90031,
      32: 90032,
      33: 90033,
      34: 90034
    })
  } else if (dbName === 'drop') {
    Object.assign(record, {
      mapId: 11,
      cellId: 1,
      isBoss: false,
      mapLv: 0,
      shipId: 100,
      rank: 'S'
    })
  }
  return Buffer.from(`${JSON.stringify(record)}\n`, 'utf8')
}

function accountRestoreFixtureManifest(
  bundleId,
  createdAt,
  files,
  sourceDeviceId = AccountRestoreFixtureSourceDeviceId
) {
  return {
    schemaVersion: 1,
    bundleId,
    appVersion: '1.0.5',
    createdAt,
    sourceDeviceId,
    mode: 'backup',
    protection: 'none-local-only',
    account: AccountRestoreFixtureAccount,
    summary: {
      databaseFiles: files.length,
      profileFiles: 0,
      records: files.reduce((sum, file) => sum + file.recordCount, 0),
      oldestRecordAt: null,
      newestRecordAt: null
    },
    files
  }
}

async function writeAccountRestoreStage(fixture, { bundleId, label, createdAt, corruptDatabase }) {
  const stagingDirectory = path.join(fixture.appDataRoot, 'restore-staging', bundleId)
  const stageAccountDirectory = path.join(stagingDirectory, 'account')
  await fsPromises.mkdir(path.dirname(stagingDirectory), { recursive: true })
  await fsPromises.mkdir(stagingDirectory)
  await fsPromises.mkdir(stageAccountDirectory)

  const files = []
  for (const dbName of AccountRestoreFixtureDatabases) {
    const data = accountFixtureDatabase(label, dbName, fixture.recordsPerDatabase)
    await fsPromises.writeFile(path.join(stageAccountDirectory, `${dbName}.db`), data)
    files.push({
      path: `data/${dbName}.db`,
      category: 'database',
      size: data.byteLength,
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      recordCount: fixture.recordsPerDatabase,
      oldestRecordAt: null,
      newestRecordAt: null
    })
  }
  const manifest = accountRestoreFixtureManifest(bundleId, createdAt, files)
  if (corruptDatabase) {
    await fsPromises.appendFile(
      path.join(stageAccountDirectory, `${corruptDatabase}.db`),
      `${JSON.stringify({
        _id: `${corruptDatabase}-corrupt-extra`,
        fixture: 'account-restore',
        value: 'corrupt-extra'
      })}\n`,
      'utf8'
    )
  }
  await fsPromises.writeFile(
    path.join(stagingDirectory, 'stage.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        stagedAt: createdAt,
        manifest
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  await fsPromises.writeFile(
    path.join(fixture.appDataRoot, 'account-restore-pending.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        phase: 'ready',
        createdAt,
        hadCurrent: null,
        manifest
      },
      null,
      2
    )}\n`,
    { encoding: 'utf8', flag: 'wx' }
  )
  return { stagingDirectory, manifest }
}

async function writeAccountRestoreRollbackGeneration(fixture, { bundleId, label, createdAt }) {
  const directory = path.join(fixture.appDataRoot, 'restore-rollbacks', bundleId)
  const accountDirectory = path.join(directory, 'account')
  await fsPromises.mkdir(accountDirectory, { recursive: true })

  const files = []
  const databaseFiles = []
  for (const dbName of AccountRestoreFixtureDatabases) {
    const data = accountFixtureDatabase(label, dbName)
    const filename = `${dbName}.db`
    const sha256 = crypto.createHash('sha256').update(data).digest('hex')
    await fsPromises.writeFile(path.join(accountDirectory, filename), data)
    files.push({
      path: `data/${filename}`,
      category: 'database',
      size: data.byteLength,
      sha256,
      recordCount: 1,
      oldestRecordAt: null,
      newestRecordAt: null
    })
    databaseFiles.push({
      dbName,
      filename,
      size: data.byteLength,
      sha256,
      recordCount: 1
    })
  }
  await fsPromises.writeFile(
    path.join(directory, 'rollback.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        createdAt,
        hadCurrent: true,
        incomingManifest: accountRestoreFixtureManifest(bundleId, createdAt, files),
        databaseFiles
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  return { bundleId, createdAt, directory }
}

async function createAccountRestoreFixture(userDataRoot, recordsPerDatabase = 1) {
  const appDataRoot = path.join(userDataRoot, 'koubrowser')
  const accountName = `${AccountRestoreFixtureAccount.serverId}_${AccountRestoreFixtureAccount.memberId}`
  const currentDirectory = path.join(appDataRoot, 'store', accountName)
  await fsPromises.mkdir(currentDirectory, { recursive: true })

  for (const dbName of AccountRestoreFixtureDatabases) {
    const current = accountFixtureDatabase('current', dbName, recordsPerDatabase)
    await fsPromises.writeFile(path.join(currentDirectory, `${dbName}.db`), current)
  }
  await fsPromises.writeFile(
    path.join(currentDirectory, 'mapinfo.json'),
    JSON.stringify({ fixture: 'current-only' }),
    'utf8'
  )

  const createdAtMs = Date.now()
  const createdAt = new Date(createdAtMs).toISOString()
  const fixture = {
    appDataRoot,
    accountName,
    bundleId: AccountRestoreFixtureBundleId,
    createdAt,
    currentDirectory,
    recordsPerDatabase,
    rollbackDirectory: path.join(appDataRoot, 'restore-rollbacks', AccountRestoreFixtureBundleId)
  }
  const mergeBackupDirectory = path.join(userDataRoot, 'account-merge-backup')
  const mergeBackupDataDirectory = path.join(mergeBackupDirectory, 'data')
  await fsPromises.mkdir(mergeBackupDataDirectory, {
    recursive: true
  })
  const mergeFiles = []
  for (let index = 0; index < AccountRestoreFixtureDatabases.length; index += 1) {
    const dbName = AccountRestoreFixtureDatabases[index]
    const data = accountMergeFixtureDatabase(dbName, index)
    await fsPromises.writeFile(path.join(mergeBackupDataDirectory, `${dbName}.db`), data)
    mergeFiles.push({
      path: `data/${dbName}.db`,
      category: 'database',
      size: data.byteLength,
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      recordCount: 1,
      oldestRecordAt: null,
      newestRecordAt: null
    })
  }
  const mergeCreatedAt = new Date(createdAtMs + 30 * 1000).toISOString()
  await fsPromises.writeFile(
    path.join(mergeBackupDirectory, 'manifest.json'),
    `${JSON.stringify(
      accountRestoreFixtureManifest(
        AccountMergeFixtureBundleId,
        mergeCreatedAt,
        mergeFiles,
        AccountMergeFixtureSourceDeviceId
      ),
      null,
      2
    )}\n`,
    'utf8'
  )
  const { stagingDirectory, manifest } = await writeAccountRestoreStage(fixture, {
    bundleId: fixture.bundleId,
    label: 'incoming',
    createdAt
  })
  const retentionHistory = []
  for (let index = 0; index < AccountRestoreRetentionFixtureBundleIds.length; index += 1) {
    retentionHistory.push(
      await writeAccountRestoreRollbackGeneration(fixture, {
        bundleId: AccountRestoreRetentionFixtureBundleIds[index],
        label: `retention-history-${index + 1}`,
        createdAt: new Date(
          createdAtMs - (AccountRestoreRetentionFixtureBundleIds.length - index) * 60 * 60 * 1000
        ).toISOString()
      })
    )
  }

  return {
    ...fixture,
    manifest,
    stagingDirectory,
    retentionHistory,
    mergeBackupDirectory
  }
}

async function scheduleRepeatedAccountRestoreFixture(fixture) {
  const { stagingDirectory } = await writeAccountRestoreStage(fixture, {
    bundleId: fixture.bundleId,
    label: 'incoming',
    createdAt: fixture.createdAt
  })
  return stagingDirectory
}

async function scheduleCorruptAccountRestoreFixture(fixture) {
  const createdAt = new Date(Date.parse(fixture.createdAt) + 60 * 1000).toISOString()
  const { stagingDirectory } = await writeAccountRestoreStage(fixture, {
    bundleId: AccountRestoreFailureFixtureBundleId,
    label: 'invalid-candidate',
    createdAt,
    corruptDatabase: 'quest'
  })
  return {
    bundleId: AccountRestoreFailureFixtureBundleId,
    stagingDirectory
  }
}

async function accountRestoreRetentionFixtureState(fixture) {
  const rollbackRoot = path.join(fixture.appDataRoot, 'restore-rollbacks')
  const entries = await fsPromises.readdir(rollbackRoot, {
    withFileTypes: true
  })
  const finalized = entries
    .filter(
      (entry) => entry.isDirectory() && !entry.isSymbolicLink() && BundleIdPattern.test(entry.name)
    )
    .map((entry) => entry.name)
    .sort()
  const deleted = fixture.retentionHistory[0].bundleId
  const retained = [
    ...fixture.retentionHistory.slice(1).map((generation) => generation.bundleId),
    fixture.bundleId
  ].sort()
  return {
    ready:
      !(await pathExists(fixture.retentionHistory[0].directory)) &&
      retained.every((bundleId) => finalized.includes(bundleId)) &&
      finalized.length === retained.length,
    deleted,
    retained,
    generations: finalized
  }
}

async function databaseFixtureRecordCount(filePath, label) {
  try {
    const text = await fsPromises.readFile(filePath, 'utf8')
    const records = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    const matching = records.filter(
      (record) => record?.fixture === 'account-restore' && record?.value === label
    )
    const extras = records.filter(
      (record) => record?.fixture !== 'account-restore' || record?.value !== label
    )
    const allowedQuestEvidence =
      path.basename(filePath) === 'quest.db' &&
      extras.length === 1 &&
      extras[0]?.no === 900001 &&
      extras[0]?._id === 'quest-monotonic-smoke-current'
    return extras.length === 0 || allowedQuestEvidence ? matching.length : -1
  } catch {
    return -1
  }
}

async function databaseContainsLabel(filePath, label) {
  return (await databaseFixtureRecordCount(filePath, label)) > 0
}

async function databaseFixtureLabelCount(filePath, fixture, value) {
  try {
    const text = await fsPromises.readFile(filePath, 'utf8')
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((record) => record?.fixture === fixture && record?.value === value).length
  } catch {
    return -1
  }
}

async function questMergeFixtureState(filePath) {
  try {
    const text = await fsPromises.readFile(filePath, 'utf8')
    const record = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .find((candidate) => candidate?.no === 900001)
    return record
      ? {
          id: record._id,
          count: record.state?.count,
          countMax: record.state?.countMax,
          apiState: record.quest?.api_state,
          apiProgress: record.quest?.api_progress_flag
        }
      : null
  } catch {
    return null
  }
}

async function accountMergeFixtureState(fixture, expectedPhase) {
  const rollbackDirectory = path.join(
    fixture.appDataRoot,
    'merge-rollbacks',
    fixture.mergeStageName
  )
  const rollbackAccount = path.join(rollbackDirectory, 'account')
  const mergedAccount = path.join(rollbackDirectory, 'merged-account')
  const currentIsMerged = expectedPhase !== 'rolled-back'
  const retainedDirectory = currentIsMerged ? rollbackAccount : mergedAccount
  const currentCounts = await Promise.all(
    AccountRestoreFixtureDatabases.map(async (dbName) => ({
      dbName,
      incoming: await databaseFixtureLabelCount(
        path.join(fixture.currentDirectory, `${dbName}.db`),
        'account-restore',
        'incoming'
      ),
      merged: await databaseFixtureLabelCount(
        path.join(fixture.currentDirectory, `${dbName}.db`),
        'account-merge',
        'merge-safe'
      )
    }))
  )
  const retainedCounts = await Promise.all(
    AccountRestoreFixtureDatabases.map(async (dbName) => ({
      dbName,
      incoming: await databaseFixtureLabelCount(
        path.join(retainedDirectory, `${dbName}.db`),
        'account-restore',
        'incoming'
      ),
      merged: await databaseFixtureLabelCount(
        path.join(retainedDirectory, `${dbName}.db`),
        'account-merge',
        'merge-safe'
      )
    }))
  )
  const currentQuest = await questMergeFixtureState(path.join(fixture.currentDirectory, 'quest.db'))
  const retainedQuest = await questMergeFixtureState(path.join(retainedDirectory, 'quest.db'))
  const mergedQuest = {
    id: 'quest-monotonic-smoke-current',
    count: [3, 2],
    countMax: [5, 3],
    apiState: 2,
    apiProgress: 0
  }
  const preMergeQuest = {
    id: 'quest-monotonic-smoke-current',
    count: [3, 1],
    countMax: [5, 3],
    apiState: 2,
    apiProgress: 0
  }
  const countsMatch = (counts, merged) =>
    counts.every(
      (count) =>
        count.incoming === fixture.recordsPerDatabase &&
        count.merged === (merged && count.dbName !== 'quest' ? 1 : 0)
    )
  const currentMatches = countsMatch(currentCounts, currentIsMerged)
  const retainedMatches = countsMatch(retainedCounts, !currentIsMerged)
  const markerFilename =
    expectedPhase === 'rolled-back'
      ? 'account-merge-rollback-pending.json'
      : expectedPhase === 'redone'
        ? 'account-merge-redo-pending.json'
        : 'account-merge-pending.json'
  return {
    ready:
      !(await pathExists(path.join(fixture.appDataRoot, markerFilename))) &&
      !(await pathExists(
        path.join(fixture.appDataRoot, 'merge-staging', fixture.mergeStageName)
      )) &&
      (await pathExists(path.join(rollbackDirectory, 'merge-rollback.json'))) &&
      currentMatches &&
      retainedMatches &&
      JSON.stringify(currentQuest) ===
        JSON.stringify(currentIsMerged ? mergedQuest : preMergeQuest) &&
      JSON.stringify(retainedQuest) ===
        JSON.stringify(currentIsMerged ? preMergeQuest : mergedQuest),
    phase: expectedPhase,
    current: currentIsMerged ? 'merged' : 'pre-merge',
    retained: currentIsMerged ? 'pre-merge' : 'merged',
    safeDatabases: AccountRestoreFixtureDatabases.length,
    questProgress: {
      current: currentQuest,
      retained: retainedQuest
    },
    recordsPerDatabase: fixture.recordsPerDatabase
  }
}

async function accountRestoreFixtureState(fixture, expectedPhase) {
  const currentQuest = path.join(fixture.currentDirectory, 'quest.db')
  const rollbackAccount = path.join(fixture.rollbackDirectory, 'account')
  const replacedAccount = path.join(fixture.rollbackDirectory, 'replaced-account')
  if (expectedPhase === 'restored') {
    const currentRecords = await databaseFixtureRecordCount(currentQuest, 'incoming')
    const rollbackRecords = await databaseFixtureRecordCount(
      path.join(rollbackAccount, 'quest.db'),
      'current'
    )
    return {
      ready:
        !(await pathExists(path.join(fixture.appDataRoot, 'account-restore-pending.json'))) &&
        !(await pathExists(fixture.stagingDirectory)) &&
        currentRecords === fixture.recordsPerDatabase &&
        rollbackRecords === fixture.recordsPerDatabase &&
        (await pathExists(path.join(fixture.rollbackDirectory, 'rollback.json'))),
      current: 'incoming',
      rollback: 'current',
      recordsPerDatabase: fixture.recordsPerDatabase
    }
  }
  if (expectedPhase === 'repeated') {
    const restored = await accountRestoreFixtureState(fixture, 'restored')
    return {
      ...restored,
      ready: restored.ready,
      repeated: 'no-op'
    }
  }
  const currentRecords = await databaseFixtureRecordCount(currentQuest, 'current')
  const replacedRecords = await databaseFixtureRecordCount(
    path.join(replacedAccount, 'quest.db'),
    'incoming'
  )
  return {
    ready:
      !(await pathExists(path.join(fixture.appDataRoot, 'account-rollback-pending.json'))) &&
      !(await pathExists(rollbackAccount)) &&
      currentRecords === fixture.recordsPerDatabase &&
      replacedRecords === fixture.recordsPerDatabase,
    current: 'current',
    replaced: 'incoming',
    recordsPerDatabase: fixture.recordsPerDatabase
  }
}

async function accountRestoreFailureFixtureState(
  fixture,
  failureFixture,
  expectedCurrent = 'current'
) {
  const currentRecords = await databaseFixtureRecordCount(
    path.join(fixture.currentDirectory, 'quest.db'),
    expectedCurrent
  )
  const mergeState = fixture.mergeStageName
    ? await accountMergeFixtureState(fixture, 'redone')
    : null
  return {
    ready:
      currentRecords === fixture.recordsPerDatabase &&
      (mergeState === null || mergeState.ready) &&
      (await pathExists(path.join(fixture.appDataRoot, 'account-restore-pending.json'))) &&
      (await pathExists(failureFixture.stagingDirectory)) &&
      !(await pathExists(
        path.join(fixture.appDataRoot, 'restore-rollbacks', `${failureFixture.bundleId}.partial`)
      )) &&
      !(await pathExists(
        path.join(fixture.appDataRoot, 'restore-rollbacks', failureFixture.bundleId)
      )),
    current: mergeState ? 'merged' : expectedCurrent,
    candidate: 'retained-corrupt',
    recordsPerDatabase: fixture.recordsPerDatabase
  }
}

async function inspectAccountBusinessFixture(session, fixture, currentValue, merged) {
  const state = await session.call('Smoke.inspectAccountRestoreFixtureData')
  const expectedRecords = fixture.recordsPerDatabase
  for (const dbName of AccountBusinessFixtureDatabases) {
    const history = state?.histories?.[dbName]
    const expectsMerge = merged && dbName !== 'quest'
    if (
      history?.records !== expectedRecords + (expectsMerge ? 1 : 0) ||
      history?.values?.[currentValue] !== expectedRecords ||
      (history?.values?.['merge-safe'] ?? 0) !== (expectsMerge ? 1 : 0)
    ) {
      throw new Error(`Account business history mismatch for ${dbName}: ` + JSON.stringify(state))
    }
  }
  const expectedAggregateRecords = expectedRecords + (merged ? 1 : 0)
  if (
    state.portChartPoints !== expectedAggregateRecords ||
    state.dropRankS !== expectedAggregateRecords
  ) {
    throw new Error(`Account business aggregate mismatch: ${JSON.stringify(state)}`)
  }
  return {
    currentValue,
    merged,
    histories: state.histories,
    portChartPoints: state.portChartPoints,
    dropRankS: state.dropRankS
  }
}

async function accountRestoreFixtureDiagnostic(fixture) {
  const readJsonIfPresent = async (filePath) => {
    try {
      return JSON.parse(await fsPromises.readFile(filePath, 'utf8'))
    } catch (error) {
      return error?.code === 'ENOENT' ? null : { error: error?.message ?? String(error) }
    }
  }
  let files = []
  try {
    files = await fsPromises.readdir(fixture.appDataRoot, {
      recursive: true
    })
  } catch (error) {
    files = [`<readdir failed: ${error?.message ?? String(error)}>`]
  }
  return {
    files,
    restoreMarker: await readJsonIfPresent(
      path.join(fixture.appDataRoot, 'account-restore-pending.json')
    ),
    rollbackMarker: await readJsonIfPresent(
      path.join(fixture.appDataRoot, 'account-rollback-pending.json')
    ),
    redoMarker: await readJsonIfPresent(
      path.join(fixture.appDataRoot, 'account-redo-pending.json')
    ),
    currentIncoming: await databaseContainsLabel(
      path.join(fixture.currentDirectory, 'quest.db'),
      'incoming'
    ),
    currentPrior: await databaseContainsLabel(
      path.join(fixture.currentDirectory, 'quest.db'),
      'current'
    )
  }
}

async function pathExists(candidate) {
  try {
    await fsPromises.lstat(candidate)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

async function scheduleAccountRollbackFixture(fixture) {
  await fsPromises.writeFile(
    path.join(fixture.appDataRoot, 'account-rollback-pending.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        phase: 'ready',
        createdAt: new Date().toISOString(),
        bundleId: fixture.bundleId,
        account: AccountRestoreFixtureAccount
      },
      null,
      2
    )}\n`,
    { encoding: 'utf8', flag: 'wx' }
  )
}

async function scheduleAccountRedoFixture(fixture) {
  await fsPromises.writeFile(
    path.join(fixture.appDataRoot, 'account-redo-pending.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        phase: 'ready',
        createdAt: new Date().toISOString(),
        bundleId: fixture.bundleId,
        account: AccountRestoreFixtureAccount
      },
      null,
      2
    )}\n`,
    { encoding: 'utf8', flag: 'wx' }
  )
}

async function accountRedoFixtureState(fixture) {
  const currentRecords = await databaseFixtureRecordCount(
    path.join(fixture.currentDirectory, 'quest.db'),
    'incoming'
  )
  const rollbackRecords = await databaseFixtureRecordCount(
    path.join(fixture.rollbackDirectory, 'account', 'quest.db'),
    'current'
  )
  return {
    ready:
      !(await pathExists(path.join(fixture.appDataRoot, 'account-redo-pending.json'))) &&
      !(await pathExists(path.join(fixture.rollbackDirectory, 'replaced-account'))) &&
      currentRecords === fixture.recordsPerDatabase &&
      rollbackRecords === fixture.recordsPerDatabase,
    current: 'incoming',
    rollback: 'current',
    recordsPerDatabase: fixture.recordsPerDatabase
  }
}

async function stopSpawnedProcess(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) {
    return
  }
  if (process.platform === 'win32') {
    try {
      await execFileAsync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true
      })
    } catch (error) {
      await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2_000)])
      if (child.exitCode === null && child.signalCode === null) {
        throw error
      }
    }
  } else {
    child.kill('SIGTERM')
  }
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(5_000)])
}

function waitForGracefulExit(child, timeoutMs = GracefulExitTimeoutMs, context = 'Electron') {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve()
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new RangeError('Graceful exit timeout must be a positive number'))
  }

  return new Promise((resolve, reject) => {
    const onExit = () => {
      clearTimeout(timeout)
      resolve()
    }
    const timeout = setTimeout(() => {
      child.removeListener('exit', onExit)
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve()
        return
      }
      reject(
        new Error(
          `${context} did not exit gracefully within ${timeoutMs} ms; ` +
            'restart verification refuses a forced termination'
        )
      )
    }, timeoutMs)
    child.once('exit', onExit)
  })
}

class CdpSession {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      const pending = this.pending.get(message.id)
      if (!pending) {
        return
      }
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)))
      } else {
        pending.resolve(message.result)
      }
    })
    const rejectPending = () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer)
        pending.reject(new Error('DevTools connection closed'))
      }
      this.pending.clear()
    }
    socket.addEventListener('close', rejectPending, { once: true })
    socket.addEventListener('error', rejectPending, { once: true })
  }

  static async connect(url) {
    if (typeof WebSocket === 'undefined') {
      throw new Error('This smoke tool requires Node.js with the WebSocket API')
    }
    const socket = new WebSocket(url)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
    return new CdpSession(socket)
  }

  call(method, params = {}, timeoutMs = CdpCommandTimeoutMs) {
    return new Promise((resolve, reject) => {
      const id = this.nextId
      this.nextId += 1
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`DevTools command timed out: ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const response = await this.call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ?? response.exceptionDetails.text
      )
    }
    return response.result.value
  }

  close() {
    this.socket.close()
  }
}

class IpcSession {
  constructor(child, target, token) {
    this.child = child
    this.target = target
    this.token = token
    this.nextId = 1
    this.pending = new Map()
    this.onMessage = (message) => {
      if (
        !message ||
        message.source !== 'koubrowser-smoke' ||
        message.token !== this.token ||
        typeof message.id !== 'number'
      ) {
        return
      }
      const pending = this.pending.get(message.id)
      if (!pending) {
        return
      }
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.error) {
        pending.reject(new Error(message.error.message))
      } else {
        pending.resolve(message.result)
      }
    }
    this.onDisconnect = () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer)
        pending.reject(new Error('Smoke IPC connection closed'))
      }
      this.pending.clear()
    }
    child.on('message', this.onMessage)
    child.once('disconnect', this.onDisconnect)
    child.once('exit', this.onDisconnect)
  }

  call(method, params = {}, timeoutMs = CdpCommandTimeoutMs) {
    return new Promise((resolve, reject) => {
      if (!this.child.connected) {
        reject(new Error('Smoke IPC connection is unavailable'))
        return
      }
      const id = this.nextId
      this.nextId += 1
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Smoke IPC command timed out: ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.child.send(
        {
          source: 'koubrowser-smoke',
          token: this.token,
          id,
          target: this.target,
          method,
          params
        },
        (error) => {
          if (!error) {
            return
          }
          const pending = this.pending.get(id)
          if (!pending) {
            return
          }
          this.pending.delete(id)
          clearTimeout(pending.timer)
          pending.reject(error)
        }
      )
    })
  }

  async evaluate(expression) {
    const response = await this.call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
    return response.result.value
  }

  close() {
    this.child.off('message', this.onMessage)
    this.child.off('disconnect', this.onDisconnect)
    this.child.off('exit', this.onDisconnect)
    this.onDisconnect()
  }
}

async function cdpTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json`)
  if (!response.ok) {
    throw new Error(`DevTools target request failed: ${response.status}`)
  }
  return response.json()
}

function createSmokeProgress() {
  let previousKey
  return (stage, detail) => {
    const key = `${stage}:${detail}`
    if (key === previousKey) {
      return
    }
    previousKey = key
    console.log(`[smoke] ${stage}: ${detail}`)
  }
}

function safeScreenshotName(value) {
  return value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
}

async function createScreenshotRunDirectory(baseDirectory, dataSource) {
  if (!baseDirectory) {
    return undefined
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const directory = path.resolve(baseDirectory, `${timestamp}-${dataSource}`)
  await fsPromises.mkdir(directory, { recursive: true })
  return directory
}

async function createLayoutFixtureOptionSetting(userDataRoot) {
  const appDataRoot = path.join(userDataRoot, 'koubrowser')
  const captureDirectory = path.join(userDataRoot, 'custom-capture-output')
  const defaultCaptureDirectory = path.join(appDataRoot, 'capture')
  await fsPromises.mkdir(appDataRoot, { recursive: true })
  await fsPromises.writeFile(
    path.join(appDataRoot, 'option.json'),
    JSON.stringify(
      {
        captureSavePath: captureDirectory,
        recordingTarget: 'game',
        proxyMode: 'system',
        proxyPacScript: null,
        proxyFixedServers: null,
        extensions: []
      },
      undefined,
      2
    ),
    { encoding: 'utf8', flag: 'wx' }
  )
  return {
    captureDirectory,
    defaultCaptureDirectory
  }
}

async function captureScreenshot(session, directory, label) {
  if (!directory) {
    return undefined
  }
  await session.evaluate(`new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTimeout(resolve, 200))
    })
  })`)
  const captureSession = session.screenshotSession ?? session
  const capture = () =>
    captureSession.call(
      'Page.captureScreenshot',
      {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
        optimizeForSpeed: true
      },
      ScreenshotCommandTimeoutMs
    )
  if (session.screenshotSession) {
    // BrowserWindow.capturePage() can return the compositor's previous frame
    // immediately after a Vue page switch. Prime it once before saving the
    // evidence frame so labels and visible content describe the same state.
    await capture()
    await delay(100)
  }
  const response = await capture()
  if (!response || typeof response.data !== 'string') {
    throw new Error('Screenshot capture did not return PNG data')
  }
  const filename = `${safeScreenshotName(label) || 'workspace'}.png`
  const filepath = path.join(directory, filename)
  await fsPromises.writeFile(filepath, Buffer.from(response.data, 'base64'))
  return filepath
}

async function inspectApp(session) {
  return session.evaluate(`(() => {
    const root = document.documentElement
    const main = document.querySelector('.main-root')
    const game = document.querySelector('.game-content')
    const gameRect = game?.getBoundingClientRect()
    return {
      title: document.title,
      surface: main?.dataset.layoutSurface ?? null,
      localizationLocale: main?.dataset.localizationLocale ?? null,
      localizationSample:
        document.querySelector('.battle-score-text > div:first-child')
          ?.textContent.trim() ?? null,
      ready: Boolean(
        document.querySelector('.workspace-primary.is-app-ready') ||
        (main?.dataset.layoutSurface === 'classic-combined' &&
          document.querySelector('.assist-root') &&
          !document.querySelector('.invalid-root'))
      ),
      waiting: Boolean(document.querySelector('.workspace-waiting')),
      document: {
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        clientHeight: root.clientHeight,
        scrollHeight: root.scrollHeight
      },
      scroll: {
        x: window.scrollX,
        y: window.scrollY
      },
      game: gameRect
        ? { width: gameRect.width, height: gameRect.height }
        : null
    }
  })()`)
}

function missionCheckAcceptanceFailure(result, expectedMissionName = undefined) {
  if (result.hasExplicitError) {
    return `Mission check rendered an explicit error: ${result.errorText}`
  }
  const filterControl =
    result.filterToggle?.width > 0 && result.filterToggle?.height > 0
      ? result.filterToggle
      : result.filterContent
  if (
    !result.panel ||
    !result.body ||
    !result.content ||
    !filterControl ||
    !rectIsContained(result.panel, result.body) ||
    !rectIsContained(result.body, result.content) ||
    !rectIsContained(result.content, filterControl)
  ) {
    return `Mission check geometry is invalid: ${JSON.stringify(result)}`
  }
  if (result.rowCount < 1) {
    return `Mission check rendered no missions: ${JSON.stringify(result)}`
  }
  if (
    expectedMissionName &&
    !result.missionNames.some((name) => name.includes(expectedMissionName))
  ) {
    return `Mission check did not render ${expectedMissionName}: ${JSON.stringify(result)}`
  }
  return null
}

async function inspectMissionCheck(
  session,
  timeoutMs,
  screenshotDirectory = undefined,
  profile = 'fixture'
) {
  const workspaceState = await session.evaluate(`(() => {
    const workspace = document.querySelector('.assist-workspace--secondary')
    const navigation = workspace?.querySelector('.workspace-page-tabs')
    const active = navigation?.querySelector(
      'button[role="tab"][aria-selected="true"]'
    )
    return navigation && active
      ? {
          previousPageId: active.dataset.workspacePageId ?? null,
          operationsPageInitiallyVisible: Boolean(
            navigation.querySelector(
              'button[data-workspace-page-id="secondary-operations"]'
            )
          ),
          editorInitiallyOpen: Boolean(workspace.querySelector('.workspace-layout-editor')),
          windowScrollX: window.scrollX,
          windowScrollY: window.scrollY
        }
      : null
  })()`)
  if (!workspaceState) {
    throw new Error('The secondary workspace is unavailable for mission-check inspection')
  }

  const targetPageId = 'secondary-operations'
  const setWorkspaceEditorOpen = async (open) => {
    await session.evaluate(`(() => {
      const workspace = document.querySelector('.assist-workspace--secondary')
      const editor = workspace?.querySelector('.workspace-layout-editor')
      if (${JSON.stringify(open)}) {
        if (!editor) {
          workspace?.querySelector('.workspace-layout-button')?.click()
        }
      } else {
        editor?.querySelector(':scope > header button')?.click()
      }
    })()`)
    await waitFor(
      () =>
        session.evaluate(`(() => {
          const editor = document.querySelector(
            '.assist-workspace--secondary .workspace-layout-editor'
          )
          return Boolean(editor) === ${JSON.stringify(open)}
        })()`),
      `the secondary workspace layout editor to ${open ? 'open' : 'close'}`,
      timeoutMs
    )
  }
  const selectWorkspacePage = async (pageId, description) => {
    await session.evaluate(`(() => {
      const pageId = ${JSON.stringify(pageId)}
      const tab = document.querySelector(
        '.assist-workspace--secondary .workspace-page-tabs ' +
        'button[data-workspace-page-id="' + CSS.escape(pageId) + '"]'
      )
      tab?.click()
    })()`)
    await waitFor(
      () =>
        session.evaluate(`(() => {
          const expected = ${JSON.stringify(pageId)}
          const active = document.querySelector(
            '.assist-workspace--secondary .workspace-page-tabs ' +
            'button[role="tab"][aria-selected="true"]'
          )
          return active?.dataset.workspacePageId === expected
        })()`),
      description,
      timeoutMs
    )
  }

  let area1FilterState
  let operationsPageTemporarilyRestored = false
  let missionPanelInitiallyVisible = false
  let missionPanelTemporarilyEnabled = false
  try {
    if (!workspaceState.operationsPageInitiallyVisible) {
      await setWorkspaceEditorOpen(true)
      await waitFor(
        () =>
          session.evaluate(`(() => {
            const item = document.querySelector(
              '.assist-workspace--secondary .workspace-hidden-pages ' +
              'li[data-workspace-page-id="secondary-operations"]'
            )
            const button = item?.querySelector('button')
            if (!button) {
              return false
            }
            button.click()
            return true
          })()`),
        'the hidden operations workspace page to become restorable',
        timeoutMs
      )
      await waitFor(
        () =>
          session.evaluate(`Boolean(document.querySelector(
            '.assist-workspace--secondary .workspace-page-tabs ' +
            'button[data-workspace-page-id="secondary-operations"]'
          ))`),
        'the operations workspace page to be restored',
        timeoutMs
      )
      operationsPageTemporarilyRestored = true
    }

    await selectWorkspacePage(
      targetPageId,
      'the operations workspace page for mission-check inspection'
    )
    await setWorkspaceEditorOpen(false)

    missionPanelInitiallyVisible = await session.evaluate(`Boolean(document.querySelector(
      '.assist-workspace--secondary .workspace-panel[data-panel-name="missioncheck"]'
    ))`)
    if (!missionPanelInitiallyVisible) {
      await setWorkspaceEditorOpen(true)
      const panelVisibilityState = await waitFor(
        () =>
          session.evaluate(`(() => {
            const checkbox = document.querySelector(
              '.assist-workspace--secondary .workspace-layout-editor ' +
              'li[data-layout-panel-name="missioncheck"] input[type="checkbox"]'
            )
            if (!checkbox) {
              return null
            }
            const initiallyChecked = Boolean(checkbox.checked)
            if (!initiallyChecked) {
              checkbox.click()
            }
            return {
              initiallyChecked,
              temporarilyEnabled: !initiallyChecked
            }
          })()`),
        'the mission-check panel visibility control to become available',
        timeoutMs
      )
      missionPanelTemporarilyEnabled = panelVisibilityState.temporarilyEnabled
      await setWorkspaceEditorOpen(false)
      await waitFor(
        () =>
          session.evaluate(`Boolean(document.querySelector(
            '.assist-workspace--secondary ' +
            '.workspace-panel[data-panel-name="missioncheck"]'
          ))`),
        'the mission-check panel to become visible',
        timeoutMs
      )
    }

    await session.evaluate(`document.querySelector(
      '.assist-workspace--secondary .workspace-panel[data-panel-name="missioncheck"]'
    )?.scrollIntoView({ block: 'center', inline: 'nearest' })`)
    await waitFor(
      () =>
        session.evaluate(`(() => {
          const panel = document.querySelector(
            '.assist-workspace--secondary .workspace-panel[data-panel-name="missioncheck"]'
          )
          const rect = panel?.getBoundingClientRect()
          return Boolean(
            rect &&
              rect.bottom > 0 &&
              rect.top < window.innerHeight &&
              rect.right > 0 &&
              rect.left < window.innerWidth
          )
        })()`),
      'the mission-check panel to enter the viewport',
      timeoutMs
    )

    if (profile === 'issue-30') {
      area1FilterState = await waitFor(
        () =>
          session.evaluate(`(() => {
            const content = document.querySelector(
              '.assist-workspace--secondary ' +
              '.workspace-panel[data-panel-name="missioncheck"] ' +
              '.mission-state-content'
            )
            const checkbox = content?.querySelector(
              '.filter-content input[type="checkbox"]'
            )
            if (!checkbox) {
              return null
            }
            const initiallyChecked = Boolean(checkbox.checked)
            if (!initiallyChecked) {
              checkbox.click()
            }
            return {
              initiallyChecked,
              temporarilyEnabled: !initiallyChecked
            }
          })()`),
        'the mission-check area 1 filter to become available',
        timeoutMs
      )
    }

    const result = await waitFor(
      () =>
        session.evaluate(`(() => {
          const workspace = document.querySelector('.assist-workspace--secondary')
          const active = workspace?.querySelector(
            '.workspace-page-tabs button[role="tab"][aria-selected="true"]'
          )
          const panel = workspace?.querySelector(
            '.workspace-panel[data-panel-name="missioncheck"]'
          )
          const body = panel?.querySelector('.workspace-panel-body')
          const content = body?.querySelector('.mission-state-content')
          const filterToggle = content?.querySelector('.mission-filter-toggle')
          const filterContent = content?.querySelector('.filter-content')
          const error = body?.querySelector(
            '.assist-panel-error[data-assist-panel="missioncheck"]'
          )
          if (
            active?.dataset.workspacePageId !== 'secondary-operations' ||
            !panel ||
            !body ||
            (!content && !error)
          ) {
            return null
          }

          const rectOf = (element) => {
            const rect = element?.getBoundingClientRect()
            return rect
              ? {
                  left: rect.left,
                  top: rect.top,
                  right: rect.right,
                  bottom: rect.bottom,
                  width: rect.width,
                  height: rect.height
                }
              : null
          }
          const visible = (element) => {
            const rect = element?.getBoundingClientRect()
            const style = element ? getComputedStyle(element) : null
            return Boolean(
              rect &&
                style &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0
            )
          }
          const rows = [...(content?.querySelectorAll('tbody tr') ?? [])].filter(visible)
          const missionNames = rows
            .map((row) => row.querySelector('.mission-name')?.textContent.trim())
            .filter(Boolean)

          if (!error && rows.length < 1) {
            return null
          }
          return {
            panel: rectOf(panel),
            body: rectOf(body),
            content: rectOf(content),
            filterToggle: rectOf(filterToggle),
            filterContent: rectOf(filterContent),
            hasExplicitError: Boolean(error),
            errorText: error?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
            rowCount: rows.length,
            missionNames
          }
        })()`),
      'the mission-check panel to render content or an explicit error',
      timeoutMs
    )

    const failure = missionCheckAcceptanceFailure(
      result,
      profile === 'fixture' ? '長距離練習航海' : undefined
    )
    if (failure) {
      throw new Error(failure)
    }

    await captureScreenshot(session, screenshotDirectory, `mission-check-${profile}`)
    return {
      ...result,
      profile,
      area1FilterInitiallyChecked: area1FilterState?.initiallyChecked ?? null,
      area1FilterTemporarilyEnabled: area1FilterState?.temporarilyEnabled ?? false,
      operationsPageInitiallyVisible: workspaceState.operationsPageInitiallyVisible,
      operationsPageTemporarilyRestored,
      missionPanelInitiallyVisible,
      missionPanelTemporarilyEnabled
    }
  } finally {
    if (area1FilterState?.temporarilyEnabled) {
      await session.evaluate(`(() => {
        const checkbox = document.querySelector(
          '.assist-workspace--secondary ' +
          '.workspace-panel[data-panel-name="missioncheck"] ' +
          '.mission-state-content .filter-content input[type="checkbox"]'
        )
        if (checkbox?.checked) {
          checkbox.click()
        }
      })()`)
      await waitFor(
        () =>
          session.evaluate(`(() => {
            const checkbox = document.querySelector(
              '.assist-workspace--secondary ' +
              '.workspace-panel[data-panel-name="missioncheck"] ' +
              '.mission-state-content .filter-content input[type="checkbox"]'
            )
            return checkbox ? !checkbox.checked : null
          })()`),
        'the mission-check area 1 filter to be restored',
        timeoutMs
      )
    }

    if (missionPanelTemporarilyEnabled) {
      await selectWorkspacePage(
        targetPageId,
        'the operations workspace page for mission-check panel restoration'
      )
      await setWorkspaceEditorOpen(true)
      await session.evaluate(`(() => {
        const checkbox = document.querySelector(
          '.assist-workspace--secondary .workspace-layout-editor ' +
          'li[data-layout-panel-name="missioncheck"] input[type="checkbox"]'
        )
        if (checkbox?.checked) {
          checkbox.click()
        }
      })()`)
      await setWorkspaceEditorOpen(false)
      await waitFor(
        () =>
          session.evaluate(`!document.querySelector(
            '.assist-workspace--secondary ' +
            '.workspace-panel[data-panel-name="missioncheck"]'
          )`),
        'the mission-check panel visibility to be restored',
        timeoutMs
      )
    }

    if (operationsPageTemporarilyRestored) {
      await selectWorkspacePage(targetPageId, 'the temporarily restored operations workspace page')
      await setWorkspaceEditorOpen(false)
      await session.evaluate(`(() => {
        const button = document.querySelector(
          '.assist-workspace--secondary .workspace-page-empty .is-danger'
        )
        if (!button || button.disabled) {
          return
        }
        const originalConfirm = window.confirm
        window.confirm = () => true
        try {
          button.click()
        } finally {
          window.confirm = originalConfirm
        }
      })()`)
      await waitFor(
        () =>
          session.evaluate(`!document.querySelector(
            '.assist-workspace--secondary .workspace-page-tabs ' +
            'button[data-workspace-page-id="secondary-operations"]'
          )`),
        'the hidden operations workspace page state to be restored',
        timeoutMs
      )
    }

    await selectWorkspacePage(
      workspaceState.previousPageId,
      'the previous workspace page after mission-check inspection'
    )
    if (workspaceState.editorInitiallyOpen) {
      await setWorkspaceEditorOpen(true)
    }
    await session.evaluate(`window.scrollTo(
      ${JSON.stringify(workspaceState.windowScrollX)},
      ${JSON.stringify(workspaceState.windowScrollY)}
    )`)
  }
}

async function inspectTitlebarColorFixture(session, timeoutMs, screenshotDirectory = undefined) {
  const workspaceState = await session.evaluate(`(() => {
    const navigation = document.querySelector(
      '.assist-workspace--secondary .workspace-page-tabs'
    )
    const active = navigation?.querySelector(
      'button[role="tab"][aria-selected="true"]'
    )
    return navigation && active
      ? { previousPageId: active.dataset.workspacePageId ?? null }
      : null
  })()`)
  if (!workspaceState) {
    throw new Error('The secondary workspace is unavailable for titlebar-color inspection')
  }

  const inspectColor = () =>
    session.evaluate(`(() => {
      const titlebar = document.querySelector('.titlebar')
      const select = document.querySelector(
        '.workspace-panel[data-panel-name="about"] .titlebar-color-select'
      )
      return titlebar && select
        ? {
            selectedColor: select.value,
            renderedColor: titlebar.dataset.titlebarColor ?? null,
            backgroundImage: getComputedStyle(titlebar).backgroundImage
          }
        : null
    })()`)

  let previousColor = 'green'
  try {
    await session.evaluate(`(() => {
      const navigation = document.querySelector(
        '.assist-workspace--secondary .workspace-page-tabs'
      )
      const dropTab = navigation?.querySelector(
        'button[data-workspace-page-id="secondary-drops"]'
      )
      dropTab?.click()
    })()`)
    const before = await waitFor(
      inspectColor,
      'the titlebar color setting on the drop workspace page',
      timeoutMs
    )
    previousColor = before.selectedColor

    await session.evaluate(`(() => {
      const select = document.querySelector(
        '.workspace-panel[data-panel-name="about"] .titlebar-color-select'
      )
      if (select) {
        select.value = 'graphite'
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })()`)
    const after = await waitFor(
      async () => {
        const value = await inspectColor()
        return value?.selectedColor === 'graphite' &&
          value.renderedColor === 'graphite' &&
          value.backgroundImage !== before.backgroundImage
          ? value
          : undefined
      },
      'the graphite titlebar palette to render',
      timeoutMs
    )

    await captureScreenshot(session, screenshotDirectory, 'titlebar-color-graphite')
    return { before, after }
  } finally {
    await session.evaluate(`(() => {
      const previousColor = ${JSON.stringify(previousColor)}
      const previousPageId = ${JSON.stringify(workspaceState.previousPageId)}
      const select = document.querySelector(
        '.workspace-panel[data-panel-name="about"] .titlebar-color-select'
      )
      if (select) {
        select.value = previousColor
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const navigation = document.querySelector(
        '.assist-workspace--secondary .workspace-page-tabs'
      )
      const previousTab = navigation?.querySelector(
        'button[data-workspace-page-id="' + CSS.escape(previousPageId) + '"]'
      )
      previousTab?.click()
    })()`)
    await waitFor(
      async () => {
        const state = await session.evaluate(`(() => {
          const expectedColor = ${JSON.stringify(previousColor)}
          const expectedPageId = ${JSON.stringify(workspaceState.previousPageId)}
          const titlebar = document.querySelector('.titlebar')
          const active = document.querySelector(
            '.assist-workspace--secondary .workspace-page-tabs ' +
            'button[role="tab"][aria-selected="true"]'
          )
          return (
            titlebar?.dataset.titlebarColor === expectedColor &&
            active?.dataset.workspacePageId === expectedPageId
          )
        })()`)
        return state ? true : undefined
      },
      'the titlebar color and workspace page to be restored',
      timeoutMs
    )
  }
}

async function inspectProxyFixture(session) {
  const controlSession = session.screenshotSession ?? session
  const result = await controlSession.call('Smoke.exerciseProxyFixture')
  const failure = proxyFixtureFailure(result)
  if (failure) {
    throw new Error(failure)
  }
  return result
}

async function inspectDataFolderFixture(session, timeoutMs) {
  const controlSession = session.screenshotSession ?? session
  const previousPageId = await session.evaluate(`(() => {
    const active = document.querySelector(
      '.assist-workspace--secondary .workspace-page-tabs ' +
        'button[role="tab"][aria-selected="true"]'
    )
    return active?.dataset.workspacePageId ?? null
  })()`)
  if (!previousPageId) {
    throw new Error('The active workspace page is unavailable before data-folder inspection')
  }

  try {
    await session.evaluate(`document.querySelector(
      '.assist-workspace--secondary ' +
        'button[data-workspace-page-id="secondary-drops"]'
    )?.click()`)
    await waitFor(
      () =>
        session.evaluate(`Boolean(document.querySelector(
          '.workspace-panel[data-panel-name="about"] .about-data-folder-button'
        ))`),
      'the data-folder action on the application information panel',
      timeoutMs
    )
    await session.evaluate(`document.querySelector(
      '.workspace-panel[data-panel-name="about"] .about-data-folder-button'
    )?.click()`)
    const rendererOpened = await waitFor(
      () =>
        session.evaluate(`[
          ...document.querySelectorAll(
            '.workspace-panel[data-panel-name="about"] .about-note'
          )
        ].some((element) =>
          element.textContent?.includes('データ保存先を開きました')
        )`),
      'the successful data-folder state in the renderer',
      timeoutMs
    )
    const result = {
      ...(await controlSession.call('Smoke.inspectDataFolderFixture')),
      rendererOpened
    }
    const failure = dataFolderFixtureFailure(result)
    if (failure) {
      throw new Error(failure)
    }
    return result
  } finally {
    await session.evaluate(`document.querySelector(
      '.assist-workspace--secondary ' +
        'button[data-workspace-page-id=${JSON.stringify(previousPageId)}]'
    )?.click()`)
    await waitFor(
      () =>
        session.evaluate(`document.querySelector(
          '.assist-workspace--secondary .workspace-page-tabs ' +
            'button[role="tab"][aria-selected="true"]'
        )?.dataset.workspacePageId === ${JSON.stringify(previousPageId)}`),
      'the previous workspace page after data-folder inspection',
      timeoutMs
    )
  }
}

async function readTitlebarCapacity(session) {
  return session.evaluate(`(() => {
    const rectOf = (element) => {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      }
    }
    const capacityOf = (element, dangerClass, warningClass) =>
      element
        ? {
            text: element.textContent?.trim() ?? '',
            title: element.getAttribute('title'),
            ariaLabel: element.getAttribute('aria-label'),
            danger: element.classList.contains(dangerClass),
            warning: warningClass ? element.classList.contains(warningClass) : false,
            textOverflow: element.scrollWidth > element.clientWidth + 1,
            rect: rectOf(element)
          }
        : null
    const titlebar = document.querySelector('.titlebar')
    const status = titlebar?.querySelector('.materials')
    const buttons = titlebar?.querySelector('.titlebar-buttons:not(.head)')
    return {
      titlebar: rectOf(titlebar),
      status: rectOf(status),
      buttons: rectOf(buttons),
      ship: capacityOf(
        titlebar?.querySelector('.titlebar-ship'),
        'ship-count-over',
        null
      ),
      slotitem: capacityOf(
        titlebar?.querySelector('.titlebar-slotitem'),
        'slotitem-count-over2',
        'slotitem-count-over1'
      )
    }
  })()`)
}

async function inspectTitlebarCapacityFixture(session, timeoutMs, screenshotDirectory = undefined) {
  let lastValue = null
  let result
  try {
    result = await waitFor(
      async () => {
        const value = await readTitlebarCapacity(session)
        lastValue = value
        return titlebarCapacityFailure(value) === null ? value : undefined
      },
      'the near-limit ship and equipment capacity titlebar display',
      timeoutMs
    )
  } catch (error) {
    throw new Error(
      `${error.message} Last observation: ${JSON.stringify(lastValue)}. ` +
        `Validation: ${titlebarCapacityFailure(lastValue)}`
    )
  }

  const failure = titlebarCapacityFailure(result)
  if (failure) {
    throw new Error(failure)
  }
  await captureScreenshot(session, screenshotDirectory, 'titlebar-capacity-fixture')
  return result
}

async function inspectCapacityBoundaryFixture(session, timeoutMs, screenshotDirectory = undefined) {
  const result = {}
  const controlSession = session.screenshotSession ?? session
  for (const mode of ['full', 'overflow']) {
    const expected = LayoutFixtureCapacityBoundaryExpectations[mode]
    const parser = await controlSession.call('Smoke.exerciseCapacityBoundaryFixture', { mode })
    let lastValue = null
    try {
      result[mode] = await waitFor(
        async () => {
          const value = {
            parser,
            renderer: await readTitlebarCapacity(session)
          }
          lastValue = value
          return capacityBoundaryFixtureFailure(value, expected) === null ? value : undefined
        },
        `the ${mode} ship and equipment capacity titlebar display`,
        timeoutMs,
        100
      )
      await captureScreenshot(session, screenshotDirectory, `titlebar-capacity-${mode}`)
    } catch (error) {
      throw new Error(
        `${error.message} Last observation: ${JSON.stringify(lastValue)}. ` +
          `Validation: ${capacityBoundaryFixtureFailure(lastValue, expected)}`
      )
    }
  }
  return result
}

async function inspectTransportFixture(session, timeoutMs, screenshotDirectory = undefined) {
  const workspaceState = await session.evaluate(`(() => {
    const navigation = document.querySelector(
      '.assist-workspace--secondary .workspace-page-tabs'
    )
    const active = navigation?.querySelector(
      'button[role="tab"][aria-selected="true"]'
    )
    return navigation && active
      ? { previousPageId: active.dataset.workspacePageId ?? null }
      : null
  })()`)
  if (!workspaceState?.previousPageId) {
    throw new Error('The secondary workspace is unavailable for transport inspection')
  }

  try {
    await session.evaluate(`document.querySelector(
      '.assist-workspace--secondary ' +
      'button[data-workspace-page-id="secondary-operations"]'
    )?.click()`)
    let lastValue = null
    const result = await waitFor(
      async () => {
        const value = await session.evaluate(`(() => {
          const rectOf = (element) => {
            const rect = element?.getBoundingClientRect()
            return rect
              ? {
                  left: rect.left,
                  top: rect.top,
                  right: rect.right,
                  bottom: rect.bottom,
                  width: rect.width,
                  height: rect.height
                }
              : null
          }
          const visible = (element) => {
            const rect = element?.getBoundingClientRect()
            const style = element ? getComputedStyle(element) : null
            return Boolean(
              rect &&
                style &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0
            )
          }
          const active = document.querySelector(
            '.assist-workspace--secondary .workspace-page-tabs ' +
            'button[role="tab"][aria-selected="true"]'
          )
          const panel = document.querySelector(
            '.workspace-panel[data-panel-name="deckport"]'
          )
          const body = panel?.querySelector('.workspace-panel-body')
          const root = body?.querySelector('.deck-port-root')
          const label = root?.querySelector('.yusou-value')
          const transport = label?.closest('.seiku')
          const ships = [...(root?.querySelectorAll('.deck .ship-container') ?? [])]
            .filter(visible)
          const viewport = root?.querySelector('.fixed-canvas-viewport')
          return {
            activePageId: active?.dataset.workspacePageId ?? null,
            panel: rectOf(panel),
            body: rectOf(body),
            header: rectOf(transport),
            viewport: rectOf(viewport),
            seventhShip: rectOf(ships[6]),
            label: label?.textContent?.trim() ?? null,
            value: transport?.querySelector('.txt')?.textContent?.trim() ?? null,
            title: label?.closest('[title]')?.getAttribute('title') ?? null,
            shipCount: ships.length,
            shipIds: ships.map((ship) => Number(ship.dataset.shipId))
          }
        })()`)
        lastValue = value
        return value.activePageId === 'secondary-operations' &&
          transportFixtureFailure(value) === null
          ? value
          : undefined
      },
      'the seven-ship transport value to render',
      timeoutMs,
      100
    )
    await captureScreenshot(session, screenshotDirectory, 'transport-seven-ship')
    return result
  } catch (error) {
    throw new Error(
      `${error.message} Last observation: ${JSON.stringify(lastValue)}. ` +
        `Validation: ${transportFixtureFailure(lastValue)}`
    )
  } finally {
    await session.evaluate(`(() => {
      const previousPageId = ${JSON.stringify(workspaceState.previousPageId)}
      document.querySelector(
        '.assist-workspace--secondary ' +
        'button[data-workspace-page-id="' + CSS.escape(previousPageId) + '"]'
      )?.click()
    })()`)
    await waitFor(
      () =>
        session.evaluate(`document.querySelector(
          '.assist-workspace--secondary .workspace-page-tabs ' +
          'button[role="tab"][aria-selected="true"]'
        )?.dataset.workspacePageId === ${JSON.stringify(workspaceState.previousPageId)}`),
      'the previous workspace page to be restored after transport inspection',
      timeoutMs,
      100
    )
  }
}

async function inspectBattleResultFixture(session, timeoutMs, screenshotDirectory = undefined) {
  const workspaceState = await session.evaluate(`(() => {
    const navigation = document.querySelector(
      '.assist-workspace--secondary .workspace-page-tabs'
    )
    const active = navigation?.querySelector(
      'button[role="tab"][aria-selected="true"]'
    )
    return navigation && active
      ? { previousPageId: active.dataset.workspacePageId ?? null }
      : null
  })()`)
  if (!workspaceState?.previousPageId) {
    throw new Error('The secondary workspace is unavailable for battle-result inspection')
  }

  const parserState = await (session.screenshotSession ?? session).call(
    'Smoke.exerciseBattleResultFixture'
  )
  let lastValue = null
  try {
    await session.evaluate(`document.querySelector(
      '.assist-workspace--secondary ' +
      'button[data-workspace-page-id="secondary-operations"]'
    )?.click()`)
    const result = await waitFor(
      async () => {
        const renderer = await session.evaluate(`(() => {
          const titlebar = document.querySelector('.titlebar')
          const ship = document.querySelector(
            '.workspace-panel[data-panel-name="deckport"] ' +
            '.ship-container[data-ship-id="1"]'
          )
          const gauge = ship?.querySelector('.ship-hp-gauge')
          const game = document.querySelector('.game-container')
          const protection = document.querySelector('.taiha-input-blocker')
          const protectionRect = protection?.getBoundingClientRect()
          const gameRect = game?.getBoundingClientRect()
          return {
            title: titlebar?.querySelector('.main-text')?.textContent?.trim() ?? null,
            warning: titlebar?.classList.contains('is-taiha-singeki') ?? false,
            shipId: Number(ship?.dataset.shipId ?? Number.NaN),
            nowHp: Number(gauge?.getAttribute('aria-valuenow') ?? Number.NaN),
            maxHp: Number(gauge?.getAttribute('aria-valuemax') ?? Number.NaN),
            hpState: [...(gauge?.classList ?? [])]
              .find((className) => className.startsWith('is-'))
              ?.slice(3) ?? null,
            game: gameRect
              ? {
                  left: gameRect.left,
                  top: gameRect.top,
                  right: gameRect.right,
                  bottom: gameRect.bottom
                }
              : null,
            protection: {
              role: protection?.getAttribute('role') ?? null,
              modal: protection?.getAttribute('aria-modal') ?? null,
              heading:
                protection?.querySelector('h2')?.textContent?.trim() ?? null,
              description:
                protection?.querySelector('p')?.textContent?.trim() ?? null,
              button:
                protection?.querySelector('button')?.textContent?.trim() ?? null,
              rect: protectionRect
                ? {
                    left: protectionRect.left,
                    top: protectionRect.top,
                    right: protectionRect.right,
                    bottom: protectionRect.bottom
                  }
                : null
            }
          }
        })()`)
        const value = { ...parserState, renderer }
        lastValue = value
        return battleResultFixtureFailure(value, false) === null ? value : undefined
      },
      'the battle-result HP, taiha warning, and input protection to render',
      timeoutMs,
      100
    )
    await captureScreenshot(session, screenshotDirectory, 'battle-result-taiha')
    result.renderer.protection.ordinaryClickBlocked = await session.evaluate(`(() => {
      const button = document.querySelector('.taiha-input-blocker button')
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return Boolean(document.querySelector('.taiha-input-blocker'))
    })()`)
    await session.evaluate(`document.querySelector('.taiha-input-blocker button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))`)
    result.renderer.protection.ctrlBypass = await waitFor(
      () => session.evaluate(`document.querySelector('.taiha-input-blocker') === null`),
      'Ctrl+click to release the taiha input protection',
      timeoutMs,
      100
    )
    const validation = battleResultFixtureFailure(result)
    if (validation) {
      throw new Error(validation)
    }
    return result
  } catch (error) {
    throw new Error(
      `${error.message} Last observation: ${JSON.stringify(lastValue)}. ` +
        `Validation: ${battleResultFixtureFailure(lastValue)}`
    )
  } finally {
    await session.evaluate(`(() => {
      const previousPageId = ${JSON.stringify(workspaceState.previousPageId)}
      document.querySelector(
        '.assist-workspace--secondary ' +
        'button[data-workspace-page-id="' + CSS.escape(previousPageId) + '"]'
      )?.click()
    })()`)
  }
}

async function listCapturePngFiles(directory) {
  try {
    return (await fsPromises.readdir(directory)).filter((filename) =>
      CaptureFilenamePattern.test(filename)
    )
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function inspectCaptureNoticeFixture(
  session,
  captureDirectory,
  defaultCaptureDirectory,
  timeoutMs,
  screenshotDirectory = undefined
) {
  if (!captureDirectory || !defaultCaptureDirectory) {
    throw new Error('Screenshot completion fixture requires configured capture directories')
  }
  const filesBefore = new Set(await listCapturePngFiles(captureDirectory))
  const defaultFilesBefore = new Set(await listCapturePngFiles(defaultCaptureDirectory))
  const app = await inspectApp(session)
  if (!app.game) {
    throw new Error('Screenshot completion fixture could not locate the game stage')
  }

  const button = await session.evaluate(`(() => {
    const element = document.querySelector('.titlebar-button.screenshot')
    if (!element) return null
    const result = {
      title: element.getAttribute('title'),
      ariaLabel: element.getAttribute('aria-label')
    }
    element.click()
    return result
  })()`)
  let lastNotice = null
  const notice = await waitFor(
    async () => {
      const value = await session.evaluate(`(() => {
        const element = document.querySelector('.capture-notice')
        if (!element) return null
        const rect = element.getBoundingClientRect()
        return {
          text: element.textContent?.trim() ?? '',
          role: element.getAttribute('role'),
          ariaLive: element.getAttribute('aria-live'),
          success: element.classList.contains('is-success'),
          rect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          }
        }
      })()`)
      lastNotice = value
      return value
    },
    'the screenshot completion notice',
    timeoutMs,
    100
  )
  const filename = notice.text.match(/\d{8}-\d{6}(?:-\d+)?\.png/)?.[0] ?? null
  const document = {
    left: 0,
    top: 0,
    right: app.document.clientWidth,
    bottom: app.document.clientHeight,
    width: app.document.clientWidth,
    height: app.document.clientHeight
  }
  const expectedPath =
    typeof filename === 'string' ? path.join(captureDirectory, filename) : undefined
  const file = await waitFor(
    async () => {
      const addedFiles = (await listCapturePngFiles(captureDirectory)).filter(
        (candidate) => !filesBefore.has(candidate)
      )
      if (typeof filename !== 'string' || !addedFiles.includes(filename) || !expectedPath) {
        return undefined
      }
      const buffer = await fsPromises.readFile(expectedPath)
      return {
        exists: true,
        filename,
        size: buffer.length,
        pngSignature: buffer.subarray(0, 8).toString('hex'),
        width: buffer.length >= 24 ? buffer.readUInt32BE(16) : null,
        height: buffer.length >= 24 ? buffer.readUInt32BE(20) : null
      }
    },
    'the screenshot PNG to be saved under isolated user data',
    timeoutMs,
    100
  )
  const result = {
    button,
    document,
    notice,
    filename,
    file,
    game: {
      width: app.game.width,
      height: app.game.height
    },
    customDirectory: path.resolve(captureDirectory) !== path.resolve(defaultCaptureDirectory),
    defaultDirectoryUnused: (await listCapturePngFiles(defaultCaptureDirectory)).every(
      (candidate) => defaultFilesBefore.has(candidate)
    )
  }
  const failure = captureNoticeFailure(result)
  if (failure) {
    throw new Error(`${failure}. Last notice: ${JSON.stringify(lastNotice)}`)
  }
  await captureScreenshot(session, screenshotDirectory, 'capture-completion-notice')
  return result
}

async function listRecordingFiles(directory) {
  try {
    return (await fsPromises.readdir(directory)).filter((filename) =>
      RecordingFilenamePattern.test(filename)
    )
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function inspectRecordingSaveFixture(
  session,
  captureDirectory,
  defaultCaptureDirectory,
  timeoutMs,
  screenshotDirectory = undefined
) {
  if (!captureDirectory || !defaultCaptureDirectory) {
    throw new Error('Recording save fixture requires configured capture directories')
  }
  const filesBefore = new Set(await listRecordingFiles(captureDirectory))
  const defaultFilesBefore = new Set(await listRecordingFiles(defaultCaptureDirectory))
  const previousNoticeText = await session
    .evaluate(`document.querySelector('.capture-notice')?.textContent?.trim() ?? null`)
    .catch(() => null)
  const recordingSource = await inspectRecordingSource(session)
  const noticeOf = () =>
    session.evaluate(`(() => {
      const element = document.querySelector('.capture-notice')
      return element
        ? {
            text: element.textContent?.trim() ?? '',
            role: element.getAttribute('role'),
            ariaLive: element.getAttribute('aria-live'),
            success: element.classList.contains('is-success')
          }
        : null
    })()`)
  let recordingStarted = false
  try {
    const button = await session.evaluate(`(() => {
      const element = document.querySelector('.titlebar-button.rec')
      if (!element) return null
      const result = {
        startTitle: element.getAttribute('title'),
        startAriaLabel: element.getAttribute('aria-label')
      }
      element.click()
      return result
    })()`)
    const startedState = await waitFor(
      async () => {
        const state = await session.evaluate(`(() => {
          const element = document.querySelector('.titlebar-button.rec')
          return element
            ? {
                checked: element.classList.contains('checked'),
                title: element.getAttribute('title'),
                ariaLabel: element.getAttribute('aria-label')
              }
            : null
        })()`)
        const notice = await noticeOf()
        return state?.checked && notice?.success && notice.text !== previousNoticeText
          ? { state, notice }
          : undefined
      },
      'game-only recording to start',
      timeoutMs,
      100
    )
    recordingStarted = true
    await delay(700)
    await captureScreenshot(session, screenshotDirectory, 'recording-started')
    await session.evaluate(`document.querySelector('.titlebar-button.rec')?.click()`)
    const stoppedState = await waitFor(
      async () => {
        const state = await session.evaluate(`(() => {
          const element = document.querySelector('.titlebar-button.rec')
          return element
            ? {
                checked: element.classList.contains('checked'),
                title: element.getAttribute('title'),
                ariaLabel: element.getAttribute('aria-label')
              }
            : null
        })()`)
        const notice = await noticeOf()
        return state &&
          !state.checked &&
          notice?.success &&
          notice.text !== startedState.notice.text
          ? { state, notice }
          : undefined
      },
      'game-only recording to stop',
      timeoutMs,
      100
    )
    recordingStarted = false

    let lastSize = -1
    let stableObservations = 0
    const file = await waitFor(
      async () => {
        const addedFiles = (await listRecordingFiles(captureDirectory)).filter(
          (candidate) => !filesBefore.has(candidate)
        )
        if (addedFiles.length !== 1) {
          return undefined
        }
        const filename = addedFiles[0]
        const filepath = path.join(captureDirectory, filename)
        const stat = await fsPromises.stat(filepath)
        if (stat.size === lastSize) {
          stableObservations += 1
        } else {
          lastSize = stat.size
          stableObservations = 0
        }
        if (stableObservations < 2 || stat.size <= 100) {
          return undefined
        }
        const buffer = await fsPromises.readFile(filepath)
        return {
          exists: true,
          filename,
          size: buffer.length,
          webmSignature: buffer.subarray(0, 4).toString('hex')
        }
      },
      'the game-only WebM to finish writing under the custom directory',
      timeoutMs,
      100
    )
    const result = {
      button: {
        ...button,
        checkedWhileRecording: startedState.state.checked,
        checkedAfterStop: stoppedState.state.checked
      },
      startedNotice: startedState.notice,
      stoppedNotice: stoppedState.notice,
      filename: file.filename,
      file,
      recordingSource,
      customDirectory: path.resolve(captureDirectory) !== path.resolve(defaultCaptureDirectory),
      defaultDirectoryUnused: (await listRecordingFiles(defaultCaptureDirectory)).every(
        (candidate) => defaultFilesBefore.has(candidate)
      )
    }
    const failure = recordingSaveFailure(result)
    if (failure) {
      throw new Error(failure)
    }
    return result
  } finally {
    if (recordingStarted) {
      await session
        .evaluate(`document.querySelector('.titlebar-button.rec.checked')?.click()`)
        .catch(() => undefined)
    }
  }
}

async function inspectHpGaugeFixture(session, timeoutMs, screenshotDirectory = undefined) {
  await session.evaluate(`document.body.classList.add('is-layout-hp-gauge-fixture-visible')`)
  try {
    const result = await waitFor(
      () =>
        session.evaluate(`(() => {
          const fixture = document.querySelector('.layout-hp-gauge-fixture')
          const deck = fixture?.querySelector('.deck-ship-imgs')
          const probe = fixture?.querySelector('.layout-hp-gauge-status-probe')
          const ships = Array.from(
            fixture?.querySelectorAll('[data-fixture-ship-index]') ?? []
          )
          const rect = (element) => {
            const value = element?.getBoundingClientRect()
            return value
              ? {
                  left: value.left,
                  top: value.top,
                  right: value.right,
                  bottom: value.bottom,
                  width: value.width,
                  height: value.height
                }
              : null
          }
          const states = ['normal', 'syouha', 'tyuuha', 'taiha']
          return fixture && deck && probe
            ? {
                visible: getComputedStyle(fixture).display !== 'none',
                fixture: rect(fixture),
                deck: rect(deck),
                probe: rect(probe),
                ships: ships.map((ship) => {
                  const meter = ship.querySelector('[role="meter"]')
                  return {
                    index: Number(ship.dataset.fixtureShipIndex),
                    rect: rect(ship),
                    meter: {
                      rect: rect(meter),
                      state: states.find((state) =>
                        meter?.classList.contains('is-' + state)
                      ) ?? null,
                      min: Number(meter?.getAttribute('aria-valuemin')),
                      max: Number(meter?.getAttribute('aria-valuemax')),
                      now: Number(meter?.getAttribute('aria-valuenow')),
                      valueText: meter?.getAttribute('aria-valuetext') ?? null,
                      label: meter?.getAttribute('aria-label') ?? null
                    }
                  }
                })
              }
            : null
        })()`),
      'the seven-ship HP gauge fixture',
      timeoutMs
    )
    const expectedStates = ['normal', 'normal', 'syouha', 'tyuuha', 'taiha', 'taiha', 'taiha']
    if (!result.visible || result.ships.length !== 7) {
      throw new Error(`HP gauge fixture did not render seven ships: ${JSON.stringify(result)}`)
    }
    for (const [index, ship] of result.ships.entries()) {
      if (
        ship.index !== index + 1 ||
        ship.meter.state !== expectedStates[index] ||
        !ship.rect ||
        !ship.meter.rect ||
        !rectIsContained(ship.rect, ship.meter.rect) ||
        ship.meter.min !== 0 ||
        ship.meter.max !== 40 ||
        ship.meter.now < ship.meter.min ||
        ship.meter.now > ship.meter.max ||
        !ship.meter.valueText ||
        !ship.meter.label
      ) {
        throw new Error(`Invalid HP meter at ship ${index + 1}: ${JSON.stringify(ship)}`)
      }
    }
    const firstRowTop = result.ships[0].rect.top
    const secondRowTop = result.ships[3].rect.top
    const thirdRowTop = result.ships[6].rect.top
    if (
      Math.abs(secondRowTop - firstRowTop - 50) > 1 ||
      Math.abs(thirdRowTop - firstRowTop - 100) > 1
    ) {
      throw new Error(`Seven-ship grid rows are misaligned: ${JSON.stringify(result.ships)}`)
    }
    if (!result.probe || result.probe.top < result.ships[6].rect.bottom - 1) {
      throw new Error(`Seventh ship overlaps the status area: ${JSON.stringify(result)}`)
    }

    await captureScreenshot(session, screenshotDirectory, 'hp-gauge-seven-ships')
    return {
      ...result,
      states: [...new Set(result.ships.map((ship) => ship.meter.state))],
      firstRowTop,
      thirdRowTop,
      rowGap: thirdRowTop - firstRowTop,
      statusClearance: result.probe.top - result.ships[6].rect.bottom
    }
  } finally {
    await session.evaluate(`document.body.classList.remove('is-layout-hp-gauge-fixture-visible')`)
  }
}

async function dispatchControlKey(session, key, code, windowsVirtualKeyCode, shift = false) {
  const modifiers = 2 | (shift ? 8 : 0)
  const params = {
    modifiers,
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode
  }
  await session.call('Input.dispatchKeyEvent', {
    ...params,
    type: 'keyDown'
  })
  await session.call('Input.dispatchKeyEvent', {
    ...params,
    type: 'keyUp'
  })
}

async function inspectGameZoomShortcutPolicy(
  session,
  gameSession,
  timeoutMs,
  screenshotDirectory = undefined
) {
  const inspectZoom = () =>
    session.evaluate(`(() => {
      const webview = document.querySelector('#kb')
      const rect = webview?.getBoundingClientRect()
      return {
        surface: document.querySelector('.main-root')?.dataset.layoutSurface ?? null,
        factor: webview?.getZoomFactor() ?? null,
        width: rect?.width ?? null,
        height: rect?.height ?? null,
        documentOverflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ||
          document.documentElement.scrollHeight > document.documentElement.clientHeight + 1
      }
    })()`)

  try {
    await gameSession.call('Runtime.enable')
    await session.evaluate(`window.api.toggleLayoutMode()`)
    await waitFor(
      async () => {
        const app = await inspectApp(session)
        return app.surface === 'classic-combined' ? app : undefined
      },
      'classic layout before the zoom-reset regression',
      timeoutMs
    )
    await session.evaluate(`window.api.hideAssist()`)
    await waitFor(
      async () => {
        const value = await inspectZoom()
        const expectedHeight = Number.isFinite(value.width)
          ? Math.floor((value.width * WorkspaceGameHeight) / WorkspaceGameWidth)
          : null
        const expectedFactor = Number.isFinite(value.width)
          ? value.width / WorkspaceGameWidth
          : null
        return value.surface === 'game-only' &&
          Number.isFinite(value.width) &&
          Number.isFinite(value.height) &&
          Number.isFinite(value.factor) &&
          Math.abs(value.height - expectedHeight) <= 1 &&
          Math.abs(value.factor - expectedFactor) <= 0.001
          ? value
          : undefined
      },
      'settled game-only layout for the zoom-reset regression',
      timeoutMs
    )
    const resizeSweep = []
    for (const step of GameOnlyResizeSweepSteps) {
      await session.evaluate(`window.resizeTo(${step.requestedWidth}, ${step.requestedHeight})`)
      const actual = await waitFor(
        async () => {
          const value = await inspectZoom()
          return gameOnlyZoomStateMatches(value, step) ? value : undefined
        },
        `game-only resize ${step.requestedWidth}x${step.requestedHeight} to settle at ${step.width}x${step.height}`,
        timeoutMs
      )
      resizeSweep.push({
        requested: {
          width: step.requestedWidth,
          height: step.requestedHeight
        },
        actual
      })
    }
    const before = resizeSweep.at(-1).actual
    const expectedZoomState = GameOnlyResizeSweepSteps.at(-1)

    await session.evaluate(`document.querySelector('#kb')?.focus()`)
    await dispatchControlKey(gameSession, '0', 'Digit0', 48)
    const afterReset = await waitFor(
      async () => {
        const value = await inspectZoom()
        return gameOnlyZoomStateMatches(value, expectedZoomState) ? value : undefined
      },
      'Ctrl+0 to preserve the application-owned game zoom and geometry',
      timeoutMs
    )
    await dispatchControlKey(gameSession, '+', 'Equal', 187, true)
    const afterZoomIn = await waitFor(
      async () => {
        const value = await inspectZoom()
        return gameOnlyZoomStateMatches(value, expectedZoomState) ? value : undefined
      },
      'Ctrl++ to preserve the application-owned game zoom and geometry',
      timeoutMs
    )
    await captureScreenshot(session, screenshotDirectory, 'zoom-reset-game-only')

    return {
      before,
      afterReset,
      afterZoomIn,
      resizeSweep,
      preservedFactor: before.factor
    }
  } finally {
    gameSession.close()
    const surface = (await inspectApp(session).catch(() => null))?.surface
    if (surface === 'game-only') {
      await session.evaluate(`window.api.showAssist()`)
      await waitFor(
        async () => {
          const app = await inspectApp(session)
          return app.surface === 'classic-combined' ? app : undefined
        },
        'classic layout after the zoom-reset regression',
        timeoutMs
      )
    }
    const restoredSurface = (await inspectApp(session).catch(() => null))?.surface
    if (restoredSurface === 'classic-combined') {
      await session.evaluate(`window.api.toggleLayoutMode()`)
      await waitFor(
        async () => {
          const app = await inspectApp(session)
          return app.surface === 'workspace' ? app : undefined
        },
        'workspace restoration after the zoom-reset regression',
        timeoutMs
      )
    }
    const finalSurface = (await inspectApp(session).catch(() => null))?.surface
    if (finalSurface === 'workspace') {
      await session.evaluate(`new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setTimeout(resolve, 200))
        })
      })`)
      await waitFor(
        () =>
          session.evaluate(`(() => {
            const workspace = document.querySelector(
              '.assist-workspace--secondary'
            )
            const active = workspace?.querySelector(
              '.workspace-page-tabs button[role="tab"][aria-selected="true"]'
            )
            const panels = workspace?.querySelectorAll(
              '.workspace-page-grid > .workspace-panel'
            )
            return Boolean(active && panels && panels.length > 0)
          })()`),
        'workspace panels after the zoom-reset regression',
        timeoutMs
      )
    }
  }
}

async function inspectMuteReloadPolicy(session, timeoutMs) {
  const inspectMute = () =>
    session.evaluate(`(() => {
      const webview = document.querySelector('#kb')
      let muted = null
      try {
        muted = webview?.isAudioMuted() ?? null
      } catch {
        muted = null
      }
      return {
        timeOrigin: performance.timeOrigin,
        ready: Boolean(
          document.querySelector('.workspace-primary.is-app-ready') &&
          document.querySelector('.assist-workspace--secondary')
        ),
        muted
      }
    })()`)

  const initial = await waitFor(
    async () => {
      const value = await inspectMute()
      return typeof value.muted === 'boolean' && value.ready ? value : undefined
    },
    'the initial game mute state',
    timeoutMs
  )

  if (!initial.muted) {
    await session.evaluate(`document.querySelector('.titlebar-button.soundonoff')?.click()`)
    await waitFor(
      async () => {
        const value = await inspectMute()
        return muteReloadStateMatches(value, true) ? value : undefined
      },
      'the game webview to become muted',
      timeoutMs
    )
  }

  const beforeReload = await inspectMute()
  await session.evaluate(`window.api.reload()`)
  const afterReload = await waitFor(
    async () => {
      const value = await inspectMute()
      return muteReloadStateMatches(value, true, beforeReload.timeOrigin) ? value : undefined
    },
    'the muted game state after application reload',
    timeoutMs
  )

  if (!initial.muted) {
    await session.evaluate(`document.querySelector('.titlebar-button.soundonoff')?.click()`)
    await waitFor(
      async () => {
        const value = await inspectMute()
        return muteReloadStateMatches(value, false) ? value : undefined
      },
      'the original unmuted game state to be restored',
      timeoutMs
    )
  }

  const restored = await inspectMute()
  if (restored.muted !== initial.muted) {
    throw new Error(
      `The original mute state was not restored: ${JSON.stringify({ initial, restored })}`
    )
  }

  return {
    initialMuted: initial.muted,
    mutedBeforeReload: beforeReload.muted,
    mutedAfterReload: afterReload.muted,
    reloaded: afterReload.timeOrigin !== beforeReload.timeOrigin,
    restoredMuted: restored.muted
  }
}

async function inspectRecordingSource(session) {
  const source = await session.evaluate('window.api.getRecordingSource()')
  const validTarget = source?.target === 'game' || source?.target === 'window'
  const validMediaSource =
    (source?.target === 'game' && source?.mediaSource === 'tab') ||
    (source?.target === 'window' && source?.mediaSource === 'desktop')
  const validSize =
    Number.isFinite(source?.width) &&
    source.width > 0 &&
    Number.isFinite(source?.height) &&
    source.height > 0
  const validGameSize =
    source?.target !== 'game' || (source.width === 1200 && source.height === 720)
  if (
    !validTarget ||
    !validMediaSource ||
    !validSize ||
    !validGameSize ||
    typeof source.id !== 'string' ||
    source.id.length === 0
  ) {
    throw new Error(`Invalid recording source: ${JSON.stringify(source)}`)
  }
  return {
    target: source.target,
    mediaSource: source.mediaSource,
    width: source.width,
    height: source.height,
    idPresent: true
  }
}

async function inspectRecordingTracks(session) {
  const tracks = await session.evaluate(`(async () => {
    const source = await window.api.getRecordingSource()
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: source.mediaSource,
            chromeMediaSourceId: source.id
          }
        },
        video: {
          mandatory: {
            chromeMediaSource: source.mediaSource,
            chromeMediaSourceId: source.id,
            minWidth: source.width,
            maxWidth: source.width,
            minHeight: source.height,
            maxHeight: source.height
          }
        }
      })
      const audioTrack = stream.getAudioTracks()[0]
      const videoTrack = stream.getVideoTracks()[0]
      const settings = videoTrack?.getSettings() ?? {}
      return {
        active: stream.active,
        audio: {
          kind: audioTrack?.kind ?? null,
          readyState: audioTrack?.readyState ?? null
        },
        video: {
          kind: videoTrack?.kind ?? null,
          readyState: videoTrack?.readyState ?? null,
          width: settings.width ?? null,
          height: settings.height ?? null
        }
      }
    } finally {
      for (const mediaTrack of stream?.getTracks() ?? []) {
        mediaTrack.stop()
      }
    }
  })()`)
  if (
    tracks?.active !== true ||
    tracks.audio?.kind !== 'audio' ||
    tracks.audio?.readyState !== 'live' ||
    tracks.video?.kind !== 'video' ||
    tracks.video?.readyState !== 'live' ||
    !Number.isFinite(tracks.video?.width) ||
    tracks.video.width <= 0 ||
    !Number.isFinite(tracks.video?.height) ||
    tracks.video.height <= 0
  ) {
    throw new Error(`Invalid recording media tracks: ${JSON.stringify(tracks)}`)
  }
  return tracks
}

async function inspectFixtureRecordingSources(session, timeoutMs) {
  const optionData = await session.evaluate(
    `window.electron.ipcRenderer.invoke('option:get-current-setting')`
  )
  const originalSetting = optionData?.setting
  if (!originalSetting || typeof originalSetting !== 'object') {
    throw new Error('The isolated recording settings are unavailable')
  }
  const originalTarget = originalSetting.recordingTarget === 'game' ? 'game' : 'window'
  const sources = {}
  try {
    for (const target of ['window', 'game']) {
      await session.evaluate(`window.electron.ipcRenderer.invoke(
        'option:save-setting',
        {
          ...${JSON.stringify(originalSetting)},
          recordingTarget: ${JSON.stringify(target)}
        }
      )`)
      const source = await waitFor(
        async () => {
          const source = await inspectRecordingSource(session).catch(() => undefined)
          return source?.target === target ? source : undefined
        },
        `the ${target} recording source`,
        timeoutMs,
        100
      )
      sources[target] = {
        ...source,
        tracks: await inspectRecordingTracks(session)
      }
    }
  } finally {
    await session.evaluate(`window.electron.ipcRenderer.invoke(
      'option:save-setting',
      ${JSON.stringify(originalSetting)}
    )`)
    await waitFor(
      async () => {
        const source = await inspectRecordingSource(session).catch(() => undefined)
        return source?.target === originalTarget ? source : undefined
      },
      'the original recording target to be restored',
      timeoutMs,
      100
    )
  }
  return sources
}

async function waitForStableAppSize(session, width, height, description, timeoutMs) {
  let consecutiveMatches = 0
  return waitFor(
    async () => {
      const snapshot = await inspectApp(session)
      if (
        Math.abs(snapshot.document.clientWidth - width) <= 1 &&
        Math.abs(snapshot.document.clientHeight - height) <= 1
      ) {
        consecutiveMatches += 1
        return consecutiveMatches >= 3 ? snapshot : undefined
      }
      consecutiveMatches = 0
      return undefined
    },
    description,
    timeoutMs,
    300
  )
}

async function inspectGamePage(session) {
  return session.evaluate(`(() => {
      const element = document.querySelector('#game_frame')
      const rect = element?.getBoundingClientRect()
      const source = element?.getAttribute('src')
      let safeFrameSource = null
      if (source) {
        try {
          const parsed = new URL(source, location.href)
          safeFrameSource = parsed.origin + parsed.pathname
        } catch {
          safeFrameSource = 'unparseable'
        }
      }
      return {
        href: location.href,
        title: document.title,
        readyState: document.readyState,
        frame: rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : null,
        frameTag: element?.tagName ?? null,
        frameSource: safeFrameSource,
        canvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
          width: canvas.width,
          height: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight
        }))
      }
    })()`)
}

function gamePageStage(result) {
  const href = result?.href ?? ''
  if (href.startsWith('https://accounts.dmm.com/')) {
    return 'login-required'
  }
  if (
    href.startsWith('https://www.dmm.com/netgame/feature/kancolle') ||
    href.startsWith('https://games.dmm.com/detail/kancolle')
  ) {
    return 'dmm-game-page'
  }
  if (href.startsWith('chrome-error://')) {
    return 'load-error'
  }
  if (href.startsWith('https://play.games.dmm.com/game/kancolle')) {
    if (result?.title === 'Now loading...') {
      return 'game-loading'
    }
    if (
      result?.frame &&
      Math.abs(result.frame.width - 1200) <= 1 &&
      Math.abs(result.frame.height - 720) <= 1
    ) {
      return 'game-start'
    }
    return 'play-page'
  }
  if ((result?.canvases?.length ?? 0) > 0) {
    return 'game-content'
  }
  return 'unknown'
}

function gamePageStageMessage(stage) {
  const messages = {
    'login-required': 'DMM login is required in the visible smoke window',
    'dmm-game-page': 'open or continue KanColle from the visible DMM page',
    'load-error': 'the DMM game page failed to load',
    'game-start': 'click GAME START once in the visible smoke window',
    'game-loading': 'the game is loading',
    'play-page': 'waiting for the DMM game surface',
    'game-content': 'the game content is loading account data',
    unknown: 'waiting for the game webview'
  }
  return messages[stage] ?? messages.unknown
}

function gamePageFailure(result) {
  if (result?.href?.startsWith('chrome-error://')) {
    return 'The DMM game page failed to load in Chromium.'
  }
  if (result?.href?.startsWith('https://accounts.dmm.com/')) {
    return 'DMM login is required. Use --manual-game-start and log in inside the smoke window.'
  }
  if (
    result?.readyState === 'complete' &&
    (result.href?.startsWith('https://games.dmm.com/detail/kancolle') ||
      result.href?.startsWith('https://www.dmm.com/netgame/feature/kancolle'))
  ) {
    return 'DMM opened the public KanColle detail page instead of the signed-in play surface.'
  }
  return null
}

async function waitForManualGameData(appSession, gameSession, timeoutMs, progress) {
  return waitFor(
    async () => {
      const app = await inspectApp(appSession)
      if (app.ready) {
        progress('account-data-ready', 'game and account-scoped data are ready')
        return app
      }
      const game = await inspectGamePage(gameSession).catch(() => null)
      const stage = gamePageStage(game)
      progress(stage, gamePageStageMessage(stage))
      return undefined
    },
    'account-scoped game data after manual login and GAME START',
    timeoutMs
  )
}

async function clickGameStart(session, timeoutMs) {
  const inspectFrame = () => inspectGamePage(session)
  const isExpectedFrame = (result) =>
    result.href.startsWith('https://play.games.dmm.com/game/kancolle') &&
    result.frame &&
    Math.abs(result.frame.width - 1200) <= 1 &&
    Math.abs(result.frame.height - 720) <= 1

  await waitFor(
    async () => {
      const result = await inspectFrame()
      const failure = gamePageFailure(result)
      if (failure) {
        const error = new Error(failure)
        error.fatal = true
        throw error
      }
      return isExpectedFrame(result) ? result : undefined
    },
    'the verified 1200 x 720 DMM GAME START surface',
    timeoutMs
  )
  await delay(GameStartSettleMs)
  const settledFrame = await inspectFrame()
  const settledFailure = gamePageFailure(settledFrame)
  if (settledFailure) {
    throw new Error(settledFailure)
  }
  if (!isExpectedFrame(settledFrame)) {
    throw new Error('The DMM game frame changed while settling; refusing to click.')
  }
  await session.call('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...GameStartPoint,
    button: 'left',
    clickCount: 1
  })
  await session.call('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...GameStartPoint,
    button: 'left',
    clickCount: 1
  })
}

async function inspectWorkspacePages(
  session,
  timeoutMs,
  expectedDocument = undefined,
  screenshotDirectory = undefined,
  screenshotPrefix = 'workspace'
) {
  const workspaceState = await session.evaluate(`(() => {
    const navigation = document.querySelector(
      '.assist-workspace--secondary .workspace-page-tabs'
    )
    const active = navigation?.querySelector(
      'button[role="tab"][aria-selected="true"]'
    )
    const pages = [...(navigation?.querySelectorAll('button[role="tab"]') ?? [])]
      .map((button) => button.textContent.trim())
      .filter(Boolean)
    return navigation && active && pages.length > 0
      ? { previousPage: active.textContent.trim(), pages }
      : null
  })()`)
  if (!workspaceState) {
    throw new Error('The secondary workspace pages are unavailable')
  }

  const pageResults = []
  try {
    for (const pageLabel of workspaceState.pages) {
      await session.evaluate(`(() => {
        const pageLabel = ${JSON.stringify(pageLabel)}
        const navigation = document.querySelector(
          '.assist-workspace--secondary .workspace-page-tabs'
        )
        const button = [
          ...(navigation?.querySelectorAll('button[role="tab"]') ?? [])
        ].find((candidate) => candidate.textContent.trim() === pageLabel)
        button?.click()
      })()`)

      const pageResult = await waitFor(
        async () => {
          const result = await session.evaluate(`(() => {
            const expectedPage = ${JSON.stringify(pageLabel)}
            const workspace = document.querySelector(
              '.assist-workspace--secondary'
            )
            const navigation = workspace?.querySelector('.workspace-page-tabs')
            const active = navigation?.querySelector(
              'button[role="tab"][aria-selected="true"]'
            )
            const grid = workspace?.querySelector('.workspace-page-grid')
            const panels = [...(grid?.querySelectorAll(':scope > .workspace-panel') ?? [])]
            if (
              !workspace ||
              !navigation ||
              !grid ||
              active?.textContent.trim() !== expectedPage ||
              panels.length === 0
            ) {
              return null
            }

            const rectOf = (element) => {
              const rect = element.getBoundingClientRect()
              return {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
              }
            }
            const visible = (element) => {
              const rect = element.getBoundingClientRect()
              const style = getComputedStyle(element)
              return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0
              )
            }
            const root = document.documentElement
            const battleScoreRoot = grid.querySelector('.battlescore-root')
            const battleScoreControls = battleScoreRoot
              ? [
                  ['period', battleScoreRoot.querySelector('.period-select-dropdown')],
                  ['forecast', battleScoreRoot.querySelector('.forecast-score-button')],
                  ['inherited', battleScoreRoot.querySelector('.input-inherit-score-button')]
                ]
                  .filter(([, element]) => element && visible(element))
                  .map(([name, element]) => ({ name, rect: rectOf(element) }))
              : []
            const pagination = [
              ...grid.querySelectorAll('.pagination, .quest-guide-pagination')
            ]
              .filter(visible)
              .map((element) => {
                const panel = element.closest('.workspace-panel')
                const body = panel?.querySelector('.workspace-panel-body')
                const scrollPositions = []
                let ancestor = element.parentElement
                while (ancestor) {
                  scrollPositions.push({
                    element: ancestor,
                    left: ancestor.scrollLeft,
                    top: ancestor.scrollTop
                  })
                  ancestor = ancestor.parentElement
                }
                element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
                const rect = rectOf(element)
                const bodyRect = body ? rectOf(body) : null
                const reachable =
                  bodyRect !== null &&
                  rect.left >= bodyRect.left - 1 &&
                  rect.top >= bodyRect.top - 1 &&
                  rect.right <= bodyRect.right + 1 &&
                  rect.bottom <= bodyRect.bottom + 1
                const scrollContainers = scrollPositions
                  .map(({ element: ancestorElement }) => {
                    const style = getComputedStyle(ancestorElement)
                    return {
                      className: ancestorElement.className,
                      clientHeight: ancestorElement.clientHeight,
                      scrollHeight: ancestorElement.scrollHeight,
                      scrollTop: ancestorElement.scrollTop,
                      overflowY: style.overflowY
                    }
                  })
                  .filter(
                    (ancestor) =>
                      ancestor.scrollHeight > ancestor.clientHeight + 1 ||
                      ancestor.overflowY !== 'visible'
                  )
                for (const position of scrollPositions) {
                  position.element.scrollLeft = position.left
                  position.element.scrollTop = position.top
                }
                return {
                  panelName: panel?.dataset.panelName ?? null,
                  reachable,
                  rect,
                  bodyRect,
                  scrollContainers
                }
              })

            return {
              label: expectedPage,
              pageId: grid.dataset.workspacePage ?? null,
              document: {
                clientWidth: root.clientWidth,
                scrollWidth: root.scrollWidth,
                clientHeight: root.clientHeight,
                scrollHeight: root.scrollHeight
              },
              viewport: {
                left: 0,
                top: 0,
                right: root.clientWidth,
                bottom: root.clientHeight,
                width: root.clientWidth,
                height: root.clientHeight
              },
              workspace: rectOf(workspace),
              navigation: rectOf(navigation),
              tabs: [
                ...navigation.querySelectorAll('button[role="tab"]')
              ].map((button) => ({
                label: button.textContent.trim(),
                rect: rectOf(button)
              })),
              grid: rectOf(grid),
              loadingOverlayCount: [
                ...grid.querySelectorAll('.loading-overlay')
              ].filter(visible).length,
              battleScoreControls,
              panels: panels.map((panel) => {
                const body = panel.querySelector('.workspace-panel-body')
                return {
                  name: panel.dataset.panelName ?? null,
                  layoutKind: panel.dataset.layoutKind ?? null,
                  rect: rectOf(panel),
                  body: body
                    ? {
                        rect: rectOf(body),
                        clientWidth: body.clientWidth,
                        scrollWidth: body.scrollWidth,
                        clientHeight: body.clientHeight,
                        scrollHeight: body.scrollHeight
                      }
                    : null
                }
              }),
              pagination
            }
          })()`)
          const expectedPages = workspaceState.pages
          const pagesAreStable =
            result?.tabs.map((tab) => tab.label).join('|') === expectedPages.join('|')
          const documentIsStable =
            !expectedDocument ||
            (Math.abs(result.document.clientWidth - expectedDocument.clientWidth) <= 1 &&
              Math.abs(result.document.clientHeight - expectedDocument.clientHeight) <= 1)
          return result?.loadingOverlayCount === 0 && pagesAreStable && documentIsStable
            ? result
            : undefined
        },
        `workspace page ${pageLabel}`,
        timeoutMs
      )

      if (!metricsAreContained(pageResult.document)) {
        throw new Error(
          `Workspace page ${pageLabel} overflowed the document: ` +
            JSON.stringify(pageResult.document)
        )
      }
      if (
        !rectIsContained(pageResult.viewport, pageResult.workspace) ||
        !rectIsContained(pageResult.workspace, pageResult.navigation) ||
        !rectIsContained(pageResult.workspace, pageResult.grid)
      ) {
        throw new Error(
          `Workspace page ${pageLabel} escaped its viewport: ` + JSON.stringify(pageResult)
        )
      }
      const unreachableTabs = pageResult.tabs.filter(
        (tab) => !rectIsContained(pageResult.navigation, tab.rect)
      )
      if (unreachableTabs.length > 0) {
        throw new Error(
          `Workspace page ${pageLabel} has clipped tabs: ` + JSON.stringify(unreachableTabs)
        )
      }
      const escapedPanels = pageResult.panels.filter(
        (panel) =>
          !rectIsContained(pageResult.grid, panel.rect) ||
          !rectIsContained(pageResult.viewport, panel.rect) ||
          (panel.body && !rectIsContained(panel.rect, panel.body.rect))
      )
      if (escapedPanels.length > 0) {
        throw new Error(
          `Workspace page ${pageLabel} has escaped panels: ` + JSON.stringify(escapedPanels)
        )
      }
      const overflowingFlowPanels = pageResult.panels.filter(
        (panel) =>
          panel.layoutKind === 'flow' &&
          panel.body &&
          panel.body.scrollWidth > panel.body.clientWidth + 1
      )
      if (overflowingFlowPanels.length > 0) {
        throw new Error(
          `Workspace page ${pageLabel} has horizontally overflowing flow panels: ` +
            JSON.stringify(overflowingFlowPanels)
        )
      }
      const overlappingBattleScoreControls = pageResult.battleScoreControls.flatMap(
        (control, index, controls) =>
          controls
            .slice(index + 1)
            .filter((candidate) => rectsOverlap(control.rect, candidate.rect))
            .map((candidate) => ({
              first: control,
              second: candidate
            }))
      )
      if (overlappingBattleScoreControls.length > 0) {
        throw new Error(
          `Workspace page ${pageLabel} has overlapping battle score controls: ` +
            JSON.stringify(overlappingBattleScoreControls)
        )
      }
      const unreachablePagination = pageResult.pagination.filter(
        (pagination) => !pagination.reachable
      )
      if (unreachablePagination.length > 0) {
        throw new Error(
          `Workspace page ${pageLabel} has unreachable pagination: ` +
            JSON.stringify(unreachablePagination)
        )
      }
      await captureScreenshot(
        session,
        screenshotDirectory,
        `${screenshotPrefix}-${pageResult.document.clientWidth}x${pageResult.document.clientHeight}-${pageLabel}`
      )
      pageResults.push(pageResult)
    }
    return {
      inspectedPageCount: pageResults.length,
      pages: pageResults
    }
  } finally {
    await session.evaluate(`(() => {
      const previousPage = ${JSON.stringify(workspaceState.previousPage)}
      const navigation = document.querySelector(
        '.assist-workspace--secondary .workspace-page-tabs'
      )
      const button = [
        ...(navigation?.querySelectorAll('button[role="tab"]') ?? [])
      ].find((candidate) => candidate.textContent.trim() === previousPage)
      button?.click()
    })()`)
    await waitFor(
      () =>
        session.evaluate(`(() => {
          const previousPage = ${JSON.stringify(workspaceState.previousPage)}
          const active = document.querySelector(
            '.assist-workspace--secondary .workspace-page-tabs ' +
              'button[role="tab"][aria-selected="true"]'
          )
          return active?.textContent.trim() === previousPage
        })()`),
      'the previous workspace page to be restored',
      timeoutMs
    )
  }
}

async function inspectWorkspaceModuleVisibility(
  session,
  timeoutMs,
  screenshotDirectory = undefined
) {
  const targetPageId = 'secondary-operations'
  const targetPanelName = 'missioncheck'
  const previousPageId = await session.evaluate(`(() => {
    const active = document.querySelector(
      '.assist-workspace--secondary .workspace-page-tabs ' +
        'button[role="tab"][aria-selected="true"]'
    )
    return active?.dataset.workspacePageId ?? null
  })()`)

  if (!previousPageId) {
    throw new Error('The active workspace page is unavailable before module visibility inspection')
  }

  await session.evaluate(`(() => {
    const button = document.querySelector(
      '.assist-workspace--secondary ' +
        'button[data-workspace-page-id=${JSON.stringify(targetPageId)}]'
    )
    button?.click()
  })()`)
  await waitFor(
    () =>
      session.evaluate(`(() => {
        const active = document.querySelector(
          '.assist-workspace--secondary .workspace-page-tabs ' +
            'button[role="tab"][aria-selected="true"]'
        )
        return active?.dataset.workspacePageId === ${JSON.stringify(targetPageId)}
      })()`),
    'the workspace module visibility test page',
    timeoutMs
  )

  const toggleEditor = async () => {
    await session.evaluate(`document.querySelector(
      '.assist-workspace--secondary .workspace-layout-button'
    )?.click()`)
  }
  const clickPanelCheckbox = async () => {
    const clicked = await session.evaluate(`(() => {
      const checkbox = document.querySelector(
        '.assist-workspace--secondary ' +
          '.workspace-layout-editor ' +
          '[data-layout-panel-name=${JSON.stringify(targetPanelName)}] ' +
          'input[type="checkbox"]'
      )
      if (!(checkbox instanceof HTMLInputElement)) {
        return false
      }
      checkbox.click()
      return true
    })()`)
    if (!clicked) {
      throw new Error(`Workspace module ${targetPanelName} has no configuration checkbox`)
    }
  }
  const inspectState = () =>
    session.evaluate(`(() => {
      const pageId = ${JSON.stringify(targetPageId)}
      const panelName = ${JSON.stringify(targetPanelName)}
      let savedVisible = null
      try {
        const saved = JSON.parse(
          localStorage.getItem('rendererState:main:workspace-layout') ?? '{}'
        )
        savedVisible =
          saved.pages
            ?.find((page) => page.id === pageId)
            ?.panels?.find((panel) => panel.name === panelName)
            ?.visible ?? null
      } catch {
        savedVisible = null
      }
      const editor = document.querySelector(
        '.assist-workspace--secondary .workspace-layout-editor'
      )
      const checkbox = editor?.querySelector(
        '[data-layout-panel-name=' + JSON.stringify(panelName) + '] ' +
          'input[type="checkbox"]'
      )
      return {
        pageId,
        panelName,
        panelVisible: Boolean(
          document.querySelector(
            '.assist-workspace--secondary ' +
              '.workspace-panel[data-panel-name=' + JSON.stringify(panelName) + ']'
          )
        ),
        editorOpen: Boolean(editor),
        checkboxChecked:
          checkbox instanceof HTMLInputElement ? checkbox.checked : null,
        savedVisible
      }
    })()`)

  await toggleEditor()
  await waitFor(
    async () => {
      const state = await inspectState()
      return state.editorOpen && state.checkboxChecked === true ? state : undefined
    },
    'the workspace module visibility editor',
    timeoutMs
  )

  await clickPanelCheckbox()
  const hidden = await waitFor(
    async () => {
      const state = await inspectState()
      return !state.panelVisible &&
        state.editorOpen &&
        state.checkboxChecked === false &&
        state.savedVisible === false
        ? state
        : undefined
    },
    'the hidden workspace module and persisted preference',
    timeoutMs
  )
  await captureScreenshot(session, screenshotDirectory, 'workspace-module-missioncheck-hidden')

  await toggleEditor()
  await waitFor(
    async () => {
      const state = await inspectState()
      return !state.editorOpen && !state.panelVisible ? state : undefined
    },
    'the hidden workspace module with its editor closed',
    timeoutMs
  )
  await toggleEditor()
  const reopened = await waitFor(
    async () => {
      const state = await inspectState()
      return state.editorOpen &&
        !state.panelVisible &&
        state.checkboxChecked === false &&
        state.savedVisible === false
        ? state
        : undefined
    },
    'the hidden workspace module preference after reopening configuration',
    timeoutMs
  )

  await clickPanelCheckbox()
  const restored = await waitFor(
    async () => {
      const state = await inspectState()
      return state.panelVisible &&
        state.editorOpen &&
        state.checkboxChecked === true &&
        state.savedVisible === true
        ? state
        : undefined
    },
    'the restored workspace module and persisted preference',
    timeoutMs
  )

  await toggleEditor()
  await session.evaluate(`(() => {
    const button = document.querySelector(
      '.assist-workspace--secondary ' +
        'button[data-workspace-page-id=${JSON.stringify(previousPageId)}]'
    )
    button?.click()
  })()`)
  await waitFor(
    () =>
      session.evaluate(`(() => {
        const active = document.querySelector(
          '.assist-workspace--secondary .workspace-page-tabs ' +
            'button[role="tab"][aria-selected="true"]'
        )
        return active?.dataset.workspacePageId === ${JSON.stringify(previousPageId)}
      })()`),
    'the previous workspace page after module visibility inspection',
    timeoutMs
  )

  return {
    pageId: targetPageId,
    panelName: targetPanelName,
    hidden,
    reopened,
    restored,
    previousPageRestored: true
  }
}

async function inspectPrimaryWorkspace(session, timeoutMs, expectedDocument = undefined) {
  const result = await waitFor(
    async () => {
      const snapshot = await session.evaluate(`(() => {
        const workspace = document.querySelector('.assist-workspace--primary')
        const grid = workspace?.querySelector('.workspace-page-grid')
        const panel = grid?.querySelector(
          ':scope > .workspace-panel[data-panel-name="questguide"]'
        )
        const body = panel?.querySelector('.workspace-panel-body')
        const guide = body?.querySelector('.quest-guide')
        if (!workspace || !grid || !panel || !body || !guide) {
          return null
        }

        const rectOf = (element) => {
          const rect = element.getBoundingClientRect()
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          }
        }
        const visible = (element) => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
          )
        }
        const pagination = [
          ...guide.querySelectorAll('.pagination, .quest-guide-pagination')
        ]
          .filter(visible)
          .map((element) => {
            const scrollPositions = []
            let ancestor = element.parentElement
            while (ancestor) {
              scrollPositions.push({
                element: ancestor,
                left: ancestor.scrollLeft,
                top: ancestor.scrollTop
              })
              ancestor = ancestor.parentElement
            }
            element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
            const rect = rectOf(element)
            const bodyRect = rectOf(body)
            const reachable =
              rect.left >= bodyRect.left - 1 &&
              rect.top >= bodyRect.top - 1 &&
              rect.right <= bodyRect.right + 1 &&
              rect.bottom <= bodyRect.bottom + 1
            for (const position of scrollPositions) {
              position.element.scrollLeft = position.left
              position.element.scrollTop = position.top
            }
            return { reachable, rect, bodyRect }
          })
        const root = document.documentElement
        return {
          visible: true,
          pageId: grid.dataset.workspacePage ?? null,
          document: {
            clientWidth: root.clientWidth,
            scrollWidth: root.scrollWidth,
            clientHeight: root.clientHeight,
            scrollHeight: root.scrollHeight
          },
          viewport: {
            left: 0,
            top: 0,
            right: root.clientWidth,
            bottom: root.clientHeight,
            width: root.clientWidth,
            height: root.clientHeight
          },
          workspace: rectOf(workspace),
          grid: rectOf(grid),
          panel: {
            rect: rectOf(panel),
            body: {
              rect: rectOf(body),
              clientWidth: body.clientWidth,
              scrollWidth: body.scrollWidth,
              clientHeight: body.clientHeight,
              scrollHeight: body.scrollHeight
            }
          },
          guide: {
            rect: rectOf(guide),
            clientWidth: guide.clientWidth,
            scrollWidth: guide.scrollWidth,
            clientHeight: guide.clientHeight,
            scrollHeight: guide.scrollHeight
          },
          loadingOverlayCount: [
            ...grid.querySelectorAll('.loading-overlay')
          ].filter(visible).length,
          pagination
        }
      })()`)
      const documentIsStable =
        !expectedDocument ||
        (Math.abs(snapshot.document.clientWidth - expectedDocument.clientWidth) <= 1 &&
          Math.abs(snapshot.document.clientHeight - expectedDocument.clientHeight) <= 1)
      return snapshot?.loadingOverlayCount === 0 && documentIsStable ? snapshot : undefined
    },
    'the primary workspace task guide',
    timeoutMs
  )

  if (
    result.pageId !== 'primary-overview' ||
    !metricsAreContained(result.document) ||
    !rectIsContained(result.viewport, result.workspace) ||
    !rectIsContained(result.workspace, result.grid) ||
    !rectIsContained(result.grid, result.panel.rect) ||
    !rectIsContained(result.panel.rect, result.panel.body.rect) ||
    result.panel.body.scrollWidth > result.panel.body.clientWidth + 1 ||
    result.guide.scrollWidth > result.guide.clientWidth + 1 ||
    result.pagination.some((pagination) => !pagination.reachable)
  ) {
    throw new Error(`Primary workspace containment failed: ${JSON.stringify(result)}`)
  }
  return result
}

async function inspectWorkspaceFrame(session) {
  return session.evaluate(`(() => {
    const rectOf = (element) => {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      }
    }
    const root = document.documentElement
    const mainRoot = document.querySelector('.main-root')
    const main = mainRoot?.querySelector('.main-content')
    const primary = main?.querySelector(':scope > .workspace-primary')
    const game = primary?.querySelector(':scope > .game-content')
    const secondary = main?.querySelector(':scope > .assist-workspace--secondary')
    return {
      surface: mainRoot?.dataset.layoutSurface ?? null,
      ready: Boolean(primary?.classList.contains('is-app-ready')),
      document: {
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        clientHeight: root.clientHeight,
        scrollHeight: root.scrollHeight
      },
      scroll: {
        x: window.scrollX,
        y: window.scrollY
      },
      viewport: {
        left: 0,
        top: 0,
        right: root.clientWidth,
        bottom: root.clientHeight,
        width: root.clientWidth,
        height: root.clientHeight
      },
      main: rectOf(main),
      primary: rectOf(primary),
      game: rectOf(game),
      secondary: rectOf(secondary)
    }
  })()`)
}

async function inspectWorkspaceResizeSweep(session, timeoutMs) {
  const controlSession = session.screenshotSession ?? session
  const originalWindow = await controlSession.call('Smoke.getWindowState')
  const originalApp = await inspectApp(session)
  const topology = await controlSession.call('Smoke.getDisplayTopology')
  const currentDisplay = topology.displays.find(
    (display) => display.id === topology.currentDisplayId
  )
  if (!currentDisplay) {
    throw new Error(`The current display is unavailable: ${JSON.stringify(topology)}`)
  }
  const workArea = {
    left: currentDisplay.workArea.x,
    top: currentDisplay.workArea.y,
    width: currentDisplay.workArea.width,
    height: currentDisplay.workArea.height
  }
  const sizes = WorkspaceResizeSweepSizes.filter(
    (size) => size.width <= workArea.width && size.height <= workArea.height
  )
  if (sizes.length < 2) {
    throw new Error(
      `The current work area cannot run the workspace resize sweep: ${JSON.stringify(workArea)}`
    )
  }

  const restoreBounds = originalWindow.maximized
    ? originalWindow.normalBounds
    : originalWindow.bounds
  const preferredPosition = {
    left: restoreBounds.x,
    top: restoreBounds.y
  }
  const results = []
  let leftOriginalMaximizedState = false

  try {
    if (originalWindow.maximized) {
      await session.evaluate(`window.api.toggleMaximize()`)
      leftOriginalMaximizedState = true
      await waitFor(
        async () => {
          const state = await controlSession.call('Smoke.getWindowState')
          return state.maximized ? undefined : state
        },
        'the workspace to leave maximized state before the resize sweep',
        timeoutMs
      )
    }

    for (const [index, size] of sizes.entries()) {
      const bounds = workspaceBoundsForSize(workArea, size.width, size.height, preferredPosition)
      await session.evaluate(`(() => {
        const bounds = ${JSON.stringify(bounds)}
        window.resizeTo(bounds.width, bounds.height)
        window.moveTo(bounds.left, bounds.top)
      })()`)
      await waitForStableAppSize(
        session,
        bounds.width,
        bounds.height,
        `workspace resize sweep step ${index + 1}`,
        timeoutMs
      )
      const expectedGame = workspaceGameSizeForWindow(bounds.width, bounds.height)
      const frame = await waitFor(
        async () => {
          const snapshot = await inspectWorkspaceFrame(session)
          return workspaceFrameFailure(snapshot, expectedGame) === null ? snapshot : undefined
        },
        `responsive workspace frame at resize sweep step ${index + 1}`,
        timeoutMs
      )
      const failure = workspaceFrameFailure(frame, expectedGame)
      if (failure) {
        throw new Error(
          `Workspace resize sweep step ${index + 1} failed: ${failure}; ` +
            JSON.stringify({ bounds, frame })
        )
      }
      results.push({
        step: index + 1,
        direction: index === 0 ? 'start' : size.width >= sizes[index - 1].width ? 'grow' : 'shrink',
        bounds,
        game: {
          width: frame.game.width,
          height: frame.game.height
        },
        automaticLayout: {
          leftInset: frame.game.left - frame.main.left,
          trackGap: frame.secondary.left - frame.game.right,
          rightInset: frame.main.right - frame.secondary.right,
          scrollX: frame.scroll.x,
          scrollY: frame.scroll.y
        }
      })
    }
    return results
  } finally {
    await session.evaluate(`(() => {
      const bounds = ${JSON.stringify({
        left: restoreBounds.x,
        top: restoreBounds.y,
        width: restoreBounds.width,
        height: restoreBounds.height
      })}
      window.resizeTo(bounds.width, bounds.height)
      window.moveTo(bounds.left, bounds.top)
    })()`)
    if (originalWindow.maximized && leftOriginalMaximizedState) {
      await session.evaluate(`window.api.toggleMaximize()`)
      await waitFor(
        async () => {
          const state = await controlSession.call('Smoke.getWindowState')
          return state.maximized ? state : undefined
        },
        'the original maximized state after the resize sweep',
        timeoutMs
      )
    }
    await waitForStableAppSize(
      session,
      originalApp.document.clientWidth,
      originalApp.document.clientHeight,
      'the original application bounds after the resize sweep',
      timeoutMs
    )
  }
}

async function inspectSizedWorkspace(
  session,
  timeoutMs,
  name,
  width,
  height,
  expectPrimary,
  expectedPageLabels,
  screenshotDirectory,
  availableWorkArea = undefined,
  expectedDisplayId = undefined
) {
  const originalApp = await inspectApp(session)
  const windowState = await session.evaluate(`(() => ({
    available: {
      left: window.screen.availLeft,
      top: window.screen.availTop,
      width: window.screen.availWidth,
      height: window.screen.availHeight
    },
    current: {
      left: window.screenX,
      top: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight
    }
  }))()`)
  const wideBounds = wideWorkspaceBounds(windowState.available)
  const originalWasWide =
    Math.abs(originalApp.document.clientWidth - wideBounds.width) <= 1 &&
    Math.abs(originalApp.document.clientHeight - wideBounds.height) <= 1
  const targetBounds = workspaceBoundsForSize(
    availableWorkArea ?? windowState.available,
    width,
    height,
    windowState.current
  )
  const expectedGame = workspaceGameSizeForWindow(targetBounds.width, targetBounds.height)
  let leftOriginalMaximizedState = false

  try {
    if (originalWasWide) {
      await session.evaluate(`window.api.toggleMaximize()`)
      leftOriginalMaximizedState = true
      await waitFor(
        async () => {
          const snapshot = await inspectApp(session)
          return Math.abs(snapshot.document.clientWidth - originalApp.document.clientWidth) > 1
            ? snapshot
            : undefined
        },
        'the wide workspace to leave maximized state',
        timeoutMs
      )
    }
    await session.evaluate(`(() => {
      const bounds = ${JSON.stringify(targetBounds)}
      window.resizeTo(bounds.width, bounds.height)
      window.moveTo(bounds.left, bounds.top)
    })()`)

    const app = await waitForStableAppSize(
      session,
      targetBounds.width,
      targetBounds.height,
      `the ${name} workspace bounds`,
      timeoutMs
    )
    if (
      !app.ready ||
      !metricsAreContained(app.document) ||
      !app.game ||
      Math.abs(app.game.width - expectedGame.width) > 1 ||
      Math.abs(app.game.height - expectedGame.height) > 1
    ) {
      throw new Error(`${name} workspace geometry failed: ${JSON.stringify(app)}`)
    }
    let displayIdAtInspection
    if (expectedDisplayId !== undefined) {
      const controlSession = session.screenshotSession ?? session
      const topology = await controlSession.call('Smoke.getDisplayTopology')
      displayIdAtInspection = topology.currentDisplayId
      if (displayIdAtInspection !== expectedDisplayId) {
        throw new Error(
          `${name} workspace is on display ${displayIdAtInspection}, ` +
            `expected ${expectedDisplayId}`
        )
      }
    }

    const responsiveState = await waitFor(
      async () => {
        const state = await session.evaluate(`(() => {
          const primaryVisible = Boolean(
            document.querySelector('.assist-workspace--primary')
          )
          const labels = [
            ...(
              document.querySelector(
                '.assist-workspace--secondary .workspace-page-tabs'
              )?.querySelectorAll('button[role="tab"]') ?? []
            )
          ].map((button) => button.textContent.trim())
          return {
            matches:
              primaryVisible === ${JSON.stringify(expectPrimary)} &&
              labels.join('|') ===
                ${JSON.stringify(expectedPageLabels.join('|'))},
            primaryVisible,
            labels
          }
        })()`)
        return state.matches ? state : undefined
      },
      `the ${name} responsive workspace mode`,
      timeoutMs
    )
    const primaryVisible = responsiveState.primaryVisible
    let primary
    if (expectPrimary) {
      if (!primaryVisible) {
        throw new Error(`${name} workspace did not expose the primary task guide`)
      }
      primary = await inspectPrimaryWorkspace(session, timeoutMs, {
        clientWidth: targetBounds.width,
        clientHeight: targetBounds.height
      })
    } else {
      if (primaryVisible) {
        throw new Error(`${name} workspace exposed an unusable primary task guide`)
      }
      primary = { visible: false }
    }
    const secondary = await inspectWorkspacePages(
      session,
      timeoutMs,
      {
        clientWidth: targetBounds.width,
        clientHeight: targetBounds.height
      },
      screenshotDirectory,
      name
    )
    const pageLabels = secondary.pages.map((page) => page.label)
    if (pageLabels.join('|') !== expectedPageLabels.join('|')) {
      throw new Error(`${name} workspace pages changed: ${JSON.stringify(pageLabels)}`)
    }
    return {
      name,
      requestedBounds: targetBounds,
      displayIdAtInspection,
      app,
      primary,
      secondary
    }
  } finally {
    if (originalWasWide && leftOriginalMaximizedState) {
      await session.evaluate(`window.api.toggleMaximize()`)
    } else {
      await session.evaluate(`(() => {
        const bounds = ${JSON.stringify(windowState.current)}
        window.resizeTo(bounds.width, bounds.height)
        window.moveTo(bounds.left, bounds.top)
      })()`)
    }
    await waitForStableAppSize(
      session,
      originalApp.document.clientWidth,
      originalApp.document.clientHeight,
      `the original application bounds to be restored after ${name} inspection`,
      timeoutMs
    )
  }
}

async function inspectWorkspaceSizeCases(session, timeoutMs, screenshotDirectory = undefined) {
  const cases = [
    {
      name: 'surface',
      width: SurfaceWorkspaceWidth,
      height: SurfaceWorkspaceHeight,
      expectPrimary: true,
      expectedPageLabels: ['運用', 'ドック・任務', '戦闘・装備', 'ドロップ']
    },
    {
      name: 'narrow',
      width: NarrowWorkspaceWidth,
      height: NarrowWorkspaceHeight,
      expectPrimary: false,
      expectedPageLabels: ['運用', 'ドック・任務', '戦闘・装備', 'ドロップ', '任務']
    },
    {
      name: 'baseline',
      width: IntermediateWorkspaceWidth,
      height: IntermediateWorkspaceHeight,
      expectPrimary: true,
      expectedPageLabels: ['運用', 'ドック・任務', '戦闘・装備', 'ドロップ']
    },
    {
      name: 'tall',
      width: TallWorkspaceWidth,
      height: TallWorkspaceHeight,
      expectPrimary: true,
      expectedPageLabels: ['運用', 'ドック・任務', '戦闘・装備', 'ドロップ']
    }
  ]
  const results = []
  for (const testCase of cases) {
    results.push(
      await inspectSizedWorkspace(
        session,
        timeoutMs,
        testCase.name,
        testCase.width,
        testCase.height,
        testCase.expectPrimary,
        testCase.expectedPageLabels,
        screenshotDirectory
      )
    )
  }
  return results
}

async function tapWorkspacePage(session, workspacePageId) {
  const point = await session.evaluate(`(() => {
    const button = document.querySelector(
      '.assist-workspace--secondary ' +
        'button[data-workspace-page-id=${JSON.stringify(workspacePageId)}]'
    )
    if (!button) {
      return null
    }
    const rect = button.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return null
    }
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
  })()`)
  if (!point) {
    throw new Error(`Workspace page ${workspacePageId} has no visible touch target`)
  }

  await session.call('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 1
  })
  try {
    await session.call('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        {
          id: 1,
          x: point.x,
          y: point.y,
          radiusX: 1,
          radiusY: 1,
          force: 1
        }
      ]
    })
    await session.call('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    })
  } finally {
    await session.call('Emulation.setTouchEmulationEnabled', {
      enabled: false
    })
  }
}

async function prepareWorkspaceRestartState(session, timeoutMs) {
  const controlSession = session.screenshotSession ?? session
  const originalWindow = await controlSession.call('Smoke.getWindowState')
  if (originalWindow.maximized) {
    await session.evaluate(`window.api.toggleMaximize()`)
    await waitFor(
      async () => {
        const state = await controlSession.call('Smoke.getWindowState')
        return state.maximized ? undefined : state
      },
      'the workspace to leave maximized state before restart',
      timeoutMs
    )
  }

  const screenState = await session.evaluate(`(() => ({
    available: {
      left: window.screen.availLeft,
      top: window.screen.availTop,
      width: window.screen.availWidth,
      height: window.screen.availHeight
    },
    current: {
      left: window.screenX,
      top: window.screenY
    }
  }))()`)
  const requestedBounds = workspaceBoundsForSize(
    screenState.available,
    SurfaceWorkspaceWidth,
    SurfaceWorkspaceHeight,
    screenState.current
  )
  await session.evaluate(`(() => {
    const bounds = ${JSON.stringify(requestedBounds)}
    window.resizeTo(bounds.width, bounds.height)
    window.moveTo(bounds.left, bounds.top)
  })()`)
  const app = await waitForStableAppSize(
    session,
    requestedBounds.width,
    requestedBounds.height,
    'the Surface workspace before restart',
    timeoutMs
  )
  const expectedGame = workspaceGameSizeForWindow(requestedBounds.width, requestedBounds.height)
  if (
    !app.game ||
    Math.abs(app.game.width - expectedGame.width) > 1 ||
    Math.abs(app.game.height - expectedGame.height) > 1
  ) {
    throw new Error(`Surface workspace before restart changed size: ${JSON.stringify(app)}`)
  }

  await tapWorkspacePage(session, 'secondary-status')
  await waitFor(
    () =>
      session.evaluate(`(() => {
        const workspace = document.querySelector('.assist-workspace--secondary')
        const active = workspace?.querySelector(
          '.workspace-page-tabs button[role="tab"][aria-selected="true"]'
        )
        const panel = workspace?.querySelector(
          '.workspace-panel[data-panel-name="dockquestlist"]'
        )
        return active?.dataset.workspacePageId === 'secondary-status' && Boolean(panel)
      })()`),
    'the dock and task page before restart',
    timeoutMs
  )
  await waitFor(
    () =>
      session.evaluate(`(() => {
        const value = localStorage.getItem('panelViewState:main')
        if (!value) {
          return false
        }
        try {
          return JSON.parse(value)?.activeWorkspacePages?.secondary ===
            'secondary-status'
        } catch {
          return false
        }
      })()`),
    'the dock and task page selection to be persisted before restart',
    timeoutMs
  )
  await delay(1000)

  return {
    requestedBounds,
    expectedGame,
    interaction: 'touch'
  }
}

async function inspectRestartedWorkspace(session, timeoutMs, preparedState) {
  const controlSession = session.screenshotSession ?? session
  const app = await waitFor(
    async () => {
      const snapshot = await inspectApp(session)
      return snapshot.ready &&
        snapshot.surface === 'workspace' &&
        Math.abs(snapshot.document.clientWidth - preparedState.requestedBounds.width) <= 1 &&
        Math.abs(snapshot.document.clientHeight - preparedState.requestedBounds.height) <= 1
        ? snapshot
        : undefined
    },
    'the persisted Surface workspace after restart',
    timeoutMs
  )
  const windowState = await controlSession.call('Smoke.getWindowState')
  let activePage
  try {
    activePage = await waitFor(
      async () => {
        const state = await session.evaluate(`(() => {
          const workspace = document.querySelector('.assist-workspace--secondary')
          const active = workspace?.querySelector(
            '.workspace-page-tabs button[role="tab"][aria-selected="true"]'
          )
          const panel = workspace?.querySelector(
            '.workspace-panel[data-panel-name="dockquestlist"]'
          )
          return {
            pageId: active?.dataset.workspacePageId ?? null,
            dockTaskPanelVisible: Boolean(panel)
          }
        })()`)
        return state.pageId === 'secondary-status' && state.dockTaskPanelVisible ? state : undefined
      },
      'the persisted dock and task page after restart',
      timeoutMs
    )
  } catch (error) {
    const diagnostic = await session.evaluate(`(() => {
      const workspace = document.querySelector('.assist-workspace--secondary')
      const active = workspace?.querySelector(
        '.workspace-page-tabs button[role="tab"][aria-selected="true"]'
      )
      return {
        pageId: active?.dataset.workspacePageId ?? null,
        panelViewState: localStorage.getItem('panelViewState:main')
      }
    })()`)
    error.message += `; diagnostic=${JSON.stringify(diagnostic)}`
    throw error
  }
  if (
    Math.abs(windowState.bounds.x - preparedState.requestedBounds.left) > 1 ||
    Math.abs(windowState.bounds.y - preparedState.requestedBounds.top) > 1 ||
    Math.abs(app.game.width - preparedState.expectedGame.width) > 1 ||
    Math.abs(app.game.height - preparedState.expectedGame.height) > 1
  ) {
    throw new Error(
      `Restarted Surface workspace did not restore its geometry: ${JSON.stringify({
        windowState,
        app,
        preparedState
      })}`
    )
  }

  return {
    requestedBounds: preparedState.requestedBounds,
    windowBounds: windowState.bounds,
    app,
    activePage,
    interaction: preparedState.interaction
  }
}

async function inspectDisplayWorkspaceCases(
  session,
  timeoutMs,
  displayTopology,
  screenshotDirectory = undefined
) {
  const controlSession = session.screenshotSession ?? session
  const originalWindow = await controlSession.call('Smoke.getWindowState')
  const originalApp = await inspectApp(session)
  const capableDisplays = displayTopology.displays.filter(
    (display) =>
      display.workArea.width >= MinimumWorkspaceWidth &&
      display.workArea.height >= MinimumWorkspaceHeight
  )
  const results = []
  let leftOriginalMaximizedState = false

  try {
    if (originalWindow.maximized) {
      await session.evaluate(`window.api.toggleMaximize()`)
      leftOriginalMaximizedState = true
      await waitFor(
        async () => {
          const state = await controlSession.call('Smoke.getWindowState')
          return state.maximized ? undefined : state
        },
        'the maximized workspace to enter movable state',
        timeoutMs
      )
    }
    for (const [index, display] of capableDisplays.entries()) {
      await session.evaluate(`(() => {
        const bounds = ${JSON.stringify({
          left: display.workArea.x,
          top: display.workArea.y,
          width: MinimumWorkspaceWidth,
          height: MinimumWorkspaceHeight
        })}
        window.resizeTo(bounds.width, bounds.height)
        window.moveTo(bounds.left, bounds.top)
      })()`)
      await waitFor(
        async () => {
          const topology = await controlSession.call('Smoke.getDisplayTopology')
          return topology.currentDisplayId === display.id ? topology : undefined
        },
        `the workspace to move to display ${display.id}`,
        timeoutMs
      )

      const inspection = await inspectSizedWorkspace(
        session,
        timeoutMs,
        `display-${index + 1}`,
        MinimumWorkspaceWidth,
        MinimumWorkspaceHeight,
        false,
        ['運用', 'ドック・任務', '戦闘・装備', 'ドロップ', '任務'],
        screenshotDirectory,
        {
          left: display.workArea.x,
          top: display.workArea.y,
          width: display.workArea.width,
          height: display.workArea.height
        },
        display.id
      )
      const settledTopology = await controlSession.call('Smoke.getDisplayTopology')
      if (settledTopology.currentDisplayId !== display.id) {
        throw new Error(`Workspace left display ${display.id}: ${JSON.stringify(settledTopology)}`)
      }
      results.push({
        ...inspection,
        displayId: display.id,
        primaryDisplay: display.primary,
        scaleFactor: display.scaleFactor,
        workArea: display.workArea
      })
    }
  } finally {
    const restoreBounds = originalWindow.maximized
      ? originalWindow.normalBounds
      : originalWindow.bounds
    await session.evaluate(`(() => {
      const bounds = ${JSON.stringify({
        left: restoreBounds.x,
        top: restoreBounds.y,
        width: restoreBounds.width,
        height: restoreBounds.height
      })}
      window.resizeTo(bounds.width, bounds.height)
      window.moveTo(bounds.left, bounds.top)
    })()`)
    if (originalWindow.maximized && leftOriginalMaximizedState) {
      await session.evaluate(`window.api.toggleMaximize()`)
      await waitFor(
        async () => {
          const state = await controlSession.call('Smoke.getWindowState')
          return state.maximized ? state : undefined
        },
        'the original maximized state after display inspection',
        timeoutMs
      )
    }
    await waitForStableAppSize(
      session,
      originalApp.document.clientWidth,
      originalApp.document.clientHeight,
      'the original application bounds after display inspection',
      timeoutMs
    )
    await waitFor(
      async () => {
        const topology = await controlSession.call('Smoke.getDisplayTopology')
        return topology.currentDisplayId === displayTopology.currentDisplayId ? topology : undefined
      },
      'the original application display after display inspection',
      timeoutMs
    )
  }

  return results
}

async function inspectWideWorkspace(session, timeoutMs, screenshotDirectory = undefined) {
  const originalApp = await inspectApp(session)
  const availableWorkArea = await session.evaluate(`(() => ({
    left: window.screen.availLeft,
    top: window.screen.availTop,
    width: window.screen.availWidth,
    height: window.screen.availHeight,
    windowLeft: window.screenX,
    windowTop: window.screenY,
    windowWidth: window.outerWidth,
    windowHeight: window.outerHeight
  }))()`)
  const requestedBounds = wideWorkspaceBounds(availableWorkArea)
  const alreadyWide =
    Math.abs(originalApp.document.clientWidth - requestedBounds.width) <= 1 &&
    Math.abs(originalApp.document.clientHeight - requestedBounds.height) <= 1
  let toggledMaximize = false

  try {
    if (!alreadyWide) {
      await session.evaluate(`window.api.toggleMaximize()`)
      toggledMaximize = true
    }

    const app = await waitForStableAppSize(
      session,
      requestedBounds.width,
      requestedBounds.height,
      'the wide workspace bounds',
      timeoutMs
    )
    if (!app.ready) {
      throw new Error('Wide workspace lost account-scoped game data')
    }
    if (
      !metricsAreContained(app.document) ||
      !app.game ||
      Math.abs(app.game.width - 1200) > 1 ||
      Math.abs(app.game.height - 720) > 1
    ) {
      throw new Error(`Wide workspace geometry failed: ${JSON.stringify(app)}`)
    }

    const primary = await inspectPrimaryWorkspace(session, timeoutMs, {
      clientWidth: requestedBounds.width,
      clientHeight: requestedBounds.height
    })
    const secondary = await inspectWorkspacePages(
      session,
      timeoutMs,
      {
        clientWidth: requestedBounds.width,
        clientHeight: requestedBounds.height
      },
      screenshotDirectory,
      'wide'
    )
    return {
      requestedBounds,
      originalWindow: {
        left: availableWorkArea.windowLeft,
        top: availableWorkArea.windowTop,
        width: availableWorkArea.windowWidth,
        height: availableWorkArea.windowHeight,
        alreadyWide
      },
      app,
      primary,
      secondary
    }
  } finally {
    if (toggledMaximize) {
      await session.evaluate(`window.api.toggleMaximize()`)
    }
    await waitForStableAppSize(
      session,
      originalApp.document.clientWidth,
      originalApp.document.clientHeight,
      'the original application bounds to be restored',
      timeoutMs
    )
  }
}

async function inspectTaskGuide(session, timeoutMs, expectedQuestKnowledge = undefined) {
  const previousPage = await session.evaluate(`(() => {
    const navigation = document.querySelector(
      '.assist-workspace--secondary .workspace-page-tabs'
    )
    const active = navigation?.querySelector(
      'button[role="tab"][aria-selected="true"]'
    )
    const task = [...(navigation?.querySelectorAll('button[role="tab"]') ?? [])]
      .find((button) => button.textContent.trim() === '任務')
    if (!task) return null
    const previous = active?.textContent.trim() ?? null
    task.click()
    return previous
  })()`)
  if (previousPage === null) {
    throw new Error('The workspace task page is not available')
  }

  let previousFilter
  let previousStrategyVisibility
  const inspectQuestStrategy = async (expectedVersion = undefined) => {
    previousStrategyVisibility = await session.evaluate(`(() => {
      const toggle = document.querySelector('.quest-strategy-visibility-toggle')
      if (!toggle) return null
      const visible = toggle.getAttribute('aria-expanded') === 'true'
      const stored = localStorage.getItem('questStrategyRouteVisible:v1')
      if (!visible) toggle.click()
      return { visible, stored }
    })()`)
    if (previousStrategyVisibility === null) {
      throw new Error('The quest-strategy visibility control is unavailable')
    }
    const strategyResult = await waitFor(
      () =>
        session.evaluate(`(() => {
          const expectedVersion = ${JSON.stringify(expectedVersion)}
          const route = document.querySelector('.quest-strategy-route')
          if (!route) return null
          const version = route.dataset.knowledgeVersion ?? null
          const html = route.outerHTML
          const hero = route.querySelector('.quest-strategy-hero')
          const zeroReady = route.querySelector('.quest-strategy-zero-ready')
          const controls = route.querySelector('.quest-strategy-controls')
          const audit = route.querySelector('.quest-strategy-summary')
          const growth = document.querySelector('.quest-growth-check')
          const growthDetails = growth?.querySelector('.quest-growth-details')
          const growthRoutes = growth?.querySelector('.quest-growth-reviewed-routes')
          const growthContextSelects = growth?.querySelectorAll('.quest-growth-context select') ?? []
          const growthFocus = growthContextSelects[1]
          if (growthFocus && growthFocus.value !== 'resources') {
            growthFocus.value = 'resources'
            growthFocus.dispatchEvent(new Event('change', { bubbles: true }))
            return null
          }
          if (growthRoutes && !growthRoutes.open) {
            growthRoutes.dataset.smokeInitiallyCollapsed = 'true'
            growthRoutes.open = true
            growthRoutes.dispatchEvent(new Event('toggle'))
            return null
          }
          const growthHtml = growth?.outerHTML ?? ''
          const forbidden = [
            /admiral/i,
            /member.?id/i,
            /ship.?id/i,
            /instance.?id/i,
            /api_(?:token|port|member_id)/i
          ].filter((pattern) => pattern.test(html)).map((pattern) => String(pattern))
          return version && (!expectedVersion || version === expectedVersion)
            ? {
                version,
                forbiddenIdentifiers: forbidden,
                actionState: hero ? 'route' : zeroReady ? 'zero-ready' : null,
                selectionCollapsed: controls ? !controls.open : zeroReady ? true : null,
                auditCollapsed: audit ? !audit.open : true,
                clientWidth: route.clientWidth,
                scrollWidth: route.scrollWidth,
                growth: growth
                  ? {
                      routeOutput: growth.dataset.routeOutput ?? null,
                      priorityCount: growth.querySelectorAll('.quest-growth-priority li').length,
                      contextSelectCount: growth.querySelectorAll(
                        '.quest-growth-context select'
                      ).length,
                      factFocus:
                        growth.querySelector('.quest-growth-facts')?.dataset.focus ?? null,
                      factCount: growth.querySelectorAll('.quest-growth-facts dd').length,
                      detailsCollapsed: growthDetails ? !growthDetails.open : null,
                      routesInitiallyCollapsed:
                        growthRoutes?.dataset.smokeInitiallyCollapsed === 'true',
                      reviewedRouteCount: growth.querySelectorAll(
                        '.quest-growth-reviewed-route'
                      ).length,
                      reviewedRouteManualLabel:
                        growth.querySelector('.quest-growth-route-badges')?.textContent.includes(
                          '手動確認必須'
                        ) ?? false,
                      forbiddenIdentifiers: forbidden
                        .filter((pattern) => pattern.test(growthHtml))
                        .map((pattern) => String(pattern)),
                      clientWidth: growth.clientWidth,
                      scrollWidth: growth.scrollWidth
                    }
                  : null
              }
            : null
        })()`),
      expectedVersion
        ? 'the signed quest-strategy update in the task guide'
        : 'the bundled quest-strategy route in the task guide',
      timeoutMs
    )
    const expectedGrowthFactCount = expectedVersion ? 1 : undefined
    if (
      strategyResult.forbiddenIdentifiers.length > 0 ||
      strategyResult.actionState === null ||
      strategyResult.selectionCollapsed !== true ||
      (strategyResult.auditCollapsed !== null && strategyResult.auditCollapsed !== true) ||
      strategyResult.scrollWidth > strategyResult.clientWidth + 1 ||
      strategyResult.growth?.routeOutput !== 'reviewed-opt-in' ||
      strategyResult.growth?.priorityCount < 1 ||
      strategyResult.growth?.contextSelectCount !== 2 ||
      strategyResult.growth?.factFocus !== 'resources' ||
      (expectedGrowthFactCount === undefined
        ? (strategyResult.growth?.factCount ?? 0) < 1
        : strategyResult.growth?.factCount !== expectedGrowthFactCount) ||
      strategyResult.growth?.detailsCollapsed !== true ||
      strategyResult.growth?.routesInitiallyCollapsed !== true ||
      strategyResult.growth?.reviewedRouteCount !== 1 ||
      strategyResult.growth?.reviewedRouteManualLabel !== true ||
      strategyResult.growth?.forbiddenIdentifiers.length > 0 ||
      strategyResult.growth?.scrollWidth > strategyResult.growth?.clientWidth + 1
    ) {
      throw new Error(
        `Quest-strategy view failed privacy or layout checks: ` +
          `${JSON.stringify(strategyResult)}`
      )
    }
    return strategyResult
  }
  try {
    if (expectedQuestKnowledge) {
      const fixtureResult = await waitFor(
        () =>
          session.evaluate(`(() => {
            const expected = ${JSON.stringify(expectedQuestKnowledge)}
            const guide = document.querySelector('.quest-guide')
            const select = guide?.querySelector('select[aria-label="目標任務"]')
            const option = [...(select?.options ?? [])].find(
              (candidate) => candidate.value === String(expected.questId)
            )
            const optionText = option?.textContent.trim() ?? null
            const root = document.documentElement
            return optionText === '#' + expected.questId + ' ' + expected.questTitle
              ? {
                  questKnowledgeUpdate: {
                    questId: expected.questId,
                    questTitle: expected.questTitle,
                    optionText
                  },
                  guide: {
                    clientWidth: guide.clientWidth,
                    scrollWidth: guide.scrollWidth,
                    clientHeight: guide.clientHeight,
                    scrollHeight: guide.scrollHeight
                  },
                  document: {
                    clientWidth: root.clientWidth,
                    scrollWidth: root.scrollWidth,
                    clientHeight: root.clientHeight,
                    scrollHeight: root.scrollHeight
                  }
                }
              : null
          })()`),
        'the signed quest-knowledge update in the task guide',
        timeoutMs
      )
      const strategyResult = await inspectQuestStrategy(expectedQuestKnowledge.strategyVersion)
      return {
        ...fixtureResult,
        questStrategyUpdate: strategyResult,
        recurringUnregisteredCount: undefined,
        recurringUnresolvedCount: undefined,
        recurringReviewCount: undefined
      }
    }

    try {
      await waitFor(
        () =>
          session.evaluate(
            `Boolean(document.querySelector(
              '.quest-guide select[aria-label="任務候補の表示条件"]'
            ))`
          ),
        'the workspace task guide controls',
        timeoutMs
      )
    } catch (error) {
      const diagnostic = await session.evaluate(`(() => {
        const active = document.querySelector(
          '.assist-workspace--secondary .workspace-page-tabs ' +
          'button[role="tab"][aria-selected="true"]'
        )
        const panels = [
          ...document.querySelectorAll(
            '.assist-workspace--secondary .workspace-panel'
          )
        ].map((panel) => ({
          name: panel.dataset.panelName ?? null,
          text: panel.textContent.trim().slice(0, 300)
        }))
        return {
          activePage: active?.textContent.trim() ?? null,
          panels
        }
      })()`)
      error.message += `; diagnostic=${JSON.stringify(diagnostic)}`
      throw error
    }
    previousFilter = await session.evaluate(`(() => {
      const select = document.querySelector(
        '.quest-guide select[aria-label="任務候補の表示条件"]'
      )
      if (!select) return null
      return select.value
    })()`)
    if (previousFilter === null) {
      throw new Error('The task-guide filter is unavailable')
    }

    const inspectFilter = async (filter) => {
      await session.evaluate(`(() => {
        const filter = ${JSON.stringify(filter)}
        const select = document.querySelector(
          '.quest-guide select[aria-label="任務候補の表示条件"]'
        )
        if (!select) return
        select.value = filter
        select.dispatchEvent(new Event('change', { bubbles: true }))
      })()`)
      return waitFor(
        async () => {
          const result = await session.evaluate(`(() => {
          const guide = document.querySelector('.quest-guide')
          if (!guide) return null
          const select = guide.querySelector(
            'select[aria-label="任務候補の表示条件"]'
          )
          const root = document.documentElement
          const summary = [...guide.querySelectorAll('.quest-guide-summary span')]
            .map((element) => element.textContent.trim())
          const countFromSummary = (prefix) => {
            const text = summary.find((entry) => entry.startsWith(prefix))
            const match = text?.match(/(\\d+)$/)
            return match ? Number(match[1]) : 0
          }
          const viewCountText = guide
            .querySelector('.quest-guide-view-count')
            ?.textContent.trim()
          const viewCountMatch = viewCountText?.match(
            /^表示\\s+(\\d+)\\s*\\/\\s*(\\d+)$/
          )
          return {
            recurringUnregisteredFilter: Boolean(
              [...(select?.options ?? [])].some(
                (option) => option.value === 'recurring-unregistered'
              )
            ),
            recurringUnresolvedFilter: Boolean(
              [...(select?.options ?? [])].some(
                (option) => option.value === 'recurring-unresolved'
              )
            ),
            recurringReviewFilter: Boolean(
              [...(select?.options ?? [])].some(
                (option) => option.value === 'recurring-review'
              )
            ),
            goalSearchAvailable: Boolean(
              guide.querySelector(
                'input[aria-label="目標任務を番号または名前で検索"]'
              )
            ),
            activeFilter: select?.value ?? null,
            summary,
            filteredCount: viewCountMatch ? Number(viewCountMatch[1]) : null,
            recurringUnregisteredSummaryCount: countFromSummary(
              '定期関係 未登録'
            ),
            recurringUnresolvedSummaryCount:
              countFromSummary('定期関係 確認中'),
            expectedRecurringReviewCount:
              countFromSummary('定期関係 未登録') +
              countFromSummary('定期関係 確認中'),
            guide: {
              clientWidth: guide.clientWidth,
              scrollWidth: guide.scrollWidth,
              clientHeight: guide.clientHeight,
              scrollHeight: guide.scrollHeight
            },
            document: {
              clientWidth: root.clientWidth,
              scrollWidth: root.scrollWidth,
              clientHeight: root.clientHeight,
              scrollHeight: root.scrollHeight
            }
          }
        })()`)
          return result?.recurringUnregisteredFilter &&
            result.recurringUnresolvedFilter &&
            result.recurringReviewFilter &&
            result.goalSearchAvailable &&
            result.activeFilter === filter &&
            result.filteredCount !== null
            ? result
            : undefined
        },
        `the workspace task guide filter ${filter}`,
        timeoutMs
      )
    }

    const unregistered = await inspectFilter('recurring-unregistered')
    if (unregistered.filteredCount !== unregistered.recurringUnregisteredSummaryCount) {
      throw new Error(
        `Recurring unregistered count mismatch: ${unregistered.filteredCount} filtered, ` +
          `${unregistered.recurringUnregisteredSummaryCount} summarized`
      )
    }
    const unresolved = await inspectFilter('recurring-unresolved')
    if (unresolved.filteredCount !== unresolved.recurringUnresolvedSummaryCount) {
      throw new Error(
        `Recurring unresolved count mismatch: ${unresolved.filteredCount} filtered, ` +
          `${unresolved.recurringUnresolvedSummaryCount} summarized`
      )
    }
    const result = await inspectFilter('recurring-review')
    if (result.filteredCount !== result.expectedRecurringReviewCount) {
      throw new Error(
        `Recurring relationship count mismatch: ${result.filteredCount} filtered, ` +
          `${result.expectedRecurringReviewCount} summarized`
      )
    }
    const questStrategyUpdate = await inspectQuestStrategy()
    return {
      ...result,
      questStrategyUpdate,
      recurringUnregisteredCount: unregistered.filteredCount,
      recurringUnresolvedCount: unresolved.filteredCount,
      recurringReviewCount: result.filteredCount
    }
  } finally {
    if (previousStrategyVisibility !== undefined) {
      await session.evaluate(`(() => {
        const expected = ${JSON.stringify(previousStrategyVisibility.visible)}
        const toggle = document.querySelector('.quest-strategy-visibility-toggle')
        const visible = toggle?.getAttribute('aria-expanded') === 'true'
        if (toggle && visible !== expected) toggle.click()
      })()`)
      await waitFor(
        () =>
          session.evaluate(`(() => {
            const expected = ${JSON.stringify(previousStrategyVisibility.visible)}
            const toggle = document.querySelector('.quest-strategy-visibility-toggle')
            return (toggle?.getAttribute('aria-expanded') === 'true') === expected
          })()`),
        'the previous quest-strategy visibility to be restored',
        timeoutMs
      )
      await session.evaluate(`(() => {
        const stored = ${JSON.stringify(previousStrategyVisibility.stored)}
        if (stored === null) {
          localStorage.removeItem('questStrategyRouteVisible:v1')
        } else {
          localStorage.setItem('questStrategyRouteVisible:v1', stored)
        }
      })()`)
    }
    if (previousFilter !== undefined) {
      await session.evaluate(`(() => {
      const previousFilter = ${JSON.stringify(previousFilter)}
      const select = document.querySelector(
        '.quest-guide select[aria-label="任務候補の表示条件"]'
      )
      if (select) {
        select.value = previousFilter
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })()`)
      await waitFor(
        () =>
          session.evaluate(`(() => {
            const expected = ${JSON.stringify(previousFilter)}
            const select = document.querySelector(
              '.quest-guide select[aria-label="任務候補の表示条件"]'
            )
            return (
              select?.value === expected &&
              localStorage.getItem('questGuideViewFilter:v1') === expected
            )
          })()`),
        'the previous task-guide filter to be restored',
        timeoutMs
      )
    }
    await session.evaluate(`(() => {
      const previous = ${JSON.stringify(previousPage)}
      const navigation = document.querySelector(
        '.assist-workspace--secondary .workspace-page-tabs'
      )
      const button = [...(navigation?.querySelectorAll('button[role="tab"]') ?? [])]
        .find((candidate) => candidate.textContent.trim() === previous)
      button?.click()
    })()`)
    await waitFor(
      () =>
        session.evaluate(`(() => {
          const expected = ${JSON.stringify(previousPage)}
          const active = document.querySelector(
            '.assist-workspace--secondary .workspace-page-tabs ' +
            'button[role="tab"][aria-selected="true"]'
          )
          return active?.textContent.trim() === expected
        })()`),
      'the previous workspace page to be restored',
      timeoutMs
    )
  }
}

function summarizeSmokeResult(result) {
  const summarizeApp = (app) => ({
    surface: app.surface,
    ready: app.ready,
    ...(app.localizationLocale !== undefined
      ? {
          localizationLocale: app.localizationLocale,
          localizationSample: app.localizationSample
        }
      : {}),
    document: {
      width: app.document.clientWidth,
      height: app.document.clientHeight
    },
    game: app.game
  })
  const summarizePages = (inspection) => inspection?.pages?.map((page) => page.label) ?? []
  const primaryIsVisible = (primary) => Boolean(primary && (primary.visible ?? primary.pageId))
  const summarizeScreenshotDirectory = (directory) => {
    if (!directory) {
      return undefined
    }
    if (!path.isAbsolute(directory)) {
      return directory.split(path.sep).join('/')
    }
    const repoRoot = path.resolve(__dirname, '..')
    const relative = path.relative(repoRoot, directory)
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      return relative.split(path.sep).join('/')
    }
    return path.basename(directory)
  }

  return {
    dataSource: result.dataSource,
    isolatedUserData: result.isolatedUserData,
    accountRestoreState: result.accountRestoreState,
    accountTransferState: result.accountTransferState,
    accountRetentionState: result.accountRetentionState,
    accountRepeatState: result.accountRepeatState,
    accountRollbackState: result.accountRollbackState,
    accountRedoState: result.accountRedoState,
    accountMergePreparation: result.accountMergePreparation,
    accountMergeState: result.accountMergeState,
    accountMergeRollbackState: result.accountMergeRollbackState,
    accountMergeRedoState: result.accountMergeRedoState,
    accountFailureState: result.accountFailureState,
    accountAuditBaseline: result.accountAuditBaseline,
    accountAuditRollbackComparison: result.accountAuditRollbackComparison,
    accountAuditRedoComparison: result.accountAuditRedoComparison,
    accountBusinessStates: result.accountBusinessStates,
    pseudoLocale: result.pseudoLocale,
    screenshotDirectory: summarizeScreenshotDirectory(result.screenshotDirectory),
    dataUpdateDownloadState: result.dataUpdateDownloadState
      ? {
          source: result.dataUpdateDownloadState.source,
          version: result.dataUpdateDownloadState.version,
          fileCount: result.dataUpdateDownloadState.fileCount,
          hasQuestKnowledge: result.dataUpdateDownloadState.hasQuestKnowledge,
          publicKeySha256: result.dataUpdateDownloadState.publicKeySha256,
          restarted: result.dataUpdateDownloadState.restarted
        }
      : undefined,
    dataUpdateMapState: result.dataUpdateMapState,
    dataUpdateState: result.dataUpdateState
      ? {
          publicKeyConfigured: result.dataUpdateState.publicKeyConfigured,
          active: Boolean(result.dataUpdateState.activeDataDirectory),
          questClaimCount: result.dataUpdateState.questClaimCount,
          questIds: result.dataUpdateState.questIds,
          strategyVersion: result.dataUpdateState.strategyVersion,
          strategyRecipeIds: result.dataUpdateState.strategyRecipeIds
        }
      : undefined,
    liveAcceptance: result.liveAcceptance
      ? {
          profile: result.liveAcceptance.profile,
          missionCheck: {
            rowCount: result.liveAcceptance.missionCheck.rowCount,
            hasExplicitError: result.liveAcceptance.missionCheck.hasExplicitError,
            area1FilterInitiallyChecked:
              result.liveAcceptance.missionCheck.area1FilterInitiallyChecked,
            area1FilterTemporarilyEnabled:
              result.liveAcceptance.missionCheck.area1FilterTemporarilyEnabled,
            ...(typeof result.liveAcceptance.missionCheck.operationsPageInitiallyVisible ===
            'boolean'
              ? {
                  operationsPageInitiallyVisible:
                    result.liveAcceptance.missionCheck.operationsPageInitiallyVisible,
                  operationsPageTemporarilyRestored:
                    result.liveAcceptance.missionCheck.operationsPageTemporarilyRestored,
                  missionPanelInitiallyVisible:
                    result.liveAcceptance.missionCheck.missionPanelInitiallyVisible,
                  missionPanelTemporarilyEnabled:
                    result.liveAcceptance.missionCheck.missionPanelTemporarilyEnabled
                }
              : {})
          }
        }
      : undefined,
    displayTopology: result.displayTopology,
    displayAcceptance: result.displayAcceptance
      ? {
          profile: result.displayAcceptance.profile,
          displayIds: result.displayAcceptance.displayIds,
          displays: result.displayAcceptance.displays.map((display) => ({
            id: display.id,
            primary: display.primary,
            physicalSize: physicalDisplaySize(display),
            bounds: display.bounds,
            workArea: display.workArea,
            scaleFactor: display.scaleFactor,
            touchSupport: display.touchSupport
          })),
          inspectedDisplayIds: result.displayAcceptance.inspectedDisplayIds,
          touchPageSelected: result.displayAcceptance.touchPageSelected,
          restartVerified: result.displayAcceptance.restartVerified,
          zoomResetVerified: result.displayAcceptance.zoomResetVerified
        }
      : undefined,
    recordingSource: result.recordingSource,
    recordingSources: result.recordingSources,
    hpGaugeFixture: result.hpGaugeFixture
      ? {
          shipCount: result.hpGaugeFixture.ships.length,
          states: result.hpGaugeFixture.states,
          rowGap: result.hpGaugeFixture.rowGap,
          statusClearance: result.hpGaugeFixture.statusClearance
        }
      : undefined,
    zoomShortcutPolicy: result.zoomShortcutPolicy
      ? {
          preservedFactor: result.zoomShortcutPolicy.preservedFactor,
          gameSize: {
            width: result.zoomShortcutPolicy.before.width,
            height: result.zoomShortcutPolicy.before.height
          },
          resizeSweep: result.zoomShortcutPolicy.resizeSweep?.map((step) => ({
            requested: step.requested,
            actual: {
              width: step.actual.width,
              height: step.actual.height,
              factor: step.actual.factor,
              documentOverflow: step.actual.documentOverflow
            }
          }))
        }
      : undefined,
    muteReloadPolicy: result.muteReloadPolicy,
    titlebarCapacityFixture: result.titlebarCapacityFixture
      ? {
          ship: {
            text: result.titlebarCapacityFixture.ship.text,
            title: result.titlebarCapacityFixture.ship.title,
            danger: result.titlebarCapacityFixture.ship.danger
          },
          slotitem: {
            text: result.titlebarCapacityFixture.slotitem.text,
            title: result.titlebarCapacityFixture.slotitem.title,
            danger: result.titlebarCapacityFixture.slotitem.danger
          },
          statusClearance: Math.max(
            0,
            Math.round(
              (result.titlebarCapacityFixture.buttons.left -
                result.titlebarCapacityFixture.status.right) *
                100
            ) / 100
          )
        }
      : undefined,
    capacityBoundaryFixture: result.capacityBoundaryFixture
      ? {
          full: {
            ship: result.capacityBoundaryFixture.full.renderer.ship.text,
            slotitem: result.capacityBoundaryFixture.full.renderer.slotitem.text
          },
          overflow: {
            ship: result.capacityBoundaryFixture.overflow.renderer.ship.text,
            slotitem: result.capacityBoundaryFixture.overflow.renderer.slotitem.text
          }
        }
      : undefined,
    captureNoticeFixture: result.captureNoticeFixture
      ? {
          filename: result.captureNoticeFixture.filename,
          message: result.captureNoticeFixture.notice.text,
          size: result.captureNoticeFixture.file.size,
          width: result.captureNoticeFixture.file.width,
          height: result.captureNoticeFixture.file.height
        }
      : undefined,
    recordingSaveFixture: result.recordingSaveFixture
      ? {
          filename: result.recordingSaveFixture.filename,
          startedMessage: result.recordingSaveFixture.startedNotice.text,
          stoppedMessage: result.recordingSaveFixture.stoppedNotice.text,
          size: result.recordingSaveFixture.file.size,
          customDirectory: result.recordingSaveFixture.customDirectory,
          defaultDirectoryUnused: result.recordingSaveFixture.defaultDirectoryUnused
        }
      : undefined,
    transportFixture: result.transportFixture
      ? {
          value: result.transportFixture.value,
          shipCount: result.transportFixture.shipCount,
          shipIds: result.transportFixture.shipIds,
          seventhShipContained: rectIsContained(
            result.transportFixture.viewport,
            result.transportFixture.seventhShip
          )
        }
      : undefined,
    battleResultFixture: result.battleResultFixture
      ? {
          mainShip: {
            id: result.battleResultFixture.mainShipId,
            hp: result.battleResultFixture.mainHp
          },
          escortShip: {
            id: result.battleResultFixture.escortShipId,
            hp: result.battleResultFixture.escortHp
          },
          battleType: result.battleResultFixture.battleType,
          title: result.battleResultFixture.renderer.title,
          warning: result.battleResultFixture.renderer.warning,
          renderedHp: result.battleResultFixture.renderer.nowHp,
          inputProtection: {
            ordinaryClickBlocked:
              result.battleResultFixture.renderer.protection.ordinaryClickBlocked,
            ctrlBypass: result.battleResultFixture.renderer.protection.ctrlBypass
          }
        }
      : undefined,
    missionCheckFixture: result.missionCheckFixture
      ? {
          rowCount: result.missionCheckFixture.rowCount,
          hasExplicitError: result.missionCheckFixture.hasExplicitError,
          sampleMission: result.missionCheckFixture.missionNames[0]
        }
      : undefined,
    titlebarColorFixture: result.titlebarColorFixture
      ? {
          before: result.titlebarColorFixture.before.renderedColor,
          after: result.titlebarColorFixture.after.renderedColor,
          changed:
            result.titlebarColorFixture.before.backgroundImage !==
            result.titlebarColorFixture.after.backgroundImage
        }
      : undefined,
    proxyFixture: result.proxyFixture
      ? {
          rules: result.proxyFixture.proxyRules,
          fixedResolution: result.proxyFixture.fixedResolution,
          restoredResolution: result.proxyFixture.restoredResolution,
          resolutionOnly: result.proxyFixture.resolutionOnly
        }
      : undefined,
    dataFolderFixture: result.dataFolderFixture
      ? {
          rendererOpened: result.dataFolderFixture.rendererOpened,
          mainProcessOpened: result.dataFolderFixture.opened,
          parentIsElectronUserData: result.dataFolderFixture.parentIsElectronUserData,
          directoryName: result.dataFolderFixture.directoryName,
          directoryExists: result.dataFolderFixture.directoryExists
        }
      : undefined,
    workspaceModuleVisibility: result.workspaceModuleVisibility
      ? {
          pageId: result.workspaceModuleVisibility.pageId,
          panelName: result.workspaceModuleVisibility.panelName,
          hiddenAndPersisted:
            !result.workspaceModuleVisibility.hidden.panelVisible &&
            result.workspaceModuleVisibility.hidden.savedVisible === false,
          configurationReopened:
            result.workspaceModuleVisibility.reopened.editorOpen &&
            result.workspaceModuleVisibility.reopened.checkboxChecked === false,
          restoredAndPersisted:
            result.workspaceModuleVisibility.restored.panelVisible &&
            result.workspaceModuleVisibility.restored.savedVisible === true,
          previousPageRestored: result.workspaceModuleVisibility.previousPageRestored
        }
      : undefined,
    initial: {
      app: summarizeApp(result.app),
      pages: summarizePages(result.workspacePages)
    },
    taskGuide: result.taskGuide
      ? {
          recurringUnregisteredCount: result.taskGuide.recurringUnregisteredCount,
          recurringUnresolvedCount: result.taskGuide.recurringUnresolvedCount,
          recurringReviewCount: result.taskGuide.recurringReviewCount,
          questKnowledgeUpdate: result.taskGuide.questKnowledgeUpdate,
          questStrategyUpdate: result.taskGuide.questStrategyUpdate
        }
      : undefined,
    workspaceResizeSweep:
      result.workspaceResizeSweep?.map((entry) => ({
        step: entry.step,
        direction: entry.direction,
        bounds: entry.bounds,
        game: entry.game,
        automaticLayout: entry.automaticLayout
      })) ?? [],
    workspaceSizes:
      result.workspaceSizes?.map((entry) => ({
        name: entry.name,
        requestedBounds: entry.requestedBounds,
        app: summarizeApp(entry.app),
        primaryVisible: primaryIsVisible(entry.primary),
        pages: summarizePages(entry.secondary)
      })) ?? [],
    displayWorkspaces:
      result.displayWorkspaces?.map((entry) => ({
        displayId: entry.displayId,
        primaryDisplay: entry.primaryDisplay,
        scaleFactor: entry.scaleFactor,
        workArea: entry.workArea,
        requestedBounds: entry.requestedBounds,
        displayIdAtInspection: entry.displayIdAtInspection,
        app: summarizeApp(entry.app),
        pages: summarizePages(entry.secondary)
      })) ?? [],
    wideWorkspace: result.wideWorkspace
      ? {
          requestedBounds: result.wideWorkspace.requestedBounds,
          app: summarizeApp(result.wideWorkspace.app),
          primaryVisible: primaryIsVisible(result.wideWorkspace.primary),
          pages: summarizePages(result.wideWorkspace.secondary)
        }
      : undefined,
    layoutRestart: result.layoutRestart
      ? {
          requestedBounds: result.layoutRestart.requestedBounds,
          windowBounds: result.layoutRestart.windowBounds,
          app: summarizeApp(result.layoutRestart.app),
          activePage: result.layoutRestart.activePage,
          interaction: result.layoutRestart.interaction,
          gameAfterZoomReset: result.layoutRestart.gameAfterZoomReset
        }
      : undefined
  }
}

async function writeSmokeSummaryFile(directory, summary) {
  if (!directory) {
    return undefined
  }
  const file = path.join(directory, 'smoke-summary.json')
  await fsPromises.writeFile(file, `${JSON.stringify(summary, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx'
  })
  return file
}

async function ensureWorkspaceSurface(session, app, timeoutMs) {
  if (app.surface === 'workspace') {
    return app
  }
  if (app.surface !== 'classic-combined') {
    throw new Error('Workspace inspection requires workspace or classic inline-assist mode.')
  }

  await session.evaluate(`window.api.toggleLayoutMode()`)
  return waitFor(
    async () => {
      const result = await inspectApp(session)
      return result.surface === 'workspace' && result.ready ? result : undefined
    },
    'the workspace layout mode',
    timeoutMs
  )
}

async function run(options) {
  const previousRunDeadline = activeRunDeadline
  const progress = createSmokeProgress()
  const repoRoot = path.resolve(__dirname, '..')
  const builtMain = path.join(repoRoot, 'out', 'main', 'index.js')
  const executable = electronExecutable(repoRoot)
  if (!fs.existsSync(builtMain)) {
    throw new Error('Production bundle is missing. Run npm run verify first.')
  }
  if (!fs.existsSync(executable)) {
    throw new Error(`Electron executable is missing: ${executable}`)
  }

  if (options.layoutFixture) {
    await assertPortAvailable(options.port)
  }
  await assertNoExistingWindowsApp(repoRoot, options.layoutFixture)

  let settingsBackup
  let fixtureUserData
  let layoutFixtureOption
  let dataUpdateFixture
  let dataUpdateFixtureServer
  let dataUpdatePublicKey
  let dataUpdateExpectation
  let dataUpdateDownloadState
  let dataUpdateMapState
  let accountRestoreFixture
  let accountRestoreState
  let accountTransferState
  let accountRetentionState
  let accountRepeatState
  let accountRollbackState
  let accountRedoState
  let accountMergePreparation
  let accountMergeState
  let accountMergeRollbackState
  let accountMergeRedoState
  let accountFailureState
  let accountAuditBaseline
  let accountAuditRollbackComparison
  let accountAuditRedoComparison
  const accountBusinessStates = {}
  let child
  let appSession
  let gameSession
  let targets
  let childLog = ''
  let childLifecycleLog = ''
  const childLifecycleEvents = []
  const dataUpdateStaging = Boolean(options.dataUpdateStagingManifestUrl)
  const dataUpdateAcceptance = options.dataUpdateFixture || dataUpdateStaging
  if (dataUpdateStaging && process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new Error('Data-update staging acceptance refuses NODE_TLS_REJECT_UNAUTHORIZED=0')
  }
  const dataSource = options.accountRestoreFixture
    ? 'account-restore-fixture'
    : dataUpdateStaging
      ? 'data-update-staging'
      : options.layoutFixture
        ? 'layout-fixture'
        : options.manualGameStart
          ? 'manual-game'
          : options.allowGameStart
            ? 'live-game'
            : 'pre-game-shell'
  const screenshotDirectory = await createScreenshotRunDirectory(options.screenshotDir, dataSource)
  let cleanupStarted = false
  const cleanup = async () => {
    if (cleanupStarted) {
      return
    }
    cleanupStarted = true
    appSession?.screenshotSession?.close()
    appSession?.close()
    gameSession?.close()
    await stopSpawnedProcess(child)
    if (dataUpdateFixtureServer) {
      await dataUpdateFixtureServer.close()
      dataUpdateFixtureServer = undefined
    }
    if (settingsBackup) {
      await restoreSettings(settingsBackup)
    }
    await removeLayoutFixtureUserData(fixtureUserData)
  }
  const onSignal = () => {
    cleanup()
      .catch((error) => console.error('[smoke] cleanup failed:', error))
      .finally(() => process.exit(130))
  }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)

  activeRunDeadline = Date.now() + options.totalTimeoutMs
  try {
    progress('launch', `starting ${dataSource}`)
    if (screenshotDirectory) {
      progress('screenshots', `saving PNG files under ${screenshotDirectory}`)
    }
    if (options.layoutFixture) {
      fixtureUserData = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'koubrowser-layout-smoke-'))
      layoutFixtureOption = await createLayoutFixtureOptionSetting(fixtureUserData)
      if (options.dataUpdateFixture) {
        dataUpdateFixture = createSignedDataUpdateFixture()
        dataUpdateFixtureServer = await startDataUpdateFixtureServer(dataUpdateFixture)
        dataUpdatePublicKey = dataUpdateFixture.publicKey
        dataUpdateExpectation = dataUpdateFixture
      } else if (dataUpdateStaging) {
        dataUpdatePublicKey = loadDataUpdatePublicKeyFile(options.dataUpdatePublicKeyFile)
      }
      if (options.accountRestoreFixture) {
        accountRestoreFixture = await createAccountRestoreFixture(
          fixtureUserData,
          options.accountRestoreRecords
        )
      }
    } else {
      settingsBackup = await createSettingsBackup(settingsPathForPlatform())
    }
    const electronArguments = ['.']
    if (fixtureUserData) {
      electronArguments.push(`--remote-debugging-port=${options.port}`)
      electronArguments.push(`--user-data-dir=${fixtureUserData}`)
    }
    const smokeIpcToken = crypto.randomUUID()
    const electronEnvironment = options.layoutFixture
      ? {
          ...process.env,
          KOUBROWSER_LAYOUT_FIXTURE: '1',
          KOUBROWSER_LAYOUT_FIXTURE_USER_DATA: fixtureUserData,
          ...(options.pseudoLocale ? { KOUBROWSER_PSEUDO_LOCALE: '1' } : {}),
          ...(options.accountRestoreFixture ? { KOUBROWSER_ACCOUNT_RESTORE_FIXTURE: '1' } : {}),
          KOUBROWSER_SMOKE_IPC: '1',
          KOUBROWSER_SMOKE_IPC_TOKEN: smokeIpcToken,
          ...(dataUpdateFixture || dataUpdateStaging
            ? { KOUBROWSER_DATA_UPDATE_CONFIG_OVERRIDE: '1' }
            : {}),
          ...(dataUpdateFixture
            ? {
                KOUBROWSER_DATA_UPDATE_DOWNLOAD_FIXTURE: '1',
                KOU_DATA_UPDATE_MANIFEST_URL: dataUpdateFixtureServer.manifestUrl,
                KOU_DATA_UPDATE_PUBLIC_KEY: dataUpdateFixture.publicKey
              }
            : dataUpdateStaging
              ? {
                  KOU_DATA_UPDATE_MANIFEST_URL: options.dataUpdateStagingManifestUrl,
                  KOU_DATA_UPDATE_PUBLIC_KEY: dataUpdatePublicKey
                }
              : {})
        }
      : {
          ...process.env,
          KOUBROWSER_SMOKE_IPC: '1',
          KOUBROWSER_SMOKE_IPC_TOKEN: smokeIpcToken
        }
    if (dataUpdateStaging) {
      delete electronEnvironment.KOUBROWSER_DATA_UPDATE_DOWNLOAD_FIXTURE
    }
    const launchElectron = async () => {
      const launched = spawn(executable, electronArguments, {
        cwd: repoRoot,
        env: electronEnvironment,
        stdio: options.layoutFixture
          ? ['ignore', 'pipe', 'pipe', 'ipc']
          : ['ignore', 'ignore', 'ignore', 'ipc'],
        windowsHide: options.layoutFixture
      })
      if (options.layoutFixture) {
        const appendLog = (chunk) => {
          const output = chunk.toString('utf8')
          childLog = `${childLog}${output}`.slice(-64_000)
          if (
            /smoke quit requested|app before-quit|intakedrop and shutdown|worker exit|main window closed|window-all-closed/u.test(
              output
            )
          ) {
            childLifecycleLog = `${childLifecycleLog}${output}`.slice(-32_000)
          }
        }
        launched.stdout?.on('data', appendLog)
        launched.stderr?.on('data', appendLog)
      }
      launched.on('message', (message) => {
        if (
          message?.source === 'koubrowser-smoke-lifecycle' &&
          message.token === smokeIpcToken &&
          typeof message.stage === 'string'
        ) {
          childLifecycleEvents.push(message.stage)
        }
      })
      await new Promise((resolve, reject) => {
        launched.once('spawn', resolve)
        launched.once('error', reject)
      })
      return launched
    }
    child = await launchElectron()

    if (options.layoutFixture) {
      targets = await waitFor(
        async () => {
          if (child.exitCode !== null) {
            const error = new Error(
              `Electron exited before DevTools became ready (code ${child.exitCode})`
            )
            error.fatal = true
            throw error
          }
          const list = await cdpTargets(options.port)
          const app = list.find((target) => target.type === 'page' && target.title === '甲ブラウザ')
          const game = list.find((target) => target.type === 'webview')
          return app && game ? { app, game } : undefined
        },
        'the Electron DevTools targets',
        options.timeoutMs
      )
      appSession = await CdpSession.connect(targets.app.webSocketDebuggerUrl)
      appSession.screenshotSession = new IpcSession(child, 'app', smokeIpcToken)
      progress('bridge-ready', 'isolated layout fixture DevTools target is ready')
    } else {
      appSession = new IpcSession(child, 'app', smokeIpcToken)
      await waitFor(
        async () => {
          if (child.exitCode !== null) {
            const error = new Error(
              `Electron exited before the in-app smoke bridge became ready (code ${child.exitCode})`
            )
            error.fatal = true
            throw error
          }
          return inspectApp(appSession).catch(() => undefined)
        },
        'the in-app smoke bridge',
        options.timeoutMs
      )
      const windowState = await appSession.call('Smoke.showWindow')
      if (!windowState?.visible) {
        throw new Error(`Live smoke window is not visible: ${JSON.stringify(windowState)}`)
      }
      progress(
        'window-visible',
        `${windowState.bounds.width}x${windowState.bounds.height} at ` +
          `${windowState.bounds.x},${windowState.bounds.y}`
      )
    }
    await appSession.call('Runtime.enable')
    let smokeSession = appSession.screenshotSession ?? appSession
    if (options.accountRestoreFixture) {
      await smokeSession.call('Smoke.initializeAccountRestoreFixture')
    }
    if (dataUpdateAcceptance) {
      dataUpdateDownloadState = await waitFor(
        async () => {
          const state = options.dataUpdateFixture
            ? await dataUpdateDownloadFixtureState(
                path.join(fixtureUserData, 'koubrowser'),
                dataUpdateFixture,
                dataUpdateFixtureServer
              )
            : await dataUpdateInstalledBundleState(
                path.join(fixtureUserData, 'koubrowser'),
                dataUpdatePublicKey
              )
          return state.ready ? state : undefined
        },
        'the signed data bundle to download and install',
        options.timeoutMs
      )
      if (dataUpdateStaging) {
        dataUpdateExpectation = dataUpdateDownloadState
      }
      progress(
        'data-update-downloaded',
        dataUpdateStaging
          ? `${dataUpdateExpectation.version} installed from the HTTPS staging server`
          : `${dataUpdateFixture.dataVersion} installed from the loopback distribution server`
      )

      await smokeSession.call('Smoke.quit')
      appSession.screenshotSession.close()
      appSession.close()
      appSession = undefined
      await waitForGracefulExit(child, GracefulExitTimeoutMs, 'Data-update fixture Electron')
      child = undefined
      await waitFor(
        () =>
          assertPortAvailable(options.port)
            .then(() => true)
            .catch(() => undefined),
        'the fixture DevTools port before data-update restart',
        options.timeoutMs
      )

      child = await launchElectron()
      targets = await waitFor(
        async () => {
          if (child.exitCode !== null) {
            const error = new Error(
              `Electron exited before data-update restart became ready ` +
                `(code ${child.exitCode})`
            )
            error.fatal = true
            throw error
          }
          const list = await cdpTargets(options.port)
          const appTarget = list.find(
            (target) => target.type === 'page' && target.title === '甲ブラウザ'
          )
          const gameTarget = list.find((target) => target.type === 'webview')
          return appTarget && gameTarget ? { app: appTarget, game: gameTarget } : undefined
        },
        'the Electron DevTools targets after data-update restart',
        options.timeoutMs
      )
      appSession = await CdpSession.connect(targets.app.webSocketDebuggerUrl)
      appSession.screenshotSession = new IpcSession(child, 'app', smokeIpcToken)
      await appSession.call('Runtime.enable')
      smokeSession = appSession.screenshotSession
      progress(
        'data-update-restarted',
        'restarted the isolated app to activate the downloaded bundle'
      )
    }
    const dataUpdateState = dataUpdateAcceptance
      ? await smokeSession.call('Smoke.getDataUpdateState')
      : undefined
    if (dataUpdateState) {
      const expectedUserDataPath = path.resolve(fixtureUserData)
      const actualUserDataPath = path.resolve(dataUpdateState.userDataPath)
      if (
        actualUserDataPath.toLowerCase() !== expectedUserDataPath.toLowerCase() ||
        !dataUpdateState.publicKeyConfigured ||
        !dataUpdateState.activeDataDirectory ||
        !dataUpdateState.questIds.includes(dataUpdateExpectation.questId) ||
        dataUpdateState.strategyVersion !== dataUpdateExpectation.strategyVersion ||
        !dataUpdateState.strategyRecipeIds.includes(dataUpdateExpectation.strategyRecipeId)
      ) {
        throw new Error(
          `Signed task knowledge bundle was not activated: ${JSON.stringify(dataUpdateState)}`
        )
      }
      progress(
        'data-update-ready',
        `signed task knowledge includes #${dataUpdateExpectation.questId} and ` +
          `strategy ${dataUpdateExpectation.strategyVersion}`
      )
      const cellInfo = await appSession.evaluate(
        `window.api.cellInfoAsync(${dataUpdateExpectation.mapAreaId}, ${dataUpdateExpectation.mapNo})`
      )
      const mapSpot = cellInfo?.spots?.find((spot) => spot.no === dataUpdateExpectation.mapSpot.no)
      if (!isDeepStrictEqual(mapSpot, dataUpdateExpectation.mapSpot)) {
        throw new Error(
          `Signed map data was not consumed by the production renderer bridge: ` +
            `${JSON.stringify(cellInfo)}`
        )
      }
      dataUpdateMapState = {
        areaId: dataUpdateExpectation.mapAreaId,
        mapNo: dataUpdateExpectation.mapNo,
        spot: mapSpot
      }
      progress(
        'data-update-map-ready',
        `signed map ${dataUpdateExpectation.mapAreaId}-${dataUpdateExpectation.mapNo} includes ` +
          `spot #${dataUpdateExpectation.mapSpot.no}`
      )
    }
    let app = await inspectApp(appSession)
    if (!metricsAreContained(app.document)) {
      throw new Error(`Application document overflowed: ${JSON.stringify(app.document)}`)
    }

    if (options.layoutFixture && !app.ready) {
      app = await waitFor(
        async () => {
          const result = await inspectApp(appSession)
          return result.ready ? result : undefined
        },
        'local layout fixture data',
        options.timeoutMs
      )
      progress('fixture-ready', 'local deterministic account data is ready')
    }
    if (options.accountRestoreFixture) {
      try {
        accountRestoreState = await waitFor(
          async () => {
            const state = await accountRestoreFixtureState(accountRestoreFixture, 'restored')
            return state.ready ? state : undefined
          },
          'the isolated account restore transaction',
          options.timeoutMs
        )
      } catch (error) {
        error.message += `; diagnostic=${JSON.stringify({
          ...(await accountRestoreFixtureDiagnostic(accountRestoreFixture)),
          childLog
        })}`
        throw error
      }
      accountBusinessStates.restored = await inspectAccountBusinessFixture(
        appSession.screenshotSession,
        accountRestoreFixture,
        'incoming',
        false
      )
      progress('account-restored', 'incoming account data and business queries are active')
      accountTransferState = await smokeSession.call('Smoke.exerciseAccountTransferFixture', {
        backupDirectory: accountRestoreFixture.mergeBackupDirectory
      })
      if (
        !Number.isSafeInteger(accountTransferState?.bytes) ||
        accountTransferState.bytes <= 0 ||
        accountTransferState.records !== AccountRestoreFixtureDatabases.length ||
        accountTransferState.identityOutsideCiphertext !== false ||
        accountTransferState.wrongPassphraseRejected !== true ||
        accountTransferState.corruptionRejected !== true
      ) {
        throw new Error(
          `Encrypted account transfer verification failed: ${JSON.stringify(accountTransferState)}`
        )
      }
      progress(
        'account-transfer-verified',
        'encrypted transfer round-trip, secrecy, wrong-passphrase, and corruption checks passed'
      )
      accountRetentionState = await waitFor(
        async () => {
          const state = await accountRestoreRetentionFixtureState(accountRestoreFixture)
          return state.ready ? state : undefined
        },
        'the rollback generation retention policy',
        options.timeoutMs
      )
      progress(
        'account-retention',
        'oldest completed generation was pruned and three generations remain'
      )
      accountAuditBaseline = await appSession.evaluate('window.api.captureAccountAuditBaseline()')
      if (
        accountAuditBaseline?.status !== 'captured' ||
        accountAuditBaseline.summary?.databases?.length !== AccountRestoreFixtureDatabases.length ||
        accountAuditBaseline.summary?.records !==
          AccountRestoreFixtureDatabases.length * accountRestoreFixture.recordsPerDatabase
      ) {
        throw new Error(
          `Account audit baseline was not captured: ${JSON.stringify(accountAuditBaseline)}`
        )
      }
      progress(
        'account-audit-captured',
        `semantic baseline covers ${accountAuditBaseline.summary.records} records`
      )

      const stopAccountFixtureApp = async () => {
        await appSession.screenshotSession.call('Smoke.quit')
        appSession.screenshotSession.close()
        appSession.close()
        appSession = undefined
        await waitForGracefulExit(child, GracefulExitTimeoutMs, 'Account fixture Electron')
        child = undefined
      }
      const launchAccountFixtureApp = async (description) => {
        await waitFor(
          () =>
            assertPortAvailable(options.port)
              .then(() => true)
              .catch(() => undefined),
          `the fixture DevTools port before ${description}`,
          options.timeoutMs
        )
        child = await launchElectron()
        targets = await waitFor(
          async () => {
            if (child.exitCode !== null) {
              const error = new Error(
                `Electron exited before ${description} DevTools became ready ` +
                  `(code ${child.exitCode})`
              )
              error.fatal = true
              throw error
            }
            const list = await cdpTargets(options.port)
            const appTarget = list.find(
              (target) => target.type === 'page' && target.title === '甲ブラウザ'
            )
            const gameTarget = list.find((target) => target.type === 'webview')
            return appTarget && gameTarget ? { app: appTarget, game: gameTarget } : undefined
          },
          `the Electron DevTools targets after ${description}`,
          options.timeoutMs
        )
        appSession = await CdpSession.connect(targets.app.webSocketDebuggerUrl)
        appSession.screenshotSession = new IpcSession(child, 'app', smokeIpcToken)
        await appSession.call('Runtime.enable')
      }
      const rollbackMetadataPath = path.join(
        accountRestoreFixture.rollbackDirectory,
        'rollback.json'
      )
      const rollbackMetadataBeforeRepeat = await fsPromises.readFile(rollbackMetadataPath, 'utf8')

      await stopAccountFixtureApp()
      await scheduleRepeatedAccountRestoreFixture(accountRestoreFixture)
      await launchAccountFixtureApp('repeated restore restart')
      try {
        await appSession.screenshotSession.call('Smoke.initializeAccountRestoreFixture')
      } catch (error) {
        error.message += `; diagnostic=${JSON.stringify(
          await accountRestoreFixtureDiagnostic(accountRestoreFixture)
        )}`
        throw error
      }
      accountRepeatState = await waitFor(
        async () => {
          const state = await accountRestoreFixtureState(accountRestoreFixture, 'repeated')
          return state.ready ? state : undefined
        },
        'the repeated account restore no-op',
        options.timeoutMs
      )
      const rollbackMetadataAfterRepeat = await fsPromises.readFile(rollbackMetadataPath, 'utf8')
      if (rollbackMetadataAfterRepeat !== rollbackMetadataBeforeRepeat) {
        throw new Error('Repeated restore changed the retained rollback metadata')
      }
      accountBusinessStates.repeated = await inspectAccountBusinessFixture(
        appSession.screenshotSession,
        accountRestoreFixture,
        'incoming',
        false
      )
      progress('account-restore-repeat', 'same bundle was a no-op with unchanged business results')

      await stopAccountFixtureApp()
      await scheduleAccountRollbackFixture(accountRestoreFixture)
      await launchAccountFixtureApp('rollback restart')
      await appSession.screenshotSession.call('Smoke.initializeAccountRestoreFixture')
      app = await waitFor(
        async () => {
          const state = await inspectApp(appSession)
          return state.ready ? state : undefined
        },
        'local layout fixture data after rollback restart',
        options.timeoutMs
      )
      accountRollbackState = await waitFor(
        async () => {
          const state = await accountRestoreFixtureState(accountRestoreFixture, 'rolled-back')
          return state.ready ? state : undefined
        },
        'the isolated account rollback transaction',
        options.timeoutMs
      )
      accountBusinessStates.rollback = await inspectAccountBusinessFixture(
        appSession.screenshotSession,
        accountRestoreFixture,
        'current',
        false
      )
      progress('account-rolled-back', 'prior account data and business results are active')
      accountAuditRollbackComparison = await appSession.evaluate(
        'window.api.compareAccountAuditBaseline()'
      )
      if (
        accountAuditRollbackComparison?.status !== 'different' ||
        accountAuditRollbackComparison.changedDatabases?.length !==
          AccountRestoreFixtureDatabases.length
      ) {
        throw new Error(
          `Rollback was not detected by account audit: ` +
            JSON.stringify(accountAuditRollbackComparison)
        )
      }
      progress(
        'account-audit-rollback-difference',
        'semantic baseline detected every changed record database'
      )

      await stopAccountFixtureApp()
      await scheduleAccountRedoFixture(accountRestoreFixture)
      await launchAccountFixtureApp('redo restart')
      await appSession.screenshotSession.call('Smoke.initializeAccountRestoreFixture')
      accountRedoState = await waitFor(
        async () => {
          const state = await accountRedoFixtureState(accountRestoreFixture)
          return state.ready ? state : undefined
        },
        'the isolated account redo transaction',
        options.timeoutMs
      )
      accountBusinessStates.redo = await inspectAccountBusinessFixture(
        appSession.screenshotSession,
        accountRestoreFixture,
        'incoming',
        false
      )
      progress('account-redone', 'replaced data and business results are active')
      accountAuditRedoComparison = await appSession.evaluate(
        'window.api.compareAccountAuditBaseline()'
      )
      if (accountAuditRedoComparison?.status !== 'match') {
        throw new Error(
          `Redo did not match the account audit baseline: ` +
            JSON.stringify(accountAuditRedoComparison)
        )
      }
      progress(
        'account-audit-redo-match',
        'semantic baseline exactly matches the reapplied account data'
      )

      accountMergePreparation = await appSession.screenshotSession.call(
        'Smoke.prepareAccountMergeFixture',
        {
          backupDirectory: accountRestoreFixture.mergeBackupDirectory
        }
      )
      if (
        accountMergePreparation?.bundleId !== AccountMergeFixtureBundleId ||
        typeof accountMergePreparation.stageName !== 'string' ||
        accountMergePreparation.safeAdd !== AccountRestoreFixtureDatabases.length
      ) {
        throw new Error(
          `Safe account merge was not prepared: ` + JSON.stringify(accountMergePreparation)
        )
      }
      accountRestoreFixture.mergeStageName = accountMergePreparation.stageName
      progress(
        'account-merge-prepared',
        `${accountMergePreparation.safeAdd} safe database records were staged`
      )

      await stopAccountFixtureApp()
      await launchAccountFixtureApp('account merge restart')
      await appSession.screenshotSession.call('Smoke.initializeAccountRestoreFixture')
      accountMergeState = await waitFor(
        async () => {
          const state = await accountMergeFixtureState(accountRestoreFixture, 'merged')
          return state.ready ? state : undefined
        },
        'the isolated safe account merge transaction',
        options.timeoutMs
      )
      accountBusinessStates.merged = await inspectAccountBusinessFixture(
        appSession.screenshotSession,
        accountRestoreFixture,
        'incoming',
        true
      )
      progress('account-merged', 'safe records are active in histories and aggregates')

      const mergeRollbackPreparation = await appSession.screenshotSession.call(
        'Smoke.prepareAccountMergeRollbackFixture'
      )
      if (
        mergeRollbackPreparation?.bundleId !== AccountMergeFixtureBundleId ||
        mergeRollbackPreparation.stageName !== accountRestoreFixture.mergeStageName
      ) {
        throw new Error(
          `Account merge rollback was not prepared: ` + JSON.stringify(mergeRollbackPreparation)
        )
      }
      await stopAccountFixtureApp()
      await launchAccountFixtureApp('account merge rollback restart')
      await appSession.screenshotSession.call('Smoke.initializeAccountRestoreFixture')
      accountMergeRollbackState = await waitFor(
        async () => {
          const state = await accountMergeFixtureState(accountRestoreFixture, 'rolled-back')
          return state.ready ? state : undefined
        },
        'the isolated account merge rollback transaction',
        options.timeoutMs
      )
      accountBusinessStates.mergeRollback = await inspectAccountBusinessFixture(
        appSession.screenshotSession,
        accountRestoreFixture,
        'incoming',
        false
      )
      progress(
        'account-merge-rolled-back',
        'pre-merge business results are active and merged data is redo-ready'
      )

      const mergeRedoPreparation = await appSession.screenshotSession.call(
        'Smoke.prepareAccountMergeRedoFixture'
      )
      if (
        mergeRedoPreparation?.bundleId !== AccountMergeFixtureBundleId ||
        mergeRedoPreparation.stageName !== accountRestoreFixture.mergeStageName
      ) {
        throw new Error(
          `Account merge redo was not prepared: ` + JSON.stringify(mergeRedoPreparation)
        )
      }
      await stopAccountFixtureApp()
      await launchAccountFixtureApp('account merge redo restart')
      await appSession.screenshotSession.call('Smoke.initializeAccountRestoreFixture')
      accountMergeRedoState = await waitFor(
        async () => {
          const state = await accountMergeFixtureState(accountRestoreFixture, 'redone')
          return state.ready ? state : undefined
        },
        'the isolated account merge redo transaction',
        options.timeoutMs
      )
      accountBusinessStates.mergeRedo = await inspectAccountBusinessFixture(
        appSession.screenshotSession,
        accountRestoreFixture,
        'incoming',
        true
      )
      progress(
        'account-merge-redone',
        'merged business results are active and rollback remains available'
      )

      await stopAccountFixtureApp()
      const failureFixture = await scheduleCorruptAccountRestoreFixture(accountRestoreFixture)
      await launchAccountFixtureApp('invalid restore restart')
      let expectedRestoreFailure
      try {
        await appSession.screenshotSession.call('Smoke.initializeAccountRestoreFixture')
      } catch (error) {
        expectedRestoreFailure = error
      }
      if (!expectedRestoreFailure) {
        throw new Error('Corrupt account restore candidate unexpectedly succeeded')
      }
      accountFailureState = await waitFor(
        async () => {
          const state = await accountRestoreFailureFixtureState(
            accountRestoreFixture,
            failureFixture,
            'incoming'
          )
          return state.ready ? state : undefined
        },
        'the failed account restore to retain current data',
        options.timeoutMs
      )
      app = await waitFor(
        async () => {
          const state = await inspectApp(appSession)
          return state.ready ? state : undefined
        },
        'local layout fixture data after rejected restore',
        options.timeoutMs
      )
      accountFailureState = {
        ...accountFailureState,
        rejected: true
      }
      accountBusinessStates.rejectedRestore = await inspectAccountBusinessFixture(
        appSession.screenshotSession,
        accountRestoreFixture,
        'incoming',
        true
      )
      progress(
        'account-restore-rejected',
        'corrupt candidate was retained without changing business results'
      )
    }
    if (options.pseudoLocale) {
      const failure = pseudoLocaleFailure(app)
      if (failure) {
        throw new Error(failure)
      }
      progress(
        'pseudo-locale',
        `${app.localizationLocale} component sample ${app.localizationSample}`
      )
    }

    if (options.manualGameStart && !app.ready) {
      gameSession = options.layoutFixture
        ? await CdpSession.connect(targets.game.webSocketDebuggerUrl)
        : new IpcSession(child, 'game', smokeIpcToken)
      await gameSession.call('Runtime.enable')
      progress('manual-action', 'complete DMM login and click GAME START in the visible window')
      try {
        app = await waitForManualGameData(appSession, gameSession, options.timeoutMs, progress)
      } catch (error) {
        const [appState, gameState] = await Promise.all([
          inspectApp(appSession).catch(() => null),
          inspectGamePage(gameSession).catch(() => null)
        ])
        error.message += `; diagnostic=${JSON.stringify({
          stage: 'manual-game-start',
          app: appState,
          game: gameState
        })}`
        throw error
      }
    }

    if (options.allowGameStart && !app.ready) {
      if (app.surface === 'game-only') {
        throw new Error('Live smoke testing requires workspace or classic inline-assist mode.')
      }
      gameSession = options.layoutFixture
        ? await CdpSession.connect(targets.game.webSocketDebuggerUrl)
        : new IpcSession(child, 'game', smokeIpcToken)
      await gameSession.call('Runtime.enable')
      progress('game-start', 'waiting for the verified DMM GAME START surface')
      try {
        await clickGameStart(gameSession, options.timeoutMs)
      } catch (error) {
        const [appState, gameState] = await Promise.all([
          inspectApp(appSession).catch(() => null),
          inspectGamePage(gameSession).catch(() => null)
        ])
        error.message += `; diagnostic=${JSON.stringify({
          stage: 'game-start-surface',
          app: appState,
          game: gameState
        })}`
        throw error
      }
      progress('game-start-clicked', 'sent the explicitly allowed single click')
      try {
        app = await waitFor(
          async () => {
            const result = await inspectApp(appSession)
            return result.ready ? result : undefined
          },
          'account-scoped game data',
          options.timeoutMs
        )
        progress('account-data-ready', 'game and account-scoped data are ready')
      } catch (error) {
        const [appState, gameState] = await Promise.all([
          inspectApp(appSession).catch(() => null),
          inspectGamePage(gameSession).catch(() => null)
        ])
        error.message += `; diagnostic=${JSON.stringify({
          app: appState,
          game: gameState
        })}`
        throw error
      }
    }

    if ((options.allowGameStart || options.manualGameStart) && !app.ready) {
      throw new Error('Game data did not become ready')
    }
    if (!metricsAreContained(app.document)) {
      throw new Error(`Loaded application overflowed: ${JSON.stringify(app.document)}`)
    }
    if (app.surface === 'workspace' && app.ready) {
      const expectedGame = workspaceGameSizeForWindow(
        app.document.clientWidth,
        app.document.clientHeight
      )
      if (
        !app.game ||
        Math.abs(app.game.width - expectedGame.width) > 1 ||
        Math.abs(app.game.height - expectedGame.height) > 1
      ) {
        throw new Error(
          `Workspace game stage changed size: ${JSON.stringify({
            actual: app.game,
            expected: expectedGame
          })}`
        )
      }
    }
    if (options.workspacePages || options.taskGuide || options.wideWorkspace) {
      progress('workspace', 'ensuring workspace layout mode')
      app = await ensureWorkspaceSurface(appSession, app, options.timeoutMs)
    }
    const zoomShortcutPolicy = options.layoutFixture
      ? await inspectGameZoomShortcutPolicy(
          appSession,
          new IpcSession(child, 'game', smokeIpcToken),
          options.timeoutMs,
          screenshotDirectory
        )
      : undefined
    if (zoomShortcutPolicy) {
      app = await inspectApp(appSession)
      progress(
        'zoom-policy',
        `${zoomShortcutPolicy.resizeSweep.length}-step game-only resize and Ctrl+0/Ctrl++ preserved factor ${zoomShortcutPolicy.preservedFactor}`
      )
    }
    const muteReloadPolicy = options.layoutFixture
      ? await inspectMuteReloadPolicy(appSession, options.timeoutMs)
      : undefined
    if (muteReloadPolicy) {
      app = await inspectApp(appSession)
      progress('mute-policy', 'muted state survived application reload and was restored')
    }
    const titlebarCapacityFixture = options.layoutFixture
      ? await inspectTitlebarCapacityFixture(appSession, options.timeoutMs, screenshotDirectory)
      : undefined
    if (titlebarCapacityFixture) {
      progress(
        'capacity-policy',
        `${titlebarCapacityFixture.ship.text} ships and ${titlebarCapacityFixture.slotitem.text} equipment rendered with near-limit warnings`
      )
    }
    const captureNoticeFixture = options.layoutFixture
      ? await inspectCaptureNoticeFixture(
          appSession,
          layoutFixtureOption?.captureDirectory,
          layoutFixtureOption?.defaultCaptureDirectory,
          options.timeoutMs,
          screenshotDirectory
        )
      : undefined
    if (captureNoticeFixture) {
      progress(
        'capture-policy',
        `${captureNoticeFixture.filename} saved as a valid ${captureNoticeFixture.file.width}x${captureNoticeFixture.file.height} PNG and named by the success notice`
      )
    }
    const recordingSaveFixture = options.layoutFixture
      ? await inspectRecordingSaveFixture(
          appSession,
          layoutFixtureOption?.captureDirectory,
          layoutFixtureOption?.defaultCaptureDirectory,
          options.timeoutMs,
          screenshotDirectory
        )
      : undefined
    if (recordingSaveFixture) {
      progress(
        'recording-save-policy',
        `${recordingSaveFixture.filename} saved as a valid game-only WebM under the configured custom directory`
      )
    }
    const transportFixture = options.layoutFixture
      ? await inspectTransportFixture(appSession, options.timeoutMs, screenshotDirectory)
      : undefined
    if (transportFixture) {
      progress(
        'transport-policy',
        `${transportFixture.value} rendered from all ${transportFixture.shipCount} striking-force ships`
      )
    }

    await captureScreenshot(
      appSession,
      screenshotDirectory,
      `initial-${app.document.clientWidth}x${app.document.clientHeight}`
    )
    progress(
      'inspection',
      'checking workspace pages, task guide, continuous resize, and responsive sizes'
    )
    const displayTopology = await (appSession.screenshotSession ?? appSession).call(
      'Smoke.getDisplayTopology'
    )
    const displayAcceptance = options.requireDisplayProfile
      ? inspectDisplayAcceptanceProfile(options.requireDisplayProfile, displayTopology)
      : undefined
    if (displayAcceptance?.failure) {
      throw new Error(`${displayAcceptance.failure}: ${JSON.stringify(displayTopology)}`)
    }
    if (displayAcceptance) {
      progress(
        'display-profile',
        `${displayAcceptance.profile} matched display ids ${displayAcceptance.displayIds.join(', ')}`
      )
    }
    const liveAcceptance = options.requireLiveProfile
      ? {
          profile: options.requireLiveProfile,
          missionCheck: await inspectMissionCheck(
            appSession,
            options.timeoutMs,
            screenshotDirectory,
            options.requireLiveProfile
          )
        }
      : undefined
    if (liveAcceptance) {
      progress(
        'live-profile',
        `${liveAcceptance.profile} rendered ${liveAcceptance.missionCheck.rowCount} mission-check rows from ready account data`
      )
    }
    const result = {
      dataSource,
      isolatedUserData: options.layoutFixture,
      accountRestoreState,
      accountTransferState,
      accountRetentionState,
      accountRepeatState,
      accountRollbackState,
      accountRedoState,
      accountMergePreparation,
      accountMergeState,
      accountMergeRollbackState,
      accountMergeRedoState,
      accountFailureState,
      accountAuditBaseline,
      accountAuditRollbackComparison,
      accountAuditRedoComparison,
      accountBusinessStates: options.accountRestoreFixture ? accountBusinessStates : undefined,
      pseudoLocale: options.pseudoLocale,
      screenshotDirectory,
      dataUpdateDownloadState: dataUpdateDownloadState
        ? {
            ...dataUpdateDownloadState,
            ...(dataUpdateFixtureServer
              ? {
                  source: 'loopback-fixture',
                  requestPaths: dataUpdateFixtureServer.requests.map((request) => request.path)
                }
              : {}),
            restarted: true
          }
        : undefined,
      dataUpdateState,
      dataUpdateMapState,
      liveAcceptance,
      displayTopology,
      displayAcceptance,
      recordingSource: await inspectRecordingSource(appSession),
      recordingSources: options.layoutFixture
        ? await inspectFixtureRecordingSources(appSession, options.timeoutMs)
        : undefined,
      hpGaugeFixture: options.layoutFixture
        ? await inspectHpGaugeFixture(appSession, options.timeoutMs, screenshotDirectory)
        : undefined,
      zoomShortcutPolicy,
      muteReloadPolicy,
      titlebarCapacityFixture,
      captureNoticeFixture,
      recordingSaveFixture,
      transportFixture,
      missionCheckFixture: options.layoutFixture
        ? await inspectMissionCheck(appSession, options.timeoutMs, screenshotDirectory)
        : undefined,
      titlebarColorFixture: options.layoutFixture
        ? await inspectTitlebarColorFixture(appSession, options.timeoutMs, screenshotDirectory)
        : undefined,
      app,
      workspacePages: options.workspacePages
        ? await inspectWorkspacePages(
            appSession,
            options.timeoutMs,
            app.document,
            screenshotDirectory,
            'initial'
          )
        : undefined,
      workspaceModuleVisibility:
        options.layoutFixture && options.workspacePages
          ? await inspectWorkspaceModuleVisibility(
              appSession,
              options.timeoutMs,
              screenshotDirectory
            )
          : undefined,
      taskGuide: options.taskGuide
        ? await inspectTaskGuide(appSession, options.timeoutMs, dataUpdateExpectation)
        : undefined,
      workspaceResizeSweep: options.wideWorkspace
        ? await inspectWorkspaceResizeSweep(appSession, options.timeoutMs)
        : undefined,
      workspaceSizes: options.wideWorkspace
        ? await inspectWorkspaceSizeCases(appSession, options.timeoutMs, screenshotDirectory)
        : undefined,
      displayWorkspaces: options.wideWorkspace
        ? await inspectDisplayWorkspaceCases(
            appSession,
            options.timeoutMs,
            displayTopology,
            screenshotDirectory
          )
        : undefined,
      wideWorkspace: options.wideWorkspace
        ? await inspectWideWorkspace(appSession, options.timeoutMs, screenshotDirectory)
        : undefined
    }
    if (result.workspaceModuleVisibility) {
      progress(
        'workspace-module-visibility',
        'mission check hidden, persisted through editor reopen, restored, and previous page recovered'
      )
    }
    if (options.layoutFixture && options.wideWorkspace && !options.accountRestoreFixture) {
      progress('restart', 'persisting and restarting the Surface workspace')
      const preparedRestart = await prepareWorkspaceRestartState(appSession, options.timeoutMs)
      await appSession.screenshotSession.call('Smoke.quit')
      appSession.screenshotSession.close()
      appSession.close()
      appSession = undefined
      await waitForGracefulExit(child, GracefulExitTimeoutMs, 'Layout fixture Electron')
      child = undefined

      await waitFor(
        () =>
          assertPortAvailable(options.port)
            .then(() => true)
            .catch(() => undefined),
        'the fixture DevTools port before layout restart',
        options.timeoutMs
      )
      child = await launchElectron()
      targets = await waitFor(
        async () => {
          if (child.exitCode !== null) {
            const error = new Error(
              `Electron exited before layout restart DevTools became ready ` +
                `(code ${child.exitCode})`
            )
            error.fatal = true
            throw error
          }
          const list = await cdpTargets(options.port)
          const appTarget = list.find(
            (target) => target.type === 'page' && target.title === '甲ブラウザ'
          )
          const gameTarget = list.find((target) => target.type === 'webview')
          return appTarget && gameTarget ? { app: appTarget, game: gameTarget } : undefined
        },
        'the Electron DevTools targets after layout restart',
        options.timeoutMs
      )
      appSession = await CdpSession.connect(targets.app.webSocketDebuggerUrl)
      appSession.screenshotSession = new IpcSession(child, 'app', smokeIpcToken)
      await appSession.call('Runtime.enable')
      const restarted = await inspectRestartedWorkspace(
        appSession,
        options.timeoutMs,
        preparedRestart
      )
      const restartGameSession = await CdpSession.connect(targets.game.webSocketDebuggerUrl)
      try {
        await restartGameSession.call('Runtime.enable')
        await appSession.evaluate(`document.querySelector('#kb')?.focus()`)
        await dispatchControlKey(restartGameSession, '0', 'Digit0', 48)
        const gameAfterZoomReset = await waitFor(
          async () => {
            const snapshot = await inspectApp(appSession)
            return snapshot.game &&
              Math.abs(snapshot.game.width - preparedRestart.expectedGame.width) <= 1 &&
              Math.abs(snapshot.game.height - preparedRestart.expectedGame.height) <= 1
              ? snapshot.game
              : undefined
          },
          'Ctrl+0 to preserve the restarted Surface workspace game size',
          options.timeoutMs
        )
        result.layoutRestart = {
          ...restarted,
          gameAfterZoomReset
        }
      } finally {
        restartGameSession.close()
      }
      progress(
        'restart-restored',
        'Surface bounds, touch-selected dock/task page, and game zoom survived restart'
      )
    }
    if (result.displayAcceptance) {
      const inspectedDisplayIds = new Set(
        result.displayWorkspaces?.map((entry) => entry.displayId) ?? []
      )
      const missingDisplayIds = result.displayAcceptance.displayIds.filter(
        (displayId) => !inspectedDisplayIds.has(displayId)
      )
      if (missingDisplayIds.length > 0) {
        throw new Error(
          `Display acceptance profile did not inspect display ids: ${missingDisplayIds.join(', ')}`
        )
      }
      if (
        !result.layoutRestart ||
        result.layoutRestart.interaction !== 'touch' ||
        result.layoutRestart.activePage?.pageId !== 'secondary-status'
      ) {
        throw new Error(
          `Display acceptance profile did not preserve the touch-selected dock/task page: ` +
            `${JSON.stringify(result.layoutRestart)}`
        )
      }
      result.displayAcceptance.inspectedDisplayIds = [...inspectedDisplayIds]
      result.displayAcceptance.touchPageSelected = true
      result.displayAcceptance.restartVerified = true
      result.displayAcceptance.zoomResetVerified = Boolean(result.layoutRestart.gameAfterZoomReset)
    }
    if (options.layoutFixture && !options.accountRestoreFixture && !options.pseudoLocale) {
      result.capacityBoundaryFixture = await inspectCapacityBoundaryFixture(
        appSession,
        options.timeoutMs,
        screenshotDirectory
      )
      progress(
        'capacity-boundary-policy',
        'full 12/12 and 23/23 plus overflow 13/12 and 24/23 rendered explicitly'
      )
      result.battleResultFixture = await inspectBattleResultFixture(
        appSession,
        options.timeoutMs,
        screenshotDirectory
      )
      progress(
        'battle-result-policy',
        `combined day/night parser rendered main HP ${result.battleResultFixture.mainHp}, ` +
          `escort HP ${result.battleResultFixture.escortHp}, taiha input protection, ` +
          `and Ctrl+click bypass`
      )
      result.dataFolderFixture = await inspectDataFolderFixture(appSession, options.timeoutMs)
      progress(
        'data-folder-policy',
        'renderer action reached the main process and resolved the isolated koubrowser data directory'
      )
      result.proxyFixture = await inspectProxyFixture(appSession)
      progress(
        'proxy-policy',
        `Chromium resolved the fixed upstream rule as ${result.proxyFixture.fixedResolution} ` +
          'without a network request and restored system mode'
      )
    }
    if (
      result.taskGuide &&
      (!metricsAreContained(result.taskGuide.document) ||
        result.taskGuide.guide.scrollWidth > result.taskGuide.guide.clientWidth + 1)
    ) {
      throw new Error(`Task guide overflowed: ${JSON.stringify(result.taskGuide)}`)
    }

    const outputResult = options.summary ? summarizeSmokeResult(result) : result
    if (options.summary && screenshotDirectory) {
      const summaryFile = await writeSmokeSummaryFile(screenshotDirectory, outputResult)
      const summaryLabel = path.relative(repoRoot, summaryFile).split(path.sep).join('/')
      progress('summary', `saved redacted JSON as ${summaryLabel}`)
    }
    console.log('[smoke] PASS')
    console.log(JSON.stringify(outputResult, null, 2))
  } catch (error) {
    if (appSession && screenshotDirectory) {
      await captureScreenshot(appSession, screenshotDirectory, 'failure').catch(() => undefined)
    }
    if (options.layoutFixture && childLog) {
      error.message +=
        `; childLifecycleEvents=${JSON.stringify(childLifecycleEvents)}` +
        `; childLifecycleLog=${childLifecycleLog || '(none)'}` +
        `; childLog=${childLog.slice(-12_000)}`
    }
    throw error
  } finally {
    activeRunDeadline = previousRunDeadline
    process.removeListener('SIGINT', onSignal)
    process.removeListener('SIGTERM', onSignal)
    await cleanup()
  }
}

if (require.main === module) {
  Promise.resolve()
    .then(() => parseArgs(process.argv.slice(2)))
    .then((options) => {
      if (options.help) {
        console.log(usage())
        return
      }
      return run(options)
    })
    .catch((error) => {
      console.error(`[smoke] FAIL: ${error.message}`)
      process.exitCode = 1
    })
}

module.exports = {
  CdpCommandTimeoutMs,
  AccountMergeFixtureBundleId,
  AccountRestoreFixtureAccount,
  AccountRestoreFixtureBundleId,
  AccountRestoreFailureFixtureBundleId,
  AccountRestoreRetentionFixtureBundleIds,
  DefaultPort,
  DefaultTimeoutMs,
  DefaultTotalTimeoutMs,
  DataUpdateFixtureQuestId,
  DataUpdateFixtureQuestTitle,
  DataUpdateFixtureStrategyVersion,
  DataUpdateFixtureStrategyRecipeId,
  DataUpdateFixtureMapAreaId,
  DataUpdateFixtureMapNo,
  DataUpdateFixtureMapPath,
  DataUpdateFixtureMapSpot,
  DisplayAcceptanceProfiles,
  LiveAcceptanceProfiles,
  GameStartSettleMs,
  GameStartPoint,
  GracefulExitTimeoutMs,
  GameOnlyResizeSweepSteps,
  gamePageFailure,
  gamePageStage,
  gameOnlyZoomStateMatches,
  muteReloadStateMatches,
  LayoutFixtureCapacityExpectation,
  LayoutFixtureCapacityBoundaryExpectations,
  titlebarCapacityFailure,
  capacityBoundaryFixtureFailure,
  captureNoticeFailure,
  recordingSaveFailure,
  transportFixtureFailure,
  battleResultFixtureFailure,
  proxyFixtureFailure,
  dataFolderFixtureFailure,
  createLayoutFixtureOptionSetting,
  MinimumWorkspaceHeight,
  MinimumWorkspaceWidth,
  SurfaceWorkspaceHeight,
  SurfaceWorkspaceWidth,
  IntermediateWorkspaceHeight,
  IntermediateWorkspaceWidth,
  NarrowWorkspaceHeight,
  NarrowWorkspaceWidth,
  ScreenshotCommandTimeoutMs,
  TallWorkspaceHeight,
  TallWorkspaceWidth,
  WideWorkspaceMinHeight,
  WideWorkspaceMinWidth,
  metricsAreContained,
  physicalDisplaySize,
  inspectDisplayAcceptanceProfile,
  missionCheckAcceptanceFailure,
  parseArgs,
  pseudoLocaleFailure,
  createSignedDataUpdateFixture,
  createDataUpdateFixture,
  startDataUpdateFixtureServer,
  dataUpdateDownloadFixtureState,
  dataUpdateInstalledBundleState,
  loadDataUpdatePublicKeyFile,
  createAccountRestoreFixture,
  accountMergeFixtureState,
  accountRestoreFixtureState,
  accountRestoreRetentionFixtureState,
  accountRestoreFailureFixtureState,
  inspectAccountBusinessFixture,
  scheduleRepeatedAccountRestoreFixture,
  scheduleCorruptAccountRestoreFixture,
  scheduleAccountRollbackFixture,
  scheduleAccountRedoFixture,
  accountRedoFixtureState,
  rectIsContained,
  rectsOverlap,
  WorkspaceResizeSweepSizes,
  workspaceFrameFailure,
  summarizeSmokeResult,
  writeSmokeSummaryFile,
  settingsPathForPlatform,
  waitForGracefulExit,
  usage,
  wideWorkspaceBounds,
  workspaceBoundsForSize,
  workspaceGameSizeForWindow
}

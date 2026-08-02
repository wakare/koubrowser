import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadActiveDataBundle } from '@main/data-update'

interface SmokeOptions {
  allowGameStart: boolean
  manualGameStart: boolean
  layoutFixture: boolean
  pseudoLocale: boolean
  dataUpdateFixture: boolean
  dataUpdateStagingManifestUrl?: string
  dataUpdatePublicKeyFile?: string
  accountRestoreFixture: boolean
  accountRestoreRecords: number
  summary: boolean
  workspacePages: boolean
  taskGuide: boolean
  taskGuideHiddenLayoutFixture: boolean
  taskGuideTallLayoutFixture: boolean
  taskGuideCustomLayoutFixture: boolean
  wideWorkspace: boolean
  requireDisplayProfile?: string
  requireLiveProfile?: string
  screenshotDir?: string
  port: number
  timeoutMs: number
  totalTimeoutMs: number
  help: boolean
}

interface SmokeRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

interface SmokeScript {
  AccountMergeFixtureBundleId: string
  AccountRestoreFixtureAccount: {
    serverId: number
    memberId: string
  }
  AccountRestoreFixtureBundleId: string
  AccountRestoreFailureFixtureBundleId: string
  AccountRestoreRetentionFixtureBundleIds: readonly string[]
  CdpCommandTimeoutMs: number
  DataUpdateFixtureMapAreaId: number
  DataUpdateFixtureMapNo: number
  DataUpdateFixtureMapPath: string
  DataUpdateFixtureMapSpot: {
    no: number
    label: string
    x: number
    y: number
    type: string
  }
  DataUpdateFixtureQuestId: number
  DataUpdateFixtureQuestTitle: string
  DataUpdateFixtureStrategyVersion: string
  DataUpdateFixtureStrategyRecipeId: string
  DisplayAcceptanceProfiles: readonly string[]
  LiveAcceptanceProfiles: readonly string[]
  DefaultPort: number
  DefaultTimeoutMs: number
  DefaultTotalTimeoutMs: number
  GameOnlyResizeSweepSteps: ReadonlyArray<{
    requestedWidth: number
    requestedHeight: number
    width: number
    height: number
    factor: number
  }>
  gamePageFailure: (
    result: {
      href?: string | null
      readyState?: string | null
    } | null
  ) => string | null
  gamePageStage: (
    result: {
      href?: string | null
      title?: string | null
      frame?: { width: number; height: number } | null
      canvases?: unknown[]
    } | null
  ) => string
  gameOnlyZoomStateMatches: (
    value: {
      surface?: string | null
      factor?: number | null
      width?: number | null
      height?: number | null
      documentOverflow?: boolean
    } | null,
    expected: {
      factor: number
      width: number
      height: number
    },
    sizeTolerance?: number
  ) => boolean
  LayoutFixtureCapacityExpectation: {
    shipText: string
    shipTitle: string
    slotitemText: string
    slotitemTitle: string
  }
  LayoutFixtureCapacityBoundaryExpectations: Record<
    'full' | 'overflow',
    {
      mode: 'full' | 'overflow'
      shipCount: number
      shipCapacity: number
      slotitemCount: number
      slotitemCapacity: number
      shipText: string
      shipTitle: string
      slotitemText: string
      slotitemTitle: string
    }
  >
  muteReloadStateMatches: (
    value: {
      timeOrigin?: number | null
      ready?: boolean
      muted?: boolean | null
    } | null,
    expectedMuted: boolean,
    previousTimeOrigin?: number
  ) => boolean
  titlebarCapacityFailure: (
    value: {
      titlebar?: SmokeRect | null
      status?: SmokeRect | null
      buttons?: SmokeRect | null
      ship?: {
        text: string
        title: string | null
        ariaLabel: string | null
        danger: boolean
        textOverflow: boolean
        rect: SmokeRect | null
      } | null
      slotitem?: {
        text: string
        title: string | null
        ariaLabel: string | null
        danger: boolean
        warning: boolean
        textOverflow: boolean
        rect: SmokeRect | null
      } | null
    } | null,
    expected?: {
      shipText: string
      shipTitle: string
      slotitemText: string
      slotitemTitle: string
    }
  ) => string | null
  capacityBoundaryFixtureFailure: (
    value: {
      parser?: {
        mode?: string
        shipCount?: number
        shipCapacity?: number
        slotitemCount?: number
        slotitemCapacity?: number
      } | null
      renderer?: Parameters<SmokeScript['titlebarCapacityFailure']>[0]
    } | null,
    expected: SmokeScript['LayoutFixtureCapacityBoundaryExpectations']['full']
  ) => string | null
  captureNoticeFailure: (
    value: {
      button?: {
        title: string | null
        ariaLabel: string | null
      } | null
      document?: SmokeRect | null
      notice?: {
        text: string
        role: string | null
        ariaLive: string | null
        success: boolean
        rect: SmokeRect | null
      } | null
      filename?: string | null
      file?: {
        exists: boolean
        filename: string
        size: number
        pngSignature: string
        width: number | null
        height: number | null
      } | null
      game?: {
        width: number
        height: number
      } | null
      customDirectory?: boolean
      defaultDirectoryUnused?: boolean
    } | null
  ) => string | null
  recordingSaveFailure: (
    value: {
      button?: {
        startTitle: string | null
        startAriaLabel: string | null
        checkedWhileRecording: boolean
        checkedAfterStop: boolean
      } | null
      startedNotice?: {
        text: string
        role: string | null
        ariaLive: string | null
        success: boolean
      } | null
      stoppedNotice?: {
        text: string
        role: string | null
        ariaLive: string | null
        success: boolean
      } | null
      filename?: string | null
      file?: {
        exists: boolean
        filename: string
        size: number
        webmSignature: string
      } | null
      recordingSource?: {
        target: string
        mediaSource: string
        width: number
        height: number
      } | null
      customDirectory?: boolean
      defaultDirectoryUnused?: boolean
    } | null
  ) => string | null
  transportFixtureFailure: (
    value: {
      panel?: SmokeRect | null
      body?: SmokeRect | null
      header?: SmokeRect | null
      viewport?: SmokeRect | null
      seventhShip?: SmokeRect | null
      label?: string | null
      value?: string | null
      title?: string | null
      shipCount?: number
      shipIds?: number[]
    } | null
  ) => string | null
  battleResultFixtureFailure: (
    value: {
      mainShipId?: number
      mainHp?: number
      escortShipId?: number
      escortHp?: number
      battleType?: number
      renderer?: {
        title?: string | null
        warning?: boolean
        shipId?: number
        nowHp?: number
        maxHp?: number
        hpState?: string | null
        game?: SmokeRect | null
        protection?: {
          role?: string | null
          modal?: string | null
          heading?: string | null
          description?: string | null
          button?: string | null
          rect?: SmokeRect | null
          ordinaryClickBlocked?: boolean
          ctrlBypass?: boolean
        } | null
      } | null
    } | null,
    requireBypassEvidence?: boolean
  ) => string | null
  proxyFixtureFailure: (
    value: {
      probeUrl?: string
      proxyRules?: string
      fixedResolution?: string
      restoredResolution?: string
      resolutionOnly?: boolean
    } | null
  ) => string | null
  dataFolderFixtureFailure: (
    value: {
      rendererOpened?: boolean
      opened?: boolean
      parentIsElectronUserData?: boolean
      directoryName?: string
      directoryExists?: boolean
    } | null
  ) => string | null
  createLayoutFixtureOptionSetting: (userDataRoot: string) => Promise<{
    captureDirectory: string
    defaultCaptureDirectory: string
  }>
  IntermediateWorkspaceHeight: number
  IntermediateWorkspaceWidth: number
  MinimumWorkspaceHeight: number
  MinimumWorkspaceWidth: number
  NarrowWorkspaceHeight: number
  NarrowWorkspaceWidth: number
  SurfaceWorkspaceHeight: number
  SurfaceWorkspaceWidth: number
  ScreenshotCommandTimeoutMs: number
  TallWorkspaceHeight: number
  TallWorkspaceWidth: number
  WideWorkspaceMinHeight: number
  WideWorkspaceMinWidth: number
  WorkspaceResizeSweepSizes: ReadonlyArray<{
    width: number
    height: number
  }>
  metricsAreContained: (
    metrics: {
      clientWidth: number
      scrollWidth: number
      clientHeight: number
      scrollHeight: number
    },
    tolerance?: number
  ) => boolean
  rectIsContained: (
    outer: {
      left: number
      top: number
      right: number
      bottom: number
    },
    inner: {
      left: number
      top: number
      right: number
      bottom: number
    },
    tolerance?: number
  ) => boolean
  rectsOverlap: (
    first: {
      left: number
      top: number
      right: number
      bottom: number
    },
    second: {
      left: number
      top: number
      right: number
      bottom: number
    },
    tolerance?: number
  ) => boolean
  workspaceFrameFailure: (
    frame: {
      surface: string | null
      ready: boolean
      document: {
        clientWidth: number
        scrollWidth: number
        clientHeight: number
        scrollHeight: number
      }
      scroll: {
        x: number
        y: number
      }
      viewport: SmokeRect
      main: SmokeRect | null
      primary: SmokeRect | null
      game: SmokeRect | null
      secondary: SmokeRect | null
    } | null,
    expectedGame: {
      width: number
      height: number
    },
    tolerance?: number
  ) => string | null
  parseArgs: (args: string[]) => SmokeOptions
  physicalDisplaySize: (display: {
    bounds?: { width?: number; height?: number }
    scaleFactor?: number
  }) => { width: number; height: number } | undefined
  inspectDisplayAcceptanceProfile: (
    profile: string,
    topology: {
      primaryDisplayId?: number
      displays?: Array<{
        id: number
        primary: boolean
        bounds: { x: number; y: number; width: number; height: number }
        workArea: { x: number; y: number; width: number; height: number }
        scaleFactor: number
        touchSupport: string
      }>
    }
  ) => {
    failure?: string
    profile: string
    displayIds?: number[]
    displays: unknown[]
  }
  missionCheckAcceptanceFailure: (
    result: {
      panel?: SmokeRect | null
      body?: SmokeRect | null
      content?: SmokeRect | null
      filterToggle?: SmokeRect | null
      filterContent?: SmokeRect | null
      hasExplicitError: boolean
      errorText?: string | null
      rowCount: number
      missionNames: string[]
    },
    expectedMissionName?: string
  ) => string | null
  pseudoLocaleFailure: (result: {
    localizationLocale?: string | null
    localizationSample?: string | null
  }) => string | null
  createDataUpdateFixture: (cacheRoot: string) => Promise<{
    publicKey: string
    dataVersion: string
    mapAreaId: number
    mapNo: number
    mapPath: string
    mapSpot: SmokeScript['DataUpdateFixtureMapSpot']
    questId: number
    questTitle: string
    manifest: Record<string, unknown>
    mapData: Buffer
    data: Buffer
  }>
  createSignedDataUpdateFixture: () => {
    publicKey: string
    dataVersion: string
    mapAreaId: number
    mapNo: number
    mapPath: string
    mapSpot: SmokeScript['DataUpdateFixtureMapSpot']
    questId: number
    questTitle: string
    manifest: Record<string, unknown>
    mapData: Buffer
    data: Buffer
  }
  startDataUpdateFixtureServer: (fixture: {
    manifest: Record<string, unknown>
    mapData: Buffer
    data: Buffer
  }) => Promise<{
    manifestUrl: string
    requests: Array<{ method: string; path: string }>
    close: () => Promise<void>
  }>
  dataUpdateDownloadFixtureState: (
    cacheRoot: string,
    fixture: {
      dataVersion: string
      mapPath: string
      mapData: Buffer
      data: Buffer
    },
    serverFixture: {
      requests: Array<{ method: string; path: string }>
    }
  ) => Promise<{
    ready: boolean
    version?: string
    requestPaths: string[]
  }>
  dataUpdateInstalledBundleState: (
    cacheRoot: string,
    publicKey: string
  ) => Promise<{
    ready: boolean
    source?: string
    version?: string
    fileCount?: number
    hasQuestKnowledge?: boolean
    publicKeySha256?: string
    mapAreaId?: number
    mapNo?: number
    mapPath?: string
    mapSpot?: SmokeScript['DataUpdateFixtureMapSpot']
    questId?: number
    questTitle?: string
  }>
  loadDataUpdatePublicKeyFile: (filename: string) => string
  createAccountRestoreFixture: (
    userDataRoot: string,
    recordsPerDatabase?: number
  ) => Promise<{
    appDataRoot: string
    accountName: string
    bundleId: string
    createdAt: string
    currentDirectory: string
    manifest: {
      summary: {
        records: number
      }
    }
    recordsPerDatabase: number
    rollbackDirectory: string
    stagingDirectory: string
    mergeBackupDirectory: string
    retentionHistory: Array<{
      bundleId: string
      createdAt: string
      directory: string
    }>
  }>
  accountMergeFixtureState: (
    fixture: {
      appDataRoot: string
      currentDirectory: string
      mergeStageName: string
      recordsPerDatabase: number
    },
    expectedPhase: 'merged' | 'rolled-back' | 'redone'
  ) => Promise<{
    ready: boolean
    phase: string
    current: string
    retained: string
  }>
  inspectAccountBusinessFixture: (
    session: {
      call: (method: string) => Promise<unknown>
    },
    fixture: {
      recordsPerDatabase: number
    },
    currentValue: string,
    merged: boolean
  ) => Promise<{
    currentValue: string
    merged: boolean
    portChartPoints: number
    dropRankS: number
  }>
  scheduleRepeatedAccountRestoreFixture: (fixture: {
    appDataRoot: string
    bundleId: string
    createdAt: string
    recordsPerDatabase: number
  }) => Promise<string>
  scheduleCorruptAccountRestoreFixture: (fixture: {
    appDataRoot: string
    recordsPerDatabase: number
  }) => Promise<{
    bundleId: string
    stagingDirectory: string
  }>
  scheduleAccountRollbackFixture: (fixture: {
    appDataRoot: string
    bundleId: string
  }) => Promise<void>
  scheduleAccountRedoFixture: (fixture: { appDataRoot: string; bundleId: string }) => Promise<void>
  settingsPathForPlatform: (
    platform: NodeJS.Platform,
    environment: NodeJS.ProcessEnv,
    homeDirectory: string
  ) => string
  waitForGracefulExit: (
    child: EventEmitter & {
      exitCode: number | null
      signalCode: string | null
    },
    timeoutMs: number,
    context: string
  ) => Promise<void>
  summarizeSmokeResult: (result: Record<string, unknown>) => Record<string, unknown>
  isRoutePanelAcceptanceMode: (options: Partial<SmokeOptions>) => boolean
  routePanelRestorationSummary: (
    before: {
      workspaceLayout: string | null
      panelViewState: string | null
      activePages: Record<string, string | null>
      editorOpen: Record<string, boolean>
      questFilter: string | null
    },
    after: {
      workspaceLayout: string | null
      panelViewState: string | null
      activePages: Record<string, string | null>
      editorOpen: Record<string, boolean>
      questFilter: string | null
    }
  ) => {
    pageNamesOrderVisibilityRestored: boolean
    activePagesRestored: boolean
    panelEditorsRestored: boolean
    questFilterRestored: boolean
  }
  selectRoutePanelControlledSize: (
    workArea: { width: number; height: number },
    currentSize: { width: number; height: number }
  ) => { width: number; height: number }
  writeSmokeSummaryFile: (
    directory: string | undefined,
    summary: Record<string, unknown>
  ) => Promise<string | undefined>
  usage: () => string
  wideWorkspaceBounds: (availableWorkArea: {
    left: number
    top: number
    width: number
    height: number
  }) => {
    left: number
    top: number
    width: number
    height: number
  }
  workspaceBoundsForSize: (
    availableWorkArea: {
      left: number
      top: number
      width: number
      height: number
    },
    width: number,
    height: number,
    preferredPosition?: {
      left: number
      top: number
    }
  ) => {
    left: number
    top: number
    width: number
    height: number
  }
  workspaceGameSizeForWindow: (
    width: number,
    height: number
  ) => {
    width: number
    height: number
    scale: number
  }
}

const smoke = require('../../../scripts/electron-smoke.js') as SmokeScript
const temporaryDirectories: string[] = []

afterEach(() => {
  vi.useRealTimers()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('Electron smoke script', () => {
  it('accepts a real graceful process exit during restart verification', async () => {
    vi.useFakeTimers()
    const child = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
      signalCode: null as string | null
    })
    const exited = smoke.waitForGracefulExit(child, 50, 'Test Electron')

    child.exitCode = 0
    child.emit('exit', 0, null)

    await expect(exited).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects restart verification instead of hiding a stuck process with force-kill', async () => {
    vi.useFakeTimers()
    const child = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
      signalCode: null as string | null
    })
    const exited = smoke.waitForGracefulExit(child, 50, 'Test Electron')

    const expectation = expect(exited).rejects.toThrow(
      'Test Electron did not exit gracefully within 50 ms'
    )
    await vi.advanceTimersByTimeAsync(50)
    await expectation
    expect(child.listenerCount('exit')).toBe(0)
  })

  it('allows high-DPI screenshot capture more time than ordinary commands', () => {
    expect(smoke.ScreenshotCommandTimeoutMs).toBeGreaterThan(smoke.CdpCommandTimeoutMs)
  })

  it('keeps live GAME START interaction opt-in', () => {
    expect(smoke.parseArgs([])).toEqual({
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
      taskGuideHiddenLayoutFixture: false,
      taskGuideTallLayoutFixture: false,
      taskGuideCustomLayoutFixture: false,
      wideWorkspace: false,
      requireDisplayProfile: undefined,
      requireLiveProfile: undefined,
      screenshotDir: undefined,
      port: smoke.DefaultPort,
      timeoutMs: smoke.DefaultTimeoutMs,
      totalTimeoutMs: smoke.DefaultTotalTimeoutMs,
      help: false
    })
    expect(
      smoke.parseArgs([
        '--allow-game-start',
        '--workspace-pages',
        '--task-guide',
        '--wide-workspace',
        '--port',
        '9333',
        '--timeout',
        '45000',
        '--total-timeout',
        '180000',
        '--screenshot-dir',
        'output/layout-smoke-test'
      ])
    ).toEqual({
      allowGameStart: true,
      manualGameStart: false,
      layoutFixture: false,
      pseudoLocale: false,
      dataUpdateFixture: false,
      dataUpdateStagingManifestUrl: undefined,
      dataUpdatePublicKeyFile: undefined,
      accountRestoreFixture: false,
      accountRestoreRecords: 1,
      summary: false,
      workspacePages: true,
      taskGuide: true,
      taskGuideHiddenLayoutFixture: false,
      taskGuideTallLayoutFixture: false,
      taskGuideCustomLayoutFixture: false,
      wideWorkspace: true,
      requireDisplayProfile: undefined,
      requireLiveProfile: undefined,
      screenshotDir: 'output/layout-smoke-test',
      port: 9333,
      timeoutMs: 45000,
      totalTimeoutMs: 180000,
      help: false
    })
    expect(smoke.usage()).toContain(
      'Without --allow-game-start, --manual-game-start, or --layout-fixture the script only checks'
    )
    expect(
      smoke.parseArgs(['--layout-fixture', '--workspace-pages', '--wide-workspace'])
    ).toMatchObject({
      allowGameStart: false,
      manualGameStart: false,
      layoutFixture: true,
      pseudoLocale: false,
      dataUpdateFixture: false,
      accountRestoreFixture: false,
      accountRestoreRecords: 1,
      workspacePages: true,
      taskGuide: false,
      wideWorkspace: true
    })
    expect(
      smoke.parseArgs(['--layout-fixture', '--data-update-fixture', '--task-guide'])
    ).toMatchObject({
      layoutFixture: true,
      dataUpdateFixture: true,
      taskGuide: true
    })
    expect(
      smoke.parseArgs([
        '--layout-fixture',
        '--data-update-fixture',
        '--task-guide',
        '--task-guide-hidden-layout-fixture'
      ])
    ).toMatchObject({
      layoutFixture: true,
      dataUpdateFixture: true,
      taskGuide: true,
      taskGuideHiddenLayoutFixture: true
    })
    expect(
      smoke.parseArgs([
        '--layout-fixture',
        '--data-update-fixture',
        '--task-guide',
        '--task-guide-tall-layout-fixture'
      ])
    ).toMatchObject({
      layoutFixture: true,
      dataUpdateFixture: true,
      taskGuide: true,
      taskGuideTallLayoutFixture: true
    })
    expect(
      smoke.parseArgs([
        '--layout-fixture',
        '--data-update-fixture',
        '--task-guide',
        '--wide-workspace',
        '--task-guide-custom-layout-fixture'
      ])
    ).toMatchObject({
      layoutFixture: true,
      dataUpdateFixture: true,
      taskGuide: true,
      wideWorkspace: true,
      taskGuideCustomLayoutFixture: true
    })
    expect(
      smoke.parseArgs([
        '--layout-fixture',
        '--task-guide',
        '--data-update-staging-manifest',
        'https://updates.example/koubrowser/manifest.json',
        '--data-update-public-key-file',
        'path/to/public-key.txt'
      ])
    ).toMatchObject({
      layoutFixture: true,
      taskGuide: true,
      dataUpdateFixture: false,
      dataUpdateStagingManifestUrl: 'https://updates.example/koubrowser/manifest.json',
      dataUpdatePublicKeyFile: 'path/to/public-key.txt'
    })
    expect(smoke.parseArgs(['--layout-fixture', '--pseudo-locale'])).toMatchObject({
      layoutFixture: true,
      pseudoLocale: true
    })
    expect(
      smoke.parseArgs([
        '--layout-fixture',
        '--account-restore-fixture',
        '--account-restore-records',
        '10000'
      ])
    ).toMatchObject({
      layoutFixture: true,
      accountRestoreFixture: true,
      accountRestoreRecords: 10000
    })
    expect(smoke.parseArgs(['--summary'])).toMatchObject({ summary: true })
    expect(
      smoke.parseArgs([
        '--layout-fixture',
        '--workspace-pages',
        '--wide-workspace',
        '--require-display-profile',
        'issue-34'
      ])
    ).toMatchObject({
      layoutFixture: true,
      workspacePages: true,
      wideWorkspace: true,
      requireDisplayProfile: 'issue-34'
    })
    expect(
      smoke.parseArgs([
        '--manual-game-start',
        '--workspace-pages',
        '--task-guide',
        '--wide-workspace',
        '--require-live-profile',
        'issue-30'
      ])
    ).toMatchObject({
      allowGameStart: false,
      manualGameStart: true,
      layoutFixture: false,
      pseudoLocale: false,
      dataUpdateFixture: false,
      workspacePages: true,
      taskGuide: true,
      wideWorkspace: true,
      requireLiveProfile: 'issue-30'
    })
  })

  it('separates route-panel acceptance from generic wide-workspace regression', () => {
    expect(
      smoke.isRoutePanelAcceptanceMode({
        manualGameStart: true,
        taskGuide: true,
        wideWorkspace: true
      })
    ).toBe(true)
    expect(
      smoke.isRoutePanelAcceptanceMode({
        allowGameStart: true,
        taskGuide: true,
        wideWorkspace: true
      })
    ).toBe(false)
    expect(
      smoke.isRoutePanelAcceptanceMode({
        layoutFixture: true,
        taskGuide: true,
        wideWorkspace: true,
        taskGuideCustomLayoutFixture: true
      })
    ).toBe(true)

    expect(
      smoke.selectRoutePanelControlledSize(
        { width: 1920, height: 1040 },
        { width: 1600, height: 800 }
      )
    ).toEqual({ width: 1440, height: 800 })
    expect(() =>
      smoke.selectRoutePanelControlledSize(
        { width: 1200, height: 700 },
        { width: 1200, height: 700 }
      )
    ).toThrow('ROUTE_PANEL_CONTROLLED_SIZE_UNAVAILABLE')
  })

  it('reports custom layout restoration without returning page names or identifiers', () => {
    const before = {
      workspaceLayout: '{"pages":[{"title":"private"}]}',
      panelViewState: '{"activeWorkspacePages":{"secondary":"user-private"}}',
      activePages: { primary: 'primary-overview', secondary: 'user-private' },
      editorOpen: { primary: false, secondary: false },
      questFilter: 'current'
    }
    expect(smoke.routePanelRestorationSummary(before, { ...before })).toEqual({
      pageNamesOrderVisibilityRestored: true,
      activePagesRestored: true,
      panelEditorsRestored: true,
      questFilterRestored: true
    })
    const changed = smoke.routePanelRestorationSummary(before, {
      ...before,
      workspaceLayout: '{"pages":[{"title":"changed"}]}'
    })
    expect(changed.pageNamesOrderVisibilityRestored).toBe(false)
    expect(JSON.stringify(changed)).not.toContain('private')
    expect(JSON.stringify(changed)).not.toContain('user-')
  })

  it('rejects unsafe or incomplete command options', () => {
    expect(() => smoke.parseArgs(['--task-guide'])).toThrow(
      '--task-guide requires --allow-game-start, --manual-game-start, or --layout-fixture'
    )
    expect(() =>
      smoke.parseArgs(['--layout-fixture', '--task-guide-hidden-layout-fixture'])
    ).toThrow(
      '--task-guide-hidden-layout-fixture requires --layout-fixture and --task-guide'
    )
    expect(() =>
      smoke.parseArgs(['--layout-fixture', '--task-guide-tall-layout-fixture'])
    ).toThrow(
      '--task-guide-tall-layout-fixture requires --layout-fixture and --task-guide'
    )
    expect(() =>
      smoke.parseArgs([
        '--layout-fixture',
        '--task-guide',
        '--task-guide-hidden-layout-fixture',
        '--task-guide-tall-layout-fixture'
      ])
    ).toThrow(
      '--task-guide layout fixtures are mutually exclusive'
    )
    expect(() =>
      smoke.parseArgs([
        '--layout-fixture',
        '--task-guide',
        '--wide-workspace',
        '--task-guide-custom-layout-fixture'
      ])
    ).toThrow(
      '--task-guide-custom-layout-fixture requires --layout-fixture, --data-update-fixture, --task-guide, and --wide-workspace'
    )
    expect(() =>
      smoke.parseArgs([
        '--layout-fixture',
        '--data-update-fixture',
        '--task-guide',
        '--wide-workspace',
        '--task-guide-tall-layout-fixture',
        '--task-guide-custom-layout-fixture'
      ])
    ).toThrow('--task-guide layout fixtures are mutually exclusive')
    expect(() => smoke.parseArgs(['--data-update-fixture', '--task-guide'])).toThrow(
      '--data-update-fixture requires --layout-fixture'
    )
    expect(() => smoke.parseArgs(['--pseudo-locale'])).toThrow(
      '--pseudo-locale requires --layout-fixture'
    )
    expect(() => smoke.parseArgs(['--account-restore-fixture'])).toThrow(
      '--account-restore-fixture requires --layout-fixture'
    )
    expect(() => smoke.parseArgs(['--account-restore-records', '10'])).toThrow(
      '--account-restore-records requires --account-restore-fixture'
    )
    expect(() =>
      smoke.parseArgs([
        '--layout-fixture',
        '--account-restore-fixture',
        '--account-restore-records',
        '0'
      ])
    ).toThrow('Invalid account restore record count')
    expect(() =>
      smoke.parseArgs([
        '--layout-fixture',
        '--account-restore-fixture',
        '--data-update-fixture',
        '--task-guide'
      ])
    ).toThrow('--account-restore-fixture and data-update acceptance are mutually exclusive')
    expect(() =>
      smoke.parseArgs([
        '--layout-fixture',
        '--task-guide',
        '--data-update-staging-manifest',
        'https://updates.example/manifest.json'
      ])
    ).toThrow('--data-update-staging-manifest and --data-update-public-key-file are both required')
    expect(() =>
      smoke.parseArgs([
        '--layout-fixture',
        '--task-guide',
        '--data-update-staging-manifest',
        'http://updates.example/manifest.json',
        '--data-update-public-key-file',
        'public-key.txt'
      ])
    ).toThrow('Data-update staging manifest must be an HTTPS URL')
    expect(() =>
      smoke.parseArgs([
        '--layout-fixture',
        '--task-guide',
        '--data-update-fixture',
        '--data-update-staging-manifest',
        'https://updates.example/manifest.json',
        '--data-update-public-key-file',
        'public-key.txt'
      ])
    ).toThrow('--data-update-fixture and data-update staging acceptance are mutually exclusive')
    expect(() =>
      smoke.parseArgs([
        '--data-update-staging-manifest',
        'https://updates.example/manifest.json',
        '--data-update-public-key-file',
        'public-key.txt'
      ])
    ).toThrow('Data-update staging acceptance requires --layout-fixture and --task-guide')
    expect(() => smoke.parseArgs(['--layout-fixture', '--data-update-fixture'])).toThrow(
      '--data-update-fixture requires --task-guide'
    )
    expect(() => smoke.parseArgs(['--workspace-pages'])).toThrow(
      '--workspace-pages requires --allow-game-start, --manual-game-start, or --layout-fixture'
    )
    expect(() => smoke.parseArgs(['--wide-workspace'])).toThrow(
      '--wide-workspace requires --allow-game-start, --manual-game-start, or --layout-fixture'
    )
    expect(() =>
      smoke.parseArgs([
        '--layout-fixture',
        '--workspace-pages',
        '--wide-workspace',
        '--require-display-profile',
        'issue-99'
      ])
    ).toThrow('Invalid display acceptance profile')
    expect(() =>
      smoke.parseArgs(['--layout-fixture', '--require-display-profile', 'issue-23'])
    ).toThrow(
      '--require-display-profile requires --layout-fixture, --workspace-pages, and --wide-workspace'
    )
    expect(() =>
      smoke.parseArgs([
        '--manual-game-start',
        '--workspace-pages',
        '--require-live-profile',
        'issue-99'
      ])
    ).toThrow('Invalid live acceptance profile')
    expect(() => smoke.parseArgs(['--require-live-profile', 'issue-30'])).toThrow(
      '--require-live-profile requires --manual-game-start and --workspace-pages'
    )
    expect(() =>
      smoke.parseArgs([
        '--layout-fixture',
        '--workspace-pages',
        '--require-live-profile',
        'issue-30'
      ])
    ).toThrow('--require-live-profile requires --manual-game-start and --workspace-pages')
    expect(() => smoke.parseArgs(['--allow-game-start', '--layout-fixture'])).toThrow(
      '--allow-game-start, --manual-game-start, and --layout-fixture are mutually exclusive'
    )
    expect(() => smoke.parseArgs(['--allow-game-start', '--manual-game-start'])).toThrow(
      '--allow-game-start, --manual-game-start, and --layout-fixture are mutually exclusive'
    )
    expect(() => smoke.parseArgs(['--port', '80'])).toThrow('Invalid DevTools port')
    expect(() => smoke.parseArgs(['--timeout', '999'])).toThrow('Invalid timeout')
    expect(() => smoke.parseArgs(['--total-timeout', '999'])).toThrow('Invalid total timeout')
    expect(() => smoke.parseArgs(['--timeout', '60000', '--total-timeout', '30000'])).toThrow(
      'Total timeout must be greater than or equal to the per-stage timeout'
    )
    expect(() => smoke.parseArgs(['--screenshot-dir', ''])).toThrow(
      'Screenshot directory must not be empty'
    )
    expect(() => smoke.parseArgs(['--unknown'])).toThrow('Unknown option')
  })

  it('matches the physical Surface Pro display and touch gate for issue #23', () => {
    const surface = {
      id: 23,
      primary: true,
      bounds: { x: 0, y: 0, width: 1440, height: 960 },
      workArea: { x: 0, y: 0, width: 1440, height: 928 },
      scaleFactor: 2,
      touchSupport: 'available'
    }

    expect(smoke.physicalDisplaySize(surface)).toEqual({
      width: 2880,
      height: 1920
    })
    expect(
      smoke.inspectDisplayAcceptanceProfile('issue-23', {
        primaryDisplayId: surface.id,
        displays: [surface]
      })
    ).toMatchObject({
      profile: 'issue-23',
      displayIds: [23],
      displays: [surface]
    })
    expect(
      smoke.inspectDisplayAcceptanceProfile('issue-23', {
        primaryDisplayId: surface.id,
        displays: [{ ...surface, touchSupport: 'unknown' }]
      }).failure
    ).toContain('touch-enabled 2880x1920 display at 200% scaling')
  })

  it('matches the exact primary and secondary monitor pair for issue #34', () => {
    const primary = {
      id: 341,
      primary: true,
      bounds: { x: 0, y: 0, width: 1536, height: 864 },
      workArea: { x: 0, y: 0, width: 1536, height: 824 },
      scaleFactor: 1.25,
      touchSupport: 'unknown'
    }
    const secondary = {
      id: 342,
      primary: false,
      bounds: { x: 1536, y: 0, width: 1536, height: 960 },
      workArea: { x: 1536, y: 0, width: 1536, height: 920 },
      scaleFactor: 1.25,
      touchSupport: 'unknown'
    }

    expect(
      smoke.inspectDisplayAcceptanceProfile('issue-34', {
        primaryDisplayId: primary.id,
        displays: [secondary, primary]
      })
    ).toMatchObject({
      profile: 'issue-34',
      displayIds: [341, 342],
      displays: [primary, secondary]
    })
    expect(
      smoke.inspectDisplayAcceptanceProfile('issue-34', {
        primaryDisplayId: secondary.id,
        displays: [secondary, primary]
      }).failure
    ).toContain('1920x1080 primary display')
  })

  it('requires visible mission rows without an explicit error for issue #30', () => {
    const panel = {
      left: 0,
      top: 0,
      right: 300,
      bottom: 300,
      width: 300,
      height: 300
    }
    const valid = {
      panel,
      body: {
        left: 5,
        top: 5,
        right: 295,
        bottom: 295,
        width: 290,
        height: 290
      },
      content: {
        left: 10,
        top: 10,
        right: 290,
        bottom: 290,
        width: 280,
        height: 280
      },
      filterToggle: {
        left: 15,
        top: 15,
        right: 150,
        bottom: 45,
        width: 135,
        height: 30
      },
      hasExplicitError: false,
      errorText: null,
      rowCount: 1,
      missionNames: ['1: 練習航海']
    }

    expect(smoke.LiveAcceptanceProfiles).toEqual(['issue-30'])
    expect(smoke.missionCheckAcceptanceFailure(valid)).toBeNull()
    expect(
      smoke.missionCheckAcceptanceFailure({
        ...valid,
        filterToggle: {
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0
        },
        filterContent: valid.filterToggle
      })
    ).toBeNull()
    expect(
      smoke.missionCheckAcceptanceFailure({
        ...valid,
        rowCount: 0,
        missionNames: []
      })
    ).toContain('rendered no missions')
    expect(
      smoke.missionCheckAcceptanceFailure({
        ...valid,
        hasExplicitError: true,
        errorText: 'panel failed'
      })
    ).toContain('explicit error')
    expect(smoke.missionCheckAcceptanceFailure(valid, '長距離練習航海')).toContain(
      'did not render 長距離練習航海'
    )
  })

  it('requires an expanded renderer component sample for the pseudo locale', () => {
    expect(
      smoke.pseudoLocaleFailure({
        localizationLocale: 'en-XA',
        localizationSample: '［戦戦果果］'
      })
    ).toBeNull()
    expect(
      smoke.pseudoLocaleFailure({
        localizationLocale: 'ja-JP',
        localizationSample: '［戦戦果果］'
      })
    ).toContain('Expected en-XA')
    expect(
      smoke.pseudoLocaleFailure({
        localizationLocale: 'en-XA',
        localizationSample: '戦果'
      })
    ).toContain('component sample is invalid')
  })

  it('creates a client-verifiable signed map and quest-knowledge fixture', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'koubrowser-smoke-test-'))
    temporaryDirectories.push(directory)

    const fixture = await smoke.createDataUpdateFixture(directory)
    const active = loadActiveDataBundle(directory, fixture.publicKey)

    expect(active?.manifest.dataVersion).toBe(fixture.dataVersion)
    expect(active?.directory).toContain(path.join('data-updates', 'versions'))
    expect(
      JSON.parse(readFileSync(path.join(active?.directory ?? '', fixture.mapPath), 'utf8'))
    ).toMatchObject({
      spots: [smoke.DataUpdateFixtureMapSpot]
    })
    expect(fixture).toEqual(
      expect.objectContaining({
        mapAreaId: smoke.DataUpdateFixtureMapAreaId,
        mapNo: smoke.DataUpdateFixtureMapNo,
        mapPath: smoke.DataUpdateFixtureMapPath,
        mapSpot: smoke.DataUpdateFixtureMapSpot,
        questId: smoke.DataUpdateFixtureQuestId,
        questTitle: smoke.DataUpdateFixtureQuestTitle
      })
    )
  })

  it('derives redacted staging expectations from an installed verified bundle', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'koubrowser-smoke-test-'))
    temporaryDirectories.push(directory)
    const fixture = await smoke.createDataUpdateFixture(directory)
    const publicKeyFile = path.join(directory, 'public-key.txt')
    const publicKeyFingerprint = createHash('sha256')
      .update(Buffer.from(fixture.publicKey, 'base64'))
      .digest('hex')
    writeFileSync(publicKeyFile, `${fixture.publicKey}\n`, 'utf8')

    expect(smoke.loadDataUpdatePublicKeyFile(publicKeyFile)).toBe(fixture.publicKey)
    await expect(
      smoke.dataUpdateInstalledBundleState(directory, fixture.publicKey)
    ).resolves.toMatchObject({
      ready: true,
      source: 'https-staging',
      version: fixture.dataVersion,
      fileCount: 2,
      hasQuestKnowledge: true,
      publicKeySha256: publicKeyFingerprint,
      mapAreaId: fixture.mapAreaId,
      mapNo: fixture.mapNo,
      mapPath: fixture.mapPath,
      mapSpot: fixture.mapSpot,
      questId: fixture.questId,
      questTitle: fixture.questTitle
    })

    writeFileSync(publicKeyFile, 'not-a-public-key\n', 'utf8')
    expect(() => smoke.loadDataUpdatePublicKeyFile(publicKeyFile)).toThrow(
      'Ed25519 DER SPKI Base64 key'
    )

    writeFileSync(
      path.join(directory, 'data-updates', 'active.json'),
      JSON.stringify({ version: '../outside' }),
      'utf8'
    )
    await expect(
      smoke.dataUpdateInstalledBundleState(directory, fixture.publicKey)
    ).resolves.toEqual({ ready: false })
  })

  it('serves and recognizes the signed data-update download fixture', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'koubrowser-smoke-test-'))
    temporaryDirectories.push(directory)
    const fixture = await smoke.createDataUpdateFixture(directory)
    const server = await smoke.startDataUpdateFixtureServer(fixture)

    try {
      const manifestResponse = await fetch(server.manifestUrl)
      const questResponse = await fetch(
        new URL('quest/knowledge.json', server.manifestUrl).toString()
      )
      const mapResponse = await fetch(
        new URL(smoke.DataUpdateFixtureMapPath, server.manifestUrl).toString()
      )

      expect(manifestResponse.ok).toBe(true)
      expect(mapResponse.ok).toBe(true)
      expect(questResponse.ok).toBe(true)
      expect(await manifestResponse.json()).toMatchObject({
        dataVersion: fixture.dataVersion
      })
      expect(Buffer.from(await mapResponse.arrayBuffer())).toEqual(fixture.mapData)
      expect(Buffer.from(await questResponse.arrayBuffer())).toEqual(fixture.data)
      await expect(
        smoke.dataUpdateDownloadFixtureState(directory, fixture, server)
      ).resolves.toMatchObject({
        ready: true,
        version: fixture.dataVersion,
        requestPaths: [
          '/koubrowser-smoke/manifest.json',
          '/koubrowser-smoke/quest/knowledge.json',
          '/koubrowser-smoke/map/001_01_map.json'
        ]
      })
    } finally {
      await server.close()
    }
  })

  it('creates strict isolated account restore and rollback fixtures', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'koubrowser-smoke-test-'))
    temporaryDirectories.push(directory)

    const fixture = await smoke.createAccountRestoreFixture(directory, 3)
    const pending = JSON.parse(
      readFileSync(path.join(fixture.appDataRoot, 'account-restore-pending.json'), 'utf8')
    )
    const stage = JSON.parse(
      readFileSync(path.join(fixture.stagingDirectory, 'stage.json'), 'utf8')
    )

    expect(fixture.accountName).toBe('3_12345678')
    expect(fixture.bundleId).toBe(smoke.AccountRestoreFixtureBundleId)
    expect(pending).toMatchObject({
      schemaVersion: 1,
      phase: 'ready',
      hadCurrent: null,
      manifest: {
        account: smoke.AccountRestoreFixtureAccount,
        summary: {
          databaseFiles: 9,
          profileFiles: 0,
          records: 27
        }
      }
    })
    expect(stage.manifest).toEqual(pending.manifest)
    expect(stage.manifest.files).toHaveLength(9)
    const mergeManifest = JSON.parse(
      readFileSync(path.join(fixture.mergeBackupDirectory, 'manifest.json'), 'utf8')
    )
    expect(mergeManifest).toMatchObject({
      schemaVersion: 1,
      bundleId: smoke.AccountMergeFixtureBundleId,
      account: smoke.AccountRestoreFixtureAccount,
      summary: {
        databaseFiles: 9,
        profileFiles: 0,
        records: 9
      }
    })
    expect(mergeManifest.files).toHaveLength(9)
    for (const file of mergeManifest.files) {
      const record = JSON.parse(
        readFileSync(
          path.join(fixture.mergeBackupDirectory, ...file.path.split('/')),
          'utf8'
        ).trim()
      )
      if (file.path === 'data/quest.db') {
        expect(record).toMatchObject({
          _id: 'quest-monotonic-smoke-incoming',
          no: 900001,
          dateKey: 'daily-20260730',
          quest: {
            api_no: 900001,
            api_state: 3,
            api_progress_flag: 2
          },
          state: {
            count: [2, 2],
            countMax: [5, 3]
          }
        })
      } else {
        expect(record).toMatchObject({
          fixture: 'account-merge',
          value: 'merge-safe',
          recordIdentity: {
            schemaVersion: 1,
            index: 0
          }
        })
        expect(record.recordIdentity.recordId).toMatch(/^[0-9a-f-]{36}$/u)
      }
    }
    expect(fixture.retentionHistory.map((entry) => entry.bundleId)).toEqual(
      smoke.AccountRestoreRetentionFixtureBundleIds
    )
    for (const generation of fixture.retentionHistory) {
      const metadata = JSON.parse(
        readFileSync(path.join(generation.directory, 'rollback.json'), 'utf8')
      )
      expect(metadata).toMatchObject({
        schemaVersion: 1,
        createdAt: generation.createdAt,
        hadCurrent: true,
        incomingManifest: {
          bundleId: generation.bundleId,
          account: smoke.AccountRestoreFixtureAccount
        }
      })
      expect(metadata.databaseFiles).toHaveLength(9)
    }
    expect(
      readFileSync(path.join(fixture.stagingDirectory, 'account', 'quest.db'), 'utf8')
        .trim()
        .split(/\r?\n/)
    ).toHaveLength(3)
    const portRecord = JSON.parse(
      readFileSync(path.join(fixture.stagingDirectory, 'account', 'port.db'), 'utf8')
        .trim()
        .split(/\r?\n/)[0]
    )
    expect(portRecord).toMatchObject({
      fixture: 'account-restore',
      value: 'incoming',
      date: '2026-01-01T00:00:00.000Z',
      31: 10000,
      34: 40000
    })
    const dropRecord = JSON.parse(
      readFileSync(path.join(fixture.stagingDirectory, 'account', 'drop.db'), 'utf8')
        .trim()
        .split(/\r?\n/)[0]
    )
    expect(dropRecord).toMatchObject({
      fixture: 'account-restore',
      value: 'incoming',
      mapId: 11,
      cellId: 1,
      shipId: 100,
      rank: 'S'
    })

    await smoke.scheduleAccountRollbackFixture(fixture)
    expect(
      JSON.parse(
        readFileSync(path.join(fixture.appDataRoot, 'account-rollback-pending.json'), 'utf8')
      )
    ).toMatchObject({
      schemaVersion: 1,
      phase: 'ready',
      bundleId: smoke.AccountRestoreFixtureBundleId,
      account: smoke.AccountRestoreFixtureAccount
    })

    await smoke.scheduleAccountRedoFixture(fixture)
    expect(
      JSON.parse(readFileSync(path.join(fixture.appDataRoot, 'account-redo-pending.json'), 'utf8'))
    ).toMatchObject({
      schemaVersion: 1,
      phase: 'ready',
      bundleId: smoke.AccountRestoreFixtureBundleId,
      account: smoke.AccountRestoreFixtureAccount
    })
  })

  it('checks restored histories and business aggregates together', async () => {
    const histories = Object.fromEntries(
      ['port', 'battle', 'drop', 'mission', 'quest', 'clearitemget'].map((dbName) => [
        dbName,
        {
          records: dbName === 'quest' ? 2 : 3,
          values: {
            incoming: 2,
            ...(dbName === 'quest' ? {} : { 'merge-safe': 1 })
          }
        }
      ])
    )
    const session = {
      call: async (method: string) => {
        expect(method).toBe('Smoke.inspectAccountRestoreFixtureData')
        return {
          histories,
          portChartPoints: 3,
          dropRankS: 3
        }
      }
    }

    await expect(
      smoke.inspectAccountBusinessFixture(session, { recordsPerDatabase: 2 }, 'incoming', true)
    ).resolves.toMatchObject({
      currentValue: 'incoming',
      merged: true,
      portChartPoints: 3,
      dropRankS: 3
    })
  })

  it('creates repeat and corrupt restore candidates deterministically', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'koubrowser-smoke-test-'))
    temporaryDirectories.push(directory)
    const fixture = await smoke.createAccountRestoreFixture(directory, 2)
    rmSync(path.join(fixture.appDataRoot, 'account-restore-pending.json'))
    rmSync(fixture.stagingDirectory, { recursive: true })

    const repeatedStage = await smoke.scheduleRepeatedAccountRestoreFixture(fixture)
    const repeated = JSON.parse(readFileSync(path.join(repeatedStage, 'stage.json'), 'utf8'))
    expect(repeated.manifest).toEqual(fixture.manifest)

    rmSync(path.join(fixture.appDataRoot, 'account-restore-pending.json'))
    rmSync(repeatedStage, { recursive: true })
    const corrupt = await smoke.scheduleCorruptAccountRestoreFixture(fixture)
    const corruptStage = JSON.parse(
      readFileSync(path.join(corrupt.stagingDirectory, 'stage.json'), 'utf8')
    )
    const quest = corruptStage.manifest.files.find(
      (file: { path: string }) => file.path === 'data/quest.db'
    )
    expect(corrupt.bundleId).toBe(smoke.AccountRestoreFailureFixtureBundleId)
    expect(
      statSync(path.join(corrupt.stagingDirectory, 'account', 'quest.db')).size
    ).toBeGreaterThan(quest!.size)
  })

  it('fails fast only for Chromium game-page load errors', () => {
    expect(smoke.gamePageFailure({ href: 'chrome-error://chromewebdata/' })).toBe(
      'The DMM game page failed to load in Chromium.'
    )
    expect(
      smoke.gamePageFailure({
        href: 'https://play.games.dmm.com/game/kancolle'
      })
    ).toBeNull()
    expect(
      smoke.gamePageFailure({
        href: 'https://games.dmm.com/detail/kancolle',
        readyState: 'complete'
      })
    ).toBe('DMM opened the public KanColle detail page instead of the signed-in play surface.')
    expect(
      smoke.gamePageFailure({
        href: 'https://games.dmm.com/detail/kancolle',
        readyState: 'loading'
      })
    ).toBeNull()
    expect(
      smoke.gamePageFailure({
        href: 'https://accounts.dmm.com/service/login/password',
        readyState: 'complete'
      })
    ).toContain('DMM login is required')
    expect(
      smoke.gamePageFailure({
        href: 'https://www.dmm.com/netgame/feature/kancolle.html',
        readyState: 'complete'
      })
    ).toContain('public KanColle detail page')
    expect(smoke.gamePageFailure({ href: 'about:blank' })).toBeNull()
    expect(smoke.gamePageFailure(null)).toBeNull()
  })

  it('classifies actionable live game stages', () => {
    expect(
      smoke.gamePageStage({
        href: 'https://accounts.dmm.com/service/login/password'
      })
    ).toBe('login-required')
    expect(
      smoke.gamePageStage({
        href: 'https://play.games.dmm.com/game/kancolle',
        frame: { width: 1200, height: 720 }
      })
    ).toBe('game-start')
    expect(
      smoke.gamePageStage({
        href: 'https://play.games.dmm.com/game/kancolle',
        title: 'Now loading...'
      })
    ).toBe('game-loading')
    expect(smoke.gamePageStage({ href: 'about:blank', canvases: [{}] })).toBe('game-content')
  })

  it('requires zoom shortcuts to preserve both the owned factor and game geometry', () => {
    const expected = {
      factor: 0.75,
      width: 900,
      height: 540
    }
    expect(
      smoke.gameOnlyZoomStateMatches(
        {
          surface: 'game-only',
          factor: 0.75,
          width: 900,
          height: 540,
          documentOverflow: false
        },
        expected
      )
    ).toBe(true)
    expect(
      smoke.gameOnlyZoomStateMatches(
        {
          surface: 'game-only',
          factor: 0.75,
          width: 1800,
          height: 888,
          documentOverflow: false
        },
        expected
      )
    ).toBe(false)
    expect(
      smoke.gameOnlyZoomStateMatches(
        {
          surface: 'game-only',
          factor: 1,
          width: 900,
          height: 540,
          documentOverflow: false
        },
        expected
      )
    ).toBe(false)
    expect(
      smoke.gameOnlyZoomStateMatches(
        {
          surface: 'game-only',
          factor: 0.75,
          width: 900,
          height: 540,
          documentOverflow: true
        },
        expected
      )
    ).toBe(false)
  })

  it('defines an off-ratio grow-and-shrink sweep for the game-only window', () => {
    expect(smoke.GameOnlyResizeSweepSteps.map(({ width, height }) => [width, height])).toEqual([
      [900, 540],
      [1000, 600],
      [1200, 720],
      [1050, 630],
      [900, 540]
    ])
    expect(
      smoke.GameOnlyResizeSweepSteps.slice(1).every(
        (step) => step.requestedHeight !== step.height + 60
      )
    ).toBe(true)
    expect(
      smoke.GameOnlyResizeSweepSteps.every(
        (step) => Math.abs(step.factor - step.width / 1200) <= Number.EPSILON
      )
    ).toBe(true)
  })

  it('validates the near-limit titlebar capacity text, warnings, and clearance', () => {
    const rect = (left: number, top: number, width: number, height: number): SmokeRect => ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height
    })
    const valid = {
      titlebar: rect(0, 0, 1316, 32),
      status: rect(10, 0, 700, 32),
      buttons: rect(1100, 0, 216, 32),
      ship: {
        text: smoke.LayoutFixtureCapacityExpectation.shipText,
        title: smoke.LayoutFixtureCapacityExpectation.shipTitle,
        ariaLabel: smoke.LayoutFixtureCapacityExpectation.shipTitle,
        danger: true,
        textOverflow: false,
        rect: rect(200, 0, 60, 32)
      },
      slotitem: {
        text: smoke.LayoutFixtureCapacityExpectation.slotitemText,
        title: smoke.LayoutFixtureCapacityExpectation.slotitemTitle,
        ariaLabel: smoke.LayoutFixtureCapacityExpectation.slotitemTitle,
        danger: true,
        warning: false,
        textOverflow: false,
        rect: rect(600, 0, 70, 32)
      }
    }

    expect(smoke.titlebarCapacityFailure(valid)).toBeNull()
    expect(
      smoke.titlebarCapacityFailure({
        ...valid,
        slotitem: { ...valid.slotitem, text: '18' }
      })
    ).toContain('Slotitem capacity display')
    expect(
      smoke.titlebarCapacityFailure({
        ...valid,
        status: rect(10, 0, 1120, 32)
      })
    ).toContain('Titlebar capacity geometry')
  })

  it.each(['full', 'overflow'] as const)(
    'validates the %s capacity parser state and visible titlebar',
    (mode) => {
      const rect = (left: number, top: number, width: number, height: number): SmokeRect => ({
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height
      })
      const expected = smoke.LayoutFixtureCapacityBoundaryExpectations[mode]
      const valid = {
        parser: {
          mode: expected.mode,
          shipCount: expected.shipCount,
          shipCapacity: expected.shipCapacity,
          slotitemCount: expected.slotitemCount,
          slotitemCapacity: expected.slotitemCapacity
        },
        renderer: {
          titlebar: rect(0, 0, 1316, 32),
          status: rect(10, 0, 700, 32),
          buttons: rect(1100, 0, 216, 32),
          ship: {
            text: expected.shipText,
            title: expected.shipTitle,
            ariaLabel: expected.shipTitle,
            danger: true,
            textOverflow: false,
            rect: rect(200, 0, 65, 32)
          },
          slotitem: {
            text: expected.slotitemText,
            title: expected.slotitemTitle,
            ariaLabel: expected.slotitemTitle,
            danger: true,
            warning: false,
            textOverflow: false,
            rect: rect(600, 0, 75, 32)
          }
        }
      }

      expect(smoke.capacityBoundaryFixtureFailure(valid, expected)).toBeNull()
      expect(
        smoke.capacityBoundaryFixtureFailure(
          {
            ...valid,
            parser: {
              ...valid.parser,
              slotitemCount: expected.slotitemCount + 1
            }
          },
          expected
        )
      ).toContain('parser state is invalid')
      expect(
        smoke.capacityBoundaryFixtureFailure(
          {
            ...valid,
            renderer: {
              ...valid.renderer,
              ship: {
                ...valid.renderer.ship,
                title: 'incorrect'
              }
            }
          },
          expected
        )
      ).toContain('Ship capacity display')
    }
  )

  it('validates the saved screenshot PNG and completion notice as one result', () => {
    const rect = (left: number, top: number, width: number, height: number): SmokeRect => ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height
    })
    const valid = {
      button: {
        title: 'スクリーンショット',
        ariaLabel: 'スクリーンショット'
      },
      document: rect(0, 0, 1316, 632),
      notice: {
        text: '保存しました: 20260730-123456.png',
        role: 'status',
        ariaLive: 'polite',
        success: true,
        rect: rect(900, 42, 400, 38)
      },
      filename: '20260730-123456.png',
      file: {
        exists: true,
        filename: '20260730-123456.png',
        size: 42_000,
        pngSignature: '89504e470d0a1a0a',
        width: 900,
        height: 540
      },
      game: {
        width: 900,
        height: 540
      },
      customDirectory: true,
      defaultDirectoryUnused: true
    }

    expect(smoke.captureNoticeFailure(valid)).toBeNull()
    expect(
      smoke.captureNoticeFailure({
        ...valid,
        notice: { ...valid.notice, text: '保存しました' }
      })
    ).toContain('filename is not reflected')
    expect(
      smoke.captureNoticeFailure({
        ...valid,
        file: { ...valid.file, pngSignature: 'not-a-png' }
      })
    ).toContain('PNG is invalid')
    expect(
      smoke.captureNoticeFailure({
        ...valid,
        file: { ...valid.file, width: 800 }
      })
    ).toContain('dimensions do not match')
  })

  it('writes the isolated option fixture with a custom directory and game recording target', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'koubrowser-smoke-option-test-'))
    temporaryDirectories.push(directory)

    const result = await smoke.createLayoutFixtureOptionSetting(directory)
    expect(result.captureDirectory).not.toBe(result.defaultCaptureDirectory)
    expect(
      JSON.parse(readFileSync(path.join(directory, 'koubrowser', 'option.json'), 'utf8'))
    ).toEqual({
      captureSavePath: result.captureDirectory,
      recordingTarget: 'game',
      proxyMode: 'system',
      proxyPacScript: null,
      proxyFixedServers: null,
      extensions: []
    })
  })

  it('validates a game-only WebM saved under the configured custom directory', () => {
    const valid = {
      button: {
        startTitle: '録画開始',
        startAriaLabel: '録画開始',
        checkedWhileRecording: true,
        checkedAfterStop: false
      },
      startedNotice: {
        text: 'ゲーム画面の録画を開始しました',
        role: 'status',
        ariaLive: 'polite',
        success: true
      },
      stoppedNotice: {
        text: '録画を停止し、保存を完了しています',
        role: 'status',
        ariaLive: 'polite',
        success: true
      },
      filename: '20260730-170000.webm',
      file: {
        exists: true,
        filename: '20260730-170000.webm',
        size: 12_000,
        webmSignature: '1a45dfa3'
      },
      recordingSource: {
        target: 'game',
        mediaSource: 'tab',
        width: 1200,
        height: 720
      },
      customDirectory: true,
      defaultDirectoryUnused: true
    }

    expect(smoke.recordingSaveFailure(valid)).toBeNull()
    expect(
      smoke.recordingSaveFailure({
        ...valid,
        recordingSource: { ...valid.recordingSource, target: 'window' }
      })
    ).toContain('not game-only')
    expect(
      smoke.recordingSaveFailure({
        ...valid,
        file: { ...valid.file, webmSignature: '00000000' }
      })
    ).toContain('WebM is invalid')
    expect(
      smoke.recordingSaveFailure({
        ...valid,
        defaultDirectoryUnused: false
      })
    ).toContain('incomplete')
  })

  it('validates the visible 139/97 transport value and seventh ship geometry', () => {
    const rect = (left: number, top: number, width: number, height: number): SmokeRect => ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height
    })
    const valid = {
      panel: rect(700, 40, 600, 580),
      body: rect(710, 70, 580, 540),
      header: rect(900, 80, 100, 30),
      viewport: rect(710, 70, 580, 400),
      seventhShip: rect(720, 390, 560, 60),
      label: '輸送',
      value: '139/97',
      title: '輸送値',
      shipCount: 7,
      shipIds: [1, 2, 3, 4, 5, 6, 7]
    }

    expect(smoke.transportFixtureFailure(valid)).toBeNull()
    expect(
      smoke.transportFixtureFailure({
        ...valid,
        value: '123/86'
      })
    ).toContain('value is invalid')
    expect(
      smoke.transportFixtureFailure({
        ...valid,
        shipIds: [1, 2, 3, 4, 5, 6]
      })
    ).toContain('fleet is invalid')
    expect(
      smoke.transportFixtureFailure({
        ...valid,
        seventhShip: rect(720, 450, 560, 60)
      })
    ).toContain('geometry is invalid')
  })

  it('validates battle-result parser HP and the visible taiha warning', () => {
    const rect = (left: number, top: number, width: number, height: number): SmokeRect => ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height
    })
    const valid = {
      mainShipId: 1,
      mainHp: 9,
      escortShipId: 9,
      escortHp: 8,
      battleType: 14,
      renderer: {
        title: '！大破艦があります！',
        warning: true,
        shipId: 1,
        nowHp: 9,
        maxHp: 40,
        hpState: 'taiha',
        game: rect(0, 32, 1200, 720),
        protection: {
          role: 'alertdialog',
          modal: 'true',
          heading: '大破艦があります',
          description: '大破艦を検出したため、ゲーム画面への入力を保護しています。',
          button: 'Ctrl + クリックで保護を解除',
          rect: rect(0, 32, 1200, 720),
          ordinaryClickBlocked: true,
          ctrlBypass: true
        }
      }
    }

    expect(smoke.battleResultFixtureFailure(valid)).toBeNull()
    expect(
      smoke.battleResultFixtureFailure({
        ...valid,
        escortHp: 13
      })
    ).toContain('parser state is invalid')
    expect(
      smoke.battleResultFixtureFailure({
        ...valid,
        renderer: {
          ...valid.renderer,
          warning: false
        }
      })
    ).toContain('visible state is invalid')
    expect(
      smoke.battleResultFixtureFailure({
        ...valid,
        renderer: {
          ...valid.renderer,
          protection: {
            ...valid.renderer.protection,
            ordinaryClickBlocked: false
          }
        }
      })
    ).toContain('input protection bypass is invalid')
    expect(
      smoke.battleResultFixtureFailure({
        ...valid,
        renderer: {
          ...valid.renderer,
          protection: {
            ...valid.renderer.protection,
            rect: rect(0, 32, 1190, 720)
          }
        }
      })
    ).toContain('input protection is invalid')
  })

  it('requires fixed-proxy resolution and system-mode restoration without network access', () => {
    const valid = {
      probeUrl: 'https://koubrowser-proxy-smoke.invalid/',
      proxyRules: 'http=127.0.0.1:65534;https=127.0.0.1:65534',
      beforeResolution: 'DIRECT',
      fixedResolution: 'PROXY 127.0.0.1:65534',
      restoredResolution: 'DIRECT',
      resolutionOnly: true
    }

    expect(smoke.proxyFixtureFailure(valid)).toBeNull()
    expect(
      smoke.proxyFixtureFailure({
        ...valid,
        fixedResolution: 'DIRECT'
      })
    ).toContain('was not resolved')
    expect(
      smoke.proxyFixtureFailure({
        ...valid,
        restoredResolution: 'PROXY 127.0.0.1:65534'
      })
    ).toContain('was not restored')
    expect(
      smoke.proxyFixtureFailure({
        ...valid,
        resolutionOnly: false
      })
    ).toContain('metadata is invalid')
  })

  it('requires the renderer data-folder action to resolve the isolated app directory', () => {
    const valid = {
      rendererOpened: true,
      opened: true,
      parentIsElectronUserData: true,
      directoryName: 'koubrowser',
      directoryExists: true
    }

    expect(smoke.dataFolderFixtureFailure(valid)).toBeNull()
    expect(
      smoke.dataFolderFixtureFailure({
        ...valid,
        opened: false
      })
    ).toContain('state is invalid')
    expect(
      smoke.dataFolderFixtureFailure({
        ...valid,
        parentIsElectronUserData: false
      })
    ).toContain('state is invalid')
    expect(
      smoke.dataFolderFixtureFailure({
        ...valid,
        rendererOpened: false
      })
    ).toContain('state is invalid')
  })

  it('distinguishes a reloaded muted renderer from its preceding document', () => {
    expect(
      smoke.muteReloadStateMatches(
        {
          timeOrigin: 200,
          ready: true,
          muted: true
        },
        true,
        100
      )
    ).toBe(true)
    expect(
      smoke.muteReloadStateMatches(
        {
          timeOrigin: 100,
          ready: true,
          muted: true
        },
        true,
        100
      )
    ).toBe(false)
    expect(
      smoke.muteReloadStateMatches(
        {
          timeOrigin: 200,
          ready: false,
          muted: true
        },
        true,
        100
      )
    ).toBe(false)
  })

  it('resolves the settings file without using a workspace-relative path', () => {
    expect(
      smoke.settingsPathForPlatform(
        'win32',
        { APPDATA: 'C:\\Profile\\AppData\\Roaming' },
        'C:\\Profile'
      )
    ).toBe(path.join('C:\\Profile\\AppData\\Roaming', 'koubrowser', 'koubrowser.json'))
    expect(smoke.settingsPathForPlatform('darwin', {}, '/Users/test')).toBe(
      path.join('/Users/test', 'Library', 'Application Support', 'koubrowser', 'koubrowser.json')
    )
  })

  it('allows only the one-pixel rendering tolerance used by layout checks', () => {
    expect(
      smoke.metricsAreContained({
        clientWidth: 1516,
        scrollWidth: 1517,
        clientHeight: 752,
        scrollHeight: 752
      })
    ).toBe(true)
    expect(
      smoke.metricsAreContained({
        clientWidth: 1516,
        scrollWidth: 1518,
        clientHeight: 752,
        scrollHeight: 752
      })
    ).toBe(false)
    expect(
      smoke.rectIsContained(
        { left: 0, top: 0, right: 1516, bottom: 752 },
        { left: 1200, top: 32, right: 1517, bottom: 752 }
      )
    ).toBe(true)
    expect(
      smoke.rectIsContained(
        { left: 0, top: 0, right: 1516, bottom: 752 },
        { left: 1200, top: 32, right: 1518, bottom: 752 }
      )
    ).toBe(false)
    expect(
      smoke.rectsOverlap(
        { left: 100, top: 4, right: 180, bottom: 28 },
        { left: 170, top: 4, right: 250, bottom: 28 }
      )
    ).toBe(true)
    expect(
      smoke.rectsOverlap(
        { left: 42, top: 4, right: 70, bottom: 28 },
        { left: 110, top: 0, right: 190, bottom: 31 }
      )
    ).toBe(false)
  })

  it('validates every responsive track during a grow-and-shrink workspace sweep', () => {
    const frame = {
      surface: 'workspace',
      ready: true,
      document: {
        clientWidth: 1440,
        scrollWidth: 1440,
        clientHeight: 928,
        scrollHeight: 928
      },
      scroll: {
        x: 0,
        y: 0
      },
      viewport: {
        left: 0,
        top: 0,
        right: 1440,
        bottom: 928,
        width: 1440,
        height: 928
      },
      main: {
        left: 0,
        top: 32,
        right: 1440,
        bottom: 928,
        width: 1440,
        height: 896
      },
      primary: {
        left: 12,
        top: 44,
        right: 1136,
        bottom: 916,
        width: 1124,
        height: 872
      },
      game: {
        left: 12,
        top: 44,
        right: 1136,
        bottom: 718,
        width: 1124,
        height: 674
      },
      secondary: {
        left: 1148,
        top: 44,
        right: 1428,
        bottom: 916,
        width: 280,
        height: 872
      }
    }

    expect(smoke.workspaceFrameFailure(frame, { width: 1124, height: 674 })).toBeNull()
    expect(
      smoke.workspaceFrameFailure(
        {
          ...frame,
          document: {
            ...frame.document,
            scrollWidth: 1442
          }
        },
        { width: 1124, height: 674 }
      )
    ).toContain('overflowed')
    expect(
      smoke.workspaceFrameFailure(
        {
          ...frame,
          scroll: {
            x: 1.5,
            y: 0
          }
        },
        { width: 1124, height: 674 }
      )
    ).toContain('required page scrolling')
    expect(
      smoke.workspaceFrameFailure(
        {
          ...frame,
          secondary: {
            ...frame.secondary,
            left: 1134
          }
        },
        { width: 1124, height: 674 }
      )
    ).toContain('overlapped')
    expect(
      smoke.workspaceFrameFailure(
        {
          ...frame,
          game: {
            ...frame.game,
            top: 46,
            bottom: 720
          }
        },
        { width: 1124, height: 674 }
      )
    ).toContain('anchored')
    expect(
      smoke.workspaceFrameFailure(
        {
          ...frame,
          secondary: {
            ...frame.secondary,
            left: 1144
          }
        },
        { width: 1124, height: 674 }
      )
    ).toContain('not automatically aligned')

    expect(smoke.WorkspaceResizeSweepSizes[0]).toEqual({
      width: smoke.MinimumWorkspaceWidth,
      height: smoke.MinimumWorkspaceHeight
    })
    expect(smoke.WorkspaceResizeSweepSizes.at(-1)).toEqual(smoke.WorkspaceResizeSweepSizes[0])
    expect(
      smoke.WorkspaceResizeSweepSizes.some(
        (size, index, sizes) => index > 0 && size.width < sizes[index - 1].width
      )
    ).toBe(true)
  })

  it('uses the complete logical work area only when it supports the wide layout', () => {
    expect(
      smoke.wideWorkspaceBounds({
        left: 2560,
        top: 0,
        width: 2560.4,
        height: 1391.6
      })
    ).toEqual({
      left: 2560,
      top: 0,
      width: 2560,
      height: 1392
    })
    expect(() =>
      smoke.wideWorkspaceBounds({
        left: 0,
        top: 0,
        width: smoke.WideWorkspaceMinWidth - 1,
        height: smoke.WideWorkspaceMinHeight
      })
    ).toThrow('too small for wide workspace inspection')
  })

  it('keeps responsive workspace bounds inside the current work area', () => {
    expect(
      smoke.workspaceBoundsForSize(
        { left: 0, top: 0, width: 2560, height: 1392 },
        smoke.IntermediateWorkspaceWidth,
        smoke.IntermediateWorkspaceHeight,
        { left: 1200, top: 800 }
      )
    ).toEqual({
      left: 804,
      top: 492,
      width: 1756,
      height: 900
    })
    expect(() =>
      smoke.workspaceBoundsForSize(
        { left: 0, top: 0, width: 1516, height: 752 },
        smoke.IntermediateWorkspaceWidth,
        smoke.IntermediateWorkspaceHeight
      )
    ).toThrow('does not fit the current work area')

    expect([
      [smoke.MinimumWorkspaceWidth, smoke.MinimumWorkspaceHeight],
      [smoke.SurfaceWorkspaceWidth, smoke.SurfaceWorkspaceHeight],
      [smoke.NarrowWorkspaceWidth, smoke.NarrowWorkspaceHeight],
      [smoke.IntermediateWorkspaceWidth, smoke.IntermediateWorkspaceHeight],
      [smoke.TallWorkspaceWidth, smoke.TallWorkspaceHeight]
    ]).toEqual([
      [1316, 632],
      [1440, 928],
      [1600, 800],
      [1756, 900],
      [1920, 1200]
    ])
  })

  it('mirrors the responsive game-stage fit used by the application', () => {
    expect(smoke.workspaceGameSizeForWindow(1440, 928)).toEqual({
      width: 1124,
      height: 674,
      scale: 1124 / 1200
    })
    expect(smoke.workspaceGameSizeForWindow(1316, 632)).toEqual({
      width: 1000,
      height: 600,
      scale: 5 / 6
    })
    expect(smoke.workspaceGameSizeForWindow(1516, 752)).toEqual({
      width: 1200,
      height: 720,
      scale: 1
    })
  })

  it('summarizes geometry without panel snapshots', () => {
    const summary = smoke.summarizeSmokeResult({
      dataSource: 'layout-fixture',
      isolatedUserData: true,
      screenshotDirectory: 'output/layout-smoke/run',
      accountTransferState: {
        bytes: 4096,
        records: 9,
        identityOutsideCiphertext: false,
        wrongPassphraseRejected: true,
        corruptionRejected: true
      },
      dataUpdateDownloadState: {
        ready: true,
        source: 'loopback-fixture',
        version: 'smoke.quest.1',
        fileCount: 2,
        hasQuestKnowledge: true,
        publicKeySha256: 'a'.repeat(64),
        requestPaths: [
          '/koubrowser-smoke/manifest.json',
          '/koubrowser-smoke/map/001_01_map.json',
          '/koubrowser-smoke/quest/knowledge.json',
          '/koubrowser-smoke/manifest.json'
        ],
        restarted: true
      },
      dataUpdateState: {
        userDataPath: 'C:\\Temp\\koubrowser-layout-smoke-test',
        publicKeyConfigured: true,
        activeDataDirectory:
          'C:\\Temp\\koubrowser-layout-smoke-test\\koubrowser\\data-updates\\versions\\smoke.quest.1',
        questClaimCount: 1,
        questIds: [smoke.DataUpdateFixtureQuestId],
        strategyVersion: smoke.DataUpdateFixtureStrategyVersion,
        strategyRecipeIds: [smoke.DataUpdateFixtureStrategyRecipeId]
      },
      dataUpdateMapState: {
        areaId: smoke.DataUpdateFixtureMapAreaId,
        mapNo: smoke.DataUpdateFixtureMapNo,
        spot: smoke.DataUpdateFixtureMapSpot
      },
      displayTopology: {
        primaryDisplayId: 101,
        currentDisplayId: 102,
        displays: [
          {
            id: 101,
            primary: true,
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            workArea: { x: 0, y: 0, width: 1920, height: 1040 },
            scaleFactor: 1,
            rotation: 0,
            internal: false,
            touchSupport: 'unknown'
          },
          {
            id: 102,
            primary: false,
            bounds: { x: 1920, y: 0, width: 1536, height: 960 },
            workArea: { x: 1920, y: 0, width: 1536, height: 920 },
            scaleFactor: 1.25,
            rotation: 0,
            internal: false,
            touchSupport: 'unknown'
          }
        ]
      },
      displayAcceptance: {
        profile: 'issue-34',
        displayIds: [101, 102],
        displays: [
          {
            id: 101,
            primary: true,
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            workArea: { x: 0, y: 0, width: 1920, height: 1040 },
            scaleFactor: 1,
            touchSupport: 'unknown'
          },
          {
            id: 102,
            primary: false,
            bounds: { x: 1920, y: 0, width: 1536, height: 960 },
            workArea: { x: 1920, y: 0, width: 1536, height: 920 },
            scaleFactor: 1.25,
            touchSupport: 'unknown'
          }
        ],
        inspectedDisplayIds: [101, 102],
        touchPageSelected: true,
        restartVerified: true,
        zoomResetVerified: true
      },
      recordingSource: {
        target: 'game',
        mediaSource: 'tab',
        width: 1200,
        height: 720,
        idPresent: true
      },
      recordingSources: {
        window: {
          target: 'window',
          mediaSource: 'desktop',
          width: 1800,
          height: 960,
          idPresent: true,
          tracks: {
            active: true,
            audio: {
              kind: 'audio',
              readyState: 'live'
            },
            video: {
              kind: 'video',
              readyState: 'live',
              width: 1800,
              height: 960
            }
          }
        },
        game: {
          target: 'game',
          mediaSource: 'tab',
          width: 1200,
          height: 720,
          idPresent: true,
          tracks: {
            active: true,
            audio: {
              kind: 'audio',
              readyState: 'live'
            },
            video: {
              kind: 'video',
              readyState: 'live',
              width: 1200,
              height: 720
            }
          }
        }
      },
      hpGaugeFixture: {
        ships: [{}, {}, {}, {}, {}, {}, {}],
        states: ['normal', 'syouha', 'tyuuha', 'taiha'],
        rowGap: 100,
        statusClearance: 0
      },
      zoomShortcutPolicy: {
        preservedFactor: 0.75,
        before: {
          factor: 0.75,
          width: 900,
          height: 540
        },
        resizeSweep: [
          {
            requested: { width: 900, height: 650 },
            actual: {
              width: 900,
              height: 540,
              factor: 0.75,
              documentOverflow: false
            }
          }
        ]
      },
      titlebarCapacityFixture: {
        ship: {
          text: '7/12',
          title: '保有艦娘: 7/12（空き5） — 空き枠が少なくなっています',
          danger: true
        },
        slotitem: {
          text: '18/23',
          title: '保有装備: 18/23（空き5） — 期間限定海域の目安は空き20以上です',
          danger: true
        },
        status: {
          right: 900
        },
        buttons: {
          left: 1000
        }
      },
      captureNoticeFixture: {
        filename: '20260730-123456.png',
        notice: {
          text: '保存しました: 20260730-123456.png'
        },
        file: {
          size: 42_000,
          width: 900,
          height: 540
        }
      },
      recordingSaveFixture: {
        filename: '20260730-170000.webm',
        startedNotice: {
          text: 'ゲーム画面の録画を開始しました'
        },
        stoppedNotice: {
          text: '録画を停止し、保存を完了しています'
        },
        file: {
          size: 12_000
        },
        customDirectory: true,
        defaultDirectoryUnused: true
      },
      transportFixture: {
        value: '139/97',
        shipCount: 7,
        shipIds: [1, 2, 3, 4, 5, 6, 7],
        viewport: {
          left: 0,
          top: 0,
          right: 600,
          bottom: 413
        },
        seventhShip: {
          left: 0,
          top: 333,
          right: 600,
          bottom: 413
        }
      },
      liveAcceptance: {
        profile: 'issue-30',
        missionCheck: {
          rowCount: 8,
          hasExplicitError: false,
          missionNames: ['01: 練習航海'],
          area1FilterInitiallyChecked: false,
          area1FilterTemporarilyEnabled: true,
          operationsPageInitiallyVisible: false,
          operationsPageTemporarilyRestored: true,
          missionPanelInitiallyVisible: false,
          missionPanelTemporarilyEnabled: true
        }
      },
      missionCheckFixture: {
        rowCount: 2,
        hasExplicitError: false,
        missionNames: ['02: 長距離練習航海', '03: 警備任務']
      },
      titlebarColorFixture: {
        before: {
          renderedColor: 'green',
          backgroundImage: 'linear-gradient(green)'
        },
        after: {
          renderedColor: 'graphite',
          backgroundImage: 'linear-gradient(graphite)'
        }
      },
      proxyFixture: {
        probeUrl: 'https://koubrowser-proxy-smoke.invalid/',
        proxyRules: 'http=127.0.0.1:65534;https=127.0.0.1:65534',
        beforeResolution: 'DIRECT',
        fixedResolution: 'PROXY 127.0.0.1:65534',
        restoredResolution: 'DIRECT',
        resolutionOnly: true
      },
      dataFolderFixture: {
        rendererOpened: true,
        opened: true,
        parentIsElectronUserData: true,
        directoryName: 'koubrowser',
        directoryExists: true
      },
      workspaceModuleVisibility: {
        pageId: 'secondary-operations',
        panelName: 'missioncheck',
        hidden: {
          panelVisible: false,
          savedVisible: false
        },
        reopened: {
          editorOpen: true,
          checkboxChecked: false
        },
        restored: {
          panelVisible: true,
          savedVisible: true
        },
        previousPageRestored: true
      },
      app: {
        surface: 'workspace',
        ready: true,
        document: { clientWidth: 1516, clientHeight: 752 },
        game: { width: 1200, height: 720 }
      },
      workspacePages: {
        pages: [{ label: '運用', panels: [{ name: 'deck' }] }, { label: '任務' }]
      },
      workspaceResizeSweep: [
        {
          step: 1,
          direction: 'start',
          bounds: { left: 0, top: 0, width: 1316, height: 632 },
          game: { width: 1000, height: 600 },
          frame: { internal: 'omitted from summary' }
        },
        {
          step: 2,
          direction: 'grow',
          bounds: { left: 0, top: 0, width: 1440, height: 928 },
          game: { width: 1124, height: 674 }
        }
      ],
      workspaceSizes: [
        {
          name: 'narrow',
          requestedBounds: { width: 1600, height: 800 },
          app: {
            surface: 'workspace',
            ready: true,
            document: { clientWidth: 1600, clientHeight: 800 },
            game: { width: 1200, height: 720 }
          },
          primary: { visible: false },
          secondary: { pages: [{ label: '運用' }, { label: '任務' }] }
        }
      ],
      displayWorkspaces: [
        {
          displayId: 102,
          primaryDisplay: false,
          scaleFactor: 1.25,
          workArea: { x: 1920, y: 0, width: 1536, height: 920 },
          requestedBounds: { left: 1920, top: 0, width: 1516, height: 752 },
          displayIdAtInspection: 102,
          app: {
            surface: 'workspace',
            ready: true,
            document: { clientWidth: 1516, clientHeight: 752 },
            game: { width: 1200, height: 720 }
          },
          secondary: {
            pages: [
              { label: '運用', panels: [{ name: 'deck' }] },
              { label: 'ドック・任務' },
              { label: '戦闘・装備' },
              { label: 'ドロップ' },
              { label: '任務' }
            ]
          }
        }
      ]
    }) as {
      initial: { pages: string[] }
      workspaceResizeSweep: Array<{
        step: number
        direction: string
        bounds: { left: number; top: number; width: number; height: number }
        game: { width: number; height: number }
      }>
      workspaceSizes: Array<{
        primaryVisible: boolean
        pages: string[]
      }>
      displayWorkspaces: Array<{
        displayId: number
        primaryDisplay: boolean
        scaleFactor: number
        workArea: { x: number; y: number; width: number; height: number }
        requestedBounds: { left: number; top: number; width: number; height: number }
        displayIdAtInspection: number
        app: {
          surface: string
          ready: boolean
          document: { width: number; height: number }
          game: { width: number; height: number }
        }
        pages: string[]
      }>
    }

    expect(summary.initial.pages).toEqual(['運用', '任務'])
    expect(summary.workspaceResizeSweep).toEqual([
      {
        step: 1,
        direction: 'start',
        bounds: { left: 0, top: 0, width: 1316, height: 632 },
        game: { width: 1000, height: 600 }
      },
      {
        step: 2,
        direction: 'grow',
        bounds: { left: 0, top: 0, width: 1440, height: 928 },
        game: { width: 1124, height: 674 }
      }
    ])
    expect(summary).toEqual(
      expect.objectContaining({
        screenshotDirectory: 'output/layout-smoke/run',
        accountTransferState: {
          bytes: 4096,
          records: 9,
          identityOutsideCiphertext: false,
          wrongPassphraseRejected: true,
          corruptionRejected: true
        },
        dataUpdateDownloadState: {
          source: 'loopback-fixture',
          version: 'smoke.quest.1',
          fileCount: 2,
          hasQuestKnowledge: true,
          publicKeySha256: 'a'.repeat(64),
          restarted: true
        },
        dataUpdateState: {
          publicKeyConfigured: true,
          active: true,
          questClaimCount: 1,
          questIds: [smoke.DataUpdateFixtureQuestId],
          strategyVersion: smoke.DataUpdateFixtureStrategyVersion,
          strategyRecipeIds: [smoke.DataUpdateFixtureStrategyRecipeId]
        },
        dataUpdateMapState: {
          areaId: smoke.DataUpdateFixtureMapAreaId,
          mapNo: smoke.DataUpdateFixtureMapNo,
          spot: smoke.DataUpdateFixtureMapSpot
        },
        displayTopology: {
          primaryDisplayId: 101,
          currentDisplayId: 102,
          displays: [
            expect.objectContaining({
              id: 101,
              primary: true,
              workArea: { x: 0, y: 0, width: 1920, height: 1040 },
              scaleFactor: 1
            }),
            expect.objectContaining({
              id: 102,
              primary: false,
              workArea: { x: 1920, y: 0, width: 1536, height: 920 },
              scaleFactor: 1.25
            })
          ]
        },
        displayAcceptance: {
          profile: 'issue-34',
          displayIds: [101, 102],
          displays: [
            {
              id: 101,
              primary: true,
              physicalSize: { width: 1920, height: 1080 },
              bounds: { x: 0, y: 0, width: 1920, height: 1080 },
              workArea: { x: 0, y: 0, width: 1920, height: 1040 },
              scaleFactor: 1,
              touchSupport: 'unknown'
            },
            {
              id: 102,
              primary: false,
              physicalSize: { width: 1920, height: 1200 },
              bounds: { x: 1920, y: 0, width: 1536, height: 960 },
              workArea: { x: 1920, y: 0, width: 1536, height: 920 },
              scaleFactor: 1.25,
              touchSupport: 'unknown'
            }
          ],
          inspectedDisplayIds: [101, 102],
          touchPageSelected: true,
          restartVerified: true,
          zoomResetVerified: true
        },
        recordingSource: {
          target: 'game',
          mediaSource: 'tab',
          width: 1200,
          height: 720,
          idPresent: true
        },
        hpGaugeFixture: {
          shipCount: 7,
          states: ['normal', 'syouha', 'tyuuha', 'taiha'],
          rowGap: 100,
          statusClearance: 0
        },
        zoomShortcutPolicy: {
          preservedFactor: 0.75,
          gameSize: {
            width: 900,
            height: 540
          },
          resizeSweep: [
            {
              requested: { width: 900, height: 650 },
              actual: {
                width: 900,
                height: 540,
                factor: 0.75,
                documentOverflow: false
              }
            }
          ]
        },
        titlebarCapacityFixture: {
          ship: {
            text: '7/12',
            title: '保有艦娘: 7/12（空き5） — 空き枠が少なくなっています',
            danger: true
          },
          slotitem: {
            text: '18/23',
            title: '保有装備: 18/23（空き5） — 期間限定海域の目安は空き20以上です',
            danger: true
          },
          statusClearance: 100
        },
        captureNoticeFixture: {
          filename: '20260730-123456.png',
          message: '保存しました: 20260730-123456.png',
          size: 42_000,
          width: 900,
          height: 540
        },
        recordingSaveFixture: {
          filename: '20260730-170000.webm',
          startedMessage: 'ゲーム画面の録画を開始しました',
          stoppedMessage: '録画を停止し、保存を完了しています',
          size: 12_000,
          customDirectory: true,
          defaultDirectoryUnused: true
        },
        transportFixture: {
          value: '139/97',
          shipCount: 7,
          shipIds: [1, 2, 3, 4, 5, 6, 7],
          seventhShipContained: true
        },
        liveAcceptance: {
          profile: 'issue-30',
          missionCheck: {
            rowCount: 8,
            hasExplicitError: false,
            area1FilterInitiallyChecked: false,
            area1FilterTemporarilyEnabled: true,
            operationsPageInitiallyVisible: false,
            operationsPageTemporarilyRestored: true,
            missionPanelInitiallyVisible: false,
            missionPanelTemporarilyEnabled: true
          }
        },
        missionCheckFixture: {
          rowCount: 2,
          hasExplicitError: false,
          sampleMission: '02: 長距離練習航海'
        },
        titlebarColorFixture: {
          before: 'green',
          after: 'graphite',
          changed: true
        },
        proxyFixture: {
          rules: 'http=127.0.0.1:65534;https=127.0.0.1:65534',
          fixedResolution: 'PROXY 127.0.0.1:65534',
          restoredResolution: 'DIRECT',
          resolutionOnly: true
        },
        dataFolderFixture: {
          rendererOpened: true,
          mainProcessOpened: true,
          parentIsElectronUserData: true,
          directoryName: 'koubrowser',
          directoryExists: true
        },
        workspaceModuleVisibility: {
          pageId: 'secondary-operations',
          panelName: 'missioncheck',
          hiddenAndPersisted: true,
          configurationReopened: true,
          restoredAndPersisted: true,
          previousPageRestored: true
        },
        recordingSources: {
          window: {
            target: 'window',
            mediaSource: 'desktop',
            width: 1800,
            height: 960,
            idPresent: true,
            tracks: {
              active: true,
              audio: {
                kind: 'audio',
                readyState: 'live'
              },
              video: {
                kind: 'video',
                readyState: 'live',
                width: 1800,
                height: 960
              }
            }
          },
          game: {
            target: 'game',
            mediaSource: 'tab',
            width: 1200,
            height: 720,
            idPresent: true,
            tracks: {
              active: true,
              audio: {
                kind: 'audio',
                readyState: 'live'
              },
              video: {
                kind: 'video',
                readyState: 'live',
                width: 1200,
                height: 720
              }
            }
          }
        }
      })
    )
    expect(summary.workspaceSizes).toEqual([
      expect.objectContaining({
        primaryVisible: false,
        pages: ['運用', '任務']
      })
    ])
    expect(summary.displayWorkspaces).toEqual([
      {
        displayId: 102,
        primaryDisplay: false,
        scaleFactor: 1.25,
        workArea: { x: 1920, y: 0, width: 1536, height: 920 },
        requestedBounds: { left: 1920, top: 0, width: 1516, height: 752 },
        displayIdAtInspection: 102,
        app: {
          surface: 'workspace',
          ready: true,
          document: { width: 1516, height: 752 },
          game: { width: 1200, height: 720 }
        },
        pages: ['運用', 'ドック・任務', '戦闘・装備', 'ドロップ', '任務']
      }
    ])
    expect(JSON.stringify(summary)).not.toContain('panels')
    expect(JSON.stringify(summary)).not.toContain('koubrowser-layout-smoke-test')
  })

  it('redacts local paths and mission names from acceptance summaries', () => {
    const privateScreenshotDirectory = path.join(
      process.cwd(),
      'output',
      'acceptance-issue-30',
      '2026-07-30-manual-game'
    )
    const summary = smoke.summarizeSmokeResult({
      app: {
        surface: 'workspace',
        ready: true,
        document: { clientWidth: 1516, clientHeight: 752 },
        game: { width: 1200, height: 720 }
      },
      screenshotDirectory: privateScreenshotDirectory,
      liveAcceptance: {
        profile: 'issue-30',
        missionCheck: {
          rowCount: 3,
          hasExplicitError: false,
          missionNames: ['秘密の任務名'],
          area1FilterInitiallyChecked: true,
          area1FilterTemporarilyEnabled: false
        }
      }
    })

    expect(summary).toEqual(
      expect.objectContaining({
        screenshotDirectory: 'output/acceptance-issue-30/2026-07-30-manual-game',
        liveAcceptance: {
          profile: 'issue-30',
          missionCheck: {
            rowCount: 3,
            hasExplicitError: false,
            area1FilterInitiallyChecked: true,
            area1FilterTemporarilyEnabled: false
          }
        }
      })
    )
    expect(JSON.stringify(summary)).not.toContain(process.cwd())
    expect(JSON.stringify(summary)).not.toContain('秘密の任務名')

    const externalSummary = smoke.summarizeSmokeResult({
      app: {
        surface: 'workspace',
        ready: true,
        document: { clientWidth: 1516, clientHeight: 752 },
        game: { width: 1200, height: 720 }
      },
      screenshotDirectory: path.join(os.tmpdir(), 'private-user', 'acceptance-run')
    })
    expect(externalSummary.screenshotDirectory).toBe('acceptance-run')
    expect(JSON.stringify(externalSummary)).not.toContain('private-user')
  })

  it('writes a standalone redacted acceptance summary beside private screenshots', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'koubrowser-smoke-summary-test-'))
    temporaryDirectories.push(directory)
    const summary = {
      dataSource: 'manual-game',
      screenshotDirectory: 'output/acceptance-issue-30/run',
      liveAcceptance: {
        profile: 'issue-30',
        missionCheck: {
          rowCount: 3,
          hasExplicitError: false,
          area1FilterInitiallyChecked: true,
          area1FilterTemporarilyEnabled: false
        }
      }
    }

    const file = await smoke.writeSmokeSummaryFile(directory, summary)

    expect(file).toBe(path.join(directory, 'smoke-summary.json'))
    expect(JSON.parse(readFileSync(file!, 'utf8'))).toEqual(summary)
    await expect(smoke.writeSmokeSummaryFile(directory, summary)).rejects.toMatchObject({
      code: 'EEXIST'
    })
    await expect(smoke.writeSmokeSummaryFile(undefined, summary)).resolves.toBeUndefined()
  })
})

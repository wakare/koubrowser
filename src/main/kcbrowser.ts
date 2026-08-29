import {
  BrowserWindow,
  ipcMain,
  type Rectangle,
  powerMonitor,
  type WebContents,
  session,
  screen,
  shell,
  dialog,
  app,
  type Event,
  type HandlerDetails,
  type DidCreateWindowDetails,
  type BrowserWindowConstructorOptions,
  type IpcMainInvokeEvent,
  type MenuItem,
  Menu,
  type Display,
  type Input,
  type MouseInputEvent
} from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'
import * as fs from 'fs'
import { once } from 'events'
import { svdata } from '@main/svdata'
import { Const, type RectRate } from '@common/const'
import {
  classicLayoutMetrics,
  findCurrentDisplayIndex,
  fitGameOnlyWindowSize,
  fitRectangleToWorkArea,
  fitWorkspaceGameStage,
  isInlineWindowSettledOnDisplay,
  resolveClassicAssistDisplayIndex,
  resolveDisplayLayout,
  resolveInlineLayoutDisplayIndex,
  resolveInitialLayout,
  workAreaSupportsLayout,
  workspaceLayoutMetrics,
  type LayoutMode
} from '@common/layout'
import { AppStuff } from '@main/app'
import { isTrustedDataFolderRequest, openDataDirectory } from '@main/data-folder'
import { isTrustedExternalUrlRequest, normalizeExternalUrl } from '@main/external-url'
import { MapStuff } from '@main/map'
import {
  MainChannel,
  MainMessage,
  GameChannel,
  QuestContext,
  AirbaseSpot,
  OptionChannel,
  TaihaSingekiBlockState
} from '@common/channel'
import moment from 'moment'
import { KcRecord } from '@main/kcrecord'
import {
  ApiCallback,
  ApiMap,
  KcsUtil,
  MstMapinfo,
  ApiDataRoot,
  ApiResult,
  ApiMapInfoList,
  EmptyApiMapInfoList,
  ApiMissionList,
  EmptyApiMissionList,
  ApiQuestListWithParam,
  ApiQuestListParamTabId,
  ApiQuestList,
  EmptyApiQuestList
} from '@common/kcs'
import * as kcsapi from '@common/kcsapi'
import * as kcsapi_hook from '@common/kcsapi_hook'
import { appState } from '@global/appstate'
import { BattleRecord, DbName, PortChartData, Query, QueryReturn, Update } from '@common/record'
import { type Spot, type CellInfo, CommonMap } from '@common/map'
import { Env } from '@common/env'
import {
  airbaseSpotStore,
  appSettingStore,
  inheritScoreStoreLoader,
  mapInfoStoreLoader,
  missionListStoreLoader,
  optionSettingStore,
  questListStoreLoader
} from '@main/store'
import { globalSettingStore } from '@main/store'
import { getMainDir, getUserDataDir, PathStuff, setUserDataDir } from '@main/path'
import iconv from 'iconv-lite'
import * as kcapi_debug from '@main/kcapi_debug'
import type {
  ApiReqMessage,
  ApiResMessage,
  ApiResMessageAdditional,
  QuestsMessage,
  RequiredMessage
} from '@common/message'
import { gameSetting, gameSettingProxy, gameState } from '@main/settings'
import path from 'node:path'
import os from 'node:os'
import { getWorkerDriver, getWorkerDriverQuest, start as WorkersStart } from '@main/stuff/wrokers'
import { getActiveDataDirectory, getActiveQuestKnowledgeUpdate } from '@main/data-path'
import { saveCaptureFile } from '@main/capture'
import {
  AppSetting,
  defaultAppSetting,
  defaultInheritScoreList,
  InheritScoreList
} from '@common/store'
import { defaultGlobalSetting, normalizeGlobalSetting, GlobalSetting } from '@common/global_setting'
import { createAppTranslator } from '@common/localization'
import { streamManager } from '@main/stream'
import { AggregatedCellRank, AggregatedCellShipDrop } from '@common/calc_record'
import { Intaker } from '@main/stuff/intaker'
import { setTestData } from '@main/debug-data'
import { applyAccountRestoreFixtureIdentity, applyLayoutFixture } from '@main/layout-fixture'
import {
  isAccountRestoreFixtureEnabled,
  isLayoutFixtureEnabled,
  isPseudoLocaleFixtureEnabled
} from '@main/layout-fixture-env'
import { showMainWindowWhenReady } from '@main/window-startup'
import { setWindowBoundsIfChanged } from '@main/window-bounds'
import { UpdateCheckResult, UpdateStateSnapshot } from '@common/type'
import * as appSetting from '@main/app_setting'
import * as RectUtil from '@common/rect_util'
import crypto from 'node:crypto'
import {
  defaultOptionSetting,
  normalizeRecordingTarget,
  OptionData,
  OptionSetting
} from '@common/option'
import type { RecordingSource } from '@common/recording'
import { isTrustedRecordingSourceRequest } from '@main/recording-source'
import { isApplicationZoomShortcut, restoreApplicationZoom } from '@main/application-zoom'
import {
  applyPendingRedoForCurrentAccount,
  applyPendingMergeForCurrentAccount,
  applyPendingMergeRedoForCurrentAccount,
  applyPendingMergeRollbackForCurrentAccount,
  applyPendingRollbackForCurrentAccount,
  applyPendingRestoreForCurrentAccount,
  captureCurrentAccountAuditBaseline,
  cleanupAccountTransferCandidate,
  compareCurrentAccountAuditBaseline,
  createCurrentAccountBackup,
  createCurrentAccountTransfer,
  decryptAccountTransferCandidate,
  enforceAccountMergeRetentionForCurrentAccount,
  enforceAccountRestoreRetentionForCurrentAccount,
  getAvailableRedoForCurrentAccount,
  getAvailableMergeRedoForCurrentAccount,
  getAvailableMergeRollbackForCurrentAccount,
  getAvailableRollbackForCurrentAccount,
  prepareCurrentAccountBackupMerge,
  prepareCurrentAccountMergeRedo,
  prepareCurrentAccountMergeRollback,
  prepareCurrentAccountRedo,
  prepareCurrentAccountRollback,
  prepareVerifiedAccountBackupRestore,
  previewVerifiedAccountBackupAgainstCurrent,
  stageVerifiedAccountBackupMerge
} from '@main/account-backup-service'
import {
  inspectLocalAccountBackupDirectory,
  isTrustedAccountBackupRequest,
  toEncryptedAccountTransferResult,
  toLocalAccountBackupResult
} from '@main/account-backup-request'
import {
  createEncryptedAccountTransfer,
  decryptAccountTransferToDirectory,
  encryptedAccountTransferFilename,
  inspectEncryptedAccountTransfer,
  isValidAccountTransferPassphrase
} from '@main/account-transfer'
import {
  accountInspectionReportFilename,
  createRedactedAccountInspectionReport,
  saveRedactedAccountInspectionReport
} from '@main/account-inspection-report'
import {
  assistPanelDiagnosticFilename,
  createAssistPanelDiagnosticReport,
  type AssistPanelDiagnosticSaveResult
} from '@common/assist-diagnostic'
import { saveAssistPanelDiagnosticReport } from '@main/assist-diagnostic'
import { isTrustedAssistDiagnosticRequest } from '@main/assist-diagnostic-request'
import { hasValidAccountIdentity } from '@main/account-identity'
import type {
  AccountBackupDatabasePreview,
  EncryptedAccountTransferResult,
  LocalAccountAuditCaptureResult,
  LocalAccountAuditComparisonResult,
  LocalAccountBackupInspectionResult,
  LocalAccountBackupResult,
  LocalAccountInspectionReportResult,
  LocalAccountMergePreparationResult,
  LocalAccountRedoAvailability,
  LocalAccountRedoPreparationResult,
  LocalAccountRollbackAvailability,
  LocalAccountRollbackPreparationResult,
  LocalAccountRestorePreparationResult
} from '@common/account-backup'
import { verifyLocalAccountBackup, type VerifiedAccountBackup } from '@main/account-backup'
import type {
  AvailableAccountRedo,
  AvailableAccountRollback
} from '@main/account-restore-transaction'
import type {
  AvailableAccountMergeRedo,
  AvailableAccountMergeRollback
} from '@main/account-merge-transaction'
import { getAfterBattleFleetHpsInfo, updateFleetHps } from '@common/kcsbattle_util'

/////////////////////////////////////////////////////////////////////////////////////
// debug
const DEBUG = 0

const debug = (...args: any[]) => {
  if (DEBUG) console.info('[KcBrowser]', ...args)
}

const setUseragent = (): void => {
  const ua = session.defaultSession.getUserAgent()
  const ua1 = ua.replace(/ koubrowser\/[0-9\\.]+/, '')
  const ua2 = ua1.replace(/ Electron\/[0-9\\.]+/, '')
  session.defaultSession.setUserAgent(ua2)
}

/**
 * autoUpdaterの設定
 *
 * update checkでローカルホストに更新用ファイルを配置し確認する場合、
 * まず以下の環境変数を設定する
 * $env:KOU_UPDATE_URL='http://localhost:8080/releases'
 *
 * httpサーバは
 * scripts/run-http-server-for-update-check.bat
 * から起動できる。scriptsフォルダ配下に更新用ファイルを配置する
 *
 * 後は開発モードで動かせばよい(npm run dev)
 */
const getUpdateFeedUrl = (): string | null => {
  const overrideUrl = process.env.KOU_UPDATE_URL?.trim()
  if (Env.isDevelopment && overrideUrl) return overrideUrl
  return null
}

const updateFeedUrl = getUpdateFeedUrl()
if (Env.isDevelopment && updateFeedUrl) {
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: updateFeedUrl
  })
}
debug('update feed url:', updateFeedUrl ?? 'default')

// betaバージョンの更新チェックでは以下を指定すること
//autoUpdater.channel = 'beta'
//caption: if set channel value, allowDowngrade(default is false) set to true.
autoUpdater.allowDowngrade = false
autoUpdater.forceDevUpdateConfig = Env.isDevelopment
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false
autoUpdater.autoRunAppAfterInstall = false
debug('auto updater currentVersion', autoUpdater.currentVersion.format())

type UpdateChannel = 'beta' | 'latest'

/**
 *
 */
const calcMainWindowSize = (isAssistInGame: boolean): { width: number; height: number } => {
  if (isAssistInGame) {
    return {
      width: classicLayoutMetrics.mainWindowWidth,
      height: classicLayoutMetrics.mainWindowHeight
    }
  }

  const width = appState.game_only_width ? appState.game_only_width : Const.GameWidth
  const height = appState.game_only_height
    ? appState.game_only_height
    : classicLayoutMetrics.gameOnlyWindowHeight
  return { width, height }
}

/**
 *
 */
const defaultGameOnlySize = (): { width: number; height: number } => {
  const width = Const.GameWidth
  const height = classicLayoutMetrics.gameOnlyWindowHeight
  return { width, height }
}

/**
 *
 */
const calcMainWindowMinSize = (): { minWidth: number; minHeight: number; frame_ratio: number } => {
  const defGameOnlySize = defaultGameOnlySize()
  const frame_ratio = AppStuff.calcFrameRatio(defGameOnlySize.width, defGameOnlySize.height)
  const minWidth = 600
  const minHeight = AppStuff.calcFrameHeight(frame_ratio, minWidth)
  gameSetting.zoom_factor = AppStuff.calcGameZoomFactor(defGameOnlySize.width)
  return { minWidth, minHeight, frame_ratio }
}

/**
 *
 */
const installVueDevtoolsIfDev = (): void => {
  if (Env.isDevelopment) {
    const path =
      process.env.LOCALAPPDATA +
      '/Google/Chrome/User Data/Default/Extensions/nhdogjmejiglipccpnnnanhbledajbpd/7.7.7_0'
    if (fs.existsSync(path)) {
      session.defaultSession.extensions
        .loadExtension(path, { allowFileAccess: true })
        .then(() => {
          debug('Vue Devtools loaded')
        })
        .catch((err) => {
          debug('Vue Devtools load failed:', err)
        })
    }
  }
}

/**
 *
 * @param win
 */
const openAppHtml = (win: BrowserWindow): void => {
  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  debug('open renderer url:', process.env['ELECTRON_RENDERER_URL'])
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(getMainDir(), '../renderer/index.html'))
  }
}

const openOptionHtml = (win: BrowserWindow): void => {
  debug('open option renderer url:', process.env['ELECTRON_RENDERER_URL'])
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/option.html`)
  } else {
    win.loadFile(path.join(getMainDir(), '../renderer/option.html'))
  }
}

let kcapp: KcApp
export const getKcApp = (): KcApp | undefined => {
  return kcapp
}

/**
 *
 */
export class KcApp {
  private main_window: BrowserWindow
  private game_webcontents: WebContents | null = null
  private assist_window: BrowserWindow | null = null
  private option_window: BrowserWindow | null = null
  private readonly child_windows = new Set<BrowserWindow>()
  private frame_ratio: number
  private kcrecord: KcRecord | null = null
  private cbBasicFirst: number = 0
  private nohandle_resize: boolean = false
  private displayLayoutTimer: ReturnType<typeof setTimeout> | null = null
  private wsRecording: fs.WriteStream | null = null
  private questUpdated_called: boolean = false
  private availableUpdateVersion: string | null = null
  private downloadedUpdateVersion: string | null = null
  private isStartupUpdateChecked: boolean = false
  private startupUpdateCheckResult: UpdateCheckResult | null = null
  private isSilentUpdate: boolean = true
  private assistDiagnosticInProgress = false
  private accountBackupInProgress = false
  private lastDataFolderFixturePath: string | null = null
  private accountTransferCandidateRoot: string | null = null
  private accountRestoreCandidate: VerifiedAccountBackup | null = null
  private accountMergeCandidate: {
    readonly verified: VerifiedAccountBackup
    readonly previews: readonly AccountBackupDatabasePreview[]
  } | null = null
  private accountMergeRollbackCandidate: AvailableAccountMergeRollback | null = null
  private accountMergeRedoCandidate: AvailableAccountMergeRedo | null = null
  private accountRollbackCandidate: AvailableAccountRollback | null = null
  private accountRedoCandidate: AvailableAccountRedo | null = null
  private accountInitialization: Promise<void> | null = null
  private accountInitializationError: unknown = null
  private globalSetting: GlobalSetting = defaultGlobalSetting()
  private readonly translate = createAppTranslator(() => this.globalSetting.locale)
  private updateState: UpdateStateSnapshot = {
    status: 'idle',
    availableVersion: '',
    errorMessage: '',
    downloadPercent: null
  }
  private taihaSingekiBlockStates: TaihaSingekiBlockState[] = []
  private ctrl_key_state: boolean = false

  public get mainWindow(): BrowserWindow {
    return this.main_window
  }

  public get assistWindow(): BrowserWindow | null {
    return this.assist_window
  }

  private async clearAccountTransferCandidate(): Promise<void> {
    const temporaryRoot = this.accountTransferCandidateRoot
    this.accountTransferCandidateRoot = null
    if (temporaryRoot) {
      await cleanupAccountTransferCandidate(temporaryRoot)
    }
  }

  public async cleanupSensitiveTemporaryData(): Promise<void> {
    await this.clearAccountTransferCandidate()
  }

  public prepareForShutdown(): void {
    this.kcrecord?.doDispose()
  }

  public saveAppState(): void {
    debug('saveAppState called isRestricted:', gameSetting.assistRestricted)

    // ディスプレイ要件を満たすディスプレイがない場合は
    // ・ミュート状態
    // ・topmost状態
    // のみ保存する
    if (gameSetting.assistRestricted) {
      appSetting.saveAppStateRestricted(this.mainWindow, gameSetting.topmost, gameState.muted)
    } else {
      appSetting.saveAppState(
        this.mainWindow,
        gameSetting.assistInGame,
        {
          width: appState.game_only_width,
          height: appState.game_only_height
        },
        gameSetting.topmost,
        gameState.muted,
        gameSetting.layoutMode
      )
    }
  }

  constructor() {
    kcapp = this

    const appLaunchId = crypto.randomUUID()

    debug('app dir(dirname):', __dirname)
    debug('app dir(user data):', app.getPath('userData'))
    debug('app launch id:', appLaunchId)

    // start worker driver
    WorkersStart(getMainDir(), getActiveDataDirectory())

    // load app setting
    appSetting.loadAppJsonSetting()

    // set useragent
    setUseragent()

    // install Vue.js devtools
    installVueDevtoolsIfDev()

    // イベントやIPCハンドラ設定
    this.setupHandlers()

    // calc main window min size
    const { minWidth, minHeight, frame_ratio } = calcMainWindowMinSize()
    this.frame_ratio = frame_ratio

    // Resolve persisted preferences against logical work areas. Electron work
    // areas already account for taskbars and high-DPI scaling.
    const displays = screen.getAllDisplays()
    const restoredLayoutMode = appSetting.restoreLayoutMode()
    const restoredAssistInGame = appSetting.restoreAssistInGame()
    const initialLayout = resolveInitialLayout(
      restoredLayoutMode,
      restoredAssistInGame ?? true,
      displays.map((display) => display.workArea)
    )
    gameSetting.setAssistRestricted(initialLayout.assistRestricted)
    gameSetting.setLayoutMode(initialLayout.layoutMode)
    gameSetting.setAssistInGame(initialLayout.requestedAssistInGame)

    const restoredTopmost = appSetting.restoreTopmost()
    if (restoredTopmost !== undefined) {
      gameSetting.topmost = restoredTopmost
    }
    const restoredMuted = appSetting.restoreMuted()
    if (restoredMuted !== undefined) {
      gameState.muted = restoredMuted
    }

    // Create the browser window.

    // 前回終了ウインドウ位置で現環境のdisplayに表示できる場合の座標取得
    // 取得できない場合、undef
    const restoredGameOnlySize = appSetting.restoreGameOnlySize()
    const restoredMainWindowBoundsCandidate = appSetting.restoreMainWindowBounds(
      gameSetting.isAssistInGame,
      gameSetting.layoutMode
    )
    const restoredMainWindowDisplay = restoredMainWindowBoundsCandidate
      ? screen.getDisplayMatching(restoredMainWindowBoundsCandidate)
      : undefined
    const restoredMainWindowDisplayIndex = restoredMainWindowDisplay
      ? findCurrentDisplayIndex(restoredMainWindowDisplay, displays)
      : undefined
    const initialLayoutDisplayIndex = resolveInlineLayoutDisplayIndex(
      restoredMainWindowDisplayIndex,
      initialLayout.layoutMode,
      displays.map((display) => display.workArea)
    )
    const initialLayoutDisplay =
      initialLayoutDisplayIndex === undefined ? undefined : displays[initialLayoutDisplayIndex]
    const compatibleRestoredMainWindowBounds =
      !gameSetting.isAssistInGame ||
      !restoredMainWindowBoundsCandidate ||
      (restoredMainWindowDisplay &&
        workAreaSupportsLayout(restoredMainWindowDisplay.workArea, gameSetting.layoutMode))
        ? restoredMainWindowBoundsCandidate
        : undefined
    const primaryDisplay = screen.getPrimaryDisplay()
    const gameOnlyDisplay = gameSetting.assistRestricted
      ? primaryDisplay
      : (restoredMainWindowDisplay ?? primaryDisplay)
    const gameOnlyRequestedWidth = gameSetting.assistRestricted
      ? Math.max(gameOnlyDisplay.workArea.width - classicLayoutMetrics.assistWidth, minWidth)
      : (compatibleRestoredMainWindowBounds?.width ??
        restoredGameOnlySize?.width ??
        Const.GameWidth)
    const fittedGameOnlySize = fitGameOnlyWindowSize(
      gameOnlyRequestedWidth,
      gameOnlyDisplay.workArea,
      minWidth
    )
    const restoredMainWindowBounds =
      !gameSetting.isAssistInGame && compatibleRestoredMainWindowBounds
        ? {
            ...fitRectangleToWorkArea(
              {
                x: compatibleRestoredMainWindowBounds.x,
                y: compatibleRestoredMainWindowBounds.y,
                ...fittedGameOnlySize
              },
              gameOnlyDisplay.workArea,
              fittedGameOnlySize
            ),
            ...(compatibleRestoredMainWindowBounds.maximized ? { maximized: true as const } : {})
          }
        : compatibleRestoredMainWindowBounds

    // メインウインドウ表示サイズ
    const mainWindowSize = ((): { width: number; height: number; resizable: boolean } => {
      if (gameSetting.layoutMode === 'workspace') {
        if (restoredMainWindowBounds) {
          return {
            width: restoredMainWindowBounds.width,
            height: restoredMainWindowBounds.height,
            resizable: true
          }
        }
        const workArea = initialLayoutDisplay?.workArea ?? screen.getPrimaryDisplay().workArea
        return {
          width: workArea.width,
          height: workArea.height,
          resizable: true
        }
      }

      // 推奨サイズの要件を満たすディスプレイがない場合はゲーム画面と別ウインドウアシストを表示する
      // プライマリディスプレイに表示する
      if (gameSetting.assistRestricted) {
        return { ...fittedGameOnlySize, resizable: true }
      }

      // 前回起動座標が無効
      if (!restoredMainWindowBounds) {
        // デフォルト初期サイズで表示
        return gameSetting.isAssistInGame
          ? { ...calcMainWindowSize(true), resizable: false }
          : { ...fittedGameOnlySize, resizable: true }
      }

      // 前回起動座標が有効
      if (gameSetting.isAssistInGame) {
        // サイズは固定
        return { ...calcMainWindowSize(true), resizable: false }
      }

      // ゲームのみ表示、保存されているサイズを返却
      return {
        width: restoredMainWindowBounds.width,
        height: restoredMainWindowBounds.height,
        resizable: true
      }
    })()
    if (gameSetting.layoutMode === 'workspace') {
      gameSetting.zoom_factor = fitWorkspaceGameStage(mainWindowSize).scale
    }

    // メインウインドウ表示位置
    const mainWindowPos = ((): { x: number; y: number } | undefined => {
      // 推奨サイズの要件を満たすディスプレイがない場合
      if (gameSetting.assistRestricted) {
        // 表示位置保存が無い場合、プライマリディスプレイに表示する
        const primaryDisplay = screen.getPrimaryDisplay()
        const bounds = primaryDisplay.workArea
        return { x: bounds.x, y: bounds.y + (bounds.height - mainWindowSize.height) / 2 }
      }

      if (gameSetting.isAssistInGame && !restoredMainWindowBounds && initialLayoutDisplay) {
        const workArea = initialLayoutDisplay.workArea
        if (gameSetting.layoutMode === 'workspace') {
          return { x: workArea.x, y: workArea.y }
        }
        return {
          x: workArea.x + Math.floor((workArea.width - mainWindowSize.width) / 2),
          y: workArea.y + Math.floor((workArea.height - mainWindowSize.height) / 2)
        }
      }

      // 前回起動座標が無効
      if (!restoredMainWindowBounds) {
        // 表示位置を指定しない
        return undefined
      }

      // 前回起動座標が有効
      return { x: restoredMainWindowBounds.x, y: restoredMainWindowBounds.y }
    })()

    // 表示座標を指定しない場合、中央表示
    const mainWindowPlacement = mainWindowPos ?? { center: true }

    // create main frame
    const additionalArguments: string[] = []
    additionalArguments.push(`${Const.ArgAppLaunchId}=${appLaunchId}`)
    if (Env.isTestMode) {
      additionalArguments.push(Const.ArgIsTestMode)
    }
    if (isLayoutFixtureEnabled()) {
      additionalArguments.push(Const.ArgIsLayoutFixture)
    }
    if (isPseudoLocaleFixtureEnabled()) {
      additionalArguments.push(Const.ArgPseudoLocale)
    }
    if (gameState.muted) {
      additionalArguments.push(Const.ArgIsInitMuted)
    }
    const mainWindowOptions: BrowserWindowConstructorOptions = {
      show: false,
      useContentSize: true,
      width: mainWindowSize.width,
      height: mainWindowSize.height,
      ...mainWindowPlacement,
      minWidth:
        gameSetting.layoutMode === 'workspace' ? workspaceLayoutMetrics.minWindowWidth : minWidth,
      minHeight:
        gameSetting.layoutMode === 'workspace' ? workspaceLayoutMetrics.minWindowHeight : minHeight,
      fullscreenable: false,
      maximizable: gameSetting.layoutMode === 'workspace',
      titleBarStyle: 'hidden',
      frame: false,
      resizable: mainWindowSize.resizable,
      backgroundColor: '#000',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        nodeIntegrationInSubFrames: true,
        webviewTag: true,
        spellcheck: false,
        backgroundThrottling: false,
        preload: path.join(__dirname, '../preload/index.js'),
        additionalArguments,
        sandbox: false
        //sandbox: true
      }
    }
    this.main_window = new BrowserWindow(mainWindowOptions)
    showMainWindowWhenReady(this.main_window)
    if (
      gameSetting.layoutMode === 'workspace' &&
      (!restoredMainWindowBounds || restoredMainWindowBounds.maximized)
    ) {
      this.main_window.maximize()
    }

    // ゲームのみ表示で保存されていたサイズを復元
    if (!gameSetting.isAssistInGame) {
      appState.game_only_width = fittedGameOnlySize.width
      appState.game_only_height = fittedGameOnlySize.height
    } else if (restoredGameOnlySize) {
      appState.game_only_width = restoredGameOnlySize.width
      appState.game_only_height = restoredGameOnlySize.height
    }

    // ゲームページの場合にプリロード指定
    this.main_window.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
      debug('will-attach-webview:', params, webPreferences)
      if (params.src === Const.GamePageUrl) {
        webPreferences.preload = path.join(getMainDir(), '../preload/xhr-hook.js')
      }
    })
    this.main_window.webContents.on('did-attach-webview', (_event, webContents) => {
      if (webContents.hostWebContents !== this.main_window.webContents) {
        return
      }
      this.game_webcontents = webContents
      webContents.once('destroyed', () => {
        if (this.game_webcontents === webContents) {
          this.game_webcontents = null
        }
      })
    })

    // 轟沈防止でCTRLキー押下状態を検知するため、webviewのbefore-input-eventを監視する(game webview側)
    this.main_window.webContents.on('did-attach-webview', (_event, webContents: WebContents) => {
      debug('did-attach-webview')
      webContents.on('before-input-event', (_event, input) => this.onBeforeInputEvent(input))
      webContents.on('before-mouse-event', (_event, mouse) => this.onBeforeMouseEvent(_event, mouse))
    })


    // 轟沈防止でCTRLキー押下状態を検知するため、webviewのbefore-input-eventを監視する(main webcontents側)
    // フォーカスロストはmain webcontents側でのみ検知できる
    this.main_window.webContents.on('before-input-event', (_event, input) => this.onBeforeInputEvent(input))
    this.main_window.webContents.on('blur', () => this.onMainWindowBlur())

    if (Env.isDevelopment) {
      this.main_window.webContents.openDevTools()
    }

    appState.media_source_id = this.main_window.getMediaSourceId()
    debug({
      assistRestricted: gameSetting.assistRestricted,
      main_window_id: this.main_window.id,
      media_source_id: appState.media_source_id,
      mainWindowSize: mainWindowSize,
      mainWindowPos: mainWindowPos,
      frame_ratio: this.frame_ratio,
      minWidth,
      minHeight,
      'calcFrameRatio:': AppStuff.calcFrameRatio(minWidth, minHeight)
    })

    debug('mainWindow pos info', {
      getPosition: this.main_window.getPosition(),
      getBounds: this.main_window.getBounds(),
      getContentBounds: this.main_window.getContentBounds(),
      getSize: this.main_window.getSize()
    })

    gameSettingProxy.webContents = this.main_window.webContents
    if (!gameSetting.isAssistInGame) {
      this.updateGameOnlyZoomFactor()
    }
    this.main_window.setAlwaysOnTop(gameSetting.topmost)

    // open app html
    openAppHtml(this.mainWindow)

    // アシストウインドウを別画面で表示する場合
    // display要件を満たすディスプレイがない場合はアシストウインドウを別画面で表示する
    const restoredAssistWindowState = appSetting.restoreAssistWindowState(true)
    if (
      gameSetting.layoutMode !== 'workspace' &&
      (restoredAssistWindowState || gameSetting.assistRestricted)
    ) {
      const state = gameSetting.assistRestricted ? undefined : restoredAssistWindowState
      this.openAssistWindow(
        state?.position
          ? { ...state.position, size: state.size, display: state.display }
          : undefined
      )
    }

    // Persist window state before any child windows are closed by the main window shutdown path.
    this.mainWindow.on('close', () => {
      this.closeRelatedWindows()
      this.saveAppState()
    })

    this.mainWindow.on('closed', () => this.onClosed())
    this.mainWindow.on('resize', () => this.onResize())
    if (gameSetting.layoutMode === 'workspace') {
      this.updateWorkspaceZoomFactor()
    }
    // Windows preserves the physical window rectangle while crossing between
    // monitors with different scale factors. Reconcile after the move so an
    // inline layout is clamped back into the target monitor's logical work
    // area instead of remaining wider or taller than that display.
    this.mainWindow.on('move', this.onDisplayConfigurationChanged)
    this.mainWindow.on('will-resize', (event, newBounds, _details) =>
      this.onWillResize(event, newBounds)
    )
    screen.on('display-added', this.onDisplayConfigurationChanged)
    screen.on('display-removed', this.onDisplayConfigurationChanged)
    screen.on('display-metrics-changed', this.onDisplayConfigurationChanged)

    // set intake schedule
    Intaker.setIntakeSchedule()
  }

  /**
   *
   */
  private openAssistWindow(position?: {
    x: number
    y: number
    size?: { width: number; height: number }
    display: Display
  }): void {
    if (this.assist_window) {
      // noop
      return
    }

    // 表示位置計算
    const assistWindowPosition = ((): { x: number; y: number; display: Display } => {
      // 位置情報が有効
      if (position) {
        return position
      }

      // 推奨サイズの要件を満たすディスプレイがない場合
      if (gameSetting.assistRestricted) {
        // 表示位置保存が無い場合、プライマリディスプレイに表示する
        // ウインドウはcontentsizeでの作成で実際はフレームサイズ分補正が必要
        // 補正はウインドウ非表示で作成後に行う
        const primaryDisplay = screen.getPrimaryDisplay()
        const bounds = primaryDisplay.workArea
        const y = Math.max(
          bounds.y,
          bounds.y + (bounds.height - Const.InGameAssistDisplayRequirementHeight) / 2
        )
        // debug('assist window position for restricted:',
        //   { x: bounds.x + bounds.width - Const.AssistWidth, y, display: primaryDisplay,
        //     assistWindowWidth: Const.AssistWidth,
        //     bounds: bounds
        //   })
        return {
          x: bounds.x + bounds.width - Const.AssistWidth,
          y,
          display: primaryDisplay
        }
      }

      // 位置情報が無効、メインウインドウの表示位置から空いている領域に表示
      const mainRect = this.main_window.getNormalBounds()
      const display = screen.getDisplayMatching(this.main_window.getBounds())
      const bounds = display.workArea
      const y = Math.max(
        bounds.y,
        bounds.y + (bounds.height - Const.InGameAssistDisplayRequirementHeight) / 2
      )

      // 空き領域判定
      const intersectRect = RectUtil.intersect(mainRect, bounds)
      if (!intersectRect) {
        return { x: mainRect.x + mainRect.width - 100, y, display }
      }

      const leftSpace = intersectRect.x - bounds.x
      const rightSpace = bounds.x + bounds.width - (intersectRect.x + intersectRect.width)
      if (rightSpace >= leftSpace) {
        return { x: intersectRect.x + intersectRect.width, y, display }
      } else {
        return { x: intersectRect.x - Const.AssistWidth, y, display }
      }
    })()

    // 表示サイズ計算
    const assistWindowSize = ((): { width: number; height: number } => {
      const workArea = assistWindowPosition.display.workArea
      const defaultHeight = Math.min(
        Const.InGameAssistDisplayRequirementHeight - Const.TitleBarHeight,
        workArea.height
      )
      const minWidth = Math.min(classicLayoutMetrics.assistWidth, workArea.width)
      const minHeight = Math.min(480, workArea.height)
      const requestedWidth = position?.size?.width ?? classicLayoutMetrics.assistWidth
      const requestedHeight = position?.size?.height ?? defaultHeight
      return {
        width: Math.min(Math.max(requestedWidth, minWidth), workArea.width),
        height: Math.min(Math.max(requestedHeight, minHeight), workArea.height)
      }
    })()

    const assistWindowBounds = (() => {
      const workArea = assistWindowPosition.display.workArea
      return fitRectangleToWorkArea(
        { x: assistWindowPosition.x, y: assistWindowPosition.y, ...assistWindowSize },
        workArea,
        {
          width: Math.min(classicLayoutMetrics.assistWidth, workArea.width),
          height: Math.min(480, workArea.height)
        }
      )
    })()

    const additionalArguments: string[] = [Const.ArgIsAssist]
    if (Env.isTestMode) {
      additionalArguments.push(Const.ArgIsTestMode)
    }
    if (isPseudoLocaleFixtureEnabled()) {
      additionalArguments.push(Const.ArgIsLayoutFixture, Const.ArgPseudoLocale)
    }

    debug('assist window info', {
      assistRestricted: gameSetting.assistRestricted,
      assistWindowPosition,
      assistWindowSize,
      assistWindowBounds,
      display: assistWindowPosition.display
    })

    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'resources/app.ico')
      : path.join(__dirname, '../../resources/app.ico')
    this.assist_window = new BrowserWindow({
      title: this.translate('app.name'),
      icon: iconPath,
      parent: this.main_window,
      useContentSize: true,
      width: assistWindowBounds.width,
      height: assistWindowBounds.height,
      minWidth: Math.min(
        classicLayoutMetrics.assistWidth,
        assistWindowPosition.display.workArea.width
      ),
      minHeight: Math.min(480, assistWindowPosition.display.workArea.height),
      x: assistWindowBounds.x,
      y: assistWindowBounds.y,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        nodeIntegrationInSubFrames: true,
        spellcheck: false,
        preload: path.join(getMainDir(), '../preload/index.js'),
        additionalArguments,
        sandbox: false
        //sandbox: true
      }
    })
    this.assist_window.setMenu(null)

    // ウインドウ位置とサイズをフレームサイズで補正
    if (gameSetting.assistRestricted) {
      // 位置補正
      const contentBounds = this.assist_window.getContentBounds()
      const windowBounds = this.assist_window.getBounds()
      const fixX = windowBounds.width - contentBounds.width
      const fixX2 = Math.trunc(fixX / assistWindowPosition.display.scaleFactor)
      this.assist_window.setPosition(assistWindowBounds.x - fixX2, assistWindowBounds.y)

      // サイズ補正
      const workArea = assistWindowPosition.display.workArea
      if (workArea.height < windowBounds.height) {
        this.assist_window.setSize(
          windowBounds.width,
          workArea.height + Math.max(0, fixX2 - 2),
          false
        )
      }
    }

    // 補正後に表示
    this.assist_window.show()

    this.assist_window.addListener('close', () => {
      if (!gameSetting.assistRestricted) {
        // 閉じた位置を保存
        if (this.assist_window) {
          appSetting.updateAssistWindowState(this.assist_window, true)
        }
      }
    })
    this.assist_window.addListener('closed', () => {
      this.assist_window = null
    })
    // A normal cross-display move does not emit a display topology event.
    // Reuse the debounced work-area reconciliation so a separate assist
    // window cannot retain an oversized physical rectangle after a DPI change.
    this.assist_window.on('move', this.onDisplayConfigurationChanged)

    // open app html
    openAppHtml(this.assist_window)

    if (Env.isDevelopment) {
      this.assist_window.webContents.openDevTools()
    }
  }

  /**
   *
   */
  private openOptionWindow(): void {
    if (this.option_window) {
      this.option_window.show()
      this.option_window.focus()
      return
    }

    const mainBounds = this.main_window.getBounds()
    const targetDisplay = screen.getDisplayMatching(mainBounds)
    const area = targetDisplay.workArea
    const width = Math.min(960, area.width)
    const height = Math.min(680, area.height)
    const x = area.x + Math.floor((area.width - width) / 2)
    const y = area.y + Math.floor((area.height - height) / 2)
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'resources/app.ico')
      : path.join(__dirname, '../../resources/app.ico')

    const additionalArguments: string[] = []
    if (Env.isTestMode) {
      additionalArguments.push(Const.ArgIsTestMode)
    }

    // 非表示で作成
    // 現オプション設定内容を取得後に表示
    this.option_window = new BrowserWindow({
      title: this.translate('option.title'),
      show: false,
      icon: iconPath,
      frame: false,
      useContentSize: true,
      width,
      height,
      x,
      y,
      minWidth: 720,
      minHeight: 480,
      backgroundColor: '#111318',
      webPreferences: {
        additionalArguments,
        nodeIntegration: false,
        contextIsolation: true,
        spellcheck: false,
        preload: path.join(getMainDir(), '../preload/option-api.js'),
        // preload指定ではsandboxを無効にする必要がある
        sandbox: false
      }
    })
    this.option_window.setMenu(null)
    this.option_window.addListener('closed', () => {
      this.option_window = null
    })

    openOptionHtml(this.option_window)

    if (Env.isDevelopment) {
      this.option_window.webContents.openDevTools()
    }
  }

  /**
   *
   */
  private closeRelatedWindows(): void {
    if (this.option_window && !this.option_window.isDestroyed()) {
      this.option_window.close()
    }

    if (this.assist_window && !this.assist_window.isDestroyed()) {
      if (!gameSetting.assistRestricted) {
        appSetting.updateAssistWindowState(this.assist_window, false)
      }
    }
  }

  /**
   *
   */
  private setupHandlers() {
    app.on('web-contents-created', (event, webContents) =>
      this.onWebContentsCreated(event, webContents)
    )

    ipcMain.handle(MainChannel.renderer_ready, async (event) => this.onChannelRendererReady(event))
    ipcMain.handle(MainChannel.show_assist, () => this.onChannelShowAssist(true))
    ipcMain.handle(MainChannel.hide_assist, () => this.onChannelShowAssist(false))
    ipcMain.handle(MainChannel.toggle_layout_mode, () => this.onChannelToggleLayoutMode())
    ipcMain.handle(MainChannel.toggle_maximize, () => this.onChannelToggleMaximize())
    ipcMain.handle(MainChannel.minimize, async () => this.onChannelMinimize())
    ipcMain.handle(MainChannel.close, async () => this.onChannelClose())
    ipcMain.handle(MainChannel.devtool, async () => this.onChannelDevTool())
    ipcMain.handle(MainChannel.reload, async (_event, arg) => this.onChannelReload(arg))
    ipcMain.handle(MainChannel.openAssist, async () => this.onChannelOpenAssist())
    ipcMain.handle(MainChannel.topmost, async () => this.onChannelTopmost())
    ipcMain.handle(MainChannel.notify_mute_state, async (_event, arg) =>
      this.onChannelNotifyMuteState(arg)
    )
    ipcMain.handle(MainChannel.open_capture_folder, async () => this.onChannelOpenCaptureFolder())
    ipcMain.handle(MainChannel.open_data_folder, async (event) =>
      this.onChannelOpenDataFolder(event)
    )
    ipcMain.handle(MainChannel.save_assist_panel_diagnostic, async (event, diagnostic) =>
      this.onChannelSaveAssistPanelDiagnostic(event, diagnostic)
    )
    ipcMain.handle(MainChannel.create_local_account_backup, async (event) =>
      this.onChannelCreateLocalAccountBackup(event)
    )
    ipcMain.handle(MainChannel.create_encrypted_account_transfer, async (event, passphrase) =>
      this.onChannelCreateEncryptedAccountTransfer(event, passphrase)
    )
    ipcMain.handle(MainChannel.inspect_encrypted_account_transfer, async (event, passphrase) =>
      this.onChannelInspectEncryptedAccountTransfer(event, passphrase)
    )
    ipcMain.handle(MainChannel.inspect_local_account_backup, async (event) =>
      this.onChannelInspectLocalAccountBackup(event)
    )
    ipcMain.handle(MainChannel.save_account_inspection_report, async (event) =>
      this.onChannelSaveAccountInspectionReport(event)
    )
    ipcMain.handle(MainChannel.prepare_local_account_merge, async (event) =>
      this.onChannelPrepareLocalAccountMerge(event)
    )
    ipcMain.handle(MainChannel.get_available_account_merge_rollback, async (event) =>
      this.onChannelGetAvailableAccountMergeRollback(event)
    )
    ipcMain.handle(MainChannel.prepare_account_merge_rollback, async (event) =>
      this.onChannelPrepareAccountMergeRollback(event)
    )
    ipcMain.handle(MainChannel.get_available_account_merge_redo, async (event) =>
      this.onChannelGetAvailableAccountMergeRedo(event)
    )
    ipcMain.handle(MainChannel.prepare_account_merge_redo, async (event) =>
      this.onChannelPrepareAccountMergeRedo(event)
    )
    ipcMain.handle(MainChannel.prepare_local_account_restore, async (event) =>
      this.onChannelPrepareLocalAccountRestore(event)
    )
    ipcMain.handle(MainChannel.get_available_account_rollback, async (event) =>
      this.onChannelGetAvailableAccountRollback(event)
    )
    ipcMain.handle(MainChannel.prepare_account_rollback, async (event) =>
      this.onChannelPrepareAccountRollback(event)
    )
    ipcMain.handle(MainChannel.get_available_account_redo, async (event) =>
      this.onChannelGetAvailableAccountRedo(event)
    )
    ipcMain.handle(MainChannel.prepare_account_redo, async (event) =>
      this.onChannelPrepareAccountRedo(event)
    )
    ipcMain.handle(MainChannel.capture_account_audit_baseline, async (event) =>
      this.onChannelCaptureAccountAuditBaseline(event)
    )
    ipcMain.handle(MainChannel.compare_account_audit_baseline, async (event) =>
      this.onChannelCompareAccountAuditBaseline(event)
    )
    ipcMain.handle(MainChannel.save_capture, async (_event, date, buffer) =>
      this.onChannelSaveCapture(date, buffer)
    )
    ipcMain.handle(MainChannel.get_recording_source, async (event) =>
      this.onChannelGetRecordingSource(event)
    )
    ipcMain.handle(MainChannel.openOption, async () => this.onChannelOpenOption())
    ipcMain.handle(MainChannel.refresh_assist, async () => this.onChannelRefreshAssist())
    ipcMain.handle(MainChannel.store_rec, async (_event, buffer, isEnd) =>
      this.onChannelStoreRec(buffer, isEnd)
    )
    ipcMain.handle(MainChannel.timeline, async () => this.onChannelTimeline())
    ipcMain.handle(MainChannel.request_required_data, (event) =>
      this.onChannelRequestRequiredData(event)
    )
    ipcMain.handle(MainChannel.ship_csv, async (_event, csv) => this.onChannelShipCsv(csv))
    ipcMain.handle(MainChannel.get_airbase_spots, async (_event, area_id, area_no) =>
      this.onChannelGetAirbaseSpots(area_id, area_no)
    )
    ipcMain.handle(MainChannel.set_airbase_spots, async (_event, arg) =>
      this.onChannelSetAirbaseSpots(arg)
    )
    ipcMain.handle(MainChannel.open_external_url, async (event, url) =>
      this.onChannelOpenExternalUrl(event, url)
    )
    ipcMain.handle(MainChannel.get_version, () => this.onChannelGetVersion())
    ipcMain.handle(MainChannel.query_db, async (_event, query) => this.onChannelQueryDb(query))
    ipcMain.handle(MainChannel.clear_session_cache, async () => this.onChannelClearSessionCache())
    ipcMain.handle(MainChannel.find_spot_for_label, async (_event, mapnifo, map) =>
      this.onChannelFindSpotForLabel(mapnifo, map)
    )
    ipcMain.handle(MainChannel.cell_info_async, async (_event, area_id, area_no) =>
      this.onChannelCellInfoAsync(area_id, area_no)
    )
    ipcMain.handle(MainChannel.calc_port_chart_data, async (_event) =>
      this.onChannelCalcPortChartData()
    )
    ipcMain.handle(MainChannel.save_app_setting, (event, store) =>
      this.onChannelSaveAppSetting(event, store)
    )
    ipcMain.handle(MainChannel.save_global_setting, (event, setting) =>
      this.onChannelSaveGlobalSetting(event, setting)
    )
    ipcMain.handle(MainChannel.aggregate_cell_rank, (_event, area_id, area_no) =>
      this.onChannelAggregateRankByArea(area_id, area_no)
    )
    ipcMain.handle(MainChannel.aggregate_ship_drop, (event, ship_id) =>
      this.onChannelAggregateShipDrop(ship_id, event.sender.id)
    )
    ipcMain.handle(MainChannel.get_inherit_score_list, async () =>
      this.onChannelGetInheritScoreList()
    )
    ipcMain.handle(MainChannel.save_inherit_score_list, (_event, list) =>
      this.onChannelSaveInheritScoreList(list)
    )
    ipcMain.handle(MainChannel.get_update_state, async () => this.onChannelGetUpdateState())
    ipcMain.handle(MainChannel.check_for_updates, async (_event, setting?: GlobalSetting) =>
      this.onChannelCheckForUpdates(setting)
    )
    ipcMain.handle(MainChannel.download_update, async () => this.onChannelDownloadUpdate())
    ipcMain.handle(MainChannel.restart_and_install_update, async () =>
      this.onChannelRestartAndInstallUpdate()
    )
    ipcMain.handle(MainChannel.set_taiha_singeki_block_state, (_event, states) =>
      this.onChannelSetTaihaSingekiBlockState(states)
    )
    autoUpdater.on('download-progress', (progress) =>
      this.notifyUpdateDownloadProgress(progress.percent)
    )

    powerMonitor.on('resume', () => this.onPowerResume())
    this.cbBasicFirst = ApiCallback.set([
      kcsapi.Api.GET_MEMBER_REQUIRE_INFO,
      () => this.onRequireInfo()
    ])
    ApiCallback.set([kcsapi.Api.GET_MEMBER_MAPINFO, (args) => this.onMapInfo(args)])
    ApiCallback.set([kcsapi.Api.GET_MEMBER_MISSION, (args) => this.onMissionList(args)])
    ApiCallback.set([kcsapi.Api.GET_MEMBER_QUESTLIST, (args) => this.onQuestList(args)])

    // api request/response hook event
    ipcMain.on(kcsapi_hook.HookedType.serverid, (_event, data) => this.onApiHookServerId(data))
    ipcMain.on(kcsapi_hook.HookedType.loadstart, (_event, data) =>
      this.onApiHookLoadStart(data, true)
    )
    ipcMain.on(kcsapi_hook.HookedType.loadend, (_event, data) =>
      this.onApiHookLoadEnd(data, true)
    )
    if (Env.isDevelopment) {
      ipcMain.on(kcsapi_hook.HookedType.unk_loadstart, (_event, data) =>
        this.onApiHookUnknownLoadStart(data)
      )
      ipcMain.on(kcsapi_hook.HookedType.unk_loadend, (_event, data) =>
        this.onApiHookUnknownLoadEnd(data)
      )
    }

    // option
    ipcMain.handle(OptionChannel.getCurrentSetting, async () =>
      this.onChannelOptionGetCurrentSetting()
    )
    ipcMain.handle(OptionChannel.readyToShow, () => this.onChannelOptionReadyToShow())
    ipcMain.handle(OptionChannel.selectCaptureSavePath, () =>
      this.onChannelOptionSelectCaptureSavePath()
    )
    ipcMain.handle(OptionChannel.selectExtensionPath, () =>
      this.onChannelOptionSelectExtensionPath()
    )
    ipcMain.handle(OptionChannel.minimize, () => this.onChannelOptionMinimize())
    ipcMain.handle(OptionChannel.close, () => this.onChannelOptionClose())
    ipcMain.handle(OptionChannel.saveSetting, (_event, data) =>
      this.onChannelOptionSaveSetting(data)
    )
  }

  /**
   * カスタムメニュー設定
   */
  private buildCustomMenu(): Menu {
    const goBackFoward = (id: number, isBack: boolean) => {
      const w = BrowserWindow.fromId(id)
      if (w) {
        const wc = w.webContents
        if (isBack) {
          if (wc.navigationHistory.canGoBack()) {
            wc.navigationHistory.goBack()
          }
        } else {
          if (wc.navigationHistory.canGoForward()) {
            wc.navigationHistory.goForward()
          }
        }
      }
    }

    const template: (MenuItem | Electron.MenuItemConstructorOptions)[] = [
      {
        label: this.translate('main.menu.file'),
        submenu: [
          {
            label: this.translate('main.menu.close'),
            accelerator: 'Ctrl+W',
            role: 'close'
          }
        ]
      },
      {
        label: this.translate('main.menu.view'),
        submenu: [
          {
            label: this.translate('main.menu.reload'),
            accelerator: 'Ctrl+R',
            role: 'reload'
          },
          {
            label: this.translate('main.menu.reload'),
            accelerator: 'F5',
            role: 'reload',
            visible: false
          },
          {
            label: this.translate('main.menu.forceReload'),
            accelerator: 'Ctrl+Shift+R',
            role: 'forceReload'
          },
          {
            label: this.translate('main.menu.forceReload'),
            accelerator: 'Ctrl+F5',
            role: 'forceReload',
            visible: false
          },
          { type: 'separator' },
          {
            label: this.translate('main.menu.back'),
            accelerator: 'Alt+Left',
            click: (_menuItem, window) => goBackFoward(window?.id ?? -1, true)
          },
          {
            label: this.translate('main.menu.forward'),
            accelerator: 'Alt+Right',
            click: (_menuItem, window) => goBackFoward(window?.id ?? -1, false)
          },
          { type: 'separator' },
          {
            label: this.translate('main.menu.devtools'),
            accelerator: 'F12',
            role: 'toggleDevTools'
          }
        ]
      }
    ]

    return Menu.buildFromTemplate(template)
  }

  /**
   *
   * @param window
   */
  private setCustomMenu(window: BrowserWindow): void {
    window.setMenu(this.buildCustomMenu())
  }

  private updateLocalizedWindowChrome(): void {
    this.main_window.setTitle(this.translate('app.name'))
    if (this.assist_window && !this.assist_window.isDestroyed()) {
      this.assist_window.setTitle(this.translate('app.name'))
    }
    if (this.option_window && !this.option_window.isDestroyed()) {
      this.option_window.setTitle(this.translate('option.title'))
      this.option_window.webContents.send(OptionChannel.localeChanged, this.globalSetting.locale)
    }
    for (const window of this.child_windows) {
      if (!window.isDestroyed()) {
        this.setCustomMenu(window)
      }
    }
  }

  // private closeAssistWindow(): void {
  //   if (this.assist_window) {
  //     this.assist_window.close()
  //   }
  // }

  /**
   *
   */
  postReqToRenderer(api: kcsapi.Api, data: string): void {
    const msg: ApiReqMessage = { type: 'api_req', api, data }
    streamManager.postToRenderers(msg)
  }

  /**
   *
   */
  postResToRenderer(
    api: kcsapi.Api,
    data: string,
    additional?: ApiResMessageAdditional
  ): void {
    const msg: ApiResMessage = { type: 'api_res', api, data, additional }
    streamManager.postToRenderers(msg)
  }

  /**
   *
   * @param event
   * @param webContents
   */
  private onWebContentsCreated(_event: Event, webContents: WebContents): void {
    debug('onWebContentsCreated', _event, 'url:', webContents.getURL());

    const didCreateWindowHandler = (window: BrowserWindow, detail: DidCreateWindowDetails) =>
      this.onDidCreateWindow(window, detail, webContents)
    const expectedZoomFactor = (): number =>
      webContents === this.game_webcontents ? gameSetting.zoom_factor : 1
    const beforeInputEventHandler = (event: Event, input: Electron.Input): void => {
      if (isApplicationZoomShortcut(input)) {
        restoreApplicationZoom(event, webContents, expectedZoomFactor())
      }
    }
    const zoomChangedHandler = (event: Event): void => {
      restoreApplicationZoom(event, webContents, expectedZoomFactor())
    }

    webContents.addListener('did-create-window', (window, detail) =>
      didCreateWindowHandler(window, detail)
    )
    webContents.addListener('before-input-event', beforeInputEventHandler)
    webContents.addListener('zoom-changed', zoomChangedHandler)
    void webContents.setVisualZoomLevelLimits(1, 1).catch(() => undefined)
    webContents.setWindowOpenHandler((details) => this.windowOpenHandler(details))

    // destroyed イベントでリスナー削除
    webContents.once('destroyed', () => {
      webContents.removeListener('did-create-window', didCreateWindowHandler)
      webContents.removeListener('before-input-event', beforeInputEventHandler)
      webContents.removeListener('zoom-changed', zoomChangedHandler)
    })
  }

  /**
   * 
   */
  private get isMainWindowDestroyed(): boolean {
    const mainWindow = this.main_window
    if (!mainWindow || mainWindow.isDestroyed()) {
      return true
    }

    const webContents = mainWindow.webContents
    if (!webContents || webContents.isDestroyed()) {
      return true
    }

    return false
  }

  /**
   * 
   * @param state 
   */
  private setCtrlKeyState(state: boolean): void {
    debug('setCtrlKeyState', state)
    this.ctrl_key_state = state
    this.main_window.webContents.send(GameChannel.set_ctrl_state, state)
  }

  /**
   * キー入力イベント処理
   * CTRLキー押下で轟沈防止画面クリックを可とするためにgame側レンダラに通知する
   * 
   * @param input 
   */
  private onBeforeInputEvent(input: Input): void {
    if (input.key === 'Control') {

      if (this.isMainWindowDestroyed) {
        debug('main window destroyed, ignore ctrl key event')
        return
      }

      if (input.type === 'keyDown') {
        this.setCtrlKeyState(true)
      }
      
      if (input.type === 'keyUp') {
        this.setCtrlKeyState(false)
      }
    }
  }

  /**
   * 大破進撃ブロック状態をmainプロセスに設定
   * 
   * ブロック状態をmainプロセスで持つ理由は以下の通り
   *   以下の操作をブロックするため
   *   1) 右クリック押しっぱなしのまま進撃ボタンへマウス移動
   *   2) 進撃ボタンで右クリックを離す
   *   3) ブロック要素がボタン上に存在しても進撃ボタンが押下されてしまう
   *   本操作ブロックのため、mainプロセスで右クリックが離された場所がBlock UI上の場合イベントをpreventする
   * 
   * @param state 
   */
  private onChannelSetTaihaSingekiBlockState(states: TaihaSingekiBlockState[]): void {
    debug('onChannelSetTaihaSingekiBlockState', states)
    this.taihaSingekiBlockStates = [...states]
  }

  /**
   * 
   */
  private onBeforeMouseEvent(event: Event, mouse: MouseInputEvent): void {
    if (! this.taihaSingekiBlockStates.length) {
      return
    }
    if (this.ctrl_key_state) {
      debug('onBeforeMouseEvent mouseUp ctrl key pressed, ignore block')
      return
    }
    if (mouse.type !== 'mouseUp') {
      return
    }

    const hittest = (state: TaihaSingekiBlockState): boolean => {

      let rectRate: RectRate | undefined
      if (state === TaihaSingekiBlockState.normalBlock) {
        rectRate = Const.TaihaSingeki.normalBlockRect
      }
      if (state === TaihaSingekiBlockState.repairBlock) {
        rectRate = Const.TaihaSingeki.repairBlockRect
      }
      if (state === TaihaSingekiBlockState.megamiBlock) {
        rectRate = Const.TaihaSingeki.megamiBlockRect
      }
      if (!rectRate) {
        return false
      }

      const blockUIRect: Rectangle = {
        x: Math.floor(Const.GameWidth * rectRate.left),
        // マウスイベントでのyはゲーム内window座標によりゲーム外上部バナー分を補正する
        y: Math.floor((Const.GameHeight + Const.GameBarHeight) * rectRate.top) - Const.GameBarHeight, 
        width: Math.round(Const.GameWidth * rectRate.width),
        height: Math.round((Const.GameHeight + Const.GameBarHeight) * rectRate.height)
      }

      // ゲームのみ表示の場合、表示倍率で補正
      if (!gameSetting.isAssistInGame) {
        const zoomFactor = gameSetting.zoom_factor
        blockUIRect.x = Math.floor(blockUIRect.x * zoomFactor)
        blockUIRect.y = Math.floor(blockUIRect.y * zoomFactor)
        blockUIRect.width = Math.round(blockUIRect.width * zoomFactor)
        blockUIRect.height = Math.round(blockUIRect.height * zoomFactor)
      }

      let ret = false
      if ((blockUIRect.x <= mouse.x) && (mouse.x <= (blockUIRect.x + blockUIRect.width)) && 
          (blockUIRect.y <= mouse.y) && (mouse.y <= (blockUIRect.y + blockUIRect.height))) {
        ret = true
      }

      debug('taihaSingekiBlockUI mouseUp ishit:', ret, 
        'state:', state, 'blockUIRect:', blockUIRect,
        'mouseX:', mouse.x, 'mouseY:', mouse.y, 'zoomFactor:', gameSetting.zoom_factor)

      return ret
    }

    const states = this.taihaSingekiBlockStates
    const hitted = states.find((state) => hittest(state))
    if (hitted) {
      debug('onBeforeMouseEvent mouseUp in block area, prevent default')
      event.preventDefault()
      this.main_window.webContents.send(GameChannel.guard_hit_effect, hitted)
    }
  }

  /**
   * フォーカスロストイベント処理
   * CTRLキー状態をgame側レンダラに通知する
   */
  private onMainWindowBlur(): void {
    const isDestroyed = this.isMainWindowDestroyed
    debug('main window blur. isDestroyed:', isDestroyed)
    if (isDestroyed) {
      return
    }
    this.setCtrlKeyState(false)
  }

  /**
   *
   */
  private onChannelRendererReady(event: IpcMainInvokeEvent) {
    // set test data
    if (Env.isTestMode) {
      setTestData(this)
    }

    const webContents = event.sender
    const isMainContents = webContents === this.main_window.webContents
    if (isMainContents) {
      applyLayoutFixture(this)
    }
    debug(
      MainChannel.renderer_ready,
      'srcid:',
      appState.media_source_id,
      'isMainContents:',
      isMainContents
    )

    // send game state
    if (isMainContents) {
      webContents.send(GameChannel.set_app_state, appState)
      webContents.send(GameChannel.set_game_setting, gameSettingProxy.value)
    }

    // notify start up check result if already checked
    if (this.startupUpdateCheckResult) {
      webContents.send(MainMessage.startup_update_checked, this.startupUpdateCheckResult)
    }
    webContents.send(MainMessage.update_state_changed, this.updateState)

    // connect stream port
    streamManager.connect(webContents)
  }

  /**
   *
   */
  private onChannelShowAssist(show: boolean, preferredDisplay?: Display): void {
    debug('show assist show:', show)

    if (gameSetting.layoutMode === 'workspace' && !show) {
      this.onChannelToggleLayoutMode()
    }

    if (gameSetting.isAssistInGame === show) {
      return
    }

    let classicAssistDisplay: Display | undefined
    if (show && gameSetting.layoutMode === 'classic') {
      const displays = screen.getAllDisplays()
      const currentDisplay = screen.getDisplayMatching(this.mainWindow.getBounds())
      const currentDisplayIndex = findCurrentDisplayIndex(currentDisplay, displays)
      const preferredDisplayIndex = preferredDisplay
        ? findCurrentDisplayIndex(preferredDisplay, displays)
        : undefined
      const classicAssistDisplayIndex = resolveClassicAssistDisplayIndex(
        currentDisplayIndex,
        preferredDisplayIndex,
        displays.map((display) => display.workArea)
      )
      classicAssistDisplay =
        classicAssistDisplayIndex === undefined ? undefined : displays[classicAssistDisplayIndex]

      if (!classicAssistDisplay) {
        const workspaceDisplay = this.findDisplayForLayout('workspace')
        if (workspaceDisplay) {
          this.onChannelToggleLayoutMode()
        }
        return
      }
    }

    if (!gameSetting.assistInGame) {
      const size = this.mainWindow.getContentSize()
      appState.game_only_width = size[0]
      appState.game_only_height = size[1]
      gameSetting.zoom_factor = 1
    }

    gameSetting.setAssistInGame(show)
    this.mainWindow.setResizable(!gameSetting.isAssistInGame)

    const currentDisplay = screen.getDisplayMatching(this.mainWindow.getBounds())
    const requestedSize = calcMainWindowSize(gameSetting.isAssistInGame)
    const { minWidth, minHeight } = calcMainWindowMinSize()
    const size = gameSetting.isAssistInGame
      ? requestedSize
      : fitGameOnlyWindowSize(requestedSize.width, currentDisplay.workArea, minWidth)
    debug('resize main window for assist show change', size)
    this.nohandle_resize = true
    try {
      if (!gameSetting.isAssistInGame) {
        this.mainWindow.setMinimumSize(
          Math.min(minWidth, size.width),
          Math.min(minHeight, size.height)
        )
      }
      this.mainWindow.setContentSize(size.width, size.height, false)
    } finally {
      this.nohandle_resize = false
    }
    debug('resize main window contents size', this.mainWindow.getContentSize())
    if (!gameSetting.isAssistInGame) {
      appState.game_only_width = size.width
      appState.game_only_height = size.height
      gameSetting.zoom_factor = AppStuff.calcGameZoomFactor(size.width)
      this.fitGameOnlyWindowToDisplay(currentDisplay)
    }
    if (classicAssistDisplay) {
      this.moveInlineLayoutToDisplay(classicAssistDisplay)
    }
  }

  private onChannelToggleLayoutMode(): void {
    if (gameSetting.assistRestricted) {
      return
    }

    const nextMode: LayoutMode = gameSetting.layoutMode === 'workspace' ? 'classic' : 'workspace'
    const targetDisplay = this.findDisplayForLayout(nextMode)

    if (nextMode === 'workspace' && !targetDisplay) {
      return
    }

    // Preserve the bounds owned by the mode that is about to be left.
    this.saveAppState()

    if (nextMode === 'workspace') {
      if (!gameSetting.isAssistInGame) {
        const [width, height] = this.mainWindow.getContentSize()
        appState.game_only_width = width
        appState.game_only_height = height
      }

      gameSetting.setAssistInGame(true)
      gameSetting.setLayoutMode('workspace')
      gameSetting.zoom_factor = 1
      if (this.assist_window && !this.assist_window.isDestroyed()) {
        this.assist_window.close()
      }

      const restoredBoundsCandidate = appSetting.restoreMainWindowBounds(true, 'workspace')
      const restoredBounds =
        restoredBoundsCandidate &&
        workAreaSupportsLayout(
          screen.getDisplayMatching(restoredBoundsCandidate).workArea,
          'workspace'
        )
          ? restoredBoundsCandidate
          : undefined
      this.nohandle_resize = true
      try {
        if (this.mainWindow.isMaximized()) {
          this.mainWindow.unmaximize()
        }
        this.mainWindow.setResizable(true)
        this.mainWindow.setMaximizable(true)
        this.mainWindow.setMinimumSize(
          workspaceLayoutMetrics.minWindowWidth,
          workspaceLayoutMetrics.minWindowHeight
        )

        if (restoredBounds) {
          this.mainWindow.setBounds(
            {
              x: restoredBounds.x,
              y: restoredBounds.y,
              width: restoredBounds.width,
              height: restoredBounds.height
            },
            false
          )
          if (restoredBounds.maximized) {
            this.mainWindow.maximize()
          }
        } else {
          const workArea = targetDisplay!.workArea
          const width = Math.max(
            workspaceLayoutMetrics.minWindowWidth,
            Math.floor(workArea.width * 0.9)
          )
          const height = Math.max(
            workspaceLayoutMetrics.minWindowHeight,
            Math.floor(workArea.height * 0.9)
          )
          this.mainWindow.setBounds(
            {
              x: workArea.x + Math.floor((workArea.width - width) / 2),
              y: workArea.y + Math.floor((workArea.height - height) / 2),
              width,
              height
            },
            false
          )
          this.mainWindow.maximize()
        }
      } finally {
        this.nohandle_resize = false
      }
      this.updateWorkspaceZoomFactor()
    } else {
      gameSetting.setLayoutMode('classic')
      const { minWidth, minHeight } = calcMainWindowMinSize()
      const supportsClassic = targetDisplay !== undefined
      this.nohandle_resize = true
      try {
        if (this.mainWindow.isMaximized()) {
          this.mainWindow.unmaximize()
        }
        this.mainWindow.setResizable(true)
        this.mainWindow.setMaximizable(false)

        if (supportsClassic) {
          gameSetting.setAssistInGame(true)
          gameSetting.zoom_factor = 1
          if (this.assist_window && !this.assist_window.isDestroyed()) {
            this.assist_window.close()
          }

          const restoredBoundsCandidate = appSetting.restoreMainWindowBounds(true, 'classic')
          const restoredBounds =
            restoredBoundsCandidate &&
            workAreaSupportsLayout(
              screen.getDisplayMatching(restoredBoundsCandidate).workArea,
              'classic'
            )
              ? restoredBoundsCandidate
              : undefined
          this.mainWindow.setMinimumSize(minWidth, minHeight)
          this.mainWindow.setContentSize(
            classicLayoutMetrics.mainWindowWidth,
            classicLayoutMetrics.mainWindowHeight,
            false
          )
          if (restoredBounds) {
            this.mainWindow.setPosition(restoredBounds.x, restoredBounds.y, false)
          } else {
            const workArea = targetDisplay!.workArea
            this.mainWindow.setPosition(
              workArea.x + Math.floor((workArea.width - classicLayoutMetrics.mainWindowWidth) / 2),
              workArea.y +
                Math.floor((workArea.height - classicLayoutMetrics.mainWindowHeight) / 2),
              false
            )
          }
          this.mainWindow.setResizable(false)
        } else {
          gameSetting.setAssistInGame(false)
          const display = screen.getDisplayMatching(this.mainWindow.getBounds())
          const workArea = display.workArea
          const requestedWidth = appSetting.restoreGameOnlySize()?.width ?? Const.GameWidth
          const size = fitGameOnlyWindowSize(requestedWidth, workArea, minWidth)
          appState.game_only_width = size.width
          appState.game_only_height = size.height
          gameSetting.zoom_factor = AppStuff.calcGameZoomFactor(size.width)
          this.mainWindow.setMinimumSize(
            Math.min(minWidth, size.width),
            Math.min(minHeight, size.height)
          )
          this.mainWindow.setBounds(
            {
              x: workArea.x + Math.floor((workArea.width - size.width) / 2),
              y: workArea.y + Math.floor((workArea.height - size.height) / 2),
              ...size
            },
            false
          )
        }
      } finally {
        this.nohandle_resize = false
      }
    }

    // Persist the selected mode immediately; the final shutdown save updates
    // the last normal bounds again.
    this.saveAppState()
  }

  private findDisplayForLayout(layoutMode: LayoutMode): Display | undefined {
    const currentDisplay = screen.getDisplayMatching(this.mainWindow.getBounds())
    if (workAreaSupportsLayout(currentDisplay.workArea, layoutMode)) {
      return currentDisplay
    }

    return screen
      .getAllDisplays()
      .find((display) => workAreaSupportsLayout(display.workArea, layoutMode))
  }

  private readonly onDisplayConfigurationChanged = (): void => {
    if (this.displayLayoutTimer) {
      clearTimeout(this.displayLayoutTimer)
    }
    // Windows can emit several move, topology, and scale events for one user
    // action. Reconcile once Electron has published the final logical work
    // areas and the window has settled on its target display.
    this.displayLayoutTimer = setTimeout(() => {
      this.displayLayoutTimer = null
      this.reconcileDisplayLayout()
    }, 100)
  }

  private reconcileDisplayLayout(): void {
    if (!this.main_window || this.main_window.isDestroyed()) {
      return
    }

    const displays = screen.getAllDisplays()
    if (displays.length === 0) {
      return
    }

    const currentDisplay = screen.getDisplayMatching(this.mainWindow.getBounds())
    const currentDisplayIndex = findCurrentDisplayIndex(currentDisplay, displays)
    const effectiveAssistInGameBefore = gameSetting.isAssistInGame
    const resolved = resolveDisplayLayout(
      gameSetting.layoutMode,
      gameSetting.assistInGame,
      currentDisplayIndex,
      displays.map((display) => display.workArea)
    )

    // A newly attached or enlarged display must also release the restricted
    // state before existing mode-switch handlers are allowed to run.
    gameSetting.setAssistRestricted(false)

    if (resolved.layoutMode !== gameSetting.layoutMode) {
      this.onChannelToggleLayoutMode()
    } else if (resolved.assistInGame !== effectiveAssistInGameBefore) {
      // Clearing the restriction exposes the preserved preference immediately.
      // Present the previous effective state to the normal handler so it still
      // performs the required window resize instead of returning early.
      gameSetting.setAssistInGame(effectiveAssistInGameBefore)
      this.onChannelShowAssist(
        resolved.assistInGame,
        resolved.targetWorkAreaIndex === undefined
          ? undefined
          : displays[resolved.targetWorkAreaIndex]
      )
    }

    // A forced game-only fallback may pass through the normal show/hide
    // handler, which updates the preference. Restore the user's requested
    // state after applying the effective layout so a capable display can
    // recover the inline workspace later.
    gameSetting.setAssistInGame(resolved.requestedAssistInGame)
    gameSetting.setAssistRestricted(resolved.assistRestricted)

    if (resolved.assistInGame && resolved.targetWorkAreaIndex !== undefined) {
      this.moveInlineLayoutToDisplay(displays[resolved.targetWorkAreaIndex])
    } else if (!resolved.assistInGame) {
      const targetDisplay = screen.getDisplayMatching(this.mainWindow.getBounds())
      this.fitGameOnlyWindowToDisplay(targetDisplay)
      if (resolved.assistRestricted && (!this.assist_window || this.assist_window.isDestroyed())) {
        this.openAssistWindow()
      }
    }

    this.fitAssistWindowToDisplay()
    this.saveAppState()
  }

  private fitAssistWindowToDisplay(): void {
    if (!this.assist_window || this.assist_window.isDestroyed()) {
      return
    }

    const currentBounds = this.assist_window.getBounds()
    const targetDisplay = screen.getDisplayMatching(currentBounds)
    const workArea = targetDisplay.workArea
    const fittedBounds = fitRectangleToWorkArea(currentBounds, workArea, {
      width: Math.min(classicLayoutMetrics.assistWidth, workArea.width),
      height: Math.min(480, workArea.height)
    })

    if (
      fittedBounds.x !== currentBounds.x ||
      fittedBounds.y !== currentBounds.y ||
      fittedBounds.width !== currentBounds.width ||
      fittedBounds.height !== currentBounds.height
    ) {
      const wasMaximized = this.assist_window.isMaximized()
      if (wasMaximized) {
        this.assist_window.unmaximize()
      }
      this.assist_window.setBounds(fittedBounds, false)
      if (wasMaximized) {
        this.assist_window.maximize()
      }
    }
  }

  private moveInlineLayoutToDisplay(targetDisplay: Display): void {
    const currentDisplay = screen.getDisplayMatching(this.mainWindow.getBounds())
    const currentBounds = this.mainWindow.getBounds()
    const workArea = targetDisplay.workArea
    if (
      isInlineWindowSettledOnDisplay(
        currentDisplay.id,
        targetDisplay.id,
        currentBounds,
        workArea,
        gameSetting.layoutMode === 'workspace' && this.mainWindow.isMaximized()
      )
    ) {
      return
    }

    this.nohandle_resize = true
    try {
      if (gameSetting.layoutMode === 'workspace') {
        const wasMaximized = this.mainWindow.isMaximized()
        const normalBounds = this.mainWindow.getNormalBounds()
        if (wasMaximized) {
          this.mainWindow.unmaximize()
        }
        const width = Math.min(
          Math.max(normalBounds.width, workspaceLayoutMetrics.minWindowWidth),
          workArea.width
        )
        const height = Math.min(
          Math.max(normalBounds.height, workspaceLayoutMetrics.minWindowHeight),
          workArea.height
        )
        this.mainWindow.setBounds(
          {
            x: workArea.x + Math.floor((workArea.width - width) / 2),
            y: workArea.y + Math.floor((workArea.height - height) / 2),
            width,
            height
          },
          false
        )
        if (wasMaximized) {
          this.mainWindow.maximize()
        }
      } else {
        this.mainWindow.setResizable(true)
        this.mainWindow.setContentSize(
          classicLayoutMetrics.mainWindowWidth,
          classicLayoutMetrics.mainWindowHeight,
          false
        )
        this.mainWindow.setPosition(
          workArea.x + Math.floor((workArea.width - classicLayoutMetrics.mainWindowWidth) / 2),
          workArea.y + Math.floor((workArea.height - classicLayoutMetrics.mainWindowHeight) / 2),
          false
        )
        this.mainWindow.setResizable(false)
      }
    } finally {
      this.nohandle_resize = false
    }
    if (gameSetting.layoutMode === 'workspace') {
      this.updateWorkspaceZoomFactor()
    }
  }

  private fitGameOnlyWindowToDisplay(targetDisplay: Display): void {
    const workArea = targetDisplay.workArea
    const { minWidth, minHeight } = calcMainWindowMinSize()
    const [currentWidth] = this.mainWindow.getContentSize()
    const size = fitGameOnlyWindowSize(currentWidth, workArea, minWidth)
    const currentBounds = this.mainWindow.getBounds()
    const maxX = workArea.x + Math.max(0, workArea.width - size.width)
    const maxY = workArea.y + Math.max(0, workArea.height - size.height)
    const fittedBounds = {
      x: Math.min(Math.max(currentBounds.x, workArea.x), maxX),
      y: Math.min(Math.max(currentBounds.y, workArea.y), maxY),
      ...size
    }
    const minimumSize = {
      width: Math.min(minWidth, size.width),
      height: Math.min(minHeight, size.height)
    }

    this.nohandle_resize = true
    try {
      if (!this.mainWindow.isResizable()) {
        this.mainWindow.setResizable(true)
      }
      const [currentMinWidth, currentMinHeight] = this.mainWindow.getMinimumSize()
      if (currentMinWidth !== minimumSize.width || currentMinHeight !== minimumSize.height) {
        this.mainWindow.setMinimumSize(minimumSize.width, minimumSize.height)
      }
      setWindowBoundsIfChanged(this.mainWindow, fittedBounds)
    } finally {
      this.nohandle_resize = false
    }

    appState.game_only_width = size.width
    appState.game_only_height = size.height
    gameSetting.zoom_factor = AppStuff.calcGameZoomFactor(size.width)
  }

  private onChannelToggleMaximize(): void {
    if (gameSetting.layoutMode !== 'workspace') {
      return
    }

    if (this.mainWindow.isMaximized()) {
      this.mainWindow.unmaximize()
    } else {
      this.mainWindow.maximize()
    }
  }

  /**
   *
   */
  private updateGameOnlyZoomFactor(): void {
    if (gameSetting.isAssistInGame) {
      return
    }

    const size = this.mainWindow.getContentSize()
    appState.game_only_width = size[0]
    appState.game_only_height = size[1]
    const calcSize = calcMainWindowSize(gameSetting.isAssistInGame)
    gameSetting.zoom_factor = AppStuff.calcGameZoomFactor(calcSize.width)
  }

  private updateWorkspaceZoomFactor(): void {
    if (gameSetting.layoutMode !== 'workspace' || this.mainWindow.isDestroyed()) {
      return
    }

    const [width, height] = this.mainWindow.getContentSize()
    gameSetting.zoom_factor = fitWorkspaceGameStage({ width, height }).scale
  }

  /**
   *
   * @param details
   * @returns
   */
  private windowOpenHandler(details: HandlerDetails):
    | { action: 'deny' }
    | {
        action: 'allow'
        outlivesOpener?: boolean
        overrideBrowserWindowOptions?: BrowserWindowConstructorOptions
      } {
    debug('windowOpenHandler', details)
    //return { action: 'deny' };
    return { action: 'allow' }
  }

  /**
   *
   * @param window
   * @param detail
   */
  private onDidCreateWindow(
    window: BrowserWindow,
    detail: DidCreateWindowDetails,
    parentWebContents: WebContents
  ): void {
    debug('onDidCreateWindow detail:', detail)

    // set custom menu
    this.setCustomMenu(window)
    this.child_windows.add(window)
    window.once('closed', () => this.child_windows.delete(window))

    const parentWindow = BrowserWindow.fromWebContents(parentWebContents) ?? this.mainWindow
    const targetDisplay = parentWindow
      ? screen.getDisplayMatching(parentWindow.getBounds())
      : screen.getDisplayMatching(window.getBounds())
    const area = targetDisplay.workArea
    const width = Math.floor((area.width * 3) / 5)
    const height = Math.floor((area.height * 4) / 5)
    const x = area.x + Math.floor((area.width - width) / 2)
    const y = area.y + Math.floor((area.height - height) / 2)
    window.setBounds({ x, y, width, height }, false)
  }

  /**
   *
   */
  private onChannelMinimize(): void {
    debug(MainChannel.minimize)
    this.mainWindow.minimize()
  }

  /**
   *
   */
  private async onChannelClose() {
    debug('on channel msg', MainChannel.close)

    this.closeRelatedWindows()
    this.saveAppState()
    // no effect
    //mainWindow.close();
    this.mainWindow.destroy()
  }

  /**
   *
   */
  private onChannelDevTool() {
    debug(MainChannel.devtool)
    const webContents = this.mainWindow.webContents
    if (webContents) {
      if (webContents.isDevToolsOpened()) {
        webContents.closeDevTools()
      } else {
        webContents.openDevTools()
      }
    }
  }

  /**
   *
   */
  private onChannelReload(ignoreCache: boolean) {
    debug(MainChannel.reload, 'ignoreCache:', ignoreCache)
    const webContents = this.mainWindow.webContents
    if (webContents) {
      if (ignoreCache) {
        webContents.reloadIgnoringCache()
      } else {
        webContents.reload()
      }
    }
  }

  /**
   *
   */
  private onChannelTopmost() {
    debug(MainChannel.topmost)
    this.main_window.setAlwaysOnTop(!gameSetting.topmost)
    gameSetting.topmost = !gameSetting.topmost
  }

  /**
   * Keep the main-process mute state in sync with the renderer.
   */
  private onChannelNotifyMuteState(muted: boolean) {
    debug(MainChannel.notify_mute_state, 'muted:', muted)
    gameState.muted = muted
  }

  /**
   *
   */
  private onChannelOpenAssist() {
    debug(MainChannel.openAssist, 'assist_window:', this.assist_window !== null)
    if (this.assist_window) {
      this.assist_window.show()
      this.assist_window.focus()
    } else {
      const state = appSetting.restoreAssistWindowState(false)
      this.openAssistWindow(
        state?.position
          ? { ...state.position, size: state.size, display: state.display }
          : undefined
      )
    }
  }

  /**
   *
   */
  private onChannelOpenOption(): void {
    debug(MainChannel.openOption, 'option_window:', this.option_window !== null)
    this.openOptionWindow()
  }

  /**
   *
   */
  private onChannelOptionGetCurrentSetting(): Promise<OptionData> {
    debug(OptionChannel.getCurrentSetting)
    return new Promise<OptionData>((resolve, reject) => {
      optionSettingStore.load(
        defaultOptionSetting(),
        (data) => {
          resolve({
            locale: this.globalSetting.locale,
            setting: {
              ...data,
              recordingTarget: normalizeRecordingTarget(data.recordingTarget)
            },
            viewInfo: {
              defaultCaptureSavePath: PathStuff.defaultCapturePath
            }
          })
        },
        (err) => reject(err)
      )
    })
  }

  /**
   *
   */
  private onChannelOptionReadyToShow(): void {
    debug(OptionChannel.readyToShow)
    if (!this.option_window || this.option_window.isDestroyed()) {
      // noop
      return
    }
    this.option_window.show()
    this.option_window.focus()
  }

  /**
   *
   */
  private onChannelOptionSelectCaptureSavePath(): string | null {
    debug(OptionChannel.selectCaptureSavePath)
    if (!this.option_window || this.option_window.isDestroyed()) {
      // noop
      return null
    }

    const result = dialog.showOpenDialogSync(this.option_window, {
      title: this.translate('option.captureFolder.dialogTitle'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (result && result.length > 0) {
      return result[0]
    }
    return null
  }

  /**
   *
   */
  private onChannelOptionSelectExtensionPath(): string | null {
    debug(OptionChannel.selectExtensionPath)
    if (!this.option_window || this.option_window.isDestroyed()) {
      // noop
      return null
    }

    const result = dialog.showOpenDialogSync(this.option_window, {
      title: this.translate('option.extension.dialogTitle'),
      properties: ['openDirectory']
    })
    if (result && result.length > 0) {
      return result[0]
    }
    return null
  }

  /**
   *
   */
  private onChannelOptionMinimize(): void {
    debug(OptionChannel.minimize)
    if (this.option_window && !this.option_window.isDestroyed()) {
      this.option_window.minimize()
    }
  }

  /**
   *
   */
  private onChannelOptionClose(): void {
    debug(OptionChannel.close)
    if (this.option_window && !this.option_window.isDestroyed()) {
      this.option_window.close()
    }
  }

  /**
   *
   */
  private onChannelOptionSaveSetting(setting: OptionSetting): void {
    const normalizedSetting: OptionSetting = {
      ...setting,
      recordingTarget: normalizeRecordingTarget(setting.recordingTarget)
    }
    debug(OptionChannel.saveSetting, normalizedSetting)
    optionSettingStore.save(normalizedSetting)

    // キャプチャ保存先更新する
    PathStuff.setCapturePath(normalizedSetting.captureSavePath)

    // オプション設定をゲーム設定に反映する
    gameSetting.applyOptionSetting(normalizedSetting)
  }

  /**
   *
   */
  private onChannelOpenCaptureFolder() {
    debug(MainChannel.open_capture_folder)
    shell.openPath(PathStuff.capturePath(true))
  }

  private async onChannelOpenDataFolder(event: IpcMainInvokeEvent): Promise<void> {
    debug(MainChannel.open_data_folder)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedDataFolderRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Data-folder access is limited to the main application frame')
    }

    await openDataDirectory(
      getUserDataDir(),
      isLayoutFixtureEnabled()
        ? async (directory) => {
            this.lastDataFolderFixturePath = directory
            return ''
          }
        : (directory) => shell.openPath(directory)
    )
  }

  private async onChannelSaveAssistPanelDiagnostic(
    event: IpcMainInvokeEvent,
    diagnostic: unknown
  ): Promise<AssistPanelDiagnosticSaveResult> {
    debug(MainChannel.save_assist_panel_diagnostic)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    const assistContentsId =
      this.assist_window && !this.assist_window.isDestroyed()
        ? this.assist_window.webContents.id
        : undefined
    if (
      !isTrustedAssistDiagnosticRequest(event.sender.id, isMainFrame, [
        this.main_window.webContents.id,
        assistContentsId
      ])
    ) {
      throw new Error('Assist diagnostics are limited to application renderer frames')
    }
    if (this.assistDiagnosticInProgress) {
      throw new Error('Another assist diagnostic save is already in progress')
    }

    this.assistDiagnosticInProgress = true
    try {
      const generatedAt = new Date()
      const report = createAssistPanelDiagnosticReport(diagnostic, {
        generatedAt,
        appVersion: app.getVersion(),
        platform: process.platform,
        operatingSystemRelease: os.release(),
        architecture: process.arch
      })
      const parentWindow = BrowserWindow.fromWebContents(event.sender) ?? this.main_window
      const selection = await dialog.showSaveDialog(parentWindow, {
        title: this.translate('assistDiagnostic.dialogTitle'),
        defaultPath: assistPanelDiagnosticFilename(generatedAt),
        filters: [
          {
            name: 'JSON',
            extensions: ['json']
          }
        ]
      })
      if (selection.canceled || !selection.filePath) {
        return { status: 'cancelled' }
      }

      await saveAssistPanelDiagnosticReport(selection.filePath, report)
      return {
        status: 'saved',
        fileName: path.basename(selection.filePath)
      }
    } finally {
      this.assistDiagnosticInProgress = false
    }
  }

  private async onChannelCreateLocalAccountBackup(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountBackupResult> {
    debug(MainChannel.create_local_account_backup)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account backup is limited to the main application frame')
    }
    if (this.accountBackupInProgress) {
      throw new Error('An account backup is already in progress')
    }

    this.accountBackupInProgress = true
    try {
      await this.clearAccountTransferCandidate()
      this.accountRestoreCandidate = null
      this.accountMergeCandidate = null
      const selection = await dialog.showOpenDialog(this.main_window, {
        title: this.translate('accountBackup.dialogTitle'),
        properties: ['openDirectory', 'createDirectory']
      })
      if (selection.canceled || selection.filePaths.length !== 1) {
        return { status: 'cancelled' }
      }

      const verified = await createCurrentAccountBackup({
        destinationRoot: selection.filePaths[0],
        appVersion: app.getVersion()
      })
      return toLocalAccountBackupResult(verified)
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelCreateEncryptedAccountTransfer(
    event: IpcMainInvokeEvent,
    passphrase: unknown
  ): Promise<EncryptedAccountTransferResult> {
    debug(MainChannel.create_encrypted_account_transfer)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Encrypted account transfer is limited to the main application frame')
    }
    if (!isValidAccountTransferPassphrase(passphrase)) {
      throw new Error('Invalid encrypted account transfer passphrase')
    }
    if (this.accountBackupInProgress) {
      throw new Error('An account backup operation is already in progress')
    }

    this.accountBackupInProgress = true
    try {
      await this.clearAccountTransferCandidate()
      this.accountRestoreCandidate = null
      this.accountMergeCandidate = null
      const createdAt = new Date()
      const selection = await dialog.showSaveDialog(this.main_window, {
        title: this.translate('accountBackup.transfer.dialogTitle'),
        defaultPath: encryptedAccountTransferFilename(createdAt),
        filters: [
          {
            name: this.translate('accountBackup.transfer.fileType'),
            extensions: ['koubrowser-transfer']
          }
        ]
      })
      if (selection.canceled || !selection.filePath) {
        return { status: 'cancelled' }
      }

      const created = await createCurrentAccountTransfer({
        outputPath: selection.filePath,
        passphrase,
        appVersion: app.getVersion(),
        createdAt
      })
      return toEncryptedAccountTransferResult(created)
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelInspectEncryptedAccountTransfer(
    event: IpcMainInvokeEvent,
    passphrase: unknown
  ): Promise<LocalAccountBackupInspectionResult> {
    debug(MainChannel.inspect_encrypted_account_transfer)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error(
        'Encrypted account transfer inspection is limited to the main application frame'
      )
    }
    if (!isValidAccountTransferPassphrase(passphrase)) {
      throw new Error('Invalid encrypted account transfer passphrase')
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }

    this.accountBackupInProgress = true
    try {
      await this.clearAccountTransferCandidate()
      this.accountRestoreCandidate = null
      this.accountMergeCandidate = null
      const selection = await dialog.showOpenDialog(this.main_window, {
        title: this.translate('accountBackup.transfer.inspectDialogTitle'),
        properties: ['openFile'],
        filters: [
          {
            name: this.translate('accountBackup.transfer.fileType'),
            extensions: ['koubrowser-transfer']
          }
        ]
      })
      if (selection.canceled || selection.filePaths.length !== 1) {
        return { status: 'cancelled' }
      }

      let decrypted: Awaited<ReturnType<typeof decryptAccountTransferCandidate>>
      try {
        decrypted = await decryptAccountTransferCandidate(selection.filePaths[0], passphrase)
      } catch {
        return { status: 'invalid' }
      }

      const selectedFileName = path.basename(selection.filePaths[0])
      try {
        const result = await inspectLocalAccountBackupDirectory(
          decrypted.verified.directory,
          {
            serverId: svdata.serverId,
            memberId: String(svdata.basic.api_member_id)
          },
          async () => decrypted.verified,
          previewVerifiedAccountBackupAgainstCurrent
        )
        const displayedResult =
          result.status === 'valid' ? { ...result, bundleName: selectedFileName } : result
        if (displayedResult.status === 'valid' && displayedResult.accountMatch === 'same') {
          this.accountTransferCandidateRoot = decrypted.temporaryRoot
          this.accountRestoreCandidate = decrypted.verified
          this.accountMergeCandidate = {
            verified: decrypted.verified,
            previews: displayedResult.databases
          }
        } else {
          await cleanupAccountTransferCandidate(decrypted.temporaryRoot)
        }
        return displayedResult
      } catch (error) {
        await cleanupAccountTransferCandidate(decrypted.temporaryRoot)
        throw error
      }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelInspectLocalAccountBackup(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountBackupInspectionResult> {
    debug(MainChannel.inspect_local_account_backup)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account backup inspection is limited to the main application frame')
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }

    this.accountBackupInProgress = true
    try {
      await this.clearAccountTransferCandidate()
      this.accountRestoreCandidate = null
      this.accountMergeCandidate = null
      const selection = await dialog.showOpenDialog(this.main_window, {
        title: this.translate('accountBackup.inspect.dialogTitle'),
        properties: ['openDirectory']
      })
      if (selection.canceled || selection.filePaths.length !== 1) {
        return { status: 'cancelled' }
      }

      let verifiedCandidate: VerifiedAccountBackup | null = null
      const result = await inspectLocalAccountBackupDirectory(
        selection.filePaths[0],
        {
          serverId: svdata.serverId,
          memberId: String(svdata.basic.api_member_id)
        },
        async (directory) => {
          const verified = await verifyLocalAccountBackup(directory)
          verifiedCandidate = verified
          return verified
        },
        previewVerifiedAccountBackupAgainstCurrent
      )
      if (result.status === 'valid' && result.accountMatch === 'same' && verifiedCandidate) {
        this.accountRestoreCandidate = verifiedCandidate
        this.accountMergeCandidate = {
          verified: verifiedCandidate,
          previews: result.databases
        }
      }
      return result
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelSaveAccountInspectionReport(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountInspectionReportResult> {
    debug(MainChannel.save_account_inspection_report)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account inspection reports are limited to the main application frame')
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }
    const candidate = this.accountMergeCandidate
    if (!candidate) {
      throw new Error('No verified same-account inspection is available')
    }

    this.accountBackupInProgress = true
    try {
      const generatedAt = new Date()
      const fileName = accountInspectionReportFilename(generatedAt)
      const selection = await dialog.showSaveDialog(this.main_window, {
        title: this.translate('accountBackup.inspect.report.dialogTitle'),
        defaultPath: fileName,
        filters: [
          {
            name: 'JSON',
            extensions: ['json']
          }
        ]
      })
      if (selection.canceled || !selection.filePath) {
        return { status: 'cancelled' }
      }

      const report = createRedactedAccountInspectionReport({
        generatedAt,
        currentAppVersion: app.getVersion(),
        platform: process.platform,
        operatingSystemRelease: os.release(),
        architecture: process.arch,
        bundleAppVersion: candidate.verified.manifest.appVersion,
        bundleCreatedAt: candidate.verified.manifest.createdAt,
        bundleSummary: candidate.verified.manifest.summary,
        databases: candidate.previews
      })
      await saveRedactedAccountInspectionReport(selection.filePath, report)
      return {
        status: 'saved',
        fileName: path.basename(selection.filePath)
      }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelPrepareLocalAccountMerge(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountMergePreparationResult> {
    debug(MainChannel.prepare_local_account_merge)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account merge is limited to the main application frame')
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }
    const candidate = this.accountMergeCandidate
    if (!candidate) {
      throw new Error('No verified same-account merge candidate is selected')
    }
    if (candidate.previews.reduce((total, preview) => total + preview.mergePlan.safeAdd, 0) === 0) {
      throw new Error('The selected backup has no safe records to merge')
    }

    this.accountBackupInProgress = true
    try {
      const confirmation = await dialog.showMessageBox(this.main_window, {
        type: 'warning',
        title: this.translate('accountBackup.merge.confirmTitle'),
        message: this.translate('accountBackup.merge.confirmMessage'),
        detail: this.translate('accountBackup.merge.confirmDetail'),
        buttons: [
          this.translate('accountBackup.merge.confirmButton'),
          this.translate('common.cancel')
        ],
        defaultId: 1,
        cancelId: 1,
        noLink: true
      })
      if (confirmation.response !== 0) {
        return { status: 'cancelled' }
      }

      const staged = await stageVerifiedAccountBackupMerge(candidate.verified, candidate.previews)
      const scheduled = await prepareCurrentAccountBackupMerge(staged.directory)
      await this.clearAccountTransferCandidate()
      this.accountMergeCandidate = null
      this.accountRestoreCandidate = null
      setTimeout(() => {
        app.relaunch()
        app.quit()
      }, 250)
      return {
        status: 'scheduled',
        bundleName: scheduled.bundleId
      }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelGetAvailableAccountMergeRollback(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountRollbackAvailability> {
    debug(MainChannel.get_available_account_merge_rollback)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account merge rollback is limited to the main application frame')
    }
    if (!this.accountInitialization) {
      this.accountMergeRollbackCandidate = null
      return { status: 'none' }
    }
    await this.accountInitialization
    if (!this.kcrecord) {
      this.accountMergeRollbackCandidate = null
      return { status: 'none' }
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }

    this.accountBackupInProgress = true
    try {
      const rollback = await getAvailableMergeRollbackForCurrentAccount()
      this.accountMergeRollbackCandidate = rollback
      return rollback
        ? {
            status: 'available',
            bundleName: rollback.bundleId,
            createdAt: rollback.createdAt
          }
        : { status: 'none' }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelPrepareAccountMergeRollback(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountRollbackPreparationResult> {
    debug(MainChannel.prepare_account_merge_rollback)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account merge rollback is limited to the main application frame')
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }
    const rollback = this.accountMergeRollbackCandidate
    if (!rollback) {
      throw new Error('No verified account merge rollback is selected')
    }

    this.accountBackupInProgress = true
    try {
      const confirmation = await dialog.showMessageBox(this.main_window, {
        type: 'warning',
        title: this.translate('accountBackup.mergeRollback.confirmTitle'),
        message: this.translate('accountBackup.mergeRollback.confirmMessage'),
        detail: this.translate('accountBackup.mergeRollback.confirmDetail'),
        buttons: [
          this.translate('accountBackup.mergeRollback.confirmButton'),
          this.translate('common.cancel')
        ],
        defaultId: 1,
        cancelId: 1,
        noLink: true
      })
      if (confirmation.response !== 0) {
        return { status: 'cancelled' }
      }

      await prepareCurrentAccountMergeRollback(rollback)
      this.accountMergeRollbackCandidate = null
      setTimeout(() => {
        app.relaunch()
        app.quit()
      }, 250)
      return {
        status: 'scheduled',
        bundleName: rollback.bundleId
      }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelGetAvailableAccountMergeRedo(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountRedoAvailability> {
    debug(MainChannel.get_available_account_merge_redo)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account merge redo is limited to the main application frame')
    }
    if (!this.accountInitialization) {
      this.accountMergeRedoCandidate = null
      return { status: 'none' }
    }
    await this.accountInitialization
    if (!this.kcrecord) {
      this.accountMergeRedoCandidate = null
      return { status: 'none' }
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }

    this.accountBackupInProgress = true
    try {
      const redo = await getAvailableMergeRedoForCurrentAccount()
      this.accountMergeRedoCandidate = redo
      return redo
        ? {
            status: 'available',
            bundleName: redo.bundleId,
            createdAt: redo.createdAt
          }
        : { status: 'none' }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelPrepareAccountMergeRedo(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountRedoPreparationResult> {
    debug(MainChannel.prepare_account_merge_redo)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account merge redo is limited to the main application frame')
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }
    const redo = this.accountMergeRedoCandidate
    if (!redo) {
      throw new Error('No verified account merge redo is selected')
    }

    this.accountBackupInProgress = true
    try {
      const confirmation = await dialog.showMessageBox(this.main_window, {
        type: 'warning',
        title: this.translate('accountBackup.mergeRedo.confirmTitle'),
        message: this.translate('accountBackup.mergeRedo.confirmMessage'),
        detail: this.translate('accountBackup.mergeRedo.confirmDetail'),
        buttons: [
          this.translate('accountBackup.mergeRedo.confirmButton'),
          this.translate('common.cancel')
        ],
        defaultId: 1,
        cancelId: 1,
        noLink: true
      })
      if (confirmation.response !== 0) {
        return { status: 'cancelled' }
      }

      await prepareCurrentAccountMergeRedo(redo)
      this.accountMergeRedoCandidate = null
      setTimeout(() => {
        app.relaunch()
        app.quit()
      }, 250)
      return {
        status: 'scheduled',
        bundleName: redo.bundleId
      }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelPrepareLocalAccountRestore(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountRestorePreparationResult> {
    debug(MainChannel.prepare_local_account_restore)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account restore is limited to the main application frame')
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }
    const candidate = this.accountRestoreCandidate
    if (!candidate) {
      throw new Error('No verified same-account backup is selected')
    }

    const confirmation = await dialog.showMessageBox(this.main_window, {
      type: 'warning',
      title: this.translate('accountBackup.restore.confirmTitle'),
      message: this.translate('accountBackup.restore.confirmMessage'),
      detail: this.translate('accountBackup.restore.confirmDetail'),
      buttons: [
        this.translate('accountBackup.restore.confirmButton'),
        this.translate('common.cancel')
      ],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    })
    if (confirmation.response !== 0) {
      return { status: 'cancelled' }
    }

    this.accountBackupInProgress = true
    try {
      const stage = await prepareVerifiedAccountBackupRestore(candidate)
      await this.clearAccountTransferCandidate()
      this.accountRestoreCandidate = null
      this.accountMergeCandidate = null
      setTimeout(() => {
        app.relaunch()
        app.quit()
      }, 250)
      return {
        status: 'scheduled',
        bundleName: path.basename(stage.directory)
      }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelGetAvailableAccountRollback(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountRollbackAvailability> {
    debug(MainChannel.get_available_account_rollback)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account rollback is limited to the main application frame')
    }
    if (!this.accountInitialization) {
      this.accountRollbackCandidate = null
      return { status: 'none' }
    }
    await this.accountInitialization
    if (!this.kcrecord) {
      this.accountRollbackCandidate = null
      return { status: 'none' }
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }

    this.accountBackupInProgress = true
    try {
      const rollback = await getAvailableRollbackForCurrentAccount()
      this.accountRollbackCandidate = rollback
      return rollback
        ? {
            status: 'available',
            bundleName: rollback.bundleId,
            createdAt: rollback.createdAt
          }
        : { status: 'none' }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelPrepareAccountRollback(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountRollbackPreparationResult> {
    debug(MainChannel.prepare_account_rollback)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account rollback is limited to the main application frame')
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }
    const rollback = this.accountRollbackCandidate
    if (!rollback) {
      throw new Error('No verified account rollback is selected')
    }

    const confirmation = await dialog.showMessageBox(this.main_window, {
      type: 'warning',
      title: this.translate('accountBackup.rollback.confirmTitle'),
      message: this.translate('accountBackup.rollback.confirmMessage'),
      detail: this.translate('accountBackup.rollback.confirmDetail'),
      buttons: [
        this.translate('accountBackup.rollback.confirmButton'),
        this.translate('common.cancel')
      ],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    })
    if (confirmation.response !== 0) {
      return { status: 'cancelled' }
    }

    this.accountBackupInProgress = true
    try {
      await prepareCurrentAccountRollback(rollback)
      this.accountRollbackCandidate = null
      setTimeout(() => {
        app.relaunch()
        app.quit()
      }, 250)
      return {
        status: 'scheduled',
        bundleName: rollback.bundleId
      }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelGetAvailableAccountRedo(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountRedoAvailability> {
    debug(MainChannel.get_available_account_redo)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account redo is limited to the main application frame')
    }
    if (!this.accountInitialization) {
      this.accountRedoCandidate = null
      return { status: 'none' }
    }
    await this.accountInitialization
    if (!this.kcrecord) {
      this.accountRedoCandidate = null
      return { status: 'none' }
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }

    this.accountBackupInProgress = true
    try {
      const redo = await getAvailableRedoForCurrentAccount()
      this.accountRedoCandidate = redo
      return redo
        ? {
            status: 'available',
            bundleName: redo.bundleId,
            createdAt: redo.createdAt
          }
        : { status: 'none' }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelPrepareAccountRedo(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountRedoPreparationResult> {
    debug(MainChannel.prepare_account_redo)
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account redo is limited to the main application frame')
    }
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }
    const redo = this.accountRedoCandidate
    if (!redo) {
      throw new Error('No verified account redo is selected')
    }

    const confirmation = await dialog.showMessageBox(this.main_window, {
      type: 'warning',
      title: this.translate('accountBackup.redo.confirmTitle'),
      message: this.translate('accountBackup.redo.confirmMessage'),
      detail: this.translate('accountBackup.redo.confirmDetail'),
      buttons: [
        this.translate('accountBackup.redo.confirmButton'),
        this.translate('common.cancel')
      ],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    })
    if (confirmation.response !== 0) {
      return { status: 'cancelled' }
    }

    this.accountBackupInProgress = true
    try {
      await prepareCurrentAccountRedo(redo)
      this.accountRedoCandidate = null
      setTimeout(() => {
        app.relaunch()
        app.quit()
      }, 250)
      return {
        status: 'scheduled',
        bundleName: redo.bundleId
      }
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelCaptureAccountAuditBaseline(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountAuditCaptureResult> {
    debug(MainChannel.capture_account_audit_baseline)
    this.assertTrustedAccountAuditRequest(event)
    await this.assertAccountAuditReady()
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }

    this.accountBackupInProgress = true
    try {
      return await captureCurrentAccountAuditBaseline()
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private async onChannelCompareAccountAuditBaseline(
    event: IpcMainInvokeEvent
  ): Promise<LocalAccountAuditComparisonResult> {
    debug(MainChannel.compare_account_audit_baseline)
    this.assertTrustedAccountAuditRequest(event)
    await this.assertAccountAuditReady()
    if (this.accountBackupInProgress) {
      throw new Error('Another account backup operation is already in progress')
    }

    this.accountBackupInProgress = true
    try {
      return await compareCurrentAccountAuditBaseline()
    } finally {
      this.accountBackupInProgress = false
    }
  }

  private assertTrustedAccountAuditRequest(event: IpcMainInvokeEvent): void {
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedAccountBackupRequest(event.sender.id, isMainFrame, this.main_window.webContents.id)
    ) {
      throw new Error('Account audit is limited to the main application frame')
    }
  }

  private async assertAccountAuditReady(): Promise<void> {
    if (!this.accountInitialization) {
      throw new Error('Account data is not initialized')
    }
    await this.accountInitialization
    if (!this.kcrecord) {
      throw new Error('Account data is not initialized')
    }
  }

  /**
   *
   * @param date
   * @param buffer
   */
  private async onChannelSaveCapture(date: Date, buffer: Buffer): Promise<string> {
    const capture_dir = PathStuff.capturePath(true)
    const filename = await saveCaptureFile(capture_dir, date, buffer)
    debug(MainChannel.save_capture, 'date:', date, filename, capture_dir)
    return filename
  }

  private async onChannelGetRecordingSource(event: IpcMainInvokeEvent): Promise<RecordingSource> {
    const isMainFrame = event.senderFrame === event.sender.mainFrame
    if (
      !isTrustedRecordingSourceRequest(
        event.sender.id,
        isMainFrame,
        this.main_window.webContents.id
      )
    ) {
      throw new Error('Recording source requests are limited to the main application frame')
    }

    const setting = await optionSettingStore.loadAsync(defaultOptionSetting())
    const target = normalizeRecordingTarget(setting.recordingTarget)
    if (target === 'game') {
      const gameContents = this.game_webcontents
      if (
        !gameContents ||
        gameContents.isDestroyed() ||
        gameContents.getType() !== 'webview' ||
        gameContents.hostWebContents !== event.sender
      ) {
        throw new Error('The game recording source is not ready')
      }
      return {
        target,
        mediaSource: 'tab',
        id: gameContents.getMediaSourceId(event.sender),
        width: Const.GameWidth,
        height: Const.GameHeight
      }
    }

    return {
      target,
      mediaSource: 'desktop',
      id: this.main_window.getMediaSourceId(),
      width: gameSetting.assistInGame
        ? gameSetting.capture_assist_width
        : gameSetting.capture_min_width,
      height: gameSetting.assistInGame
        ? gameSetting.capture_assist_height
        : gameSetting.capture_min_height
    }
  }

  private closeRecorder(): void {
    if (this.wsRecording) {
      const ws = this.wsRecording
      this.wsRecording = null
      if (ws) {
        ws.end(() => {
          debug('save recording closed')
        })
      }
    }
  }

  /**
   *
   * @param buffer
   * @param isEnd
   */
  private async onChannelStoreRec(buffer: Buffer, isEnd: boolean) {
    debug(
      MainChannel.store_rec,
      'buffer size',
      buffer.length,
      'bytes(if 0 byte, noop)',
      'isEnd',
      isEnd
    )
    if (!buffer || buffer.length === 0) {
      return
    }

    if (!this.wsRecording) {
      const capture_dir = PathStuff.capturePath(true)
      const date = new Date()
      const filename = `${moment(date).format('YYYYMMDD-HHmmss')}.webm`
      const filepath = path.join(capture_dir, filename)
      // default highWaterMark is 16KB. set 4MB.
      this.wsRecording = fs.createWriteStream(filepath, {
        flags: 'a',
        highWaterMark: 4 * 1024 * 1024
      })
      debug(
        MainChannel.store_rec,
        'date:',
        new Date(),
        filepath,
        capture_dir,
        this.wsRecording.writableHighWaterMark
      )
    }

    if (this.wsRecording) {
      if (!this.wsRecording.write(buffer)) {
        // 一度だけ待つ
        await once(this.wsRecording, 'drain') // バックプレッシャ対応
        if (!this.wsRecording.write(buffer)) {
          debug(
            'recording write failed',
            this.wsRecording.path,
            this.wsRecording.bytesWritten,
            'bytes written'
          )
          dialog.showErrorBox(
            this.translate('main.recording.errorTitle'),
            this.translate('main.recording.writeFailed')
          )
          const path = this.wsRecording.path
          this.wsRecording.end(() => {
            fs.unlinkSync(path)
          })
          this.wsRecording = null
        }
      } else {
        debug(MainChannel.store_rec, this.wsRecording.bytesWritten, 'bytes written')
      }
    }

    if (isEnd) {
      this.closeRecorder()
    }
  }

  /**
   *
   * @param setting
   * @returns
   */
  private checkUpdateIfNeeded(setting: GlobalSetting): void {
    if (!setting.checkUpdateOnStartup) {
      return
    }
    if (this.isStartupUpdateChecked) {
      return
    }
    this.isStartupUpdateChecked = true
    this.setUpdateState({
      status: 'checking',
      availableVersion: '',
      errorMessage: '',
      downloadPercent: null
    })
    this.checkForUpdatesCore(setting).then((result) => {
      this.startupUpdateCheckResult = result
      this.notifyStartupUpdateChecked(result)
    })
  }

  /**
   *
   * @param webContents
   */
  private postRequiredData(
    webContents: WebContents | null,
    sendSvData: boolean,
    emptyData: boolean
  ): void {
    const task1 = new Promise<GlobalSetting>((resolve, reject) => {
      globalSettingStore.load(
        defaultGlobalSetting(),
        (data) => resolve(data),
        (err: any) => reject(err)
      )
    })

    if (emptyData) {
      Promise.allSettled([task1]).then((results) => {
        const globalSettingResult = results[0]
        const globalSetting =
          globalSettingResult.status === 'fulfilled'
            ? normalizeGlobalSetting(globalSettingResult.value)
            : defaultGlobalSetting()
        this.globalSetting = globalSetting
        this.updateLocalizedWindowChrome()
        Intaker.setEnabled(globalSetting.enableIntake)

        // グローバル設定読み込み時、必要なら更新チェックは行う
        this.checkUpdateIfNeeded(globalSetting)

        const msg: RequiredMessage = {
          type: 'required',
          svdata: null,
          quests: [],
          globalSetting,
          appSetting: defaultAppSetting(),
          mapInfo: EmptyApiMapInfoList(),
          missionList: EmptyApiMissionList(),
          questList: EmptyApiQuestList(),
          questKnowledgeUpdate: getActiveQuestKnowledgeUpdate()
        }
        if (webContents) {
          streamManager.postToRendererA(webContents, msg)
        } else {
          streamManager.postToRenderers(msg)
        }
      })
      return
    }

    const task2 = new Promise<void>((resolve, reject) => {
      appSettingStore.load(
        () => resolve(),
        (err: any) => reject(err)
      )
    })
    const taks3 = new Promise<ApiMapInfoList>((resolve, reject) => {
      mapInfoStoreLoader.load(
        EmptyApiMapInfoList(),
        (data) => resolve(data),
        (err: Error) => reject(err)
      )
    })
    const taks4 = new Promise<ApiMissionList>((resolve, reject) => {
      missionListStoreLoader.load(
        EmptyApiMissionList(),
        (data) => resolve(data),
        (err: Error) => reject(err)
      )
    })
    const task5 = new Promise<ApiQuestList>((resolve, reject) => {
      questListStoreLoader.load(
        EmptyApiQuestList(),
        (data) => resolve(data),
        (err: Error) => reject(err)
      )
    })

    //debug('send to quests(sv data):', quests);
    Promise.allSettled([task1, task2, taks3, taks4, task5]).then((results) => {
      const globalSettingResult = results[0]
      const mapInfoResult = results[2]
      const missionListResult = results[3]
      const questListResult = results[4]
      const quests = this.kcrecord?.quests ?? []
      const globalSetting =
        globalSettingResult.status === 'fulfilled'
          ? normalizeGlobalSetting(globalSettingResult.value)
          : defaultGlobalSetting()
      this.globalSetting = globalSetting
      this.updateLocalizedWindowChrome()
      Intaker.setEnabled(globalSetting.enableIntake)

      // グローバル設定読み込み時、必要なら更新チェックは行う
      this.checkUpdateIfNeeded(globalSetting)

      const msg: RequiredMessage = {
        type: 'required',
        svdata: sendSvData ? svdata.svdataRaw : null,
        quests,
        globalSetting,
        appSetting: appSettingStore.get(),
        mapInfo: mapInfoResult.status === 'fulfilled' ? mapInfoResult.value : EmptyApiMapInfoList(),
        missionList:
          missionListResult.status === 'fulfilled'
            ? missionListResult.value
            : EmptyApiMissionList(),
        questList:
          questListResult.status === 'fulfilled' ? questListResult.value : EmptyApiQuestList(),
        questKnowledgeUpdate: getActiveQuestKnowledgeUpdate()
      }
      if (webContents) {
        streamManager.postToRendererA(webContents, msg)
      } else {
        streamManager.postToRenderers(msg)
      }
    })
  }

  /**
   *
   */
  private onChannelRequestRequiredData(event: IpcMainInvokeEvent) {
    const webContents = event.sender

    // まだゲームを開始していない場合は必要なデータがないことから、データなしで返す
    if (this.cbBasicFirst) {
      debug('onChannelRequestRequiredData: no data. maybe game not started yet.')
      this.postRequiredData(webContents, false, true)
      return
    }

    this.postRequiredData(webContents, true, false)
  }

  /**
   *
   */
  private onChannelShipCsv(lines: string): void {
    const filename = `${moment(new Date()).format('YYYYMMDD-HHmmss')}.csv`
    debug(MainChannel.ship_csv)
    dialog
      .showSaveDialog({
        title: this.translate('main.csv.dialogTitle'),
        defaultPath: filename
      })
      .then((dialog_return) => {
        if (!dialog_return.canceled && dialog_return.filePath) {
          const buf = iconv.encode(lines, 'Shift_JIS')
          fs.open(dialog_return.filePath, 'w', (err, fd) => {
            if (err) {
              dialog.showErrorBox(
                this.translate('main.csv.openFailedTitle'),
                dialog_return.filePath ?? this.translate('main.csv.pathUnavailable')
              )
            } else {
              fs.write(fd, buf, 0, buf.length, (err, _written, _buffer) => {
                fs.close(fd, (err) => {
                  if (err) {
                    debug('save csv err', err)
                  }
                })
                debug('save writed to file', dialog_return.filePath, err)
                if (err) {
                  dialog.showErrorBox(
                    this.translate('main.csv.writeFailedTitle'),
                    dialog_return.filePath ?? this.translate('main.csv.pathUnavailable')
                  )
                }
              })
            }
          })
        }
      })
  }

  /**
   *
   */
  private onChannelGetAirbaseSpots(
    area_id: number,
    area_no: number
  ): [[string, string], [string, string], [string, string]] {
    debug(MainChannel.get_airbase_spots, area_id, area_no)
    return airbaseSpotStore.getSpots(area_id, area_no)
  }

  /**
   *
   */
  private onChannelSetAirbaseSpots(arg: AirbaseSpot): void {
    debug(MainChannel.set_airbase_spots, arg)
    airbaseSpotStore.setSpots(arg.area_id, arg.area_no, arg.spots)
  }

  /**
   *
   */
  private async onChannelOpenExternalUrl(
    event: IpcMainInvokeEvent,
    value: unknown
  ): Promise<boolean> {
    const isTrustedSender = isTrustedExternalUrlRequest(
      event.sender.id,
      event.senderFrame === event.sender.mainFrame,
      [this.mainWindow.webContents.id, this.assist_window?.webContents.id]
    )
    const url = normalizeExternalUrl(value)
    if (!isTrustedSender || !url) {
      return false
    }

    try {
      await shell.openExternal(url)
      return true
    } catch {
      return false
    }
  }

  /**
   *
   */
  private onChannelGetVersion(): string {
    return app.getVersion()
  }

  /**
   *
   * @returns
   */
  private async onChannelCheckForUpdates(
    setting: GlobalSetting = this.globalSetting
  ): Promise<UpdateCheckResult> {
    this.globalSetting = setting
    this.setUpdateState({
      status: 'checking',
      availableVersion: '',
      errorMessage: '',
      downloadPercent: null
    })
    return this.checkForUpdatesCore(setting)
  }

  private onChannelGetUpdateState(): UpdateStateSnapshot {
    return { ...this.updateState }
  }

  /**
   *
   * @returns
   */
  private async checkForUpdatesCore(
    setting: GlobalSetting = this.globalSetting
  ): Promise<UpdateCheckResult> {
    const channels = this.getUpdateCheckChannels(setting)
    for (const channel of channels) {
      const result = await this.checkForUpdatesByChannel(channel)
      if (result.status === 'available') {
        return result
      }
      if (result.status === 'error') {
        const isBetaChannelNotFound =
          channel === 'beta' && result.errorCode === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'
        if (!isBetaChannelNotFound) {
          this.setUpdateStateFromResult(result)
          return result
        }
      }
    }

    this.availableUpdateVersion = null
    const updateResult: UpdateCheckResult = { status: 'not-available' }
    this.setUpdateStateFromResult(updateResult)
    return updateResult
  }

  private getUpdateCheckChannels(setting: GlobalSetting): UpdateChannel[] {
    return setting.checkBetaUpdate ? ['beta', 'latest'] : ['latest']
  }

  private async checkForUpdatesByChannel(channel: UpdateChannel): Promise<UpdateCheckResult> {
    try {
      autoUpdater.channel = channel
      autoUpdater.allowDowngrade = false

      const result = await autoUpdater.checkForUpdates()
      const version = result?.updateInfo?.version
      const currentVersion = app.getVersion()
      debug('checkForUpdatesCore', {
        channel,
        currentVersion: currentVersion,
        latestVersion: version,
        isUpdateAvailable: result?.isUpdateAvailable
      })

      if (result?.isUpdateAvailable && version) {
        this.availableUpdateVersion = version
        const updateResult: UpdateCheckResult = { status: 'available', version }
        this.setUpdateStateFromResult(updateResult)
        return updateResult
      }

      return { status: 'not-available' }
    } catch (error) {
      debug('check for updates failed', error, 'channel:', channel, 'url:', getUpdateFeedUrl())
      this.availableUpdateVersion = null
      const updateResult: UpdateCheckResult = {
        status: 'error',
        errorCode: this.getUpdateErrorCode(error, 'CHECK_FOR_UPDATES_FAILED')
      }
      return updateResult
    }
  }

  private async onChannelDownloadUpdate(): Promise<void> {
    this.isSilentUpdate = true
    this.setUpdateState({
      status: 'updating',
      availableVersion: this.availableUpdateVersion ?? '',
      errorMessage: '',
      downloadPercent: 0
    })

    if (!this.availableUpdateVersion) {
      const result = await this.checkForUpdatesCore()
      if (result.status !== 'available') {
        throw new Error(result.status === 'error' ? result.errorCode : 'NO_UPDATE_AVAILABLE')
      }
    }

    try {
      await autoUpdater.downloadUpdate()
      this.downloadedUpdateVersion = this.availableUpdateVersion
      this.setUpdateState({
        status: 'ready',
        availableVersion: this.downloadedUpdateVersion ?? '',
        errorMessage: '',
        downloadPercent: 100
      })
    } catch (error) {
      debug('install update failed.', error)
      debug('error msg.', this.getUpdateErrorCode(error, 'INSTALL_UPDATE_FAILED'))
      this.setUpdateState({
        status: 'error',
        availableVersion: '',
        errorMessage: this.getUpdateErrorCode(error, 'INSTALL_UPDATE_FAILED'),
        downloadPercent: null
      })
      //throw new Error(this.getUpdateErrorCode(error, 'INSTALL_UPDATE_FAILED'))
    }
  }

  private async onChannelRestartAndInstallUpdate(): Promise<void> {
    if (!this.downloadedUpdateVersion) {
      throw new Error('NO_READY_UPDATE')
    }
    this.isSilentUpdate = false
    app.quit()
  }

  private getUpdateErrorCode(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') {
      const code = Reflect.get(error, 'code')
      if (typeof code === 'string' && code) {
        return code
      }
      if (typeof code === 'number') {
        return String(code)
      }
    }
    return fallback
  }

  private notifyUpdateDownloadProgress(percent: number): void {
    const normalizedPercent = Math.max(0, Math.min(100, Math.round(percent)))
    this.updateState = {
      ...this.updateState,
      status: 'updating',
      downloadPercent: normalizedPercent,
      errorMessage: ''
    }
    this.notifyUpdateStateChanged()
    const webContents = streamManager.webContentsList
    webContents.forEach((wc) => {
      wc.send(MainMessage.update_download_progress, normalizedPercent)
    })
  }

  private setUpdateState(state: UpdateStateSnapshot): void {
    this.updateState = { ...state }
    this.notifyUpdateStateChanged()
  }

  private setUpdateStateFromResult(result: UpdateCheckResult): void {
    switch (result.status) {
      case 'available':
        this.setUpdateState({
          status: 'available',
          availableVersion: result.version,
          errorMessage: '',
          downloadPercent: null
        })
        break
      case 'not-available':
        this.setUpdateState({
          status: 'latest',
          availableVersion: '',
          errorMessage: '',
          downloadPercent: null
        })
        break
      case 'error':
        this.setUpdateState({
          status: 'error',
          availableVersion: '',
          errorMessage: result.errorCode,
          downloadPercent: null
        })
        break
    }
  }

  private notifyUpdateStateChanged(): void {
    const webContents = streamManager.webContentsList
    webContents.forEach((wc) => {
      wc.send(MainMessage.update_state_changed, this.updateState)
    })
  }

  private notifyStartupUpdateChecked(result: UpdateCheckResult): void {
    const webContents = streamManager.webContentsList
    webContents.forEach((wc) => {
      wc.send(MainMessage.startup_update_checked, result)
    })
  }

  public hasDownloadedUpdate(): boolean {
    return this.downloadedUpdateVersion !== null
  }

  public quitAndInstallDownloadedUpdate(): void {
    if (!this.downloadedUpdateVersion) {
      return
    }
    const version = this.downloadedUpdateVersion
    this.downloadedUpdateVersion = null
    this.availableUpdateVersion = null
    debug('quit and install downloaded update:', version, 'is silent update:', this.isSilentUpdate)
    autoUpdater.quitAndInstall(this.isSilentUpdate, false)
  }

  /**
   *
   */
  private async onChannelQueryDb(query: Query): Promise<QueryReturn> {
    debug('onChannelQueryDb', query)
    if (!this.kcrecord) {
      return new Promise<[]>((resolve) => resolve([]))
    }
    return this.kcrecord.query(query)
  }

  /**
   *
   */
  private async onChannelClearSessionCache(): Promise<void> {
    debug(MainChannel.clear_session_cache)
    return session.defaultSession.clearCache()
  }

  /**
   *
   * @param mapinfo
   * @param map
   * @returns
   */
  public async onChannelFindSpotForLabel(mapinfo: MstMapinfo, map: ApiMap): Promise<Spot | null> {
    debug(MainChannel.find_spot_for_label, mapinfo, map)
    const cell_info = MapStuff.cellInfo(mapinfo.api_maparea_id, mapinfo.api_no)
    const spot = CommonMap.findSpotForLabel(cell_info.spots, map.api_no)
    return spot ? spot : null
  }

  /**
   *
   * @param area_id
   * @param area_no
   * @returns
   */
  public async onChannelCellInfoAsync(area_id: number, area_no: number): Promise<CellInfo> {
    debug(MainChannel.cell_info_async)
    return MapStuff.cellInfoAsync(area_id, area_no)
  }

  /**
   *
   */
  async onChannelCalcPortChartData(): Promise<PortChartData> {
    debug(MainChannel.calc_port_chart_data)
    if (!this.kcrecord) {
      throw new Error('Record database is unavailable before game startup')
    }
    await this.kcrecord.whenDbReady()
    return getWorkerDriver().calcPortChartData()
  }

  /**
   *
   */
  private onChannelSaveAppSetting(event: IpcMainInvokeEvent, setting: AppSetting): void {
    debug(MainChannel.save_app_setting, 'sender id:', event.sender.id)
    appSettingStore.save(setting)
    streamManager.postToRendererOthers(event.sender, { type: 'app_setting', setting })
  }

  /**
   *
   * @param setting
   */
  private onChannelSaveGlobalSetting(event: IpcMainInvokeEvent, setting: GlobalSetting): void {
    debug(MainChannel.save_global_setting, 'sender id:', event.sender.id)
    const normalizedSetting = normalizeGlobalSetting(setting)
    this.globalSetting = normalizedSetting
    this.updateLocalizedWindowChrome()
    Intaker.setEnabled(normalizedSetting.enableIntake)
    globalSettingStore.save(normalizedSetting)
    streamManager.postToRendererOthers(event.sender, {
      type: 'global_setting',
      setting: normalizedSetting
    })
  }

  /**
   *
   * @param area_id
   * @param area_no
   * @returns
   */
  private onChannelAggregateRankByArea(
    area_id: number,
    area_no: number
  ): Promise<AggregatedCellRank[]> {
    debug(MainChannel.aggregate_cell_rank)
    return getWorkerDriver().aggregateRankByArea(area_id, area_no)
  }

  /**
   *
   * @param ship_id
   * @returns
   */
  private onChannelAggregateShipDrop(
    ship_id: number,
    rendererScopeId: number
  ): Promise<AggregatedCellShipDrop[]> {
    return getWorkerDriver().aggregateShipDrop(ship_id, rendererScopeId)
  }

  /**
   *
   */
  private onChannelGetInheritScoreList(): Promise<InheritScoreList> {
    debug(MainChannel.get_inherit_score_list)
    return new Promise<InheritScoreList>((resolve, reject) => {
      inheritScoreStoreLoader.load(
        defaultInheritScoreList(),
        (list: InheritScoreList) => {
          resolve(list)
        },
        (err: Error) => {
          reject(err)
        }
      )
    })
  }

  /**
   *
   * @param list
   */
  private onChannelSaveInheritScoreList(list: InheritScoreList): void {
    debug(MainChannel.save_inherit_score_list)
    inheritScoreStoreLoader.save(list)
  }

  /**
   *
   */
  private async onChannelTimeline(): Promise<[QuestContext, BattleRecord[]]> {
    if (!this.kcrecord) {
      return Promise.resolve([{ quest_max: 0, quests: null }, []])
    }

    debug(MainChannel.timeline)
    const questTask = () => {
      return new Promise<QuestContext>((resolve) => {
        const questlist = svdata.questlist
        resolve({
          quest_max: svdata.parallelQuestCount,
          quests: questlist ? KcsUtil.questlistInProgress(questlist) : null
        })
      })
    }
    const query = {
      dbName: DbName.battle,
      find: {
        cellId: { $ne: -1 }
      },
      limit: 10,
      sort: { date: -1 }
    }
    return Promise.all([questTask(), this.kcrecord!.queryBattleRecord(query)])
  }

  /**
   *
   */
  private onChannelRefreshAssist() {
    // todo: remount vue app
    // debug(MainChannel.refresh_assist)
    // this.assist_webcontents.forEach((el) => el.webcontents.reload())
    // if (this.assist_window) {
    //   this.assist_window.webContents.reload()
    // }
  }

  /**
   *
   */
  private onPowerResume(): void {
    debug('power resume')
    this.mainWindow.webContents.send(GameChannel.resume)
  }

  /**
   *
   */
  private onRequireInfo(): void {
    if (!hasValidAccountIdentity(svdata)) {
      return
    }
    if (this.cbBasicFirst) {
      ApiCallback.unset(this.cbBasicFirst)
      this.cbBasicFirst = 0
    }

    if (!this.accountInitialization) {
      this.accountInitialization = this.initializeCurrentAccount()
    }
  }

  public inspectDataFolderFixture(): {
    readonly opened: boolean
    readonly parentIsElectronUserData: boolean
    readonly directoryName: string
    readonly directoryExists: boolean
  } {
    if (!isLayoutFixtureEnabled()) {
      throw new Error('data-folder fixture is not enabled')
    }
    const directory = getUserDataDir()
    return {
      opened: this.lastDataFolderFixturePath === directory,
      parentIsElectronUserData: path.dirname(directory) === app.getPath('userData'),
      directoryName: path.basename(directory),
      directoryExists: fs.existsSync(directory)
    }
  }

  public async initializeAccountRestoreFixture(): Promise<void> {
    if (!isAccountRestoreFixtureEnabled()) {
      throw new Error('account restore fixture is not enabled')
    }
    applyAccountRestoreFixtureIdentity()
    if (!this.accountInitialization) {
      this.accountInitialization = this.initializeCurrentAccount()
    }
    await this.accountInitialization
    if (this.accountInitializationError) {
      throw this.accountInitializationError
    }
  }

  public async exerciseAccountTransferFixture(backupDirectory: string): Promise<{
    readonly bytes: number
    readonly records: number
    readonly identityOutsideCiphertext: false
    readonly wrongPassphraseRejected: true
    readonly corruptionRejected: true
  }> {
    if (!isAccountRestoreFixtureEnabled()) {
      throw new Error('account transfer fixture is not enabled')
    }
    const verified = await verifyLocalAccountBackup(backupDirectory)
    const temporaryRoot = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'koubrowser-transfer-smoke-')
    )
    await fs.promises.chmod(temporaryRoot, 0o700)
    const transferPath = path.join(temporaryRoot, 'fixture.koubrowser-transfer')
    const passphrase = 'fixture-only-long-passphrase'
    try {
      const created = await createEncryptedAccountTransfer(
        verified.directory,
        transferPath,
        passphrase
      )
      const inspection = await inspectEncryptedAccountTransfer(transferPath, passphrase)
      if (
        inspection.records !== verified.manifest.summary.records ||
        inspection.databaseFiles !== verified.manifest.summary.databaseFiles
      ) {
        throw new Error('account transfer fixture summary does not match')
      }

      const encrypted = await fs.promises.readFile(transferPath)
      if (
        encrypted.includes(Buffer.from(verified.manifest.account.memberId, 'utf8')) ||
        encrypted.includes(Buffer.from(verified.manifest.bundleId, 'utf8')) ||
        encrypted.includes(Buffer.from(verified.manifest.sourceDeviceId, 'utf8'))
      ) {
        throw new Error('account transfer fixture exposed identity outside ciphertext')
      }

      const wrongPassphraseRoot = path.join(temporaryRoot, 'wrong-passphrase')
      await fs.promises.mkdir(wrongPassphraseRoot)
      let wrongPassphraseRejected = false
      try {
        await decryptAccountTransferToDirectory(
          transferPath,
          'fixture-only-wrong-passphrase',
          wrongPassphraseRoot
        )
      } catch {
        wrongPassphraseRejected = true
      }
      if (
        !wrongPassphraseRejected ||
        (await fs.promises.readdir(wrongPassphraseRoot)).length !== 0
      ) {
        throw new Error('account transfer fixture accepted a wrong passphrase')
      }

      const damagedPath = path.join(temporaryRoot, 'damaged.koubrowser-transfer')
      const damaged = Buffer.from(encrypted)
      damaged[Math.floor(damaged.byteLength / 2)] ^= 0x01
      await fs.promises.writeFile(damagedPath, damaged, {
        flag: 'wx',
        mode: 0o600
      })
      const damagedRoot = path.join(temporaryRoot, 'damaged-output')
      await fs.promises.mkdir(damagedRoot)
      let corruptionRejected = false
      try {
        await decryptAccountTransferToDirectory(damagedPath, passphrase, damagedRoot)
      } catch {
        corruptionRejected = true
      }
      if (!corruptionRejected || (await fs.promises.readdir(damagedRoot)).length !== 0) {
        throw new Error('account transfer fixture accepted damaged ciphertext')
      }

      return {
        bytes: created.bytes,
        records: created.records,
        identityOutsideCiphertext: false,
        wrongPassphraseRejected: true,
        corruptionRejected: true
      }
    } finally {
      await fs.promises.rm(temporaryRoot, {
        recursive: true,
        force: true
      })
    }
  }

  public async prepareAccountMergeFixture(backupDirectory: string): Promise<{
    readonly bundleId: string
    readonly stageName: string
    readonly safeAdd: number
  }> {
    if (!isAccountRestoreFixtureEnabled()) {
      throw new Error('account merge fixture is not enabled')
    }
    await this.initializeAccountRestoreFixture()
    await getWorkerDriverQuest().dbUpdate({
      dbName: DbName.quest,
      query: { no: 900001 },
      updateQuery: {
        _id: 'quest-monotonic-smoke-current',
        no: 900001,
        date: '2026-07-30T10:00:00+09:00',
        dateKey: 'daily-20260730',
        quest: {
          api_no: 900001,
          api_category: 3,
          api_type: 1,
          api_label_type: 2,
          api_state: 2,
          api_title: '合成任務進捗',
          api_detail: 'production smoke 用の合成任務',
          api_voice_id: 0,
          api_get_material: [0, 0, 0, 0],
          api_bonus_flag: 0,
          api_progress_flag: 0,
          api_invalid_flag: 0
        },
        state: {
          count: [3, 1],
          countMax: [5, 3]
        }
      },
      options: { upsert: true }
    } as Update)
    const verified = await verifyLocalAccountBackup(backupDirectory)
    if (
      verified.manifest.account.serverId !== svdata.serverId ||
      verified.manifest.account.memberId !== String(svdata.basic.api_member_id)
    ) {
      throw new Error('account merge fixture does not match the current account')
    }
    const previews = await previewVerifiedAccountBackupAgainstCurrent(verified)
    const safeAdd = previews.reduce((total, preview) => total + preview.mergePlan.safeAdd, 0)
    if (safeAdd === 0) {
      throw new Error('account merge fixture has no safe records to merge')
    }
    const staged = await stageVerifiedAccountBackupMerge(verified, previews)
    await prepareCurrentAccountBackupMerge(staged.directory)
    return {
      bundleId: staged.bundleId,
      stageName: path.basename(staged.directory),
      safeAdd
    }
  }

  public async prepareAccountMergeRollbackFixture(): Promise<{
    readonly bundleId: string
    readonly stageName: string
  }> {
    if (!isAccountRestoreFixtureEnabled()) {
      throw new Error('account merge rollback fixture is not enabled')
    }
    await this.initializeAccountRestoreFixture()
    const rollback = await getAvailableMergeRollbackForCurrentAccount()
    if (!rollback) {
      throw new Error('account merge rollback fixture is not available')
    }
    await prepareCurrentAccountMergeRollback(rollback)
    return {
      bundleId: rollback.bundleId,
      stageName: rollback.stageName
    }
  }

  public async prepareAccountMergeRedoFixture(): Promise<{
    readonly bundleId: string
    readonly stageName: string
  }> {
    if (!isAccountRestoreFixtureEnabled()) {
      throw new Error('account merge redo fixture is not enabled')
    }
    await this.initializeAccountRestoreFixture()
    const redo = await getAvailableMergeRedoForCurrentAccount()
    if (!redo) {
      throw new Error('account merge redo fixture is not available')
    }
    await prepareCurrentAccountMergeRedo(redo)
    return {
      bundleId: redo.bundleId,
      stageName: redo.stageName
    }
  }

  public async inspectAccountRestoreFixtureData(): Promise<{
    readonly histories: Record<
      string,
      {
        readonly records: number
        readonly values: Record<string, number>
      }
    >
    readonly portChartPoints: number
    readonly dropRankS: number
  }> {
    if (!isAccountRestoreFixtureEnabled()) {
      throw new Error('account restore fixture is not enabled')
    }
    try {
      await this.initializeAccountRestoreFixture()
    } catch (error) {
      if (!this.kcrecord) {
        throw error
      }
    }
    if (!this.kcrecord) {
      throw new Error('account restore fixture databases are unavailable')
    }
    await this.kcrecord.whenAllDbReady()

    const historyNames = [
      DbName.port,
      DbName.battle,
      DbName.drop,
      DbName.mission,
      DbName.quest,
      DbName.clearitemget
    ] as const
    const histories = Object.fromEntries(
      await Promise.all(
        historyNames.map(async (dbName) => {
          const driver = dbName === DbName.quest ? getWorkerDriverQuest() : getWorkerDriver()
          const records = await driver.dbQuery<Record<string, unknown>>({
            dbName,
            find: {
              fixture: {
                $in: ['account-restore', 'account-merge']
              }
            }
          } as Query)
          const values: Record<string, number> = {}
          for (const record of records) {
            if (typeof record.value === 'string') {
              values[record.value] = (values[record.value] ?? 0) + 1
            }
          }
          return [
            dbName,
            {
              records: records.length,
              values
            }
          ]
        })
      )
    )
    const chart = await getWorkerDriver().calcPortChartData()
    const ranks = await getWorkerDriver().aggregateRankByArea(1, 1)

    return {
      histories,
      portChartPoints: chart.materials[0].length,
      dropRankS: ranks.find((rank) => rank.cell_no === 1)?.counts[0] ?? 0
    }
  }

  private async initializeCurrentAccount(): Promise<void> {
    const protectedRollbackBundles = new Set<string>()
    const protectedMergeRollbackStages = new Set<string>()
    let accountTransactionFailed = false
    try {
      const rollback = await applyPendingMergeRollbackForCurrentAccount()
      if (rollback.status === 'applied') {
        protectedMergeRollbackStages.add(rollback.stageName)
        console.info(`account merge rollback applied for bundle ${rollback.bundleId}`)
      }
    } catch (error) {
      accountTransactionFailed = true
      this.accountInitializationError = error
      console.error('pending account merge rollback failed; current data was retained', error)
      if (error instanceof AggregateError) {
        dialog.showErrorBox(
          this.translate('accountBackup.mergeRollback.recoveryFailedTitle'),
          this.translate('accountBackup.mergeRollback.recoveryFailed')
        )
        return
      }
    }

    try {
      const redo = await applyPendingMergeRedoForCurrentAccount()
      if (redo.status === 'applied') {
        protectedMergeRollbackStages.add(redo.stageName)
        console.info(`account merge redo applied for bundle ${redo.bundleId}`)
      }
    } catch (error) {
      accountTransactionFailed = true
      this.accountInitializationError = error
      console.error('pending account merge redo failed; current data was retained', error)
      if (error instanceof AggregateError) {
        dialog.showErrorBox(
          this.translate('accountBackup.mergeRedo.recoveryFailedTitle'),
          this.translate('accountBackup.mergeRedo.recoveryFailed')
        )
        return
      }
    }

    try {
      const rollback = await applyPendingRollbackForCurrentAccount()
      if (rollback.status === 'applied') {
        protectedRollbackBundles.add(rollback.bundleId)
        console.info(`account rollback applied for bundle ${rollback.bundleId}`)
      }
    } catch (error) {
      accountTransactionFailed = true
      this.accountInitializationError = error
      console.error('pending account rollback failed; current data was retained', error)
      if (error instanceof AggregateError) {
        dialog.showErrorBox(
          this.translate('accountBackup.rollback.recoveryFailedTitle'),
          this.translate('accountBackup.rollback.recoveryFailed')
        )
        return
      }
    }

    try {
      const redo = await applyPendingRedoForCurrentAccount()
      if (redo.status === 'applied') {
        protectedRollbackBundles.add(redo.bundleId)
        console.info(`account redo applied; rollback retained for bundle ${redo.bundleId}`)
      }
    } catch (error) {
      accountTransactionFailed = true
      this.accountInitializationError = error
      console.error('pending account redo failed; current data was retained', error)
      if (error instanceof AggregateError) {
        dialog.showErrorBox(
          this.translate('accountBackup.redo.recoveryFailedTitle'),
          this.translate('accountBackup.redo.recoveryFailed')
        )
        return
      }
    }

    try {
      const restore = await applyPendingRestoreForCurrentAccount()
      if (restore.status === 'applied') {
        protectedRollbackBundles.add(restore.bundleId)
        console.info(`account restore applied; rollback retained for bundle ${restore.bundleId}`)
      } else if (restore.status === 'already-applied') {
        protectedRollbackBundles.add(restore.bundleId)
        console.info(`account restore already applied for bundle ${restore.bundleId}`)
      }
    } catch (error) {
      accountTransactionFailed = true
      this.accountInitializationError = error
      console.error('pending account restore failed; current data was retained', error)
      if (error instanceof AggregateError) {
        dialog.showErrorBox(
          this.translate('accountBackup.restore.recoveryFailedTitle'),
          this.translate('accountBackup.restore.recoveryFailed')
        )
        return
      }
    }

    try {
      const merge = await applyPendingMergeForCurrentAccount()
      if (merge.status === 'applied') {
        protectedMergeRollbackStages.add(path.basename(merge.rollbackDirectory))
        console.info(`account merge applied; rollback retained for bundle ` + `${merge.bundleId}`)
      } else if (merge.status === 'expired') {
        console.warn(
          `account merge plan expired for bundle ${merge.bundleId}; ` +
            `changed databases: ${merge.changedDatabases.join(', ')}`
        )
      }
    } catch (error) {
      accountTransactionFailed = true
      this.accountInitializationError = error
      console.error('pending account merge failed; current data was retained', error)
      if (error instanceof AggregateError) {
        dialog.showErrorBox(
          this.translate('accountBackup.merge.recoveryFailedTitle'),
          this.translate('accountBackup.merge.recoveryFailed')
        )
        return
      }
    }

    if (!accountTransactionFailed) {
      try {
        const mergeRetention = await enforceAccountMergeRetentionForCurrentAccount([
          ...protectedMergeRollbackStages
        ])
        if (mergeRetention.deleted.length > 0) {
          console.info(
            `account merge rollback retention removed ` +
              `${mergeRetention.deleted.length} completed generation(s)`
          )
        }
        if (mergeRetention.overCapacityBytes > 0) {
          console.warn(
            `account merge rollback retention remains over its capacity ` +
              `target by ${mergeRetention.overCapacityBytes} byte(s)`
          )
        }
        const retention = await enforceAccountRestoreRetentionForCurrentAccount([
          ...protectedRollbackBundles
        ])
        if (retention.deleted.length > 0) {
          console.info(
            `account rollback retention removed ` +
              `${retention.deleted.length} completed generation(s)`
          )
        }
        if (retention.overCapacityBytes > 0) {
          console.warn(
            `account rollback retention remains over its capacity target ` +
              `by ${retention.overCapacityBytes} byte(s); protected or ` +
              `unrecognized data was retained`
          )
        }
      } catch (error) {
        console.error('account rollback retention failed; retained data was left in place', error)
      }
    }

    PathStuff.createStoreDir()
    if (!this.kcrecord) {
      this.kcrecord = new KcRecord(
        PathStuff.storeUser,
        () => this.questUpdated(),
        () => this.questUpdated()
      )
    }
    this.postRequiredData(null, false, false)
  }

  /**
   *
   * @param args
   */
  private onMapInfo(args: ApiMapInfoList): void {
    if (Env.isTestMode) {
      console.log('test mode: skip save map info list')
      return
    }
    mapInfoStoreLoader.save(args)
  }

  /**
   *
   * @param args
   */
  private onMissionList(args: ApiMissionList): void {
    if (Env.isTestMode) {
      console.log('test mode: skip save mission list')
      return
    }
    missionListStoreLoader.save(args)
  }

  /**
   *
   * @param args
   */
  private onQuestList(args: ApiQuestListWithParam): void {
    if (args.api_tab_id === ApiQuestListParamTabId.all) {
      const { api_tab_id: _api_tab_id, ...questlist }: ApiQuestListWithParam = args
      if (Env.isTestMode) {
        console.log('test mode: skip save quest list')
        return
      }
      questListStoreLoader.save(questlist)
    }
  }

  /**
   *
   * @param data
   */
  private onApiHookServerId(data: kcsapi_hook.ServerId): void {
    debug('main process received server id:', data.api_server_id)
    const api_data: ApiDataRoot = {
      api_result: ApiResult.ok,
      api_result_msg: '',
      api_data: {
        api_world_id: data.api_server_id
      }
    }
    const json = JSON.stringify(api_data)
    svdata.update(kcsapi.Api.API_WORLD_GET_ID, json)
    this.postResToRenderer(kcsapi.Api.API_WORLD_GET_ID, json)
  }

  /**
   *
   * @param data
   * @param logRequest
   */
  public onApiHookLoadStart(data: kcsapi_hook.LoadStart, logRequest: boolean): void {
    debug('[XHR Request Started(in main)]', data.api, data.method)
    if (logRequest) {
      kcapi_debug.logRequest(data)
    }
    if (data.body) {
      svdata.setReq(data.api, data.body)
      this.postReqToRenderer(data.api, data.body)
    }
  }

  /**
   *
   * @param data
   * @param logResponse
   */
  public onApiHookLoadEnd(data: kcsapi_hook.LoadEnd, logResponse: boolean): void {
    debug('[XHR Request Ended(in main)]', data.api, data.method)
    if (logResponse) {
      kcapi_debug.logResponse(data)
    }
    if (data.response) {
      svdata.update(data.api, data.response)
      let additional: ApiResMessageAdditional | undefined
      if (data.api === kcsapi.Api.REQ_MAP_START) {
        additional = {
          mapStartUuid: svdata.prvBattleMapInfo?.uuid
        }
      } else if (kcsapi.isBattleResultApi(data.api)) {
        // 戦闘後の味方HP計算、更新
        const afterBattleFleetHps = getAfterBattleFleetHpsInfo(svdata)
        if (afterBattleFleetHps) {
          additional = {
            afterBattleFleetHps
          }

          // mainプロセス側を反映
          // renderer側はメッセージ受信時に更新
          updateFleetHps(svdata, afterBattleFleetHps)
        }
      }
      this.postResToRenderer(data.api, data.response, additional)
    }
  }

  /**
   *
   * @param data
   */
  private onApiHookUnknownLoadStart(data: kcsapi_hook.UnknownLoadStart): void {
    debug('[XHR Unknown Request Started(in main)]', data.url, data.method)
    kcapi_debug.logUnknownRequest(data)
  }

  /**
   *
   * @param data
   */
  private onApiHookUnknownLoadEnd(data: kcsapi_hook.UnknownLoadEnd): void {
    debug('[XHR Unknown Request Ended(in main)]', data.url, data.method)
    kcapi_debug.logUnknownResponse(data)
  }

  /**
   *
   */
  private questUpdated(): void {
    if (this.questUpdated_called) {
      return
    }
    this.questUpdated_called = true
    setTimeout(() => {
      this.questUpdated_called = false
      const quests = this.kcrecord?.quests ?? []
      const msg: QuestsMessage = { type: 'quests', quests }
      streamManager.postToRenderers(msg)
    }, 0)
  }

  /**
   *
   */
  private onClosed() {
    debug('main window closed. data ok:', svdata.isShipDataOk)
    screen.removeListener('display-added', this.onDisplayConfigurationChanged)
    screen.removeListener('display-removed', this.onDisplayConfigurationChanged)
    screen.removeListener('display-metrics-changed', this.onDisplayConfigurationChanged)
    if (this.displayLayoutTimer) {
      clearTimeout(this.displayLayoutTimer)
      this.displayLayoutTimer = null
    }
    this.kcrecord?.doDispose()
    this.game_webcontents = null
    this.closeRecorder()
  }

  /**
   *
   */
  private onResize(): void {
    if (this.nohandle_resize) {
      debug('mainWindow handle esize')
      return
    }
    if (gameSetting.layoutMode === 'workspace') {
      process.nextTick(() => this.updateWorkspaceZoomFactor())
      return
    }
    if (gameSetting.isAssistInGame) {
      return
    }

    //debug('mainWindow. resize>> ', this.mainWindow.getPosition(), this.mainWindow.getSize(), this.mainWindow.getContentSize(), gameSetting.assistInGame, gameSetting.isAssistInGame);
    const size = this.main_window.getContentSize()
    if (size) {
      const display = screen.getDisplayMatching(this.mainWindow.getBounds())
      const { minWidth } = calcMainWindowMinSize()
      const fittedSize = fitGameOnlyWindowSize(size[0], display.workArea, minWidth)
      //debug('>>>>>size', size[1], height, 'width', size[0]);
      process.nextTick(() => {
        if (this.mainWindow.isDestroyed()) {
          return
        }
        //debug('tick', size[1], height, this.main_window.getSize());
        if (size[0] !== fittedSize.width || size[1] !== fittedSize.height) {
          this.main_window.setContentSize(fittedSize.width, fittedSize.height)
        }
        appState.game_only_width = fittedSize.width
        appState.game_only_height = fittedSize.height
        gameSetting.zoom_factor = AppStuff.calcGameZoomFactor(fittedSize.width)
        //mainWindow.webContents.send(GameChannel.set_zoom_factor, gameSetting.zoom_factor);
      })
      //debug('<<<<<size');
    }
  }

  /**
   *
   * @param event
   * @param newBounds
   */
  private onWillResize(event: Event, newBounds: Rectangle): void {
    if (gameSetting.layoutMode === 'workspace' || gameSetting.isAssistInGame) {
      return
    }

    const size = this.main_window.getContentSize()
    if (size) {
      debug(
        'mainWindow. will resize',
        newBounds.width,
        newBounds.height,
        'now(w,h):',
        size[0],
        size[1]
      )
      if (size[0] == newBounds.width) {
        event.preventDefault()
      }
    }
  }
}

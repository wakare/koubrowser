import { app, type BrowserWindow, screen, webContents, type WebContents } from 'electron'
import { getActiveDataDirectory, getActiveQuestKnowledgeUpdate } from '@main/data-path'
import { isLayoutFixtureEnabled } from '@main/layout-fixture-env'

const SmokeMessageSource = 'koubrowser-smoke'
const SmokeLifecycleMessageSource = 'koubrowser-smoke-lifecycle'

interface SmokeRequest {
  readonly source: typeof SmokeMessageSource
  readonly token: string
  readonly id: number
  readonly target: 'app' | 'game'
  readonly method: string
  readonly params?: unknown
}

interface SmokeResponse {
  readonly source: typeof SmokeMessageSource
  readonly token: string
  readonly id: number
  readonly result?: unknown
  readonly error?: {
    readonly message: string
  }
}

export function reportSmokeLifecycle(stage: string): void {
  const token = process.env.KOUBROWSER_SMOKE_IPC_TOKEN
  if (
    process.env.KOUBROWSER_SMOKE_IPC !== '1' ||
    !token ||
    !process.send ||
    !process.connected
  ) {
    return
  }
  process.send({
    source: SmokeLifecycleMessageSource,
    token,
    stage
  })
}

/**
 * Flush the final lifecycle event and remove the smoke-only IPC handle before
 * Electron performs its last quit attempt.
 */
export function finishSmokeLifecycle(stage: string, onFinished: () => void): boolean {
  const token = process.env.KOUBROWSER_SMOKE_IPC_TOKEN
  if (
    process.env.KOUBROWSER_SMOKE_IPC !== '1' ||
    !token ||
    !process.send ||
    !process.connected
  ) {
    return false
  }

  process.send(
    {
      source: SmokeLifecycleMessageSource,
      token,
      stage
    },
    () => {
      process.channel?.unref()
      if (process.connected) {
        process.disconnect()
      }
      onFinished()
    }
  )
  return true
}

interface SmokeHooks {
  readonly exerciseBattleResultFixture?: () => Promise<unknown> | unknown
  readonly exerciseCapacityBoundaryFixture?: (
    mode: 'full' | 'overflow'
  ) => Promise<unknown> | unknown
  readonly exerciseProxyFixture?: () => Promise<unknown>
  readonly inspectDataFolderFixture?: () => unknown
  readonly initializeAccountRestoreFixture?: () => Promise<void>
  readonly exerciseAccountTransferFixture?: (backupDirectory: string) => Promise<unknown>
  readonly prepareAccountMergeFixture?: (backupDirectory: string) => Promise<unknown>
  readonly prepareAccountMergeRollbackFixture?: () => Promise<unknown>
  readonly prepareAccountMergeRedoFixture?: () => Promise<unknown>
  readonly inspectAccountRestoreFixtureData?: () => Promise<unknown>
  readonly isDataUpdatePublicKeyConfigured?: () => boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSmokeRequest(value: unknown, token: string): value is SmokeRequest {
  return (
    isRecord(value) &&
    value.source === SmokeMessageSource &&
    value.token === token &&
    typeof value.id === 'number' &&
    (value.target === 'app' || value.target === 'game') &&
    typeof value.method === 'string'
  )
}

function gameWebContents(): WebContents {
  const game = webContents
    .getAllWebContents()
    .find((contents) => !contents.isDestroyed() && contents.getType() === 'webview')
  if (!game) {
    throw new Error('The game webview is not ready')
  }
  return game
}

function targetWebContents(
  target: SmokeRequest['target'],
  getMainWindow: () => BrowserWindow | null
): WebContents {
  if (target === 'game') {
    return gameWebContents()
  }
  const window = getMainWindow()
  if (!window || window.isDestroyed()) {
    throw new Error('The main window is not ready')
  }
  return window.webContents
}

function numberParam(params: Record<string, unknown>, name: string): number {
  const value = params[name]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid smoke input parameter: ${name}`)
  }
  return value
}

function stringParam(params: unknown, name: string): string {
  if (!isRecord(params)) {
    throw new Error(`Invalid smoke input parameter: ${name}`)
  }
  const value = params[name]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid smoke input parameter: ${name}`)
  }
  return value
}

async function handleSmokeRequest(
  request: SmokeRequest,
  getMainWindow: () => BrowserWindow | null,
  hooks: SmokeHooks
): Promise<unknown> {
  if (request.method === 'Runtime.enable') {
    return {}
  }

  if (request.method === 'Smoke.quit') {
    console.info('[smoke] quit requested')
    reportSmokeLifecycle('quit-requested')
    setTimeout(() => {
      reportSmokeLifecycle('app-quit-called')
      app.quit()
    }, 50)
    return { scheduled: true }
  }

  if (request.method === 'Smoke.getDisplayTopology') {
    const window = getMainWindow()
    if (!window || window.isDestroyed()) {
      throw new Error('The main window is not ready')
    }
    const primaryDisplayId = screen.getPrimaryDisplay().id
    const currentDisplayId = screen.getDisplayMatching(window.getBounds()).id
    return {
      primaryDisplayId,
      currentDisplayId,
      displays: screen.getAllDisplays().map((display) => ({
        id: display.id,
        primary: display.id === primaryDisplayId,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor,
        rotation: display.rotation,
        internal: display.internal,
        touchSupport: display.touchSupport
      }))
    }
  }

  if (request.method === 'Smoke.getDataUpdateState') {
    const questKnowledgeUpdate = getActiveQuestKnowledgeUpdate()
    return {
      userDataPath: app.getPath('userData'),
      publicKeyConfigured:
        hooks.isDataUpdatePublicKeyConfigured?.() ??
        Boolean(process.env.KOU_DATA_UPDATE_PUBLIC_KEY),
      activeDataDirectory: getActiveDataDirectory(),
      questClaimCount: questKnowledgeUpdate?.claims.length ?? 0,
      questIds: questKnowledgeUpdate?.claims.map((claim) => claim.questId) ?? [],
      strategyVersion: questKnowledgeUpdate?.strategy?.version ?? null,
      strategyRecipeIds:
        questKnowledgeUpdate?.strategy?.recipes.map((recipe) => recipe.id) ?? []
    }
  }

  if (request.method === 'Smoke.exerciseBattleResultFixture') {
    if (!isLayoutFixtureEnabled() || !hooks.exerciseBattleResultFixture) {
      throw new Error('battle-result smoke fixture is not enabled')
    }
    return hooks.exerciseBattleResultFixture()
  }

  if (request.method === 'Smoke.exerciseCapacityBoundaryFixture') {
    if (!isLayoutFixtureEnabled() || !hooks.exerciseCapacityBoundaryFixture) {
      throw new Error('capacity-boundary smoke fixture is not enabled')
    }
    const mode = stringParam(request.params, 'mode')
    if (mode !== 'full' && mode !== 'overflow') {
      throw new Error('Invalid smoke input parameter: mode')
    }
    return hooks.exerciseCapacityBoundaryFixture(mode)
  }

  if (request.method === 'Smoke.exerciseProxyFixture') {
    if (!isLayoutFixtureEnabled() || !hooks.exerciseProxyFixture) {
      throw new Error('proxy smoke fixture is not enabled')
    }
    return hooks.exerciseProxyFixture()
  }

  if (request.method === 'Smoke.inspectDataFolderFixture') {
    if (!isLayoutFixtureEnabled() || !hooks.inspectDataFolderFixture) {
      throw new Error('data-folder smoke fixture is not enabled')
    }
    return hooks.inspectDataFolderFixture()
  }

  if (request.method === 'Smoke.initializeAccountRestoreFixture') {
    if (
      process.env.KOUBROWSER_ACCOUNT_RESTORE_FIXTURE !== '1' ||
      !hooks.initializeAccountRestoreFixture
    ) {
      throw new Error('account restore smoke fixture is not enabled')
    }
    await hooks.initializeAccountRestoreFixture()
    return {}
  }

  if (request.method === 'Smoke.exerciseAccountTransferFixture') {
    if (
      process.env.KOUBROWSER_ACCOUNT_RESTORE_FIXTURE !== '1' ||
      !hooks.exerciseAccountTransferFixture
    ) {
      throw new Error('account transfer smoke fixture is not enabled')
    }
    return hooks.exerciseAccountTransferFixture(stringParam(request.params, 'backupDirectory'))
  }

  if (request.method === 'Smoke.prepareAccountMergeFixture') {
    if (
      process.env.KOUBROWSER_ACCOUNT_RESTORE_FIXTURE !== '1' ||
      !hooks.prepareAccountMergeFixture
    ) {
      throw new Error('account merge smoke fixture is not enabled')
    }
    return hooks.prepareAccountMergeFixture(stringParam(request.params, 'backupDirectory'))
  }

  if (request.method === 'Smoke.prepareAccountMergeRollbackFixture') {
    if (
      process.env.KOUBROWSER_ACCOUNT_RESTORE_FIXTURE !== '1' ||
      !hooks.prepareAccountMergeRollbackFixture
    ) {
      throw new Error('account merge rollback smoke fixture is not enabled')
    }
    return hooks.prepareAccountMergeRollbackFixture()
  }

  if (request.method === 'Smoke.prepareAccountMergeRedoFixture') {
    if (
      process.env.KOUBROWSER_ACCOUNT_RESTORE_FIXTURE !== '1' ||
      !hooks.prepareAccountMergeRedoFixture
    ) {
      throw new Error('account merge redo smoke fixture is not enabled')
    }
    return hooks.prepareAccountMergeRedoFixture()
  }

  if (request.method === 'Smoke.inspectAccountRestoreFixtureData') {
    if (
      process.env.KOUBROWSER_ACCOUNT_RESTORE_FIXTURE !== '1' ||
      !hooks.inspectAccountRestoreFixtureData
    ) {
      throw new Error('account restore smoke fixture is not enabled')
    }
    return hooks.inspectAccountRestoreFixtureData()
  }

  if (request.method === 'Smoke.getWindowState' || request.method === 'Smoke.showWindow') {
    const window = getMainWindow()
    if (!window || window.isDestroyed()) {
      throw new Error('The main window is not ready')
    }
    if (request.method === 'Smoke.showWindow') {
      window.show()
      window.focus()
    }
    return {
      visible: window.isVisible(),
      focused: window.isFocused(),
      minimized: window.isMinimized(),
      maximized: window.isMaximized(),
      bounds: window.getBounds(),
      normalBounds: window.getNormalBounds()
    }
  }

  const contents = targetWebContents(request.target, getMainWindow)
  if (request.method === 'Runtime.evaluate') {
    if (!isRecord(request.params) || typeof request.params.expression !== 'string') {
      throw new Error('Invalid Runtime.evaluate smoke request')
    }
    const value = await contents.executeJavaScript(request.params.expression, true)
    return {
      result: {
        value
      }
    }
  }

  if (request.method === 'Input.dispatchMouseEvent') {
    if (!isRecord(request.params)) {
      throw new Error('Invalid Input.dispatchMouseEvent smoke request')
    }
    const type =
      request.params.type === 'mousePressed'
        ? 'mouseDown'
        : request.params.type === 'mouseReleased'
          ? 'mouseUp'
          : undefined
    if (!type) {
      throw new Error('Unsupported smoke mouse event type')
    }
    contents.sendInputEvent({
      type,
      x: Math.round(numberParam(request.params, 'x')),
      y: Math.round(numberParam(request.params, 'y')),
      button: request.params.button === 'right' ? 'right' : 'left',
      clickCount:
        typeof request.params.clickCount === 'number'
          ? Math.max(1, Math.round(request.params.clickCount))
          : 1
    })
    return {}
  }

  if (request.method === 'Input.dispatchKeyEvent') {
    if (!isRecord(request.params)) {
      throw new Error('Invalid smoke key event')
    }
    const type =
      request.params.type === 'keyDown' || request.params.type === 'rawKeyDown'
        ? 'keyDown'
        : request.params.type === 'keyUp'
          ? 'keyUp'
          : undefined
    const keyCode = typeof request.params.key === 'string' ? request.params.key : undefined
    if (!type || !keyCode) {
      throw new Error('Unsupported smoke key event')
    }
    const modifierFlags =
      typeof request.params.modifiers === 'number' ? request.params.modifiers : 0
    const modifiers: Electron.InputEvent['modifiers'] = []
    if (modifierFlags & 1) modifiers.push('alt')
    if (modifierFlags & 2) modifiers.push('control')
    if (modifierFlags & 4) modifiers.push('meta')
    if (modifierFlags & 8) modifiers.push('shift')
    await contents.sendInputEvent({
      type,
      keyCode,
      modifiers
    })
    return {}
  }

  if (request.method === 'Page.captureScreenshot') {
    const image = await contents.capturePage()
    return {
      data: image.toPNG().toString('base64')
    }
  }

  throw new Error(`Unsupported smoke IPC method: ${request.method}`)
}

export function installSmokeIpc(
  getMainWindow: () => BrowserWindow | null,
  hooks: SmokeHooks = {}
): void {
  const token = process.env.KOUBROWSER_SMOKE_IPC_TOKEN
  if (process.env.KOUBROWSER_SMOKE_IPC !== '1' || !token || !process.send) {
    return
  }

  process.on('message', (message: unknown) => {
    if (!isSmokeRequest(message, token)) {
      return
    }
    handleSmokeRequest(message, getMainWindow, hooks)
      .then((result) => {
        const response: SmokeResponse = {
          source: SmokeMessageSource,
          token,
          id: message.id,
          result
        }
        process.send?.(response)
      })
      .catch((error: unknown) => {
        const response: SmokeResponse = {
          source: SmokeMessageSource,
          token,
          id: message.id,
          error: {
            message: error instanceof Error ? error.message : String(error)
          }
        }
        process.send?.(response)
      })
  })
}

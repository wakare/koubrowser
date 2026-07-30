import { computed, ref, toRaw } from 'vue'
import type { UpdateCheckResult, UpdateStateSnapshot, UpdateStateStatus } from '@common/type'
import { globalSetting, translateApp } from '@renderer/store/global_setting'
import { resolveUpdateViewText } from '@renderer/common/update-view'

const updateState = ref<UpdateStateStatus>('idle')
const updateAvailableVersion = ref('')
const updateErrorMessage = ref('')
const updateDownloadPercent = ref<number | null>(null)
const startupUpdateAvailableVersion = ref('')

let updateSyncInitialized = false

function applyUpdateState(state: UpdateStateSnapshot): void {
  updateState.value = state.status
  updateAvailableVersion.value = state.availableVersion
  updateErrorMessage.value = state.errorMessage
  updateDownloadPercent.value = state.downloadPercent
}

function applyUpdateResult(result: UpdateCheckResult): void {
  switch (result.status) {
    case 'available':
      applyUpdateState({
        status: 'available',
        availableVersion: result.version,
        errorMessage: '',
        downloadPercent: null,
      })
      break
    case 'not-available':
      applyUpdateState({
        status: 'latest',
        availableVersion: '',
        errorMessage: '',
        downloadPercent: null,
      })
      break
    case 'error':
      applyUpdateState({
        status: 'error',
        availableVersion: '',
        errorMessage: result.errorCode,
        downloadPercent: null,
      })
      break
  }
}

function applyStartupUpdateResult(result: UpdateCheckResult): void {
  if (result.status === 'available') {
    startupUpdateAvailableVersion.value = result.version
  }
  applyUpdateResult(result)
}

function ensureUpdateSyncInitialized(): void {
  if (updateSyncInitialized) {
    return
  }
  updateSyncInitialized = true

  if (window.api?.onUpdateStateChanged) {
    window.api.onUpdateStateChanged((state: UpdateStateSnapshot) => {
      applyUpdateState(state)
    })
  }
  if (window.api?.onStartupUpdateChecked) {
    window.api.onStartupUpdateChecked((result: UpdateCheckResult) => {
      applyStartupUpdateResult(result)
    })
  }
  if (window.api?.getUpdateState) {
    window.api.getUpdateState().then((state: UpdateStateSnapshot) => {
      applyUpdateState(state)
      if (state.status === 'available' && state.availableVersion) {
        startupUpdateAvailableVersion.value = state.availableVersion
      }
    }).catch((error) => {
      console.error('get update state failed', error)
    })
  }
}

ensureUpdateSyncInitialized()

export async function clickUpdateButton(): Promise<void> {
  ensureUpdateSyncInitialized()

  if (updateState.value === 'checking' || updateState.value === 'updating') {
    return
  }

  if (updateState.value === 'ready') {
    try {
      await window.api.restartAndInstallUpdate()
    } catch (error) {
      console.error('restart and install update failed', error)
      applyUpdateState({
        status: 'error',
        availableVersion: '',
        errorMessage: translateApp('update.error.restartFailed'),
        downloadPercent: null,
      })
    }
    return
  }

  if (updateState.value === 'available') {
    try {
      await window.api.downloadUpdate()
    } catch (error) {
      console.error('install update failed', error)
      applyUpdateState({
        status: 'error',
        availableVersion: '',
        errorMessage: translateApp('update.error.downloadFailed'),
        downloadPercent: null,
      })
    }
    return
  }

  await checkForUpdates()
}

export async function checkForUpdates(): Promise<void> {
  ensureUpdateSyncInitialized()

  if (updateState.value === 'checking' || updateState.value === 'updating') {
    return
  }

  try {
    const result: UpdateCheckResult = await window.api.checkForUpdates(toRaw(globalSetting))
    applyUpdateResult(result)
  } catch (error) {
    console.error('check update failed', error)
    applyUpdateState({
      status: 'error',
      availableVersion: '',
      errorMessage: translateApp('update.error.checkFailed'),
      downloadPercent: null,
    })
  }
}

const updateViewText = computed(() =>
  resolveUpdateViewText(
    {
      status: updateState.value,
      availableVersion: updateAvailableVersion.value,
      errorMessage: updateErrorMessage.value,
      downloadPercent: updateDownloadPercent.value
    },
    translateApp,
    globalSetting.locale
  )
)

export const updateButtonText = computed(() => updateViewText.value.buttonText)

export const updateButtonDisable = computed(() =>
  updateState.value === 'checking' || updateState.value === 'updating'
)

export const updateStateText = computed(() => updateViewText.value.stateText)
export const updateStateSubText = computed(() => updateViewText.value.stateSubText)
export const isUadeteIdle = computed(() => updateState.value === 'idle')
export const isUadeteChecking = computed(() => updateState.value === 'checking')
export const isUadeteAvailable = computed(() => updateState.value === 'available')
export const isUadeteDownloading = computed(() => updateState.value === 'updating')
export const isVersionLatest = computed(() => updateState.value === 'latest')
export const isUadeteReady = computed(() => updateState.value === 'ready')
export const isUadeteCheckError = computed(() => updateState.value === 'error')
export const hasStartupUpdateAvailable = computed(() => startupUpdateAvailableVersion.value !== '')
export const startupUpdateVersion = computed(() => startupUpdateAvailableVersion.value)

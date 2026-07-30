<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { svdata } from '@renderer/store/svdata'
import { ShipEtcs } from '@common/kcsetc'
import { Env } from '@common/env'
import {
  activeLocalizationLocale,
  globalSetting,
  translateApp
} from '@renderer/store/global_setting'
import { withPanelLoadTimeout } from '@renderer/common/panel-load'
import {
  clickUpdateButton,
  isUadeteAvailable,
  isUadeteCheckError,
  isUadeteChecking,
  isUadeteDownloading,
  isUadeteIdle,
  isUadeteReady,
  isVersionLatest,
  updateButtonDisable,
  updateButtonText,
  updateStateSubText,
  updateStateText
} from '@renderer/stuff/update'
import ClearCacheImage from '@renderer/assets/img/clear-cache.svg'
import CheckUpdateImage from '@renderer/assets/img/check-update.svg'
import VersionLatestImage from '@renderer/assets/img/version-latest.svg'
import DownloadUpdateImage from '@renderer/assets/img/download-update.svg'
import RestartImage from '@renderer/assets/img/restart.svg'
import UpdateCheckErrorImage from '@renderer/assets/img/update-check-error.svg'
import AppDevToolImage from '@renderer/assets/img/app-devtool.svg'
import ShowLicenseImage from '@renderer/assets/img/show-license.svg'
import OpenDataFolderImage from '@renderer/assets/img/titlebar/open-capture-folder.svg'
import { bundledLicenses } from '@renderer/generated/bundled-licenses'
import {
  normalizeTitlebarColor,
  type TitlebarColor
} from '@common/global_setting'
import {
  formatAppDateTime,
  type AppMessageKey
} from '@common/localization'
import type {
  AccountBackupMergeConflictGroup,
  AccountBackupMergeConflictSummary,
  EncryptedAccountTransferResult,
  LocalAccountAuditSummary,
  LocalAccountBackupInspectionResult,
  LocalAccountBackupResult,
  LocalAccountRedoAvailability,
  LocalAccountRollbackAvailability
} from '@common/account-backup'
import { DefaultAccountRestoreRetentionPolicy } from '@common/account-backup'

const version = ref('')
const clearState = ref<'noop' | 'in_clear' | 'cleared' | 'error'>('noop')
const dataFolderState = ref<'noop' | 'opening' | 'opened' | 'error'>('noop')
const accountBackupState = ref<
  'noop' | 'creating' | 'created' | 'cancelled' | 'error'
>('noop')
const accountBackupResult = ref<
  Extract<LocalAccountBackupResult, { status: 'created' }> | null
>(null)
const accountTransferPassphrase = ref('')
const accountTransferPassphraseConfirmation = ref('')
const accountTransferState = ref<
  'noop' | 'creating' | 'created' | 'cancelled' | 'error'
>('noop')
const accountTransferResult = ref<
  Extract<EncryptedAccountTransferResult, { status: 'created' }> | null
>(null)
const accountTransferImportPassphrase = ref('')
const accountBackupInspectionState = ref<
  | 'noop'
  | 'inspecting'
  | 'valid'
  | 'invalid'
  | 'invalid-transfer'
  | 'cancelled'
  | 'error'
>('noop')
const accountBackupInspectionResult = ref<
  Extract<LocalAccountBackupInspectionResult, { status: 'valid' }> | null
>(null)
const accountInspectionReportState = ref<
  'noop' | 'saving' | 'saved' | 'cancelled' | 'error'
>('noop')
const accountInspectionReportFileName = ref('')
const accountRestoreState = ref<
  'noop' | 'preparing' | 'cancelled' | 'scheduled' | 'error'
>('noop')
const accountRestoreBundleName = ref('')
const accountMergeState = ref<
  'noop' | 'preparing' | 'cancelled' | 'scheduled' | 'error'
>('noop')
const accountMergeBundleName = ref('')
const accountMergeRollbackAvailabilityState = ref<
  'idle' | 'loading' | 'none' | 'available' | 'error'
>('idle')
const accountMergeRollbackAvailability = ref<
  Extract<LocalAccountRollbackAvailability, { status: 'available' }> | null
>(null)
const accountMergeRollbackState = ref<
  'noop' | 'preparing' | 'cancelled' | 'scheduled' | 'error'
>('noop')
const accountMergeRollbackBundleName = ref('')
const accountMergeRedoAvailabilityState = ref<
  'idle' | 'loading' | 'none' | 'available' | 'error'
>('idle')
const accountMergeRedoAvailability = ref<
  Extract<LocalAccountRedoAvailability, { status: 'available' }> | null
>(null)
const accountMergeRedoState = ref<
  'noop' | 'preparing' | 'cancelled' | 'scheduled' | 'error'
>('noop')
const accountMergeRedoBundleName = ref('')
const accountRollbackAvailabilityState = ref<
  'idle' | 'loading' | 'none' | 'available' | 'error'
>('idle')
const accountRollbackAvailability = ref<
  Extract<LocalAccountRollbackAvailability, { status: 'available' }> | null
>(null)
const accountRollbackState = ref<
  'noop' | 'preparing' | 'cancelled' | 'scheduled' | 'error'
>('noop')
const accountRollbackBundleName = ref('')
const accountRedoAvailabilityState = ref<
  'idle' | 'loading' | 'none' | 'available' | 'error'
>('idle')
const accountRedoAvailability = ref<
  Extract<LocalAccountRedoAvailability, { status: 'available' }> | null
>(null)
const accountRedoState = ref<
  'noop' | 'preparing' | 'cancelled' | 'scheduled' | 'error'
>('noop')
const accountRedoBundleName = ref('')
const accountAuditState = ref<
  | 'noop'
  | 'capturing'
  | 'captured'
  | 'comparing'
  | 'match'
  | 'different'
  | 'none'
  | 'different-account'
  | 'error'
>('noop')
const accountAuditSummary = ref<LocalAccountAuditSummary | null>(null)
const accountAuditChangedDatabases = ref<string[]>([])
const accountAuditChangedProfiles = ref<string[]>([])
const isLicenseOverlayVisible = ref(false)

const AccountBackupConflictGroupMessageKeys = {
  identity: 'accountBackup.inspect.preview.conflictGroup.identity',
  timestamp: 'accountBackup.inspect.preview.conflictGroup.timestamp',
  provenance: 'accountBackup.inspect.preview.conflictGroup.provenance',
  display: 'accountBackup.inspect.preview.conflictGroup.display',
  snapshot: 'accountBackup.inspect.preview.conflictGroup.snapshot',
  location: 'accountBackup.inspect.preview.conflictGroup.location',
  context: 'accountBackup.inspect.preview.conflictGroup.context',
  input: 'accountBackup.inspect.preview.conflictGroup.input',
  result: 'accountBackup.inspect.preview.conflictGroup.result',
  fleet: 'accountBackup.inspect.preview.conflictGroup.fleet',
  'raw-response':
    'accountBackup.inspect.preview.conflictGroup.raw-response',
  reward: 'accountBackup.inspect.preview.conflictGroup.reward',
  'unknown-field':
    'accountBackup.inspect.preview.conflictGroup.unknown-field'
} as const satisfies Record<AccountBackupMergeConflictGroup, AppMessageKey>

function formatAccountBackupConflictReasons(
  reasons: readonly AccountBackupMergeConflictSummary[]
): string {
  return reasons.map(({ group, records }) =>
    `${translateApp(AccountBackupConflictGroupMessageKeys[group])}: ${records}`
  ).join(' / ')
}

let clearRequestId = 0
let dataFolderRequestId = 0
let accountBackupRequestId = 0
let accountTransferRequestId = 0
let accountBackupInspectionRequestId = 0
let accountInspectionReportRequestId = 0
let accountMergeRollbackRequestId = 0
let accountMergeRedoRequestId = 0
let accountRollbackRequestId = 0
let accountRedoRequestId = 0
let accountAuditRequestId = 0

window.api.getVersion().then((v: string) => {
  version.value = v
})

if (Env.isDevelopment) {
  if (svdata.isMstDataOk) {
    const msts = svdata.mstShips
    let ngCount = 0
    msts.forEach((el) => {
      if (el.api_sort_id) {
        const etc = ShipEtcs.find((etc) => etc.api_id === el.api_id)
        if (!etc) {
          console.debug('check etc data ng:', el.api_id, el.api_name)
          ngCount++
        }
      }
    })
    console.info('check etc data done. ng count:', ngCount)
  }
}

function openExternalUrl(ev: Event) {
  ev.preventDefault()
  const href = (ev.currentTarget as HTMLAnchorElement).href
  void window.api.openExternalUrl(href)
}

const appName = computed(() => translateApp('app.name'))
const appLogoAlt = computed(() =>
  translateApp('about.appLogoAlt', {
    params: { appName: appName.value }
  })
)
const versionTxt = computed(() =>
  version.value
    ? translateApp('about.version', {
        params: { version: version.value }
      })
    : ''
)

async function clearSessionCache(): Promise<void> {
  const requestId = ++clearRequestId
  clearState.value = 'in_clear'
  try {
    await withPanelLoadTimeout(
      window.api.clearSessionCache(),
      'Clear session cache request timed out'
    )
    if (requestId !== clearRequestId) {
      return
    }
    clearState.value = 'cleared'
  } catch (error) {
    if (requestId !== clearRequestId) {
      return
    }
    console.error('clear session cache failed', error)
    clearState.value = 'error'
  }
}

async function openDataFolder(): Promise<void> {
  const requestId = ++dataFolderRequestId
  dataFolderState.value = 'opening'
  try {
    await withPanelLoadTimeout(
      window.api.openDataFolder(),
      'Open data folder request timed out'
    )
    if (requestId !== dataFolderRequestId) {
      return
    }
    dataFolderState.value = 'opened'
  } catch (error) {
    if (requestId !== dataFolderRequestId) {
      return
    }
    console.error('open data folder failed', error)
    dataFolderState.value = 'error'
  }
}

async function createLocalAccountBackup(): Promise<void> {
  const requestId = ++accountBackupRequestId
  accountBackupState.value = 'creating'
  accountBackupResult.value = null
  try {
    const result = await window.api.createLocalAccountBackup()
    if (requestId !== accountBackupRequestId) {
      return
    }
    if (result.status === 'cancelled') {
      accountBackupState.value = 'cancelled'
      return
    }
    accountBackupResult.value = result
    accountBackupState.value = 'created'
  } catch {
    if (requestId !== accountBackupRequestId) {
      return
    }
    accountBackupState.value = 'error'
  }
}

async function createEncryptedAccountTransfer(): Promise<void> {
  if (!accountTransferPassphraseReady.value) {
    return
  }
  const requestId = ++accountTransferRequestId
  const passphrase = accountTransferPassphrase.value
  accountTransferState.value = 'creating'
  accountTransferResult.value = null
  try {
    const result = await window.api.createEncryptedAccountTransfer(passphrase)
    if (requestId !== accountTransferRequestId) {
      return
    }
    if (result.status === 'cancelled') {
      accountTransferState.value = 'cancelled'
      return
    }
    accountTransferResult.value = result
    accountTransferState.value = 'created'
  } catch {
    if (requestId !== accountTransferRequestId) {
      return
    }
    accountTransferState.value = 'error'
  } finally {
    if (requestId === accountTransferRequestId) {
      accountTransferPassphrase.value = ''
      accountTransferPassphraseConfirmation.value = ''
    }
  }
}

async function inspectLocalAccountBackup(): Promise<void> {
  const requestId = ++accountBackupInspectionRequestId
  accountBackupInspectionState.value = 'inspecting'
  accountBackupInspectionResult.value = null
  accountInspectionReportState.value = 'noop'
  accountInspectionReportFileName.value = ''
  accountMergeState.value = 'noop'
  accountMergeBundleName.value = ''
  accountRestoreState.value = 'noop'
  accountRestoreBundleName.value = ''
  try {
    const result = await window.api.inspectLocalAccountBackup()
    if (requestId !== accountBackupInspectionRequestId) {
      return
    }
    if (result.status === 'cancelled') {
      accountBackupInspectionState.value = 'cancelled'
      return
    }
    if (result.status === 'invalid') {
      accountBackupInspectionState.value = 'invalid'
      return
    }
    accountBackupInspectionResult.value = result
    accountBackupInspectionState.value = 'valid'
  } catch {
    if (requestId !== accountBackupInspectionRequestId) {
      return
    }
    accountBackupInspectionState.value = 'error'
  }
}

async function inspectEncryptedAccountTransfer(): Promise<void> {
  if (!accountTransferImportPassphraseReady.value) {
    return
  }
  const requestId = ++accountBackupInspectionRequestId
  const passphrase = accountTransferImportPassphrase.value
  accountBackupInspectionState.value = 'inspecting'
  accountBackupInspectionResult.value = null
  accountInspectionReportState.value = 'noop'
  accountInspectionReportFileName.value = ''
  accountMergeState.value = 'noop'
  accountMergeBundleName.value = ''
  accountRestoreState.value = 'noop'
  accountRestoreBundleName.value = ''
  try {
    const result = await window.api.inspectEncryptedAccountTransfer(
      passphrase
    )
    if (requestId !== accountBackupInspectionRequestId) {
      return
    }
    if (result.status === 'cancelled') {
      accountBackupInspectionState.value = 'cancelled'
      return
    }
    if (result.status === 'invalid') {
      accountBackupInspectionState.value = 'invalid-transfer'
      return
    }
    accountBackupInspectionResult.value = result
    accountBackupInspectionState.value = 'valid'
  } catch {
    if (requestId !== accountBackupInspectionRequestId) {
      return
    }
    accountBackupInspectionState.value = 'error'
  } finally {
    if (requestId === accountBackupInspectionRequestId) {
      accountTransferImportPassphrase.value = ''
    }
  }
}

async function saveAccountInspectionReport(): Promise<void> {
  const requestId = ++accountInspectionReportRequestId
  accountInspectionReportState.value = 'saving'
  accountInspectionReportFileName.value = ''
  try {
    const result = await window.api.saveAccountInspectionReport()
    if (requestId !== accountInspectionReportRequestId) {
      return
    }
    if (result.status === 'cancelled') {
      accountInspectionReportState.value = 'cancelled'
      return
    }
    accountInspectionReportFileName.value = result.fileName
    accountInspectionReportState.value = 'saved'
  } catch (error) {
    if (requestId !== accountInspectionReportRequestId) {
      return
    }
    console.error('save account inspection report failed', error)
    accountInspectionReportState.value = 'error'
  }
}

async function prepareLocalAccountMerge(): Promise<void> {
  accountMergeState.value = 'preparing'
  accountMergeBundleName.value = ''
  try {
    const result = await window.api.prepareLocalAccountMerge()
    if (result.status === 'cancelled') {
      accountMergeState.value = 'cancelled'
      return
    }
    accountMergeBundleName.value = result.bundleName
    accountMergeState.value = 'scheduled'
  } catch (error) {
    console.error('prepare local account merge failed', error)
    accountMergeState.value = 'error'
  }
}

async function prepareLocalAccountRestore(): Promise<void> {
  accountRestoreState.value = 'preparing'
  accountRestoreBundleName.value = ''
  try {
    const result = await window.api.prepareLocalAccountRestore()
    if (result.status === 'cancelled') {
      accountRestoreState.value = 'cancelled'
      return
    }
    accountRestoreBundleName.value = result.bundleName
    accountRestoreState.value = 'scheduled'
  } catch (error) {
    console.error('prepare local account restore failed', error)
    accountRestoreState.value = 'error'
  }
}

async function loadAvailableAccountMergeRollback(): Promise<void> {
  const requestId = ++accountMergeRollbackRequestId
  accountMergeRollbackAvailabilityState.value = 'loading'
  accountMergeRollbackAvailability.value = null
  accountMergeRollbackState.value = 'noop'
  accountMergeRollbackBundleName.value = ''
  try {
    const result = await window.api.getAvailableAccountMergeRollback()
    if (requestId !== accountMergeRollbackRequestId) {
      return
    }
    if (result.status === 'none') {
      accountMergeRollbackAvailabilityState.value = 'none'
      return
    }
    accountMergeRollbackAvailability.value = result
    accountMergeRollbackAvailabilityState.value = 'available'
  } catch (error) {
    if (requestId !== accountMergeRollbackRequestId) {
      return
    }
    console.error('load available account merge rollback failed', error)
    accountMergeRollbackAvailabilityState.value = 'error'
  }
}

async function prepareAccountMergeRollback(): Promise<void> {
  accountMergeRollbackState.value = 'preparing'
  accountMergeRollbackBundleName.value = ''
  try {
    const result = await window.api.prepareAccountMergeRollback()
    if (result.status === 'cancelled') {
      accountMergeRollbackState.value = 'cancelled'
      return
    }
    accountMergeRollbackBundleName.value = result.bundleName
    accountMergeRollbackState.value = 'scheduled'
  } catch (error) {
    console.error('prepare account merge rollback failed', error)
    accountMergeRollbackState.value = 'error'
  }
}

async function loadAvailableAccountMergeRedo(): Promise<void> {
  const requestId = ++accountMergeRedoRequestId
  accountMergeRedoAvailabilityState.value = 'loading'
  accountMergeRedoAvailability.value = null
  accountMergeRedoState.value = 'noop'
  accountMergeRedoBundleName.value = ''
  try {
    const result = await window.api.getAvailableAccountMergeRedo()
    if (requestId !== accountMergeRedoRequestId) {
      return
    }
    if (result.status === 'none') {
      accountMergeRedoAvailabilityState.value = 'none'
      return
    }
    accountMergeRedoAvailability.value = result
    accountMergeRedoAvailabilityState.value = 'available'
  } catch (error) {
    if (requestId !== accountMergeRedoRequestId) {
      return
    }
    console.error('load available account merge redo failed', error)
    accountMergeRedoAvailabilityState.value = 'error'
  }
}

async function prepareAccountMergeRedo(): Promise<void> {
  accountMergeRedoState.value = 'preparing'
  accountMergeRedoBundleName.value = ''
  try {
    const result = await window.api.prepareAccountMergeRedo()
    if (result.status === 'cancelled') {
      accountMergeRedoState.value = 'cancelled'
      return
    }
    accountMergeRedoBundleName.value = result.bundleName
    accountMergeRedoState.value = 'scheduled'
  } catch (error) {
    console.error('prepare account merge redo failed', error)
    accountMergeRedoState.value = 'error'
  }
}

async function loadAvailableAccountRollback(): Promise<void> {
  const requestId = ++accountRollbackRequestId
  accountRollbackAvailabilityState.value = 'loading'
  accountRollbackAvailability.value = null
  accountRollbackState.value = 'noop'
  accountRollbackBundleName.value = ''
  try {
    const result = await window.api.getAvailableAccountRollback()
    if (requestId !== accountRollbackRequestId) {
      return
    }
    if (result.status === 'none') {
      accountRollbackAvailabilityState.value = 'none'
      return
    }
    accountRollbackAvailability.value = result
    accountRollbackAvailabilityState.value = 'available'
  } catch (error) {
    if (requestId !== accountRollbackRequestId) {
      return
    }
    console.error('load available account rollback failed', error)
    accountRollbackAvailabilityState.value = 'error'
  }
}

async function prepareAccountRollback(): Promise<void> {
  accountRollbackState.value = 'preparing'
  accountRollbackBundleName.value = ''
  try {
    const result = await window.api.prepareAccountRollback()
    if (result.status === 'cancelled') {
      accountRollbackState.value = 'cancelled'
      return
    }
    accountRollbackBundleName.value = result.bundleName
    accountRollbackState.value = 'scheduled'
  } catch (error) {
    console.error('prepare account rollback failed', error)
    accountRollbackState.value = 'error'
  }
}

async function loadAvailableAccountRedo(): Promise<void> {
  const requestId = ++accountRedoRequestId
  accountRedoAvailabilityState.value = 'loading'
  accountRedoAvailability.value = null
  accountRedoState.value = 'noop'
  accountRedoBundleName.value = ''
  try {
    const result = await window.api.getAvailableAccountRedo()
    if (requestId !== accountRedoRequestId) {
      return
    }
    if (result.status === 'none') {
      accountRedoAvailabilityState.value = 'none'
      return
    }
    accountRedoAvailability.value = result
    accountRedoAvailabilityState.value = 'available'
  } catch (error) {
    if (requestId !== accountRedoRequestId) {
      return
    }
    console.error('load available account redo failed', error)
    accountRedoAvailabilityState.value = 'error'
  }
}

async function prepareAccountRedo(): Promise<void> {
  accountRedoState.value = 'preparing'
  accountRedoBundleName.value = ''
  try {
    const result = await window.api.prepareAccountRedo()
    if (result.status === 'cancelled') {
      accountRedoState.value = 'cancelled'
      return
    }
    accountRedoBundleName.value = result.bundleName
    accountRedoState.value = 'scheduled'
  } catch (error) {
    console.error('prepare account redo failed', error)
    accountRedoState.value = 'error'
  }
}

function resetAccountAuditResult(): void {
  accountAuditSummary.value = null
  accountAuditChangedDatabases.value = []
  accountAuditChangedProfiles.value = []
}

async function captureAccountAuditBaseline(): Promise<void> {
  const requestId = ++accountAuditRequestId
  accountAuditState.value = 'capturing'
  resetAccountAuditResult()
  try {
    const result = await window.api.captureAccountAuditBaseline()
    if (requestId !== accountAuditRequestId) {
      return
    }
    accountAuditSummary.value = result.summary
    accountAuditState.value = 'captured'
  } catch (error) {
    if (requestId !== accountAuditRequestId) {
      return
    }
    console.error('capture account audit baseline failed', error)
    accountAuditState.value = 'error'
  }
}

async function compareAccountAuditBaseline(): Promise<void> {
  const requestId = ++accountAuditRequestId
  accountAuditState.value = 'comparing'
  resetAccountAuditResult()
  try {
    const result = await window.api.compareAccountAuditBaseline()
    if (requestId !== accountAuditRequestId) {
      return
    }
    accountAuditState.value = result.status
    if (result.status === 'match' || result.status === 'different') {
      accountAuditSummary.value = result.summary
    }
    if (result.status === 'different') {
      accountAuditChangedDatabases.value = result.changedDatabases
      accountAuditChangedProfiles.value = result.changedProfiles
    }
    if (result.status === 'different-account') {
      accountAuditSummary.value = {
        capturedAt: result.capturedAt,
        databases: [],
        profileFiles: 0,
        records: 0
      }
    }
  } catch (error) {
    if (requestId !== accountAuditRequestId) {
      return
    }
    console.error('compare account audit baseline failed', error)
    accountAuditState.value = 'error'
  }
}

onMounted(async () => {
  await loadAvailableAccountMergeRollback()
  await loadAvailableAccountMergeRedo()
  await loadAvailableAccountRollback()
  await loadAvailableAccountRedo()
})

onUnmounted(() => {
  clearRequestId += 1
  dataFolderRequestId += 1
  accountBackupRequestId += 1
  accountTransferRequestId += 1
  accountBackupInspectionRequestId += 1
  accountInspectionReportRequestId += 1
  accountMergeRollbackRequestId += 1
  accountMergeRedoRequestId += 1
  accountRollbackRequestId += 1
  accountRedoRequestId += 1
  accountAuditRequestId += 1
})

function openKoubrowserDevTool(): void {
  window.api.devtool()
}

function openLicenseOverlay(): void {
  isLicenseOverlayVisible.value = true
}

function closeLicenseOverlay(): void {
  isLicenseOverlayVisible.value = false
}

const clearSessionCacheStateText = computed(() => {
  switch (clearState.value) {
    case 'noop':
      return ''
    case 'in_clear':
      return translateApp('cache.clearing')
    case 'cleared':
      return translateApp('cache.cleared')
    case 'error':
      return translateApp('cache.clearFailed')
  }
})

const clearCacheButtonDisable = computed(() => clearState.value === 'in_clear')
const titlebarColor = computed<TitlebarColor>({
  get: () => normalizeTitlebarColor(globalSetting.titlebarColor),
  set: (value) => {
    globalSetting.titlebarColor = normalizeTitlebarColor(value)
  }
})
const titlebarColorOptions = computed<
  readonly {
    readonly value: TitlebarColor
    readonly label: string
  }[]
>(() => [
  {
    value: 'green',
    label: translateApp('about.display.titlebarColor.green')
  },
  {
    value: 'navy',
    label: translateApp('about.display.titlebarColor.navy')
  },
  {
    value: 'graphite',
    label: translateApp('about.display.titlebarColor.graphite')
  },
  {
    value: 'brown',
    label: translateApp('about.display.titlebarColor.brown')
  }
])
const dataFolderStateText = computed(() => {
  switch (dataFolderState.value) {
    case 'noop':
      return ''
    case 'opening':
      return translateApp('dataFolder.opening')
    case 'opened':
      return translateApp('dataFolder.opened')
    case 'error':
      return translateApp('dataFolder.openFailed')
  }
})
const dataFolderButtonDisable = computed(() => dataFolderState.value === 'opening')
const accountBackupStateText = computed(() => {
  switch (accountBackupState.value) {
    case 'noop':
      return ''
    case 'creating':
      return translateApp('accountBackup.creating')
    case 'created': {
      const result = accountBackupResult.value
      return result
        ? translateApp('accountBackup.created', {
            params: {
              bundleName: result.bundleName,
              databaseFiles: result.databaseFiles,
              profileFiles: result.profileFiles,
              records: result.records
            }
          })
        : ''
    }
    case 'cancelled':
      return translateApp('accountBackup.cancelled')
    case 'error':
      return translateApp('accountBackup.failed')
  }
})
const accountTransferPassphrasesMatch = computed(
  () =>
    accountTransferPassphrase.value ===
    accountTransferPassphraseConfirmation.value
)
const accountTransferPassphraseReady = computed(
  () =>
    [...accountTransferPassphrase.value.normalize('NFC')].length >= 12 &&
    new TextEncoder().encode(
      accountTransferPassphrase.value.normalize('NFC')
    ).byteLength <= 1024 &&
    accountTransferPassphrasesMatch.value
)
const accountTransferStateText = computed(() => {
  switch (accountTransferState.value) {
    case 'noop':
      return ''
    case 'creating':
      return translateApp('accountBackup.transfer.creating')
    case 'created': {
      const result = accountTransferResult.value
      return result
        ? translateApp('accountBackup.transfer.created', {
            params: {
              fileName: result.fileName,
              records: result.records
            }
          })
        : ''
    }
    case 'cancelled':
      return translateApp('accountBackup.transfer.cancelled')
    case 'error':
      return translateApp('accountBackup.transfer.failed')
  }
})
const accountBackupButtonDisable = computed(
  () =>
    accountBackupState.value === 'creating' ||
    accountTransferState.value === 'creating' ||
    accountBackupInspectionState.value === 'inspecting' ||
    accountInspectionReportState.value === 'saving' ||
    accountMergeState.value === 'preparing' ||
    accountMergeRollbackState.value === 'preparing' ||
    accountMergeRedoState.value === 'preparing' ||
    accountRestoreState.value === 'preparing' ||
    accountRollbackState.value === 'preparing' ||
    accountRedoState.value === 'preparing' ||
    accountAuditState.value === 'capturing' ||
    accountAuditState.value === 'comparing'
)
const accountTransferButtonDisable = computed(
  () =>
    accountBackupButtonDisable.value ||
    !accountTransferPassphraseReady.value
)
const accountTransferImportPassphraseReady = computed(
  () =>
    [...accountTransferImportPassphrase.value.normalize('NFC')].length >= 12 &&
    new TextEncoder().encode(
      accountTransferImportPassphrase.value.normalize('NFC')
    ).byteLength <= 1024
)
const accountTransferImportButtonDisable = computed(
  () =>
    accountBackupButtonDisable.value ||
    !accountTransferImportPassphraseReady.value
)
const accountRollbackCheckButtonDisable = computed(
  () =>
    accountBackupButtonDisable.value ||
    accountMergeRollbackAvailabilityState.value === 'loading' ||
    accountMergeRedoAvailabilityState.value === 'loading' ||
    accountRollbackAvailabilityState.value === 'loading' ||
    accountRedoAvailabilityState.value === 'loading'
)
const accountRedoCheckButtonDisable = accountRollbackCheckButtonDisable
const accountBackupInspectionStateText = computed(() => {
  switch (accountBackupInspectionState.value) {
    case 'noop':
      return ''
    case 'inspecting':
      return translateApp('accountBackup.inspect.inspecting')
    case 'valid': {
      const result = accountBackupInspectionResult.value
      return result
        ? translateApp('accountBackup.inspect.valid', {
            params: {
              bundleName: result.bundleName,
              createdAt: formatAppDateTime(
                new Date(result.createdAt),
                activeLocalizationLocale(),
                { dateStyle: 'medium', timeStyle: 'medium' }
              ),
              appVersion: result.appVersion,
              databaseFiles: result.databaseFiles,
              profileFiles: result.profileFiles,
              records: result.records
            }
          })
        : ''
    }
    case 'invalid':
      return translateApp('accountBackup.inspect.invalid')
    case 'invalid-transfer':
      return translateApp('accountBackup.transfer.invalid')
    case 'cancelled':
      return translateApp('accountBackup.inspect.cancelled')
    case 'error':
      return translateApp('accountBackup.inspect.failed')
  }
})
const accountBackupInspectionMatchText = computed(() => {
  const result = accountBackupInspectionResult.value
  if (!result || accountBackupInspectionState.value !== 'valid') {
    return ''
  }
  return translateApp(`accountBackup.inspect.match.${result.accountMatch}`)
})
const accountInspectionReportStateText = computed(() => {
  switch (accountInspectionReportState.value) {
    case 'noop':
      return ''
    case 'saving':
      return translateApp('accountBackup.inspect.report.saving')
    case 'saved':
      return translateApp('accountBackup.inspect.report.saved', {
        params: {
          fileName: accountInspectionReportFileName.value
        }
      })
    case 'cancelled':
      return translateApp('accountBackup.inspect.report.cancelled')
    case 'error':
      return translateApp('accountBackup.inspect.report.failed')
  }
})
const accountMergeSafeAddTotal = computed(() =>
  accountBackupInspectionResult.value?.databases.reduce(
    (total, database) => total + database.mergePlan.safeAdd,
    0
  ) ?? 0
)
const accountMergeButtonDisable = computed(
  () =>
    accountBackupButtonDisable.value ||
    accountBackupInspectionResult.value?.accountMatch !== 'same' ||
    accountMergeSafeAddTotal.value === 0
)
const accountMergeStateText = computed(() => {
  switch (accountMergeState.value) {
    case 'scheduled':
      return translateApp('accountBackup.merge.scheduled', {
        params: {
          bundleName: accountMergeBundleName.value
        }
      })
    case 'error':
      return translateApp('accountBackup.merge.failed')
    default:
      return ''
  }
})
const accountRestoreStateText = computed(() => {
  switch (accountRestoreState.value) {
    case 'scheduled':
      return translateApp('accountBackup.restore.scheduled', {
        params: {
          bundleName: accountRestoreBundleName.value
        }
      })
    case 'error':
      return translateApp('accountBackup.restore.failed')
    default:
      return ''
  }
})
const accountMergeRollbackAvailabilityText = computed(() => {
  switch (accountMergeRollbackAvailabilityState.value) {
    case 'idle':
      return ''
    case 'loading':
      return translateApp('accountBackup.mergeRollback.loading')
    case 'none':
      return translateApp('accountBackup.mergeRollback.none')
    case 'available': {
      const rollback = accountMergeRollbackAvailability.value
      return rollback
        ? translateApp('accountBackup.mergeRollback.available', {
            params: {
              bundleName: rollback.bundleName,
              createdAt: formatAppDateTime(
                new Date(rollback.createdAt),
                activeLocalizationLocale(),
                { dateStyle: 'medium', timeStyle: 'medium' }
              )
            }
          })
        : ''
    }
    case 'error':
      return translateApp('accountBackup.mergeRollback.checkFailed')
  }
})
const accountMergeRollbackStateText = computed(() => {
  switch (accountMergeRollbackState.value) {
    case 'scheduled':
      return translateApp('accountBackup.mergeRollback.scheduled', {
        params: {
          bundleName: accountMergeRollbackBundleName.value
        }
      })
    case 'error':
      return translateApp('accountBackup.mergeRollback.failed')
    default:
      return ''
  }
})
const accountMergeRedoAvailabilityText = computed(() => {
  switch (accountMergeRedoAvailabilityState.value) {
    case 'idle':
      return ''
    case 'loading':
      return translateApp('accountBackup.mergeRedo.loading')
    case 'none':
      return translateApp('accountBackup.mergeRedo.none')
    case 'available': {
      const redo = accountMergeRedoAvailability.value
      return redo
        ? translateApp('accountBackup.mergeRedo.available', {
            params: {
              bundleName: redo.bundleName,
              createdAt: formatAppDateTime(
                new Date(redo.createdAt),
                activeLocalizationLocale(),
                { dateStyle: 'medium', timeStyle: 'medium' }
              )
            }
          })
        : ''
    }
    case 'error':
      return translateApp('accountBackup.mergeRedo.checkFailed')
  }
})
const accountMergeRedoStateText = computed(() => {
  switch (accountMergeRedoState.value) {
    case 'scheduled':
      return translateApp('accountBackup.mergeRedo.scheduled', {
        params: {
          bundleName: accountMergeRedoBundleName.value
        }
      })
    case 'error':
      return translateApp('accountBackup.mergeRedo.failed')
    default:
      return ''
  }
})
const accountRollbackAvailabilityText = computed(() => {
  switch (accountRollbackAvailabilityState.value) {
    case 'idle':
      return ''
    case 'loading':
      return translateApp('accountBackup.rollback.loading')
    case 'none':
      return translateApp('accountBackup.rollback.none')
    case 'available': {
      const rollback = accountRollbackAvailability.value
      return rollback
        ? translateApp('accountBackup.rollback.available', {
            params: {
              bundleName: rollback.bundleName,
              createdAt: formatAppDateTime(
                new Date(rollback.createdAt),
                activeLocalizationLocale(),
                { dateStyle: 'medium', timeStyle: 'medium' }
              )
            }
          })
        : ''
    }
    case 'error':
      return translateApp('accountBackup.rollback.checkFailed')
  }
})
const accountRollbackStateText = computed(() => {
  switch (accountRollbackState.value) {
    case 'scheduled':
      return translateApp('accountBackup.rollback.scheduled', {
        params: {
          bundleName: accountRollbackBundleName.value
        }
      })
    case 'error':
      return translateApp('accountBackup.rollback.failed')
    default:
      return ''
  }
})
const accountRedoAvailabilityText = computed(() => {
  switch (accountRedoAvailabilityState.value) {
    case 'idle':
      return ''
    case 'loading':
      return translateApp('accountBackup.redo.loading')
    case 'none':
      return translateApp('accountBackup.redo.none')
    case 'available': {
      const redo = accountRedoAvailability.value
      return redo
        ? translateApp('accountBackup.redo.available', {
            params: {
              bundleName: redo.bundleName,
              createdAt: formatAppDateTime(
                new Date(redo.createdAt),
                activeLocalizationLocale(),
                { dateStyle: 'medium', timeStyle: 'medium' }
              )
            }
          })
        : ''
    }
    case 'error':
      return translateApp('accountBackup.redo.checkFailed')
  }
})
const accountRedoStateText = computed(() => {
  switch (accountRedoState.value) {
    case 'scheduled':
      return translateApp('accountBackup.redo.scheduled', {
        params: {
          bundleName: accountRedoBundleName.value
        }
      })
    case 'error':
      return translateApp('accountBackup.redo.failed')
    default:
      return ''
  }
})
function formatAccountAuditDate(value: string): string {
  return formatAppDateTime(
    new Date(value),
    activeLocalizationLocale(),
    { dateStyle: 'medium', timeStyle: 'medium' }
  )
}
const accountAuditStateText = computed(() => {
  const summary = accountAuditSummary.value
  switch (accountAuditState.value) {
    case 'noop':
      return ''
    case 'capturing':
      return translateApp('accountBackup.audit.capturing')
    case 'comparing':
      return translateApp('accountBackup.audit.comparing')
    case 'captured':
      return summary
        ? translateApp('accountBackup.audit.captured', {
            params: {
              capturedAt: formatAccountAuditDate(summary.capturedAt),
              databaseFiles: summary.databases.length,
              profileFiles: summary.profileFiles,
              records: summary.records
            }
          })
        : ''
    case 'match':
      return summary
        ? translateApp('accountBackup.audit.match', {
            params: {
              capturedAt: formatAccountAuditDate(summary.capturedAt),
              databaseFiles: summary.databases.length,
              profileFiles: summary.profileFiles,
              records: summary.records
            }
          })
        : ''
    case 'different':
      return translateApp('accountBackup.audit.different', {
        params: {
          databases:
            accountAuditChangedDatabases.value.join(', ') ||
            translateApp('accountBackup.audit.noChanges'),
          profiles:
            accountAuditChangedProfiles.value.join(', ') ||
            translateApp('accountBackup.audit.noChanges')
        }
      })
    case 'none':
      return translateApp('accountBackup.audit.none')
    case 'different-account':
      return summary
        ? translateApp('accountBackup.audit.differentAccount', {
            params: {
              capturedAt: formatAccountAuditDate(summary.capturedAt)
            }
          })
        : ''
    case 'error':
      return translateApp('accountBackup.audit.failed')
  }
})
const appUrl = 'https://koubrowser.app'
const kanlogUrl = 'https://kanlog.info'
const kanlogBrand = '艦ログ'
const gameBrand = '艦これ'
const kanlogDescription = computed(() =>
  translateApp('about.intake.siteDescription', {
    params: {
      brand: kanlogBrand,
      gameName: gameBrand
    }
  })
)
const kanlogLogoAlt = computed(() =>
  translateApp('about.intake.siteLogoAlt', {
    params: { brand: kanlogBrand }
  })
)
const recordSyncWarning = computed(() =>
  translateApp('about.records.syncWarning', {
    params: { appName: appName.value }
  })
)
const accountRestoreRetentionText = computed(() =>
  translateApp('accountBackup.retention', {
    params: {
      days: DefaultAccountRestoreRetentionPolicy.maxAgeDays,
      generations:
        DefaultAccountRestoreRetentionPolicy.maxGenerationsPerAccount,
      capacityGiB:
        DefaultAccountRestoreRetentionPolicy.maxTotalBytes /
        (1024 * 1024 * 1024)
    }
  })
)
const developerDescription = computed(() =>
  translateApp('about.developer.description', {
    params: { appName: appName.value }
  })
)
const developerButtonText = computed(() =>
  translateApp('about.developer.button', {
    params: { appName: appName.value }
  })
)
</script>

<template>
  <section class="about-root hero is-dark is-fullheight">
    <div class="hero-body">
      <div class="container about-container">
        <img class="app-img" src="../assets/img/app/app.png" :alt="appLogoAlt" />
        <h2 class="subtitle">{{ translateApp('about.tagline') }}</h2>
        <h1 class="title">
          {{ appName }}<span class="version">{{ versionTxt }}</span>
        </h1>
        <p>{{ translateApp('about.rights') }}</p>
        <p class="about-lead">
          {{ translateApp('about.distributionPage') }}<a
            class="has-text-success"
            rel="noreferrer"
            @click="openExternalUrl"
            target="_blank"
            :href="appUrl"
            >{{ appUrl }}</a
          >
        </p>
        <div class="about-sections">
          <section
            class="about-block update-check-block"
            :class="{ 'is-update-available-block': isUadeteAvailable || isUadeteReady }"
          >
            <h3 class="about-heading">{{ translateApp('update.heading') }}</h3>
            <p>
              <label>
                <input v-model="globalSetting.checkUpdateOnStartup" type="checkbox" />
                {{ translateApp('update.onStartup') }}
              </label>
            </p>
            <p>
              <label>
                <input v-model="globalSetting.checkBetaUpdate" type="checkbox" />
                {{ translateApp('update.includeBeta') }}
              </label>
            </p>
            <p>
              <label class="button-in-about">
                <button @click="clickUpdateButton()" class="button" :disabled="updateButtonDisable">
                  <CheckUpdateImage v-if="isUadeteIdle" />
                  <CheckUpdateImage v-if="isUadeteChecking" />
                  <DownloadUpdateImage v-if="isUadeteAvailable" />
                  <DownloadUpdateImage v-if="isUadeteDownloading" />
                  <CheckUpdateImage v-if="isVersionLatest" />
                  <RestartImage v-if="isUadeteReady" />
                  <UpdateCheckErrorImage v-if="isUadeteCheckError" />
                  {{ updateButtonText }}
                </button>
              </label>
            </p>
            <p v-if="updateStateText.length > 0" class="update-state-text">
              <span
                class="update-state-line"
                :class="{
                  'is-update-available': isUadeteAvailable || isUadeteReady,
                  'is-update-error': isUadeteCheckError,
                }"
              >
                <VersionLatestImage v-if="isVersionLatest" class="update-state-icon" />
                <span>{{ updateStateText }}</span>
              </span>
            </p>
            <p v-if="updateStateSubText" class="is-update-available">{{ updateStateSubText }}</p>
          </section>

          <section class="about-block">
            <h3 class="about-heading">{{ translateApp('about.cache.heading') }}</h3>
            <p>{{ translateApp('about.cache.description') }}</p>
            <p>
              <label class="button-in-about">
                <button
                  @click="clearSessionCache()"
                  class="button"
                  :disabled="clearCacheButtonDisable"
                >
                  <ClearCacheImage />{{ translateApp('cache.clear') }}
                </button>
              </label>
            </p>
            <p class="about-note">{{ clearSessionCacheStateText }}</p>
          </section>

          <section class="about-block">
            <h3 class="about-heading">{{ translateApp('about.display.heading') }}</h3>
            <p class="titlebar-color-setting">
              <label for="titlebar-color">{{
                translateApp('about.display.titlebarColor')
              }}</label>
              <select
                id="titlebar-color"
                v-model="titlebarColor"
                class="titlebar-color-select"
              >
                <option
                  v-for="option in titlebarColorOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </p>
            <p class="about-note">{{ translateApp('about.display.taihaWarning') }}</p>
          </section>

          <section class="about-block">
            <h3 class="about-heading">{{ translateApp('about.records.heading') }}</h3>
            <p>{{ translateApp('about.records.description') }}</p>
            <p>
              <label class="button-in-about">
                <button
                  @click="openDataFolder()"
                  class="button about-data-folder-button"
                  :disabled="dataFolderButtonDisable"
                >
                  <OpenDataFolderImage />{{ translateApp('dataFolder.open') }}
                </button>
              </label>
            </p>
            <p class="about-note">{{ recordSyncWarning }}</p>
            <p class="about-note">{{ dataFolderStateText }}</p>
            <div class="account-backup-control">
              <h4 class="account-backup-heading">
                {{ translateApp('accountBackup.heading') }}
              </h4>
              <p>{{ translateApp('accountBackup.description') }}</p>
              <p class="about-note account-backup-warning">
                {{ translateApp('accountBackup.warning') }}
              </p>
              <p>
                <label class="button-in-about">
                  <button
                    @click="createLocalAccountBackup()"
                    class="button account-backup-button"
                    :disabled="accountBackupButtonDisable"
                  >
                    <OpenDataFolderImage />{{ translateApp('accountBackup.button') }}
                  </button>
                </label>
              </p>
              <p class="about-note account-backup-state">
                {{ accountBackupStateText }}
              </p>
              <div class="account-transfer-control">
                <h5 class="account-backup-heading">
                  {{ translateApp('accountBackup.transfer.heading') }}
                </h5>
                <p>{{ translateApp('accountBackup.transfer.description') }}</p>
                <p class="about-note account-transfer-warning">
                  {{ translateApp('accountBackup.transfer.warning') }}
                </p>
                <div class="account-transfer-passphrases">
                  <label>
                    <span>{{
                      translateApp('accountBackup.transfer.passphrase')
                    }}</span>
                    <input
                      v-model="accountTransferPassphrase"
                      class="input account-transfer-passphrase"
                      type="password"
                      autocomplete="new-password"
                      autocapitalize="off"
                      spellcheck="false"
                      :disabled="accountBackupButtonDisable"
                      :aria-label="
                        translateApp('accountBackup.transfer.passphrase')
                      "
                    />
                  </label>
                  <label>
                    <span>{{
                      translateApp(
                        'accountBackup.transfer.confirmPassphrase'
                      )
                    }}</span>
                    <input
                      v-model="accountTransferPassphraseConfirmation"
                      class="input account-transfer-passphrase-confirmation"
                      type="password"
                      autocomplete="new-password"
                      autocapitalize="off"
                      spellcheck="false"
                      :disabled="accountBackupButtonDisable"
                      :aria-label="
                        translateApp(
                          'accountBackup.transfer.confirmPassphrase'
                        )
                      "
                    />
                  </label>
                </div>
                <p class="about-note account-transfer-passphrase-hint">
                  {{
                    translateApp('accountBackup.transfer.passphraseHint')
                  }}
                </p>
                <p
                  v-if="
                    accountTransferPassphraseConfirmation.length > 0 &&
                    !accountTransferPassphrasesMatch
                  "
                  class="about-note account-transfer-passphrase-mismatch"
                  role="alert"
                >
                  {{ translateApp('accountBackup.transfer.mismatch') }}
                </p>
                <p>
                  <label class="button-in-about">
                    <button
                      @click="createEncryptedAccountTransfer()"
                      class="button account-transfer-button"
                      :disabled="accountTransferButtonDisable"
                    >
                      <OpenDataFolderImage />{{
                        translateApp('accountBackup.transfer.button')
                      }}
                    </button>
                  </label>
                </p>
                <p class="about-note account-transfer-state" aria-live="polite">
                  {{ accountTransferStateText }}
                </p>
                <h5 class="account-backup-heading account-transfer-import-heading">
                  {{ translateApp('accountBackup.transfer.importHeading') }}
                </h5>
                <p>
                  {{ translateApp('accountBackup.transfer.importDescription') }}
                </p>
                <div class="account-transfer-import-passphrase">
                  <label>
                    <span>{{
                      translateApp('accountBackup.transfer.importPassphrase')
                    }}</span>
                    <input
                      v-model="accountTransferImportPassphrase"
                      class="input account-transfer-import-passphrase-input"
                      type="password"
                      autocomplete="current-password"
                      autocapitalize="off"
                      spellcheck="false"
                      :disabled="accountBackupButtonDisable"
                      :aria-label="
                        translateApp(
                          'accountBackup.transfer.importPassphrase'
                        )
                      "
                    />
                  </label>
                </div>
                <p>
                  <label class="button-in-about">
                    <button
                      @click="inspectEncryptedAccountTransfer()"
                      class="button account-transfer-inspect-button"
                      :disabled="accountTransferImportButtonDisable"
                    >
                      <OpenDataFolderImage />{{
                        translateApp('accountBackup.transfer.importButton')
                      }}
                    </button>
                  </label>
                </p>
              </div>
              <p>{{ translateApp('accountBackup.inspect.description') }}</p>
              <p>
                <label class="button-in-about">
                  <button
                    @click="inspectLocalAccountBackup()"
                    class="button account-backup-inspect-button"
                    :disabled="accountBackupButtonDisable"
                  >
                    <OpenDataFolderImage />{{
                      translateApp('accountBackup.inspect.button')
                    }}
                  </button>
                </label>
              </p>
              <p class="about-note account-backup-inspection-state">
                {{ accountBackupInspectionStateText }}
              </p>
              <p class="about-note account-backup-inspection-match">
                {{ accountBackupInspectionMatchText }}
              </p>
              <div
                v-if="
                  accountBackupInspectionResult?.accountMatch === 'same' &&
                  accountBackupInspectionResult.databases.length > 0
                "
                class="account-backup-preview"
              >
                <p class="about-note account-backup-preview-description">
                  {{ translateApp('accountBackup.inspect.preview.description') }}
                </p>
                <p class="about-note account-inspection-report-description">
                  {{ translateApp('accountBackup.inspect.report.description') }}
                </p>
                <p>
                  <label class="button-in-about">
                    <button
                      @click="saveAccountInspectionReport()"
                      class="button account-inspection-report-button"
                      :disabled="accountBackupButtonDisable"
                    >
                      <OpenDataFolderImage />{{
                        translateApp('accountBackup.inspect.report.button')
                      }}
                    </button>
                  </label>
                </p>
                <p class="about-note account-inspection-report-state">
                  {{ accountInspectionReportStateText }}
                </p>
                <div class="account-backup-preview-scroll">
                  <table class="account-backup-preview-table">
                    <thead>
                      <tr>
                        <th>
                          {{ translateApp('accountBackup.inspect.preview.database') }}
                        </th>
                        <th>
                          {{ translateApp('accountBackup.inspect.preview.incoming') }}
                        </th>
                        <th>
                          {{ translateApp('accountBackup.inspect.preview.add') }}
                        </th>
                        <th>
                          {{
                            translateApp(
                              'accountBackup.inspect.preview.safeAdd'
                            )
                          }}
                        </th>
                        <th>
                          {{ translateApp('accountBackup.inspect.preview.duplicate') }}
                        </th>
                        <th>
                          {{
                            translateApp(
                              'accountBackup.inspect.preview.legacyDuplicate'
                            )
                          }}
                        </th>
                        <th>
                          {{ translateApp('accountBackup.inspect.preview.conflict') }}
                        </th>
                        <th>
                          {{
                            translateApp(
                              'accountBackup.inspect.preview.manualReview'
                            )
                          }}
                        </th>
                        <th>
                          {{
                            translateApp(
                              'accountBackup.inspect.preview.currentOnly'
                            )
                          }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="database in accountBackupInspectionResult.databases"
                        :key="database.dbName"
                      >
                        <td>{{ database.dbName }}</td>
                        <td>{{ database.incomingRecords }}</td>
                        <td>{{ database.add }}</td>
                        <td>{{ database.mergePlan.safeAdd }}</td>
                        <td>{{ database.duplicate }}</td>
                        <td>{{ database.legacyDuplicate }}</td>
                        <td>
                          <span>{{ database.conflict }}</span>
                          <small
                            v-if="database.mergePlan.conflictReasons.length > 0"
                            class="account-backup-conflict-reasons"
                          >
                            {{
                              formatAccountBackupConflictReasons(
                                database.mergePlan.conflictReasons
                              )
                            }}
                          </small>
                        </td>
                        <td>{{ database.mergePlan.manualReview }}</td>
                        <td>{{ database.currentOnly }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p class="about-note account-backup-merge-description">
                  {{ translateApp('accountBackup.merge.description') }}
                </p>
                <p
                  v-if="accountMergeSafeAddTotal === 0"
                  class="about-note account-backup-merge-empty"
                >
                  {{ translateApp('accountBackup.merge.noSafeAdd') }}
                </p>
                <p>
                  <label class="button-in-about">
                    <button
                      @click="prepareLocalAccountMerge()"
                      class="button is-primary account-backup-merge-button"
                      :disabled="accountMergeButtonDisable"
                    >
                      <RestartImage />{{
                        translateApp('accountBackup.merge.button')
                      }}
                    </button>
                  </label>
                </p>
                <p class="about-note account-backup-merge-state">
                  {{ accountMergeStateText }}
                </p>
                <p>
                  <label class="button-in-about">
                    <button
                      @click="prepareLocalAccountRestore()"
                      class="button is-danger account-backup-restore-button"
                      :disabled="accountBackupButtonDisable"
                    >
                      {{
                        translateApp('accountBackup.restore.confirmButton')
                      }}
                    </button>
                  </label>
                </p>
                <p class="about-note account-backup-restore-state">
                  {{ accountRestoreStateText }}
                </p>
              </div>
              <div class="account-backup-merge-rollback">
                <p>
                  <label class="button-in-about">
                    <button
                      @click="loadAvailableAccountMergeRollback()"
                      class="button account-backup-merge-rollback-check-button"
                      :disabled="accountRollbackCheckButtonDisable"
                    >
                      {{
                        translateApp(
                          'accountBackup.mergeRollback.checkButton'
                        )
                      }}
                    </button>
                  </label>
                </p>
                <p
                  class="about-note account-backup-merge-rollback-availability"
                >
                  {{ accountMergeRollbackAvailabilityText }}
                </p>
                <p
                  v-if="
                    accountMergeRollbackAvailabilityState === 'available'
                  "
                >
                  <label class="button-in-about">
                    <button
                      @click="prepareAccountMergeRollback()"
                      class="button is-danger account-backup-merge-rollback-button"
                      :disabled="accountBackupButtonDisable"
                    >
                      {{
                        translateApp('accountBackup.mergeRollback.button')
                      }}
                    </button>
                  </label>
                </p>
                <p class="about-note account-backup-merge-rollback-state">
                  {{ accountMergeRollbackStateText }}
                </p>
              </div>
              <div class="account-backup-merge-redo">
                <p>
                  <label class="button-in-about">
                    <button
                      @click="loadAvailableAccountMergeRedo()"
                      class="button account-backup-merge-redo-check-button"
                      :disabled="accountRedoCheckButtonDisable"
                    >
                      {{
                        translateApp('accountBackup.mergeRedo.checkButton')
                      }}
                    </button>
                  </label>
                </p>
                <p
                  class="about-note account-backup-merge-redo-availability"
                >
                  {{ accountMergeRedoAvailabilityText }}
                </p>
                <p
                  v-if="accountMergeRedoAvailabilityState === 'available'"
                >
                  <label class="button-in-about">
                    <button
                      @click="prepareAccountMergeRedo()"
                      class="button is-danger account-backup-merge-redo-button"
                      :disabled="accountBackupButtonDisable"
                    >
                      {{ translateApp('accountBackup.mergeRedo.button') }}
                    </button>
                  </label>
                </p>
                <p class="about-note account-backup-merge-redo-state">
                  {{ accountMergeRedoStateText }}
                </p>
              </div>
              <div class="account-backup-rollback">
                <p class="about-note account-backup-retention-policy">
                  {{ accountRestoreRetentionText }}
                </p>
                <p>
                  <label class="button-in-about">
                    <button
                      @click="loadAvailableAccountRollback()"
                      class="button account-backup-rollback-check-button"
                      :disabled="accountRollbackCheckButtonDisable"
                    >
                      {{ translateApp('accountBackup.rollback.checkButton') }}
                    </button>
                  </label>
                </p>
                <p class="about-note account-backup-rollback-availability">
                  {{ accountRollbackAvailabilityText }}
                </p>
                <p v-if="accountRollbackAvailabilityState === 'available'">
                  <label class="button-in-about">
                    <button
                      @click="prepareAccountRollback()"
                      class="button is-danger account-backup-rollback-button"
                      :disabled="accountBackupButtonDisable"
                    >
                      {{ translateApp('accountBackup.rollback.button') }}
                    </button>
                  </label>
                </p>
                <p class="about-note account-backup-rollback-state">
                  {{ accountRollbackStateText }}
                </p>
              </div>
              <div class="account-backup-redo">
                <p>
                  <label class="button-in-about">
                    <button
                      @click="loadAvailableAccountRedo()"
                      class="button account-backup-redo-check-button"
                      :disabled="accountRedoCheckButtonDisable"
                    >
                      {{ translateApp('accountBackup.redo.checkButton') }}
                    </button>
                  </label>
                </p>
                <p class="about-note account-backup-redo-availability">
                  {{ accountRedoAvailabilityText }}
                </p>
                <p v-if="accountRedoAvailabilityState === 'available'">
                  <label class="button-in-about">
                    <button
                      @click="prepareAccountRedo()"
                      class="button is-danger account-backup-redo-button"
                      :disabled="accountBackupButtonDisable"
                    >
                      {{ translateApp('accountBackup.redo.button') }}
                    </button>
                  </label>
                </p>
                <p class="about-note account-backup-redo-state">
                  {{ accountRedoStateText }}
                </p>
              </div>
              <div class="account-backup-audit">
                <h5 class="account-backup-heading">
                  {{ translateApp('accountBackup.audit.heading') }}
                </h5>
                <p>{{ translateApp('accountBackup.audit.description') }}</p>
                <p>
                  <label class="button-in-about">
                    <button
                      @click="captureAccountAuditBaseline()"
                      class="button account-audit-capture-button"
                      :disabled="accountBackupButtonDisable"
                    >
                      {{ translateApp('accountBackup.audit.captureButton') }}
                    </button>
                  </label>
                  <label class="button-in-about">
                    <button
                      @click="compareAccountAuditBaseline()"
                      class="button account-audit-compare-button"
                      :disabled="accountBackupButtonDisable"
                    >
                      {{ translateApp('accountBackup.audit.compareButton') }}
                    </button>
                  </label>
                </p>
                <p class="about-note account-audit-state">
                  {{ accountAuditStateText }}
                </p>
                <div
                  v-if="accountAuditSummary?.databases.length"
                  class="account-backup-preview-scroll"
                >
                  <table class="account-backup-preview-table account-audit-table">
                    <thead>
                      <tr>
                        <th>{{ translateApp('accountBackup.audit.database') }}</th>
                        <th>{{ translateApp('accountBackup.audit.records') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="database in accountAuditSummary.databases"
                        :key="database.dbName"
                      >
                        <td>{{ database.dbName }}</td>
                        <td>{{ database.records }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section class="about-block">
            <h3 class="about-heading">{{ translateApp('about.intake.heading') }}</h3>
            <p>{{ translateApp('about.intake.description') }}</p>
            <p>
              <label>
                <input v-model="globalSetting.enableIntake" type="checkbox" />
                {{ translateApp('about.intake.toggle') }}
              </label>
            </p>
            <p class="about-link-title">{{ kanlogDescription }}</p>
            <p class="about-kanlog-link">
              <a
                class="has-text-success"
                rel="noreferrer"
                @click="openExternalUrl"
                target="_blank"
                :href="kanlogUrl"
                ><img class="kanlog-img" src="../assets/img/app/kanlog.png" :alt="kanlogLogoAlt" /><span
                  class="link-text">{{ kanlogUrl }}</span></a
              >
            </p>
          </section>

          <section class="about-block">
            <h3 class="about-heading">{{ translateApp('about.developer.heading') }}</h3>
            <p>{{ developerDescription }}</p>
            <p>
              <label class="button-in-about">
                <button @click="openKoubrowserDevTool()" class="button">
                  <AppDevToolImage />
                  {{ developerButtonText }}
                </button>
              </label>
            </p>
          </section>

          <section class="about-block">
            <h3 class="about-heading">{{ translateApp('about.license.heading') }}</h3>
            <p>{{ translateApp('about.license.description') }}</p>
            <p>
              <label class="button-in-about">
                <button @click="openLicenseOverlay()" class="button">
                  <ShowLicenseImage />{{ translateApp('about.license.button') }}
                </button>
              </label>
            </p>
          </section>
        </div>
      </div>
    </div>
    <div
      v-if="isLicenseOverlayVisible"
      class="license-overlay"
      role="region"
      aria-labelledby="license-title"
    >
      <div class="license-dialog">
        <h3 id="license-title" class="about-heading">
          {{ translateApp('about.license.dialogTitle') }}
        </h3>
        <div class="license-table-scroll">
          <table class="license-table">
            <thead>
              <tr>
                <th>{{ translateApp('about.license.table.library') }}</th>
                <th>{{ translateApp('about.license.table.version') }}</th>
                <th>{{ translateApp('about.license.table.license') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="license in bundledLicenses" :key="license.name">
                <td>{{ license.name }}</td>
                <td>{{ license.version }}</td>
                <td>{{ license.license }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="license-actions">
          <label class="button-in-about">
            <button @click="closeLicenseOverlay()" class="button">
              {{ translateApp('common.ok') }}
            </button>
          </label>
        </div>
      </div>
    </div>
  </section>
</template>

import type { TimelineResult, TaihaSingekiBlockState, AirbaseTargetSpots, AirbaseSpot } from '@common/channel'
import type { UpdateCheckResult, UpdateStateSnapshot } from '@common/type'
import type { Query, QueryReturn, PortChartData } from '@common/record'
import type { MstMapinfo, ApiMap } from '@common/kcs'
import type { Spot, CellInfo } from '@common/map'
import type { AppSetting, InheritScoreList } from '@common/store'
import type { AggregatedCellRank, AggregatedCellShipDrop } from '@common/calc_record'
import type { GlobalSetting } from '@common/global_setting'
import type { RecordingSource } from '@common/recording'
import type {
  AssistPanelDiagnosticInput,
  AssistPanelDiagnosticSaveResult
} from '@common/assist-diagnostic'
import type {
  EncryptedAccountTransferResult,
  LocalAccountBackupInspectionResult,
  LocalAccountBackupResult,
  LocalAccountInspectionReportResult,
  LocalAccountAuditCaptureResult,
  LocalAccountAuditComparisonResult,
  LocalAccountMergePreparationResult,
  LocalAccountRedoAvailability,
  LocalAccountRedoPreparationResult,
  LocalAccountRollbackAvailability,
  LocalAccountRollbackPreparationResult,
  LocalAccountRestorePreparationResult
} from '@common/account-backup'

export interface Api {
  rendererReady(): void
  showAssist(): void
  hideAssist(): void
  toggleLayoutMode(): void
  toggleMaximize(): void
  minimize(): void
  close(): void
  devtool(): void
  reload(): void
  openCaptureFolder(): void
  openDataFolder(): Promise<void>
  saveAssistPanelDiagnostic(
    diagnostic: AssistPanelDiagnosticInput
  ): Promise<AssistPanelDiagnosticSaveResult>
  createLocalAccountBackup(): Promise<LocalAccountBackupResult>
  createEncryptedAccountTransfer(passphrase: string): Promise<EncryptedAccountTransferResult>
  inspectEncryptedAccountTransfer(passphrase: string): Promise<LocalAccountBackupInspectionResult>
  inspectLocalAccountBackup(): Promise<LocalAccountBackupInspectionResult>
  saveAccountInspectionReport(): Promise<LocalAccountInspectionReportResult>
  prepareLocalAccountMerge(): Promise<LocalAccountMergePreparationResult>
  getAvailableAccountMergeRollback(): Promise<LocalAccountRollbackAvailability>
  prepareAccountMergeRollback(): Promise<LocalAccountRollbackPreparationResult>
  getAvailableAccountMergeRedo(): Promise<LocalAccountRedoAvailability>
  prepareAccountMergeRedo(): Promise<LocalAccountRedoPreparationResult>
  prepareLocalAccountRestore(): Promise<LocalAccountRestorePreparationResult>
  getAvailableAccountRollback(): Promise<LocalAccountRollbackAvailability>
  prepareAccountRollback(): Promise<LocalAccountRollbackPreparationResult>
  getAvailableAccountRedo(): Promise<LocalAccountRedoAvailability>
  prepareAccountRedo(): Promise<LocalAccountRedoPreparationResult>
  captureAccountAuditBaseline(): Promise<LocalAccountAuditCaptureResult>
  compareAccountAuditBaseline(): Promise<LocalAccountAuditComparisonResult>
  saveCapture(date: Date, buffer: Buffer): Promise<string>
  getRecordingSource(): Promise<RecordingSource>
  openOption(): void
  openAssist(): void
  topmost(): void
  notifyMuteState(muted: boolean): void
  refreshAssist(): void
  storeRec(buffer: Buffer, isEnd: boolean): void
  requestRequiredData(): void
  shipCsv(lines: string): void
  timeline(): Promise<TimelineResult>
  getAirbaseSpots(area_id: number, area_no: number): Promise<AirbaseTargetSpots>
  setAirbaseSpots(spot: AirbaseSpot): void
  openExternalUrl(url: string): Promise<boolean>
  getVersion(): Promise<string>
  queryDb(query: Query): Promise<QueryReturn>
  clearSessionCache(): Promise<void>
  findSpotForLabel(mapnifo: MstMapinfo, map: ApiMap, cb: (spot: Spot | null) => void): void
  cellInfoAsync(area_id: number, area_no: number): Promise<CellInfo>
  calcPortChartData(): Promise<PortChartData>
  saveAppSetting(setting: AppSetting): void
  saveGlobalSetting(setting: GlobalSetting): void
  aggregateCellRank(area_id: number, area_no: number): Promise<AggregatedCellRank[]>
  aggregateShipDrop(ship_id: number): Promise<AggregatedCellShipDrop[]>
  getInheritScoreList(): Promise<InheritScoreList>
  saveInheritScoreList(list: InheritScoreList): void
  getUpdateState(): Promise<UpdateStateSnapshot>
  checkForUpdates(setting?: GlobalSetting): Promise<UpdateCheckResult>
  downloadUpdate(): Promise<void>
  restartAndInstallUpdate(): Promise<void>
  onUpdateStateChanged(cb: (state: UpdateStateSnapshot) => void): () => void
  onUpdateDownloadProgress(cb: (percent: number) => void): () => void
  onStartupUpdateChecked(cb: (result: UpdateCheckResult) => void): () => void
  setTaihaSingekiBlockState(states: TaihaSingekiBlockState[]): void
}

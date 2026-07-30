import fs from 'node:fs/promises'
import type {
  AccountBackupDatabasePreview,
  AccountBackupMergeConflictSummary
} from '@common/account-backup'
import type { AccountBackupSummary } from '@main/account-backup'

export interface RedactedAccountInspectionReport {
  readonly schemaVersion: 1
  readonly kind: 'koubrowser-account-data-inspection'
  readonly generatedAt: string
  readonly build: {
    readonly appVersion: string
  }
  readonly environment: {
    readonly platform: string
    readonly operatingSystemRelease: string
    readonly architecture: string
  }
  readonly bundle: {
    readonly appVersion: string
    readonly createdAt: string
    readonly databaseFiles: number
    readonly profileFiles: number
    readonly records: number
  }
  readonly accountMatch: 'same'
  readonly databases: RedactedAccountInspectionDatabase[]
  readonly privacy: {
    readonly accountIdentity: 'excluded'
    readonly deviceIdentity: 'excluded'
    readonly bundleIdentity: 'excluded'
    readonly paths: 'excluded'
    readonly hashes: 'excluded'
    readonly rawRecords: 'excluded'
  }
}

export interface RedactedAccountInspectionDatabase {
  readonly dbName: AccountBackupDatabasePreview['dbName']
  readonly incomingRecords: number
  readonly add: number
  readonly duplicate: number
  readonly legacyDuplicate: number
  readonly conflict: number
  readonly currentOnly: number
  readonly mergePlan: {
    readonly schemaVersion: 1
    readonly comparisonPolicyVersion: 1
    readonly conflictPolicyVersion: 1
    readonly conflictResolution: 'preserve-current-v1'
    readonly mode: AccountBackupDatabasePreview['mergePlan']['mode']
    readonly safeAdd: number
    readonly skip: number
    readonly conflict: number
    readonly conflictReasons: readonly AccountBackupMergeConflictSummary[]
    readonly manualReview: number
    readonly currentOnly: number
  }
}

export interface CreateRedactedAccountInspectionReportOptions {
  readonly generatedAt: Date
  readonly currentAppVersion: string
  readonly platform: string
  readonly operatingSystemRelease: string
  readonly architecture: string
  readonly bundleAppVersion: string
  readonly bundleCreatedAt: string
  readonly bundleSummary: AccountBackupSummary
  readonly databases: readonly AccountBackupDatabasePreview[]
}

export function createRedactedAccountInspectionReport(
  options: CreateRedactedAccountInspectionReportOptions
): RedactedAccountInspectionReport {
  return {
    schemaVersion: 1,
    kind: 'koubrowser-account-data-inspection',
    generatedAt: options.generatedAt.toISOString(),
    build: {
      appVersion: options.currentAppVersion
    },
    environment: {
      platform: options.platform,
      operatingSystemRelease: options.operatingSystemRelease,
      architecture: options.architecture
    },
    bundle: {
      appVersion: options.bundleAppVersion,
      createdAt: options.bundleCreatedAt,
      databaseFiles: options.bundleSummary.databaseFiles,
      profileFiles: options.bundleSummary.profileFiles,
      records: options.bundleSummary.records
    },
    accountMatch: 'same',
    databases: [...options.databases]
      .sort((left, right) => left.dbName.localeCompare(right.dbName))
      .map((database) => ({
        dbName: database.dbName,
        incomingRecords: database.incomingRecords,
        add: database.add,
        duplicate: database.duplicate,
        legacyDuplicate: database.legacyDuplicate,
        conflict: database.conflict,
        currentOnly: database.currentOnly,
        mergePlan: {
          schemaVersion: database.mergePlan.schemaVersion,
          comparisonPolicyVersion:
            database.mergePlan.comparisonPolicyVersion,
          conflictPolicyVersion: database.mergePlan.conflictPolicyVersion,
          conflictResolution: database.mergePlan.conflictResolution,
          mode: database.mergePlan.mode,
          safeAdd: database.mergePlan.safeAdd,
          skip: database.mergePlan.skip,
          conflict: database.mergePlan.conflict,
          conflictReasons: database.mergePlan.conflictReasons.map(
            ({ group, records }) => ({ group, records })
          ),
          manualReview: database.mergePlan.manualReview,
          currentOnly: database.mergePlan.currentOnly
        }
      })),
    privacy: {
      accountIdentity: 'excluded',
      deviceIdentity: 'excluded',
      bundleIdentity: 'excluded',
      paths: 'excluded',
      hashes: 'excluded',
      rawRecords: 'excluded'
    }
  }
}

export function accountInspectionReportFilename(generatedAt: Date): string {
  return `koubrowser-account-inspection-${generatedAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')}.json`
}

export async function saveRedactedAccountInspectionReport(
  filePath: string,
  report: RedactedAccountInspectionReport
): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx'
  })
}

export type LocalAccountBackupResult =
  | {
      readonly status: 'cancelled'
    }
  | {
      readonly status: 'created'
      readonly bundleName: string
      readonly databaseFiles: number
      readonly profileFiles: number
      readonly records: number
    }

export type EncryptedAccountTransferResult =
  | {
      readonly status: 'cancelled'
    }
  | {
      readonly status: 'created'
      readonly fileName: string
      readonly bytes: number
      readonly databaseFiles: number
      readonly profileFiles: number
      readonly records: number
    }

export type LocalAccountBackupInspectionResult =
  | {
      readonly status: 'cancelled'
    }
  | {
      readonly status: 'invalid'
    }
  | {
      readonly status: 'valid'
      readonly bundleName: string
      readonly appVersion: string
      readonly createdAt: string
      readonly accountMatch: 'same' | 'different' | 'unavailable'
      readonly databaseFiles: number
      readonly profileFiles: number
      readonly records: number
      readonly databases: AccountBackupDatabasePreview[]
    }

export type LocalAccountInspectionReportResult =
  | {
      readonly status: 'cancelled'
    }
  | {
      readonly status: 'saved'
      readonly fileName: string
    }

export type LocalAccountRestorePreparationResult =
  | {
      readonly status: 'cancelled'
    }
  | {
      readonly status: 'scheduled'
      readonly bundleName: string
    }

export type LocalAccountMergePreparationResult =
  | {
      readonly status: 'cancelled'
    }
  | {
      readonly status: 'scheduled'
      readonly bundleName: string
    }

export type LocalAccountRollbackAvailability =
  | {
      readonly status: 'none'
    }
  | {
      readonly status: 'available'
      readonly bundleName: string
      readonly createdAt: string
    }

export type LocalAccountRollbackPreparationResult =
  | {
      readonly status: 'cancelled'
    }
  | {
      readonly status: 'scheduled'
      readonly bundleName: string
    }

export type LocalAccountRedoAvailability =
  | {
      readonly status: 'none'
    }
  | {
      readonly status: 'available'
      readonly bundleName: string
      readonly createdAt: string
    }

export type LocalAccountRedoPreparationResult =
  | {
      readonly status: 'cancelled'
    }
  | {
      readonly status: 'scheduled'
      readonly bundleName: string
    }
import type { DbName } from '@common/record'

export type AccountBackupDatabaseMergePlanMode =
  | 'append-only-v1'
  | 'quest-monotonic-v1'

export type AccountBackupMergeConflictGroup =
  | 'identity'
  | 'timestamp'
  | 'provenance'
  | 'display'
  | 'snapshot'
  | 'location'
  | 'context'
  | 'input'
  | 'result'
  | 'fleet'
  | 'raw-response'
  | 'reward'
  | 'unknown-field'

export interface AccountBackupMergeConflictSummary {
  readonly group: AccountBackupMergeConflictGroup
  /**
   * Number of conflicting incoming records affected by this group. A record
   * may affect more than one group, so these counts do not necessarily sum to
   * the plan's conflict count.
   */
  readonly records: number
}

export interface AccountBackupDatabaseMergePlan {
  readonly schemaVersion: 1
  readonly comparisonPolicyVersion: 1
  readonly conflictPolicyVersion: 1
  readonly conflictResolution: 'preserve-current-v1'
  readonly mode: AccountBackupDatabaseMergePlanMode
  readonly sourceSha256: string
  readonly currentStateSha256: string
  readonly incomingStateSha256: string
  readonly decisionSha256: string
  readonly safeAdd: number
  readonly skip: number
  readonly conflict: number
  readonly conflictReasons: readonly AccountBackupMergeConflictSummary[]
  readonly manualReview: number
  readonly currentOnly: number
}

export interface AccountBackupDatabasePreview {
  readonly dbName: DbName
  readonly incomingRecords: number
  readonly add: number
  readonly duplicate: number
  readonly legacyDuplicate: number
  readonly conflict: number
  readonly currentOnly: number
  readonly mergePlan: AccountBackupDatabaseMergePlan
}

export interface LocalAccountAuditDatabase {
  readonly dbName: DbName
  readonly records: number
}

export interface LocalAccountAuditSummary {
  readonly capturedAt: string
  readonly databases: LocalAccountAuditDatabase[]
  readonly profileFiles: number
  readonly records: number
}

export type LocalAccountAuditCaptureResult = {
  readonly status: 'captured'
  readonly summary: LocalAccountAuditSummary
}

export type LocalAccountAuditComparisonResult =
  | {
      readonly status: 'none'
    }
  | {
      readonly status: 'different-account'
      readonly capturedAt: string
    }
  | {
      readonly status: 'match'
      readonly summary: LocalAccountAuditSummary
    }
  | {
      readonly status: 'different'
      readonly summary: LocalAccountAuditSummary
      readonly changedDatabases: DbName[]
      readonly changedProfiles: string[]
    }

export interface AccountRestoreRetentionPolicy {
  readonly maxAgeDays: number
  readonly maxGenerationsPerAccount: number
  readonly maxTotalBytes: number
}

export const DefaultAccountRestoreRetentionPolicy:
Readonly<AccountRestoreRetentionPolicy> = Object.freeze({
  maxAgeDays: 30,
  maxGenerationsPerAccount: 3,
  maxTotalBytes: 2 * 1024 * 1024 * 1024
})

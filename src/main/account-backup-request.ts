import path from 'node:path'
import type {
  AccountBackupDatabasePreview,
  EncryptedAccountTransferResult,
  LocalAccountBackupInspectionResult,
  LocalAccountBackupResult
} from '@common/account-backup'
import type { VerifiedAccountBackup } from '@main/account-backup'
import type {
  EncryptedAccountTransferResult as CreatedEncryptedAccountTransfer
} from '@main/account-transfer'

export function isTrustedAccountBackupRequest(
  senderId: number,
  isMainFrame: boolean,
  mainWebContentsId: number
): boolean {
  return isMainFrame && senderId === mainWebContentsId
}

export function toLocalAccountBackupResult(
  verified: VerifiedAccountBackup
): LocalAccountBackupResult {
  return {
    status: 'created',
    bundleName: path.basename(verified.directory),
    databaseFiles: verified.manifest.summary.databaseFiles,
    profileFiles: verified.manifest.summary.profileFiles,
    records: verified.manifest.summary.records
  }
}

export function toEncryptedAccountTransferResult(
  created: CreatedEncryptedAccountTransfer
): EncryptedAccountTransferResult {
  return {
    status: 'created',
    fileName: created.fileName,
    bytes: created.bytes,
    databaseFiles: created.databaseFiles,
    profileFiles: created.profileFiles,
    records: created.records
  }
}

export interface CurrentAccountIdentity {
  readonly serverId: number
  readonly memberId: string
}

function accountMatch(
  verified: VerifiedAccountBackup,
  currentAccount: CurrentAccountIdentity
): 'same' | 'different' | 'unavailable' {
  if (
    !Number.isSafeInteger(currentAccount.serverId) ||
    currentAccount.serverId <= 0 ||
    !/^[0-9]{1,32}$/.test(currentAccount.memberId)
  ) {
    return 'unavailable'
  }
  return (
    verified.manifest.account.serverId === currentAccount.serverId &&
    verified.manifest.account.memberId === currentAccount.memberId
  )
    ? 'same'
    : 'different'
}

export function toLocalAccountBackupInspectionResult(
  verified: VerifiedAccountBackup,
  currentAccount: CurrentAccountIdentity,
  databases: readonly AccountBackupDatabasePreview[] = []
): LocalAccountBackupInspectionResult {
  return {
    status: 'valid',
    bundleName: path.basename(verified.directory),
    appVersion: verified.manifest.appVersion,
    createdAt: verified.manifest.createdAt,
    accountMatch: accountMatch(verified, currentAccount),
    databaseFiles: verified.manifest.summary.databaseFiles,
    profileFiles: verified.manifest.summary.profileFiles,
    records: verified.manifest.summary.records,
    databases: [...databases].sort((left, right) =>
      left.dbName.localeCompare(right.dbName)
    )
  }
}

export type VerifyAccountBackup = (
  directory: string
) => Promise<VerifiedAccountBackup>

export type PreviewAccountBackup = (
  verified: VerifiedAccountBackup
) => Promise<AccountBackupDatabasePreview[]>

export async function inspectLocalAccountBackupDirectory(
  directory: string,
  currentAccount: CurrentAccountIdentity,
  verify: VerifyAccountBackup,
  preview?: PreviewAccountBackup
): Promise<LocalAccountBackupInspectionResult> {
  let verified: VerifiedAccountBackup
  try {
    verified = await verify(directory)
  } catch {
    return { status: 'invalid' }
  }
  const result = toLocalAccountBackupInspectionResult(
    verified,
    currentAccount
  )
  if (
    result.status !== 'valid' ||
    result.accountMatch !== 'same' ||
    !preview
  ) {
    return result
  }
  return toLocalAccountBackupInspectionResult(
    verified,
    currentAccount,
    await preview(verified)
  )
}

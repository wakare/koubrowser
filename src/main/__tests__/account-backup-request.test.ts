import { describe, expect, it } from 'vitest'
import {
  inspectLocalAccountBackupDirectory,
  isTrustedAccountBackupRequest,
  toEncryptedAccountTransferResult,
  toLocalAccountBackupInspectionResult,
  toLocalAccountBackupResult
} from '@main/account-backup-request'
import type { VerifiedAccountBackup } from '@main/account-backup'

describe('account backup request boundary', () => {
  it('accepts only the main application frame', () => {
    expect(isTrustedAccountBackupRequest(10, true, 10)).toBe(true)
    expect(isTrustedAccountBackupRequest(10, false, 10)).toBe(false)
    expect(isTrustedAccountBackupRequest(11, true, 10)).toBe(false)
  })

  it('redacts the encrypted transfer result to a filename and aggregate counts', () => {
    const result = toEncryptedAccountTransferResult({
      filePath: 'C:\\private\\account.koubrowser-transfer',
      fileName: 'account.koubrowser-transfer',
      bytes: 4096,
      databaseFiles: 9,
      profileFiles: 3,
      records: 42
    })

    expect(result).toEqual({
      status: 'created',
      fileName: 'account.koubrowser-transfer',
      bytes: 4096,
      databaseFiles: 9,
      profileFiles: 3,
      records: 42
    })
    expect(JSON.stringify(result)).not.toContain('C:\\private')
  })

  it('returns a redacted renderer result without account or device ids', () => {
    const verified = {
      directory: 'C:\\backups\\koubrowser-backup-example',
      manifest: {
        schemaVersion: 1,
        bundleId: '11111111-1111-4111-8111-111111111111',
        appVersion: '1.0.5',
        createdAt: '2026-07-30T00:00:00.000Z',
        sourceDeviceId: '22222222-2222-4222-8222-222222222222',
        mode: 'backup',
        protection: 'none-local-only',
        account: { serverId: 3, memberId: '12345678' },
        summary: {
          databaseFiles: 9,
          profileFiles: 3,
          records: 42,
          oldestRecordAt: null,
          newestRecordAt: null
        },
        files: []
      }
    } satisfies VerifiedAccountBackup
    const result = toLocalAccountBackupResult(verified)

    expect(result).toEqual({
      status: 'created',
      bundleName: 'koubrowser-backup-example',
      databaseFiles: 9,
      profileFiles: 3,
      records: 42
    })
    expect(JSON.stringify(result)).not.toContain('12345678')
    expect(JSON.stringify(result)).not.toContain('22222222')
  })

  it('reports account matching without exposing either account identity', () => {
    const verified = {
      directory: 'C:\\backups\\koubrowser-backup-example',
      manifest: {
        schemaVersion: 1,
        bundleId: '11111111-1111-4111-8111-111111111111',
        appVersion: '1.0.5',
        createdAt: '2026-07-30T00:00:00.000Z',
        sourceDeviceId: '22222222-2222-4222-8222-222222222222',
        mode: 'backup',
        protection: 'none-local-only',
        account: { serverId: 3, memberId: '12345678' },
        summary: {
          databaseFiles: 9,
          profileFiles: 3,
          records: 42,
          oldestRecordAt: null,
          newestRecordAt: null
        },
        files: []
      }
    } satisfies VerifiedAccountBackup

    expect(toLocalAccountBackupInspectionResult(verified, {
      serverId: 3,
      memberId: '12345678'
    })).toMatchObject({ status: 'valid', accountMatch: 'same' })
    expect(toLocalAccountBackupInspectionResult(verified, {
      serverId: 3,
      memberId: '87654321'
    })).toMatchObject({ status: 'valid', accountMatch: 'different' })
    expect(toLocalAccountBackupInspectionResult(verified, {
      serverId: 0,
      memberId: '0'
    })).toMatchObject({ status: 'valid', accountMatch: 'unavailable' })

    const result = toLocalAccountBackupInspectionResult(verified, {
      serverId: 3,
      memberId: '87654321'
    })
    expect(JSON.stringify(result)).not.toContain('12345678')
    expect(JSON.stringify(result)).not.toContain('87654321')
    expect(JSON.stringify(result)).not.toContain('22222222')
  })

  it('maps verifier corruption failures to a fixed redacted invalid result', async () => {
    const verify = async (): Promise<VerifiedAccountBackup> => {
      throw new Error(
        'hash mismatch at C:\\private\\store\\3_12345678\\port.db'
      )
    }

    await expect(
      inspectLocalAccountBackupDirectory(
        'C:\\selected\\bundle',
        { serverId: 3, memberId: '12345678' },
        verify
      )
    ).resolves.toEqual({ status: 'invalid' })
  })
})

import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  accountInspectionReportFilename,
  createRedactedAccountInspectionReport,
  saveRedactedAccountInspectionReport
} from '@main/account-inspection-report'
import type { AccountBackupDatabasePreview } from '@common/account-backup'

describe('redacted account inspection report', () => {
  it('keeps Phase A counts and policies without identities, paths, hashes, or records', () => {
    const database = {
      dbName: 'battle',
      incomingRecords: 20,
      add: 3,
      duplicate: 14,
      legacyDuplicate: 1,
      conflict: 2,
      currentOnly: 4,
      mergePlan: {
        schemaVersion: 1,
        comparisonPolicyVersion: 1,
        conflictPolicyVersion: 1,
        conflictResolution: 'preserve-current-v1',
        mode: 'append-only-v1',
        sourceSha256: 'a'.repeat(64),
        currentStateSha256: 'b'.repeat(64),
        incomingStateSha256: 'c'.repeat(64),
        decisionSha256: 'd'.repeat(64),
        safeAdd: 2,
        skip: 14,
        conflict: 2,
        conflictReasons: [{ group: 'result', records: 2 }],
        manualReview: 2,
        currentOnly: 4
      }
    } satisfies AccountBackupDatabasePreview
    const report = createRedactedAccountInspectionReport({
      generatedAt: new Date('2026-07-30T12:34:56.789Z'),
      currentAppVersion: '1.2.3',
      platform: 'win32',
      operatingSystemRelease: '10.0.26100',
      architecture: 'x64',
      bundleAppVersion: '1.0.5',
      bundleCreatedAt: '2026-07-29T01:02:03.000Z',
      bundleSummary: {
        databaseFiles: 9,
        profileFiles: 3,
        records: 42,
        oldestRecordAt: '2025-01-01T00:00:00.000Z',
        newestRecordAt: '2026-07-29T00:00:00.000Z'
      },
      databases: [database]
    })

    expect(report).toMatchObject({
      schemaVersion: 1,
      kind: 'koubrowser-account-data-inspection',
      generatedAt: '2026-07-30T12:34:56.789Z',
      build: {
        appVersion: '1.2.3'
      },
      environment: {
        platform: 'win32',
        operatingSystemRelease: '10.0.26100',
        architecture: 'x64'
      },
      bundle: {
        appVersion: '1.0.5',
        createdAt: '2026-07-29T01:02:03.000Z',
        databaseFiles: 9,
        profileFiles: 3,
        records: 42
      },
      accountMatch: 'same',
      databases: [
        {
          dbName: 'battle',
          incomingRecords: 20,
          mergePlan: {
            safeAdd: 2,
            conflictReasons: [{ group: 'result', records: 2 }]
          }
        }
      ]
    })

    const serialized = JSON.stringify(report)
    for (const field of [
      'memberId',
      'serverId',
      'sourceDeviceId',
      'bundleId',
      'bundleName',
      'directory',
      'sourceSha256',
      'currentStateSha256',
      'incomingStateSha256',
      'decisionSha256'
    ]) {
      expect(serialized).not.toContain(`"${field}"`)
    }
    for (const secret of [
      '12345678',
      'C:\\private\\store\\3_12345678',
      'a'.repeat(64),
      'b'.repeat(64),
      'c'.repeat(64),
      'd'.repeat(64)
    ]) {
      expect(serialized).not.toContain(secret)
    }
  })

  it('uses a stable timestamp-only default filename', () => {
    expect(
      accountInspectionReportFilename(
        new Date('2026-07-30T12:34:56.789Z')
      )
    ).toBe('koubrowser-account-inspection-20260730T123456Z.json')
  })

  it('writes UTF-8 JSON once and refuses to overwrite evidence', async () => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'koubrowser-account-report-')
    )
    const filePath = path.join(directory, 'inspection.json')
    const report = createRedactedAccountInspectionReport({
      generatedAt: new Date('2026-07-30T12:34:56.789Z'),
      currentAppVersion: '1.2.3',
      platform: 'win32',
      operatingSystemRelease: '10.0.26100',
      architecture: 'x64',
      bundleAppVersion: '1.0.5',
      bundleCreatedAt: '2026-07-29T01:02:03.000Z',
      bundleSummary: {
        databaseFiles: 9,
        profileFiles: 0,
        records: 0,
        oldestRecordAt: null,
        newestRecordAt: null
      },
      databases: []
    })

    try {
      await saveRedactedAccountInspectionReport(filePath, report)
      expect(JSON.parse(await fs.readFile(filePath, 'utf8'))).toEqual(report)
      await expect(
        saveRedactedAccountInspectionReport(filePath, report)
      ).rejects.toMatchObject({ code: 'EEXIST' })
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
})

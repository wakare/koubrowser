import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  loadOrCreateBackupSourceDeviceId,
  parseBackupSourceDeviceIdentity
} from '@main/backup-source-device'

describe('backup source device identity', () => {
  let appDataRoot: string

  beforeEach(() => {
    appDataRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'koubrowser-backup-device-')
    )
  })

  afterEach(() => {
    fs.rmSync(appDataRoot, { recursive: true, force: true })
  })

  it('creates one strict identity and reuses it', async () => {
    const first = await loadOrCreateBackupSourceDeviceId(appDataRoot)
    const second = await loadOrCreateBackupSourceDeviceId(appDataRoot)
    const stored = fs.readFileSync(
      path.join(appDataRoot, 'backup-source-device.json'),
      'utf8'
    )

    expect(second).toBe(first)
    expect(parseBackupSourceDeviceIdentity(stored)).toBe(first)
    expect(fs.readdirSync(appDataRoot)).toEqual([
      'backup-source-device.json'
    ])
  })

  it('returns the same identity to concurrent callers', async () => {
    const ids = await Promise.all(
      Array.from({ length: 20 }, () =>
        loadOrCreateBackupSourceDeviceId(appDataRoot)
      )
    )

    expect(new Set(ids).size).toBe(1)
    expect(fs.readdirSync(appDataRoot)).toEqual([
      'backup-source-device.json'
    ])
  })

  it('does not replace malformed existing identity data', async () => {
    const identityPath = path.join(
      appDataRoot,
      'backup-source-device.json'
    )
    fs.writeFileSync(identityPath, '{"schemaVersion":1,"deviceId":"bad"}')

    await expect(
      loadOrCreateBackupSourceDeviceId(appDataRoot)
    ).rejects.toThrow('invalid backup source device identity')
    expect(fs.readFileSync(identityPath, 'utf8')).toBe(
      '{"schemaVersion":1,"deviceId":"bad"}'
    )
  })

  it('rejects unknown fields and oversized identity files', () => {
    expect(() =>
      parseBackupSourceDeviceIdentity(JSON.stringify({
        schemaVersion: 1,
        deviceId: '22222222-2222-4222-8222-222222222222',
        account: 'must-not-be-stored'
      }))
    ).toThrow('unsupported fields')
    expect(() =>
      parseBackupSourceDeviceIdentity(' '.repeat(1025))
    ).toThrow('too large')
  })
})

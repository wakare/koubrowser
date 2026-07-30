import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { MainChannel } from '@common/channel'
import type { Api } from '../../preload/api'

const preloadState = vi.hoisted(() => ({
  invoke: vi.fn(),
  exposed: new Map<string, unknown>()
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, value: unknown) => {
      preloadState.exposed.set(name, value)
    }
  },
  ipcRenderer: {
    invoke: preloadState.invoke,
    on: vi.fn(),
    removeListener: vi.fn()
  }
}))

vi.mock('@electron-toolkit/preload', () => ({
  electronAPI: {}
}))

describe('account backup preload boundary', () => {
  let previousContextIsolated: PropertyDescriptor | undefined
  let api: Api

  beforeAll(async () => {
    previousContextIsolated = Object.getOwnPropertyDescriptor(
      process,
      'contextIsolated'
    )
    Object.defineProperty(process, 'contextIsolated', {
      configurable: true,
      value: true
    })
    await import('../../preload/index')
    api = preloadState.exposed.get('api') as Api
  })

  afterAll(() => {
    if (previousContextIsolated) {
      Object.defineProperty(
        process,
        'contextIsolated',
        previousContextIsolated
      )
    } else {
      Reflect.deleteProperty(process, 'contextIsolated')
    }
  })

  beforeEach(() => {
    preloadState.invoke.mockReset()
  })

  it('exposes only the fixed account-backup invocation', async () => {
    preloadState.invoke.mockResolvedValueOnce({ status: 'cancelled' })

    await expect(api.createLocalAccountBackup()).resolves.toEqual({
      status: 'cancelled'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.create_local_account_backup
    )
  })

  it('passes only the supplied passphrase to the fixed encrypted-transfer invocation', async () => {
    preloadState.invoke.mockResolvedValueOnce({ status: 'cancelled' })

    await expect(
      api.createEncryptedAccountTransfer('a sufficiently long passphrase')
    ).resolves.toEqual({
      status: 'cancelled'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.create_encrypted_account_transfer,
      'a sufficiently long passphrase'
    )
  })

  it('passes only the supplied passphrase to the fixed encrypted-transfer inspection', async () => {
    preloadState.invoke.mockResolvedValueOnce({ status: 'invalid' })

    await expect(
      api.inspectEncryptedAccountTransfer('a sufficiently long passphrase')
    ).resolves.toEqual({
      status: 'invalid'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.inspect_encrypted_account_transfer,
      'a sufficiently long passphrase'
    )
  })

  it('exposes only the fixed account-backup inspection invocation', async () => {
    preloadState.invoke.mockResolvedValueOnce({ status: 'invalid' })

    await expect(api.inspectLocalAccountBackup()).resolves.toEqual({
      status: 'invalid'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.inspect_local_account_backup
    )
  })

  it('exposes only the fixed inspection-report save invocation', async () => {
    preloadState.invoke.mockResolvedValueOnce({ status: 'cancelled' })

    await expect(api.saveAccountInspectionReport()).resolves.toEqual({
      status: 'cancelled'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.save_account_inspection_report
    )
  })

  it('exposes only the fixed restore-preparation invocation', async () => {
    preloadState.invoke.mockResolvedValueOnce({ status: 'cancelled' })

    await expect(api.prepareLocalAccountRestore()).resolves.toEqual({
      status: 'cancelled'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.prepare_local_account_restore
    )
  })

  it('exposes only the fixed merge-preparation invocation', async () => {
    preloadState.invoke.mockResolvedValueOnce({ status: 'cancelled' })

    await expect(api.prepareLocalAccountMerge()).resolves.toEqual({
      status: 'cancelled'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.prepare_local_account_merge
    )
  })

  it('exposes only fixed merge rollback invocations', async () => {
    preloadState.invoke
      .mockResolvedValueOnce({ status: 'none' })
      .mockResolvedValueOnce({ status: 'cancelled' })

    await expect(api.getAvailableAccountMergeRollback()).resolves.toEqual({
      status: 'none'
    })
    expect(preloadState.invoke).toHaveBeenNthCalledWith(
      1,
      MainChannel.get_available_account_merge_rollback
    )
    await expect(api.prepareAccountMergeRollback()).resolves.toEqual({
      status: 'cancelled'
    })
    expect(preloadState.invoke).toHaveBeenNthCalledWith(
      2,
      MainChannel.prepare_account_merge_rollback
    )
  })

  it('exposes only fixed merge redo invocations', async () => {
    preloadState.invoke
      .mockResolvedValueOnce({ status: 'none' })
      .mockResolvedValueOnce({ status: 'cancelled' })

    await expect(api.getAvailableAccountMergeRedo()).resolves.toEqual({
      status: 'none'
    })
    expect(preloadState.invoke).toHaveBeenNthCalledWith(
      1,
      MainChannel.get_available_account_merge_redo
    )
    await expect(api.prepareAccountMergeRedo()).resolves.toEqual({
      status: 'cancelled'
    })
    expect(preloadState.invoke).toHaveBeenNthCalledWith(
      2,
      MainChannel.prepare_account_merge_redo
    )
  })

  it('exposes only the fixed rollback-discovery invocation', async () => {
    preloadState.invoke.mockResolvedValueOnce({ status: 'none' })

    await expect(api.getAvailableAccountRollback()).resolves.toEqual({
      status: 'none'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.get_available_account_rollback
    )
  })

  it('exposes only the fixed rollback-preparation invocation', async () => {
    preloadState.invoke.mockResolvedValueOnce({ status: 'cancelled' })

    await expect(api.prepareAccountRollback()).resolves.toEqual({
      status: 'cancelled'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.prepare_account_rollback
    )
  })

  it('exposes only the fixed redo-discovery invocation', async () => {
    preloadState.invoke.mockResolvedValueOnce({ status: 'none' })

    await expect(api.getAvailableAccountRedo()).resolves.toEqual({
      status: 'none'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.get_available_account_redo
    )
  })

  it('exposes only the fixed redo-preparation invocation', async () => {
    preloadState.invoke.mockResolvedValueOnce({ status: 'cancelled' })

    await expect(api.prepareAccountRedo()).resolves.toEqual({
      status: 'cancelled'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.prepare_account_redo
    )
  })

  it('exposes only fixed account-audit invocations', async () => {
    preloadState.invoke
      .mockResolvedValueOnce({
        status: 'captured',
        summary: {
          capturedAt: '2026-07-30T00:00:00.000Z',
          databases: [],
          profileFiles: 0,
          records: 0
        }
      })
      .mockResolvedValueOnce({ status: 'none' })

    await expect(api.captureAccountAuditBaseline()).resolves.toMatchObject({
      status: 'captured'
    })
    await expect(api.compareAccountAuditBaseline()).resolves.toEqual({
      status: 'none'
    })
    expect(preloadState.invoke).toHaveBeenNthCalledWith(
      1,
      MainChannel.capture_account_audit_baseline
    )
    expect(preloadState.invoke).toHaveBeenNthCalledWith(
      2,
      MainChannel.compare_account_audit_baseline
    )
  })
})

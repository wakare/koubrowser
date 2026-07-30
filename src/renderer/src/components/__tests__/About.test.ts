import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import About from '../About.vue'
import { PANEL_LOAD_TIMEOUT_MS } from '@renderer/common/panel-load'
import { globalSetting } from '@renderer/store/global_setting'

// 
beforeAll(() => {
    ((global.window) as any).api = {
      getVersion: vi.fn().mockResolvedValue('1.2.3'),
      saveGlobalSetting: vi.fn(),
      clearSessionCache: vi.fn().mockResolvedValue(undefined),
      openDataFolder: vi.fn().mockResolvedValue(undefined),
      createLocalAccountBackup: vi.fn().mockResolvedValue({
        status: 'cancelled'
      }),
      createEncryptedAccountTransfer: vi.fn().mockResolvedValue({
        status: 'cancelled'
      }),
      inspectEncryptedAccountTransfer: vi.fn().mockResolvedValue({
        status: 'cancelled'
      }),
      inspectLocalAccountBackup: vi.fn().mockResolvedValue({
        status: 'cancelled'
      }),
      saveAccountInspectionReport: vi.fn().mockResolvedValue({
        status: 'cancelled'
      }),
      prepareLocalAccountMerge: vi.fn().mockResolvedValue({
        status: 'cancelled'
      }),
      getAvailableAccountMergeRollback: vi.fn().mockResolvedValue({
        status: 'none'
      }),
      prepareAccountMergeRollback: vi.fn().mockResolvedValue({
        status: 'cancelled'
      }),
      getAvailableAccountMergeRedo: vi.fn().mockResolvedValue({
        status: 'none'
      }),
      prepareAccountMergeRedo: vi.fn().mockResolvedValue({
        status: 'cancelled'
      }),
      prepareLocalAccountRestore: vi.fn().mockResolvedValue({
        status: 'cancelled'
      }),
      getAvailableAccountRollback: vi.fn().mockResolvedValue({
        status: 'none'
      }),
      prepareAccountRollback: vi.fn().mockResolvedValue({
        status: 'cancelled'
      }),
      getAvailableAccountRedo: vi.fn().mockResolvedValue({
        status: 'none'
      }),
      prepareAccountRedo: vi.fn().mockResolvedValue({
        status: 'cancelled'
      }),
      captureAccountAuditBaseline: vi.fn().mockResolvedValue({
        status: 'captured',
        summary: {
          capturedAt: '2026-07-30T12:34:56.000Z',
          databases: [],
          profileFiles: 0,
          records: 0
        }
      }),
      compareAccountAuditBaseline: vi.fn().mockResolvedValue({
        status: 'none'
      }),
      getUpdateState: vi.fn().mockResolvedValue({
        status: 'idle',
        availableVersion: '',
        errorMessage: '',
        downloadPercent: null,
      }),
      checkForUpdates: vi.fn().mockResolvedValue({ status: 'not-available' }),
      downloadUpdate: vi.fn().mockResolvedValue(undefined),
      restartAndInstallUpdate: vi.fn().mockResolvedValue(undefined),
      onUpdateStateChanged: vi.fn().mockReturnValue(() => undefined),
      onUpdateDownloadProgress: vi.fn().mockReturnValue(() => undefined),
      onStartupUpdateChecked: vi.fn().mockReturnValue(() => undefined),
      openExternalUrl: vi.fn(),
      devtool: vi.fn(),
      saveAppSetting: vi.fn(),
    }
  })

beforeEach(() => {
  vi.mocked(window.api.clearSessionCache).mockReset()
  vi.mocked(window.api.clearSessionCache).mockResolvedValue(undefined)
  vi.mocked(window.api.openDataFolder).mockReset()
  vi.mocked(window.api.openDataFolder).mockResolvedValue(undefined)
  vi.mocked(window.api.createLocalAccountBackup).mockReset()
  vi.mocked(window.api.createLocalAccountBackup).mockResolvedValue({
    status: 'cancelled'
  })
  vi.mocked(window.api.createEncryptedAccountTransfer).mockReset()
  vi.mocked(window.api.createEncryptedAccountTransfer).mockResolvedValue({
    status: 'cancelled'
  })
  vi.mocked(window.api.inspectEncryptedAccountTransfer).mockReset()
  vi.mocked(window.api.inspectEncryptedAccountTransfer).mockResolvedValue({
    status: 'cancelled'
  })
  vi.mocked(window.api.inspectLocalAccountBackup).mockReset()
  vi.mocked(window.api.inspectLocalAccountBackup).mockResolvedValue({
    status: 'cancelled'
  })
  vi.mocked(window.api.saveAccountInspectionReport).mockReset()
  vi.mocked(window.api.saveAccountInspectionReport).mockResolvedValue({
    status: 'cancelled'
  })
  vi.mocked(window.api.prepareLocalAccountMerge).mockReset()
  vi.mocked(window.api.prepareLocalAccountMerge).mockResolvedValue({
    status: 'cancelled'
  })
  vi.mocked(window.api.getAvailableAccountMergeRollback).mockReset()
  vi.mocked(window.api.getAvailableAccountMergeRollback).mockResolvedValue({
    status: 'none'
  })
  vi.mocked(window.api.prepareAccountMergeRollback).mockReset()
  vi.mocked(window.api.prepareAccountMergeRollback).mockResolvedValue({
    status: 'cancelled'
  })
  vi.mocked(window.api.getAvailableAccountMergeRedo).mockReset()
  vi.mocked(window.api.getAvailableAccountMergeRedo).mockResolvedValue({
    status: 'none'
  })
  vi.mocked(window.api.prepareAccountMergeRedo).mockReset()
  vi.mocked(window.api.prepareAccountMergeRedo).mockResolvedValue({
    status: 'cancelled'
  })
  vi.mocked(window.api.prepareLocalAccountRestore).mockReset()
  vi.mocked(window.api.prepareLocalAccountRestore).mockResolvedValue({
    status: 'cancelled'
  })
  vi.mocked(window.api.getAvailableAccountRollback).mockReset()
  vi.mocked(window.api.getAvailableAccountRollback).mockResolvedValue({
    status: 'none'
  })
  vi.mocked(window.api.prepareAccountRollback).mockReset()
  vi.mocked(window.api.prepareAccountRollback).mockResolvedValue({
    status: 'cancelled'
  })
  vi.mocked(window.api.getAvailableAccountRedo).mockReset()
  vi.mocked(window.api.getAvailableAccountRedo).mockResolvedValue({
    status: 'none'
  })
  vi.mocked(window.api.prepareAccountRedo).mockReset()
  vi.mocked(window.api.prepareAccountRedo).mockResolvedValue({
    status: 'cancelled'
  })
  vi.mocked(window.api.captureAccountAuditBaseline).mockReset()
  vi.mocked(window.api.captureAccountAuditBaseline).mockResolvedValue({
    status: 'captured',
    summary: {
      capturedAt: '2026-07-30T12:34:56.000Z',
      databases: [],
      profileFiles: 0,
      records: 0
    }
  })
  vi.mocked(window.api.compareAccountAuditBaseline).mockReset()
  vi.mocked(window.api.compareAccountAuditBaseline).mockResolvedValue({
    status: 'none'
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('About.vue', () => {
  it('keeps only explicitly allowlisted external brand literals in the component', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/renderer/src/components/About.vue'),
      'utf8'
    )
    expect(source.match(/艦ログ/gu)).toHaveLength(1)
    expect(source.match(/艦これ/gu)).toHaveLength(1)

    const sourceWithoutCommentsOrExternalBrands = source
      .replace(/<!--[\s\S]*?-->/gu, '')
      .replace(/\/\/.*$/gmu, '')
      .replaceAll('艦ログ', '')
      .replaceAll('艦これ', '')

    expect(sourceWithoutCommentsOrExternalBrands).not.toMatch(
      /[ぁ-んァ-ヶ一-龠]/u
    )
  })

  it('renders component', () => {
    const wrapper = mount(About)
    expect(wrapper.exists()).toBe(true)
  })

  it('contains expected title', () => {
    const wrapper = mount(About)
    expect(wrapper.text()).contain('甲ブラウザ')
  })

  it('contains drop data setting', () => {
    const wrapper = mount(About)
    expect(wrapper.text()).contain('ドロップ情報を提供する')
  })

  it('contains koubrowser devtool button', () => {
    const wrapper = mount(About)
    expect(wrapper.text()).contain('甲ブラウザ側開発者ツール表示')
  })

  it('renders application information while preserving external values', async () => {
    const wrapper = mount(About)
    await flushPromises()

    expect(wrapper.get('.app-img').attributes('alt')).toBe('甲ブラウザロゴ')
    expect(wrapper.get('.subtitle').text()).toBe('艦隊運用支援')
    expect(wrapper.get('.title').text()).toContain('甲ブラウザ')
    expect(wrapper.get('.version').text()).toBe('ver 1.2.3')
    expect(wrapper.text()).toContain('艦ログ - 艦これドロップ情報集計サイト')
    expect(wrapper.get('.kanlog-img').attributes('alt')).toBe('艦ログロゴ')
    expect(wrapper.get('.about-kanlog-link a').attributes('href')).toBe(
      'https://kanlog.info'
    )
  })

  it('renders update controls through the application catalog', () => {
    const wrapper = mount(About)

    expect(wrapper.get('.update-check-block').text()).toContain('更新チェック')
    expect(wrapper.get('.update-check-block').text()).toContain(
      '起動時に更新チェックを行う'
    )
    expect(wrapper.get('.update-check-block').text()).toContain(
      'Beta版(開発版)を更新チェック対象に含める'
    )
    expect(wrapper.get('.update-check-block button').text()).toContain(
      '更新をチェック'
    )
  })

  it('selects a persisted titlebar color and keeps the taiha override guidance', async () => {
    const previousColor = globalSetting.titlebarColor
    const wrapper = mount(About)
    const select = wrapper.get<HTMLSelectElement>('.titlebar-color-select')

    try {
      expect(select.findAll('option').map((option) => option.text())).toEqual([
        '緑（標準）',
        '紺',
        'ダークグレー',
        '茶'
      ])
      await select.setValue('graphite')

      expect(globalSetting.titlebarColor).toBe('graphite')
      expect(wrapper.text()).toContain('大破警告中は、選択した色にかかわらず赤く表示されます')
    } finally {
      globalSetting.titlebarColor = previousColor
    }
  })

  it('opens and closes the localized license table', async () => {
    const wrapper = mount(About)
    const licenseButton = wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('ライセンス...'))

    expect(licenseButton).toBeDefined()
    await licenseButton!.trigger('click')

    expect(wrapper.get('#license-title').text()).toBe(
      '使用コンポーネントとライセンス'
    )
    expect(wrapper.findAll('.license-table th').map((header) => header.text())).toEqual([
      'ライブラリ',
      'バージョン',
      'ライセンス'
    ])

    await wrapper.get('.license-actions button').trigger('click')
    expect(wrapper.find('.license-overlay').exists()).toBe(false)
  })

  it('opens the data folder and warns against live multi-PC synchronization', async () => {
    const wrapper = mount(About)
    const openButton = wrapper.get('.about-data-folder-button')

    expect(openButton.text()).toContain('データ保存先を開く')
    expect(wrapper.text()).toContain('PC 間の記録データの自動統合には対応していません')
    expect(wrapper.text()).toContain('甲ブラウザの起動中に双方向同期')

    await openButton.trigger('click')
    await flushPromises()

    expect(window.api.openDataFolder).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('データ保存先を開きました')
    expect(openButton.attributes('disabled')).toBeUndefined()
  })

  it('turns a data-folder failure into a retryable error', async () => {
    vi.mocked(window.api.openDataFolder)
      .mockRejectedValueOnce(new Error('open failed'))
      .mockResolvedValueOnce(undefined)
    const wrapper = mount(About)
    const openButton = wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('データ保存先を開く'))

    await openButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('データ保存先を開けませんでした')
    expect(openButton!.attributes('disabled')).toBeUndefined()

    await openButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('データ保存先を開きました')
    expect(window.api.openDataFolder).toHaveBeenCalledTimes(2)
  })

  it('times out a stalled data-folder request instead of waiting forever', async () => {
    vi.useFakeTimers()
    vi.mocked(window.api.openDataFolder).mockReturnValue(
      new Promise<void>(() => undefined)
    )
    const wrapper = mount(About)
    const openButton = wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('データ保存先を開く'))

    await openButton!.trigger('click')
    expect(wrapper.text()).toContain('データ保存先を開いています')
    expect(openButton!.attributes('disabled')).toBeDefined()

    await vi.advanceTimersByTimeAsync(PANEL_LOAD_TIMEOUT_MS)
    await flushPromises()

    expect(wrapper.text()).toContain('データ保存先を開けませんでした')
    expect(openButton!.attributes('disabled')).toBeUndefined()
  })

  it('creates a local account backup and shows its redacted summary', async () => {
    vi.mocked(window.api.createLocalAccountBackup).mockResolvedValue({
      status: 'created',
      bundleName: 'koubrowser-backup-example',
      databaseFiles: 9,
      profileFiles: 3,
      records: 42
    })
    const wrapper = mount(About)
    const backupButton = wrapper.get('.account-backup-button')

    expect(wrapper.get('.account-backup-warning').text()).toContain(
      'フォルダは暗号化されず'
    )
    expect(wrapper.get('.account-backup-warning').text()).toContain(
      '共有や同期用には使わず'
    )

    await backupButton.trigger('click')
    await flushPromises()

    expect(window.api.createLocalAccountBackup).toHaveBeenCalledOnce()
    expect(wrapper.get('.account-backup-state').text()).toContain(
      'koubrowser-backup-example を作成しました'
    )
    expect(wrapper.get('.account-backup-state').text()).toContain(
      'DB 9、設定 3、記録 42 件'
    )
    expect(backupButton.attributes('disabled')).toBeUndefined()
  })

  it('reports cancellation without treating it as a backup failure', async () => {
    const wrapper = mount(About)

    await wrapper.get('.account-backup-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.account-backup-state').text()).toBe(
      'バックアップをキャンセルしました。'
    )
  })

  it('turns a local backup failure into a retryable state', async () => {
    vi.mocked(window.api.createLocalAccountBackup)
      .mockRejectedValueOnce(new Error('backup failed'))
      .mockResolvedValueOnce({ status: 'cancelled' })
    const wrapper = mount(About)
    const backupButton = wrapper.get('.account-backup-button')

    await backupButton.trigger('click')
    await flushPromises()

    expect(wrapper.get('.account-backup-state').text()).toContain(
      'バックアップを作成できませんでした'
    )
    expect(backupButton.attributes('disabled')).toBeUndefined()

    await backupButton.trigger('click')
    await flushPromises()
    expect(wrapper.get('.account-backup-state').text()).toBe(
      'バックアップをキャンセルしました。'
    )
    expect(window.api.createLocalAccountBackup).toHaveBeenCalledTimes(2)
  })

  it('requires matching long passphrases and clears them after an encrypted export', async () => {
    vi.mocked(window.api.createEncryptedAccountTransfer).mockResolvedValue({
      status: 'created',
      fileName: 'account.koubrowser-transfer',
      bytes: 4096,
      databaseFiles: 9,
      profileFiles: 3,
      records: 42
    })
    const wrapper = mount(About)
    const passphrase = wrapper.get('.account-transfer-passphrase')
    const confirmation = wrapper.get(
      '.account-transfer-passphrase-confirmation'
    )
    const transferButton = wrapper.get('.account-transfer-button')

    expect(wrapper.get('.account-transfer-warning').text()).toContain(
      '忘れた場合は復旧できません'
    )
    expect(transferButton.attributes('disabled')).toBeDefined()

    await passphrase.setValue('十分に長い共有用の合言葉です')
    await confirmation.setValue('一致しない十分に長い合言葉')
    expect(wrapper.get('.account-transfer-passphrase-mismatch').text()).toBe(
      '合言葉が一致していません。'
    )
    expect(transferButton.attributes('disabled')).toBeDefined()

    await confirmation.setValue('十分に長い共有用の合言葉です')
    expect(
      wrapper.find('.account-transfer-passphrase-mismatch').exists()
    ).toBe(false)
    expect(transferButton.attributes('disabled')).toBeUndefined()

    await transferButton.trigger('click')
    await flushPromises()

    expect(window.api.createEncryptedAccountTransfer).toHaveBeenCalledWith(
      '十分に長い共有用の合言葉です'
    )
    expect(wrapper.get('.account-transfer-state').text()).toContain(
      'account.koubrowser-transfer に暗号化 transfer を保存しました'
    )
    expect(wrapper.get('.account-transfer-state').text()).toContain('42 件')
    expect((passphrase.element as HTMLInputElement).value).toBe('')
    expect((confirmation.element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).not.toContain('十分に長い共有用の合言葉です')
  })

  it('opens an encrypted transfer with one passphrase and reuses the safe preview', async () => {
    vi.mocked(window.api.inspectEncryptedAccountTransfer).mockResolvedValue({
      status: 'valid',
      bundleName: 'account.koubrowser-transfer',
      appVersion: '1.0.5',
      createdAt: '2026-07-30T12:34:56.000Z',
      accountMatch: 'same',
      databaseFiles: 9,
      profileFiles: 3,
      records: 42,
      databases: []
    })
    const wrapper = mount(About)
    const passphrase = wrapper.get(
      '.account-transfer-import-passphrase-input'
    )
    const inspectButton = wrapper.get('.account-transfer-inspect-button')

    expect(inspectButton.attributes('disabled')).toBeDefined()
    await passphrase.setValue('受け取り側で入力する長い合言葉')
    expect(inspectButton.attributes('disabled')).toBeUndefined()

    await inspectButton.trigger('click')
    await flushPromises()

    expect(window.api.inspectEncryptedAccountTransfer).toHaveBeenCalledWith(
      '受け取り側で入力する長い合言葉'
    )
    expect(wrapper.get('.account-backup-inspection-state').text()).toContain(
      'account.koubrowser-transfer'
    )
    expect(wrapper.get('.account-backup-inspection-match').text()).toContain(
      '現在ログイン中のアカウントと一致'
    )
    expect((passphrase.element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).not.toContain('受け取り側で入力する長い合言葉')
  })

  it('reports a wrong transfer passphrase without exposing it', async () => {
    vi.mocked(window.api.inspectEncryptedAccountTransfer).mockResolvedValue({
      status: 'invalid'
    })
    const wrapper = mount(About)
    const passphrase = wrapper.get(
      '.account-transfer-import-passphrase-input'
    )

    await passphrase.setValue('間違っているが十分に長い合言葉')
    await wrapper.get('.account-transfer-inspect-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.account-backup-inspection-state').text()).toContain(
      '合言葉が違うか'
    )
    expect(wrapper.get('.account-backup-inspection-state').text()).toContain(
      '現在のデータは変更されていません'
    )
    expect((passphrase.element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).not.toContain('間違っているが十分に長い合言葉')
  })

  it('shows a read-only valid backup preview for the same account', async () => {
    vi.mocked(window.api.inspectLocalAccountBackup).mockResolvedValue({
      status: 'valid',
      bundleName: 'koubrowser-backup-example',
      appVersion: '1.0.5',
      createdAt: '2026-07-30T12:34:56.000Z',
      accountMatch: 'same',
      databaseFiles: 9,
      profileFiles: 3,
      records: 42,
      databases: [
        {
          dbName: 'battle',
          incomingRecords: 20,
          add: 2,
          duplicate: 15,
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
            skip: 15,
            conflict: 2,
            conflictReasons: [{ group: 'result', records: 2 }],
            manualReview: 1,
            currentOnly: 4
          }
        },
        {
          dbName: 'quest',
          incomingRecords: 22,
          add: 5,
          duplicate: 17,
          legacyDuplicate: 0,
          conflict: 0,
          currentOnly: 1,
          mergePlan: {
            schemaVersion: 1,
            comparisonPolicyVersion: 1,
            conflictPolicyVersion: 1,
            conflictResolution: 'preserve-current-v1',
            mode: 'quest-monotonic-v1',
            sourceSha256: 'e'.repeat(64),
            currentStateSha256: 'f'.repeat(64),
            incomingStateSha256: '1'.repeat(64),
            decisionSha256: '2'.repeat(64),
            safeAdd: 0,
            skip: 0,
            conflict: 0,
            conflictReasons: [],
            manualReview: 22,
            currentOnly: 1
          }
        }
      ]
    })
    vi.mocked(window.api.prepareLocalAccountRestore).mockResolvedValue({
      status: 'scheduled',
      bundleName: '11111111-1111-4111-8111-111111111111'
    })
    vi.mocked(window.api.prepareLocalAccountMerge).mockResolvedValue({
      status: 'scheduled',
      bundleName: '11111111-1111-4111-8111-111111111111'
    })
    vi.mocked(window.api.saveAccountInspectionReport).mockResolvedValue({
      status: 'saved',
      fileName: 'koubrowser-account-inspection-20260730T123456Z.json'
    })
    const wrapper = mount(About)

    expect(wrapper.text()).toContain(
      '既存のバックアップフォルダを読み取り専用で検査します'
    )
    await wrapper.get('.account-backup-inspect-button').trigger('click')
    await flushPromises()

    expect(window.api.inspectLocalAccountBackup).toHaveBeenCalledOnce()
    expect(wrapper.get('.account-backup-inspection-state').text()).toContain(
      'koubrowser-backup-example は有効です'
    )
    expect(wrapper.get('.account-backup-inspection-state').text()).toContain(
      'アプリ: 1.0.5、DB 9、設定 3、記録 42 件'
    )
    expect(wrapper.get('.account-backup-inspection-match').text()).toBe(
      '現在ログイン中のアカウントと一致します。'
    )
    expect(wrapper.get('.account-backup-preview-description').text()).toContain(
      'まだ統合は行いません'
    )
    expect(
      wrapper
        .findAll('.account-backup-preview-table thead th')
        .map((header) => header.text())
    ).toEqual([
      'DB',
      'バックアップ内',
      '追加候補',
      '安全統合',
      '完全一致',
      '旧ID内容一致',
      '内容競合',
      '要確認',
      '現在のみ'
    ])
    const previewRows = wrapper.findAll('.account-backup-preview-table tbody tr')
    expect(previewRows).toHaveLength(2)
    expect(previewRows[0].text()).toContain('battle')
    expect(previewRows[0].text()).toContain('20')
    expect(previewRows[0].text()).toContain('15')
    expect(previewRows[0].findAll('td')[5].text()).toBe('1')
    expect(
      previewRows[0].get('.account-backup-conflict-reasons').text()
    ).toBe('結果: 2')
    expect(previewRows[1].find('.account-backup-conflict-reasons').exists())
      .toBe(false)

    expect(wrapper.get('.account-inspection-report-description').text())
      .toContain('アカウント・端末・bundle の識別子')
    await wrapper.get('.account-inspection-report-button').trigger('click')
    await flushPromises()
    expect(window.api.saveAccountInspectionReport).toHaveBeenCalledOnce()
    expect(wrapper.get('.account-inspection-report-state').text()).toContain(
      'koubrowser-account-inspection-20260730T123456Z.json'
    )

    expect(wrapper.get('.account-backup-merge-button').attributes('disabled'))
      .toBeUndefined()
    await wrapper.get('.account-backup-merge-button').trigger('click')
    await flushPromises()
    expect(window.api.prepareLocalAccountMerge).toHaveBeenCalledOnce()
    expect(wrapper.get('.account-backup-merge-state').text()).toContain(
      '安全な記録と任務進捗を統合する準備ができました'
    )

    await wrapper.get('.account-backup-restore-button').trigger('click')
    await flushPromises()
    expect(window.api.prepareLocalAccountRestore).toHaveBeenCalledOnce()
    expect(wrapper.get('.account-backup-restore-state').text()).toContain(
      '復元を準備しました'
    )
  })

  it('blocks account-mismatched backups in the read-only preview', async () => {
    vi.mocked(window.api.inspectLocalAccountBackup).mockResolvedValue({
      status: 'valid',
      bundleName: 'koubrowser-backup-other-account',
      appVersion: '1.0.5',
      createdAt: '2026-07-30T12:34:56.000Z',
      accountMatch: 'different',
      databaseFiles: 9,
      profileFiles: 3,
      records: 42,
      databases: []
    })
    const wrapper = mount(About)

    await wrapper.get('.account-backup-inspect-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.account-backup-inspection-match').text()).toContain(
      '現在ログイン中のアカウントとは一致しません'
    )
    expect(wrapper.get('.account-backup-inspection-match').text()).toContain(
      '復元対象にはできません'
    )
    expect(wrapper.find('.account-backup-preview-table').exists()).toBe(false)
  })

  it('disables merge when the preview has no safe additions', async () => {
    vi.mocked(window.api.inspectLocalAccountBackup).mockResolvedValue({
      status: 'valid',
      bundleName: 'koubrowser-backup-no-safe-add',
      appVersion: '1.0.5',
      createdAt: '2026-07-30T12:34:56.000Z',
      accountMatch: 'same',
      databaseFiles: 9,
      profileFiles: 3,
      records: 1,
      databases: [
        {
          dbName: 'quest',
          incomingRecords: 1,
          add: 1,
          duplicate: 0,
          legacyDuplicate: 0,
          conflict: 0,
          currentOnly: 0,
          mergePlan: {
            schemaVersion: 1,
            comparisonPolicyVersion: 1,
            conflictPolicyVersion: 1,
            conflictResolution: 'preserve-current-v1',
            mode: 'quest-monotonic-v1',
            sourceSha256: 'a'.repeat(64),
            currentStateSha256: 'b'.repeat(64),
            incomingStateSha256: 'c'.repeat(64),
            decisionSha256: 'd'.repeat(64),
            safeAdd: 0,
            skip: 0,
            conflict: 0,
            conflictReasons: [],
            manualReview: 1,
            currentOnly: 0
          }
        }
      ]
    })
    const wrapper = mount(About)

    await wrapper.get('.account-backup-inspect-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.account-backup-merge-button').attributes('disabled'))
      .toBeDefined()
    expect(wrapper.get('.account-backup-merge-empty').text()).toBe(
      '安全に統合できる記録や任務進捗はありません。'
    )
    expect(window.api.prepareLocalAccountMerge).not.toHaveBeenCalled()
  })

  it('shows and schedules an available merge rollback', async () => {
    vi.mocked(window.api.getAvailableAccountMergeRollback).mockResolvedValue({
      status: 'available',
      bundleName: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-07-30T12:34:56.000Z'
    })
    vi.mocked(window.api.prepareAccountMergeRollback).mockResolvedValue({
      status: 'scheduled',
      bundleName: '11111111-1111-4111-8111-111111111111'
    })
    const wrapper = mount(About)
    await flushPromises()

    expect(
      wrapper.get('.account-backup-merge-rollback-availability').text()
    ).toContain('統合前のデータが保管されています')
    await wrapper
      .get('.account-backup-merge-rollback-button')
      .trigger('click')
    await flushPromises()

    expect(window.api.prepareAccountMergeRollback).toHaveBeenCalledOnce()
    expect(
      wrapper.get('.account-backup-merge-rollback-state').text()
    ).toContain('統合前データへ戻す準備ができました')
  })

  it('shows and schedules an available merge redo', async () => {
    vi.mocked(window.api.getAvailableAccountMergeRedo).mockResolvedValue({
      status: 'available',
      bundleName: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-07-30T12:34:56.000Z'
    })
    vi.mocked(window.api.prepareAccountMergeRedo).mockResolvedValue({
      status: 'scheduled',
      bundleName: '11111111-1111-4111-8111-111111111111'
    })
    const wrapper = mount(About)
    await flushPromises()

    expect(
      wrapper.get('.account-backup-merge-redo-availability').text()
    ).toContain('再適用できる統合後データが保管されています')
    await wrapper.get('.account-backup-merge-redo-button').trigger('click')
    await flushPromises()

    expect(window.api.prepareAccountMergeRedo).toHaveBeenCalledOnce()
    expect(wrapper.get('.account-backup-merge-redo-state').text()).toContain(
      '統合後データを再適用する準備ができました'
    )
  })

  it('shows an available rollback and schedules it without exposing a path', async () => {
    vi.mocked(window.api.getAvailableAccountRollback).mockResolvedValue({
      status: 'available',
      bundleName: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-07-30T12:34:56.000Z'
    })
    vi.mocked(window.api.prepareAccountRollback).mockResolvedValue({
      status: 'scheduled',
      bundleName: '11111111-1111-4111-8111-111111111111'
    })
    const wrapper = mount(About)
    await flushPromises()

    expect(wrapper.get('.account-backup-retention-policy').text()).toContain(
      '最大 30 日、アカウントごと 3 世代、合計 2 GiB'
    )
    expect(window.api.getAvailableAccountRollback).toHaveBeenCalledOnce()
    expect(wrapper.get('.account-backup-rollback-availability').text()).toContain(
      '復元前のデータが保管されています'
    )
    expect(wrapper.get('.account-backup-rollback-availability').text()).toContain(
      '11111111-1111-4111-8111-111111111111'
    )

    await wrapper.get('.account-backup-rollback-button').trigger('click')
    await flushPromises()

    expect(window.api.prepareAccountRollback).toHaveBeenCalledWith()
    expect(wrapper.get('.account-backup-rollback-state').text()).toContain(
      '復元前データへ戻す準備ができました'
    )
  })

  it('shows available redo data and schedules it without exposing a path', async () => {
    vi.mocked(window.api.getAvailableAccountRedo).mockResolvedValue({
      status: 'available',
      bundleName: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-07-30T12:34:56.000Z'
    })
    vi.mocked(window.api.prepareAccountRedo).mockResolvedValue({
      status: 'scheduled',
      bundleName: '11111111-1111-4111-8111-111111111111'
    })
    const wrapper = mount(About)
    await flushPromises()

    expect(window.api.getAvailableAccountRedo).toHaveBeenCalledOnce()
    expect(wrapper.get('.account-backup-redo-availability').text()).toContain(
      '再適用できるデータが保管されています'
    )
    expect(wrapper.get('.account-backup-redo-availability').text()).toContain(
      '11111111-1111-4111-8111-111111111111'
    )

    await wrapper.get('.account-backup-redo-button').trigger('click')
    await flushPromises()

    expect(window.api.prepareAccountRedo).toHaveBeenCalledWith()
    expect(wrapper.get('.account-backup-redo-state').text()).toContain(
      'データを再適用する準備ができました'
    )
  })

  it('captures and compares a redacted account-data audit baseline', async () => {
    const summary = {
      capturedAt: '2026-07-30T12:34:56.000Z',
      databases: [
        { dbName: 'battle' as const, records: 20 },
        { dbName: 'quest' as const, records: 22 }
      ],
      profileFiles: 1,
      records: 42
    }
    vi.mocked(window.api.captureAccountAuditBaseline).mockResolvedValue({
      status: 'captured',
      summary
    })
    vi.mocked(window.api.compareAccountAuditBaseline).mockResolvedValue({
      status: 'different',
      summary,
      changedDatabases: ['quest'],
      changedProfiles: ['app.json']
    })
    const wrapper = mount(About)
    await flushPromises()

    expect(wrapper.get('.account-backup-audit').text()).toContain(
      '記録 DB は書き換えません'
    )
    await wrapper.get('.account-audit-capture-button').trigger('click')
    await flushPromises()

    expect(window.api.captureAccountAuditBaseline).toHaveBeenCalledOnce()
    expect(wrapper.get('.account-audit-state').text()).toContain(
      'DB 2、設定 1、記録 42 件'
    )
    expect(wrapper.findAll('.account-audit-table tbody tr')).toHaveLength(2)

    await wrapper.get('.account-audit-compare-button').trigger('click')
    await flushPromises()

    expect(window.api.compareAccountAuditBaseline).toHaveBeenCalledOnce()
    expect(wrapper.get('.account-audit-state').text()).toContain(
      '変更 DB: quest'
    )
    expect(wrapper.get('.account-audit-state').text()).toContain(
      '変更設定: app.json'
    )
  })

  it('reports a corrupt or unsupported backup as invalid', async () => {
    vi.mocked(window.api.inspectLocalAccountBackup).mockResolvedValue({
      status: 'invalid'
    })
    const wrapper = mount(About)

    await wrapper.get('.account-backup-inspect-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('.account-backup-inspection-state').text()).toContain(
      '有効なバックアップとして確認できませんでした'
    )
    expect(wrapper.get('.account-backup-inspection-state').text()).toContain(
      '破損、不完全、または未対応の形式'
    )
  })

  it('finishes a successful cache clear', async () => {
    const wrapper = mount(About)
    const clearButton = wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('ブラウザのキャッシュをクリア'))

    expect(clearButton).toBeDefined()
    await clearButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('キャッシュをクリアしました')
    expect(clearButton!.attributes('disabled')).toBeUndefined()
  })

  it('turns a cache-clear failure into a retryable error', async () => {
    vi.mocked(window.api.clearSessionCache)
      .mockRejectedValueOnce(new Error('cache failed'))
      .mockResolvedValueOnce(undefined)
    const wrapper = mount(About)
    const clearButton = wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('ブラウザのキャッシュをクリア'))

    await clearButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('キャッシュのクリアに失敗しました')
    expect(clearButton!.attributes('disabled')).toBeUndefined()

    await clearButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('キャッシュをクリアしました')
    expect(window.api.clearSessionCache).toHaveBeenCalledTimes(2)
  })

  it('times out a stalled cache clear instead of waiting forever', async () => {
    vi.useFakeTimers()
    vi.mocked(window.api.clearSessionCache).mockReturnValue(
      new Promise<void>(() => undefined)
    )
    const wrapper = mount(About)
    const clearButton = wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('ブラウザのキャッシュをクリア'))

    await clearButton!.trigger('click')
    expect(wrapper.text()).toContain('キャッシュをクリア中')
    expect(clearButton!.attributes('disabled')).toBeDefined()

    await vi.advanceTimersByTimeAsync(PANEL_LOAD_TIMEOUT_MS)
    await flushPromises()

    expect(wrapper.text()).toContain('キャッシュのクリアに失敗しました')
    expect(clearButton!.attributes('disabled')).toBeUndefined()
  })

  // スナップショットの確認
  // 以前テスト実行時の見た目スクリーンショットとの比較
  // 更新する必要がある場合、
  // vitest -u
  // で実行
  //
  // 例えば、文言を変えた場合など差分があれば検出される
  // その場合は、-uで更新する
  // 
  // スナップショットは変更多により現時点で行わない
  // it('matches snapshot', () => {
  //   const wrapper = mount(About)
  //   expect(wrapper.html()).toMatchSnapshot()
  // })

  // it('has expected class', () => {
  //   const wrapper = mount(About)
  //   expect(wrapper.classes()).toContain('甲ブラウザ')
  // })
})

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import OptionApp from '../OptionApp.vue'
import { defaultOptionSetting, type OptionData } from '@common/option'
import {
  optionLocale,
  setOptionSettingWithPreventSave
} from '@option/store/optionSetting'

beforeAll(() => {
  window.optionApi = {
    getCurrentSetting: vi.fn(),
    onLocaleChanged: vi.fn(() => vi.fn()),
    readyToShow: vi.fn(),
    selectCaptureSavePath: vi.fn(),
    selectExtensionPath: vi.fn(),
    minimize: vi.fn(),
    close: vi.fn(),
    saveSetting: vi.fn()
  }
})

beforeEach(() => {
  setOptionSettingWithPreventSave({
    locale: 'ja-JP',
    setting: defaultOptionSetting(),
    viewInfo: {
      defaultCaptureSavePath: 'C:\\capture'
    }
  })
})

describe('OptionApp localization shell', () => {
  it('keeps Japanese UI literals out of the option component', () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        'src/renderer/src/option/components/OptionApp.vue'
      ),
      'utf8'
    )
    const sourceWithoutComments = source
      .replace(/<!--[\s\S]*?-->/gu, '')
      .replace(/\/\/.*$/gmu, '')

    expect(sourceWithoutComments).not.toMatch(/[ぁ-んァ-ヶ一-龠]/u)
  })

  it('renders the resolved locale for the option shell and categories', async () => {
    const wrapper = mount(OptionApp)

    expect(wrapper.get('.option-title').text()).toBe('甲ブラウザ 設定')
    expect(wrapper.get('.option-sidebar').attributes('aria-label')).toBe('設定カテゴリ')
    expect(wrapper.findAll('.option-category').map((item) => item.text())).toEqual([
      '一般',
      '通信設定',
      '拡張機能'
    ])
    expect(wrapper.get('.header-desc-text').text()).toBe('基本的な動作に関する設定')

    await wrapper.findAll('.option-category')[1].trigger('click')
    expect(wrapper.get('.header-text').text()).toBe('通信設定')
    expect(wrapper.get('.header-desc-text').text()).toBe(
      'プロキシや通信動作に関する設定'
    )
  })

  it('renders all setting sections and accessible controls through the catalog', async () => {
    const wrapper = mount(OptionApp)

    expect(wrapper.text()).toContain('スクリーンショット・録画保存フォルダ')
    expect(wrapper.text()).toContain('ゲームの映像と音声を1200×720で録画します')
    const capturePathInput = wrapper.get<HTMLInputElement>('.option-path-input')
    expect(capturePathInput.attributes('aria-label')).toBe(
      'スクリーンショットと録画の保存先フォルダ'
    )
    expect(capturePathInput.attributes('placeholder')).toBe('保存先フォルダを選択')
    expect(wrapper.findAll('.option-path-button').map((button) => button.text())).toEqual([
      '参照',
      '既定値に戻す'
    ])

    await wrapper.findAll('.option-category')[1].trigger('click')
    expect(wrapper.text()).toContain('プロキシの使用方法')
    expect(wrapper.text()).toContain(
      '74EO などの Proxy 型ツールを使う場合は、そのツールの待受アドレスを固定プロキシに指定します'
    )
    expect(wrapper.text()).toContain(
      '甲ブラウザと外部ツールの両方が同じゲーム通信を観測できます'
    )
    expect(wrapper.text()).toContain(
      'この設定で甲ブラウザ自体がプロキシサーバーになることはありません'
    )
    expect(wrapper.text()).toContain(
      'サポートプロトコル: http, https, data 未サポートプロトコル: file'
    )
    expect(wrapper.get<HTMLInputElement>('input[type="url"]').attributes('placeholder')).toBe(
      '例: http://localhost:8080/proxy.pac'
    )
    expect(wrapper.get<HTMLInputElement>('input[type="text"]').attributes('aria-label')).toBe(
      '固定プロキシサーバー'
    )

    await wrapper.findAll('.option-category')[2].trigger('click')
    expect(wrapper.text()).toContain('読み込み設定')
    expect(wrapper.text()).toContain('信頼できる拡張機能のみを指定してください')
    const extensionPathInput = wrapper.get<HTMLInputElement>('.option-path-input')
    expect(extensionPathInput.attributes('aria-label')).toBe(
      '読み込む拡張機能フォルダ'
    )
    expect(extensionPathInput.attributes('placeholder')).toBe(
      '拡張機能フォルダを選択'
    )
    expect(wrapper.findAll('.option-path-button').map((button) => button.text())).toEqual([
      '参照',
      'クリア'
    ])
  })

  it('localizes the recoverable loading error shell', async () => {
    const wrapper = mount(OptionApp, {
      props: {
        isError: true
      }
    })

    expect(wrapper.get('.option-error-title').text()).toBe(
      '設定を読み込めませんでした'
    )
    expect(wrapper.get('.option-error-message').text()).toContain(
      '設定情報の取得中にエラーが発生しました'
    )

    await wrapper.get('.option-error-close-button').trigger('click')
    expect(window.optionApi.close).toHaveBeenCalled()
  })

  it('falls back to Japanese when option data contains an internal or unknown locale', () => {
    setOptionSettingWithPreventSave({
      locale: 'en-XA',
      setting: defaultOptionSetting(),
      viewInfo: {
        defaultCaptureSavePath: ''
      }
    } as unknown as OptionData)

    expect(optionLocale.value).toBe('ja-JP')
  })
})

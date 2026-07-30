import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createAppTranslator,
  InternalPseudoLocale
} from '@common/localization'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/main/kcbrowser.ts'),
  'utf8'
)
const optionPreloadSource = readFileSync(
  resolve(process.cwd(), 'src/preload/option-api.ts'),
  'utf8'
)
const optionRendererSource = readFileSync(
  resolve(process.cwd(), 'src/renderer/src/option/option.ts'),
  'utf8'
)

describe('main-process localization wiring', () => {
  it('routes window chrome, menus, and dialogs through the typed catalog', () => {
    expect(source).toContain("title: this.translate('app.name')")
    expect(source).toContain("this.translate('main.menu.file')")
    expect(source).toContain("this.translate('main.menu.forceReload')")
    expect(source).toContain("this.translate('main.recording.errorTitle')")
    expect(source).toContain("this.translate('main.csv.dialogTitle')")
    expect(source).toContain(
      "this.translate('accountBackup.transfer.dialogTitle')"
    )
    expect(source).toContain(
      "this.translate('accountBackup.transfer.inspectDialogTitle')"
    )
    expect(source).toContain(
      "this.translate('accountBackup.transfer.fileType')"
    )
    expect(source).toContain('this.updateLocalizedWindowChrome()')
    expect(source).toContain('OptionChannel.localeChanged')
    expect(source).toContain('this.option_window.webContents.send(')
  })

  it('does not retain the migrated Japanese literals at display callsites', () => {
    expect(source).not.toContain("dialog.showErrorBox('レコーディング失敗'")
    expect(source).not.toContain("label: 'キャッシュを無視してリロード'")
    expect(source).not.toContain("title: '甲ブラウザ'")
    expect(source).not.toContain("'パスがありません'")
  })

  it('renders main-process messages through the internal pseudo locale', () => {
    const translate = createAppTranslator(() => InternalPseudoLocale)

    expect(translate('main.recording.errorTitle')).toBe(
      '［レレココーーデディィンンググ失失敗敗］'
    )
    expect(translate('main.csv.pathUnavailable')).toBe(
      '［パパススががあありりまませせんん］'
    )
  })

  it('exposes a bounded, removable locale subscription to the option renderer', () => {
    expect(optionPreloadSource).toContain(
      'ipcRenderer.on(OptionChannel.localeChanged, handler)'
    )
    expect(optionPreloadSource).toContain(
      'ipcRenderer.removeListener(OptionChannel.localeChanged, handler)'
    )
    expect(optionPreloadSource).toContain('listener(normalizeAppLocale(locale))')
    expect(optionRendererSource).toContain(
      'window.optionApi.onLocaleChanged(setOptionLocale)'
    )
    expect(optionRendererSource).toContain(
      "window.addEventListener('beforeunload', stopLocaleSync, { once: true })"
    )
  })
})

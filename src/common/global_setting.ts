import { normalizeAppLocale, type AppLocale } from '@common/localization'

export const TitlebarColors = [
  'green',
  'navy',
  'graphite',
  'brown'
] as const
export type TitlebarColor = (typeof TitlebarColors)[number]

export function normalizeTitlebarColor(value: unknown): TitlebarColor {
  return TitlebarColors.includes(value as TitlebarColor)
    ? value as TitlebarColor
    : 'green'
}

export interface GlobalSetting {
  /**
   * アプリ UI の locale
   * デフォルトはja-JP
   */
  locale: AppLocale
  /**
   * 起動時にアプリ更新チェックを確認するか
   * デフォルトはtrue
   */
  checkUpdateOnStartup: boolean
  /**
   * Beta版(開発版)を更新チェック対象に含めるか
   * デフォルトはfalse
   */
  checkBetaUpdate: boolean
  /**
   * ドロップ情報を提供するか
   * デフォルトはtrue
   */
  enableIntake: boolean
  /**
   * アプリタイトルバーの配色
   * デフォルトはgreen
   */
  titlebarColor: TitlebarColor
}

export function defaultGlobalSetting(): GlobalSetting {
  return {
    locale: 'ja-JP',
    checkUpdateOnStartup: true,
    checkBetaUpdate: false,
    enableIntake: true,
    titlebarColor: 'green',
  }
}

export function normalizeGlobalSetting(setting: unknown): GlobalSetting {
  const defaults = defaultGlobalSetting()
  if (typeof setting !== 'object' || setting === null || Array.isArray(setting)) {
    return defaults
  }

  const stored = setting as Partial<GlobalSetting>
  return {
    ...defaults,
    ...stored,
    locale: normalizeAppLocale(stored.locale),
    checkUpdateOnStartup:
      typeof stored.checkUpdateOnStartup === 'boolean'
        ? stored.checkUpdateOnStartup
        : defaults.checkUpdateOnStartup,
    checkBetaUpdate:
      typeof stored.checkBetaUpdate === 'boolean'
        ? stored.checkBetaUpdate
        : defaults.checkBetaUpdate,
    enableIntake:
      typeof stored.enableIntake === 'boolean'
        ? stored.enableIntake
        : defaults.enableIntake,
    titlebarColor: normalizeTitlebarColor(stored.titlebarColor)
  }
}

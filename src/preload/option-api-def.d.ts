import type { AppLocale } from '@common/localization'
import type { OptionData, OptionSetting } from '@common/option'

export interface OptionApi {
  getCurrentSetting(): Promise<OptionData>
  onLocaleChanged(listener: (locale: AppLocale) => void): () => void
  readyToShow(): Promise<void>
  selectCaptureSavePath(): Promise<string | null>
  selectExtensionPath(): Promise<string | null>
  minimize(): Promise<void>
  close(): Promise<void>
  saveSetting(setting: OptionSetting): Promise<void>
}

declare global {
  interface Window {
    optionApi: OptionApi
  }
}

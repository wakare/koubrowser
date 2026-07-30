import { contextBridge, ipcRenderer } from 'electron'
import { OptionChannel } from '@common/channel'
import { type OptionSetting, type OptionData } from '@common/option'
import {
  normalizeAppLocale,
  type AppLocale
} from '@common/localization'
import { type OptionApi } from './option-api-def'

const optionApi: OptionApi = {
  getCurrentSetting(): Promise<OptionData> {
    return ipcRenderer.invoke(OptionChannel.getCurrentSetting)
  },
  onLocaleChanged(listener: (locale: AppLocale) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, locale: unknown): void => {
      listener(normalizeAppLocale(locale))
    }
    ipcRenderer.on(OptionChannel.localeChanged, handler)
    return () => ipcRenderer.removeListener(OptionChannel.localeChanged, handler)
  },
  readyToShow(): Promise<void> {
    return ipcRenderer.invoke(OptionChannel.readyToShow)
  },
  selectCaptureSavePath(): Promise<string | null> {
    return ipcRenderer.invoke(OptionChannel.selectCaptureSavePath)
  },
  selectExtensionPath(): Promise<string | null> {
    return ipcRenderer.invoke(OptionChannel.selectExtensionPath)
  },
  minimize(): Promise<void> {
    return ipcRenderer.invoke(OptionChannel.minimize)
  },
  close(): Promise<void> {
    return ipcRenderer.invoke(OptionChannel.close)
  },
  saveSetting(setting: OptionSetting): Promise<void> {
    return ipcRenderer.invoke(OptionChannel.saveSetting, setting)
  }
}

contextBridge.exposeInMainWorld('optionApi', optionApi)

import {
  formatAppNumber,
  type AppTranslator,
  type LocalizationLocale
} from '@common/localization'
import type { UpdateStateSnapshot } from '@common/type'

export interface UpdateViewText {
  readonly buttonText: string
  readonly stateText: string
  readonly stateSubText: string
}

export function resolveUpdateViewText(
  state: UpdateStateSnapshot,
  translate: AppTranslator,
  locale: LocalizationLocale
): UpdateViewText {
  const buttonText =
    state.status === 'available'
      ? translate('update.button.download')
      : state.status === 'ready'
        ? translate('update.button.restart')
        : translate('update.button.check')

  let stateText = ''
  let stateSubText = ''
  switch (state.status) {
    case 'idle':
      break
    case 'checking':
      stateText = translate('update.state.checking')
      break
    case 'available':
      stateText = translate('update.state.available', {
        params: { version: state.availableVersion }
      })
      break
    case 'latest':
      stateText = translate('update.state.latest')
      break
    case 'updating':
      stateText =
        state.downloadPercent === null
          ? translate('update.state.downloading')
          : translate('update.state.downloadingPercent', {
              params: {
                percent: formatAppNumber(state.downloadPercent, locale)
              }
            })
      break
    case 'ready':
      stateText = translate('update.state.ready')
      stateSubText = translate('update.state.readySubtext')
      break
    case 'error':
      stateText = state.errorMessage
        ? translate('update.state.errorWithDetail', {
            params: { message: state.errorMessage }
          })
        : translate('update.state.error')
      break
  }

  return {
    buttonText,
    stateText,
    stateSubText
  }
}

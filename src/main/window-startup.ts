import { isLayoutFixtureEnabled } from '@main/layout-fixture-env'

export const SmokeIpcEnvironmentVariable = 'KOUBROWSER_SMOKE_IPC'

interface StartupWindow {
  isDestroyed(): boolean
  once(event: 'ready-to-show', listener: () => void): unknown
  show(): void
}

export function shouldAutoShowMainWindow(environment: NodeJS.ProcessEnv = process.env): boolean {
  return (
    !isLayoutFixtureEnabled(environment) &&
    environment[SmokeIpcEnvironmentVariable] !== '1'
  )
}

/**
 * Keep startup-only geometry changes hidden. This avoids exposing the normal
 * bounds before a persisted maximized state is applied.
 *
 * Smoke runs retain explicit control of visibility so layout checks cannot
 * flash a real desktop window.
 */
export function showMainWindowWhenReady(
  window: StartupWindow,
  environment: NodeJS.ProcessEnv = process.env
): void {
  if (!shouldAutoShowMainWindow(environment)) {
    return
  }

  window.once('ready-to-show', () => {
    if (!window.isDestroyed()) {
      window.show()
    }
  })
}

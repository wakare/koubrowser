import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MainChannel } from '@common/channel'
import type { AssistPanelDiagnosticInput } from '@common/assist-diagnostic'
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

describe('assist diagnostic preload boundary', () => {
  let previousContextIsolated: PropertyDescriptor | undefined
  let api: Api

  beforeAll(async () => {
    previousContextIsolated = Object.getOwnPropertyDescriptor(process, 'contextIsolated')
    Object.defineProperty(process, 'contextIsolated', {
      configurable: true,
      value: true
    })
    await import('../../preload/index')
    api = preloadState.exposed.get('api') as Api
  })

  afterAll(() => {
    if (previousContextIsolated) {
      Object.defineProperty(process, 'contextIsolated', previousContextIsolated)
    } else {
      Reflect.deleteProperty(process, 'contextIsolated')
    }
  })

  beforeEach(() => {
    preloadState.invoke.mockReset()
  })

  it('passes only the structured diagnostic to the fixed save channel', async () => {
    preloadState.invoke.mockResolvedValueOnce({
      status: 'saved',
      fileName: 'diagnostic.json'
    })
    const diagnostic: AssistPanelDiagnosticInput = {
      schemaVersion: 1,
      occurredAt: '2026-07-30T12:00:00.000Z',
      panelName: 'missioncheck',
      phase: 'setup function',
      error: {
        name: 'TypeError',
        message: 'failed',
        stack: null
      }
    }

    await expect(api.saveAssistPanelDiagnostic(diagnostic)).resolves.toEqual({
      status: 'saved',
      fileName: 'diagnostic.json'
    })
    expect(preloadState.invoke).toHaveBeenCalledWith(
      MainChannel.save_assist_panel_diagnostic,
      diagnostic
    )
  })
})

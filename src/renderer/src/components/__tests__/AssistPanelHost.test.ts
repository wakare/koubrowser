import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const testState = vi.hoisted(() => ({
  attempts: 0,
  shouldFail: true
}))
const saveAssistPanelDiagnostic = vi.fn()

vi.mock('@renderer/stuff/app_ready', () => ({
  isAppReady: {
    value: true
  }
}))

vi.mock('../assist/panel-registry', async () => {
  const { defineComponent, h } = await import('vue')
  const failingOncePanel = defineComponent({
    name: 'FailingOncePanel',
    setup() {
      testState.attempts += 1
      if (testState.shouldFail) {
        throw new Error(
          'failed at C:\\Users\\Example\\AppData\\Roaming\\koubrowser\\private.json https://example.invalid/detail'
        )
      }
      return () => h('div', { class: 'recovered-panel' }, 'recovered')
    }
  })

  return {
    assistPanelComponents: new Proxy(
      {},
      {
        get: () => failingOncePanel
      }
    )
  }
})

describe('AssistPanelHost.vue', () => {
  beforeEach(() => {
    testState.attempts = 0
    testState.shouldFail = true
    saveAssistPanelDiagnostic.mockReset()
    saveAssistPanelDiagnostic.mockResolvedValue({
      status: 'saved',
      fileName: 'koubrowser-assist-diagnostic.json'
    })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        saveAssistPanelDiagnostic
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(window, 'api')
  })

  it('shows a local, redacted error state and remounts the panel on retry', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { default: AssistPanelHost } = await import('../assist/AssistPanelHost.vue')
    const wrapper = mount(AssistPanelHost, {
      props: {
        panelName: 'missioncheck'
      }
    })
    await wrapper.vm.$nextTick()

    const errorState = wrapper.get('.assist-panel-error')
    expect(errorState.attributes('role')).toBe('alert')
    expect(errorState.attributes('data-assist-panel')).toBe('missioncheck')
    expect(errorState.text()).toContain('遠征チェックを表示できませんでした')
    expect(errorState.text()).toContain('[ローカルパス]')
    expect(errorState.text()).toContain('[URL]')
    expect(errorState.text()).not.toContain('Users\\Example')
    expect(errorState.text()).not.toContain('example.invalid')
    expect(consoleError).not.toHaveBeenCalled()

    const saveButton = errorState
      .findAll('button')
      .find((button) => button.text() === '診断情報を保存')
    expect(saveButton).toBeDefined()
    await saveButton!.trigger('click')
    await flushPromises()

    expect(saveAssistPanelDiagnostic).toHaveBeenCalledOnce()
    expect(saveAssistPanelDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 1,
        panelName: 'missioncheck',
        phase: expect.any(String),
        error: expect.objectContaining({
          name: 'Error',
          message: expect.stringContaining('failed at C:\\Users\\Example'),
          stack: expect.any(String)
        })
      })
    )
    expect(errorState.get('.assist-diagnostic-status').text()).toContain(
      'koubrowser-assist-diagnostic.json'
    )

    testState.shouldFail = false
    const retryButton = errorState.findAll('button').find((button) => button.text() === '再試行')
    await retryButton!.trigger('click')

    expect(wrapper.find('.assist-panel-error').exists()).toBe(false)
    expect(wrapper.get('.recovered-panel').text()).toBe('recovered')
    expect(testState.attempts).toBe(2)
  })
})

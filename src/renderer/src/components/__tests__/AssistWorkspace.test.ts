import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'

vi.mock('../assist/AssistPanelHost.vue', () => ({
  default: {
    name: 'AssistPanelHost',
    props: ['panelName'],
    template: '<div :data-assist-panel="panelName" />'
  }
}))

describe('AssistWorkspace.vue', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined
    })
    vi.resetModules()
  })

  it('customizes visible panels, order, width, and restores defaults', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { default: AssistWorkspace } = await import('../assist/AssistWorkspace.vue')
    const wrapper = shallowMount(AssistWorkspace, {
      props: {
        area: 'secondary'
      }
    })

    expect(
      wrapper.findAll('.workspace-panel').map((panel) => panel.attributes('data-panel-name'))
    ).toEqual(['deckport', 'missioncheck', 'chart'])

    await wrapper.find('.workspace-layout-button').trigger('click')
    expect(wrapper.find('.workspace-layout-editor').exists()).toBe(true)

    const initialRows = wrapper.findAll('.workspace-layout-editor li')
    expect(initialRows.map((row) => row.attributes('data-layout-panel-name'))).toContain(
      'missioncheck'
    )
    await initialRows[1].find('button[title="前へ移動"]').trigger('click')

    expect(
      wrapper.findAll('.workspace-layout-editor li label span').map((label) => label.text())
    ).toEqual([
      '遠征チェック',
      '編成',
      '戦果戦闘履歴',
      '艦隊/装備アイテム',
      'ドロップ履歴（マップ別）',
      'ドロップ履歴（艦名別）',
      '任務ドック',
      '任務指引',
      '資源記録',
      'アプリ情報'
    ])
    expect(
      wrapper.findAll('.workspace-panel').map((panel) => panel.attributes('data-panel-name'))
    ).toEqual(['missioncheck', 'deckport', 'chart'])

    const reorderedRows = wrapper.findAll('.workspace-layout-editor li')
    await reorderedRows[0].find('input[type="checkbox"]').setValue(false)
    await reorderedRows[1].find('select').setValue('12')

    expect(
      wrapper.findAll('.workspace-panel').map((panel) => panel.attributes('data-panel-name'))
    ).toEqual(['deckport', 'chart'])
    expect(
      wrapper
        .find('.workspace-panel[data-panel-name="deckport"]')
        .attributes('data-workspace-columns')
    ).toBe('12')
    expect(wrapper.find('.workspace-layout-button').text()).toContain('変更済')
    expect(wrapper.find('.workspace-layout-button').attributes('aria-label')).toBe(
      'パネル配置（変更済）'
    )

    const persisted = localStorage.getItem('rendererState:main:workspace-layout')
    expect(persisted).toContain('"name":"missioncheck","visible":false')

    await wrapper.find('.workspace-layout-editor footer button').trigger('click')

    expect(
      wrapper.findAll('.workspace-panel').map((panel) => panel.attributes('data-panel-name'))
    ).toEqual(['deckport', 'missioncheck', 'chart'])
    expect(wrapper.find('.workspace-layout-button').text()).toBe('配置')
    expect(wrapper.find('.workspace-layout-button').attributes('aria-label')).toBe('パネル配置')
    expect(
      wrapper.find('.workspace-panel[data-panel-name="chart"]').attributes('data-workspace-columns')
    ).toBe('12')
    confirm.mockRestore()
  })

  it('creates and renames a persisted page with resizable panel settings', async () => {
    const { default: AssistWorkspace } = await import('../assist/AssistWorkspace.vue')
    const wrapper = shallowMount(AssistWorkspace, {
      props: {
        area: 'secondary'
      }
    })

    await wrapper.get('.workspace-add-page-button').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toContain('新しいページ 1')
    expect(wrapper.find('.workspace-layout-editor').exists()).toBe(true)

    const titleInput = wrapper.get('input[aria-label="ページ名"]')
    await titleInput.setValue('出撃準備')
    await titleInput.trigger('change')
    const heightSelect = wrapper.findAll('select[aria-label="パネル高さ"]')[0]
    await heightSelect.setValue('7')

    const activeTab = wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.attributes('aria-selected') === 'true')
    expect(activeTab?.text()).toBe('出撃準備')
    expect(wrapper.find('.workspace-panel').attributes('style')).toContain(
      '--workspace-panel-height: 7'
    )

    const persisted = JSON.parse(
      localStorage.getItem('rendererState:main:workspace-layout') ?? '{}'
    )
    expect(persisted.version).toBe(5)
    expect(
      persisted.pages.some(
        (page: { title: string; userCreated: boolean }) =>
          page.title === '出撃準備' && page.userCreated
      )
    ).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    wrapper.unmount()
  })

  it('renames a built-in page and restores its default title', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { default: AssistWorkspace } = await import('../assist/AssistWorkspace.vue')
    const wrapper = shallowMount(AssistWorkspace, {
      props: {
        area: 'secondary'
      }
    })

    await wrapper.get('.workspace-layout-button').trigger('click')
    const titleInput = wrapper.get('input[aria-label="ページ名"]')
    expect((titleInput.element as HTMLInputElement).value).toBe('運用')
    await titleInput.setValue('日常運用')
    await titleInput.trigger('change')

    expect(wrapper.findAll('[role="tab"]')[0].text()).toBe('日常運用')
    expect(localStorage.getItem('rendererState:main:workspace-layout')).toContain(
      '"title":"日常運用"'
    )

    await wrapper.get('.workspace-layout-editor footer button').trigger('click')
    expect(wrapper.findAll('[role="tab"]')[0].text()).toBe('運用')
    confirm.mockRestore()
  })

  it('snaps pointer resizing to saved grid width and height units', async () => {
    const { default: AssistWorkspace } = await import('../assist/AssistWorkspace.vue')
    const wrapper = shallowMount(AssistWorkspace, {
      props: {
        area: 'secondary'
      }
    })
    expect(wrapper.find('.workspace-layout-editor').exists()).toBe(false)
    expect(wrapper.find('.workspace-page-resize-handle').exists()).toBe(false)
    expect(wrapper.findAll('.workspace-panel-resize-handle')).toHaveLength(3)
    const grid = wrapper.get('.workspace-page-grid')
    Object.defineProperty(grid.element, 'clientWidth', {
      configurable: true,
      value: 1200
    })
    await wrapper
      .get('.workspace-panel[data-panel-name="deckport"] .workspace-panel-resize-handle')
      .trigger('pointerdown', { clientX: 0, clientY: 0 })
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 300, clientY: 144 }))
    await wrapper.vm.$nextTick()

    const resizingDeck = wrapper.get('.workspace-panel[data-panel-name="deckport"]')
    expect(resizingDeck.attributes('data-workspace-columns')).toBe('6')
    expect(resizingDeck.attributes('style')).toContain('--workspace-panel-width: 6')
    expect(resizingDeck.attributes('style')).toContain('--workspace-panel-height: 5')
    expect(resizingDeck.get('.workspace-panel-resize-preview').text()).toContain(
      '幅 9/12・高さ 7'
    )

    window.dispatchEvent(new MouseEvent('pointerup'))
    await wrapper.vm.$nextTick()

    const deck = wrapper.get('.workspace-panel[data-panel-name="deckport"]')
    expect(deck.attributes('data-workspace-columns')).toBe('9')
    expect(deck.attributes('style')).toContain('--workspace-panel-width: 9')
    expect(deck.attributes('style')).toContain('--workspace-panel-height: 7')
    expect(localStorage.getItem('rendererState:main:workspace-layout')).toContain(
      '"width":9,"height":7'
    )
    wrapper.unmount()
  })

  it('allows every panel to be hidden and keeps configuration reachable', async () => {
    const { default: AssistWorkspace } = await import('../assist/AssistWorkspace.vue')
    const wrapper = shallowMount(AssistWorkspace, {
      props: {
        area: 'secondary'
      }
    })

    await wrapper.get('.workspace-layout-button').trigger('click')
    const hideAll = wrapper
      .findAll('.workspace-layout-visibility-actions button')
      .find((button) => button.text() === 'すべて非表示')
    expect(hideAll).toBeDefined()
    await hideAll!.trigger('click')

    expect(wrapper.findAll('.workspace-panel')).toHaveLength(0)
    expect(wrapper.get('.workspace-page-empty').text()).toContain(
      'このページに表示するパネルはありません。'
    )
    expect(
      wrapper.findAll('.workspace-layout-editor input[type="checkbox"]').every(
        (checkbox) =>
          !(checkbox.element as HTMLInputElement).checked &&
          !(checkbox.element as HTMLInputElement).disabled
      )
    ).toBe(true)

    await wrapper.get('.workspace-layout-editor > header button').trigger('click')
    expect(wrapper.find('.workspace-layout-editor').exists()).toBe(false)
    await wrapper.get('.workspace-page-empty button').trigger('click')
    expect(wrapper.find('.workspace-layout-editor').exists()).toBe(true)

    const showAll = wrapper
      .findAll('.workspace-layout-visibility-actions button')
      .find((button) => button.text() === 'すべて表示')
    await showAll!.trigger('click')
    expect(wrapper.findAll('.workspace-panel')).toHaveLength(10)
    expect(localStorage.getItem('rendererState:main:workspace-layout')).toContain(
      '"name":"about","visible":true'
    )
  })

  it('removes an empty built-in page from the tab bar and restores it from configuration', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { default: AssistWorkspace } = await import('../assist/AssistWorkspace.vue')
    const wrapper = shallowMount(AssistWorkspace, {
      props: {
        area: 'secondary'
      }
    })

    const dropsTab = wrapper.findAll('[role="tab"]').find((tab) => tab.text() === 'ドロップ')
    await dropsTab!.trigger('click')
    await wrapper.get('.workspace-layout-button').trigger('click')
    const hideAll = wrapper
      .findAll('.workspace-layout-visibility-actions button')
      .find((button) => button.text() === 'すべて非表示')
    await hideAll!.trigger('click')
    await wrapper.get('.workspace-layout-editor > header button').trigger('click')
    await wrapper.get('.workspace-page-empty .is-danger').trigger('click')

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).not.toContain('ドロップ')
    expect(wrapper.get('[role="tabpanel"]').attributes('data-workspace-page')).toBe(
      'secondary-records'
    )
    expect(
      JSON.parse(localStorage.getItem('rendererState:main:workspace-layout') ?? '{}').pages.find(
        (page: { id: string }) => page.id === 'secondary-drops'
      ).visible
    ).toBe(false)

    await wrapper.get('.workspace-layout-button').trigger('click')
    expect(wrapper.get('.workspace-hidden-pages').text()).toContain('ドロップ')
    expect(
      wrapper
        .get('.workspace-hidden-pages li[data-workspace-page-id="secondary-drops"]')
        .attributes('data-workspace-page-id')
    ).toBe('secondary-drops')
    await wrapper
      .get('.workspace-hidden-pages li[data-workspace-page-id="secondary-drops"] button')
      .trigger('click')
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toContain('ドロップ')
    confirm.mockRestore()
  })

  it('offers every registered panel and custom pages in the assist window', async () => {
    const { default: AssistWorkspace } = await import('../assist/AssistWorkspace.vue')
    const wrapper = shallowMount(AssistWorkspace, {
      props: {
        area: 'assist'
      }
    })

    expect(wrapper.findAll('[role="tab"]')).toHaveLength(10)
    expect(wrapper.get('.workspace-panel').attributes('data-panel-name')).toBe('deckport')

    await wrapper.get('.workspace-add-page-button').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="tab"]')).toHaveLength(11)
    expect(wrapper.findAll('.workspace-layout-editor li')).toHaveLength(10)
    expect(wrapper.find('input[aria-label="ページ名"]').exists()).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    wrapper.unmount()
  })

  it('restores the last available secondary workspace page', async () => {
    localStorage.setItem(
      'panelViewState:main',
      JSON.stringify({
        version: 1,
        activeWorkspacePages: {
          secondary: 'secondary-records'
        },
        shipList: {
          filters: [],
          keyword: ''
        },
        slotitemList: {
          filterKeys: [],
          nameFilter: ''
        }
      })
    )
    const { default: AssistWorkspace } = await import('../assist/AssistWorkspace.vue')
    const wrapper = shallowMount(AssistWorkspace, {
      props: {
        area: 'secondary'
      }
    })

    expect(wrapper.get('[role="tabpanel"]').attributes('data-workspace-page')).toBe(
      'secondary-records'
    )
    expect(
      wrapper
        .findAll('[role="tab"]')
        .find((tab) => tab.attributes('aria-selected') === 'true')
        ?.text()
    ).toBe('戦闘・装備')
  })

  it('makes the quest guide reachable at compact height without persisting the temporary page', async () => {
    let compactHeightListener: ((event: MediaQueryListEvent) => void) | undefined
    const mediaQuery = {
      matches: true,
      media: '(max-height: 899px)',
      onchange: null,
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        compactHeightListener = listener
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    } as unknown as MediaQueryList
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => mediaQuery)
    })

    const { default: AssistWorkspace } = await import('../assist/AssistWorkspace.vue')
    const wrapper = shallowMount(AssistWorkspace, {
      props: {
        area: 'secondary'
      }
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      '運用',
      'ドック・任務',
      '戦闘・装備',
      'ドロップ',
      '任務'
    ])

    const statusTab = wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text() === 'ドック・任務')
    expect(statusTab).toBeDefined()
    await statusTab!.trigger('click')
    expect(wrapper.get('[role="tabpanel"]').attributes('data-workspace-page')).toBe(
      'secondary-status'
    )
    expect(wrapper.get('.workspace-panel').attributes('data-panel-name')).toBe(
      'dockquestlist'
    )

    const taskTab = wrapper.findAll('[role="tab"]').find((tab) => tab.text() === '任務')
    expect(taskTab).toBeDefined()
    await taskTab!.trigger('click')

    expect(wrapper.get('[role="tabpanel"]').attributes('data-workspace-page')).toBe(
      'secondary-tasks'
    )
    expect(wrapper.get('.workspace-panel').attributes('data-panel-name')).toBe('questguide')
    expect((wrapper.get('.workspace-layout-button').element as HTMLElement).style.display).not.toBe(
      'none'
    )
    await wrapper.get('.workspace-layout-button').trigger('click')
    expect(wrapper.findAll('.workspace-layout-editor li')).toHaveLength(10)
    expect(localStorage.getItem('panelViewState:main') ?? '').not.toContain('secondary-tasks')

    compactHeightListener?.({
      matches: false
    } as MediaQueryListEvent)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      '運用',
      'ドック・任務',
      '戦闘・装備',
      'ドロップ'
    ])
    expect(wrapper.get('[role="tabpanel"]').attributes('data-workspace-page')).toBe(
      'secondary-status'
    )
  })

  it('does not keep a second hidden quest guide mounted at compact height', async () => {
    let compactHeightListener: ((event: MediaQueryListEvent) => void) | undefined
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(
        () =>
          ({
            matches: true,
            media: '(max-height: 899px)',
            onchange: null,
            addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
              compactHeightListener = listener
            },
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn()
          }) as unknown as MediaQueryList
      )
    })

    const { default: AssistWorkspace } = await import('../assist/AssistWorkspace.vue')
    const wrapper = shallowMount(AssistWorkspace, {
      props: {
        area: 'primary'
      }
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.assist-workspace--primary').exists()).toBe(false)
    expect(wrapper.find('.workspace-panel[data-panel-name="questguide"]').exists()).toBe(false)

    compactHeightListener?.({
      matches: false
    } as MediaQueryListEvent)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.assist-workspace--primary').exists()).toBe(true)
    expect(wrapper.find('.workspace-panel[data-panel-name="questguide"]').exists()).toBe(true)
  })
})

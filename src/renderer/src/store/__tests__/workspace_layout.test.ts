import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/common/env-renderer', () => ({
  EnvRenderer: {
    isAssist: false
  }
}))

describe('workspace layout store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('creates, edits, persists, and deletes a user page', async () => {
    const store = await import('@renderer/store/workspace_layout')
    const pageId = store.createWorkspacePage('secondary', 'secondary-operations')

    expect(pageId).toMatch(/^user-/)
    store.renameWorkspacePage(pageId!, '出撃準備')
    store.setWorkspacePanelVisible(pageId!, 'battletab', true)
    store.setWorkspacePanelWidth(pageId!, 'deckport', 9)
    store.setWorkspacePanelHeight(pageId!, 'deckport', 7)
    store.reorderWorkspacePanelByName(pageId!, 'battletab', 'deckport')

    const saved = JSON.parse(localStorage.getItem('rendererState:main:workspace-layout') ?? '{}')
    expect(saved.version).toBe(5)
    expect(saved.pages.find((page: { id: string }) => page.id === pageId)).toMatchObject({
      title: '出撃準備',
      userCreated: true
    })

    vi.resetModules()
    const restoredStore = await import('@renderer/store/workspace_layout')
    const restored = restoredStore.getWorkspacePage(pageId!)
    expect(restored?.title).toBe('出撃準備')
    expect(restored?.panels.find((panel) => panel.name === 'deckport')).toMatchObject({
      width: 9,
      height: 7
    })
    expect(restored?.panels.findIndex((panel) => panel.name === 'battletab')).toBeLessThan(
      restored?.panels.findIndex((panel) => panel.name === 'deckport') ?? 0
    )

    const fallback = restoredStore.deleteWorkspacePage(pageId!)
    expect(fallback).toBeDefined()
    expect(restoredStore.getWorkspacePage(pageId!)).toBeUndefined()
  })

  it('exposes existing panels and clamps their independently saved sizes', async () => {
    const store = await import('@renderer/store/workspace_layout')
    const pageId = 'secondary-operations'

    expect(store.getWorkspacePageLayout(pageId)).toHaveLength(10)
    expect(
      store.getWorkspacePageLayout(pageId).find((panel) => panel.name === 'battletab')?.visible
    ).toBe(false)
    expect(
      store.getWorkspacePageLayout(pageId).find((panel) => panel.name === 'dockquestlist')?.visible
    ).toBe(false)

    store.setWorkspacePanelVisible(pageId, 'battletab', true)
    store.setWorkspacePanelSize(pageId, 'battletab', 99, 99)
    expect(
      store.getWorkspacePageLayout(pageId).find((panel) => panel.name === 'battletab')
    ).toMatchObject({ width: 12, height: 16 })
    expect(store.isWorkspacePageCustomized(pageId)).toBe(true)

    expect(
      store.getWorkspacePageLayout(pageId).find((panel) => panel.name === 'battletab')?.visible
    ).toBe(true)
    expect(store.isWorkspacePagePanelLayoutCustomized(pageId)).toBe(true)
  })

  it('persists a page with every panel hidden and allows panels to be restored', async () => {
    const store = await import('@renderer/store/workspace_layout')
    const pageId = 'secondary-operations'

    store.setAllWorkspacePanelsVisible(pageId, false)
    expect(store.getWorkspacePageLayout(pageId).every((panel) => !panel.visible)).toBe(true)

    vi.resetModules()
    const restoredStore = await import('@renderer/store/workspace_layout')
    expect(restoredStore.getWorkspacePageLayout(pageId).every((panel) => !panel.visible)).toBe(true)

    restoredStore.setWorkspacePanelVisible(pageId, 'chart', true)
    expect(
      restoredStore.getWorkspacePageLayout(pageId).find((panel) => panel.name === 'chart')?.visible
    ).toBe(true)
  })

  it('hides and restores an empty built-in page while protecting the last page', async () => {
    const store = await import('@renderer/store/workspace_layout')

    store.setAllWorkspacePanelsVisible('secondary-drops', false)
    expect(store.hideEmptyWorkspacePage('secondary-drops')).toBe('secondary-records')
    expect(store.getWorkspacePage('secondary-drops')?.visible).toBe(false)
    expect(store.getHiddenWorkspacePages('secondary').map((page) => page.id)).toContain(
      'secondary-drops'
    )

    vi.resetModules()
    const restoredStore = await import('@renderer/store/workspace_layout')
    expect(restoredStore.getWorkspacePage('secondary-drops')?.visible).toBe(false)
    restoredStore.restoreWorkspacePage('secondary-drops')
    expect(restoredStore.getWorkspacePage('secondary-drops')?.visible).toBe(true)

    restoredStore.setAllWorkspacePanelsVisible('primary-overview', false)
    expect(restoredStore.hideEmptyWorkspacePage('primary-overview')).toBe('primary-overview')
    expect(restoredStore.getWorkspacePage('primary-overview')?.visible).toBe(true)
  })

  it('renames a built-in page and restores the saved title after reload', async () => {
    const store = await import('@renderer/store/workspace_layout')

    store.renameWorkspacePage('secondary-operations', '日常運用')
    expect(store.getWorkspacePage('secondary-operations')?.title).toBe('日常運用')

    vi.resetModules()
    const restoredStore = await import('@renderer/store/workspace_layout')
    expect(restoredStore.getWorkspacePage('secondary-operations')?.title).toBe('日常運用')

    restoredStore.resetWorkspaceLayout()
    expect(restoredStore.getWorkspacePage('secondary-operations')?.title).toBe('運用')
  })

  it('keeps assist-window pages in an independently scoped layout', async () => {
    vi.doMock('@renderer/common/env-renderer', () => ({
      EnvRenderer: {
        isAssist: true
      }
    }))
    const store = await import('@renderer/store/workspace_layout')
    const pageId = store.createWorkspacePage('assist', 'assist-deckport')

    expect(pageId).toMatch(/^user-/)
    expect(localStorage.getItem('rendererState:assist:workspace-layout')).toContain(pageId)
    expect(localStorage.getItem('rendererState:main:workspace-layout')).toBeNull()
  })
})

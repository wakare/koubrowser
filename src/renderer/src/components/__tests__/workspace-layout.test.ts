import { describe, expect, it } from 'vitest'
import { createAppTranslator, InternalPseudoLocale } from '@common/localization'
import {
  WorkspaceLayoutVersion,
  createDefaultWorkspaceLayoutState,
  createDefaultWorkspacePageLayout,
  getWorkspacePageDisplayTitle,
  isDefaultWorkspacePageLayout,
  moveWorkspacePanel,
  normalizeWorkspaceLayoutState,
  normalizeWorkspacePageLayout
} from '../../common/workspace-layout'

describe('workspace layout', () => {
  it('derives stable defaults from panel metadata', () => {
    expect(createDefaultWorkspacePageLayout('secondary-operations')).toEqual([
      { name: 'deckport', visible: true, width: 6, height: 5 },
      { name: 'missioncheck', visible: true, width: 6, height: 5 },
      { name: 'battletab', visible: false, width: 6, height: 5 },
      { name: 'shipitems', visible: false, width: 6, height: 5 },
      { name: 'dropbymap', visible: false, width: 6, height: 5 },
      { name: 'dropbyship', visible: false, width: 6, height: 5 },
      { name: 'dockquestlist', visible: false, width: 6, height: 3 },
      { name: 'questguide', visible: false, width: 6, height: 5 },
      { name: 'chart', visible: true, width: 12, height: 3 },
      { name: 'about', visible: false, width: 6, height: 2 }
    ])
    expect(
      isDefaultWorkspacePageLayout(
        'secondary-operations',
        createDefaultWorkspacePageLayout('secondary-operations')
      )
    ).toBe(true)
    expect(createDefaultWorkspacePageLayout('secondary-status')).toEqual([
      { name: 'deckport', visible: false, width: 6, height: 5 },
      { name: 'missioncheck', visible: false, width: 6, height: 5 },
      { name: 'battletab', visible: false, width: 6, height: 5 },
      { name: 'shipitems', visible: false, width: 6, height: 5 },
      { name: 'dropbymap', visible: false, width: 6, height: 5 },
      { name: 'dropbyship', visible: false, width: 6, height: 5 },
      { name: 'dockquestlist', visible: true, width: 6, height: 3 },
      { name: 'questguide', visible: false, width: 6, height: 5 },
      { name: 'chart', visible: false, width: 12, height: 3 },
      { name: 'about', visible: false, width: 6, height: 2 }
    ])
    expect(createDefaultWorkspacePageLayout('secondary-tasks')).toEqual([
      { name: 'deckport', visible: false, width: 6, height: 5 },
      { name: 'missioncheck', visible: false, width: 6, height: 5 },
      { name: 'battletab', visible: false, width: 6, height: 5 },
      { name: 'shipitems', visible: false, width: 6, height: 5 },
      { name: 'dropbymap', visible: false, width: 6, height: 5 },
      { name: 'dropbyship', visible: false, width: 6, height: 5 },
      { name: 'dockquestlist', visible: false, width: 6, height: 3 },
      { name: 'questguide', visible: true, width: 6, height: 5 },
      { name: 'chart', visible: false, width: 12, height: 3 },
      { name: 'about', visible: false, width: 6, height: 2 }
    ])
  })

  it('keeps valid preferences and appends newly introduced panels', () => {
    const normalized = normalizeWorkspacePageLayout(
      [
        { name: 'chart', visible: false, width: 4 },
        { name: 'deckport', visible: true, span: 'full' },
        { name: 'unknown', visible: true, span: 'full' },
        { name: 'chart', visible: true, span: 'full' }
      ],
      'secondary-operations'
    )

    expect(normalized).toEqual([
      { name: 'chart', visible: false, width: 4, height: 3 },
      { name: 'deckport', visible: true, width: 12, height: 5 },
      { name: 'missioncheck', visible: true, width: 6, height: 5 },
      { name: 'battletab', visible: false, width: 6, height: 5 },
      { name: 'shipitems', visible: false, width: 6, height: 5 },
      { name: 'dropbymap', visible: false, width: 6, height: 5 },
      { name: 'dropbyship', visible: false, width: 6, height: 5 },
      { name: 'dockquestlist', visible: false, width: 6, height: 3 },
      { name: 'questguide', visible: false, width: 6, height: 5 },
      { name: 'about', visible: false, width: 6, height: 2 }
    ])
  })

  it('repairs invalid fields while preserving an entirely hidden page', () => {
    const normalized = normalizeWorkspacePageLayout(
      [
        { name: 'battletab', visible: false, width: 'invalid', span: 'invalid' },
        { name: 'shipitems', visible: false, span: 'full' }
      ],
      'secondary-records'
    )

    expect(normalized).toEqual([
      { name: 'battletab', visible: false, width: 6, height: 5 },
      { name: 'shipitems', visible: false, width: 12, height: 5 },
      { name: 'deckport', visible: false, width: 6, height: 5 },
      { name: 'missioncheck', visible: false, width: 6, height: 5 },
      { name: 'dropbymap', visible: false, width: 6, height: 5 },
      { name: 'dropbyship', visible: false, width: 6, height: 5 },
      { name: 'dockquestlist', visible: false, width: 6, height: 3 },
      { name: 'questguide', visible: false, width: 6, height: 5 },
      { name: 'chart', visible: false, width: 12, height: 3 },
      { name: 'about', visible: false, width: 6, height: 2 }
    ])
  })

  it('falls back safely when a persisted schema version is unsupported', () => {
    const defaults = createDefaultWorkspaceLayoutState()
    expect(normalizeWorkspaceLayoutState({ version: 99, pages: {} })).toEqual(defaults)
    expect(normalizeWorkspaceLayoutState(undefined).version).toBe(WorkspaceLayoutVersion)
  })

  it('adds the compact task page to a valid older layout record', () => {
    const migrated = normalizeWorkspaceLayoutState({
      version: 1,
      pages: {
        'secondary-operations': [{ name: 'deckport', visible: true, span: 'full' }]
      }
    })
    const taskPage = migrated.pages.find((page) => page.id === 'secondary-tasks')
    const operationsPage = migrated.pages.find((page) => page.id === 'secondary-operations')

    expect(taskPage?.panels).toEqual(createDefaultWorkspacePageLayout('secondary-tasks'))
    expect(operationsPage?.panels[0]).toEqual({
      name: 'deckport',
      visible: true,
      width: 12,
      height: 5
    })
  })

  it('migrates old span values and discards mistaken outer page sizes', () => {
    const migrated = normalizeWorkspaceLayoutState({
      version: 2,
      pages: [
        {
          id: 'secondary-operations',
          size: { width: 900, height: 700 },
          panels: createDefaultWorkspacePageLayout('secondary-operations')
        }
      ]
    })
    expect(migrated.version).toBe(5)
    expect(migrated.pages.find((page) => page.id === 'secondary-operations')).not.toHaveProperty(
      'size'
    )

    const normalized = normalizeWorkspaceLayoutState({
      version: 3,
      pages: [
        {
          id: 'secondary-operations',
          size: { width: 120, height: 9000 },
          panels: [
            { name: 'deckport', visible: true, span: 'single', height: 20 },
            { name: 'chart', visible: true, width: 99, height: 3 }
          ]
        }
      ]
    })
    const operations = normalized.pages.find((page) => page.id === 'secondary-operations')
    expect(operations).not.toHaveProperty('size')
    expect(operations?.panels.find((panel) => panel.name === 'deckport')).toMatchObject({
      width: 6,
      height: 16
    })
    expect(operations?.panels.find((panel) => panel.name === 'chart')?.width).toBe(12)
  })

  it('moves a panel without mutating the original layout', () => {
    const original = createDefaultWorkspacePageLayout('secondary-drops')
    const moved = moveWorkspacePanel(original, 'about', -1)

    expect(moved.map((panel) => panel.name)).toEqual([
      'deckport',
      'missioncheck',
      'battletab',
      'shipitems',
      'dropbymap',
      'dropbyship',
      'dockquestlist',
      'questguide',
      'about',
      'chart'
    ])
    expect(original.map((panel) => panel.name)).toEqual([
      'deckport',
      'missioncheck',
      'battletab',
      'shipitems',
      'dropbymap',
      'dropbyship',
      'dockquestlist',
      'questguide',
      'chart',
      'about'
    ])
    expect(moveWorkspacePanel(original, 'deckport', -1)).toBe(original)
  })

  it('persists hidden pages while keeping at least one page visible in each area', () => {
    const normalized = normalizeWorkspaceLayoutState({
      version: 5,
      pages: createDefaultWorkspaceLayoutState().pages.map((page) => ({
        ...page,
        visible: page.area !== 'secondary'
      }))
    })
    const secondaryPages = normalized.pages.filter((page) => page.area === 'secondary')

    expect(secondaryPages[0].visible).toBe(true)
    expect(secondaryPages.slice(1).every((page) => !page.visible)).toBe(true)

    const oneHidden = normalizeWorkspaceLayoutState({
      version: 5,
      pages: createDefaultWorkspaceLayoutState().pages.map((page) => ({
        ...page,
        visible: page.id !== 'secondary-drops'
      }))
    })
    expect(oneHidden.pages.find((page) => page.id === 'secondary-drops')?.visible).toBe(false)
  })

  it('normalizes saved titles for built-in pages', () => {
    const defaults = createDefaultWorkspaceLayoutState()
    const normalized = normalizeWorkspaceLayoutState({
      version: 5,
      pages: defaults.pages.map((page) => ({
        ...page,
        title: page.id === 'secondary-operations' ? '  日常運用  ' : page.title
      }))
    })

    expect(normalized.pages.find((page) => page.id === 'secondary-operations')?.title).toBe(
      '日常運用'
    )
  })

  it('localizes only untouched built-in page names and preserves user-owned names', () => {
    const pseudoTranslate = createAppTranslator(() => InternalPseudoLocale)
    const defaultPage = createDefaultWorkspaceLayoutState().pages.find(
      (page) => page.id === 'secondary-operations'
    )!

    expect(defaultPage.title).toBe('運用')
    expect(getWorkspacePageDisplayTitle(defaultPage, pseudoTranslate)).not.toBe(
      defaultPage.title
    )
    expect(
      getWorkspacePageDisplayTitle(
        { ...defaultPage, title: 'わたしの運用' },
        pseudoTranslate
      )
    ).toBe('わたしの運用')
    expect(
      getWorkspacePageDisplayTitle(
        {
          ...defaultPage,
          id: 'user-secondary-1',
          title: 'My fleet',
          userCreated: true
        },
        pseudoTranslate
      )
    ).toBe('My fleet')
  })
})

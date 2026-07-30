import { describe, expect, it } from 'vitest'
import { createAppTranslator, InternalPseudoLocale } from '@common/localization'
import {
  AssistPanelNames,
  getAssistPanelDefinitions,
  getAssistPanelTitle,
  getWorkspacePanelDefinitions,
  getWorkspacePageDefinitions,
  getWorkspacePageTitle
} from '../../common/assist-panel'

describe('assist panel definitions', () => {
  it('keeps one definition for every stable panel name', () => {
    const definitions = getAssistPanelDefinitions(true)
    expect(definitions.map((panel) => panel.name)).toEqual(AssistPanelNames)
    expect(new Set(definitions.map((panel) => panel.name)).size).toBe(AssistPanelNames.length)
  })

  it('only exposes the dock and quest summary in the standalone assist window', () => {
    expect(getAssistPanelDefinitions(false).some((panel) => panel.name === 'dockquestlist')).toBe(
      false
    )
    expect(getAssistPanelDefinitions(true).some((panel) => panel.name === 'dockquestlist')).toBe(
      true
    )
  })

  it('partitions every combined panel into one workspace area', () => {
    const combinedPanels = getAssistPanelDefinitions(false).map((panel) => panel.name)
    const primaryPanels = getWorkspacePanelDefinitions('primary').map((panel) => panel.name)
    const secondaryPanels = getWorkspacePanelDefinitions('secondary').map((panel) => panel.name)

    expect(primaryPanels).toEqual(['questguide'])
    expect(new Set([...primaryPanels, ...secondaryPanels])).toEqual(new Set(combinedPanels))
    expect(primaryPanels.filter((name) => secondaryPanels.includes(name))).toEqual([])
  })

  it('describes workspace size from panel information density', () => {
    const definitions = getAssistPanelDefinitions(false)
    const byName = new Map(definitions.map((panel) => [panel.name, panel.workspace]))

    expect(byName.get('about')).toEqual({
      area: 'secondary',
      pageId: 'secondary-drops',
      width: 'compact',
      height: 'compact'
    })
    expect(byName.get('missioncheck')?.width).toBe('wide')
    expect(byName.get('chart')).toEqual({
      area: 'secondary',
      pageId: 'secondary-operations',
      width: 'full',
      height: 'standard'
    })
    expect(byName.get('shipitems')?.width).toBe('wide')
    expect(byName.get('dropbyship')?.width).toBe('wide')
    expect(byName.get('dropbymap')?.width).toBe('standard')
  })

  it('groups combined panels into ordered workspace pages', () => {
    const primaryPages = getWorkspacePageDefinitions('primary')
    const secondaryPages = getWorkspacePageDefinitions('secondary')

    expect(primaryPages).toEqual([
      {
        id: 'primary-overview',
        area: 'primary',
        title: '任務指引',
        titleKeys: ['navigation.page.overview']
      }
    ])
    expect(secondaryPages.map((page) => page.id)).toEqual([
      'secondary-operations',
      'secondary-status',
      'secondary-records',
      'secondary-drops',
      'secondary-tasks'
    ])
    expect(
      getWorkspacePanelDefinitions('secondary', 'secondary-records').map((panel) => panel.name)
    ).toEqual(['battletab', 'shipitems'])
    expect(
      getWorkspacePanelDefinitions('secondary', 'secondary-drops').map((panel) => panel.name)
    ).toEqual(['dropbymap', 'dropbyship', 'about'])
    expect(
      getWorkspacePanelDefinitions('secondary', 'secondary-status').map((panel) => panel.name)
    ).toEqual(['dockquestlist'])
    expect(
      getWorkspacePanelDefinitions('secondary', 'secondary-tasks').map((panel) => panel.name)
    ).toEqual(['questguide'])
    expect(secondaryPages.at(-1)).toEqual({
      id: 'secondary-tasks',
      area: 'secondary',
      title: '任務',
      titleKeys: ['navigation.page.tasks'],
      compactHeightOnly: true
    })

    const pagesById = new Map([...primaryPages, ...secondaryPages].map((page) => [page.id, page]))
    getAssistPanelDefinitions(false).forEach((panel) => {
      expect(pagesById.get(panel.workspace.pageId)?.area).toBe(panel.workspace.area)
    })
  })

  it('provides one editable workspace page per standalone assist panel', () => {
    const assistPages = getWorkspacePageDefinitions('assist')
    expect(assistPages.map((page) => page.id)).toEqual(
      AssistPanelNames.map((name) => `assist-${name}`)
    )
    assistPages.forEach((page, index) => {
      expect(getWorkspacePanelDefinitions('assist', page.id).map((panel) => panel.name)).toEqual([
        AssistPanelNames[index]
      ])
    })
  })

  it('resolves classic tabs, workspace headers, and assist pages from one locale-aware catalog', () => {
    const pseudoTranslate = createAppTranslator(() => InternalPseudoLocale)
    const assistPages = new Map(
      getWorkspacePageDefinitions('assist').map((page) => [page.id, page])
    )

    getAssistPanelDefinitions(true).forEach((panel) => {
      const panelTitle = getAssistPanelTitle(panel, pseudoTranslate)
      const assistPage = assistPages.get(`assist-${panel.name}`)

      expect(assistPage).toBeDefined()
      expect(getWorkspacePageTitle(assistPage!, pseudoTranslate)).toBe(panelTitle)
      expect(panelTitle).toContain('［')
    })

    const operations = getWorkspacePageDefinitions('secondary').find(
      (page) => page.id === 'secondary-operations'
    )
    expect(getWorkspacePageTitle(operations!, pseudoTranslate)).not.toBe(
      operations!.title
    )
  })
})

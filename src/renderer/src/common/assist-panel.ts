import { translateAppMessage, type AppMessageKey, type AppTranslator } from '@common/localization'
import {
  AssistDiagnosticPanelNames,
  type AssistDiagnosticPanelName
} from '@common/assist-diagnostic'

export const AssistPanelNames = AssistDiagnosticPanelNames

export type AssistPanelName = AssistDiagnosticPanelName
export type AssistPanelLayoutKind = 'flow' | 'table' | 'canvas' | 'mixed'
export type AssistPanelWorkspaceArea = 'primary' | 'secondary' | 'assist'
export type AssistPanelWorkspaceWidth = 'compact' | 'standard' | 'wide' | 'full'
export type AssistPanelWorkspaceHeight = 'compact' | 'standard' | 'tall'
export type AssistPanelWorkspacePageId = string
type AssistNavigationMessageKey = Extract<AppMessageKey, `navigation.${string}`>

export interface AssistPanelWorkspaceLayout {
  readonly area: AssistPanelWorkspaceArea
  readonly pageId: AssistPanelWorkspacePageId
  readonly width: AssistPanelWorkspaceWidth
  readonly height: AssistPanelWorkspaceHeight
}

export interface AssistPanelWorkspacePageDefinition {
  readonly id: AssistPanelWorkspacePageId
  readonly area: AssistPanelWorkspaceArea
  readonly title: string
  readonly titleKeys: readonly AssistNavigationMessageKey[]
  readonly compactHeightOnly?: boolean
  readonly customizable?: boolean
}

export interface AssistPanelDefinition {
  readonly name: AssistPanelName
  readonly titleKeys: readonly AssistNavigationMessageKey[]
  readonly subtitleKey?: AssistNavigationMessageKey
  readonly standaloneOnly?: boolean
  readonly requiresAppReady: boolean
  readonly layoutKind: AssistPanelLayoutKind
  readonly workspace: AssistPanelWorkspaceLayout
}

const panelDefinitions: readonly AssistPanelDefinition[] = [
  {
    name: 'deckport',
    titleKeys: ['navigation.panel.deckport.line1'],
    requiresAppReady: true,
    layoutKind: 'mixed',
    workspace: {
      area: 'secondary',
      pageId: 'secondary-operations',
      width: 'wide',
      height: 'tall'
    }
  },
  {
    name: 'missioncheck',
    titleKeys: ['navigation.panel.missioncheck.line1', 'navigation.panel.missioncheck.line2'],
    requiresAppReady: true,
    layoutKind: 'table',
    workspace: {
      area: 'secondary',
      pageId: 'secondary-operations',
      width: 'wide',
      height: 'tall'
    }
  },
  {
    name: 'battletab',
    titleKeys: ['navigation.panel.battletab.line1', 'navigation.panel.battletab.line2'],
    requiresAppReady: true,
    layoutKind: 'mixed',
    workspace: {
      area: 'secondary',
      pageId: 'secondary-records',
      width: 'standard',
      height: 'tall'
    }
  },
  {
    name: 'shipitems',
    titleKeys: ['navigation.panel.shipitems.line1', 'navigation.panel.shipitems.line2'],
    requiresAppReady: true,
    layoutKind: 'table',
    workspace: {
      area: 'secondary',
      pageId: 'secondary-records',
      width: 'wide',
      height: 'tall'
    }
  },
  {
    name: 'dropbymap',
    titleKeys: ['navigation.panel.dropbymap.line1'],
    subtitleKey: 'navigation.panel.dropbymap.subtitle',
    requiresAppReady: true,
    layoutKind: 'canvas',
    workspace: {
      area: 'secondary',
      pageId: 'secondary-drops',
      width: 'standard',
      height: 'tall'
    }
  },
  {
    name: 'dropbyship',
    titleKeys: ['navigation.panel.dropbyship.line1'],
    subtitleKey: 'navigation.panel.dropbyship.subtitle',
    requiresAppReady: true,
    layoutKind: 'mixed',
    workspace: {
      area: 'secondary',
      pageId: 'secondary-drops',
      width: 'wide',
      height: 'tall'
    }
  },
  {
    name: 'dockquestlist',
    titleKeys: ['navigation.panel.dockquestlist.line1', 'navigation.panel.dockquestlist.line2'],
    standaloneOnly: true,
    requiresAppReady: true,
    layoutKind: 'flow',
    workspace: {
      area: 'secondary',
      pageId: 'secondary-status',
      width: 'standard',
      height: 'standard'
    }
  },
  {
    name: 'questguide',
    titleKeys: ['navigation.panel.questguide.line1', 'navigation.panel.questguide.line2'],
    requiresAppReady: true,
    layoutKind: 'flow',
    workspace: {
      area: 'primary',
      pageId: 'primary-overview',
      width: 'wide',
      height: 'tall'
    }
  },
  {
    name: 'chart',
    titleKeys: ['navigation.panel.chart.line1', 'navigation.panel.chart.line2'],
    requiresAppReady: true,
    layoutKind: 'flow',
    workspace: {
      area: 'secondary',
      pageId: 'secondary-operations',
      width: 'full',
      height: 'standard'
    }
  },
  {
    name: 'about',
    titleKeys: ['navigation.panel.about.line1', 'navigation.panel.about.line2'],
    requiresAppReady: false,
    layoutKind: 'flow',
    workspace: {
      area: 'secondary',
      pageId: 'secondary-drops',
      width: 'compact',
      height: 'compact'
    }
  }
]

const workspacePageDefinitions: readonly AssistPanelWorkspacePageDefinition[] = [
  {
    id: 'primary-overview',
    area: 'primary',
    title: '任務指引',
    titleKeys: ['navigation.page.overview']
  },
  {
    id: 'secondary-operations',
    area: 'secondary',
    title: '運用',
    titleKeys: ['navigation.page.operations']
  },
  {
    id: 'secondary-status',
    area: 'secondary',
    title: 'ドック・任務',
    titleKeys: ['navigation.page.status']
  },
  {
    id: 'secondary-records',
    area: 'secondary',
    title: '戦闘・装備',
    titleKeys: ['navigation.page.records']
  },
  {
    id: 'secondary-drops',
    area: 'secondary',
    title: 'ドロップ',
    titleKeys: ['navigation.page.drops']
  },
  {
    id: 'secondary-tasks',
    area: 'secondary',
    title: '任務',
    titleKeys: ['navigation.page.tasks'],
    compactHeightOnly: true
  },
  ...panelDefinitions.map((panel) => ({
    id: `assist-${panel.name}`,
    area: 'assist' as const,
    title: [
      ...panel.titleKeys.map((key) => translateAppMessage(key)),
      panel.subtitleKey ? translateAppMessage(panel.subtitleKey) : ''
    ].join(''),
    titleKeys: panel.subtitleKey ? [...panel.titleKeys, panel.subtitleKey] : panel.titleKeys
  }))
]

export function getAssistPanelDefinitions(
  isAssistWindow: boolean
): readonly AssistPanelDefinition[] {
  return panelDefinitions.filter((panel) => isAssistWindow || !panel.standaloneOnly)
}

export function getWorkspacePanelDefinitions(
  area: AssistPanelWorkspaceArea,
  pageId?: AssistPanelWorkspacePageId
): readonly AssistPanelDefinition[] {
  if (area === 'assist') {
    const defaultPanelName = pageId?.startsWith('assist-')
      ? pageId.slice('assist-'.length)
      : undefined
    return defaultPanelName && AssistPanelNames.includes(defaultPanelName as AssistPanelName)
      ? getAssistPanelDefinitions(true).filter((panel) => panel.name === defaultPanelName)
      : getAssistPanelDefinitions(true)
  }

  if (area === 'secondary' && pageId === 'secondary-tasks') {
    // The primary quest guide has no vertical space beside the fixed 720 px
    // game stage at the compact 752 px workspace minimum. Reuse the same
    // panel in a compact-only secondary page instead of making it unreachable.
    return getAssistPanelDefinitions(false).filter((panel) => panel.name === 'questguide')
  }

  if (area === 'secondary' && pageId === 'secondary-status') {
    return getAssistPanelDefinitions(true).filter((panel) => panel.name === 'dockquestlist')
  }

  return getAssistPanelDefinitions(false).filter(
    (panel) =>
      panel.workspace.area === area && (pageId === undefined || panel.workspace.pageId === pageId)
  )
}

export function getWorkspacePanelCatalog(
  area: AssistPanelWorkspaceArea
): readonly AssistPanelDefinition[] {
  return area === 'assist' || area === 'secondary'
    ? getAssistPanelDefinitions(true)
    : getAssistPanelDefinitions(false)
}

export function getWorkspacePageDefinitions(
  area: AssistPanelWorkspaceArea
): readonly AssistPanelWorkspacePageDefinition[] {
  return workspacePageDefinitions.filter((page) => page.area === area)
}

export function getAssistPanelTitleLines(
  panel: AssistPanelDefinition,
  translate: AppTranslator
): readonly string[] {
  return panel.titleKeys.map((key) => translate(key))
}

export function getAssistPanelSubtitle(
  panel: AssistPanelDefinition,
  translate: AppTranslator
): string | undefined {
  return panel.subtitleKey ? translate(panel.subtitleKey) : undefined
}

export function getAssistPanelTitle(
  panel: AssistPanelDefinition,
  translate: AppTranslator
): string {
  return [
    ...getAssistPanelTitleLines(panel, translate),
    getAssistPanelSubtitle(panel, translate) ?? ''
  ].join('')
}

export function getWorkspacePageTitle(
  page: AssistPanelWorkspacePageDefinition,
  translate: AppTranslator
): string {
  return page.titleKeys.map((key) => translate(key)).join('')
}

export function getAssistPanelHeaderClass(panel: AssistPanelDefinition): string | undefined {
  if (panel.subtitleKey) {
    return 'tab-with-subtitle'
  }
  return panel.titleKeys.length > 1 ? 'tab-with-title' : undefined
}

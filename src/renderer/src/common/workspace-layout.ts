import {
  getWorkspacePageDefinitions,
  getWorkspacePageTitle,
  getWorkspacePanelCatalog,
  getWorkspacePanelDefinitions,
  type AssistPanelName,
  type AssistPanelWorkspaceArea,
  type AssistPanelWorkspacePageId
} from '@renderer/common/assist-panel'
import type { AppTranslator } from '@common/localization'

export const WorkspacePanelHeightMin = 1
export const WorkspacePanelHeightMax = 16
export const WorkspacePanelWidthMin = 2
export const WorkspacePanelWidthMax = 12

export interface WorkspacePanelLayout {
  readonly name: AssistPanelName
  readonly visible: boolean
  readonly width: number
  readonly height: number
}

export interface WorkspacePageLayout {
  readonly id: AssistPanelWorkspacePageId
  readonly area: AssistPanelWorkspaceArea
  readonly title: string
  readonly userCreated: boolean
  readonly visible: boolean
  readonly panels: readonly WorkspacePanelLayout[]
}

export interface WorkspaceLayoutState {
  readonly version: 5
  readonly pages: readonly WorkspacePageLayout[]
}

export const WorkspaceLayoutVersion = 5
export const WorkspacePageLimit = 24
export const WorkspacePageTitleMaxLength = 40

const WorkspaceAreas: readonly AssistPanelWorkspaceArea[] = ['primary', 'secondary', 'assist']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isWorkspaceArea(value: unknown): value is AssistPanelWorkspaceArea {
  return WorkspaceAreas.includes(value as AssistPanelWorkspaceArea)
}

function normalizePanelHeight(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? Math.min(Math.max(value, WorkspacePanelHeightMin), WorkspacePanelHeightMax)
    : fallback
}

function normalizePanelWidth(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? Math.min(Math.max(value, WorkspacePanelWidthMin), WorkspacePanelWidthMax)
    : fallback
}

function legacySpanWidth(value: unknown): number | undefined {
  if (value === 'full') {
    return WorkspacePanelWidthMax
  }
  if (value === 'single') {
    return WorkspacePanelWidthMax / 2
  }
  return undefined
}

function normalizePageTitle(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }
  const title = value.trim().slice(0, WorkspacePageTitleMaxLength)
  return title || fallback
}

function getPageDefinition(pageId: AssistPanelWorkspacePageId) {
  return WorkspaceAreas.flatMap((area) => getWorkspacePageDefinitions(area)).find(
    (page) => page.id === pageId
  )
}

function getDefaultWidth(
  area: AssistPanelWorkspaceArea,
  pageId: AssistPanelWorkspacePageId,
  name: AssistPanelName
): number {
  if (area === 'primary' || area === 'assist') {
    return WorkspacePanelWidthMax
  }
  const panel =
    getWorkspacePanelDefinitions(area, pageId).find((definition) => definition.name === name) ??
    getWorkspacePanelCatalog(area).find((definition) => definition.name === name)
  return panel?.workspace.width === 'full'
    ? WorkspacePanelWidthMax
    : WorkspacePanelWidthMax / 2
}

function getDefaultHeight(
  area: AssistPanelWorkspaceArea,
  pageId: AssistPanelWorkspacePageId,
  name: AssistPanelName
): number {
  const panel =
    getWorkspacePanelDefinitions(area, pageId).find((definition) => definition.name === name) ??
    getWorkspacePanelCatalog(area).find((definition) => definition.name === name)

  switch (panel?.workspace.height) {
    case 'compact':
      return 2
    case 'standard':
      return 3
    default:
      return 5
  }
}

export function createDefaultWorkspacePageLayout(
  pageId: AssistPanelWorkspacePageId
): readonly WorkspacePanelLayout[] {
  const page = getPageDefinition(pageId)
  if (!page) {
    return []
  }
  const visiblePanelNames = new Set(
    getWorkspacePanelDefinitions(page.area, pageId).map((panel) => panel.name)
  )
  return getWorkspacePanelCatalog(page.area).map((panel) => ({
    name: panel.name,
    visible: visiblePanelNames.has(panel.name),
    width: getDefaultWidth(page.area, pageId, panel.name),
    height: getDefaultHeight(page.area, pageId, panel.name)
  }))
}

function createCustomPagePanelLayout(
  area: AssistPanelWorkspaceArea,
  source: readonly WorkspacePanelLayout[]
): readonly WorkspacePanelLayout[] {
  const sourceByName = new Map(source.map((panel) => [panel.name, panel]))
  const panels = getWorkspacePanelCatalog(area).map((panel) => {
    const saved = sourceByName.get(panel.name)
    return {
      name: panel.name,
      visible: saved?.visible ?? false,
      width:
        saved?.width ??
        (panel.workspace.width === 'full' ? WorkspacePanelWidthMax : WorkspacePanelWidthMax / 2),
      height: normalizePanelHeight(saved?.height, getDefaultHeight(area, '', panel.name))
    }
  })

  return panels
}

export function normalizeWorkspacePageLayout(
  value: unknown,
  pageId: AssistPanelWorkspacePageId,
  area?: AssistPanelWorkspaceArea
): readonly WorkspacePanelLayout[] {
  const page = getPageDefinition(pageId)
  const resolvedArea = area ?? page?.area
  if (!resolvedArea) {
    return []
  }

  const defaults = page
    ? createDefaultWorkspacePageLayout(pageId)
    : createCustomPagePanelLayout(resolvedArea, [])
  const defaultsByName = new Map(defaults.map((panel) => [panel.name, panel]))
  const seen = new Set<AssistPanelName>()
  const normalized: WorkspacePanelLayout[] = []

  if (Array.isArray(value)) {
    value.forEach((candidate) => {
      if (!isRecord(candidate) || typeof candidate.name !== 'string') {
        return
      }

      const fallback = defaultsByName.get(candidate.name as AssistPanelName)
      if (!fallback || seen.has(fallback.name)) {
        return
      }

      normalized.push({
        name: fallback.name,
        visible: typeof candidate.visible === 'boolean' ? candidate.visible : fallback.visible,
        width: normalizePanelWidth(
          candidate.width,
          legacySpanWidth(candidate.span) ?? fallback.width
        ),
        height: normalizePanelHeight(candidate.height, fallback.height)
      })
      seen.add(fallback.name)
    })
  }

  defaults.forEach((panel) => {
    if (!seen.has(panel.name)) {
      normalized.push(panel)
    }
  })

  return normalized
}

function createDefaultPageLayouts(): readonly WorkspacePageLayout[] {
  return WorkspaceAreas.flatMap((area) =>
    getWorkspacePageDefinitions(area).map((page) => ({
      id: page.id,
      area,
      title: page.title,
      userCreated: false,
      visible: true,
      panels: createDefaultWorkspacePageLayout(page.id)
    }))
  )
}

export function createDefaultWorkspaceLayoutState(): WorkspaceLayoutState {
  return {
    version: WorkspaceLayoutVersion,
    pages: createDefaultPageLayouts()
  }
}

export function getWorkspacePageDisplayTitle(
  page: WorkspacePageLayout,
  translate: AppTranslator
): string {
  const definition = getPageDefinition(page.id)
  return !page.userCreated && definition && page.title === definition.title
    ? getWorkspacePageTitle(definition, translate)
    : page.title
}

function normalizeVersionOneState(value: Record<string, unknown>): WorkspaceLayoutState {
  const defaults = createDefaultWorkspaceLayoutState()
  if (!isRecord(value.pages)) {
    return defaults
  }
  const savedPages = value.pages
  return {
    version: WorkspaceLayoutVersion,
    pages: defaults.pages.map((page) => ({
      ...page,
      panels: normalizeWorkspacePageLayout(savedPages[page.id], page.id, page.area)
    }))
  }
}

export function normalizeWorkspaceLayoutState(value: unknown): WorkspaceLayoutState {
  const defaults = createDefaultWorkspaceLayoutState()
  if (!isRecord(value)) {
    return defaults
  }
  if (value.version === 1) {
    return normalizeVersionOneState(value)
  }
  if (
    (value.version !== 2 &&
      value.version !== 3 &&
      value.version !== 4 &&
      value.version !== WorkspaceLayoutVersion) ||
    !Array.isArray(value.pages)
  ) {
    return defaults
  }

  const savedPages = value.pages.filter(isRecord)
  const savedById = new Map(
    savedPages
      .filter((page) => typeof page.id === 'string')
      .map((page) => [page.id as string, page])
  )
  const pages: WorkspacePageLayout[] = defaults.pages.map((fallback) => {
    const saved = savedById.get(fallback.id)
    return {
      ...fallback,
      title: normalizePageTitle(saved?.title, fallback.title),
      visible: typeof saved?.visible === 'boolean' ? saved.visible : fallback.visible,
      panels: normalizeWorkspacePageLayout(saved?.panels, fallback.id, fallback.area)
    }
  })

  const seenIds = new Set(pages.map((page) => page.id))
  const customPageCounts = new Map<AssistPanelWorkspaceArea, number>(
    WorkspaceAreas.map((area) => [area, 0])
  )
  savedPages.forEach((saved, index) => {
    if (
      saved.userCreated !== true ||
      typeof saved.id !== 'string' ||
      !saved.id.startsWith('user-') ||
      saved.id.length > 100 ||
      seenIds.has(saved.id) ||
      !isWorkspaceArea(saved.area) ||
      (customPageCounts.get(saved.area) ?? 0) >= WorkspacePageLimit
    ) {
      return
    }

    const fallbackTitle = `カスタム ${index + 1}`
    pages.push({
      id: saved.id,
      area: saved.area,
      title: normalizePageTitle(saved.title, fallbackTitle),
      userCreated: true,
      visible: typeof saved.visible === 'boolean' ? saved.visible : true,
      panels: normalizeWorkspacePageLayout(saved.panels, saved.id, saved.area)
    })
    seenIds.add(saved.id)
    customPageCounts.set(saved.area, (customPageCounts.get(saved.area) ?? 0) + 1)
  })

  WorkspaceAreas.forEach((area) => {
    if (pages.some((page) => page.area === area && page.visible)) {
      return
    }
    const fallbackIndex = pages.findIndex((page) => page.area === area)
    if (fallbackIndex >= 0) {
      pages[fallbackIndex] = { ...pages[fallbackIndex], visible: true }
    }
  })

  return {
    version: WorkspaceLayoutVersion,
    pages
  }
}

export function createCustomWorkspacePage(
  area: AssistPanelWorkspaceArea,
  id: string,
  title: string,
  source: readonly WorkspacePanelLayout[]
): WorkspacePageLayout {
  return {
    id,
    area,
    title: normalizePageTitle(title, '新しいページ'),
    userCreated: true,
    visible: true,
    panels: createCustomPagePanelLayout(area, source)
  }
}

export function normalizeWorkspacePageTitle(value: unknown): string {
  return normalizePageTitle(value, '新しいページ')
}

export function isDefaultWorkspacePageLayout(
  pageId: AssistPanelWorkspacePageId,
  layout: readonly WorkspacePanelLayout[]
): boolean {
  const defaults = createDefaultWorkspacePageLayout(pageId)
  return (
    layout.length === defaults.length &&
    layout.every((panel, index) => {
      const fallback = defaults[index]
      return (
        panel.name === fallback.name &&
        panel.visible === fallback.visible &&
        panel.width === fallback.width &&
        panel.height === fallback.height
      )
    })
  )
}

export function moveWorkspacePanel(
  layout: readonly WorkspacePanelLayout[],
  name: AssistPanelName,
  offset: -1 | 1
): readonly WorkspacePanelLayout[] {
  const index = layout.findIndex((panel) => panel.name === name)
  const destination = index + offset
  if (index < 0 || destination < 0 || destination >= layout.length) {
    return layout
  }

  const next = [...layout]
  const [panel] = next.splice(index, 1)
  next.splice(destination, 0, panel)
  return next
}

export function reorderWorkspacePanel(
  layout: readonly WorkspacePanelLayout[],
  sourceName: AssistPanelName,
  targetName: AssistPanelName
): readonly WorkspacePanelLayout[] {
  const sourceIndex = layout.findIndex((panel) => panel.name === sourceName)
  const targetIndex = layout.findIndex((panel) => panel.name === targetName)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return layout
  }
  const next = [...layout]
  const [panel] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, panel)
  return next
}

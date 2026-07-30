import { ref } from 'vue'
import {
  WorkspacePageLimit,
  WorkspacePanelHeightMax,
  WorkspacePanelHeightMin,
  WorkspacePanelWidthMax,
  WorkspacePanelWidthMin,
  createCustomWorkspacePage,
  createDefaultWorkspaceLayoutState,
  isDefaultWorkspacePageLayout,
  moveWorkspacePanel,
  normalizeWorkspaceLayoutState,
  normalizeWorkspacePageTitle,
  reorderWorkspacePanel,
  type WorkspaceLayoutState,
  type WorkspacePageLayout,
  type WorkspacePanelLayout
} from '@renderer/common/workspace-layout'
import type {
  AssistPanelName,
  AssistPanelWorkspaceArea,
  AssistPanelWorkspacePageId
} from '@renderer/common/assist-panel'
import { getLocalStoragePrefixKey, LocalStorageKeyName } from '@renderer/store/storage_key'

const LocalStorageKey = `${getLocalStoragePrefixKey(
  LocalStorageKeyName.prefix.rendererStatePrefix
)}:workspace-layout`

function loadWorkspaceLayout(): WorkspaceLayoutState {
  try {
    const json = localStorage.getItem(LocalStorageKey)
    return normalizeWorkspaceLayoutState(json ? JSON.parse(json) : undefined)
  } catch {
    return createDefaultWorkspaceLayoutState()
  }
}

const workspaceLayout = ref<WorkspaceLayoutState>(loadWorkspaceLayout())
let generatedPageSequence = 0

function saveWorkspaceLayout(): void {
  try {
    localStorage.setItem(LocalStorageKey, JSON.stringify(workspaceLayout.value))
  } catch {
    // Layout customization is optional; keep the in-memory state usable.
  }
}

function replacePages(pages: readonly WorkspacePageLayout[]): void {
  workspaceLayout.value = {
    version: workspaceLayout.value.version,
    pages
  }
  saveWorkspaceLayout()
}

function replacePage(pageId: AssistPanelWorkspacePageId, page: WorkspacePageLayout): void {
  replacePages(
    workspaceLayout.value.pages.map((candidate) => (candidate.id === pageId ? page : candidate))
  )
}

function replacePageLayout(
  pageId: AssistPanelWorkspacePageId,
  panels: readonly WorkspacePanelLayout[]
): void {
  const page = getWorkspacePage(pageId)
  if (page) {
    replacePage(pageId, { ...page, panels })
  }
}

function createPageId(): string {
  generatedPageSequence += 1
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${generatedPageSequence}`
  return `user-${randomPart}`
}

export function getWorkspacePages(area: AssistPanelWorkspaceArea): readonly WorkspacePageLayout[] {
  return workspaceLayout.value.pages.filter((page) => page.area === area)
}

export function getHiddenWorkspacePages(
  area: AssistPanelWorkspaceArea
): readonly WorkspacePageLayout[] {
  return getWorkspacePages(area).filter((page) => !page.visible)
}

export function getWorkspacePage(
  pageId: AssistPanelWorkspacePageId
): WorkspacePageLayout | undefined {
  return workspaceLayout.value.pages.find((page) => page.id === pageId)
}

export function getWorkspacePageLayout(
  pageId: AssistPanelWorkspacePageId
): readonly WorkspacePanelLayout[] {
  return getWorkspacePage(pageId)?.panels ?? []
}

export function isWorkspacePageCustomized(pageId: AssistPanelWorkspacePageId): boolean {
  return isWorkspacePagePanelLayoutCustomized(pageId)
}

export function isWorkspacePagePanelLayoutCustomized(
  pageId: AssistPanelWorkspacePageId
): boolean {
  const page = getWorkspacePage(pageId)
  return Boolean(page && (page.userCreated || !isDefaultWorkspacePageLayout(pageId, page.panels)))
}

export function createWorkspacePage(
  area: AssistPanelWorkspaceArea,
  sourcePageId?: AssistPanelWorkspacePageId
): AssistPanelWorkspacePageId | undefined {
  const areaPages = getWorkspacePages(area)
  if (areaPages.filter((page) => page.userCreated).length >= WorkspacePageLimit) {
    return undefined
  }
  const source = sourcePageId ? getWorkspacePage(sourcePageId) : undefined
  const title = `新しいページ ${areaPages.filter((page) => page.userCreated).length + 1}`
  const page = createCustomWorkspacePage(
    area,
    createPageId(),
    title,
    source?.area === area ? source.panels : []
  )
  replacePages([...workspaceLayout.value.pages, page])
  return page.id
}

export function duplicateWorkspacePage(
  sourcePageId: AssistPanelWorkspacePageId
): AssistPanelWorkspacePageId | undefined {
  const source = getWorkspacePage(sourcePageId)
  if (!source) {
    return undefined
  }
  const pageId = createWorkspacePage(source.area, source.id)
  if (pageId) {
    renameWorkspacePage(pageId, `${source.title} のコピー`)
  }
  return pageId
}

export function renameWorkspacePage(pageId: AssistPanelWorkspacePageId, title: string): void {
  const page = getWorkspacePage(pageId)
  if (!page) {
    return
  }
  replacePage(pageId, {
    ...page,
    title: normalizeWorkspacePageTitle(title)
  })
}

export function deleteWorkspacePage(
  pageId: AssistPanelWorkspacePageId
): AssistPanelWorkspacePageId | undefined {
  const page = getWorkspacePage(pageId)
  if (!page?.userCreated) {
    return pageId
  }
  const areaPages = getWorkspacePages(page.area).filter((candidate) => candidate.visible)
  if (page.visible && areaPages.length <= 1) {
    return pageId
  }
  const index = areaPages.findIndex((candidate) => candidate.id === pageId)
  const fallback = areaPages[index - 1] ?? areaPages[index + 1]
  replacePages(workspaceLayout.value.pages.filter((candidate) => candidate.id !== pageId))
  return fallback?.id
}

export function hideEmptyWorkspacePage(
  pageId: AssistPanelWorkspacePageId
): AssistPanelWorkspacePageId | undefined {
  const page = getWorkspacePage(pageId)
  if (!page || page.userCreated || !page.visible || page.panels.some((panel) => panel.visible)) {
    return pageId
  }
  const visiblePages = getWorkspacePages(page.area).filter((candidate) => candidate.visible)
  if (visiblePages.length <= 1) {
    return pageId
  }
  const index = visiblePages.findIndex((candidate) => candidate.id === pageId)
  const fallback = visiblePages[index - 1] ?? visiblePages[index + 1]
  replacePage(pageId, { ...page, visible: false })
  return fallback?.id
}

export function restoreWorkspacePage(pageId: AssistPanelWorkspacePageId): void {
  const page = getWorkspacePage(pageId)
  if (page && !page.visible) {
    replacePage(pageId, { ...page, visible: true })
  }
}

export function moveWorkspacePage(pageId: AssistPanelWorkspacePageId, offset: -1 | 1): void {
  const page = getWorkspacePage(pageId)
  if (!page?.userCreated) {
    return
  }
  const pages = [...workspaceLayout.value.pages]
  const index = pages.findIndex((candidate) => candidate.id === pageId)
  let destination = index + offset
  while (destination >= 0 && destination < pages.length && pages[destination].area !== page.area) {
    destination += offset
  }
  if (
    index < 0 ||
    destination < 0 ||
    destination >= pages.length ||
    pages[destination].area !== page.area
  ) {
    return
  }
  const [moved] = pages.splice(index, 1)
  pages.splice(destination, 0, moved)
  replacePages(pages)
}

export function moveWorkspacePanelByName(
  pageId: AssistPanelWorkspacePageId,
  name: AssistPanelName,
  offset: -1 | 1
): void {
  replacePageLayout(pageId, moveWorkspacePanel(getWorkspacePageLayout(pageId), name, offset))
}

export function reorderWorkspacePanelByName(
  pageId: AssistPanelWorkspacePageId,
  sourceName: AssistPanelName,
  targetName: AssistPanelName
): void {
  replacePageLayout(
    pageId,
    reorderWorkspacePanel(getWorkspacePageLayout(pageId), sourceName, targetName)
  )
}

export function setWorkspacePanelVisible(
  pageId: AssistPanelWorkspacePageId,
  name: AssistPanelName,
  visible: boolean
): void {
  const current = getWorkspacePageLayout(pageId)
  replacePageLayout(
    pageId,
    current.map((panel) => (panel.name === name ? { ...panel, visible } : panel))
  )
}

export function setAllWorkspacePanelsVisible(
  pageId: AssistPanelWorkspacePageId,
  visible: boolean
): void {
  replacePageLayout(
    pageId,
    getWorkspacePageLayout(pageId).map((panel) => ({ ...panel, visible }))
  )
}

export function setWorkspacePanelWidth(
  pageId: AssistPanelWorkspacePageId,
  name: AssistPanelName,
  width: number
): void {
  replacePageLayout(
    pageId,
    getWorkspacePageLayout(pageId).map((panel) =>
      panel.name === name
        ? {
            ...panel,
            width: Math.min(
              Math.max(Math.round(width), WorkspacePanelWidthMin),
              WorkspacePanelWidthMax
            )
          }
        : panel
    )
  )
}

export function setWorkspacePanelHeight(
  pageId: AssistPanelWorkspacePageId,
  name: AssistPanelName,
  height: number
): void {
  replacePageLayout(
    pageId,
    getWorkspacePageLayout(pageId).map((panel) =>
      panel.name === name
        ? {
            ...panel,
            height: Math.min(
              Math.max(Math.round(height), WorkspacePanelHeightMin),
              WorkspacePanelHeightMax
            )
          }
        : panel
    )
  )
}

export function setWorkspacePanelSize(
  pageId: AssistPanelWorkspacePageId,
  name: AssistPanelName,
  width: number,
  height: number
): void {
  replacePageLayout(
    pageId,
    getWorkspacePageLayout(pageId).map((panel) =>
      panel.name === name
        ? {
            ...panel,
            width: Math.min(
              Math.max(Math.round(width), WorkspacePanelWidthMin),
              WorkspacePanelWidthMax
            ),
            height: Math.min(
              Math.max(Math.round(height), WorkspacePanelHeightMin),
              WorkspacePanelHeightMax
            )
          }
        : panel
    )
  )
}

export function resetWorkspaceLayout(): void {
  workspaceLayout.value = createDefaultWorkspaceLayoutState()
  saveWorkspaceLayout()
}

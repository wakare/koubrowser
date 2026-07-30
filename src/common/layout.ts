import { Const } from './const'

/**
 * The dimensions of the existing combined game/assist layout.
 *
 * Keep the game stage fixed. Responsive workspace layouts may arrange assist
 * panels differently, but should use these metrics for classic compatibility.
 */
export const classicLayoutMetrics = Object.freeze({
  gameWidth: Const.GameWidth,
  gameHeight: Const.GameHeight + Const.GameBarHeight,
  assistWidth: Const.AssistWidth,
  assistBottomHeight: Const.AssistBottomHeight,
  titleBarHeight: Const.TitleBarHeight,
  mainContentWidth: Const.GameWidth + Const.AssistWidth,
  mainContentHeight: Const.GameHeight + Const.GameBarHeight + Const.AssistBottomHeight,
  mainWindowWidth: Const.GameWidth + Const.AssistWidth,
  mainWindowHeight:
    Const.GameHeight + Const.GameBarHeight + Const.AssistBottomHeight + Const.TitleBarHeight,
  gameOnlyWindowHeight: Const.GameHeight + Const.GameBarHeight + Const.TitleBarHeight
})

export const LayoutModes = ['classic', 'workspace'] as const
export type LayoutMode = (typeof LayoutModes)[number]

const workspaceGap = 12
// Keep enough space for a touch-friendly game surface on a 2880 × 1920
// Surface-class display at 200% Windows scaling (about 1440 logical px wide).
// Wider work areas retain the native 1200 × 720 game stage.
const workspaceGameMinWidth = 1000
const workspacePanelMinWidth = 280

export const workspaceLayoutMetrics = Object.freeze({
  minWindowWidth: workspaceGameMinWidth + workspacePanelMinWidth + workspaceGap * 3,
  minWindowHeight:
    Math.floor(
      workspaceGameMinWidth /
        (classicLayoutMetrics.gameWidth / classicLayoutMetrics.gameHeight)
    ) + classicLayoutMetrics.titleBarHeight,
  gameMinWidth: workspaceGameMinWidth,
  panelMinWidth: workspacePanelMinWidth,
  panelMinHeight: 520,
  gap: workspaceGap
})

export type LayoutSurface = 'classic-combined' | 'game-only' | 'assist-window' | 'workspace'

export interface LayoutWorkArea {
  width: number
  height: number
}

export interface LayoutRectangle extends LayoutWorkArea {
  x: number
  y: number
}

export interface LayoutDisplay {
  readonly id: number
  readonly bounds: LayoutRectangle
}

/**
 * A maximized frameless window on Windows may extend a few physical pixels
 * beyond the logical work area. Once it is already on the target display, let
 * the operating system own that geometry instead of repeatedly restoring and
 * maximizing it to make the rectangles match exactly.
 */
export function isInlineWindowSettledOnDisplay(
  currentDisplayId: number,
  targetDisplayId: number,
  currentBounds: LayoutRectangle,
  targetWorkArea: LayoutRectangle,
  maximized: boolean
): boolean {
  if (currentDisplayId !== targetDisplayId) {
    return false
  }

  if (maximized) {
    return true
  }

  return (
    currentBounds.x >= targetWorkArea.x &&
    currentBounds.y >= targetWorkArea.y &&
    currentBounds.x + currentBounds.width <= targetWorkArea.x + targetWorkArea.width &&
    currentBounds.y + currentBounds.height <= targetWorkArea.y + targetWorkArea.height
  )
}

export interface ResolvedInitialLayout {
  layoutMode: LayoutMode
  assistInGame: boolean
  requestedAssistInGame: boolean
  assistRestricted: boolean
}

export interface ResolvedDisplayLayout extends ResolvedInitialLayout {
  targetWorkAreaIndex?: number
}

export function isLayoutMode(value: unknown): value is LayoutMode {
  return LayoutModes.includes(value as LayoutMode)
}

export function workAreaSupportsLayout(workArea: LayoutWorkArea, layoutMode: LayoutMode): boolean {
  const required =
    layoutMode === 'workspace'
      ? {
          width: workspaceLayoutMetrics.minWindowWidth,
          height: workspaceLayoutMetrics.minWindowHeight
        }
      : {
          width: classicLayoutMetrics.mainWindowWidth,
          height: classicLayoutMetrics.mainWindowHeight
        }

  return workArea.width >= required.width && workArea.height >= required.height
}

export interface WorkspaceGameStage extends LayoutWorkArea {
  readonly scale: number
}

/**
 * Fit the game stage beside the minimum workspace panel.
 *
 * The game keeps its 5:3 aspect ratio and never grows beyond 1200 × 720.
 * Callers should first use workAreaSupportsLayout so the result never needs to
 * shrink below the touch-oriented workspace minimum.
 */
export function fitWorkspaceGameStage(windowSize: LayoutWorkArea): WorkspaceGameStage {
  const gameRatio = classicLayoutMetrics.gameWidth / classicLayoutMetrics.gameHeight
  const availableWidth = Math.max(
    1,
    windowSize.width - workspaceLayoutMetrics.panelMinWidth - workspaceLayoutMetrics.gap * 3
  )
  const availableHeight = Math.max(
    1,
    windowSize.height - classicLayoutMetrics.titleBarHeight
  )
  const width = Math.max(
    1,
    Math.min(
      classicLayoutMetrics.gameWidth,
      availableWidth,
      Math.floor(availableHeight * gameRatio)
    )
  )
  const scale = width / classicLayoutMetrics.gameWidth

  return {
    width,
    height: Math.floor(classicLayoutMetrics.gameHeight * scale),
    scale
  }
}

/**
 * Choose a display for an inline layout, preferring the display associated
 * with restored/current bounds only when its logical work area still fits.
 */
export function resolveInlineLayoutDisplayIndex(
  preferredWorkAreaIndex: number | undefined,
  layoutMode: LayoutMode,
  workAreas: readonly LayoutWorkArea[]
): number | undefined {
  const preferredWorkArea =
    preferredWorkAreaIndex === undefined ? undefined : workAreas[preferredWorkAreaIndex]
  if (preferredWorkArea && workAreaSupportsLayout(preferredWorkArea, layoutMode)) {
    return preferredWorkAreaIndex
  }

  const fallbackIndex = workAreas.findIndex((workArea) =>
    workAreaSupportsLayout(workArea, layoutMode)
  )
  return fallbackIndex < 0 ? undefined : fallbackIndex
}

/**
 * Choose where a classic assist view may be restored.
 *
 * A normal user-triggered show action stays on the current display and may
 * fall back to workspace mode there. Display-topology reconciliation can pass
 * a preferred display selected by resolveDisplayLayout so reconnecting a
 * capable monitor restores the resolved classic mode instead of accidentally
 * switching to workspace while the game-only window is still on a small
 * display.
 */
export function resolveClassicAssistDisplayIndex(
  currentWorkAreaIndex: number,
  preferredWorkAreaIndex: number | undefined,
  workAreas: readonly LayoutWorkArea[]
): number | undefined {
  const currentWorkArea = workAreas[currentWorkAreaIndex]
  if (currentWorkArea && workAreaSupportsLayout(currentWorkArea, 'classic')) {
    return currentWorkAreaIndex
  }

  if (preferredWorkAreaIndex === undefined) {
    return undefined
  }

  const preferredWorkArea = workAreas[preferredWorkAreaIndex]
  return preferredWorkArea && workAreaSupportsLayout(preferredWorkArea, 'classic')
    ? preferredWorkAreaIndex
    : undefined
}

export function rectangleIntersectionArea(first: LayoutRectangle, second: LayoutRectangle): number {
  const width = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x)
  )
  const height = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y)
  )
  return width * height
}

/**
 * Return the display with the largest visible part of the saved window.
 *
 * Electron's display list order is not a placement preference. Choosing the
 * first intersecting display can move a window to the wrong monitor when it
 * straddles displays or the display order changes after a DPI/topology update.
 */
export function findBestIntersectingRectangleIndex(
  bounds: LayoutRectangle,
  rectangles: readonly LayoutRectangle[]
): number | undefined {
  let bestIndex: number | undefined
  let bestArea = 0

  rectangles.forEach((rectangle, index) => {
    const area = rectangleIntersectionArea(bounds, rectangle)
    if (area > bestArea) {
      bestIndex = index
      bestArea = area
    }
  })

  return bestIndex
}

/**
 * Match Electron's current display against a freshly enumerated display list.
 *
 * During a live DPI or topology update Electron may briefly return a display
 * object whose id is no longer present in getAllDisplays(). Falling back to
 * the largest bounds overlap keeps the window on the same physical area
 * instead of silently treating display zero as current.
 */
export function findCurrentDisplayIndex(
  currentDisplay: LayoutDisplay,
  displays: readonly LayoutDisplay[]
): number {
  const idIndex = displays.findIndex((display) => display.id === currentDisplay.id)
  if (idIndex >= 0) {
    return idIndex
  }

  return (
    findBestIntersectingRectangleIndex(
      currentDisplay.bounds,
      displays.map((display) => display.bounds)
    ) ?? -1
  )
}

/**
 * Keep a window rectangle inside an Electron logical work area.
 *
 * The optional minimum is also expressed in logical pixels and is capped by
 * the work area, so a DPI or topology change can never make the result larger
 * than the display that must contain it.
 */
export function fitRectangleToWorkArea(
  bounds: LayoutRectangle,
  workArea: LayoutRectangle,
  minimum: LayoutWorkArea = { width: 1, height: 1 }
): LayoutRectangle {
  const minWidth = Math.min(Math.max(1, minimum.width), workArea.width)
  const minHeight = Math.min(Math.max(1, minimum.height), workArea.height)
  const width = Math.min(Math.max(bounds.width, minWidth), workArea.width)
  const height = Math.min(Math.max(bounds.height, minHeight), workArea.height)
  const maxX = workArea.x + Math.max(0, workArea.width - width)
  const maxY = workArea.y + Math.max(0, workArea.height - height)

  return {
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY),
    width,
    height
  }
}

/**
 * Fit the game-only window to a logical work area without changing the fixed
 * game-stage aspect ratio. The title bar is part of the returned window height
 * but not the scaled game content.
 */
export function fitGameOnlyWindowSize(
  requestedWidth: number,
  workArea: LayoutWorkArea,
  minimumWidth = 1
): LayoutWorkArea {
  const gameContentRatio = classicLayoutMetrics.gameWidth / classicLayoutMetrics.gameHeight
  const availableContentHeight = Math.max(1, workArea.height - classicLayoutMetrics.titleBarHeight)
  const maxWidthByHeight = Math.max(1, Math.floor(availableContentHeight * gameContentRatio))
  const maxWidth = Math.max(1, Math.min(workArea.width, maxWidthByHeight))
  const safeRequestedWidth =
    Number.isFinite(requestedWidth) && requestedWidth > 0
      ? requestedWidth
      : classicLayoutMetrics.gameWidth
  const safeMinimumWidth = Number.isFinite(minimumWidth) && minimumWidth > 0 ? minimumWidth : 1
  const width = Math.min(
    Math.max(safeRequestedWidth, Math.min(safeMinimumWidth, maxWidth)),
    maxWidth
  )
  const height = Math.min(
    workArea.height,
    Math.floor(width / gameContentRatio) + classicLayoutMetrics.titleBarHeight
  )

  return { width, height }
}

/**
 * Resolve persisted window preferences against the logical work areas Electron
 * exposes. This keeps high-DPI displays usable: a compact workspace can remain
 * available even when the legacy side-by-side layout no longer fits.
 */
export function resolveInitialLayout(
  requestedMode: LayoutMode,
  requestedAssistInGame: boolean,
  workAreas: readonly LayoutWorkArea[]
): ResolvedInitialLayout {
  const supportsWorkspace = workAreas.some((workArea) =>
    workAreaSupportsLayout(workArea, 'workspace')
  )
  const supportsClassic = workAreas.some((workArea) => workAreaSupportsLayout(workArea, 'classic'))

  if (requestedMode === 'workspace' && supportsWorkspace) {
    return {
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false
    }
  }

  if (requestedAssistInGame) {
    if (supportsClassic) {
      return {
        layoutMode: 'classic',
        assistInGame: true,
        requestedAssistInGame: true,
        assistRestricted: false
      }
    }

    if (supportsWorkspace) {
      return {
        layoutMode: 'workspace',
        assistInGame: true,
        requestedAssistInGame: true,
        assistRestricted: false
      }
    }
  }

  return {
    layoutMode: 'classic',
    assistInGame: false,
    requestedAssistInGame,
    assistRestricted: !supportsWorkspace && !supportsClassic
  }
}

/**
 * Reconcile an active layout after a display is added, removed, rotated, or
 * has its scale/work-area metrics changed.
 *
 * Prefer keeping the current inline layout on the current display. If that no
 * longer fits, keep the window on the current display by using the compact
 * workspace when possible, then try a capable secondary display. A game-only
 * preference remains game-only while inline layout availability is refreshed.
 */
export function resolveDisplayLayout(
  currentMode: LayoutMode,
  requestedAssistInGame: boolean,
  currentWorkAreaIndex: number,
  workAreas: readonly LayoutWorkArea[]
): ResolvedDisplayLayout {
  const currentWorkArea = workAreas[currentWorkAreaIndex]
  const findLayoutIndex = (mode: LayoutMode): number | undefined => {
    const index = workAreas.findIndex((workArea) => workAreaSupportsLayout(workArea, mode))
    return index < 0 ? undefined : index
  }

  const currentSupports = (mode: LayoutMode): boolean =>
    currentWorkArea !== undefined && workAreaSupportsLayout(currentWorkArea, mode)

  if (!requestedAssistInGame) {
    return {
      layoutMode: 'classic',
      assistInGame: false,
      requestedAssistInGame: false,
      assistRestricted:
        findLayoutIndex('workspace') === undefined && findLayoutIndex('classic') === undefined
    }
  }

  if (currentMode === 'workspace') {
    if (currentSupports('workspace')) {
      return {
        layoutMode: 'workspace',
        assistInGame: true,
        requestedAssistInGame: true,
        assistRestricted: false,
        targetWorkAreaIndex: currentWorkAreaIndex
      }
    }

    const workspaceIndex = findLayoutIndex('workspace')
    if (workspaceIndex !== undefined) {
      return {
        layoutMode: 'workspace',
        assistInGame: true,
        requestedAssistInGame: true,
        assistRestricted: false,
        targetWorkAreaIndex: workspaceIndex
      }
    }
  } else {
    if (currentSupports('classic')) {
      return {
        layoutMode: 'classic',
        assistInGame: true,
        requestedAssistInGame: true,
        assistRestricted: false,
        targetWorkAreaIndex: currentWorkAreaIndex
      }
    }

    // Avoid moving the game away from the display the user selected when the
    // compact workspace still fits there.
    if (currentSupports('workspace')) {
      return {
        layoutMode: 'workspace',
        assistInGame: true,
        requestedAssistInGame: true,
        assistRestricted: false,
        targetWorkAreaIndex: currentWorkAreaIndex
      }
    }

    const classicIndex = findLayoutIndex('classic')
    if (classicIndex !== undefined) {
      return {
        layoutMode: 'classic',
        assistInGame: true,
        requestedAssistInGame: true,
        assistRestricted: false,
        targetWorkAreaIndex: classicIndex
      }
    }

    const workspaceIndex = findLayoutIndex('workspace')
    if (workspaceIndex !== undefined) {
      return {
        layoutMode: 'workspace',
        assistInGame: true,
        requestedAssistInGame: true,
        assistRestricted: false,
        targetWorkAreaIndex: workspaceIndex
      }
    }
  }

  return {
    layoutMode: 'classic',
    assistInGame: false,
    requestedAssistInGame: true,
    assistRestricted: true
  }
}

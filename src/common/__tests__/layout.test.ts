import { describe, expect, it } from 'vitest'
import {
  classicLayoutMetrics,
  findBestIntersectingRectangleIndex,
  findCurrentDisplayIndex,
  fitGameOnlyWindowSize,
  fitRectangleToWorkArea,
  fitWorkspaceGameStage,
  isInlineWindowSettledOnDisplay,
  isLayoutMode,
  rectangleIntersectionArea,
  resolveClassicAssistDisplayIndex,
  resolveDisplayLayout,
  resolveInlineLayoutDisplayIndex,
  resolveInitialLayout,
  workAreaSupportsLayout,
  workspaceLayoutMetrics
} from '../layout'

describe('classic layout metrics', () => {
  it('keeps the current combined window geometry internally consistent', () => {
    expect(classicLayoutMetrics.gameWidth).toBe(1200)
    expect(classicLayoutMetrics.gameHeight).toBe(720)
    expect(classicLayoutMetrics.assistWidth).toBe(600)
    expect(classicLayoutMetrics.assistBottomHeight).toBe(168)
    expect(classicLayoutMetrics.titleBarHeight).toBe(32)

    expect(classicLayoutMetrics.mainContentWidth).toBe(
      classicLayoutMetrics.gameWidth + classicLayoutMetrics.assistWidth
    )
    expect(classicLayoutMetrics.mainContentHeight).toBe(
      classicLayoutMetrics.gameHeight + classicLayoutMetrics.assistBottomHeight
    )
    expect(classicLayoutMetrics.mainWindowWidth).toBe(1800)
    expect(classicLayoutMetrics.mainWindowHeight).toBe(920)
  })
})

describe('workspace layout policy', () => {
  it('keeps the fixed game stage and one assist panel reachable at the minimum workspace size', () => {
    expect(workspaceLayoutMetrics.minWindowWidth).toBe(
      workspaceLayoutMetrics.gameMinWidth +
        workspaceLayoutMetrics.panelMinWidth +
        workspaceLayoutMetrics.gap * 3
    )
    expect(workspaceLayoutMetrics.minWindowHeight).toBe(
      600 + classicLayoutMetrics.titleBarHeight
    )
    expect(workspaceLayoutMetrics.gameMinWidth).toBe(1000)
    expect(workspaceLayoutMetrics.panelMinWidth).toBe(280)
    expect(workspaceLayoutMetrics.minWindowWidth).toBe(1316)
    expect(workspaceLayoutMetrics.minWindowHeight).toBe(632)
  })

  it('accepts only persisted layout modes supported by this version', () => {
    expect(isLayoutMode('classic')).toBe(true)
    expect(isLayoutMode('workspace')).toBe(true)
    expect(isLayoutMode('future-layout')).toBe(false)
    expect(isLayoutMode(undefined)).toBe(false)
  })

  it('checks each layout against its actual logical work-area minimum', () => {
    expect(workAreaSupportsLayout({ width: 1920, height: 1040 }, 'classic')).toBe(true)
    expect(workAreaSupportsLayout({ width: 1920, height: 1040 }, 'workspace')).toBe(true)
    expect(workAreaSupportsLayout({ width: 1316, height: 632 }, 'classic')).toBe(false)
    expect(workAreaSupportsLayout({ width: 1316, height: 632 }, 'workspace')).toBe(true)
  })

  it('moves a restored inline layout off a display that no longer fits it', () => {
    const full = { width: 1920, height: 1040 }
    const compact = { width: 1536, height: 824 }

    expect(resolveInlineLayoutDisplayIndex(1, 'classic', [full, compact])).toBe(0)
    expect(resolveInlineLayoutDisplayIndex(1, 'workspace', [full, compact])).toBe(1)
    expect(resolveInlineLayoutDisplayIndex(undefined, 'classic', [compact, full])).toBe(1)
    expect(resolveInlineLayoutDisplayIndex(0, 'classic', [compact])).toBeUndefined()
  })

  it('falls back from classic combined view to the compact workspace', () => {
    expect(resolveInitialLayout('classic', true, [{ width: 1516, height: 752 }])).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false
    })
  })

  it('keeps issue #34 dual high-DPI displays in one compact workspace', () => {
    const logicalWorkAreas = [
      { width: 1536, height: 824 },
      { width: 1536, height: 920 }
    ]

    expect(resolveInitialLayout('classic', true, logicalWorkAreas)).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false
    })
    expect(resolveDisplayLayout('classic', true, 0, logicalWorkAreas)).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false,
      targetWorkAreaIndex: 0
    })
  })

  it('keeps a Surface Pro 11 at 200% scaling in one scaled workspace', () => {
    const surfaceLogicalWorkArea = { width: 1440, height: 928 }

    expect(resolveInitialLayout('classic', true, [surfaceLogicalWorkArea])).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false
    })
    expect(fitWorkspaceGameStage(surfaceLogicalWorkArea)).toEqual({
      width: 1124,
      height: 674,
      scale: 1124 / 1200
    })
  })

  it('uses the native game stage whenever the workspace is wide enough', () => {
    expect(fitWorkspaceGameStage({ width: 1516, height: 752 })).toEqual({
      width: 1200,
      height: 720,
      scale: 1
    })
  })

  it('preserves an explicitly requested game-only view when workspace remains available', () => {
    expect(resolveInitialLayout('classic', false, [{ width: 1516, height: 752 }])).toEqual({
      layoutMode: 'classic',
      assistInGame: false,
      requestedAssistInGame: false,
      assistRestricted: false
    })
  })

  it('uses separate windows only when neither inline layout can fit', () => {
    expect(resolveInitialLayout('workspace', true, [{ width: 1280, height: 720 }])).toEqual({
      layoutMode: 'classic',
      assistInGame: false,
      requestedAssistInGame: true,
      assistRestricted: true
    })
  })
})

describe('inline window display settlement', () => {
  const workArea = { x: 0, y: 0, width: 2560, height: 1392 }

  it('accepts the Windows frame overhang of a maximized window on the target display', () => {
    expect(
      isInlineWindowSettledOnDisplay(
        1,
        1,
        { x: -8, y: -8, width: 2576, height: 1408 },
        workArea,
        true
      )
    ).toBe(true)
  })

  it('still moves a maximized window when the target display is different', () => {
    expect(
      isInlineWindowSettledOnDisplay(
        1,
        2,
        { x: -8, y: -8, width: 2576, height: 1408 },
        workArea,
        true
      )
    ).toBe(false)
  })

  it('requires a restored window to remain fully inside the target work area', () => {
    expect(
      isInlineWindowSettledOnDisplay(
        1,
        1,
        { x: -1, y: 0, width: 1756, height: 900 },
        workArea,
        false
      )
    ).toBe(false)
    expect(
      isInlineWindowSettledOnDisplay(
        1,
        1,
        { x: 100, y: 100, width: 1756, height: 900 },
        workArea,
        false
      )
    ).toBe(true)
  })
})

describe('multi-display geometry', () => {
  const leftDisplay = {
    x: -1920,
    y: 0,
    width: 1920,
    height: 1080
  }
  const primaryDisplay = {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080
  }
  const rightDisplay = {
    x: 1920,
    y: 0,
    width: 1920,
    height: 1080
  }

  it('calculates overlap without treating edge contact as an intersection', () => {
    expect(
      rectangleIntersectionArea({ x: 1800, y: 100, width: 600, height: 500 }, primaryDisplay)
    ).toBe(120 * 500)
    expect(
      rectangleIntersectionArea({ x: 1920, y: 100, width: 600, height: 500 }, primaryDisplay)
    ).toBe(0)
  })

  it('selects the display containing the largest visible window area', () => {
    expect(
      findBestIntersectingRectangleIndex({ x: 1800, y: 100, width: 600, height: 500 }, [
        primaryDisplay,
        rightDisplay
      ])
    ).toBe(1)
  })

  it('supports negative display coordinates and rejects invisible bounds', () => {
    expect(
      findBestIntersectingRectangleIndex({ x: -1700, y: 100, width: 1200, height: 700 }, [
        primaryDisplay,
        leftDisplay
      ])
    ).toBe(1)
    expect(
      findBestIntersectingRectangleIndex({ x: 5000, y: 100, width: 800, height: 600 }, [
        primaryDisplay,
        rightDisplay
      ])
    ).toBeUndefined()
  })

  it('matches a current display by id before considering its bounds', () => {
    expect(
      findCurrentDisplayIndex({ id: 20, bounds: primaryDisplay }, [
        { id: 10, bounds: primaryDisplay },
        { id: 20, bounds: rightDisplay }
      ])
    ).toBe(1)
  })

  it('uses bounds overlap when a topology update invalidates the display id', () => {
    expect(
      findCurrentDisplayIndex(
        {
          id: 99,
          bounds: { x: 1800, y: 100, width: 600, height: 500 }
        },
        [
          { id: 10, bounds: primaryDisplay },
          { id: 20, bounds: rightDisplay }
        ]
      )
    ).toBe(1)
    expect(
      findCurrentDisplayIndex(
        {
          id: 99,
          bounds: { x: 5000, y: 100, width: 600, height: 500 }
        },
        [
          { id: 10, bounds: primaryDisplay },
          { id: 20, bounds: rightDisplay }
        ]
      )
    ).toBe(-1)
  })

  it('fits oversized bounds into negative logical work-area coordinates', () => {
    expect(
      fitRectangleToWorkArea(
        { x: -1800, y: -1000, width: 1900, height: 1100 },
        { x: -1536, y: -824, width: 1536, height: 824 }
      )
    ).toEqual({
      x: -1536,
      y: -824,
      width: 1536,
      height: 824
    })
  })

  it('honours a logical minimum without exceeding a compact high-DPI work area', () => {
    expect(
      fitRectangleToWorkArea(
        { x: 1500, y: 800, width: 200, height: 100 },
        { x: 0, y: 0, width: 1536, height: 836 },
        { width: 600, height: 480 }
      )
    ).toEqual({
      x: 936,
      y: 356,
      width: 600,
      height: 480
    })
  })

  it('fits game-only geometry by both logical width and height', () => {
    expect(fitGameOnlyWindowSize(1320, { width: 1920, height: 700 }, 600)).toEqual({
      width: 1113,
      height: 699
    })
    expect(fitGameOnlyWindowSize(1600, { width: 1366, height: 700 }, 600)).toEqual({
      width: 1113,
      height: 699
    })
    expect(fitGameOnlyWindowSize(1200, { width: 2560, height: 1392 }, 600)).toEqual({
      width: 1200,
      height: 752
    })
  })

  it('caps the game-only minimum on a work area smaller than that minimum', () => {
    const fitted = fitGameOnlyWindowSize(Number.NaN, { width: 500, height: 300 }, 600)

    expect(fitted).toEqual({
      width: 446,
      height: 299
    })
  })
})

describe('display topology reconciliation', () => {
  const compact = { width: 1536, height: 864 }
  const full = { width: 1920, height: 1040 }
  const small = { width: 1280, height: 720 }
  const portrait = { width: 1392, height: 2560 }

  it('keeps a supported active layout on its current display', () => {
    expect(resolveDisplayLayout('workspace', true, 1, [small, full])).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false,
      targetWorkAreaIndex: 1
    })
  })

  it('switches classic combined view to workspace on the same compact display', () => {
    expect(resolveDisplayLayout('classic', true, 0, [compact, full])).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false,
      targetWorkAreaIndex: 0
    })
  })

  it('moves an inline layout to a capable display when the current one becomes too small', () => {
    expect(resolveDisplayLayout('workspace', true, 0, [small, compact])).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false,
      targetWorkAreaIndex: 1
    })
    expect(resolveDisplayLayout('classic', true, 0, [small, full])).toEqual({
      layoutMode: 'classic',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false,
      targetWorkAreaIndex: 1
    })
  })

  it('falls back to game-only plus a separate assist window when no inline layout fits', () => {
    expect(resolveDisplayLayout('workspace', true, 0, [small])).toEqual({
      layoutMode: 'classic',
      assistInGame: false,
      requestedAssistInGame: true,
      assistRestricted: true
    })
  })

  it('preserves an explicit game-only preference while refreshing availability', () => {
    expect(resolveDisplayLayout('classic', false, 0, [small, full])).toEqual({
      layoutMode: 'classic',
      assistInGame: false,
      requestedAssistInGame: false,
      assistRestricted: false
    })
    expect(resolveDisplayLayout('classic', false, 0, [small])).toEqual({
      layoutMode: 'classic',
      assistInGame: false,
      requestedAssistInGame: false,
      assistRestricted: true
    })
  })

  it('recovers from a removed current display using the remaining logical work areas', () => {
    expect(resolveDisplayLayout('workspace', true, -1, [small, compact])).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false,
      targetWorkAreaIndex: 1
    })
  })

  it('uses logical work-area sizes for mixed-DPI layout decisions', () => {
    const fourKAt200Percent = { width: 1920, height: 1040 }
    const fourKAt250Percent = { width: 1536, height: 824 }

    expect(
      resolveDisplayLayout('classic', true, 1, [fourKAt200Percent, fourKAt250Percent])
    ).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false,
      targetWorkAreaIndex: 1
    })
  })

  it('keeps a scaled workspace on a portrait display when it remains wide enough', () => {
    const portraitFourKAt150Percent = { width: 1392, height: 2560 }
    const landscapeFourKAt150Percent = { width: 2560, height: 1392 }

    expect(
      resolveDisplayLayout('workspace', true, 0, [
        portraitFourKAt150Percent,
        landscapeFourKAt150Percent
      ])
    ).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false,
      targetWorkAreaIndex: 0
    })
  })

  it('keeps one scaled workspace on a 1392px-wide portrait display', () => {
    const portraitFourKAt150Percent = { width: 1392, height: 2560 }

    expect(resolveDisplayLayout('workspace', true, 0, [portraitFourKAt150Percent])).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false,
      targetWorkAreaIndex: 0
    })
  })

  it('recovers a requested inline workspace after a capable display returns', () => {
    const restricted = resolveDisplayLayout('workspace', true, 0, [small])

    expect(restricted.requestedAssistInGame).toBe(true)
    expect(
      resolveDisplayLayout(restricted.layoutMode, restricted.requestedAssistInGame, 0, [compact])
    ).toEqual({
      layoutMode: 'workspace',
      assistInGame: true,
      requestedAssistInGame: true,
      assistRestricted: false,
      targetWorkAreaIndex: 0
    })
  })

  it('restores classic assist on the capable display selected during reconciliation', () => {
    expect(resolveClassicAssistDisplayIndex(0, 1, [small, full])).toBe(1)
    expect(resolveClassicAssistDisplayIndex(1, 0, [small, full])).toBe(1)
  })

  it('does not silently choose another display without a reconciliation target', () => {
    expect(resolveClassicAssistDisplayIndex(0, undefined, [small, full])).toBeUndefined()
    expect(resolveClassicAssistDisplayIndex(0, 1, [small, compact])).toBeUndefined()
  })

  it('does not enable inline assist after capability returns for an explicit game-only preference', () => {
    const restricted = resolveDisplayLayout('classic', false, 0, [small])

    expect(
      resolveDisplayLayout(restricted.layoutMode, restricted.requestedAssistInGame, 0, [full])
    ).toEqual({
      layoutMode: 'classic',
      assistInGame: false,
      requestedAssistInGame: false,
      assistRestricted: false
    })
  })

  it('keeps every topology result internally placeable across the policy matrix', () => {
    const workAreaSets = [
      [],
      [small],
      [compact],
      [full],
      [portrait],
      [small, compact],
      [small, full],
      [portrait, compact],
      [portrait, full],
      [compact, full]
    ]

    for (const workAreas of workAreaSets) {
      for (const currentMode of ['classic', 'workspace'] as const) {
        for (const requestedAssistInGame of [false, true]) {
          for (
            let currentWorkAreaIndex = -1;
            currentWorkAreaIndex <= workAreas.length;
            currentWorkAreaIndex += 1
          ) {
            const resolved = resolveDisplayLayout(
              currentMode,
              requestedAssistInGame,
              currentWorkAreaIndex,
              workAreas
            )
            const supportsAnyInlineLayout = workAreas.some(
              (workArea) =>
                workAreaSupportsLayout(workArea, 'classic') ||
                workAreaSupportsLayout(workArea, 'workspace')
            )

            expect(resolved.requestedAssistInGame).toBe(requestedAssistInGame)
            expect(resolved.assistRestricted).toBe(!supportsAnyInlineLayout)

            if (resolved.assistInGame) {
              expect(resolved.assistRestricted).toBe(false)
              expect(resolved.targetWorkAreaIndex).toBeTypeOf('number')
              expect(
                workAreaSupportsLayout(
                  workAreas[resolved.targetWorkAreaIndex!],
                  resolved.layoutMode
                )
              ).toBe(true)
            } else {
              expect(resolved.layoutMode).toBe('classic')
              expect(resolved.targetWorkAreaIndex).toBeUndefined()
            }

            if (!requestedAssistInGame) {
              expect(resolved.assistInGame).toBe(false)
            } else if (supportsAnyInlineLayout) {
              expect(resolved.assistInGame).toBe(true)
            }
          }
        }
      }
    }
  })

  it('always selects a capable preferred or first fallback display for startup', () => {
    const workAreaSets = [
      [],
      [small],
      [compact],
      [full],
      [portrait, compact],
      [compact, full],
      [full, compact]
    ]

    for (const workAreas of workAreaSets) {
      for (const layoutMode of ['classic', 'workspace'] as const) {
        for (
          let preferredWorkAreaIndex = -1;
          preferredWorkAreaIndex <= workAreas.length;
          preferredWorkAreaIndex += 1
        ) {
          const selected = resolveInlineLayoutDisplayIndex(
            preferredWorkAreaIndex,
            layoutMode,
            workAreas
          )
          const preferred = workAreas[preferredWorkAreaIndex]
          const firstCapableIndex = workAreas.findIndex((workArea) =>
            workAreaSupportsLayout(workArea, layoutMode)
          )
          const expected =
            preferred && workAreaSupportsLayout(preferred, layoutMode)
              ? preferredWorkAreaIndex
              : firstCapableIndex < 0
                ? undefined
                : firstCapableIndex

          expect(selected).toBe(expected)
          if (selected !== undefined) {
            expect(workAreaSupportsLayout(workAreas[selected], layoutMode)).toBe(true)
          }
        }

        expect(resolveInlineLayoutDisplayIndex(undefined, layoutMode, workAreas)).toBe(
          (() => {
            const firstCapableIndex = workAreas.findIndex((workArea) =>
              workAreaSupportsLayout(workArea, layoutMode)
            )
            return firstCapableIndex < 0 ? undefined : firstCapableIndex
          })()
        )
      }
    }
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(resolve(process.cwd(), 'src/renderer/src/assets/main.scss'), 'utf8')
const assistStylesheet = readFileSync(
  resolve(process.cwd(), 'src/renderer/src/assets/assist.scss'),
  'utf8'
)

describe('workspace production CSS contract', () => {
  it('keeps the fixed game stage and workspace shell inside the viewport', () => {
    expect(stylesheet).toContain('--game-width: 1200px')
    expect(stylesheet).toContain('--game-height: 720px')
    expect(stylesheet).toMatch(
      /\.main-root\[data-layout-surface='workspace'\][\s\S]*?grid-template-columns:[\s\S]*?var\(--game-width\)[\s\S]*?minmax\(var\(--workspace-panel-min-width\), 1fr\)/
    )
    expect(stylesheet).toMatch(
      /\.main-root\[data-layout-surface='workspace'\][\s\S]*?\.main-content \{[\s\S]*?overflow: hidden/
    )
    expect(stylesheet).toMatch(
      /> \.game-content \{[\s\S]*?flex: 0 0 var\(--game-height\)[\s\S]*?width: var\(--game-width\)[\s\S]*?height: var\(--game-height\)[\s\S]*?overflow: hidden/
    )
  })

  it('contains pages while leaving overflow to each panel body', () => {
    expect(stylesheet).toMatch(
      /\.workspace-page-grid \{[\s\S]*?flex: 1 1 auto[\s\S]*?min-width: 0[\s\S]*?min-height: 0[\s\S]*?overflow: hidden/
    )
    expect(stylesheet).toMatch(
      /\.workspace-panel \{[\s\S]*?min-width: 0[\s\S]*?min-height: 0[\s\S]*?overflow: hidden/
    )
    expect(stylesheet).toMatch(
      /\.workspace-panel-body \{[\s\S]*?min-width: 0[\s\S]*?min-height: 0[\s\S]*?overflow: hidden/
    )
    expect(stylesheet).toMatch(
      /\.workspace-panel:not\(\[data-layout-kind='table'\]\)[\s\S]*?\.workspace-panel-body \{[\s\S]*?overflow: auto/
    )
    expect(stylesheet).toMatch(
      /\[data-workspace-page='secondary-tasks'\] \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/
    )
    expect(stylesheet).toMatch(
      /@media \(max-width: 2479px\)[\s\S]*?\.workspace-page-grid\[data-workspace-page='secondary-tasks'\] \{[\s\S]*?grid-template-rows: minmax\(0, 1fr\)/
    )
  })

  it('keeps configuration and compact-height fallbacks locally reachable', () => {
    expect(stylesheet).toMatch(
      /\.workspace-layout-editor \{[\s\S]*?z-index: 1000[\s\S]*?max-height: calc\(100% - 52px\)[\s\S]*?overflow: auto/
    )
    expect(stylesheet).toMatch(/\.workspace-panel \{[\s\S]*?isolation: isolate/)
    expect(stylesheet).toMatch(
      /@media \(max-width: 2479px\)[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/
    )
    expect(stylesheet).toMatch(
      /@media \(max-height: 1149px\)[\s\S]*?> \.assist-bottom-content \{[\s\S]*?display: none/
    )
    expect(stylesheet).toMatch(
      /@media \(max-height: 899px\)[\s\S]*?> \.assist-workspace--primary \{[\s\S]*?display: none/
    )
  })

  it('supports saved grid resizing in both workspace and assist windows', () => {
    expect(stylesheet).toMatch(
      /\.main-root\[data-layout-surface='assist-window'\][\s\S]*?\.assist-workspace--assist \{[\s\S]*?height: 100%/
    )
    expect(stylesheet).toMatch(
      /\.workspace-page-grid\[data-workspace-customized='true'\] \{[\s\S]*?grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)[\s\S]*?grid-auto-rows: 72px[\s\S]*?overflow: auto/
    )
    expect(stylesheet).toMatch(/grid-column: span var\(--workspace-panel-width, 6\)/)
    expect(stylesheet).toMatch(/grid-row: span var\(--workspace-panel-height, 3\)/)
    expect(stylesheet).toMatch(
      /\.workspace-panel-resize-preview \{[\s\S]*?z-index: 501[\s\S]*?pointer-events: none/
    )
    expect(stylesheet).toMatch(
      /\.workspace-page-viewport \{[\s\S]*?overflow: auto/
    )
    expect(stylesheet).toMatch(
      /\.workspace-page-empty \{[\s\S]*?grid-column: 1 \/ -1[\s\S]*?text-align: center/
    )
    expect(stylesheet).toMatch(
      /\.workspace-hidden-pages \{[\s\S]*?border-top:[\s\S]*?list-style: none/
    )
    expect(stylesheet).toMatch(
      /\.workspace-panel-resize-handle \{[\s\S]*?z-index: 500[\s\S]*?width: 28px[\s\S]*?cursor: nwse-resize/
    )
    expect(stylesheet).not.toContain('.workspace-page-resize-handle')
  })

  it('keeps page controls usable in the narrow high-DPI workspace band', () => {
    expect(stylesheet).toContain('--workspace-panel-min-width: 280px')
    expect(stylesheet).toMatch(
      /\.workspace-panel\[data-panel-name='dockquestlist'\][\s\S]*?\.assist-dock \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/
    )
    expect(stylesheet).toMatch(
      /\.workspace-panel\[data-panel-name='dockquestlist'\][\s\S]*?\.ndock-content,[\s\S]*?\.quest \{[\s\S]*?width: 100%/
    )
    expect(stylesheet).toMatch(
      /\.workspace-panel\[data-panel-name='dropbymap'\][\s\S]*?\.world-tabs > \.tabs \{[\s\S]*?overflow-x: auto[\s\S]*?overflow-y: hidden[\s\S]*?scrollbar-width: thin/
    )
    expect(stylesheet).toMatch(
      /@media \(max-width: 1755px\)[\s\S]*?\.workspace-page-tabs[\s\S]*?font-size: 11px[\s\S]*?\.workspace-layout-button \{[\s\S]*?flex-basis: 64px[\s\S]*?\.workspace-layout-button-status \{[\s\S]*?display: none/
    )
    expect(stylesheet).toMatch(
      /@media \(max-width: 1755px\)[\s\S]*?\.workspace-layout-editor \{[\s\S]*?padding: 8px/
    )
  })

  it('allows flow-panel application controls to wrap at compact widths', () => {
    expect(assistStylesheet).toMatch(
      /\.about-root \{[\s\S]*?\.button-in-about \{[\s\S]*?max-width: 100%[\s\S]*?button \{[\s\S]*?max-width: 100%[\s\S]*?white-space: normal[\s\S]*?overflow-wrap: anywhere/
    )
    expect(assistStylesheet).toMatch(/\.about-container \{[\s\S]*?width: 100%[\s\S]*?min-width: 0/)
    expect(assistStylesheet).toMatch(/\.about-block \{[\s\S]*?min-width: 0/)
  })
})

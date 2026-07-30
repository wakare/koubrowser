export interface ApplicationZoomInput {
  readonly type: string
  readonly key: string
  readonly code: string
  readonly control: boolean
  readonly alt: boolean
  readonly meta: boolean
}

export interface ApplicationZoomEvent {
  preventDefault(): void
}

export interface ApplicationZoomContents {
  getZoomFactor(): number
  setZoomFactor(factor: number): void
}

const ZoomShortcutCodes = new Set([
  'Minus',
  'Equal',
  'Digit0',
  'NumpadSubtract',
  'NumpadAdd',
  'Numpad0',
  'NumpadEqual'
])

const ZoomShortcutKeys = new Set(['-', '+', '=', '0', 'Add', 'Subtract'])

/**
 * The application owns both outer-window geometry and the game webview zoom.
 * Chromium page-zoom shortcuts would desynchronize those two calculations.
 */
export function isApplicationZoomShortcut(input: ApplicationZoomInput): boolean {
  return (
    input.type === 'keyDown' &&
    (input.control || input.meta) &&
    !input.alt &&
    (ZoomShortcutCodes.has(input.code) || ZoomShortcutKeys.has(input.key))
  )
}

export function restoreApplicationZoom(
  event: ApplicationZoomEvent,
  contents: ApplicationZoomContents,
  expectedZoomFactor: number
): void {
  event.preventDefault()
  const factor =
    Number.isFinite(expectedZoomFactor) && expectedZoomFactor > 0
      ? expectedZoomFactor
      : 1
  if (contents.getZoomFactor() !== factor) {
    contents.setZoomFactor(factor)
  }
}

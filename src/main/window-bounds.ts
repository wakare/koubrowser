import type { Rectangle } from 'electron'

interface WindowBoundsWriter {
  getBounds(): Rectangle
  setBounds(bounds: Rectangle, animate?: boolean): void
}

export function setWindowBoundsIfChanged(
  window: WindowBoundsWriter,
  nextBounds: Rectangle
): boolean {
  const currentBounds = window.getBounds()
  if (
    currentBounds.x === nextBounds.x &&
    currentBounds.y === nextBounds.y &&
    currentBounds.width === nextBounds.width &&
    currentBounds.height === nextBounds.height
  ) {
    return false
  }

  window.setBounds(nextBounds, false)
  return true
}

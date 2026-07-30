export function calculateFixedCanvasScale(
  availableWidth: number,
  logicalWidth: number,
  allowUpscale = false
): number {
  if (
    !Number.isFinite(availableWidth) ||
    availableWidth <= 0 ||
    !Number.isFinite(logicalWidth) ||
    logicalWidth <= 0
  ) {
    return 1
  }

  const scale = availableWidth / logicalWidth
  return allowUpscale ? scale : Math.min(1, scale)
}

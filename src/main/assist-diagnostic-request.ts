export function isTrustedAssistDiagnosticRequest(
  senderId: number,
  isMainFrame: boolean,
  trustedRendererIds: ReadonlyArray<number | undefined>
): boolean {
  return (
    isMainFrame &&
    trustedRendererIds.some(
      (trustedRendererId) => trustedRendererId !== undefined && trustedRendererId === senderId
    )
  )
}

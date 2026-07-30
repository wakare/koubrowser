export function isTrustedRecordingSourceRequest(
  senderId: number,
  isMainFrame: boolean,
  mainWindowContentsId: number
): boolean {
  return isMainFrame && senderId === mainWindowContentsId
}

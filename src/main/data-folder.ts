export type OpenPath = (directory: string) => Promise<string>

export function isTrustedDataFolderRequest(
  senderId: number,
  isMainFrame: boolean,
  mainWebContentsId: number
): boolean {
  return isMainFrame && senderId === mainWebContentsId
}

export async function openDataDirectory(
  directory: string,
  openPath: OpenPath
): Promise<void> {
  const error = await openPath(directory)
  if (error) {
    throw new Error(`Failed to open the data folder: ${error}`)
  }
}

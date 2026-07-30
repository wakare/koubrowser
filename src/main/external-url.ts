const AllowedExternalHosts = new Set([
  'koubrowser.app',
  'kanlog.info',
  'wikiwiki.jp',
  'zh.kcwiki.cn'
])

export function isTrustedExternalUrlRequest(
  senderId: number,
  isMainFrame: boolean,
  trustedSenderIds: ReadonlyArray<number | undefined>
): boolean {
  return (
    isMainFrame &&
    trustedSenderIds.some(
      (trustedSenderId) =>
        trustedSenderId !== undefined && trustedSenderId === senderId
    )
  )
}

/**
 * Renderer-provided URLs cross an Electron privilege boundary before they are
 * passed to the operating system. Keep that boundary limited to the HTTPS
 * sites that the application currently exposes in its UI.
 */
export function normalizeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) {
    return undefined
  }

  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !AllowedExternalHosts.has(url.hostname.toLowerCase())
    ) {
      return undefined
    }
    return url.toString()
  } catch {
    return undefined
  }
}

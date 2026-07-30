export const PANEL_LOAD_TIMEOUT_MS = 15_000

export function withPanelLoadTimeout<T>(
  promise: Promise<T>,
  message: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message))
    }, PANEL_LOAD_TIMEOUT_MS)

    promise.then(resolve, reject).finally(() => {
      window.clearTimeout(timeoutId)
    })
  })
}

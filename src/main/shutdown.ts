export const AppShutdownTimeoutMs = 8_000

export type AppShutdownResult<T> =
  | {
      readonly status: 'completed'
      readonly value: T
    }
  | {
      readonly status: 'timed-out'
    }

/**
 * Keep the single-instance lock from being held indefinitely when an
 * application cleanup task or a platform API does not settle during exit.
 */
export async function waitForAppShutdown<T>(
  task: Promise<T>,
  timeoutMs: number = AppShutdownTimeoutMs
): Promise<AppShutdownResult<T>> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Application shutdown timeout must be a positive finite number')
  }

  let timeout: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<AppShutdownResult<T>>((resolve) => {
    timeout = setTimeout(() => resolve({ status: 'timed-out' }), timeoutMs)
  })

  try {
    return await Promise.race([
      task.then(
        (value): AppShutdownResult<T> => ({
          status: 'completed',
          value
        })
      ),
      timedOut
    ])
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

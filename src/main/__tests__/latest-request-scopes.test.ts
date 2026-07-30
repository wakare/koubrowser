import { describe, expect, it } from 'vitest'
import { LatestRequestScopes } from '@main/worker/latest-request-scopes'

describe('LatestRequestScopes', () => {
  it('cancels only the older request in the same renderer scope', () => {
    const scopes = new LatestRequestScopes()

    scopes.start(10, 1)
    scopes.start(20, 2)
    scopes.start(10, 3)

    expect(scopes.isCurrent(10, 1)).toBe(false)
    expect(scopes.isCurrent(10, 3)).toBe(true)
    expect(scopes.isCurrent(20, 2)).toBe(true)
  })

  it('does not let an older completion clear the current request', () => {
    const scopes = new LatestRequestScopes()

    scopes.start(10, 1)
    scopes.start(10, 2)
    scopes.finish(10, 1)

    expect(scopes.isCurrent(10, 2)).toBe(true)

    scopes.finish(10, 2)
    expect(scopes.isCurrent(10, 2)).toBe(false)
  })
})

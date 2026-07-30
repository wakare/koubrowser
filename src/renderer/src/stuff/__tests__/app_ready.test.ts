import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/store/svdata', async () => {
  const { reactive } = await import('vue')
  return {
    svdata: reactive({
      isMstDataOk: false,
      isShipDataOk: false
    })
  }
})

import { isAppReady, setAppSettingOk } from '../app_ready'
import { svdata } from '@renderer/store/svdata'

const readiness = svdata as unknown as {
  isMstDataOk: boolean
  isShipDataOk: boolean
}

describe('application readiness', () => {
  beforeEach(() => {
    setAppSettingOk(false)
    readiness.isMstDataOk = false
    readiness.isShipDataOk = false
  })

  it('waits for settings, master data, and account-scoped ship data', () => {
    setAppSettingOk(true)
    readiness.isMstDataOk = true
    expect(isAppReady.value).toBe(false)

    readiness.isShipDataOk = true
    expect(isAppReady.value).toBe(true)
  })

  it('does not become ready from game data before settings arrive', () => {
    readiness.isMstDataOk = true
    readiness.isShipDataOk = true

    expect(isAppReady.value).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { hasValidAccountIdentity } from '@main/account-identity'

describe('account identity readiness', () => {
  it('accepts a complete game account identity', () => {
    expect(
      hasValidAccountIdentity({
        serverId: 3,
        basic: { api_member_id: 12345678 }
      })
    ).toBe(true)
    expect(
      hasValidAccountIdentity({
        serverId: 3,
        basic: { api_member_id: '12345678' }
      })
    ).toBe(true)
  })

  it.each([
    { serverId: 0, memberId: 12345678 },
    { serverId: 3.5, memberId: 12345678 },
    { serverId: 3, memberId: '' },
    { serverId: 3, memberId: 'not-a-member' },
    { serverId: 3, memberId: '1'.repeat(33) }
  ])('rejects an incomplete identity: %o', ({ serverId, memberId }) => {
    expect(
      hasValidAccountIdentity({
        serverId,
        basic: { api_member_id: memberId }
      })
    ).toBe(false)
  })
})

export interface AccountIdentitySource {
  readonly serverId: unknown
  readonly basic: {
    readonly api_member_id: unknown
  }
}

export function hasValidAccountIdentity(source: AccountIdentitySource): boolean {
  const memberId = String(source.basic.api_member_id)
  return (
    Number.isSafeInteger(source.serverId) &&
    (source.serverId as number) > 0 &&
    /^[0-9]{1,32}$/u.test(memberId)
  )
}

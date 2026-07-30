import type { AccountRecordIdentity } from '@common/record'
import { randomUUID } from 'node:crypto'

export const AccountRecordIdentitySchemaVersion = 1 as const
const AccountRecordIdentityKeys = ['index', 'recordId', 'schemaVersion']
const UuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

export function createAccountRecordIdentity(
  index = 0,
  recordId: string = randomUUID()
): AccountRecordIdentity {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error('Account record identity index must be a non-negative integer')
  }
  if (
    !UuidV4Pattern.test(recordId)
  ) {
    throw new Error('Account record identity must use a UUID v4 record id')
  }
  return {
    schemaVersion: AccountRecordIdentitySchemaVersion,
    recordId,
    index
  }
}

export function accountRecordIdentityKey(
  record: Record<string, unknown>
): string | null {
  const identity = record.recordIdentity
  if (identity === undefined) {
    return null
  }
  if (
    identity === null ||
    Array.isArray(identity) ||
    typeof identity !== 'object'
  ) {
    throw new Error('Account record identity must be an object')
  }

  const value = identity as Record<string, unknown>
  const keys = Object.keys(value).sort()
  if (
    keys.length !== AccountRecordIdentityKeys.length ||
    keys.some((key, index) => key !== AccountRecordIdentityKeys[index])
  ) {
    throw new Error('Account record identity has unknown or missing fields')
  }
  if (value.schemaVersion !== AccountRecordIdentitySchemaVersion) {
    throw new Error('Account record identity schema is not supported')
  }
  if (typeof value.recordId !== 'string' || !UuidV4Pattern.test(value.recordId)) {
    throw new Error('Account record identity must use a UUID v4 record id')
  }
  if (!Number.isSafeInteger(value.index) || (value.index as number) < 0) {
    throw new Error('Account record identity index must be a non-negative integer')
  }
  return `${value.schemaVersion}:${value.recordId}:${value.index}`
}

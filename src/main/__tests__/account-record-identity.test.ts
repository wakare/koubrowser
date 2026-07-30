import { describe, expect, it } from 'vitest'
import {
  AccountRecordIdentitySchemaVersion,
  accountRecordIdentityKey,
  createAccountRecordIdentity
} from '@main/account-record-identity'

const RecordId = '11111111-1111-4111-8111-111111111111'

describe('account record identity', () => {
  it('creates a versioned identity and a stable key', () => {
    const identity = createAccountRecordIdentity(3, RecordId)

    expect(identity).toEqual({
      schemaVersion: AccountRecordIdentitySchemaVersion,
      recordId: RecordId,
      index: 3
    })
    expect(accountRecordIdentityKey({ recordIdentity: identity })).toBe(
      `1:${RecordId}:3`
    )
    expect(accountRecordIdentityKey({ legacy: true })).toBeNull()
  })

  it('uses one record id with distinct indexes for a batch', () => {
    const first = createAccountRecordIdentity(0, RecordId)
    const second = createAccountRecordIdentity(1, RecordId)

    expect(accountRecordIdentityKey({ recordIdentity: first })).not.toBe(
      accountRecordIdentityKey({ recordIdentity: second })
    )
  })

  it('rejects malformed or unsupported identities', () => {
    expect(() => createAccountRecordIdentity(-1, RecordId)).toThrow(
      'non-negative integer'
    )
    expect(() => createAccountRecordIdentity(0, 'not-a-uuid')).toThrow(
      'UUID v4'
    )
    expect(() =>
      accountRecordIdentityKey({
        recordIdentity: {
          schemaVersion: 2,
          recordId: RecordId,
          index: 0
        }
      })
    ).toThrow('schema is not supported')
    expect(() =>
      accountRecordIdentityKey({
        recordIdentity: {
          schemaVersion: 1,
          recordId: RecordId,
          index: 0,
          extra: true
        }
      })
    ).toThrow('unknown or missing fields')
  })
})

import { describe, expect, it } from 'vitest'
import {
  AccountQuestMergePolicyVersion,
  accountQuestMergeDecision,
  accountQuestRecordKey
} from '@main/account-quest-merge-policy'

function questRecord(
  id: string,
  count: readonly number[],
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    _id: id,
    no: 304,
    date: '2026-07-30T10:00:00+09:00',
    dateKey: 'daily-20260730',
    quest: {
      api_no: 304,
      api_category: 3,
      api_type: 1,
      api_label_type: 2,
      api_state: 2,
      api_title: '演習任務',
      api_detail: '演習で勝利する',
      api_voice_id: 0,
      api_get_material: [0, 50, 0, 50],
      api_bonus_flag: 1,
      api_progress_flag: 0,
      api_invalid_flag: 0
    },
    state: {
      count: [...count],
      countMax: [5, 3]
    },
    ...overrides
  }
}

describe('account quest merge policy', () => {
  it('uses a versioned logical key for supported quest records', () => {
    expect(AccountQuestMergePolicyVersion).toBe(1)
    expect(accountQuestRecordKey(questRecord('current', [1, 1]))).toBe(
      'quest:304'
    )
    expect(accountQuestRecordKey({ _id: 'meta', key: 'meta' })).toBe('meta')
    expect(accountQuestRecordKey({ _id: 'legacy', value: 1 })).toBeNull()
  })

  it('merges same-period counters by component-wise maximum', () => {
    const current = questRecord('current', [3, 1])
    const incoming = questRecord('incoming', [2, 2], {
      date: '2026-07-30T11:00:00+09:00',
      quest: {
        ...(questRecord('copy', [0, 0]).quest as Record<string, unknown>),
        api_state: 3,
        api_progress_flag: 2
      }
    })

    expect(accountQuestMergeDecision(current, incoming)).toEqual({
      kind: 'safe-merge',
      reason: 'monotonic-counter-progress',
      replacement: {
        ...current,
        state: {
          count: [3, 2],
          countMax: [5, 3]
        }
      }
    })
  })

  it('does not add counters or replace current metadata', () => {
    const current = questRecord('current', [3, 2])
    const incoming = questRecord('incoming', [2, 1], {
      date: '2026-07-30T12:00:00+09:00'
    })

    expect(accountQuestMergeDecision(current, incoming)).toEqual({
      kind: 'skip',
      reason: 'current-progress-dominates'
    })
  })

  it('is idempotent after applying monotonic progress', () => {
    const first = accountQuestMergeDecision(
      questRecord('current', [3, 1]),
      questRecord('incoming', [2, 2])
    )
    expect(first.kind).toBe('safe-merge')
    expect(first.replacement).toBeDefined()

    expect(
      accountQuestMergeDecision(
        first.replacement as Record<string, unknown>,
        questRecord('incoming', [2, 2])
      )
    ).toEqual({
      kind: 'skip',
      reason: 'current-progress-dominates'
    })
  })

  it('keeps period, schema, metadata and meta-record mismatches for review', () => {
    const current = questRecord('current', [1, 1])

    expect(
      accountQuestMergeDecision(
        current,
        questRecord('incoming', [2, 2], {
          dateKey: 'daily-20260731'
        })
      ).reason
    ).toBe('different-period')
    expect(
      accountQuestMergeDecision(
        current,
        questRecord('incoming', [2, 2], {
          state: { count: [2], countMax: [5] }
        })
      ).reason
    ).toBe('incompatible-counter-shape')
    expect(
      accountQuestMergeDecision(
        current,
        questRecord('incoming', [2, 2], {
          quest: {
            ...(current.quest as Record<string, unknown>),
            api_title: '再利用された別任務'
          }
        })
      ).reason
    ).toBe('incompatible-quest-metadata')
    expect(
      accountQuestMergeDecision(
        { _id: 'meta-current', key: 'meta', inProgress: [304] },
        { _id: 'meta-incoming', key: 'meta', inProgress: [304, 403] }
      )
    ).toEqual({ kind: 'manual-review', reason: 'metadata-record' })
  })

  it('fails closed when a future outer field appears', () => {
    const current = questRecord('current', [1, 1])
    const incoming = questRecord('incoming', [2, 2], {
      futureField: true
    })

    expect(accountQuestMergeDecision(current, incoming)).toEqual({
      kind: 'manual-review',
      reason: 'unsupported-record-shape'
    })
  })
})

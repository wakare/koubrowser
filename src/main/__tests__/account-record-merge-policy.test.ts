import { describe, expect, it } from 'vitest'
import { DbName } from '@common/record'
import {
  AccountRecordMergeComparisonPolicyVersion,
  AccountRecordMergeConflictPolicyVersion,
  AccountRecordMergeConflictResolution,
  accountRecordMergeComparableValue,
  accountRecordMergeConflictGroups,
  isAccountRecordMergeConflictGroup
} from '@main/account-record-merge-policy'

describe('account record merge comparison policy', () => {
  it('has an explicit version', () => {
    expect(AccountRecordMergeComparisonPolicyVersion).toBe(1)
    expect(AccountRecordMergeConflictPolicyVersion).toBe(1)
    expect(AccountRecordMergeConflictResolution).toBe(
      'preserve-current-v1'
    )
  })

  it('ignores only known provenance and display fields', () => {
    const base = {
      _id: 'current-id',
      recordIdentity: {
        schemaVersion: 1,
        recordId: '11111111-1111-4111-8111-111111111111',
        index: 0
      },
      origin: 'koubrowser/old',
      shipName: '旧艦名',
      questName: '旧海域名',
      enemyDeckName: '旧敵艦隊名',
      shipId: 1,
      date: '2026-07-30T00:00:00+09:00'
    }
    const incoming = {
      ...base,
      _id: 'incoming-id',
      recordIdentity: {
        schemaVersion: 1,
        recordId: '11111111-1111-4111-8111-111111111111',
        index: 0
      },
      origin: 'koubrowser/new',
      shipName: '新艦名',
      questName: '新海域名',
      enemyDeckName: '新敵艦隊名'
    }

    expect(
      accountRecordMergeComparableValue(DbName.drop, base)
    ).toEqual(
      accountRecordMergeComparableValue(DbName.drop, incoming)
    )
  })

  it('keeps event content and unknown future fields fail-closed', () => {
    const base = {
      origin: 'koubrowser/old',
      itemId: 1,
      futureField: { value: 1 }
    }

    expect(
      accountRecordMergeComparableValue(DbName.item, base)
    ).not.toEqual(
      accountRecordMergeComparableValue(DbName.item, {
        ...base,
        itemId: 2
      })
    )
    expect(
      accountRecordMergeComparableValue(DbName.item, base)
    ).not.toEqual(
      accountRecordMergeComparableValue(DbName.item, {
        ...base,
        futureField: { value: 2 }
      })
    )
  })

  it.each([
    [DbName.item, ['origin']],
    [DbName.ship, ['origin']],
    [DbName.remodel, ['origin']],
    [DbName.mission, ['origin', 'mapareaName', 'questName']],
    [DbName.clearitemget, ['origin', 'questName']]
  ] as const)(
    'normalizes the declared %s non-semantic fields',
    (dbName, fields) => {
      const current: Record<string, unknown> = {
        stable: { value: 1 }
      }
      const incoming: Record<string, unknown> = {
        stable: { value: 1 }
      }
      for (const field of fields) {
        current[field] = `old:${field}`
        incoming[field] = `new:${field}`
      }

      expect(
        accountRecordMergeComparableValue(dbName, current)
      ).toEqual(
        accountRecordMergeComparableValue(dbName, incoming)
      )
    }
  )

  it('keeps an unknown port field in the comparison', () => {
    expect(
      accountRecordMergeComparableValue(DbName.port, {
        date: '2026-07-30T00:00:00+09:00',
        origin: 'unexpected-old'
      })
    ).not.toEqual(
      accountRecordMergeComparableValue(DbName.port, {
        date: '2026-07-30T00:00:00+09:00',
        origin: 'unexpected-new'
      })
    )
  })

  it('normalizes the embedded drop in a battle record', () => {
    const current = {
      uuid: 'sortie',
      index: 1,
      origin: 'koubrowser/old',
      questName: '旧海域名',
      enemyDeckName: '旧敵艦隊名',
      drop: {
        shipId: 1,
        origin: 'koubrowser/old',
        shipName: '旧艦名',
        questName: '旧海域名',
        enemyDeckName: '旧敵艦隊名'
      }
    }
    const incoming = {
      ...current,
      origin: 'koubrowser/new',
      questName: '新海域名',
      enemyDeckName: '新敵艦隊名',
      drop: {
        ...current.drop,
        origin: 'koubrowser/new',
        shipName: '新艦名',
        questName: '新海域名',
        enemyDeckName: '新敵艦隊名'
      }
    }

    expect(
      accountRecordMergeComparableValue(DbName.battle, current)
    ).toEqual(
      accountRecordMergeComparableValue(DbName.battle, incoming)
    )
  })

  it('classifies multiple drop payload groups without exposing values', () => {
    expect(
      accountRecordMergeConflictGroups(
        DbName.drop,
        {
          mapId: 11,
          shipId: 1,
          date: '2026-07-30T00:00:00+09:00'
        },
        {
          mapId: 12,
          shipId: 2,
          date: '2026-07-30T00:01:00+09:00'
        }
      )
    ).toEqual(['timestamp', 'location', 'result'])
  })

  it.each([
    [DbName.port, '1', 'snapshot'],
    [DbName.item, 'items', 'input'],
    [DbName.item, 'secretary', 'context'],
    [DbName.item, 'itemId', 'result'],
    [DbName.ship, 'kdockId', 'input'],
    [DbName.remodel, 'successful', 'result'],
    [DbName.mission, 'ships', 'fleet'],
    [DbName.mission, 'getMaterial', 'reward'],
    [DbName.clearitemget, 'questNo', 'context'],
    [DbName.clearitemget, 'bonuses', 'reward']
  ] as const)(
    'classifies %s.%s as %s',
    (dbName, field, expectedGroup) => {
      expect(
        accountRecordMergeConflictGroups(
          dbName,
          { [field]: { value: 1 } },
          { [field]: { value: 2 } }
        )
      ).toEqual([expectedGroup])
      expect(
        isAccountRecordMergeConflictGroup(dbName, expectedGroup)
      ).toBe(true)
    }
  )

  it('keeps unknown future fields fail-closed in the reason summary', () => {
    expect(
      accountRecordMergeConflictGroups(
        DbName.drop,
        { futurePayload: { value: 1 } },
        { futurePayload: { value: 2 } }
      )
    ).toEqual(['unknown-field'])
  })

  it('does not classify stable-identity display-only differences', () => {
    expect(
      accountRecordMergeConflictGroups(
        DbName.drop,
        {
          origin: 'old',
          shipName: 'old name',
          questName: 'old quest'
        },
        {
          origin: 'new',
          shipName: 'new name',
          questName: 'new quest'
        }
      )
    ).toEqual([])
  })

  it('classifies legacy exact provenance and display differences', () => {
    expect(
      accountRecordMergeConflictGroups(
        DbName.drop,
        { origin: 'old', shipName: 'old name' },
        { origin: 'new', shipName: 'new name' },
        'legacy-exact'
      )
    ).toEqual(['provenance', 'display'])
  })

  it('classifies nested battle drop differences with the drop policy', () => {
    expect(
      accountRecordMergeConflictGroups(
        DbName.battle,
        {
          drop: {
            origin: 'old',
            shipName: 'old name',
            shipId: 1
          }
        },
        {
          drop: {
            origin: 'new',
            shipName: 'new name',
            shipId: 2
          }
        }
      )
    ).toEqual(['result'])
  })

  it('does not expose the quest database to append-record policy', () => {
    expect(() =>
      accountRecordMergeComparableValue(DbName.quest, {})
    ).toThrow('has no append-record merge policy')
    expect(() =>
      accountRecordMergeConflictGroups(DbName.quest, {}, {})
    ).toThrow('dedicated merge policy')
  })
})

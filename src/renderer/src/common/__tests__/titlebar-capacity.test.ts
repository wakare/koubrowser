import { describe, expect, it } from 'vitest'
import {
  shipCapacityStatus,
  slotitemCapacityStatus
} from '@renderer/common/titlebar-capacity'

describe('titlebar capacity status', () => {
  it('shows a compact ship count until five or fewer spaces remain', () => {
    expect(shipCapacityStatus(94, 100)).toMatchObject({
      level: 'normal',
      remaining: 6,
      text: '94'
    })
    expect(shipCapacityStatus(95, 100)).toMatchObject({
      level: 'danger',
      remaining: 5,
      text: '95/100',
      title: '保有艦娘: 95/100（空き5） — 空き枠が少なくなっています'
    })
  })

  it('uses the three-item equipment buffer reported separately by the game', () => {
    expect(slotitemCapacityStatus(83, 100)).toMatchObject({
      capacity: 103,
      level: 'normal',
      remaining: 20,
      text: '83'
    })
  })

  it('distinguishes the event warning and critical equipment ranges', () => {
    expect(slotitemCapacityStatus(84, 100)).toMatchObject({
      level: 'warning',
      remaining: 19,
      text: '84/103'
    })
    expect(slotitemCapacityStatus(98, 100)).toMatchObject({
      level: 'danger',
      remaining: 5,
      text: '98/103'
    })
  })

  it('describes capacity overflow without reporting negative free space', () => {
    expect(shipCapacityStatus(102, 100)).toMatchObject({
      level: 'danger',
      remaining: -2,
      text: '102/100',
      title: '保有艦娘: 102/100（上限超過2） — 空き枠が少なくなっています'
    })
    expect(slotitemCapacityStatus(104, 100)).toMatchObject({
      level: 'danger',
      remaining: -1,
      text: '104/103',
      title: '保有装備: 104/103（上限超過1） — 期間限定海域の目安は空き20以上です'
    })
  })

  it('shows zero free space explicitly when both capacities are exactly full', () => {
    expect(shipCapacityStatus(100, 100)).toMatchObject({
      level: 'danger',
      remaining: 0,
      text: '100/100',
      title: '保有艦娘: 100/100（空き0） — 空き枠が少なくなっています'
    })
    expect(slotitemCapacityStatus(103, 100)).toMatchObject({
      level: 'danger',
      remaining: 0,
      text: '103/103',
      title: '保有装備: 103/103（空き0） — 期間限定海域の目安は空き20以上です'
    })
  })

  it('keeps unavailable capacity data neutral', () => {
    expect(slotitemCapacityStatus(12, 0)).toEqual({
      current: 12,
      capacity: 0,
      remaining: -12,
      level: 'normal',
      text: '12',
      title: '保有装備: 12'
    })
  })
})

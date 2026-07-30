import { KcsUtil, ShipHpState } from '@common/kcs'

export type ShipHpGaugeState = 'normal' | 'syouha' | 'tyuuha' | 'taiha'

export interface ShipHpGauge {
  readonly nowHp: number
  readonly maxHp: number
  readonly percent: number
  readonly state: ShipHpGaugeState
  readonly stateLabel: string
  readonly valueText: string
}

const gaugeState = (nowHp: number, maxHp: number): ShipHpGaugeState => {
  switch (KcsUtil.calcHpState(nowHp, maxHp)) {
    case ShipHpState.syouha:
      return 'syouha'
    case ShipHpState.tyuuha:
      return 'tyuuha'
    case ShipHpState.taiha:
      return 'taiha'
    default:
      return 'normal'
  }
}

const stateLabel = (state: ShipHpGaugeState): string => {
  switch (state) {
    case 'syouha':
      return '小破'
    case 'tyuuha':
      return '中破'
    case 'taiha':
      return '大破'
    default:
      return '健全'
  }
}

export const shipHpGauge = (nowHp: number, maxHp: number): ShipHpGauge => {
  const safeMaxHp =
    Number.isFinite(maxHp) && maxHp > 0 ? Math.floor(maxHp) : 1
  const safeNowHp = Number.isFinite(nowHp)
    ? Math.min(safeMaxHp, Math.max(0, Math.floor(nowHp)))
    : 0
  const state = gaugeState(safeNowHp, safeMaxHp)
  const label = stateLabel(state)

  return {
    nowHp: safeNowHp,
    maxHp: safeMaxHp,
    percent: Math.round((safeNowHp / safeMaxHp) * 1000) / 10,
    state,
    stateLabel: label,
    valueText: `HP ${safeNowHp}/${safeMaxHp}（${label}）`
  }
}

import { reactive } from 'vue'
import type { TaihaWarning } from '@renderer/common/taiha-warning'

interface TaihaProtectionState {
  warning: TaihaWarning
  acknowledged: boolean
}

export const taihaProtectionState = reactive<TaihaProtectionState>({
  warning: 'none',
  acknowledged: false
})

export function setTaihaWarning(warning: TaihaWarning): void {
  taihaProtectionState.warning = warning
  taihaProtectionState.acknowledged = false
}

export function acknowledgeTaihaProtection(): void {
  if (taihaProtectionState.warning === 'battle-result') {
    taihaProtectionState.acknowledged = true
  }
}

export function isTaihaInputProtectionActive(): boolean {
  return (
    taihaProtectionState.warning === 'battle-result' &&
    !taihaProtectionState.acknowledged
  )
}

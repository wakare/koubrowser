export type TitlebarCapacityLevel = 'normal' | 'warning' | 'danger'

export interface TitlebarCapacityStatus {
  readonly current: number
  readonly capacity: number
  readonly remaining: number
  readonly level: TitlebarCapacityLevel
  readonly text: string
  readonly title: string
}

function normalizeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function capacityTitle(label: string, current: number, capacity: number): string {
  if (capacity <= 0) {
    return `${label}: ${current}`
  }
  const remaining = capacity - current
  return remaining >= 0
    ? `${label}: ${current}/${capacity}（空き${remaining}）`
    : `${label}: ${current}/${capacity}（上限超過${Math.abs(remaining)}）`
}

export function shipCapacityStatus(
  currentValue: number,
  capacityValue: number
): TitlebarCapacityStatus {
  const current = normalizeCount(currentValue)
  const capacity = normalizeCount(capacityValue)
  const remaining = capacity - current
  const level: TitlebarCapacityLevel =
    capacity > 0 && remaining <= 5 ? 'danger' : 'normal'
  const title = capacityTitle('保有艦娘', current, capacity)

  return {
    current,
    capacity,
    remaining,
    level,
    text: level === 'danger' && capacity > 0 ? `${current}/${capacity}` : `${current}`,
    title:
      level === 'danger'
        ? `${title} — 空き枠が少なくなっています`
        : title
  }
}

export function slotitemCapacityStatus(
  currentValue: number,
  apiCapacityValue: number
): TitlebarCapacityStatus {
  const current = normalizeCount(currentValue)
  // The game reports the development/remodel limit. The visible equipment
  // operation capacity includes the three-item buffer above that limit.
  const apiCapacity = normalizeCount(apiCapacityValue)
  const capacity = apiCapacity > 0 ? apiCapacity + 3 : 0
  const remaining = capacity - current
  const level: TitlebarCapacityLevel =
    capacity <= 0
      ? 'normal'
      : remaining <= 5
        ? 'danger'
        : remaining < 20
          ? 'warning'
          : 'normal'
  const title = capacityTitle('保有装備', current, capacity)

  return {
    current,
    capacity,
    remaining,
    level,
    text: level !== 'normal' && capacity > 0 ? `${current}/${capacity}` : `${current}`,
    title:
      level === 'normal'
        ? title
        : `${title} — 期間限定海域の目安は空き20以上です`
  }
}

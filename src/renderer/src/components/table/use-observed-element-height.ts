import {
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  type Ref
} from 'vue'

export function normalizeObservedHeight(
  height: number,
  fallback: number
): number {
  if (!Number.isFinite(height) || height <= 0) {
    return fallback
  }
  return Math.max(1, Math.floor(height))
}

export function useObservedElementHeight(
  element: Ref<HTMLElement | null>,
  fallback: number
): Readonly<Ref<number>> {
  const height = ref(fallback)
  let observer: ResizeObserver | undefined
  let measurePending = false

  const measure = (): void => {
    measurePending = false
    height.value = normalizeObservedHeight(
      element.value?.clientHeight ?? 0,
      fallback
    )
  }

  const scheduleMeasure = (): void => {
    if (measurePending) {
      return
    }
    measurePending = true
    queueMicrotask(measure)
  }

  onMounted(async () => {
    await nextTick()
    if (!element.value) {
      return
    }
    observer = new ResizeObserver(scheduleMeasure)
    observer.observe(element.value)
    scheduleMeasure()
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return height
}

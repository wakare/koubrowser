import {
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  type Ref
} from 'vue'

export interface ResponsiveTablePageSizeOptions {
  readonly fallback: number
  readonly min: number
  readonly max: number
  readonly rowHeight: number
}

export function calculateTablePageSize(
  availableHeight: number,
  options: ResponsiveTablePageSizeOptions
): number {
  if (!Number.isFinite(availableHeight) || availableHeight <= 0) {
    return options.fallback
  }
  const rows = Math.floor(availableHeight / options.rowHeight)
  return Math.min(options.max, Math.max(options.min, rows))
}

export function useResponsiveTablePageSize(
  root: Ref<HTMLElement | null>,
  options: ResponsiveTablePageSizeOptions
): Readonly<Ref<number>> {
  const pageSize = ref(options.fallback)
  let observer: ResizeObserver | undefined
  let measurePending = false

  const measure = (): void => {
    measurePending = false
    const wrapper = root.value?.querySelector<HTMLElement>('.table-wrapper')
    if (!wrapper) {
      return
    }
    const headerHeight =
      wrapper.querySelector<HTMLElement>('thead')?.getBoundingClientRect()
        .height ?? 0
    const availableHeight = wrapper.clientHeight - headerHeight
    pageSize.value = calculateTablePageSize(availableHeight, options)
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
    observer = new ResizeObserver(scheduleMeasure)
    observer.observe(root.value!)
    scheduleMeasure()
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return pageSize
}

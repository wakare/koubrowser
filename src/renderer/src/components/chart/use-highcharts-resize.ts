import type Highcharts from 'highcharts'
import { onMounted, onUnmounted, type Ref } from 'vue'

/**
 * Highcharts listens for window resize events, but assist panels may be
 * rearranged without resizing their BrowserWindow. Observe the actual chart
 * container so both classic tabs and future workspace panels reflow correctly.
 */
export function useHighchartsResize(
  container: Ref<HTMLElement | null>,
  getChart: () => Highcharts.Chart | null | undefined
): void {
  let observer: ResizeObserver | undefined
  let reflowQueued = false
  let active = false

  const queueReflow = (): void => {
    if (reflowQueued) {
      return
    }

    reflowQueued = true
    queueMicrotask(() => {
      reflowQueued = false
      if (active) {
        getChart()?.reflow()
      }
    })
  }

  onMounted(() => {
    active = true
    if (!container.value || typeof ResizeObserver === 'undefined') {
      return
    }

    observer = new ResizeObserver(queueReflow)
    observer.observe(container.value)
  })

  onUnmounted(() => {
    active = false
    observer?.disconnect()
    observer = undefined
  })
}

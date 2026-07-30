<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref
} from 'vue'
import { calculateFixedCanvasScale } from './fixed-canvas-scale'

const props = withDefaults(
  defineProps<{
    logicalWidth: number
    logicalHeight: number
    allowUpscale?: boolean
  }>(),
  {
    allowUpscale: false
  }
)

const viewport = ref<HTMLElement | null>(null)
const availableWidth = ref(props.logicalWidth)
let observer: ResizeObserver | undefined

const scale = computed(() =>
  calculateFixedCanvasScale(
    availableWidth.value,
    props.logicalWidth,
    props.allowUpscale
  )
)

const renderedWidth = computed(() => props.logicalWidth * scale.value)
const renderedHeight = computed(() => props.logicalHeight * scale.value)

const viewportStyle = computed(() => ({
  height: `${renderedHeight.value}px`
}))

const canvasStyle = computed(() => ({
  width: `${props.logicalWidth}px`,
  height: `${props.logicalHeight}px`,
  left: `${Math.max(0, (availableWidth.value - renderedWidth.value) / 2)}px`,
  transform: `scale(${scale.value})`
}))

const measure = (): void => {
  if (viewport.value?.clientWidth) {
    availableWidth.value = viewport.value.clientWidth
  }
}

onMounted(async () => {
  await nextTick()
  if (!viewport.value) {
    return
  }
  observer = new ResizeObserver(measure)
  observer.observe(viewport.value)
  measure()
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <div
    ref="viewport"
    class="fixed-canvas-viewport"
    :style="viewportStyle"
  >
    <div class="fixed-canvas-content" :style="canvasStyle">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.fixed-canvas-viewport {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.fixed-canvas-content {
  position: absolute;
  top: 0;
  transform-origin: top left;
}
</style>

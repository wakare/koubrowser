<script setup lang="ts">
import type { PortChartData } from '@common/record'
import ChartKit from '@renderer/components/chart/Kit.vue'
import ChartMaterial from '@renderer/components/chart/Material.vue'
import {
  getResourceChartViewState,
  saveResourceChartViewState
} from '@renderer/store/panel_view_state'
import { svdata } from '@renderer/store/svdata'
import { withPanelLoadTimeout } from '@renderer/common/panel-load'
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { translateApp } from '@renderer/store/global_setting'

const chartMaterial = ref<InstanceType<typeof ChartMaterial> | null>(null)
const chartKit = ref<InstanceType<typeof ChartKit> | null>(null)
const activeChart = ref(getResourceChartViewState())
const loadState = ref<'waiting' | 'loading' | 'ready' | 'empty' | 'error'>('waiting')
let disposed = false
let requestVersion = 0

watch(activeChart, saveResourceChartViewState)
watch(
  () => svdata.isShipDataOk,
  (isReady) => {
    if (!isReady) {
      requestVersion += 1
      loadState.value = 'waiting'
      return
    }
    void loadChartData()
  },
  { immediate: true }
)

function hasChartData(data: PortChartData): boolean {
  return [...data.materials, ...data.kits].some((series) => series.length > 0)
}

async function loadChartData(): Promise<void> {
  const currentRequest = ++requestVersion
  loadState.value = 'loading'

  try {
    const data = await withPanelLoadTimeout(
      window.api.calcPortChartData(),
      'Resource chart request timed out'
    )
    if (disposed || currentRequest !== requestVersion) {
      return
    }
    if (!hasChartData(data)) {
      loadState.value = 'empty'
      return
    }

    await nextTick()
    if (!chartMaterial.value || !chartKit.value) {
      throw new Error('Resource chart components are unavailable')
    }
    chartMaterial.value.drawChart(data.materials)
    chartKit.value.drawChart(data.kits)
    loadState.value = 'ready'
  } catch {
    if (!disposed && currentRequest === requestVersion) {
      loadState.value = 'error'
    }
  }
}

onUnmounted(() => {
  disposed = true
  requestVersion += 1
})
</script>

<template>
  <div class="resource-chart-panel">
    <nav
      class="resource-chart-switcher"
      :aria-label="translateApp('operation.resource.aria')"
    >
      <button
        type="button"
        :class="{ 'is-active': activeChart === 'material' }"
        @click="activeChart = 'material'"
      >
        {{ translateApp('operation.resource.material') }}
      </button>
      <button
        type="button"
        :class="{ 'is-active': activeChart === 'kit' }"
        @click="activeChart = 'kit'"
      >
        {{ translateApp('operation.resource.kit') }}
      </button>
    </nav>
    <div class="resource-chart-body">
      <ChartMaterial v-show="activeChart === 'material'" ref="chartMaterial" />
      <ChartKit v-show="activeChart === 'kit'" ref="chartKit" />
      <div
        v-if="loadState === 'waiting'"
        class="resource-chart-state resource-chart-waiting"
        role="status"
      >
        {{ translateApp('status.resourceChart.waiting') }}
      </div>
      <b-loading
        v-else-if="loadState === 'loading'"
        :is-full-page="false"
        :model-value="true"
        :can-cancel="false"
        :aria-label="translateApp('status.resourceChart.loading')"
      />
      <div
        v-else-if="loadState === 'empty'"
        class="resource-chart-state resource-chart-empty"
        role="status"
      >
        {{ translateApp('status.resourceChart.empty') }}
      </div>
      <div
        v-else-if="loadState === 'error'"
        class="resource-chart-state resource-chart-error"
        role="alert"
      >
        <span>{{ translateApp('status.resourceChart.error') }}</span>
        <button type="button" @click="loadChartData">
          {{ translateApp('common.retry') }}
        </button>
      </div>
    </div>
  </div>
</template>

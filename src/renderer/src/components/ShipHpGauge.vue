<script setup lang="ts">
import { computed } from 'vue'
import { shipHpGauge } from '@renderer/common/ship-hp-gauge'

const props = defineProps<{
  nowHp: number
  maxHp: number
  shipName: string
}>()

const gauge = computed(() => shipHpGauge(props.nowHp, props.maxHp))
const fillStyle = computed(() => ({
  width: `${gauge.value.percent}%`
}))
const accessibleLabel = computed(
  () => `${props.shipName} ${gauge.value.valueText}`
)
</script>

<template>
  <span
    class="ship-hp-gauge"
    :class="`is-${gauge.state}`"
    role="meter"
    aria-valuemin="0"
    :aria-valuemax="gauge.maxHp"
    :aria-valuenow="gauge.nowHp"
    :aria-valuetext="gauge.valueText"
    :aria-label="accessibleLabel"
    :title="gauge.valueText"
  >
    <span class="ship-hp-gauge-fill" :style="fillStyle"></span>
  </span>
</template>

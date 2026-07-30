<script setup lang="ts">
import ShipHpGauge from '@renderer/components/ShipHpGauge.vue'
import { translateApp } from '@renderer/store/global_setting'

const ships = Object.freeze([
  { name: '健全艦', nowHp: 40, maxHp: 40 },
  { name: '健全境界艦', nowHp: 31, maxHp: 40 },
  { name: '小破艦', nowHp: 30, maxHp: 40 },
  { name: '中破艦', nowHp: 20, maxHp: 40 },
  { name: '大破境界艦', nowHp: 10, maxHp: 40 },
  { name: '大破艦', nowHp: 5, maxHp: 40 },
  { name: '第七艦', nowHp: 1, maxHp: 40 }
])
</script>

<template>
  <aside
    class="layout-hp-gauge-fixture"
    :aria-label="translateApp('test.layout.hpGauge')"
  >
    <div class="layout-hp-gauge-fixture-title">
      {{ translateApp('test.layout.hpGauge') }}
    </div>
    <div class="deck-ship-imgs">
      <span
        v-for="(ship, index) in ships"
        :key="ship.name"
        class="ship-container"
        :data-fixture-ship-index="index + 1"
      >
        <span class="ship-banner layout-hp-gauge-banner">
          {{ index + 1 }}. {{ ship.name }}
        </span>
        <ShipHpGauge
          :now-hp="ship.nowHp"
          :max-hp="ship.maxHp"
          :ship-name="ship.name"
        />
      </span>
    </div>
    <div class="layout-hp-gauge-status-probe">
      {{ translateApp('test.layout.fleetStatus') }}
    </div>
  </aside>
</template>

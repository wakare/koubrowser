<script setup lang="ts">
import BattleScore from '@renderer/components/BattleScore.vue';
import BattleHistroy from '@renderer/components/BattleHistory.vue';
import { BattleTabUIState as us } from '@renderer/store/ui_state'
import { translateApp } from '@renderer/store/global_setting'
const index = us.tabIndex

function onTabChange(valueNew: number): void {
  console.log('battletab index updated:', 'old:', index.value, 'new:',valueNew);

  const tabName = us.getTabName(valueNew)
  if (tabName) {
    us.saveTabName(tabName)
  }
}
</script>
<template>
  <div class="battlescore-history-root">
    <b-tabs 
      type="is-toggle" 
      size="is-small" class="select-tabs" expanded 
      v-model="index" 
      @update:modelValue="onTabChange"
      destroy-on-hide>
      <b-tab-item :label="translateApp('battleEquipment.tab.score')">
        <BattleScore />
      </b-tab-item>
      <b-tab-item :label="translateApp('battleEquipment.tab.history')">
        <BattleHistroy />
      </b-tab-item>
    </b-tabs>
  </div>
</template>

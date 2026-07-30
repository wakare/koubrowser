<script setup lang="ts">
import ShipList from '@renderer/components/ShipList.vue'
import SlotitemList from '@renderer/components/SlotitemList.vue'
import ItemList from '@renderer/components/ItemList.vue'
import { ShipItemsTabUIState as us } from '@renderer/store/ui_state'
import { translateApp } from '@renderer/store/global_setting'
const index = us.tabIndex

function onTabChange(valueNew: number): void {
  console.log('ship items index updated:', 'old:', index.value, 'new:',valueNew);

  const tabName = us.getTabName(valueNew)
  if (tabName) {
    us.saveTabName(tabName)
  }
}

</script>
<template>
  <div class="ship-items-root">
    <b-tabs 
      type="is-toggle" size="is-small" class="ship-items-tabs" expanded 
      v-model="index" 
      @update:modelValue="onTabChange"
      destroy-on-hide>
      <b-tab-item :label="translateApp('battleEquipment.tab.ships')">
        <ShipList />
      </b-tab-item>
      <b-tab-item :label="translateApp('battleEquipment.tab.slotitems')">
        <SlotitemList />
      </b-tab-item>
      <b-tab-item :label="translateApp('battleEquipment.tab.items')">
        <ItemList />
      </b-tab-item>
    </b-tabs>
  </div>
</template>

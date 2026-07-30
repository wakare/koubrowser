<script setup lang="ts">
import KDockList from '@renderer/components/KDockList.vue'
import NDockList from '@renderer/components/NDockList.vue'
import QuestList from '@renderer/components/QuestList.vue'
</script>

<template>
  <div>
    <div class="assist-dock">
      <div><NDockList /></div>
      <div><KDockList /></div>
    </div>
    <div><QuestList /></div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { EnvRenderer } from '@renderer/common/env-renderer'
import { AssistUIState as us } from '@renderer/store/ui_state'
import AssistPanelHost from '@renderer/components/assist/AssistPanelHost.vue'
import {
  getAssistPanelSubtitle,
  getAssistPanelTitleLines,
  getAssistPanelDefinitions,
  getAssistPanelHeaderClass,
  type AssistPanelDefinition
} from '@renderer/common/assist-panel'
import { translateApp } from '@renderer/store/global_setting'

// Vue のテンプレートで v-model するため、namespace import から top-level ref として受け直す。
const assistTabIndex = us.tabIndex
const assistTabRequest = us.tabRequest
const panels = getAssistPanelDefinitions(EnvRenderer.isAssist)

function panelTitleLines(panel: AssistPanelDefinition): readonly string[] {
  return getAssistPanelTitleLines(panel, translateApp)
}

function panelSubtitle(panel: AssistPanelDefinition): string | undefined {
  return getAssistPanelSubtitle(panel, translateApp)
}

function isPanelVisible(panel: AssistPanelDefinition): boolean {
  return us.isTabVisibleByName(panel.name)
}

function onTabChange(valueNew: number): void {
  const tabName = us.getTabName(valueNew)
  if (tabName) {
    us.saveTabName(tabName)
  }
}

watch(assistTabRequest, (tabName) => {
  if (!tabName) {
    return
  }
  const tabIndex = us.tabOrder.indexOf(tabName)
  if (tabIndex !== -1) {
    assistTabIndex.value = tabIndex
    onTabChange(tabIndex)
  }
  assistTabRequest.value = null
})
</script>

<template>
  <div class="assist-root">
    <b-tabs
      type="is-toggle"
      size="is-small"
      class="assist-tabs"
      expanded
      v-model="assistTabIndex"
      @update:modelValue="onTabChange"
    >
      <b-tab-item
        v-for="panel in panels"
        :key="panel.name"
        :header-class="getAssistPanelHeaderClass(panel)"
      >
        <template #header>
          <span v-if="panel.titleKeys.length === 1 && !panel.subtitleKey">
            {{ panelTitleLines(panel)[0] }}
          </span>
          <div v-else class="tab-content">
            <div
              v-for="titleLine in panelTitleLines(panel)"
              :key="titleLine"
              class="main-title"
            >
              {{ titleLine }}
            </div>
            <div v-if="panel.subtitleKey" class="sub-title">{{ panelSubtitle(panel) }}</div>
          </div>
        </template>
        <AssistPanelHost v-if="isPanelVisible(panel)" :panel-name="panel.name" />
      </b-tab-item>
    </b-tabs>
  </div>
</template>

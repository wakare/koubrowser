<script setup lang="ts">
import { translateOption } from '@option/store/optionSetting'

const minimize = (): void => {
  window.optionApi.minimize()
}

const close = (): void => {
  window.optionApi.close()
}
</script>

<template>
  <header class="option-titlebar">
    <div class="sidebar"></div>
    <div class="drag-area"></div>
    <div class="buttons">
      <button
        class="button minimize is-size-7"
        type="button"
        :aria-label="translateOption('common.minimize')"
        @click="minimize"
      >
        <span>&#x2014;</span>
      </button>
      <button
        class="button close"
        type="button"
        :aria-label="translateOption('common.close')"
        @click="close"
      >
        <span>&#10005;</span>
      </button>
    </div>
  </header>
</template>

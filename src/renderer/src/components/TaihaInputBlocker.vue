<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { translateApp } from '@renderer/store/global_setting'

const emit = defineEmits<{
  acknowledge: []
}>()

const acknowledgeButton = ref<HTMLButtonElement | null>(null)

onMounted(() => {
  nextTick(() => acknowledgeButton.value?.focus())
})

function acknowledge(event: MouseEvent | KeyboardEvent): void {
  if (event.ctrlKey) {
    emit('acknowledge')
  }
}
</script>

<template>
  <div
    class="taiha-input-blocker"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="taiha-input-blocker-title"
    aria-describedby="taiha-input-blocker-description"
    @click.stop
    @contextmenu.prevent
    @pointerdown.stop
    @wheel.prevent
  >
    <section class="taiha-input-blocker-card">
      <h2 id="taiha-input-blocker-title">
        {{ translateApp('taihaProtection.heading') }}
      </h2>
      <p id="taiha-input-blocker-description">
        {{ translateApp('taihaProtection.description') }}
      </p>
      <button
        ref="acknowledgeButton"
        type="button"
        @click.stop="acknowledge"
        @keydown.ctrl.enter.prevent="acknowledge"
      >
        {{ translateApp('taihaProtection.acknowledge') }}
      </button>
      <small>{{ translateApp('taihaProtection.hint') }}</small>
    </section>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  kind: 'success' | 'error'
  message: string
}>()
</script>

<template>
  <div
    class="capture-notice"
    :class="`is-${props.kind}`"
    :role="props.kind === 'error' ? 'alert' : 'status'"
    :aria-live="props.kind === 'error' ? 'assertive' : 'polite'"
  >
    {{ props.message }}
  </div>
</template>

<style scoped lang="scss">
.capture-notice {
  position: absolute;
  z-index: 10000;
  top: 42px;
  right: 12px;
  max-width: min(520px, calc(100vw - 24px));
  padding: 9px 14px;
  box-sizing: border-box;
  overflow: hidden;
  color: #fff;
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.42);

  &::before {
    position: absolute;
    top: -7px;
    right: 18px;
    width: 12px;
    height: 12px;
    content: '';
    background: inherit;
    border-top: inherit;
    border-left: inherit;
    transform: rotate(45deg);
  }

  &.is-success {
    background: rgba(0, 96, 58, 0.96);
  }

  &.is-error {
    background: rgba(146, 28, 28, 0.97);
  }
}
</style>

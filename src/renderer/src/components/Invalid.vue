<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { translateApp } from '@renderer/store/global_setting'

interface Props {
  message?: string
}

const props = defineProps<Props>()
const message = computed(
  () =>
    props.message ??
    [
      translateApp('status.invalid.line1'),
      translateApp('status.invalid.line2')
    ].join('\n')
)

onMounted(() => {
  console.debug('invalid mounted')
})

onUnmounted(() => {
  console.debug('invalid destroyed')
})
</script>
<template>
  <section class="invalid-root hero is-dark is-fullheight">
    <div class="hero-body">
      <div class="container invalid-container">
        <section class="invalid-card">
          <h1 class="title is-5 invalid-title">
            {{ translateApp('status.invalid.title') }}
          </h1>
          <p
            v-for="line in message.split('\n')"
            :key="line"
            class="subtitle is-6 invalid-message"
          >
            {{ line }}
        </p>
        </section>
      </div>
    </div>
  </section>
</template>

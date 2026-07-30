<script setup lang="ts">
import { computed, onErrorCaptured, ref, watch } from 'vue'
import Invalid from '@renderer/components/Invalid.vue'
import { isAppReady } from '@renderer/stuff/app_ready'
import type { AssistPanelDiagnosticInput } from '@common/assist-diagnostic'
import { assistPanelComponents } from './panel-registry'
import {
  getAssistPanelTitle,
  getAssistPanelDefinitions,
  type AssistPanelDefinition,
  type AssistPanelName
} from '@renderer/common/assist-panel'
import { translateApp } from '@renderer/store/global_setting'

const props = defineProps<{
  panelName: AssistPanelName
}>()

interface AssistPanelError {
  readonly error: unknown
  readonly phase: string
  readonly occurredAt: string
}

const panelError = ref<AssistPanelError | null>(null)
const renderAttempt = ref(0)
const diagnosticState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const diagnosticMessage = ref('')

const definition = computed<AssistPanelDefinition>(() => {
  const panel = getAssistPanelDefinitions(true).find(
    (candidate) => candidate.name === props.panelName
  )
  if (!panel) {
    throw new Error(`Unknown assist panel: ${props.panelName}`)
  }
  return panel
})

const panelComponent = computed(() => {
  if (definition.value.requiresAppReady && !isAppReady.value) {
    return Invalid
  }
  return assistPanelComponents[props.panelName]
})

const panelTitle = computed(() => getAssistPanelTitle(definition.value, translateApp))

function toSafeErrorDetail(error: unknown): string {
  const rawDetail =
    error instanceof Error ? `${error.name}: ${error.message}` : `Error: ${String(error)}`
  const singleLineDetail = rawDetail.replace(/\s+/g, ' ').trim()
  const redactedDetail = singleLineDetail
    .replace(/\bfile:\/\/\/\S+/gi, translateApp('status.assistPanel.localPathRedacted'))
    .replace(
      /\b[A-Z]:\\(?:[^\\\s]+\\)*[^\\\s]*/gi,
      translateApp('status.assistPanel.localPathRedacted')
    )
    .replace(/\bhttps?:\/\/\S+/gi, '[URL]')

  if (!redactedDetail) {
    return translateApp('status.assistPanel.detailUnavailable')
  }
  return redactedDetail.length > 240 ? `${redactedDetail.slice(0, 237)}...` : redactedDetail
}

const safeErrorDetail = computed(() =>
  panelError.value ? toSafeErrorDetail(panelError.value.error) : ''
)

function retryPanel(): void {
  panelError.value = null
  diagnosticState.value = 'idle'
  diagnosticMessage.value = ''
  renderAttempt.value += 1
}

function toDiagnosticInput(error: AssistPanelError): AssistPanelDiagnosticInput {
  const errorName = error.error instanceof Error ? error.error.name : 'Error'
  const errorMessage = error.error instanceof Error ? error.error.message : String(error.error)
  const errorStack =
    error.error instanceof Error && typeof error.error.stack === 'string' ? error.error.stack : null
  return {
    schemaVersion: 1,
    occurredAt: error.occurredAt,
    panelName: props.panelName,
    phase: error.phase.slice(0, 160),
    error: {
      name: errorName.slice(0, 80),
      message: errorMessage.slice(0, 8192),
      stack: errorStack?.slice(0, 65536) ?? null
    }
  }
}

async function saveDiagnostic(): Promise<void> {
  if (!panelError.value || diagnosticState.value === 'saving') {
    return
  }
  diagnosticState.value = 'saving'
  diagnosticMessage.value = translateApp('assistDiagnostic.saving')
  try {
    const result = await window.api.saveAssistPanelDiagnostic(toDiagnosticInput(panelError.value))
    if (result.status === 'cancelled') {
      diagnosticState.value = 'idle'
      diagnosticMessage.value = ''
      return
    }
    diagnosticState.value = 'saved'
    diagnosticMessage.value = translateApp('assistDiagnostic.saved', {
      params: { fileName: result.fileName }
    })
  } catch {
    diagnosticState.value = 'error'
    diagnosticMessage.value = translateApp('assistDiagnostic.failed')
  }
}

watch(
  () => props.panelName,
  () => retryPanel()
)

onErrorCaptured((error, _instance, info) => {
  panelError.value = {
    error,
    phase: info || 'unknown',
    occurredAt: new Date().toISOString()
  }
  diagnosticState.value = 'idle'
  diagnosticMessage.value = ''
  return false
})
</script>

<template>
  <section
    v-if="panelError"
    class="assist-panel-error"
    role="alert"
    :data-assist-panel="props.panelName"
    :data-layout-kind="definition.layoutKind"
  >
    <strong>{{
      translateApp('status.assistPanel.unavailable', {
        params: { panelTitle }
      })
    }}</strong>
    <p>{{ translateApp('status.assistPanel.description') }}</p>
    <details>
      <summary>{{ translateApp('status.assistPanel.errorDetails') }}</summary>
      <code>{{ safeErrorDetail }}</code>
      <span>{{
        translateApp('status.assistPanel.phase', {
          params: { phase: panelError.phase }
        })
      }}</span>
    </details>
    <div class="assist-panel-error-actions">
      <button type="button" :disabled="diagnosticState === 'saving'" @click="saveDiagnostic">
        {{ translateApp('assistDiagnostic.button') }}
      </button>
      <button type="button" @click="retryPanel">
        {{ translateApp('common.retry') }}
      </button>
    </div>
    <p
      v-if="diagnosticMessage"
      class="assist-diagnostic-status"
      :role="diagnosticState === 'error' ? 'alert' : 'status'"
      aria-live="polite"
    >
      {{ diagnosticMessage }}
    </p>
  </section>
  <component
    v-else
    :key="`${props.panelName}:${renderAttempt}`"
    :is="panelComponent"
    :data-assist-panel="props.panelName"
    :data-layout-kind="definition.layoutKind"
  />
</template>

<style scoped lang="scss">
.assist-panel-error {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  padding: 20px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  overflow: auto;
  color: #f3f3f3;
  text-align: center;
  background: #202020;

  p {
    max-width: 42em;
    margin: 0;
  }

  details {
    max-width: 100%;
    text-align: left;
  }

  summary {
    cursor: pointer;
    text-align: center;
  }

  code,
  details span {
    display: block;
    max-width: 100%;
    margin-top: 6px;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  button {
    min-width: 88px;
    padding: 5px 14px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 3px;
    color: #fff;
    background: #3c3c3c;
    cursor: pointer;

    &:hover {
      background: #505050;
    }
  }

  button:disabled {
    cursor: wait;
    opacity: 0.65;
  }
}

.assist-panel-error-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.assist-diagnostic-status {
  overflow-wrap: anywhere;
}
</style>

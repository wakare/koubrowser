<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import OptionTitleBar from './OptionTitleBar.vue'
import {
  optionSetting,
  optionViewInfo,
  translateOption
} from '@option/store/optionSetting'
import type { NullableStringOptionKey } from '@common/option'

// 何らかの要因で設定が読み取れないときはエラー状態とし閉じるのみ可能とする
const props = withDefaults(
  defineProps<{
    isError?: boolean
  }>(),
  {
    isError: false
  }
)

type CategoryKey = 'general' | 'network' | 'extension';
interface CategoryInfo {
  readonly key: CategoryKey
  readonly title: string
  readonly description: string
}

const categories = computed<readonly CategoryInfo[]>(() => [
  {
    key: 'general',
    title: translateOption('option.category.general'),
    description: translateOption('option.category.generalDescription')
  },
  {
    key: 'network',
    title: translateOption('option.category.network'),
    description: translateOption('option.category.networkDescription')
  },
  {
    key: 'extension',
    title: translateOption('option.category.extension'),
    description: translateOption('option.category.extensionDescription')
  }
  // {
  //   key: 'assist',
  //   title: 'アシスト',
  //   description: 'ゲーム内アシスト表示とアシストウインドウに関する設定'
  // },
  // {
  //   key: 'record',
  //   title: '記録',
  //   description: 'スクリーンショット、録画、ローカル記録に関する設定'
  // }
])

///////////////////////////////////////////////////////////////
// option stuff
const selectedCategoryKey = ref<CategoryKey>('general')
const currentCategory = computed(
  () =>
    categories.value.find((category) => category.key === selectedCategoryKey.value) ??
    categories.value[0]
)

const isCurrentCategory = (key: CategoryKey): boolean => {
  return selectedCategoryKey.value === key
}

const close = (): void => {
  window.optionApi.close()
}

///////////////////////////////////////////////////////////////
// option - path
const selectCaptureSavePath = (): void => {
  window.optionApi.selectCaptureSavePath().then((path => {
    if (path) {
      optionSetting.captureSavePath = path
    }
  }))
}

const resetCaptureSavePath = (): void => {
  optionSetting.captureSavePath = null
}

const isCaptureSavePathDefault = computed(() => {
  return ! optionSetting.captureSavePath
})

///////////////////////////////////////////////////////////////
// option - extension
const extensionPath = computed(() => optionSetting.extensions[0]?.path ?? '')

const selectExtensionPath = (): void => {
  window.optionApi.selectExtensionPath().then((path => {
    if (path) {
      optionSetting.extensions = [{ path }]
    }
  }))
}

const resetExtensionPath = (): void => {
  optionSetting.extensions = []
}

const isExtensionPathDefault = computed(() => {
  return optionSetting.extensions.length === 0
})

///////////////////////////////////////////////////////////////
// option - proxy
function nullableStringInput(key: NullableStringOptionKey) {
  return computed({
    get: () => optionSetting[key] ?? '',
    set: (value: string) => {
      const trimmed = value.trim()
      optionSetting[key] = trimmed === '' ? null : trimmed
    }
  })
}
const proxyPacScriptInput = nullableStringInput('proxyPacScript')
const proxyFixedServersInput = nullableStringInput('proxyFixedServers')
const proxyPacScriptInputRef = ref<HTMLInputElement | null>(null)
const proxyFixedServersInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => optionSetting.proxyMode,
  async (mode) => {
    await nextTick()

    if (mode === 'pac_script') {
      proxyPacScriptInputRef.value?.focus()
    } else if (mode === 'fixed_servers') {
      proxyFixedServersInputRef.value?.focus()
    }
  }
)

const hasProxyPacScriptInput = ref(Boolean(optionSetting.proxyPacScript))
const hasProxyFixedServersInput = ref(Boolean(optionSetting.proxyFixedServers))

const onProxyPacScriptInput = (event: Event): void => {
  hasProxyPacScriptInput.value = (event.target as HTMLInputElement).value !== ''
}

const clearProxyPacScriptInput = (): void => {
  optionSetting.proxyPacScript = null
  hasProxyPacScriptInput.value = false
}

const onProxyFixedServersInput = (event: Event): void => {
  hasProxyFixedServersInput.value = (event.target as HTMLInputElement).value !== ''
}

const clearProxyFixedServersInput = (): void => {
  optionSetting.proxyFixedServers = null
  hasProxyFixedServersInput.value = false
}

</script>

<template>
  <div class="option-window">
    <OptionTitleBar />

    <div v-if="props.isError" class="option-error-overlay" role="alertdialog" aria-modal="true">
      <div class="option-error-dialog">
        <div class="option-error-title">{{ translateOption('option.loadError.title') }}</div>
        <div class="option-error-message">
          {{ translateOption('option.loadError.message') }}
        </div>
        <button class="option-error-close-button" type="button" @click="close">
          {{ translateOption('common.close') }}
        </button>
      </div>
    </div>

    <main class="option-shell" :class="{ 'is-error': props.isError }">
      <aside
        class="option-sidebar"
        :aria-label="translateOption('option.categoryLabel')"
      >
        <div class="option-brand">
          <div class="option-title">{{ translateOption('option.title') }}</div>
        </div>
        <nav class="option-categories">
          <button
            v-for="category in categories"
            :key="category.key"
            class="option-category"
            :class="{ 'is-active': selectedCategoryKey === category.key }"
            type="button"
            @click="selectedCategoryKey = category.key"
          >
            {{ category.title }}
          </button>
        </nav>
      </aside>

      <section class="option-content">
        <header class="option-content-header">
          <div>
            <span class="header-text">{{ currentCategory.title }}</span>
            <span class="header-desc-text">{{ currentCategory.description }}</span>
          </div>
        </header>

        <div class="option-panel">

          <!-- 一般 -->
          <section v-if="isCurrentCategory('general')" class="option-section">
            <div class="section-title">{{ translateOption('option.savePath.section') }}</div>
            <div class="option-row option-row-vertical">
              <span>
                <span class="option-row-title">{{
                  translateOption('option.captureFolder.title')
                }}</span>
                <span class="option-row-description">{{
                  translateOption('option.captureFolder.description')
                }}</span>
                <span class="option-row-subdescription">
                  {{ translateOption('option.defaultValueLabel') }}
                  <span class="selectable">{{ optionViewInfo.defaultCaptureSavePath }}</span>
                </span>
              </span>
              <div class="option-path-control">
                <input
                  class="option-path-input"
                  type="text"
                  :value="optionSetting.captureSavePath ?? ''"
                  readonly
                  :aria-label="translateOption('option.captureFolder.ariaLabel')"
                  :placeholder="translateOption('option.captureFolder.placeholder')"
                />
                <button class="option-path-button" type="button" @click="selectCaptureSavePath">
                  {{ translateOption('common.browse') }}
                </button>
                <button class="option-path-button secondary" 
                  type="button" 
                  :disabled="isCaptureSavePathDefault"
                  @click="resetCaptureSavePath">
                  {{ translateOption('common.resetDefault') }}
                </button>
              </div>
            </div>

            <div class="section-title">{{ translateOption('option.recording.section') }}</div>
            <div class="option-row option-row-vertical">
              <div>
                <div class="option-row-title">
                  {{ translateOption('option.recording.targetTitle') }}
                </div>
                <div class="option-row-description">
                  {{ translateOption('option.recording.description') }}
                </div>
              </div>
              <div class="option-radio-group">
                <label class="option-radio option-radio-with-description">
                  <input
                    v-model="optionSetting.recordingTarget"
                    type="radio"
                    value="game"
                  />
                  <span class="option-radio-body">
                    <span class="option-radio-title">{{
                      translateOption('option.recording.gameTitle')
                    }}</span>
                    <span class="option-radio-description">
                      {{ translateOption('option.recording.gameDescription') }}
                    </span>
                  </span>
                </label>
                <label class="option-radio option-radio-with-description">
                  <input
                    v-model="optionSetting.recordingTarget"
                    type="radio"
                    value="window"
                  />
                  <span class="option-radio-body">
                    <span class="option-radio-title">{{
                      translateOption('option.recording.windowTitle')
                    }}</span>
                    <span class="option-radio-description">
                      {{ translateOption('option.recording.windowDescription') }}
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </section>

          <!-- 通信設定 -->
          <section v-if="isCurrentCategory('network')" class="option-section">
            <div class="section-title">
              {{ translateOption('option.network.proxy.section') }}
            </div>

            <div class="option-row option-row-vertical">
              <div>
                <div class="option-row-title">
                  {{ translateOption('option.network.proxy.title') }}
                </div>
                <div class="option-row-description">
                  {{ translateOption('option.network.proxy.description') }}
                </div>
                <div class="option-row-description">
                  {{
                    translateOption('option.network.proxy.externalToolDescription', {
                      params: { tool: '74EO' }
                    })
                  }}
                </div>
              </div>

              <div class="option-radio-group">
                <label class="option-radio">
                  <input v-model="optionSetting.proxyMode" type="radio" value="system" />
                  <span>{{ translateOption('option.network.proxy.system') }}</span>
                </label>

                <label class="option-radio">
                  <input v-model="optionSetting.proxyMode" type="radio" value="direct" />
                  <span>{{ translateOption('option.network.proxy.direct') }}</span>
                </label>

                <label class="option-radio">
                  <input v-model="optionSetting.proxyMode" type="radio" value="auto_detect" />
                  <span>{{ translateOption('option.network.proxy.autoDetect') }}</span>
                </label>

                <label class="option-radio option-radio-with-description">
                  <input v-model="optionSetting.proxyMode" type="radio" value="pac_script" />

                  <span class="option-radio-body">
                    <span class="option-radio-title">{{
                      translateOption('option.network.proxy.pacTitle')
                    }}</span>
                    <span class="option-radio-description">
                      <span>{{
                        translateOption('option.network.proxy.pacProtocols', {
                          params: {
                            supported: 'http, https, data',
                            unsupported: 'file'
                          }
                        })
                      }}</span>
                    </span>
                    <span class="option-radio-description">
                      {{ translateOption('option.network.proxy.pacHttpExampleLabel') }}
                      <span class="selectable">http://localhost:8080/proxy.pac</span>
                    </span>
                    <span class="option-radio-description">
                      {{ translateOption('option.network.proxy.pacDataExampleLabel') }}
                      <span class="selectable">data:application/x-ns-proxy-autoconfig,xxxxx</span>
                    </span>
                  </span>

                </label>

                <div class="option-input-clearable">
                  <input
                    ref="proxyPacScriptInputRef"
                    v-model.lazy="proxyPacScriptInput"
                    class="option-text-input"
                    type="url"
                    :placeholder="translateOption('option.network.proxy.pacPlaceholder')"
                    :aria-label="translateOption('option.network.proxy.pacAriaLabel')"
                    :disabled="optionSetting.proxyMode !== 'pac_script'"
                    @input="onProxyPacScriptInput"
                  />
                  <button
                    v-if="hasProxyPacScriptInput"
                    class="option-input-clear-button"
                    type="button"
                    :aria-label="translateOption('option.network.proxy.pacClearAriaLabel')"
                    @click="clearProxyPacScriptInput"
                  >&#10005;</button>
                </div>

                <label class="option-radio option-radio-with-description">
                  <input v-model="optionSetting.proxyMode" type="radio" value="fixed_servers" />

                  <span class="option-radio-body">
                    <span class="option-radio-title">{{
                      translateOption('option.network.proxy.fixedTitle')
                    }}</span>
                    <span class="option-radio-description">
                      {{ translateOption('option.network.proxy.fixedExampleLabel') }}
                      <span class="selectable">http=localhost:40620;https=localhost:40620</span>
                    </span>
                  </span>
                </label>

                <div class="option-input-clearable">
                  <input
                    ref="proxyFixedServersInputRef"
                    v-model.lazy="proxyFixedServersInput"
                    class="option-text-input"
                    type="text"
                    :placeholder="translateOption('option.network.proxy.fixedPlaceholder')"
                    :aria-label="translateOption('option.network.proxy.fixedAriaLabel')"
                    :disabled="optionSetting.proxyMode !== 'fixed_servers'"
                    @input="onProxyFixedServersInput"
                  />
                  <button
                    v-if="hasProxyFixedServersInput"
                    class="option-input-clear-button"
                    type="button"
                    :aria-label="translateOption('option.network.proxy.fixedClearAriaLabel')"
                    @click="clearProxyFixedServersInput"
                  >&#10005;</button>
                </div>
              </div>
            </div>
          </section>

          <!-- 拡張機能 -->
          <section v-if="isCurrentCategory('extension')" class="option-section">
            <div class="section-title">
              {{ translateOption('option.extension.section') }}
            </div>
            <div class="option-row option-row-vertical">
              <span>
                <span class="option-row-title">{{
                  translateOption('option.extension.folderTitle')
                }}</span>
                <span class="option-row-description">
                  {{ translateOption('option.extension.description') }}
                </span>
                <span class="option-row-description">
                  {{ translateOption('option.extension.security') }}
                </span>
              </span>
              <div class="option-path-control">
                <input
                  class="option-path-input"
                  type="text"
                  :value="extensionPath"
                  readonly
                  :aria-label="translateOption('option.extension.folderAriaLabel')"
                  :placeholder="translateOption('option.extension.folderPlaceholder')"
                />
                <button class="option-path-button" type="button" @click="selectExtensionPath">
                  {{ translateOption('common.browse') }}
                </button>
                <button class="option-path-button secondary"
                  type="button"
                  :disabled="isExtensionPathDefault"
                  @click="resetExtensionPath">
                  {{ translateOption('common.clear') }}
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  </div>
</template>

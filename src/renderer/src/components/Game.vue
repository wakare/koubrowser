<script setup lang="ts">
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
// webview
// https://www.electronjs.org/ja/docs/latest/api/webview-tag
import { WebviewTag, IpcRendererEvent } from 'electron'
import { gameSetting } from '@renderer/store/gamesetting'
import { GameChannel } from '@common/channel'
import { Const } from '@common/const'
import { gameState } from '@renderer/store/gamestate'
import { EnvRenderer } from '@renderer/common/env-renderer'
import { MainRendererState } from '@renderer/store/renderer_state'
import TaihaInputBlocker from '@renderer/components/TaihaInputBlocker.vue'
import {
  acknowledgeTaihaProtection,
  isTaihaInputProtectionActive
} from '@renderer/store/taiha_protection'
const ipcRenderer = window.electron.ipcRenderer
const el = ref<HTMLElement | null>(null)
const taihaInputProtectionActive = computed(() =>
  isTaihaInputProtectionActive()
)

/////////////////////////////////////////////////////////////////////////////////////
// デバッグログ
const DEBUG = 0;

const debug = (...args: any[]) => {
  if (DEBUG) console.debug("[game webview]", ...args);
};

/////////////////////////////////////////////////////////////////////////////////////
// 

// mute状態はDOM-READY後ではないと設定できないことに注意
let mutedStateApplied = false

watch(
  () => gameSetting.zoom_factor,
  (newVal, oldVal) => {
    debug('zoom factor changed', gameSetting.zoom_factor)
    getWebviewUnsafe().setZoomFactor(gameSetting.zoom_factor)

    debug('zoom factor changed', newVal, oldVal)
    if (newVal !== oldVal) {
      const webview = getWebview()
      if (webview) {
        webview.setZoomFactor(newVal)
      }
    }
  }
)

function gameUrl(): string {
  // if use test data
  if (EnvRenderer.isTestMode) {
    return 'about:blank'
  }
  return Const.GamePageUrl
}

function getWebview(): WebviewTag | undefined {
  if (el.value === null) {
    return undefined
  }

  const ret = el.value!.querySelector('#kb')
  if (ret) {
    return ret as WebviewTag
  }
  return undefined
}

function getWebviewUnsafe(): WebviewTag {
  return getWebview() as WebviewTag
}

onMounted(() => {
  const webview = getWebview()
  debug('game mounted >> webview', webview, 'appLaunchId:', EnvRenderer.appLaunchId)
  if (webview) {
    webview.addEventListener('dom-ready', domReady)
    webview.addEventListener('did-start-loading', didStartLoading)
    webview.addEventListener('did-finish-loading', didFinishLoading)
    webview.addEventListener('media-started-playing', mediaStartedPlaying)
    webview.addEventListener('media-paused', mediaPaused)
  }

  ipcRenderer.on(GameChannel.set_zoom_factor, setZoomFactor)
  debug('game mounted <<')
})

onUnmounted(() => {
  const webview = getWebview()
  debug('game destroyed webview:', webview)
  debug('game unmounted >>')
  if (webview) {
    webview.removeEventListener('dom-ready', domReady)
    webview.removeEventListener('did-start-loading', didStartLoading)
    webview.removeEventListener('did-finish-loading', didFinishLoading)
    webview.removeEventListener('media-started-playing', mediaStartedPlaying)
    webview.removeEventListener('media-paused', mediaPaused)
  }
  debug('game unmounted <<')
})

function setZoomFactor(_event: IpcRendererEvent, factor: number): void {
  debug(GameChannel.set_zoom_factor, factor)
  getWebviewUnsafe().setZoomFactor(factor)
}

function domReady(_event: Event): void {
  debug('domReady')

  // apply muted state if needed
  if (!mutedStateApplied) {
    mutedStateApplied = true
    debug('apply muted state in domReady, muted:', gameState.muted)

    if (gameState.muted) {
      // mute状態では無ければmuteに設定
      const webview = getWebview()
      if (webview) {
        debug('initially muted. check webview muted state:', webview.isAudioMuted())
        if (!webview.isAudioMuted()) {
          setMute(true, false)
        }
      }
    }
  }

  getWebviewUnsafe().setZoomFactor(gameSetting.zoom_factor)
}

function didStartLoading(_event: Event): void {
  debug('did-start-loading')
}

function didFinishLoading(_event: Event): void {
  debug('did-finish-loading')
}

function mediaStartedPlaying(_event: Event): void {
  debug('mediaStartedPlaying')
}

function mediaPaused(_event: Event): void {
  debug('mediaPaused')
}

function setMute(mute: boolean, notifyCheck: boolean): void {
  const webview = getWebview()
  if (webview) {
    const oldMuted = gameState.muted
    debug('now webview muted:', webview.isAudioMuted(), 'muted state:', oldMuted, 'notifyCheck:', notifyCheck)
    webview.setAudioMuted(mute)
    gameState.muted = webview.isAudioMuted()
    MainRendererState.updateRendererState(gameState.muted)
    debug('set muted:', gameState.muted)
    if (notifyCheck && oldMuted !== gameState.muted) {
      debug('notify mute state changed:', gameState.muted)
      window.api.notifyMuteState(gameState.muted)
    }
  }
}

// exports
defineExpose({
  getWebview,
  setMute
})
</script>
<template>
  <div class="game-container" ref="el">
    <webview
      id="kb"
      class="kb"
      :src="gameUrl()"
      allowpopups
      enableremotemodule="false"
      nodeintegration="false"
      nodeIntegrationInSubFrames="true"
      webPreferences="contextIsolation=no, sandbox=no, backgroundThrottling=no"
    ></webview>
    <TaihaInputBlocker
      v-if="taihaInputProtectionActive"
      @acknowledge="acknowledgeTaihaProtection"
    />
  </div>
</template>

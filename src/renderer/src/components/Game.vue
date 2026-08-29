<script setup lang="ts">
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
// webview
// https://www.electronjs.org/ja/docs/latest/api/webview-tag
import { WebviewTag, IpcRendererEvent } from 'electron'
import { gameSetting } from '@renderer/store/gamesetting'
import { GameChannel, TaihaSingekiBlockState } from '@common/channel'
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
import BlockShield from '@renderer/components/BlockShield.vue'
import * as kcs_stuff from '@renderer/stuff/kcs_stuff'
import WarningIcon from '@assets/img/warning.svg'
import { ApiCallback } from '@common/kcs'
import { Api } from '@common/kcsapi'
import { svdata } from '@renderer/store/svdata'
import { translateApp } from '@renderer/store/global_setting'

type BlockShieldInstance = InstanceType<typeof BlockShield>
const normalBlockShieldRef = ref<BlockShieldInstance | null>(null)
const repairBlockShieldRef = ref<BlockShieldInstance | null>(null)
const megamiBlockShieldRef = ref<BlockShieldInstance | null>(null)
let stopSetZoomFactor: (() => void) | null = null
let stopGuardHitEffect: (() => void) | null = null

/////////////////////////////////////////////////////////////////////////////////////
// デバッグログ
const DEBUG = 0;

const debug = (...args: any[]) => {
  if (DEBUG) console.debug("[game webview]", ...args);
};

/////////////////////////////////////////////////////////////////////////////////////
// 大破進撃防止関連
let cb_port = 0;
let cb_battle_result = 0;
let cb_combined_battle_result = 0;
let cb_goback_port = 0;
let cb_combined_goback_port = 0;
let cb_map_next = 0;
const taihaSingekiResult = ref<kcs_stuff.CheckTaihaSingekiResult | null>(null)
let blockShieldVisibleTimer: ReturnType<typeof setTimeout> | null = null
const isBlockShieldSwitch = ref<boolean>(true)
const taihaSingekiRechecked = ref<boolean>(false)

// アニメーション完了後に要素を削除するための判定に使用
const isTaihaWarningInAnimation = ref(false)

const clearBlockShieldVisibleTimer = () => {
  if (blockShieldVisibleTimer) {
    clearTimeout(blockShieldVisibleTimer)
    blockShieldVisibleTimer = null
  }
}

const taihaSingekiBlockStates = computed<TaihaSingekiBlockState[]>(() => {
  if (!taihaSingekiResult.value || !taihaSingekiResult.value.isTaihaSingeki) {
    return []
  }

  const states: TaihaSingekiBlockState[] = []
  const infos = taihaSingekiResult.value.infos

  for (const info of infos) {
    if (info.equips.includes(kcs_stuff.EquipType.flagship_megami)) {
      states.push(TaihaSingekiBlockState.megamiBlock)
    }
    if (info.equips.includes(kcs_stuff.EquipType.flagship_repair)) {
      states.push(TaihaSingekiBlockState.repairBlock)
    }
  }

  // 旗艦ではない場合、通常ブロック
  if (states.length === 0) {
    states.push(TaihaSingekiBlockState.normalBlock)
  }
  
  return states
})

/////////////////////////////////////////////////////////////////////////////////////
// game webview関連

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

  stopSetZoomFactor = ipcRenderer.on(GameChannel.set_zoom_factor, setZoomFactor)
  stopGuardHitEffect = ipcRenderer.on(GameChannel.guard_hit_effect, guardHitEffect)

  // 大破進撃防止関連
  cb_port = ApiCallback.set([Api.PORT_PORT, () => onPort()])
  cb_battle_result = ApiCallback.set(
    [Api.REQ_SORTIE_BATTLERESULT, () => onBattleResult()]
  )
  cb_combined_battle_result = ApiCallback.set(
    [Api.REQ_COMBINED_BATTLE_BATTLERESULT, () => onBattleResult()]
  )
  cb_goback_port = ApiCallback.set(
    [Api.REQ_SORTIE_GOBACK_PORT, () => onGobackPort()]
  )
  cb_combined_goback_port = ApiCallback.set(
    [Api.REQ_COMBINED_BATTLE_GOBACK_PORT, () => onGobackPort()]
  )
  cb_map_next = ApiCallback.set(
    [Api.REQ_MAP_NEXT, () => onMapNext()]
  )

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

  stopSetZoomFactor?.()
  stopSetZoomFactor = null

  stopGuardHitEffect?.()
  stopGuardHitEffect = null

  if (cb_port) {
    ApiCallback.unset(cb_port)
    cb_port = 0
  }
  if (cb_battle_result) {
    ApiCallback.unset(cb_battle_result)
    cb_battle_result = 0
  }
  if (cb_combined_battle_result) {
    ApiCallback.unset(cb_combined_battle_result)
    cb_combined_battle_result = 0
  }
  if (cb_goback_port) {
    ApiCallback.unset(cb_goback_port)
    cb_goback_port = 0
  }
  if (cb_combined_goback_port) {
    ApiCallback.unset(cb_combined_goback_port)
    cb_combined_goback_port = 0
  }
  if (cb_map_next) {
    ApiCallback.unset(cb_map_next)
    cb_map_next = 0
  }
  clearBlockShieldVisibleTimer()

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

/////////////////////////////////////////////////////////////////////////////////////
// 大破進撃関連
function onPort(): void {
  debug('onPort')
  taihaSingekiResult.value = null
  window.api.setTaihaSingekiBlockState([])
  clearBlockShieldVisibleTimer()
}

/**
 * 大破進撃チェック
 * 大破艦がいれば、大破進撃防止UIを表示する
 */
const checkSingekiBlock = () => {

  const result = kcs_stuff.checkTaihaSingeki(kcs_stuff.TaihaCheckPhase.afterBattle)
  debug('onBattleResult', result)

  if (! result.isTaihaSingeki) {
    debug('onBattleResult: no taiha singeki')
    taihaSingekiResult.value = null
    window.api.setTaihaSingekiBlockState([])
    return
  }

  // 大破判定となった場合、戦闘結果画面が表示される約9秒後に表示する
  const delayMs = 9000
  blockShieldVisibleTimer = setTimeout(() => {
    taihaSingekiResult.value = result
    window.api.setTaihaSingekiBlockState(taihaSingekiBlockStates.value)
    isTaihaWarningInAnimation.value = true
    blockShieldVisibleTimer = null
  }, delayMs)
}

/**
 * 戦闘結果終了
 * 大破進撃防止判定を行う
 */
function onBattleResult(): void {

  clearBlockShieldVisibleTimer()
  isTaihaWarningInAnimation.value = false
  isBlockShieldSwitch.value = true
  taihaSingekiRechecked.value = false
  gameState.ctrl_pressed = false

  debug('onBattleResult: check taiha singeki block.',
    'enable:', gameSetting.taihaSingekiBlockEnable,
    'skip safe cell:', gameSetting.taihaSingekiBlockSkipSafeCell)

  // オプション設定で無効
  if (! gameSetting.taihaSingekiBlockEnable) {
    debug('onBattleResult: taiha singeki block disabled by option')
    return
  }

  // オプション設定で安全マススキップ有効で、かつ安全マスなら判定しない
  if (gameSetting.taihaSingekiBlockSkipSafeCell) {
    if (kcs_stuff.currentIsSafeCell()) {
      debug('onBattleResult: safe cell, skip taiha singeki block check')
      return
    }
  }

  // todo
  // 大破進撃防止の判定は、艦隊HP更新後に行う必要があることの改善
  // 艦隊HP更新はcallback呼び出し後に行われることからsettimeoutで遅延判定する
  setTimeout(() => {
    checkSingekiBlock()
  }, 0)
}

/**
 * 退避が行われた場合は、再度大破進撃判定を行う
 */
function onGobackPort(): void {

  // 大破進撃判定済みで再度判定を行う
  // オプション設定で無効であっても一度動作した大破進撃チェックは継続して動作させる
  const currentResult = taihaSingekiResult.value
  if (! currentResult || !currentResult.isTaihaSingeki) {
    debug('onGobackPort: no taiha singeki result, skip recheck')
    return
  }

  // 退避が行われた場合、再度大破進撃判定
  const result = kcs_stuff.checkTaihaSingeki(kcs_stuff.TaihaCheckPhase.afterBattle)
  if (result.isTaihaSingeki) {
    // 情報更新
    debug('onGobackPort: taiha singeki')
    taihaSingekiRechecked.value = true
    taihaSingekiResult.value = result
    window.api.setTaihaSingekiBlockState(taihaSingekiBlockStates.value)
  } else {
    debug('onGobackPort: no taiha singeki')

    // UI非表示
    taihaSingekiResult.value = null
    window.api.setTaihaSingekiBlockState([])
  }
}

function onMapNext(): void {
  debug('onMapNext')
  taihaSingekiResult.value = null
  window.api.setTaihaSingekiBlockState([])
}

const isTaihaSingekiBlock = computed<boolean>(() => {
  const result = taihaSingekiResult.value
  if (!result) {
    debug('isTaihaAdvanceBlockerVisible: no result')
    return false
  }
  debug('isTaihaAdvanceBlockerVisible: result', result)
  return result.isTaihaSingeki
})

type TaihaShipInfo = {
  // Lv.xx艦名(修理,女神)
  // Lv.xx艦名(ダメコンなし)
  shipText: string
  hasMegami: boolean
  hasRepair: boolean
  noDamageControl: boolean
  subText: string
}

const taihaShipInfos = computed<TaihaShipInfo[]>(() => {
  const result = taihaSingekiResult.value
  if (!result || !result.isTaihaSingeki) {
    debug('taihaShipInfos: no result')
    return []
  }
  let escapeTextAdded = false
  return result.infos.map((info) => {
    let subTexts: string[] = []
    const hasMegami = info.equips.includes(kcs_stuff.EquipType.flagship_megami) ||
      info.equips.includes(kcs_stuff.EquipType.megami)
    const hasRepair = info.equips.includes(kcs_stuff.EquipType.flagship_repair) ||
      info.equips.includes(kcs_stuff.EquipType.repair)
    const noDamageControl = info.equips.length === 0
    if (noDamageControl) {
      subTexts.push(translateApp('taihaProtection.blockShield.noDamageControl'))
    }

    // 退避可能艦表示
    // 再チェック後では表示しない
    if (!taihaSingekiRechecked.value) {
      if (info.canEscape && !escapeTextAdded) {
        subTexts.push(translateApp('taihaProtection.blockShield.canEscape'))
        escapeTextAdded = true
      }
    }

    const api = info.api_ship
    const mst = svdata.mstShip(api.api_ship_id)
    const shipText = `Lv.${api.api_lv}${mst?.api_name ?? ''}`
    const subText = subTexts.join(',')

    return {
      shipText,
      subText,
      hasMegami,
      hasRepair,
      noDamageControl
    }
  })
})

const onBlockShieldSwitchChanged = (enabled: boolean): void => {
  debug('block shield changed', enabled)

  if (!enabled) {
    // シールドOFFにした場合、進撃操作可能
    window.api.setTaihaSingekiBlockState([])
  } else {
    // シールドONにした場合、進撃操作制限
    window.api.setTaihaSingekiBlockState(taihaSingekiBlockStates.value)
  }
}

const isShieldVisible = (state: TaihaSingekiBlockState): boolean => {

  // 大破判定無しでは非表示
  // ボタンを押して進撃、もしくはポートに戻った場合
  if (!isTaihaSingekiBlock.value) {
    debug('isShieldVisible: no taiha, shield hidden')
    return false
  }

  // Ctrlキー押下時ならシールド非表示
  if (gameState.ctrl_pressed) {
    debug('isShieldVisible: ctrl pressed, shield hidden')
    return false
  }

  // switch offで非表示
  if (!isBlockShieldSwitch.value) {
    debug('isShieldVisible: switch off, shield hidden')
    return false
  }

  // 表示場所判定
  const visible = taihaSingekiBlockStates.value.includes(state)
  debug('isShieldVisible', state, 'visible:', visible, 'states:', taihaSingekiBlockStates.value)
  return visible
}

// 全体のオーバレイはアニメーション完了で要素を削除する
const isTaihaOverlayVisible = computed<boolean>(() => {
  debug('isTaihaOverlayVisible',
  'isTaihaSingekiBlock:', isTaihaSingekiBlock.value, 
  'isTaihaWarningInAnimation:', isTaihaWarningInAnimation.value)
  
  if(isTaihaSingekiBlock.value) {
    return true
  }

  return isTaihaWarningInAnimation.value
})

const onTaihaWarningAfterLeave = (): void => {
  debug('onTaihaWarningAfterLeave')
  isTaihaWarningInAnimation.value = false
}

function guardHitEffect(_event: IpcRendererEvent, state: TaihaSingekiBlockState): void {
  debug(GameChannel.guard_hit_effect, state)
  if (state === TaihaSingekiBlockState.normalBlock) {
    normalBlockShieldRef.value?.doGuardHitEffect()
  } else if (state === TaihaSingekiBlockState.repairBlock) {
    repairBlockShieldRef.value?.doGuardHitEffect()
  } else if (state === TaihaSingekiBlockState.megamiBlock) {
    megamiBlockShieldRef.value?.doGuardHitEffect()
  }
}

const normalBlockRectRate = Const.TaihaSingeki.normalBlockRect
const isNormalBlockVisible = computed<boolean>(() => isShieldVisible(TaihaSingekiBlockState.normalBlock))
const repairBlockRectRate = Const.TaihaSingeki.repairBlockRect
const isRepairBlockVisible = computed<boolean>(() => isShieldVisible(TaihaSingekiBlockState.repairBlock))
const megamiBlockRectRate = Const.TaihaSingeki.megamiBlockRect
const isMegamiBlockVisible = computed<boolean>(() => isShieldVisible(TaihaSingekiBlockState.megamiBlock))

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

    <div
      v-if="isTaihaOverlayVisible"
      class="taiha-overlay"
    >
      <transition name="slide-effect" appear @after-leave="onTaihaWarningAfterLeave">
        <div 
          v-if="isTaihaSingekiBlock"
          class="taiha-warning-banner">
          <div class="banner-title">
            <WarningIcon />{{ translateApp('taihaProtection.blockShield.bannerTitle') }}
          </div>
          <div class="banner-text">
            {{ translateApp('taihaProtection.blockShield.bannerDescription') }}
          </div>
          <div class="banner-text">
            {{ translateApp('taihaProtection.blockShield.shipLabel') }}<template v-for="(info, index) in taihaShipInfos"
              :key="`${index}-${info.shipText}-${info.subText}`"><span 
              class="taiha-info">{{ info.shipText }}&#12308;<img
              v-if="info.hasRepair" class="dameconimg" src="../assets/img/app/repair.png"/><img 
              v-if="info.hasMegami" class="dameconimg" src="../assets/img/app/megami.png"/><WarningIcon 
              v-if="info.noDamageControl" />{{ info.subText }}&#12309;</span><template v-if="index < taihaShipInfos.length - 1">, </template>
            </template>
          </div>
        </div>
      </transition>

      <transition name="slide-effect" appear>
        <b-switch
          v-if="isTaihaSingekiBlock"
          v-model="isBlockShieldSwitch"
          type="is-danger"
          class="block-shield-toggle"
          :left-label="true"
          @update:modelValue="onBlockShieldSwitchChanged"
        ><span class="switch-text">{{
          translateApp(
            isBlockShieldSwitch
              ? 'taihaProtection.blockShield.on'
              : 'taihaProtection.blockShield.off'
          )
        }}</span></b-switch>
      </transition>

      <BlockShield 
        v-if="isNormalBlockVisible" 
        ref="normalBlockShieldRef"
        :rect-rate="normalBlockRectRate" />
      <BlockShield 
        v-if="isRepairBlockVisible" 
        ref="repairBlockShieldRef"
        :rect-rate="repairBlockRectRate" />
      <BlockShield 
        v-if="isMegamiBlockVisible" 
        ref="megamiBlockShieldRef"
        :rect-rate="megamiBlockRectRate" />
      </div>

  </div>
</template>

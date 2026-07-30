<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import {
  classicLayoutMetrics,
  workspaceLayoutMetrics,
  type LayoutSurface
} from '@common/layout'
import { InvalidQuestContext, TimelineResult } from '@common/channel'
import { gameSetting } from '@renderer/store/gamesetting'
import { EnvRenderer } from '@renderer/common/env-renderer'
import TitleBar from '@renderer/components/TitleBar.vue'
import Timeline from '@renderer/components/Timeline.vue'
import QuestList from '@renderer/components/QuestList.vue'
import NDockList from '@renderer/components/NDockList.vue'
import KDockList from '@renderer/components/KDockList.vue'
import Game from '@renderer/components/Game.vue'
import Assist from '@renderer/components/Assist.vue'
import Invalid from '@renderer/components/Invalid.vue'
import AssistWorkspace from '@renderer/components/assist/AssistWorkspace.vue'
import CaptureNotice from '@renderer/components/CaptureNotice.vue'
import LayoutHpGaugeFixture from '@renderer/components/LayoutHpGaugeFixture.vue'
import { captureStuff } from '@renderer/stuff/capture'
import { recorderStuffRenderer } from '@renderer/stuff/recorder'
import { isAppReady } from '@renderer/stuff/app_ready'
import { gameState } from '@renderer/store/gamestate'
import { BattleRecord, recordMapIdToIdNo } from '@common/record'
import { CellInfo } from '@common/map'
import { mapInfoCache } from './common/mapinfo'
import {
  activeLocalizationLocale,
  translateApp
} from '@renderer/store/global_setting'
const el = ref<HTMLElement | null>(null)
const game = ref<InstanceType<typeof Game> | null>(null)
const captureNotice = ref<{ kind: 'success' | 'error'; message: string } | null>(null)
let captureNoticeTimer: ReturnType<typeof setTimeout> | null = null

const in_timeline_query = ref(false)
const show_timeline = ref(false)
const timeline_data: TimelineResult = reactive([InvalidQuestContext(), []])

const rendererIsGame = (): boolean => {
  return !EnvRenderer.isAssist
}

const layoutSurface = computed<LayoutSurface>(() => {
  if (EnvRenderer.isAssist) {
    return 'assist-window'
  }
  if (gameSetting.layoutMode === 'workspace') {
    return 'workspace'
  }
  return gameSetting.assistInGame ? 'classic-combined' : 'game-only'
})

const isWorkspace = computed((): boolean => {
  return rendererIsGame() && layoutSurface.value === 'workspace'
})

onMounted(() => {
  console.log('main mounted', timeline_data, in_timeline_query.value, show_timeline.value)

})

function getGame() {
  return game.value
}

const mainStyle = computed(() => {
  const usesFixedGameStage =
    gameSetting.assistInGame || gameSetting.layoutMode === 'workspace'
  const workspaceGameScale =
    gameSetting.layoutMode === 'workspace'
      ? Math.min(1, Math.max(0.01, gameSetting.zoom_factor))
      : 1
  return {
    '--game-width': usesFixedGameStage
      ? `${Math.floor(classicLayoutMetrics.gameWidth * workspaceGameScale)}px`
      : '100%',
    '--game-height': usesFixedGameStage
      ? `${Math.floor(classicLayoutMetrics.gameHeight * workspaceGameScale)}px`
      : '100%',
    '--titlebar-height': rendererIsGame()
      ? `${classicLayoutMetrics.titleBarHeight}px`
      : '0px',
    '--assist-bottom-height': `${classicLayoutMetrics.assistBottomHeight}px`,
    '--workspace-panel-min-width': `${workspaceLayoutMetrics.panelMinWidth}px`,
    '--workspace-panel-min-height': `${workspaceLayoutMetrics.panelMinHeight}px`,
    '--workspace-gap': `${workspaceLayoutMetrics.gap}px`,
    '--assist-width': EnvRenderer.isAssist
      ? '100%'
      : `${classicLayoutMetrics.assistWidth}px`
  }
})

onBeforeUnmount(() => {
  if (captureNoticeTimer !== null) {
    clearTimeout(captureNoticeTimer)
  }
})

const assistInGame = (): boolean => {
  return gameSetting.assistInGame
}

async function fetchCellInfo(records: BattleRecord[]): Promise<CellInfo[]> {
  const tasks: Promise<CellInfo>[] = [];
  const queries = new Set<number>();
  records.forEach((record) => {
    if (queries.has(record.mapId)) {
      return;
    }
    const { areaId, areaNo } = recordMapIdToIdNo(record.mapId);
    tasks.push(mapInfoCache.get(areaId, areaNo));
    queries.add(record.mapId);
  })
  return Promise.all(tasks);
}

const onTimeline = (): void => {
  console.log('on timeline clicked isshow:', show_timeline.value, in_timeline_query.value)
  if (show_timeline.value) {
    in_timeline_query.value = false
    show_timeline.value = false
    return
  }

  if (!in_timeline_query.value) {
    in_timeline_query.value = true
    window.api
      .timeline()
      .then((result: TimelineResult) => {
        fetchCellInfo(result[1])
        .then(() => {
          if (in_timeline_query.value) {
            in_timeline_query.value = false
            console.log('timeline result', result, timeline_data)
            Object.assign(timeline_data, result)
          }
        })
      })
      .catch((error: any) => {
        console.log('timeline ipc error', error)
        in_timeline_query.value = false
      })
    show_timeline.value = true
    nextTick(() => {
      const timeline = el.value!.querySelector('#timeline')! as HTMLElement
      timeline.focus()
    })
  }
}

const onRec = async (): Promise<void> => {
  console.log(
    'rec >>',
    'record_ready',
    gameState.record_ready,
    'recording_state',
    gameState.recording_state
  )
  try {
    const target = await recorderStuffRenderer.start()
    showCaptureNotice(
      'success',
      target === 'game'
        ? translateApp('capture.recording.startedGame')
        : translateApp('capture.recording.startedWindow')
    )
  } catch {
    showCaptureNotice('error', translateApp('capture.recording.startFailed'))
  }
}

const onRecStop = (): void => {
  console.log(
    'rec stop >>',
    'record_ready',
    gameState.record_ready,
    'recording_state',
    gameState.recording_state
  )
  if (recorderStuffRenderer.stop()) {
    showCaptureNotice('success', translateApp('capture.recording.stopping'))
  }
  console.log(
    'rec stop <<',
    'record_ready',
    gameState.record_ready,
    'recording_state',
    gameState.recording_state
  )
}

const showCaptureNotice = (kind: 'success' | 'error', message: string): void => {
  if (captureNoticeTimer !== null) {
    clearTimeout(captureNoticeTimer)
  }
  captureNotice.value = { kind, message }
  captureNoticeTimer = setTimeout(() => {
    captureNotice.value = null
    captureNoticeTimer = null
  }, 3500)
}

const onScreenShot = async (): Promise<void> => {
  console.log('screenshot')
  const webview = getGame()?.getWebview()
  if (!webview) {
    showCaptureNotice('error', translateApp('capture.screenshotUnavailable'))
    return
  }
  try {
    const filename = await captureStuff.capture(webview)
    showCaptureNotice('success', translateApp('capture.screenshotSaved', {
      params: { fileName: filename }
    }))
  } catch (error) {
    console.error('capture failed', error)
    showCaptureNotice('error', translateApp('capture.screenshotFailed'))
  }
}

const onGameDevTool = (): void => {
  const game_wv = getGame()?.getWebview()
  if (game_wv) {
    if (game_wv.isDevToolsOpened()) {
      game_wv.closeDevTools()
    } else {
      game_wv.openDevTools()
    }
  }
}

const onMute = (): void => {
  getGame()?.setMute(!gameState.muted, true)
}
</script>

<template>
  <div
    class="main-root"
    ref="el"
    :data-layout-surface="layoutSurface"
    :data-localization-locale="activeLocalizationLocale()"
  >
    <TitleBar
      v-if="rendererIsGame()"
      @timeline="onTimeline"
      :timeline_pressed="show_timeline"
      @rec="onRec"
      @recStop="onRecStop"
      @screenshot="onScreenShot"
      @gameDevtool="onGameDevTool"
      @mute="onMute"
    />
    <Transition name="capture-notice">
      <CaptureNotice
        v-if="captureNotice"
        :kind="captureNotice.kind"
        :message="captureNotice.message"
      />
    </Transition>
    <div
      class="main-content"
      :class="{ 'is-workspace': isWorkspace }"
      :style="mainStyle"
    >
      <template v-if="isWorkspace">
        <section
          class="workspace-primary"
          :class="{ 'is-app-ready': isAppReady }"
        >
          <div class="game-content">
            <Game ref="game" />
          </div>
          <div class="assist-bottom-content">
            <div><QuestList /></div>
            <div><NDockList /></div>
            <div><KDockList /></div>
          </div>
          <AssistWorkspace v-if="isAppReady" area="primary" />
        </section>
        <AssistWorkspace v-if="isAppReady" area="secondary" />
        <section v-else class="workspace-waiting">
          <Invalid />
        </section>
      </template>
      <template v-else-if="EnvRenderer.isAssist">
        <AssistWorkspace area="assist" />
      </template>
      <template v-else>
        <div class="game-content" v-if="rendererIsGame()">
          <Game ref="game" />
        </div>
        <div
          class="assist-right-content"
          :class="{ 'is-hidden': rendererIsGame() && !assistInGame() }"
        >
          <Assist />
        </div>
        <div
          v-if="rendererIsGame()"
          class="assist-bottom-content"
          :class="{ 'is-hidden': !assistInGame() }"
        >
          <div><QuestList /></div>
          <div><NDockList /></div>
          <div><KDockList /></div>
        </div>
      </template>
    </div>
    <Timeline
      id="timeline"
      v-if="show_timeline"
      v-model:show="show_timeline"
      :data="timeline_data"
    />
    <LayoutHpGaugeFixture
      v-if="EnvRenderer.isLayoutFixture && !EnvRenderer.isAssist"
    />
  </div>
</template>

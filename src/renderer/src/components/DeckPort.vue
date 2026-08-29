<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { svdata } from '@renderer/store/svdata'
import { RUtil, DeckInfo } from '@renderer/util'
import Deck from '@renderer/components/Deck.vue'
import ShipTooltip from '@renderer/components/ShipTooltip.vue'
import World from '@renderer/components/World.vue'
import MissionBadge from '@renderer/components/MissionBadge.vue'
import LockImage from '@renderer/assets/img/lock.svg'
import FixedCanvasViewport from './layout/FixedCanvasViewport.vue'
import {
  getDeckPortViewState,
  saveDeckPortViewState
} from '@renderer/store/panel_view_state'
import {
  BASE_DECK_PORT_LOGICAL_HEIGHT,
  deckPortLogicalHeight
} from '@renderer/common/deck-port-layout'
import { getOperationDeckName } from '@renderer/common/operation-view'
import { translateApp } from '@renderer/store/global_setting'
import * as kcs_stuff from '@renderer/stuff/kcs_stuff'
import { CombinedNames } from '@common/locale'
import { deckShipCount } from '@common/kcs'

type Props = { show_rate?: boolean }
withDefaults(defineProps<Props>(), { show_rate: true })

const index = ref(getDeckPortViewState().deckIndex)
const tooltip_ship_id = ref(0)
const tooltip_ship_show = ref(false)

const isDeckOk = computed(() => svdata.isShipDataOk)

// 輸送ゲージマップがある場合、輸送値を表示する
// 輸送値は常には表示しない
// 常に表示しないのは、表示が煩雑になることを避けるため
const { computed: isShowYusou } = kcs_stuff.isShowYusou()

const isCombined = computed<boolean>(() => svdata.isCombined)

const decks = computed<DeckInfo[]>(() => {
  const ret = RUtil.deckInfos(isShowYusou.value)
  //console.log('DeckPort: update decks decks called', ret)
  return ret;
});
const deckLogicalHeight = computed(() => {
  const selectedDeck = decks.value[index.value]
  return selectedDeck
    ? deckPortLogicalHeight(selectedDeck.deck.api_ship)
    : BASE_DECK_PORT_LOGICAL_HEIGHT
})
watch(index, (deckIndex) => {
  saveDeckPortViewState({ deckIndex })
})

const tooltipShipId = computed(() => tooltip_ship_id.value)
const isShowShipTooltip = computed(() => tooltip_ship_show.value)

/**
 * 遊撃部隊では艦隊タブの高さを増やす
 * EnemyListではすべて表示できないことから表示艦数を制限する
 */
const isRow3 = computed(() => {
  
  // 第3以外はfalse
  if (index.value !== 2) {
    return false
  }

  // 第3で7隻以上の場合、true
  const deckPort = decks.value[index.value].deck
  const shipCount = deckShipCount(deckPort.api_ship)
  if (shipCount < 7) {
    // デフォルト表示
    return false
  }
  return true
})

const deckTabsStyle = computed(() => ({
  height: `${deckLogicalHeight.value}px`,
  '--deck-tabs-height': isRow3.value ? '416px' : undefined,
  '--ship-img-row-count': isRow3.value ? 3 : 2
}))

const combinedName = computed<string>(() => {
  return CombinedNames[svdata.combinedFlag] || '';
})

// todo
// decksの値が更新されても<template #header>でのマスタッシュ構文部分の表示が更新されない
// 以下のように更新したい値をheaderClassで参照すると更新される
// :headerClass="`for-update-${deck.deck.api_id}_${deck.isLock}_${deck.seiku}_${deck.inMission}`"
// b-tab-item更新バグの可能性がある
// または直にメソッドで値取得でも対応できる

// function getSeiku(deckId: number): string {
//   const localDecks = decks.value
//   const deck = localDecks.find(d => d.deck.api_id === deckId)
//   console.log('getSeiku called with deckId:', deckId, deck)
//   return deck ? deck.seiku.toString() : ''
// }

</script>
<template>
  <div v-if="isDeckOk" class="deck-port-root">
    <b-tooltip
      :square="true"
      :animated="false"
      :always="true"
      :active="isShowShipTooltip"
      position="is-bottom"
      type="is-dark"
      class="ship-tool-tip"
    >
      <template #content>
        <ShipTooltip v-if="isShowShipTooltip" :ship_id="tooltipShipId" />
      </template>
      <div class="deck-port-stack">
        <FixedCanvasViewport :logical-width="600" :logical-height="deckLogicalHeight">
          <b-tabs
            size="is-small"
            expanded
            class="deck-tabs"
            v-model="index"
            :style="deckTabsStyle"
            :class="{'is-row3': isRow3}"
          >
            <b-tab-item v-for="(deck, deck_index) in decks" :key="deck.deck.api_id"
              :disabled="deck.isLock"
              :headerClass="`for-update-${deck.deck.api_id}_${deck.isLock}_${deck.seiku}_${deck.inMission}_${deck.yusou}_${deck.isEscapedAa}_${deck.isEscapedYusou}`">
              <template #header>
                <LockImage v-if="deck.isLock" class="is-lock"/>
                <span v-if="deck_index === 0 && isCombined" class="combined-badge">{{ combinedName }}</span>
                {{ getOperationDeckName(deck_index, translateApp) }}
                <MissionBadge v-if="deck.inMission" :deck="deck.deck" />
                <template v-else>
                  <div
                    v-if="deck.seiku > 0"
                    :title="translateApp('operation.deckPort.airControl')"
                    class="seiku-wrapper ml-1"
                  >
                    <div class="seiku">
                      <span class="s-icon seiku"></span>
                      <div class="txt" :class="{'is-minus': deck.isEscapedAa}">{{deck.seiku}}</div>
                    </div>
                  </div>
                  <div
                    v-if="isShowYusou && (deck.yusou > 0)"
                    :title="translateApp('operation.deckPort.transportValue')"
                    class="seiku-wrapper ml-1"
                  >
                    <div class="seiku">
                      <span class="yusou-value">{{
                        translateApp('operation.deckPort.transport')
                      }}</span>
                      <div class="txt" :class="{'is-minus': deck.isEscapedYusou}">{{ deck.yusou }}/{{ Math.floor(deck.yusou * 0.7) }}</div>
                    </div>
                  </div>
                </template>
              </template>
              <div class="deckport">
                <Deck
                  v-if="index === deck_index"
                  :show_rate="show_rate"
                  :deck="deck.deck"
                  v-model:tooltip_ship_id="tooltip_ship_id"
                  v-model:tooltip_ship_show="tooltip_ship_show"
                />
              </div>
            </b-tab-item>
          </b-tabs>
        </FixedCanvasViewport>
        <FixedCanvasViewport :logical-width="600" :logical-height="660">
          <section class="deck-world">
            <World :deck_index="index" />
          </section>
        </FixedCanvasViewport>
      </div>
    </b-tooltip>
  </div>
</template>

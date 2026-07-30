import type { Component } from 'vue'
import type { AssistPanelName } from '@renderer/common/assist-panel'
import AboutPanel from './AboutPanel.vue'
import DockQuestPanel from './DockQuestPanel.vue'
import ResourceChartPanel from './ResourceChartPanel.vue'
import BattleTab from '@renderer/components/BattleTab.vue'
import DeckPort from '@renderer/components/DeckPort.vue'
import DropByMap from '@renderer/components/DropByMap.vue'
import DropByShip from '@renderer/components/DropByShip.vue'
import MissionCheck from '@renderer/components/MissionCheck.vue'
import QuestGuide from '@renderer/components/QuestGuide.vue'
import ShipItems from '@renderer/components/ShipItems.vue'

export const assistPanelComponents: Readonly<Record<AssistPanelName, Component>> = {
  deckport: DeckPort,
  missioncheck: MissionCheck,
  battletab: BattleTab,
  shipitems: ShipItems,
  dropbymap: DropByMap,
  dropbyship: DropByShip,
  dockquestlist: DockQuestPanel,
  questguide: QuestGuide,
  chart: ResourceChartPanel,
  about: AboutPanel
}

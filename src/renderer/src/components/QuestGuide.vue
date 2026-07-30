<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiQuestState, KcsUtil } from '@common/kcs'
import {
  getQuestStuff,
  questConditionChecks,
  questFleetChecks,
  questIsDeckMatch,
  questProgressDetailItems,
  type DestroyItemCondition
} from '@common/kcquest'
import { isQuestCounter, questProgress, type QuestCounter } from '@common/record'
import {
  buildQuestGuideRecommendations,
  buildQuestGuideEquipmentStock,
  normalizeQuestGuideWikiSource,
  questGuideConsumableRequirements,
  questGuideEquipmentRequirements,
  questGuideIsRecurring,
  questGuideProgressDetailText,
  questGuideProgressDetailsText,
  questGuideSlotPressure,
  questGuideMapKey,
  questGuideWikiSearchUrl,
  questGuideWikiUrl,
  type QuestKnowledgeConfidence,
  type QuestGuideConsumableStockEntry,
  type QuestGuideRecommendation,
  type QuestGuideWikiSource
} from '@common/quest_guide'
import { questGuideReviewedLimitedEvidenceById } from '@common/quest_limited_evidence'
import {
  buildQuestGoalPlan,
  listCuratedQuestKnowledge,
  type QuestCuratedConflict,
  type QuestCuratedConflictDetail,
  type QuestGoalStepStatus,
  type QuestPrerequisiteMode
} from '@common/quest_knowledge'
import { questList as cachedQuestList } from '@renderer/store/questList'
import { questGuideHistory, refreshQuestGuideHistory } from '@renderer/store/quest_guide_history'
import { quests as trackedQuests } from '@renderer/store/quests'
import { svdata } from '@renderer/store/svdata'
import {
  filterQuestGuideRecommendations,
  normalizeQuestGuideViewFilter,
  type QuestGuideViewFilter
} from '@renderer/common/quest-guide-view'
import {
  buildQuestGoalStepView,
  filterQuestGoalOptions,
  normalizeQuestGoalViewMode,
  type QuestGoalViewMode
} from '@renderer/common/quest-goal-view'
import { getQuestCategoryText } from '@renderer/common/quest-view'
import { translateApp } from '@renderer/store/global_setting'

const WikiSourceStorageKey = 'questGuideWikiSource:v1'
const GoalQuestStorageKey = 'questGuideGoalQuest:v1'
const ViewFilterStorageKey = 'questGuideViewFilter:v1'
const GoalViewModeStorageKey = 'questGuideGoalViewMode:v1'
const RecommendationsPerPage = 6
const GoalStepsCollapsedLimit = 6
const currentPage = ref(1)
const expandedQuestId = ref<number | null>(null)
const showGoalEquipment = ref(false)
const showAllGoalSteps = ref(false)
const now = ref(new Date())
const selectedGoalId = ref(localStorage.getItem(GoalQuestStorageKey) ?? '')
const goalSearchQuery = ref('')
const goalViewMode = ref<QuestGoalViewMode>(
  normalizeQuestGoalViewMode(localStorage.getItem(GoalViewModeStorageKey))
)
const viewFilter = ref<QuestGuideViewFilter>(
  normalizeQuestGuideViewFilter(localStorage.getItem(ViewFilterStorageKey))
)
const searchQuery = ref('')
const wikiSource = ref<QuestGuideWikiSource>(
  normalizeQuestGuideWikiSource(localStorage.getItem(WikiSourceStorageKey))
)

watch(wikiSource, (source) => {
  localStorage.setItem(WikiSourceStorageKey, source)
})
watch(selectedGoalId, (questId) => {
  showGoalEquipment.value = false
  showAllGoalSteps.value = false
  if (questId) {
    localStorage.setItem(GoalQuestStorageKey, questId)
  } else {
    localStorage.removeItem(GoalQuestStorageKey)
  }
})
watch(viewFilter, (filter) => {
  localStorage.setItem(ViewFilterStorageKey, filter)
})
watch(goalViewMode, (mode) => {
  showAllGoalSteps.value = false
  localStorage.setItem(GoalViewModeStorageKey, mode)
})

let cadenceTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  cadenceTimer = setInterval(() => {
    now.value = new Date()
  }, 60_000)
})
onBeforeUnmount(() => {
  if (cadenceTimer) {
    clearInterval(cadenceTimer)
  }
})

const liveQuestList = computed(() => svdata.questlist)
const sourceQuestList = computed(() => liveQuestList.value ?? cachedQuestList)
const sourceText = computed(() =>
  translateApp(
    liveQuestList.value
      ? 'quest.guide.source.live'
      : 'quest.guide.source.cache'
  )
)

const sourceFingerprint = computed(() =>
  sourceQuestList.value.api_list
    .map((quest) => `${quest.api_no}:${quest.api_state}:${quest.api_progress_flag}`)
    .join('|')
)

watch(sourceFingerprint, () => refreshQuestGuideHistory(sourceQuestList.value.api_list), {
  immediate: true
})

const progressById = computed(() => {
  const result = new Map<number, number>()
  trackedQuests.list.forEach((quest) => result.set(quest.no, questProgress(quest)))
  return result
})

function resolveEquipmentCondition(questId: number): DestroyItemCondition | undefined {
  const stuff = getQuestStuff(questId)
  if (!stuff || !('getCondition' in stuff) || typeof stuff.getCondition !== 'function') {
    return undefined
  }
  try {
    return stuff.getCondition(svdata)
  } catch {
    // Game data may still be loading. Missing conditions remain unknown instead of guessed.
    return undefined
  }
}

const progressDetailsById = computed(() => {
  const result = new Map<number, NonNullable<ReturnType<typeof questProgressDetailItems>>>()
  trackedQuests.list.forEach((quest) => {
    const details = questProgressDetailItems(quest, {
      slotitemName: (itemId) => svdata.mstSlotitem(itemId)?.api_name,
      equipmentCondition: resolveEquipmentCondition,
      translate: translateApp
    })
    if (details) {
      result.set(quest.no, details)
    }
  })
  return result
})
const progressDetailById = computed(() => {
  const result = new Map<number, string>()
  trackedQuests.list.forEach((quest) => {
    if (!isQuestCounter(quest.state)) {
      return
    }
    if (progressDetailsById.value.has(quest.no)) {
      return
    }
    const state = quest.state as QuestCounter
    const detail = questGuideProgressDetailText(
      state.count,
      state.countMax,
      translateApp
    )
    if (detail) {
      result.set(quest.no, detail)
    }
  })
  return result
})

const deckMatchById = computed(() => {
  const result = new Map<number, boolean | undefined>()
  for (const quest of sourceQuestList.value.api_list) {
    try {
      result.set(quest.api_no, questIsDeckMatch(svdata, quest.api_no))
    } catch {
      result.set(quest.api_no, undefined)
    }
  }
  return result
})
const fleetChecksById = computed(() => {
  const result = new Map<number, NonNullable<ReturnType<typeof questFleetChecks>>>()
  for (const quest of sourceQuestList.value.api_list) {
    const checks = questFleetChecks(
      svdata,
      quest.api_no,
      translateApp
    )
    if (checks) {
      result.set(quest.api_no, checks)
    }
  }
  return result
})

const availableMapKeys = computed(() => {
  const result = new Set<string>()
  for (const mst of svdata.mstMapInfos) {
    if (svdata.mapinfo(mst.api_id)) {
      result.add(questGuideMapKey(mst.api_maparea_id, mst.api_no))
    }
  }
  return result
})

const equipmentStock = computed(() => {
  const equippedInstanceIds = new Set<number>()
  for (const ship of svdata.ships) {
    for (const instanceId of ship.api_slot) {
      if (instanceId > 0) {
        equippedInstanceIds.add(instanceId)
      }
    }
    if (ship.api_slot_ex > 0) {
      equippedInstanceIds.add(ship.api_slot_ex)
    }
  }
  for (const airbase of svdata.airbases) {
    for (const plane of airbase.api_plane_info) {
      if (plane.api_slotid > 0) {
        equippedInstanceIds.add(plane.api_slotid)
      }
    }
  }

  return buildQuestGuideEquipmentStock(
    svdata.mstSlotitems.map((item) => ({
      itemId: item.api_id,
      name: item.api_name,
      type: KcsUtil.slotitemType(item)
    })),
    svdata.slotitems.map((item) => ({
      instanceId: item.api_id,
      itemId: item.api_slotitem_id,
      locked: (item.api_locked ?? 0) !== 0,
      level: item.api_level,
      proficiency: item.api_alv
    })),
    equippedInstanceIds
  )
})
const consumableStock = computed<QuestGuideConsumableStockEntry[] | undefined>(() => {
  if (svdata.useitems.length === 0) {
    return undefined
  }
  return svdata.useitems.map((item) => ({
    itemId: item.api_id,
    name:
      svdata.mstUseItem(item.api_id)?.api_name ??
      translateApp('quest.guide.item.unknown', {
        params: { id: item.api_id }
      }),
    owned: item.api_count
  }))
})

const goalOptions = listCuratedQuestKnowledge()
const goalSearchMatches = computed(() => filterQuestGoalOptions(goalOptions, goalSearchQuery.value))
const goalOptionsForSelect = computed(() => {
  const matchedQuestIds = new Set(goalSearchMatches.value.map((option) => option.questId))
  const selectedQuestId = Number(selectedGoalId.value)
  return goalOptions.filter(
    (option) =>
      matchedQuestIds.has(option.questId) ||
      (Number.isFinite(selectedQuestId) && option.questId === selectedQuestId)
  )
})
const equipmentConditionById = computed(() => {
  const result = new Map<number, DestroyItemCondition>()
  const questIds = new Set([
    ...sourceQuestList.value.api_list.map((quest) => quest.api_no),
    ...goalOptions.map((quest) => quest.questId)
  ])
  for (const questId of questIds) {
    const condition = resolveEquipmentCondition(questId)
    if (condition) {
      result.set(questId, condition)
    }
  }
  return result
})
const conditionChecksById = computed(() => {
  const result = new Map<number, ReturnType<typeof questConditionChecks>>()
  for (const [questId, condition] of equipmentConditionById.value) {
    result.set(
      questId,
      questConditionChecks(svdata, condition, translateApp)
    )
  }
  return result
})

const recommendations = computed(() =>
  buildQuestGuideRecommendations(sourceQuestList.value.api_list, {
    progressById: progressById.value,
    progressDetailsById: progressDetailsById.value,
    progressDetailById: progressDetailById.value,
    deckMatchById: deckMatchById.value,
    fleetChecksById: fleetChecksById.value,
    conditionChecksById: conditionChecksById.value,
    availableMapKeys: availableMapKeys.value,
    learnedUnlocks: questGuideHistory.learnedUnlocks,
    questDataSource: liveQuestList.value ? 'live' : 'cache',
    now: now.value,
    equipmentStock: equipmentStock.value,
    consumableStock: consumableStock.value,
    equipmentConditionById: equipmentConditionById.value,
    limitedEvidenceById: questGuideReviewedLimitedEvidenceById,
    translate: translateApp
  })
)
const filteredRecommendations = computed(() =>
  filterQuestGuideRecommendations(recommendations.value, viewFilter.value, searchQuery.value)
)
const goalStatusById = computed(() => {
  const result = new Map<number, QuestGoalStepStatus>()
  for (const quest of sourceQuestList.value.api_list) {
    result.set(
      quest.api_no,
      quest.api_state === ApiQuestState.completed
        ? 'claim'
        : quest.api_state === ApiQuestState.in_progress
          ? 'active'
          : 'available'
    )
  }
  return result
})
const goalPlan = computed(() => {
  const questId = Number(selectedGoalId.value)
  return Number.isFinite(questId) && questId > 0
    ? buildQuestGoalPlan(questId, goalStatusById.value)
    : undefined
})
const goalStepView = computed(() =>
  buildQuestGoalStepView(
    goalPlan.value?.steps ?? [],
    goalViewMode.value,
    showAllGoalSteps.value,
    GoalStepsCollapsedLimit
  )
)
const goalEquipmentRequirements = computed(() =>
  (goalPlan.value?.steps ?? []).flatMap((step) =>
    questGuideEquipmentRequirements(
      step.questId,
      equipmentStock.value,
      equipmentConditionById.value.get(step.questId),
      translateApp
    ).map((requirement) => ({
      ...requirement,
      questId: step.questId,
      questTitle: step.title
    }))
  )
)
const goalEquipmentMissing = computed(() =>
  goalEquipmentRequirements.value.reduce((total, requirement) => total + requirement.missing, 0)
)
const goalConsumableRequirements = computed(() =>
  (goalPlan.value?.steps ?? []).flatMap((step) =>
    questGuideConsumableRequirements(
      step.questId,
      consumableStock.value ?? [],
      translateApp
    ).map(
      (requirement) => ({
        ...requirement,
        questId: step.questId,
        questTitle: step.title
      })
    )
  )
)
const goalConsumableMissing = computed(() =>
  goalConsumableRequirements.value.reduce((total, requirement) => total + requirement.missing, 0)
)
const goalPreparationCount = computed(
  () => goalEquipmentRequirements.value.length + goalConsumableRequirements.value.length
)
const goalPreparationMissing = computed(
  () => goalEquipmentMissing.value + goalConsumableMissing.value
)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredRecommendations.value.length / RecommendationsPerPage))
)
const pageStart = computed(() => (currentPage.value - 1) * RecommendationsPerPage)
const visibleRecommendations = computed(() =>
  filteredRecommendations.value.slice(pageStart.value, pageStart.value + RecommendationsPerPage)
)

watch(
  () => filteredRecommendations.value.length,
  () => {
    currentPage.value = Math.min(currentPage.value, totalPages.value)
  }
)
watch([viewFilter, searchQuery], () => {
  currentPage.value = 1
  expandedQuestId.value = null
})

const claimCount = computed(
  () =>
    sourceQuestList.value.api_list.filter((quest) => quest.api_state === ApiQuestState.completed)
      .length
)
const activeCount = computed(
  () =>
    sourceQuestList.value.api_list.filter((quest) => quest.api_state === ApiQuestState.in_progress)
      .length
)
const confirmedLimitedCount = computed(
  () => recommendations.value.filter((quest) => quest.limitedEvidence.length > 0).length
)
const limitedCandidateCount = computed(
  () =>
    recommendations.value.filter((quest) => quest.isLimited && quest.limitedEvidence.length === 0)
      .length
)
const recurringRecommendations = computed(() =>
  recommendations.value.filter((recommendation) => questGuideIsRecurring(recommendation.quest))
)
const unregisteredRecurringRelationCount = computed(
  () =>
    recurringRecommendations.value.filter(
      (recommendation) => recommendation.knowledge.relationCoverageStatus === 'unregistered'
    ).length
)
const unresolvedRecurringRelationCount = computed(
  () =>
    recurringRecommendations.value.filter(
      (recommendation) => recommendation.knowledge.relationCoverageStatus === 'unresolved'
    ).length
)
const slotPressure = computed(() =>
  questGuideSlotPressure(
    activeCount.value,
    svdata.parallelQuestCount,
    translateApp
  )
)
const wikiHomeUrl = computed(() => questGuideWikiUrl(wikiSource.value))
const wikiCardLabel = computed(() =>
  translateApp(
    wikiSource.value === 'kcwiki'
      ? 'quest.guide.wiki.short.chinese'
      : 'quest.guide.wiki.short.japanese'
  )
)

function categoryText(recommendation: QuestGuideRecommendation): string {
  return getQuestCategoryText(
    recommendation.quest.api_category,
    translateApp
  )
}

function questDetail(recommendation: QuestGuideRecommendation): string {
  return recommendation.quest.api_detail.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
}

function openExternalUrl(url: string): void {
  void window.api.openExternalUrl(url)
}

function recommendationWikiUrl(recommendation: QuestGuideRecommendation): string {
  return questGuideWikiSearchUrl(recommendation.quest.api_title, wikiSource.value)
}

function toggleKnowledge(questId: number): void {
  expandedQuestId.value = expandedQuestId.value === questId ? null : questId
}

function clearViewFilter(): void {
  viewFilter.value = 'all'
  searchQuery.value = ''
}

function confidenceText(confidence: QuestKnowledgeConfidence): string {
  switch (confidence) {
    case 'verified':
      return translateApp('quest.guide.confidence.verified')
    case 'supported':
      return translateApp('quest.guide.confidence.supported')
    case 'observed':
      return translateApp('quest.guide.confidence.observed')
  }
}

function prerequisiteModeText(mode: QuestPrerequisiteMode): string {
  return translateApp(
    mode === 'all'
      ? 'quest.guide.prerequisite.all'
      : 'quest.guide.prerequisite.any'
  )
}

function conflictReviewNote(detail: QuestCuratedConflictDetail): string {
  if (detail.reviewNote) {
    return detail.reviewNote
  }
  return detail.reviewStatus === 'under-review'
    ? translateApp('quest.guide.conflict.underReview')
    : translateApp('quest.guide.conflict.incomplete')
}

function conflictTitle(conflict: QuestCuratedConflict): string {
  return translateApp(
    conflict.kind === 'source-disagreement'
      ? 'quest.guide.conflict.disagreement'
      : 'quest.guide.conflict.pending'
  )
}

function conflictSummary(conflict: QuestCuratedConflict): string {
  return translateApp(
    conflict.kind === 'source-disagreement'
      ? 'quest.guide.conflict.disagreementSummary'
      : 'quest.guide.conflict.pendingSummary'
  )
}

function curatedSourceLabel(
  source: string,
  fallback: string
): string {
  if (source === 'wikiwiki') {
    return translateApp('quest.guide.source.japaneseWiki')
  }
  if (source === 'kcwiki') {
    return translateApp('quest.guide.source.chineseWiki')
  }
  return fallback
}

function goalStatusText(status: QuestGoalStepStatus): string {
  switch (status) {
    case 'claim':
      return translateApp('quest.guide.goal.status.claim')
    case 'active':
      return translateApp('quest.guide.goal.status.active')
    case 'available':
      return translateApp('quest.guide.goal.status.available')
    case 'not-shown':
      return translateApp('quest.guide.goal.status.notShown')
  }
}

function equipmentKindText(
  kind: QuestGuideRecommendation['equipmentRequirements'][number]['kind']
) {
  switch (kind) {
    case 'hold':
      return translateApp('quest.guide.equipmentKind.hold')
    case 'discard':
      return translateApp('quest.guide.equipmentKind.discard')
    case 'equip':
      return translateApp('quest.guide.equipmentKind.equip')
  }
}
</script>

<template>
  <section class="quest-guide">
    <header class="quest-guide-header">
      <div>
        <strong>{{ translateApp('quest.guide.title') }}</strong>
        <span class="quest-guide-source">{{ sourceText }}</span>
      </div>
      <div class="quest-guide-wiki-controls">
        <select
          v-model="wikiSource"
          class="quest-guide-wiki-source-select"
          :aria-label="translateApp('quest.guide.wiki.destination')"
          :title="translateApp('quest.guide.wiki.destination')"
        >
          <option value="wikiwiki">{{ translateApp('quest.guide.wiki.japanese') }}</option>
          <option value="kcwiki">{{ translateApp('quest.guide.wiki.chinese') }}</option>
        </select>
        <button type="button" class="quest-guide-wiki" @click="openExternalUrl(wikiHomeUrl)">
          {{ translateApp('quest.guide.wiki.open') }}
        </button>
      </div>
    </header>

    <div class="quest-guide-notice">
      {{ translateApp('quest.guide.description') }}
    </div>

    <div class="quest-guide-summary">
      <span>{{
        translateApp('quest.guide.summary.candidates', {
          params: { count: recommendations.length }
        })
      }}</span>
      <span class="is-claim">{{
        translateApp('quest.guide.summary.claim', {
          params: { count: claimCount }
        })
      }}</span>
      <span>{{
        translateApp('quest.guide.summary.active', {
          params: { count: activeCount }
        })
      }}</span>
      <span
        class="quest-guide-slot-pressure"
        :class="`is-${slotPressure.level}`"
        :title="slotPressure.text"
      >
        {{ slotPressure.text }}
      </span>
      <span v-if="confirmedLimitedCount > 0" class="is-limited">
        {{
          translateApp('quest.guide.summary.limited', {
            params: { count: confirmedLimitedCount }
          })
        }}
      </span>
      <span v-if="limitedCandidateCount > 0" class="is-limited-candidate">
        {{
          translateApp('quest.guide.summary.limitedCandidate', {
            params: { count: limitedCandidateCount }
          })
        }}
      </span>
      <span
        v-if="unregisteredRecurringRelationCount > 0"
        class="is-relation-unregistered"
        :title="translateApp('quest.guide.summary.recurringUnregisteredHelp')"
      >
        {{
          translateApp('quest.guide.summary.recurringUnregistered', {
            params: { count: unregisteredRecurringRelationCount }
          })
        }}
      </span>
      <span
        v-if="unresolvedRecurringRelationCount > 0"
        class="is-relation-unresolved"
        :title="translateApp('quest.guide.summary.recurringUnresolvedHelp')"
      >
        {{
          translateApp('quest.guide.summary.recurringUnresolved', {
            params: { count: unresolvedRecurringRelationCount }
          })
        }}
      </span>
      <span>{{
        translateApp('quest.guide.summary.ships', {
          params: { count: svdata.ships.length }
        })
      }}</span>
      <span>{{
        translateApp('quest.guide.summary.equipment', {
          params: { count: svdata.slotitems.length }
        })
      }}</span>
    </div>

    <div v-if="recommendations.length > 0" class="quest-guide-view-controls">
      <label>
        <span>{{ translateApp('quest.guide.filter.label') }}</span>
        <select
          v-model="viewFilter"
          data-quest-guide-filter
          :aria-label="translateApp('quest.guide.filter.aria')"
        >
          <option value="all">{{ translateApp('quest.guide.filter.all') }}</option>
          <option value="current">{{ translateApp('quest.guide.filter.current') }}</option>
          <option value="ready">{{ translateApp('quest.guide.filter.ready') }}</option>
          <option value="attention">{{ translateApp('quest.guide.filter.attention') }}</option>
          <option value="limited">{{ translateApp('quest.guide.filter.limited') }}</option>
          <option value="recurring-unregistered">
            {{ translateApp('quest.guide.filter.recurringUnregistered') }}
          </option>
          <option value="recurring-unresolved">
            {{ translateApp('quest.guide.filter.recurringUnresolved') }}
          </option>
          <option value="recurring-review">
            {{ translateApp('quest.guide.filter.recurringReview') }}
          </option>
          <option value="relation-review">
            {{ translateApp('quest.guide.filter.relationReview') }}
          </option>
        </select>
      </label>
      <label class="quest-guide-search">
        <span>{{ translateApp('quest.guide.search.label') }}</span>
        <input
          v-model="searchQuery"
          type="search"
          :aria-label="translateApp('quest.guide.search.aria')"
          :placeholder="translateApp('quest.guide.search.placeholder')"
        />
      </label>
      <span class="quest-guide-view-count">
        {{
          translateApp('quest.guide.search.result', {
            params: {
              shown: filteredRecommendations.length,
              total: recommendations.length
            }
          })
        }}
      </span>
      <button v-if="viewFilter !== 'all' || searchQuery" type="button" @click="clearViewFilter">
        {{ translateApp('quest.guide.clear') }}
      </button>
    </div>

    <section class="quest-goal-planner">
      <header>
        <div>
          <strong>{{ translateApp('quest.guide.goal.title') }}</strong>
          <span>{{ translateApp('quest.guide.goal.description') }}</span>
        </div>
        <div class="quest-goal-selector">
          <div class="quest-goal-search">
            <input
              v-model="goalSearchQuery"
              type="search"
              :aria-label="translateApp('quest.guide.goal.searchAria')"
              :placeholder="translateApp('quest.guide.goal.searchPlaceholder')"
            />
            <button
              v-if="goalSearchQuery"
              type="button"
              :aria-label="translateApp('quest.guide.goal.clearAria')"
              @click="goalSearchQuery = ''"
            >
              {{ translateApp('quest.guide.clear') }}
            </button>
          </div>
          <select v-model="selectedGoalId" :aria-label="translateApp('quest.guide.goal.selectAria')">
            <option value="">{{ translateApp('quest.guide.goal.select') }}</option>
            <option
              v-for="option in goalOptionsForSelect"
              :key="option.questId"
              :value="String(option.questId)"
            >
              #{{ option.questId }} {{ option.questTitle }}
            </option>
          </select>
          <small>
            {{
              translateApp('quest.guide.goal.candidates', {
                params: {
                  shown: goalSearchMatches.length,
                  total: goalOptions.length
                }
              })
            }}
            <template
              v-if="
                goalSearchQuery &&
                selectedGoalId &&
                !goalSearchMatches.some((option) => String(option.questId) === selectedGoalId)
              "
            >
              {{ translateApp('quest.guide.goal.keepSelected') }}
            </template>
          </small>
        </div>
      </header>
      <div v-if="goalPlan" class="quest-goal-plan">
        <div class="quest-goal-plan-summary">
          <strong>#{{ goalPlan.target.questId }} {{ goalPlan.target.title }}</strong>
          <span>{{
            translateApp('quest.guide.goal.steps', {
              params: {
                shown: goalStepView.steps.length,
                total: goalPlan.steps.length
              }
            })
          }}</span>
          <span v-if="goalPlan.notShownCount > 0" class="warning">
            {{
              translateApp('quest.guide.goal.notShown', {
                params: { count: goalPlan.notShownCount }
              })
            }}
          </span>
          <span v-if="goalStepView.excludedNotShownCount > 0" class="quest-goal-filtered-count">
            {{
              translateApp('quest.guide.goal.outsideCurrent', {
                params: { count: goalStepView.excludedNotShownCount }
              })
            }}
          </span>
          <div
            class="quest-goal-view-mode"
            role="group"
            :aria-label="translateApp('quest.guide.goal.viewAria')"
          >
            <button
              type="button"
              :class="{ 'is-selected': goalViewMode === 'current' }"
              :aria-pressed="goalViewMode === 'current'"
              @click="goalViewMode = 'current'"
            >
              {{ translateApp('quest.guide.goal.viewCurrent') }}
            </button>
            <button
              type="button"
              :class="{ 'is-selected': goalViewMode === 'all' }"
              :aria-pressed="goalViewMode === 'all'"
              @click="goalViewMode = 'all'"
            >
              {{ translateApp('quest.guide.goal.viewAll') }}
            </button>
          </div>
          <button
            v-if="goalPreparationCount > 0"
            type="button"
            class="quest-goal-equipment-toggle"
            :class="{ 'is-missing': goalPreparationMissing > 0 }"
            :aria-expanded="showGoalEquipment"
            @click="showGoalEquipment = !showGoalEquipment"
          >
            {{
              translateApp('quest.guide.goal.preparation', {
                params: { count: goalPreparationCount }
              })
            }}
            <template v-if="goalPreparationMissing > 0">{{
              translateApp('quest.guide.goal.missing', {
                params: { count: goalPreparationMissing }
              })
            }}</template>
          </button>
        </div>
        <div class="quest-goal-steps">
          <div
            v-for="step in goalStepView.steps"
            :key="step.questId"
            class="quest-goal-step"
            :class="[`is-${step.status}`, { 'is-target': step.isTarget }]"
          >
            <small v-if="step.prerequisiteMode">
              {{ prerequisiteModeText(step.prerequisiteMode) }}
            </small>
            <strong>#{{ step.questId }} {{ step.title }}</strong>
            <span>{{ goalStatusText(step.status) }}</span>
          </div>
        </div>
        <button
          v-if="goalStepView.candidateCount > GoalStepsCollapsedLimit"
          type="button"
          class="quest-goal-route-toggle"
          :aria-expanded="showAllGoalSteps"
          @click="showAllGoalSteps = !showAllGoalSteps"
        >
          {{
            showAllGoalSteps
              ? translateApp('quest.guide.goal.collapse')
              : translateApp('quest.guide.goal.expand', {
                  params: { count: goalStepView.collapsedCount }
                })
          }}
        </button>
        <section v-if="showGoalEquipment && goalPreparationCount > 0" class="quest-goal-equipment">
          <header>
            <strong>{{ translateApp('quest.guide.goal.preparationTitle') }}</strong>
            <span>{{ translateApp('quest.guide.goal.preparationDescription') }}</span>
          </header>
          <div class="quest-equipment-requirement-list">
            <div
              v-for="(requirement, index) in goalEquipmentRequirements"
              :key="`${requirement.questId}:${requirement.kind}:${requirement.label}:${index}`"
              class="quest-equipment-requirement"
              :class="{ 'is-missing': requirement.missing > 0 }"
            >
              <span class="kind">{{ equipmentKindText(requirement.kind) }}</span>
              <strong>#{{ requirement.questId }} {{ requirement.label }}</strong>
              <span>{{ requirement.available }} / {{ requirement.required }}</span>
              <small v-if="requirement.missing > 0">{{
                translateApp('quest.guide.preparation.missing', {
                  params: { count: requirement.missing }
                })
              }}</small>
              <small v-else>{{ translateApp('quest.guide.preparation.ready') }}</small>
            </div>
            <div
              v-for="(requirement, index) in goalConsumableRequirements"
              :key="`${requirement.questId}:item:${requirement.itemId}:${index}`"
              class="quest-equipment-requirement"
              :class="{ 'is-missing': requirement.missing > 0 }"
            >
              <span class="kind">{{ translateApp('quest.guide.preparation.owned') }}</span>
              <strong>#{{ requirement.questId }} {{ requirement.label }}</strong>
              <span>{{ requirement.available }} / {{ requirement.required }}</span>
              <small v-if="requirement.missing > 0">{{
                translateApp('quest.guide.preparation.missing', {
                  params: { count: requirement.missing }
                })
              }}</small>
              <small v-else>{{ translateApp('quest.guide.preparation.ready') }}</small>
            </div>
          </div>
        </section>
        <p v-if="goalPlan.notShownCount > 0">
          {{ translateApp('quest.guide.goal.unknownDescription') }}
        </p>
        <p v-if="goalPlan.conflictCount > 0" class="warning">
          {{ translateApp('quest.guide.goal.conflict') }}
        </p>
        <p v-if="goalPlan.hasCycle" class="warning">
          {{ translateApp('quest.guide.goal.cycle') }}
        </p>
      </div>
    </section>

    <div v-if="recommendations.length === 0" class="quest-guide-empty">
      {{ translateApp('quest.guide.empty.cache') }}
    </div>

    <div v-else-if="filteredRecommendations.length === 0" class="quest-guide-empty">
      {{ translateApp('quest.guide.empty.filter') }}
    </div>

    <div v-else class="quest-guide-list">
      <article
        v-for="(recommendation, index) in visibleRecommendations"
        :key="recommendation.quest.api_no"
        class="quest-guide-card"
        :class="{
          'is-claim': recommendation.status === 'claim',
          'is-limited': recommendation.isLimited,
          'is-blocked': recommendation.readiness === 'blocked'
        }"
      >
        <div class="quest-guide-card-main">
          <span class="quest-guide-rank">{{ pageStart + index + 1 }}</span>
          <div class="quest-guide-card-body">
            <div class="quest-guide-card-tags">
              <span class="status" :class="`is-${recommendation.status}`">
                {{ recommendation.statusText }}
              </span>
              <span
                class="readiness"
                :class="`is-${recommendation.readiness}`"
                :title="recommendation.readinessDetail"
              >
                {{ recommendation.readinessText }}
              </span>
              <span>{{ recommendation.cadenceText }}</span>
              <span
                v-if="recommendation.cadenceDeadline"
                class="cadence-deadline"
                :class="`is-${recommendation.cadenceDeadline.urgency}`"
                :title="
                  translateApp('quest.guide.deadline.resetTitle', {
                    params: { date: recommendation.cadenceDeadline.resetsAt }
                  })
                "
              >
                {{ recommendation.cadenceDeadline.text }}
              </span>
              <span
                v-if="recommendation.limitedDeadline"
                class="cadence-deadline limited-deadline"
                :class="`is-${recommendation.limitedDeadline.urgency}`"
                :title="
                  translateApp('quest.guide.deadline.endTitle', {
                    params: {
                      date: recommendation.limitedDeadline.endsAt,
                      source: recommendation.limitedDeadline.evidence.sourceLabel
                    }
                  })
                "
              >
                {{ recommendation.limitedDeadline.text }}
              </span>
              <span>{{ categoryText(recommendation) }}</span>
              <span
                v-if="recommendation.limitedEvidence.length > 0"
                class="limited"
                :title="recommendation.limitedEvidence[0].summary"
              >
                {{ translateApp('quest.guide.badge.limited') }}
              </span>
              <span
                v-else-if="recommendation.isLimited"
                class="limited candidate"
                :title="translateApp('quest.guide.badge.limitedCandidateHelp')"
              >
                {{ translateApp('quest.guide.badge.limitedCandidate') }}
              </span>
              <span
                v-if="recommendation.knowledge.relationCoverageStatus === 'unregistered'"
                class="relation-review is-unregistered"
                :title="translateApp('quest.guide.badge.relationUnregisteredHelp')"
              >
                {{ translateApp('quest.guide.badge.relationUnregistered') }}
              </span>
              <span
                v-else-if="recommendation.knowledge.relationCoverageStatus === 'unresolved'"
                class="relation-review is-unresolved"
                :title="translateApp('quest.guide.badge.relationUnresolvedHelp')"
              >
                {{ translateApp('quest.guide.badge.relationUnresolved') }}
              </span>
              <span v-if="recommendation.deckMatch === true" class="ready">
                {{
                  translateApp(
                    recommendation.matchKind === 'condition'
                      ? 'quest.guide.badge.conditionOk'
                      : 'quest.guide.badge.formationOk'
                  )
                }}
              </span>
              <span v-else-if="recommendation.deckMatch === false" class="warning">
                {{
                  translateApp(
                    recommendation.matchKind === 'condition'
                      ? 'quest.guide.badge.conditionNg'
                      : 'quest.guide.badge.formationNg'
                  )
                }}
              </span>
              <span
                v-if="recommendation.equipmentRequirements.length > 0"
                class="equipment-condition"
                :class="{
                  'is-missing': recommendation.equipmentRequirements.some(
                    (requirement) => requirement.missing > 0
                  )
                }"
              >
                {{
                  translateApp('quest.guide.badge.equipmentConditions', {
                    params: { count: recommendation.equipmentRequirements.length }
                  })
                }}
              </span>
              <span
                v-if="recommendation.consumableRequirements.length > 0"
                class="equipment-condition"
                :class="{
                  'is-missing': recommendation.consumableRequirements.some(
                    (requirement) => requirement.missing > 0
                  )
                }"
              >
                {{
                  translateApp('quest.guide.badge.itemConditions', {
                    params: { count: recommendation.consumableRequirements.length }
                  })
                }}
              </span>
            </div>
            <div class="quest-guide-title">
              <span class="quest-guide-no">#{{ recommendation.quest.api_no }}</span>
              {{ recommendation.quest.api_title }}
            </div>
            <div class="quest-guide-detail">{{ questDetail(recommendation) }}</div>
            <div
              v-if="recommendation.progressDetails.length > 0"
              class="quest-guide-progress-detail is-structured"
              :aria-label="
                translateApp('quest.guide.progress.measuredWithValue', {
                  params: {
                    value: questGuideProgressDetailsText(
                      recommendation.progressDetails
                    ) ?? ''
                  }
                })
              "
            >
              <span class="progress-label">{{
                translateApp('quest.guide.progress.measured')
              }}</span>
              <span
                v-for="detail in recommendation.progressDetails"
                :key="`${detail.kind}-${detail.label}`"
                class="progress-item"
                :class="{ 'is-completed': detail.completed }"
              >
                {{ detail.label }} {{ detail.current }}/{{ detail.required }}
              </span>
            </div>
            <div v-else-if="recommendation.progressDetail" class="quest-guide-progress-detail">
              {{
                translateApp('quest.guide.progress.measuredWithValue', {
                  params: { value: recommendation.progressDetail }
                })
              }}
            </div>
          </div>
          <div class="quest-guide-card-actions">
            <button
              type="button"
              class="quest-guide-wiki card-link"
              @click="openExternalUrl(recommendationWikiUrl(recommendation))"
            >
              {{ wikiCardLabel }}
            </button>
            <button
              type="button"
              class="quest-guide-detail-toggle"
              :aria-expanded="expandedQuestId === recommendation.quest.api_no"
              @click="toggleKnowledge(recommendation.quest.api_no)"
            >
              {{ translateApp('quest.guide.knowledge.toggle') }}
            </button>
          </div>
        </div>

        <div class="quest-guide-rewards">
          <span>{{
            translateApp('quest.guide.reward.fuel', {
              params: { value: recommendation.quest.api_get_material[0] }
            })
          }}</span>
          <span>{{
            translateApp('quest.guide.reward.ammo', {
              params: { value: recommendation.quest.api_get_material[1] }
            })
          }}</span>
          <span>{{
            translateApp('quest.guide.reward.steel', {
              params: { value: recommendation.quest.api_get_material[2] }
            })
          }}</span>
          <span>{{
            translateApp('quest.guide.reward.bauxite', {
              params: { value: recommendation.quest.api_get_material[3] }
            })
          }}</span>
          <span v-if="recommendation.quest.api_select_rewards?.length" class="reward-special">
            {{
              translateApp('quest.guide.reward.select', {
                params: { count: recommendation.quest.api_select_rewards.length }
              })
            }}
          </span>
          <span v-else-if="recommendation.quest.api_bonus_flag > 0" class="reward-special">
            {{ translateApp('quest.guide.reward.other') }}
          </span>
        </div>

        <div class="quest-guide-reasons">
          <span v-for="reason in recommendation.reasons" :key="reason">{{ reason }}</span>
          <span v-for="caution in recommendation.cautions" :key="caution" class="warning">
            {{ caution }}
          </span>
        </div>

        <div
          v-if="
            recommendation.learnedPrerequisites.length > 0 ||
            recommendation.learnedDownstream.length > 0
          "
          class="quest-guide-chain"
        >
          <div v-if="recommendation.learnedPrerequisites.length > 0">
            {{ translateApp('quest.guide.relation.learnedBefore') }}
            <span
              v-for="entry in recommendation.learnedPrerequisites"
              :key="`${entry.from}-${entry.to}`"
            >
              #{{ entry.from }} {{ entry.fromTitle }}
            </span>
          </div>
          <div v-if="recommendation.learnedDownstream.length > 0">
            {{ translateApp('quest.guide.relation.learnedAfter') }}
            <span
              v-for="entry in recommendation.learnedDownstream"
              :key="`${entry.from}-${entry.to}`"
            >
              #{{ entry.to }} {{ entry.title }}
            </span>
          </div>
        </div>

        <section v-if="expandedQuestId === recommendation.quest.api_no" class="quest-knowledge">
          <header>
            <strong>{{ translateApp('quest.guide.knowledge.title') }}</strong>
            <span>{{ translateApp('quest.guide.knowledge.description') }}</span>
          </header>
          <div class="quest-knowledge-grid">
            <div v-if="recommendation.limitedEvidence.length > 0" class="quest-knowledge-limited">
              <h4>{{ translateApp('quest.guide.knowledge.limitedEvidence') }}</h4>
              <div
                v-for="(evidence, index) in recommendation.limitedEvidence"
                :key="`${evidence.source}:${evidence.observedAt}:${index}`"
                class="quest-knowledge-evidence"
              >
                <span class="confidence" :class="`is-${evidence.confidence}`">
                  {{ confidenceText(evidence.confidence) }}
                </span>
                <div>
                  <strong>{{ evidence.sourceLabel }}</strong>
                  <span>{{ evidence.summary }}</span>
                  <span v-if="evidence.endsAt">{{
                    translateApp('quest.guide.knowledge.endPlanned', {
                      params: { date: evidence.endsAt }
                    })
                  }}</span>
                  <span v-else>{{ translateApp('quest.guide.knowledge.endUnknown') }}</span>
                </div>
              </div>
            </div>
            <div>
              <h4>{{ translateApp('quest.guide.knowledge.usedEvidence') }}</h4>
              <div
                v-for="evidence in recommendation.knowledge.evidence"
                :key="`${evidence.source}:${evidence.summary}`"
                class="quest-knowledge-evidence"
              >
                <span class="confidence" :class="`is-${evidence.confidence}`">
                  {{ confidenceText(evidence.confidence) }}
                </span>
                <div>
                  <strong>{{ evidence.sourceLabel }}</strong>
                  <span>{{ evidence.summary }}</span>
                </div>
              </div>
            </div>
            <div class="quest-knowledge-curated">
              <h4>{{ translateApp('quest.guide.knowledge.curatedRelations') }}</h4>
              <div
                v-if="
                  recommendation.knowledge.curatedPrerequisiteGroups.length === 0 &&
                  recommendation.knowledge.curatedDownstream.length === 0 &&
                  recommendation.knowledge.conflicts.length === 0
                "
                class="quest-knowledge-empty"
              >
                {{
                  recommendation.knowledge.relationCoverageStatus === 'represented'
                    ? translateApp('quest.guide.knowledge.curatedEmpty')
                    : translateApp('quest.guide.knowledge.unregistered')
                }}
              </div>
              <div
                v-for="(group, groupIndex) in recommendation.knowledge.curatedPrerequisiteGroups"
                :key="`curated-before:${groupIndex}`"
                class="quest-curated-group"
              >
                <div class="quest-curated-group-title">
                  <span>{{ translateApp('quest.guide.knowledge.prerequisite') }}</span>
                  <strong>{{ prerequisiteModeText(group.mode) }}</strong>
                </div>
                <div
                  v-for="quest in group.quests"
                  :key="quest.questId"
                  class="quest-knowledge-relation is-curated"
                >
                  <span>{{ translateApp('quest.guide.knowledge.verified') }}</span>
                  <strong>#{{ quest.questId }} {{ quest.title }}</strong>
                  <small>{{
                    translateApp('quest.guide.knowledge.sourceCount', {
                      params: {
                        count: group.provenance.length,
                        date: group.provenance[0]?.lastVerifiedAt ?? ''
                      }
                    })
                  }}</small>
                </div>
                <div class="quest-curated-sources">
                  <button
                    v-for="source in group.provenance"
                    :key="source.source"
                    type="button"
                    @click="openExternalUrl(source.url)"
                  >
                    {{ curatedSourceLabel(source.source, source.sourceLabel) }}
                  </button>
                </div>
              </div>
              <div
                v-for="downstream in recommendation.knowledge.curatedDownstream"
                :key="`curated-after:${downstream.questId}`"
                class="quest-knowledge-relation is-curated"
              >
                <span>{{ translateApp('quest.guide.knowledge.downstream') }}</span>
                <strong> #{{ downstream.questId }} {{ downstream.title }} </strong>
                <small>{{
                  translateApp('quest.guide.knowledge.prerequisiteCondition', {
                    params: {
                      mode: prerequisiteModeText(downstream.prerequisiteMode)
                    }
                  })
                }}</small>
              </div>
              <div
                v-for="conflict in recommendation.knowledge.conflicts"
                :key="conflict.field"
                class="quest-knowledge-conflict"
              >
                <strong>{{ conflictTitle(conflict) }}</strong>
                <span>{{ conflictSummary(conflict) }}</span>
                <div class="quest-conflict-details">
                  <article
                    v-for="detail in conflict.details"
                    :key="detail.source"
                    class="quest-conflict-source"
                    :class="{
                      'is-unresolved': detail.reviewStatus !== 'verified'
                    }"
                  >
                    <header>
                      <button type="button" @click="openExternalUrl(detail.url)">
                        {{ curatedSourceLabel(detail.source, detail.sourceLabel) }}
                      </button>
                      <small>{{
                        translateApp('quest.guide.knowledge.verifiedAt', {
                          params: { date: detail.lastVerifiedAt }
                        })
                      }}</small>
                    </header>
                    <div
                      v-for="(group, detailGroupIndex) in detail.prerequisiteGroups"
                      :key="`${detail.source}:${detailGroupIndex}`"
                      class="quest-conflict-prerequisites"
                    >
                      <span>{{ prerequisiteModeText(group.mode) }}</span>
                      <ul>
                        <li v-for="quest in group.quests" :key="quest.questId">
                          #{{ quest.questId }} {{ quest.title }}
                        </li>
                      </ul>
                    </div>
                    <small
                      v-if="detail.reviewStatus !== 'verified'"
                      class="quest-conflict-incomplete"
                    >
                      {{ conflictReviewNote(detail) }}
                    </small>
                  </article>
                </div>
              </div>
            </div>
            <div
              v-if="recommendation.fleetChecks.length > 0"
              class="quest-knowledge-condition-checks"
            >
              <h4>{{ translateApp('quest.guide.knowledge.fleetConditions') }}</h4>
              <p>{{ translateApp('quest.guide.knowledge.fleetConditionsHelp') }}</p>
              <div class="quest-condition-check-list">
                <div
                  v-for="(check, index) in recommendation.fleetChecks"
                  :key="`fleet:${check.kind}:${check.label}:${index}`"
                  class="quest-condition-check"
                  :class="{
                    'has-count': check.current !== undefined && check.required !== undefined,
                    'is-ready': check.satisfied === true,
                    'is-missing': check.satisfied === false,
                    'is-unknown': check.satisfied === undefined
                  }"
                >
                  <span>{{ check.label }}</span>
                  <small v-if="check.current !== undefined && check.required !== undefined">
                    {{ check.current }} / {{ check.required }}
                  </small>
                  <strong v-if="check.satisfied === true">{{
                    translateApp('quest.guide.condition.satisfied')
                  }}</strong>
                  <strong v-else-if="check.satisfied === false">{{
                    translateApp('quest.guide.condition.unmet')
                  }}</strong>
                  <strong v-else>{{ translateApp('quest.guide.condition.unknown') }}</strong>
                </div>
              </div>
            </div>
            <div
              v-if="recommendation.conditionChecks.length > 0"
              class="quest-knowledge-condition-checks"
            >
              <h4>{{ translateApp('quest.guide.knowledge.executionConditions') }}</h4>
              <p>{{ translateApp('quest.guide.knowledge.executionConditionsHelp') }}</p>
              <div class="quest-condition-check-list">
                <div
                  v-for="(check, index) in recommendation.conditionChecks"
                  :key="`${check.kind}:${check.label}:${index}`"
                  class="quest-condition-check"
                  :class="{
                    'has-count': check.current !== undefined && check.required !== undefined,
                    'is-ready': check.satisfied === true,
                    'is-missing': check.satisfied === false,
                    'is-unknown': check.satisfied === undefined
                  }"
                >
                  <span>{{ check.label }}</span>
                  <small v-if="check.current !== undefined && check.required !== undefined">
                    {{ check.current }} / {{ check.required }}
                  </small>
                  <strong v-if="check.satisfied === true">{{
                    translateApp('quest.guide.condition.satisfied')
                  }}</strong>
                  <strong v-else-if="check.satisfied === false">{{
                    translateApp('quest.guide.condition.unmet')
                  }}</strong>
                  <strong v-else>{{ translateApp('quest.guide.condition.unknown') }}</strong>
                </div>
              </div>
            </div>
            <div
              v-if="recommendation.equipmentRequirements.length > 0"
              class="quest-knowledge-equipment"
            >
              <h4>{{ translateApp('quest.guide.preparation.equipment') }}</h4>
              <p>{{ translateApp('quest.guide.preparation.equipmentHelp') }}</p>
              <div class="quest-equipment-requirement-list">
                <div
                  v-for="(requirement, index) in recommendation.equipmentRequirements"
                  :key="`${requirement.kind}:${requirement.label}:${index}`"
                  class="quest-equipment-requirement"
                  :class="{ 'is-missing': requirement.missing > 0 }"
                >
                  <span class="kind">{{ equipmentKindText(requirement.kind) }}</span>
                  <strong>{{ requirement.label }}</strong>
                  <span>{{ requirement.available }} / {{ requirement.required }}</span>
                  <small v-if="requirement.missing > 0">{{
                    translateApp('quest.guide.preparation.missing', {
                      params: { count: requirement.missing }
                    })
                  }}</small>
                  <small v-else>{{ translateApp('quest.guide.preparation.ready') }}</small>
                </div>
              </div>
            </div>
            <div
              v-if="recommendation.consumableRequirements.length > 0"
              class="quest-knowledge-equipment"
            >
              <h4>{{ translateApp('quest.guide.preparation.items') }}</h4>
              <p>{{ translateApp('quest.guide.preparation.itemsHelp') }}</p>
              <div class="quest-equipment-requirement-list">
                <div
                  v-for="(requirement, index) in recommendation.consumableRequirements"
                  :key="`item:${requirement.itemId}:${index}`"
                  class="quest-equipment-requirement"
                  :class="{ 'is-missing': requirement.missing > 0 }"
                >
                  <span class="kind">{{ translateApp('quest.guide.preparation.owned') }}</span>
                  <strong>{{ requirement.label }}</strong>
                  <span>{{ requirement.available }} / {{ requirement.required }}</span>
                  <small v-if="requirement.missing > 0">{{
                    translateApp('quest.guide.preparation.missing', {
                      params: { count: requirement.missing }
                    })
                  }}</small>
                  <small v-else>{{ translateApp('quest.guide.preparation.ready') }}</small>
                </div>
              </div>
            </div>
            <div class="quest-knowledge-observed">
              <h4>{{ translateApp('quest.guide.knowledge.observedRelations') }}</h4>
              <div
                v-if="
                  recommendation.knowledge.prerequisites.length === 0 &&
                  recommendation.knowledge.downstream.length === 0
                "
                class="quest-knowledge-empty"
              >
                {{ translateApp('quest.guide.knowledge.observedEmpty') }}
              </div>
              <div
                v-for="relation in recommendation.knowledge.prerequisites"
                :key="`before:${relation.questId}`"
                class="quest-knowledge-relation"
              >
                <span>{{ translateApp('quest.guide.knowledge.observedBefore') }}</span>
                <strong>#{{ relation.questId }} {{ relation.title }}</strong>
                <small>{{ relation.evidence.summary }}</small>
              </div>
              <div
                v-for="relation in recommendation.knowledge.downstream"
                :key="`after:${relation.questId}`"
                class="quest-knowledge-relation"
              >
                <span>{{ translateApp('quest.guide.knowledge.observedAfter') }}</span>
                <strong>#{{ relation.questId }} {{ relation.title }}</strong>
                <small>{{ relation.evidence.summary }}</small>
              </div>
            </div>
          </div>
          <footer>
            <button
              v-for="reference in recommendation.knowledge.references"
              :key="reference.source"
              type="button"
              @click="openExternalUrl(reference.url)"
            >
              {{ reference.label }}
            </button>
          </footer>
        </section>
      </article>
    </div>

    <nav
      v-if="totalPages > 1"
      class="quest-guide-pagination"
      :aria-label="translateApp('quest.guide.pagination.aria')"
    >
      <button type="button" :disabled="currentPage === 1" @click="currentPage -= 1">
        {{ translateApp('quest.guide.pagination.previous') }}
      </button>
      <span>{{ currentPage }} / {{ totalPages }}</span>
      <button type="button" :disabled="currentPage === totalPages" @click="currentPage += 1">
        {{ translateApp('quest.guide.pagination.next') }}
      </button>
    </nav>
  </section>
</template>

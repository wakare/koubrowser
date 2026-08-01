<script setup lang="ts">
import { computed } from 'vue'
import type { AppMessageKey } from '@common/localization'
import {
  evaluateQuestGrowthFallback,
  type QuestGrowthFallbackInput,
  type QuestGrowthFallbackOutcome
} from '@common/quest_growth_evaluator'
import { translateApp } from '@renderer/store/global_setting'

const props = defineProps<{
  inputs: readonly QuestGrowthFallbackInput[]
}>()

const ObservableTitleKeys = {
  'modernization.material-summary': 'quest.growth.observable.modernization',
  'fleet.safety-state': 'quest.growth.observable.fleetSafety',
  'quest.visible-chain': 'quest.growth.observable.questChain',
  'resources.bands': 'quest.growth.observable.resources',
  'ships.asw-capable-summary': 'quest.growth.observable.asw',
  'capability.surface-air-los-gaps': 'quest.growth.observable.surfaceAirLos',
  'maps.eo-affordability': 'quest.growth.observable.eo',
  'capability.breadth-summary': 'quest.growth.observable.breadth',
  'practice.available-count': 'quest.growth.observable.practice',
  'event.overlay-status': 'quest.growth.observable.event'
} as const satisfies Record<QuestGrowthFallbackInput['observableId'], AppMessageKey>

const ActionMessageKeys = {
  OPEN_SHIP_AND_MODERNIZATION_VIEWS: 'quest.growth.action.openModernization',
  REFRESH_DAMAGE_SUPPLY_AND_REPAIR_STATE: 'quest.growth.action.refreshFleetSafety',
  OPEN_ALL_RELEVANT_QUEST_TABS_AND_REFRESH: 'quest.growth.action.openQuestTabs',
  OPEN_OR_REFRESH_LOCAL_RESOURCE_VIEW: 'quest.growth.action.refreshResources',
  SELECT_RESOURCE_POSTURE: 'quest.growth.action.selectResourcePosture',
  SELECT_TARGET_AND_INSPECT_INTENDED_FLEET: 'quest.growth.action.selectAswTarget',
  SELECT_TARGET_AND_OBTAIN_REVIEWED_TARGET_RULE: 'quest.growth.action.waitForAswRule',
  SELECT_TARGET_MAP_OR_MECHANIC: 'quest.growth.action.selectAswTarget',
  INSPECT_AND_CONFIRM_INTENDED_FLEET: 'quest.growth.action.confirmAswFleet',
  REVIEW_ASW_CATEGORY_FACTS_WITHOUT_READINESS_VERDICT: 'quest.growth.action.reviewAswFacts',
  SELECT_TARGET_CONTEXT_AND_REVIEWED_FORMULA: 'quest.growth.action.selectSurfaceTarget',
  SELECT_TARGET_CONTEXT_AND_OBTAIN_REVIEWED_VERSIONED_RULE:
    'quest.growth.action.waitForSurfaceRule',
  SELECT_TARGET_MAP: 'quest.growth.action.selectSurfaceTarget',
  SELECT_ROUTE_VARIANT_CONTEXT: 'quest.growth.action.selectRouteVariant',
  REVIEW_CATEGORY_FACTS_SEPARATELY_FROM_TARGET_CALCULATION:
    'quest.growth.action.reviewSurfaceFacts',
  OPEN_MAP_VIEW_AND_RESOLVE_EO_CONSTRAINTS: 'quest.growth.action.openMapView',
  RESOLVE_EO_SAFETY_RESOURCE_CAPABILITY_ROUTE_AND_TIME_CHECKS:
    'quest.growth.action.resolveEoChecks',
  SELECT_ONE_OPTIONAL_EO_TARGET: 'quest.growth.action.selectEoTarget',
  REVIEW_EO_CONSTRAINTS_WITHOUT_AFFORDABILITY_OR_ROUTE_VERDICT: 'quest.growth.action.reviewEoFacts',
  REFRESH_EVERGREEN_CAPABILITY_FACTS: 'quest.growth.action.refreshBreadth',
  SELECT_ONE_EVERGREEN_CAPABILITY_CATEGORY: 'quest.growth.action.selectBreadthCategory',
  REVIEW_EVERGREEN_COVERAGE_WITHOUT_EVENT_READINESS_VERDICT:
    'quest.growth.action.reviewBreadthFacts',
  OPEN_PRACTICE_SCREEN_AND_CHECK_AVAILABILITY: 'quest.growth.action.openPractice',
  WAIT_FOR_REVIEWED_VERSIONED_EVENT_OVERLAY: 'quest.growth.action.waitForEventReview',
  RETURN_TO_EVERGREEN_PREPARATION: 'quest.growth.action.returnToEvergreen',
  CONFIRM_EACH_MATERIAL_SHIP_IS_NOT_RARE_UNIQUE_QUEST_REQUIRED_OR_RETAINED:
    'quest.growth.action.confirmModernizationMaterials',
  REVIEW_DAMAGE_SUPPLY_AND_REPAIR_FACTS_SEPARATELY: 'quest.growth.action.reviewFleetSafety',
  REVIEW_VISIBLE_UNLOCK_QUESTS_AS_CURRENT_VIEW_ONLY: 'quest.growth.action.reviewVisibleQuests',
  REVIEW_MEASURED_TOTALS_AND_USER_POSTURE_SEPARATELY: 'quest.growth.action.reviewResourcePosture'
} as const satisfies Readonly<Record<string, AppMessageKey>>

type GrowthActionMessageKey =
  | (typeof ActionMessageKeys)[keyof typeof ActionMessageKeys]
  | 'quest.growth.action.review'

interface GrowthCheckRow {
  input: QuestGrowthFallbackInput
  outcome: QuestGrowthFallbackOutcome
  actions: readonly string[]
}

const rows = computed<GrowthCheckRow[]>(() =>
  props.inputs.map((input) => {
    const outcome = evaluateQuestGrowthFallback(input)
    return {
      input,
      outcome,
      actions: outcome.kind === 'manual-check' ? outcome.checks : outcome.steps
    }
  })
)
const acquisitionRows = computed(() =>
  rows.value.filter((row) => row.outcome.kind === 'data-acquisition')
)
const manualRows = computed(() => rows.value.filter((row) => row.outcome.kind === 'manual-check'))
const priorityActions = computed(() => {
  const unique = new Set<string>()
  for (const row of [...acquisitionRows.value, ...manualRows.value]) {
    for (const action of row.actions) unique.add(action)
  }
  return [...unique].slice(0, 5)
})

function title(input: QuestGrowthFallbackInput): string {
  return translateApp(ObservableTitleKeys[input.observableId])
}

function actionText(action: string): string {
  const key: GrowthActionMessageKey = Object.hasOwn(ActionMessageKeys, action)
    ? ActionMessageKeys[action as keyof typeof ActionMessageKeys]
    : 'quest.growth.action.review'
  return translateApp(key)
}
</script>

<template>
  <section class="quest-growth-check" data-route-output="prohibited">
    <header class="quest-growth-header">
      <div>
        <strong>{{ translateApp('quest.growth.title') }}</strong>
        <span>{{ translateApp('quest.growth.description') }}</span>
      </div>
      <div class="quest-growth-counts">
        <span class="is-missing">
          {{
            translateApp('quest.growth.summary.missing', {
              params: { count: acquisitionRows.length }
            })
          }}
        </span>
        <span>
          {{
            translateApp('quest.growth.summary.manual', {
              params: { count: manualRows.length }
            })
          }}
        </span>
      </div>
    </header>

    <p class="quest-growth-route-notice">{{ translateApp('quest.growth.routePending') }}</p>

    <section class="quest-growth-priority">
      <strong>{{ translateApp('quest.growth.priority') }}</strong>
      <ol>
        <li v-for="action in priorityActions" :key="action">{{ actionText(action) }}</li>
      </ol>
    </section>

    <details class="quest-growth-details">
      <summary>
        {{
          translateApp('quest.growth.details', {
            params: { count: rows.length }
          })
        }}
      </summary>
      <div class="quest-growth-grid">
        <article
          v-for="row in rows"
          :key="row.input.observableId"
          class="quest-growth-row"
          :class="{ 'is-missing': row.outcome.kind === 'data-acquisition' }"
        >
          <header>
            <strong>{{ title(row.input) }}</strong>
            <span>
              {{
                translateApp(
                  row.outcome.kind === 'data-acquisition'
                    ? 'quest.growth.status.missing'
                    : 'quest.growth.status.manual'
                )
              }}
            </span>
          </header>
          <ul>
            <li v-for="action in row.actions" :key="action">{{ actionText(action) }}</li>
          </ul>
        </article>
      </div>
    </details>
  </section>
</template>

<style scoped lang="scss">
.quest-growth-check {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(#75e8ff, 0.28);
  background: rgba(#75e8ff, 0.035);
  color: rgba(#fff, 0.82);
}

.quest-growth-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  > div:first-child {
    display: grid;
    gap: 2px;
  }

  strong {
    color: #dff8ff;
    font-size: 13px;
  }

  span {
    color: rgba(#fff, 0.58);
    font-size: 10px;
  }
}

.quest-growth-counts {
  display: flex;
  flex: none;
  gap: 5px;

  span {
    padding: 2px 6px;
    border: 1px solid rgba(#9fffc7, 0.42);
    color: #9fffc7;
    background: rgba(#9fffc7, 0.07);
    white-space: nowrap;

    &.is-missing {
      border-color: rgba(#ffd166, 0.55);
      color: #ffd98a;
      background: rgba(#ffd166, 0.08);
    }
  }
}

.quest-growth-route-notice {
  margin: 0;
  padding: 6px 8px;
  border-left: 3px solid #ffd166;
  color: rgba(#fff, 0.74);
  background: rgba(#ffd166, 0.08);
  font-size: 10px;
}

.quest-growth-priority {
  display: grid;
  grid-template-columns: minmax(110px, auto) minmax(0, 1fr);
  gap: 8px 14px;
  align-items: start;
  padding: 8px;
  border: 1px solid rgba(#fff, 0.16);
  background: rgba(#000, 0.16);

  strong {
    color: rgba(#fff, 0.9);
    font-size: 11px;
  }

  ol {
    display: grid;
    gap: 3px;
    margin: 0;
    padding-left: 20px;
    font-size: 10px;
  }
}

.quest-growth-details {
  summary {
    color: rgba(#dff8ff, 0.82);
    font-size: 10px;
    cursor: pointer;
  }
}

.quest-growth-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 6px;
  margin-top: 7px;
}

.quest-growth-row {
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid rgba(#9fffc7, 0.22);
  border-left: 3px solid #9fffc7;
  background: rgba(#9fffc7, 0.04);

  &.is-missing {
    border-color: rgba(#ffd166, 0.25);
    border-left-color: #ffd166;
    background: rgba(#ffd166, 0.045);
  }

  header {
    display: flex;
    justify-content: space-between;
    gap: 8px;

    strong {
      color: rgba(#fff, 0.88);
      font-size: 10px;
    }

    span {
      color: rgba(#fff, 0.5);
      font-size: 9px;
      white-space: nowrap;
    }
  }

  ul {
    display: grid;
    gap: 2px;
    margin: 5px 0 0;
    padding-left: 16px;
    color: rgba(#fff, 0.67);
    font-size: 9px;
  }
}

@media (max-width: 760px) {
  .quest-growth-priority {
    grid-template-columns: minmax(0, 1fr);
  }

  .quest-growth-header {
    flex-direction: column;
  }
}
</style>

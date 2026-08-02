<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AppMessageKey } from '@common/localization'
import {
  selectQuestGrowthRecommendedRoutes,
  type QuestGrowthReviewedRouteSegment
} from '@common/quest_growth_recommended_routes'
import {
  evaluateQuestGrowthFallback,
  type QuestGrowthFallbackInput,
  type QuestGrowthFallbackOutcome
} from '@common/quest_growth_evaluator'
import type {
  QuestGrowthFocus,
  QuestGrowthResourcePosture
} from '@renderer/common/quest-growth-snapshot'
import { translateApp } from '@renderer/store/global_setting'

const props = defineProps<{
  inputs: readonly QuestGrowthFallbackInput[]
  resourcePosture: QuestGrowthResourcePosture
  focus: QuestGrowthFocus
  now: Date
}>()
const emit = defineEmits<{
  'update:resourcePosture': [value: QuestGrowthResourcePosture]
  'update:focus': [value: QuestGrowthFocus]
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

interface GrowthFact {
  key: string
  label: string
  value: string
}

type GrowthFactLabelKey = Exclude<
  Extract<AppMessageKey, `quest.growth.fact.${string}`>,
  'quest.growth.fact.levelRangeValue'
>

const ConstraintStateMessageKeys = {
  pass: 'quest.growth.fact.state.clear',
  blocked: 'quest.growth.fact.state.blocked',
  unknown: 'quest.growth.fact.state.unknown'
} as const satisfies Readonly<Record<'pass' | 'blocked' | 'unknown', GrowthFactLabelKey>>

const EventOverlayMessageKeys = {
  unavailable: 'quest.growth.fact.state.unavailable',
  expired: 'quest.growth.fact.state.expired',
  unreviewed: 'quest.growth.fact.state.unreviewed',
  malformed: 'quest.growth.fact.state.malformed'
} as const satisfies Readonly<
  Record<'unavailable' | 'expired' | 'unreviewed' | 'malformed', GrowthFactLabelKey>
>

const FreshnessMessageKeys = {
  fresh: 'quest.growth.fact.state.available',
  stale: 'quest.growth.fact.state.stale',
  unknown: 'quest.growth.fact.state.unknown',
  unavailable: 'quest.growth.fact.state.unavailable'
} as const satisfies Readonly<Record<QuestGrowthFallbackInput['freshness'], GrowthFactLabelKey>>

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
const routesExpanded = ref(false)
const reviewedRouteSelection = computed(() =>
  selectQuestGrowthRecommendedRoutes(props.focus, props.now)
)
const FocusObservableIds: Readonly<
  Partial<Record<QuestGrowthFocus, QuestGrowthFallbackInput['observableId']>>
> = {
  resources: 'resources.bands',
  asw: 'ships.asw-capable-summary',
  surface: 'capability.surface-air-los-gaps',
  eo: 'maps.eo-affordability',
  breadth: 'capability.breadth-summary',
  event: 'event.overlay-status'
}
const orderedRows = computed(() => {
  const focusObservableId = FocusObservableIds[props.focus]
  return [...rows.value].sort((left, right) => {
    const leftFocused = left.input.observableId === focusObservableId ? 0 : 1
    const rightFocused = right.input.observableId === focusObservableId ? 0 : 1
    if (leftFocused !== rightFocused) return leftFocused - rightFocused
    const leftKind = left.outcome.kind === 'data-acquisition' ? 0 : 1
    const rightKind = right.outcome.kind === 'data-acquisition' ? 0 : 1
    return leftKind - rightKind
  })
})
const priorityActions = computed(() => {
  const unique = new Set<string>()
  for (const row of orderedRows.value) {
    for (const action of row.actions) unique.add(action)
  }
  return [...unique].slice(0, 5)
})
const focusedInput = computed(() => {
  const observableId = FocusObservableIds[props.focus]
  return observableId
    ? props.inputs.find((candidate) => candidate.observableId === observableId)
    : undefined
})
const focusedFacts = computed<GrowthFact[]>(() => {
  const input = focusedInput.value
  if (!input) return []

  switch (input.observableId) {
    case 'resources.bands':
      if (!input.totals) return [availabilityFact(input.freshness)]
      return [
        numberFact('fuel', 'quest.growth.fact.fuel', input.totals.fuel),
        numberFact('ammunition', 'quest.growth.fact.ammunition', input.totals.ammunition),
        numberFact('steel', 'quest.growth.fact.steel', input.totals.steel),
        numberFact('bauxite', 'quest.growth.fact.bauxite', input.totals.bauxite),
        numberFact(
          'repairBuckets',
          'quest.growth.fact.repairBuckets',
          input.totals.repairBuckets
        )
      ]
    case 'ships.asw-capable-summary':
      if (input.freshness !== 'fresh') return [availabilityFact(input.freshness)]
      return [
        numberFact('sonarCount', 'quest.growth.fact.sonarCount', input.sonarCount),
        numberFact(
          'depthChargeCount',
          'quest.growth.fact.depthChargeCount',
          input.depthChargeCount
        )
      ]
    case 'capability.surface-air-los-gaps':
      if (input.freshness !== 'fresh') return [availabilityFact(input.freshness)]
      return [
        numberFact(
          'airEquipmentCount',
          'quest.growth.fact.airEquipmentCount',
          input.airEquipmentCount
        ),
        numberFact(
          'losEquipmentCount',
          'quest.growth.fact.losEquipmentCount',
          input.losEquipmentCount
        )
      ]
    case 'maps.eo-affordability':
      if (input.freshness !== 'fresh') return [availabilityFact(input.freshness)]
      return [
        numberFact(
          'unlockedEoCount',
          'quest.growth.fact.unlockedEoCount',
          input.unlockedEoCount
        ),
        {
          key: 'fleetSafety',
          label: translateApp('quest.growth.fact.fleetSafety'),
          value: translateApp(ConstraintStateMessageKeys[input.safety])
        }
      ]
    case 'capability.breadth-summary':
      if (input.freshness !== 'fresh') return [availabilityFact(input.freshness)]
      return [
        numberFact('ownedShips', 'quest.growth.fact.ownedShips', input.ownedShipCount),
        numberFact('shipTypes', 'quest.growth.fact.shipTypes', input.shipTypeCount),
        {
          key: 'levelRange',
          label: translateApp('quest.growth.fact.levelRange'),
          value:
            input.minimumLevel === null || input.maximumLevel === null
              ? translateApp('quest.growth.fact.state.unknown')
              : translateApp('quest.growth.fact.levelRangeValue', {
                  params: { minimum: input.minimumLevel, maximum: input.maximumLevel }
                })
        },
        numberFact(
          'equipmentCategories',
          'quest.growth.fact.equipmentCategories',
          input.equipmentCategoryCount
        ),
        {
          key: 'resourceObservation',
          label: translateApp('quest.growth.fact.resourceObservation'),
          value: translateApp(
            input.resourceTotalsAvailable
              ? 'quest.growth.fact.state.available'
              : 'quest.growth.fact.state.unavailable'
          )
        }
      ]
    case 'event.overlay-status':
      return [
        {
          key: 'eventOverlay',
          label: translateApp('quest.growth.fact.eventOverlay'),
          value: translateApp(EventOverlayMessageKeys[input.overlayStatus])
        }
      ]
    default:
      return []
  }
})

function numberFact(key: string, labelKey: GrowthFactLabelKey, value: number): GrowthFact {
  return { key, label: translateApp(labelKey), value: value.toLocaleString('ja-JP') }
}

function availabilityFact(freshness: QuestGrowthFallbackInput['freshness']): GrowthFact {
  return {
    key: 'localData',
    label: translateApp('quest.growth.fact.localData'),
    value: translateApp(FreshnessMessageKeys[freshness])
  }
}

function title(input: QuestGrowthFallbackInput): string {
  return translateApp(ObservableTitleKeys[input.observableId])
}

function actionText(action: string): string {
  const key: GrowthActionMessageKey = Object.hasOwn(ActionMessageKeys, action)
    ? ActionMessageKeys[action as keyof typeof ActionMessageKeys]
    : 'quest.growth.action.review'
  return translateApp(key)
}

function updateResourcePosture(event: Event): void {
  emit(
    'update:resourcePosture',
    (event.target as HTMLSelectElement).value as QuestGrowthResourcePosture
  )
}

function updateFocus(event: Event): void {
  emit('update:focus', (event.target as HTMLSelectElement).value as QuestGrowthFocus)
}

function updateRoutesExpanded(event: Event): void {
  routesExpanded.value = (event.currentTarget as HTMLDetailsElement).open
}

function segmentTarget(segment: QuestGrowthReviewedRouteSegment): string {
  if (segment.mapKey) return segment.mapKey
  return segment.targetNodes.join(' / ')
}
</script>

<template>
  <section class="quest-growth-check" data-route-output="reviewed-opt-in">
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

    <p class="quest-growth-route-notice">{{ translateApp('quest.growth.routeAvailable') }}</p>

    <div class="quest-growth-context">
      <label>
        <span>{{ translateApp('quest.growth.context.resourcePosture') }}</span>
        <select :value="resourcePosture" @change="updateResourcePosture">
          <option value="unset">{{ translateApp('quest.growth.context.unset') }}</option>
          <option value="conserve">{{ translateApp('quest.growth.context.conserve') }}</option>
          <option value="balanced">{{ translateApp('quest.growth.context.balanced') }}</option>
          <option value="spend">{{ translateApp('quest.growth.context.spend') }}</option>
        </select>
      </label>
      <label>
        <span>{{ translateApp('quest.growth.context.focus') }}</span>
        <select :value="focus" @change="updateFocus">
          <option value="unset">{{ translateApp('quest.growth.context.unset') }}</option>
          <option value="resources">{{ translateApp('quest.growth.observable.resources') }}</option>
          <option value="asw">{{ translateApp('quest.growth.observable.asw') }}</option>
          <option value="surface">
            {{ translateApp('quest.growth.observable.surfaceAirLos') }}
          </option>
          <option value="eo">{{ translateApp('quest.growth.observable.eo') }}</option>
          <option value="breadth">{{ translateApp('quest.growth.observable.breadth') }}</option>
          <option value="event">{{ translateApp('quest.growth.observable.event') }}</option>
        </select>
      </label>
      <small>{{ translateApp('quest.growth.context.sessionOnly') }}</small>
    </div>

    <section class="quest-growth-facts" :data-focus="focus">
      <header>
        <strong>{{ translateApp('quest.growth.facts.title') }}</strong>
        <span>{{ translateApp('quest.growth.facts.description') }}</span>
      </header>
      <dl v-if="focusedFacts.length > 0">
        <div v-for="fact in focusedFacts" :key="fact.key">
          <dt>{{ fact.label }}</dt>
          <dd>{{ fact.value }}</dd>
        </div>
      </dl>
      <p v-else>{{ translateApp('quest.growth.facts.selectFocus') }}</p>
    </section>

    <section class="quest-growth-priority">
      <strong>{{ translateApp('quest.growth.priority') }}</strong>
      <ol>
        <li v-for="action in priorityActions" :key="action">{{ actionText(action) }}</li>
      </ol>
    </section>

    <details class="quest-growth-reviewed-routes" @toggle="updateRoutesExpanded">
      <summary>{{ translateApp('quest.growth.routes.summary') }}</summary>
      <div v-if="routesExpanded" class="quest-growth-reviewed-route-content">
        <p v-if="reviewedRouteSelection.state === 'select-focus'" class="quest-growth-route-empty">
          {{ translateApp('quest.growth.routes.selectFocus') }}
        </p>
        <p v-else-if="reviewedRouteSelection.state === 'no-route'" class="quest-growth-route-empty">
          {{ translateApp('quest.growth.routes.noMatch') }}
        </p>
        <p
          v-else-if="reviewedRouteSelection.state === 'knowledge-review-required'"
          class="quest-growth-route-empty is-warning"
        >
          {{ translateApp('quest.growth.routes.reviewRequired') }}
        </p>
        <article
          v-for="route in reviewedRouteSelection.routes"
          v-else
          :key="route.routeId"
          class="quest-growth-reviewed-route"
        >
          <header>
            <div>
              <strong>{{ route.title }}</strong>
              <p>{{ route.summary }}</p>
            </div>
            <div class="quest-growth-route-badges">
              <span>{{ translateApp('quest.growth.routes.reviewed') }}</span>
              <span>{{ translateApp('quest.growth.routes.manual') }}</span>
              <span>{{ translateApp('quest.growth.routes.focusCandidate') }}</span>
            </div>
          </header>

          <section>
            <h4>{{ translateApp('quest.growth.routes.applicability') }}</h4>
            <ul>
              <li v-for="item in route.applicability" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section v-for="segment in route.segments" :key="segment.segmentId">
            <h4>
              {{ translateApp('quest.growth.routes.segment', { params: { target: segmentTarget(segment) } }) }}
            </h4>
            <div class="quest-growth-route-columns">
              <div>
                <h5>{{ translateApp('quest.growth.routes.fleet') }}</h5>
                <ul>
                  <li v-for="item in segment.fleetConstraints" :key="item">{{ item }}</li>
                  <li v-for="item in segment.equipmentConstraints" :key="item">{{ item }}</li>
                </ul>
              </div>
              <div>
                <h5>{{ translateApp('quest.growth.routes.branches') }}</h5>
                <ul>
                  <li v-for="item in segment.branchConditions" :key="item">{{ item }}</li>
                </ul>
              </div>
            </div>
            <h5>{{ translateApp('quest.growth.routes.instructions') }}</h5>
            <ol>
              <li v-for="item in segment.sortieInstructions" :key="item">{{ item }}</li>
            </ol>
            <p class="quest-growth-route-fallback">
              <strong>{{ translateApp('quest.growth.routes.fallback') }}</strong>
              {{ segment.fallback }}
            </p>
          </section>

          <footer>
            <span>
              {{ translateApp('quest.growth.routes.reviewBy', { params: { date: route.currentness.reviewBy.slice(0, 10) } }) }}
            </span>
            <span>{{ route.fallback }}</span>
          </footer>
        </article>
      </div>
    </details>

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
  min-width: 0;
  max-width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(#75e8ff, 0.28);
  background: rgba(#75e8ff, 0.035);
  color: rgba(#fff, 0.82);
  box-sizing: border-box;
  container-type: inline-size;
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

.quest-growth-context {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 6px 10px;
  padding: 8px;
  border: 1px solid rgba(#75e8ff, 0.18);
  background: rgba(#000, 0.12);

  label {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 6px;
    align-items: center;
    color: rgba(#fff, 0.64);
    font-size: 10px;
  }

  select {
    min-width: 0;
    padding: 3px 5px;
    border: 1px solid rgba(#75e8ff, 0.32);
    color: #fff;
    background: #292929;
    font-size: 10px;
  }

  small {
    grid-column: 1 / -1;
    color: rgba(#fff, 0.42);
    font-size: 9px;
  }
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

.quest-growth-facts {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid rgba(#9fffc7, 0.2);
  background: rgba(#9fffc7, 0.035);

  header {
    display: grid;
    gap: 2px;

    strong {
      color: rgba(#fff, 0.88);
      font-size: 11px;
    }

    span {
      color: rgba(#fff, 0.48);
      font-size: 9px;
    }
  }

  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
    gap: 5px;
    margin: 0;

    div {
      min-width: 0;
      padding: 5px 6px;
      background: rgba(#000, 0.16);
    }
  }

  dt {
    overflow: hidden;
    color: rgba(#fff, 0.5);
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dd {
    margin: 1px 0 0;
    color: #dff8ff;
    font-size: 11px;
  }

  p {
    margin: 0;
    color: rgba(#fff, 0.54);
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

.quest-growth-reviewed-routes {
  min-width: 0;
  border: 1px solid rgba(#75e8ff, 0.24);
  background: rgba(#000, 0.14);

  > summary {
    padding: 8px;
    color: #dff8ff;
    font-size: 11px;
    cursor: pointer;
  }
}

.quest-growth-reviewed-route-content {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 0 8px 8px;
}

.quest-growth-route-empty {
  margin: 0;
  padding: 8px;
  color: rgba(#fff, 0.64);
  background: rgba(#fff, 0.04);

  &.is-warning {
    color: #ffd98a;
    background: rgba(#ffd166, 0.08);
  }
}

.quest-growth-reviewed-route {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border-left: 3px solid #75e8ff;
  background: rgba(#75e8ff, 0.045);
  overflow-wrap: anywhere;

  > header {
    display: flex;
    justify-content: space-between;
    gap: 10px;

    p {
      margin: 3px 0 0;
      color: rgba(#fff, 0.62);
      font-size: 10px;
    }
  }

  h4,
  h5 {
    margin: 0 0 4px;
    color: rgba(#fff, 0.88);
    font-size: 10px;
  }

  ul,
  ol {
    display: grid;
    gap: 3px;
    margin: 0;
    padding-left: 18px;
    color: rgba(#fff, 0.7);
    font-size: 10px;
  }

  > footer {
    display: grid;
    gap: 3px;
    padding-top: 7px;
    border-top: 1px solid rgba(#fff, 0.12);
    color: rgba(#fff, 0.52);
    font-size: 9px;
  }
}

.quest-growth-route-badges {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 4px;
  align-content: flex-start;

  span {
    padding: 2px 5px;
    border: 1px solid rgba(#9fffc7, 0.38);
    color: #9fffc7;
    font-size: 9px;
    white-space: nowrap;
  }
}

.quest-growth-route-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.quest-growth-route-fallback {
  margin: 8px 0 0;
  padding: 6px 7px;
  color: #ffd98a;
  background: rgba(#ffd166, 0.07);
  font-size: 9px;
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

  .quest-growth-context {
    grid-template-columns: minmax(0, 1fr);
  }

  .quest-growth-header {
    flex-direction: column;
  }

  .quest-growth-reviewed-route > header,
  .quest-growth-route-columns {
    grid-template-columns: minmax(0, 1fr);
    flex-direction: column;
  }
}

@container (max-width: 320px) {
  .quest-growth-header {
    flex-direction: column;
  }

  .quest-growth-counts {
    flex-wrap: wrap;
    max-width: 100%;
  }

  .quest-growth-context,
  .quest-growth-priority,
  .quest-growth-route-columns,
  .quest-growth-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .quest-growth-context label {
    grid-template-columns: minmax(0, 1fr);
  }

  .quest-growth-reviewed-route > header {
    flex-direction: column;
  }

  .quest-growth-route-badges {
    flex: 1 1 auto;
  }
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { QuestGuideRecommendation } from '@common/quest_guide'
import { type StrategyPreferencePreset, type StrategyQuestObjective } from '@common/quest_strategy'
import {
  buildQuestStrategyRoutePlanV2,
  type QuestStrategyCoverageStatus,
  type QuestStrategyQuestCoverage
} from '@common/quest_strategy_v2'
import {
  buildQuestStrategyLocalSnapshot,
  listQuestStrategyCandidates,
  listQuestStrategyDefaultBundles,
  migrateLegacyQuestStrategySelection,
  normalizeStoredQuestStrategySelectionV2,
  questStrategyEligibilityFingerprint,
  QuestStrategyMaximumSelection
} from '@renderer/common/quest-strategy-view'
import { translateApp } from '@renderer/store/global_setting'
import { questStrategyKnowledge } from '@renderer/store/quest_strategy'

const LegacySelectionStorageKey = 'questStrategyRouteSelection:v1'
const SelectionStorageKey = 'questStrategyRouteSelection:v2'
const PresetStorageKey = 'questStrategyRoutePreset:v1'
const HiddenRecipeStorageKey = 'questStrategyHiddenRecipes:v1'

const props = defineProps<{
  recommendations: readonly QuestGuideRecommendation[]
  availableMapKeys: ReadonlySet<string>
  mapDataAvailable: boolean
  shipTypeCounts?: Readonly<Record<string, number>>
  equipmentTypeCounts?: Readonly<Record<string, number>>
  activeQuestCount: number
  questCapacity?: number
  now: Date
}>()

function storedJson(key: string): unknown {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : []
  } catch {
    return []
  }
}

function storedHiddenRecipes(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(HiddenRecipeStorageKey) ?? '[]')
    return Array.isArray(value)
      ? value.filter(
          (item, index): item is string => typeof item === 'string' && value.indexOf(item) === index
        )
      : []
  } catch {
    return []
  }
}

function normalizePreset(value: unknown): StrategyPreferencePreset {
  switch (value) {
    case 'deadline':
    case 'resource-saving':
    case 'risk-averse':
      return value
    default:
      return 'balanced'
  }
}

const hiddenRecipeIds = ref<string[]>(storedHiddenRecipes())
const activeRecipes = computed(() =>
  questStrategyKnowledge.value.recipes.filter(
    (recipe) => !hiddenRecipeIds.value.includes(recipe.id)
  )
)
const candidates = computed(() =>
  listQuestStrategyCandidates(activeRecipes.value, props.recommendations, props.now.toISOString())
)
const readyCandidates = computed(() =>
  candidates.value.filter((candidate) => candidate.group === 'route-ready')
)
const partialCandidates = computed(() =>
  candidates.value.filter((candidate) => candidate.group === 'partial')
)
const diagnosticCandidates = computed(() =>
  candidates.value.filter((candidate) => candidate.group === 'diagnostic')
)
const selectedQuestIds = ref<number[]>([])
const selectionMode = ref<'auto' | 'manual'>('auto')
const selectionInitialized = ref(false)
const preset = ref<StrategyPreferencePreset>(
  normalizePreset(localStorage.getItem(PresetStorageKey))
)

const conflictedQuestIds = computed(() =>
  props.recommendations
    .filter((recommendation) => (recommendation.knowledge?.conflicts.length ?? 0) > 0)
    .map((recommendation) => recommendation.quest.api_no)
)
const defaultBundles = computed(() =>
  listQuestStrategyDefaultBundles(activeRecipes.value, candidates.value, props.now.toISOString())
)
const eligibilityFingerprint = computed(() =>
  questStrategyEligibilityFingerprint(
    questStrategyKnowledge.value.version,
    hiddenRecipeIds.value,
    activeRecipes.value,
    candidates.value
  )
)

function buildPlanFor(
  questIds: readonly number[],
  recipes = activeRecipes.value
): ReturnType<typeof buildQuestStrategyRoutePlanV2> | undefined {
  if (questIds.length === 0) {
    return undefined
  }
  const generatedAt = props.now.toISOString()
  const snapshot = buildQuestStrategyLocalSnapshot({
    capturedAt: generatedAt,
    selectedQuestIds: questIds,
    recommendations: props.recommendations,
    recipes,
    availableMapKeys: props.availableMapKeys,
    mapDataAvailable: props.mapDataAvailable,
    shipTypeCounts: props.shipTypeCounts,
    equipmentTypeCounts: props.equipmentTypeCounts,
    activeQuestCount: props.activeQuestCount,
    questCapacity: props.questCapacity
  })
  return buildQuestStrategyRoutePlanV2({
    knowledgeVersion: questStrategyKnowledge.value.version,
    generatedAt,
    recipes,
    snapshot,
    preferences: {
      preset: preset.value,
      maximumRoutes: QuestStrategyMaximumSelection
    },
    conflictedQuestIds: conflictedQuestIds.value
  })
}

function defaultSelection(): number[] {
  return (
    defaultBundles.value
      .map((bundle, index) => {
        const recipeIds = new Set(bundle.recipeIds)
        const bundleRecipes = activeRecipes.value.filter((item) => recipeIds.has(item.id))
        if (bundleRecipes.length !== bundle.recipeIds.length) return undefined
        const bundlePlan = buildPlanFor(bundle.questIds, bundleRecipes)
        const complete = bundle.questIds.every((questId) =>
          bundlePlan?.coveredQuestIds.includes(questId)
        )
        return complete && bundlePlan
          ? {
              questIds: bundle.questIds,
              score: bundlePlan.steps.reduce((total, step) => total + step.score.total, 0),
              index
            }
          : undefined
      })
      .filter(
        (candidate): candidate is { questIds: number[]; score: number; index: number } =>
          candidate !== undefined
      )
      .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.questIds ??
    []
  )
}

function persistManualSelection(): void {
  localStorage.setItem(
    SelectionStorageKey,
    JSON.stringify({ schemaVersion: 2, mode: 'manual', questIds: selectedQuestIds.value })
  )
}

watch(
  eligibilityFingerprint,
  () => {
    if (!selectionInitialized.value) {
      const stored = normalizeStoredQuestStrategySelectionV2(
        storedJson(SelectionStorageKey),
        candidates.value
      )
      const legacy = stored
        ? undefined
        : migrateLegacyQuestStrategySelection(
            storedJson(LegacySelectionStorageKey),
            candidates.value,
            defaultBundles.value
          )
      const restored = stored ?? legacy
      if (restored && buildPlanFor(restored.questIds)?.steps.length) {
        selectionMode.value = 'manual'
        selectedQuestIds.value = restored.questIds
        persistManualSelection()
      } else {
        selectionMode.value = 'auto'
        selectedQuestIds.value = defaultSelection()
        localStorage.removeItem(SelectionStorageKey)
      }
      localStorage.removeItem(LegacySelectionStorageKey)
      selectionInitialized.value = true
      return
    }
    if (selectionMode.value === 'manual') {
      const normalized = normalizeStoredQuestStrategySelectionV2(
        { schemaVersion: 2, mode: 'manual', questIds: selectedQuestIds.value },
        candidates.value
      )
      selectedQuestIds.value = normalized?.questIds ?? []
      persistManualSelection()
    } else {
      selectedQuestIds.value = defaultSelection()
    }
  },
  { immediate: true }
)
watch(preset, (value) => {
  localStorage.setItem(PresetStorageKey, value)
  if (selectionMode.value === 'auto') {
    selectedQuestIds.value = defaultSelection()
  }
})
watch(
  hiddenRecipeIds,
  (value) => {
    localStorage.setItem(HiddenRecipeStorageKey, JSON.stringify(value))
  },
  { deep: true }
)

const candidateById = computed(
  () => new Map(candidates.value.map((candidate) => [candidate.questId, candidate]))
)
const plan = computed(() => buildPlanFor(selectedQuestIds.value))
const primaryStep = computed(() =>
  plan.value?.steps.find((step) => step.completedQuestIds.length > 0)
)

function toggleQuest(questId: number): void {
  selectionMode.value = 'manual'
  if (selectedQuestIds.value.includes(questId)) {
    selectedQuestIds.value = selectedQuestIds.value.filter((value) => value !== questId)
    persistManualSelection()
    return
  }
  if (selectedQuestIds.value.length < QuestStrategyMaximumSelection) {
    selectedQuestIds.value = [...selectedQuestIds.value, questId]
    persistManualSelection()
  }
}

function restoreRecommendedSelection(): void {
  selectionMode.value = 'auto'
  localStorage.removeItem(SelectionStorageKey)
  selectedQuestIds.value = defaultSelection()
}

function hideRecipe(recipeId: string): void {
  if (!hiddenRecipeIds.value.includes(recipeId)) {
    hiddenRecipeIds.value = [...hiddenRecipeIds.value, recipeId]
  }
}

function restoreRecipe(recipeId: string): void {
  hiddenRecipeIds.value = hiddenRecipeIds.value.filter((value) => value !== recipeId)
}

function objectiveText(objective: StrategyQuestObjective): string {
  switch (objective.result) {
    case 'arrival':
      return translateApp('quest.strategy.objective.arrival', {
        params: { count: objective.requiredCount }
      })
    case 'victory':
      return translateApp('quest.strategy.objective.victory', {
        params: { count: objective.requiredCount }
      })
    case 'A':
      return translateApp('quest.strategy.objective.A', {
        params: { count: objective.requiredCount }
      })
    case 'S':
      return translateApp('quest.strategy.objective.S', {
        params: { count: objective.requiredCount }
      })
  }
}

function questTitle(questId: number): string {
  return candidateById.value.get(questId)?.title ?? `#${questId}`
}

function coverageStatusText(status: QuestStrategyCoverageStatus): string {
  switch (status) {
    case 'route-ready':
      return translateApp('quest.strategy.coverage.routeReady')
    case 'objective-only':
      return translateApp('quest.strategy.coverage.objectiveOnly')
    case 'route-unreviewed':
      return translateApp('quest.strategy.coverage.routeUnreviewed')
    case 'conflicted':
      return translateApp('quest.strategy.coverage.conflicted')
    case 'unsupported-v1-multi-stage':
      return translateApp('quest.strategy.coverage.multiStage')
    case 'withdrawn':
      return translateApp('quest.strategy.coverage.withdrawn')
    case 'knowledge-insufficient':
      return translateApp('quest.strategy.coverage.insufficient')
  }
}

function stageText(coverage: QuestStrategyQuestCoverage, stageIndex: number): string {
  const stage = coverage.requiredStages[stageIndex]
  if (!stage) {
    return `stage ${stageIndex + 1}`
  }
  const targets = stage.targets
    .map((target) => {
      const cells = target.targetCells.length > 0 ? ` (${target.targetCells.join('/')})` : ''
      return `${target.mapKey}${cells}`
    })
    .join(' / ')
  return `${targets}: ${objectiveText({
    questId: coverage.questId,
    result: stage.targets[0]?.result ?? 'victory',
    requiredCount: stage.requiredCount
  })}`
}

function openEvidence(url: string): void {
  void window.api.openExternalUrl(url)
}
</script>

<template>
  <section class="quest-strategy-route" :data-knowledge-version="questStrategyKnowledge.version">
    <header class="quest-strategy-header">
      <div>
        <strong>{{ translateApp('quest.strategy.title') }}</strong>
        <span>{{ translateApp('quest.strategy.description') }}</span>
      </div>
      <small>
        {{
          translateApp('quest.strategy.knowledgeVersion', {
            params: { version: questStrategyKnowledge.version }
          })
        }}
      </small>
    </header>

    <section v-if="primaryStep" class="quest-strategy-hero">
      <small>{{ translateApp('quest.strategy.nextRoute') }}</small>
      <h2>
        {{
          translateApp('quest.strategy.nextMap', {
            params: { map: primaryStep.mapKey }
          })
        }}
      </h2>
      <p>
        {{
          translateApp('quest.strategy.coCompletionReason', {
            params: {
              quests: primaryStep.completedQuestIds
                .map((questId) => `#${questId} ${questTitle(questId)}`)
                .join('・')
            }
          })
        }}
      </p>
      <section v-if="primaryStep.checks.some((check) => check.state === 'unknown')">
        <strong>{{ translateApp('quest.strategy.confirmBeforeSortie') }}</strong>
        <ul>
          <li
            v-for="check in primaryStep.checks
              .filter((item) => item.state === 'unknown')
              .slice(0, 3)"
            :key="check.code"
          >
            {{ check.message }}
          </li>
        </ul>
      </section>
    </section>
    <section v-else class="quest-strategy-zero-ready">
      <strong>{{ translateApp('quest.strategy.zeroReady.title') }}</strong>
      <p>{{ translateApp('quest.strategy.zeroReady.description') }}</p>
      <div>
        <span>
          {{
            translateApp('quest.strategy.zeroReady.partial', {
              params: { count: partialCandidates.length }
            })
          }}
        </span>
        <span>
          {{
            translateApp('quest.strategy.zeroReady.diagnostic', {
              params: { count: diagnosticCandidates.length }
            })
          }}
        </span>
      </div>
    </section>

    <details v-if="candidates.length > 0" class="quest-strategy-controls">
      <summary>{{ translateApp('quest.strategy.selection.change') }}</summary>
      <div class="quest-strategy-control-toolbar">
        <span>
          {{
            translateApp('quest.strategy.selection', {
              params: {
                selected: selectedQuestIds.length,
                maximum: QuestStrategyMaximumSelection
              }
            })
          }}
        </span>
        <button
          v-if="selectionMode === 'manual'"
          type="button"
          @click="restoreRecommendedSelection"
        >
          {{ translateApp('quest.strategy.selection.restore') }}
        </button>
        <label class="quest-strategy-preset">
          <span>{{ translateApp('quest.strategy.preset') }}</span>
          <select v-model="preset">
            <option value="balanced">{{ translateApp('quest.strategy.preset.balanced') }}</option>
            <option value="deadline">{{ translateApp('quest.strategy.preset.deadline') }}</option>
            <option value="resource-saving">
              {{ translateApp('quest.strategy.preset.resourceSaving') }}
            </option>
            <option value="risk-averse">
              {{ translateApp('quest.strategy.preset.riskAverse') }}
            </option>
          </select>
        </label>
      </div>

      <fieldset class="quest-strategy-candidate-list">
        <legend>{{ translateApp('quest.strategy.group.ready') }}</legend>
        <label
          v-for="candidate in readyCandidates"
          :key="candidate.questId"
          class="quest-strategy-candidate"
        >
          <input
            type="checkbox"
            :checked="selectedQuestIds.includes(candidate.questId)"
            :disabled="
              !selectedQuestIds.includes(candidate.questId) &&
              selectedQuestIds.length >= QuestStrategyMaximumSelection
            "
            @change="toggleQuest(candidate.questId)"
          />
          <span class="quest-strategy-candidate-title">
            <strong>#{{ candidate.questId }}</strong>
            {{ candidate.title }}
            <small v-if="candidate.active">{{ translateApp('quest.strategy.active') }}</small>
          </span>
          <small class="coverage-status">{{ coverageStatusText(candidate.coverageStatus) }}</small>
        </label>
        <p v-if="readyCandidates.length === 0" class="quest-strategy-empty">
          {{ translateApp('quest.strategy.group.ready.empty') }}
        </p>
      </fieldset>

      <details v-if="partialCandidates.length > 0" class="quest-strategy-candidate-group">
        <summary>
          {{
            translateApp('quest.strategy.group.partial', {
              params: { count: partialCandidates.length }
            })
          }}
        </summary>
        <div class="quest-strategy-candidate-list">
          <label
            v-for="candidate in partialCandidates"
            :key="candidate.questId"
            class="quest-strategy-candidate"
          >
            <input
              type="checkbox"
              :checked="selectedQuestIds.includes(candidate.questId)"
              :disabled="
                !selectedQuestIds.includes(candidate.questId) &&
                selectedQuestIds.length >= QuestStrategyMaximumSelection
              "
              @change="toggleQuest(candidate.questId)"
            />
            <span class="quest-strategy-candidate-title">
              <strong>#{{ candidate.questId }}</strong>
              {{ candidate.title }}
              <small v-if="candidate.active">{{ translateApp('quest.strategy.active') }}</small>
            </span>
            <small class="coverage-status">{{
              coverageStatusText(candidate.coverageStatus)
            }}</small>
          </label>
        </div>
      </details>

      <details v-if="diagnosticCandidates.length > 0" class="quest-strategy-candidate-group">
        <summary>
          {{
            translateApp('quest.strategy.group.diagnostic', {
              params: { count: diagnosticCandidates.length }
            })
          }}
        </summary>
        <div class="quest-strategy-candidate-list diagnostic">
          <div
            v-for="candidate in diagnosticCandidates"
            :key="candidate.questId"
            class="quest-strategy-candidate"
          >
            <span aria-hidden="true"></span>
            <span class="quest-strategy-candidate-title">
              <strong>#{{ candidate.questId }}</strong>
              {{ candidate.title }}
            </span>
            <small class="coverage-status">{{
              coverageStatusText(candidate.coverageStatus)
            }}</small>
          </div>
        </div>
      </details>
    </details>
    <p v-else class="quest-strategy-empty">{{ translateApp('quest.strategy.noCandidates') }}</p>

    <template v-if="plan">
      <details class="quest-strategy-summary">
        <summary>{{ translateApp('quest.strategy.auditSummary') }}</summary>
        <div>
          <span>
            {{
              translateApp('quest.strategy.summary', {
                params: {
                  routes: plan.steps.length,
                  covered: plan.coveredQuestIds.length,
                  selected: plan.selectedQuestIds.length
                }
              })
            }}
          </span>
          <span v-if="plan.uncoveredQuestIds.length > 0" class="warning">
            {{
              translateApp('quest.strategy.uncovered', {
                params: { quests: plan.uncoveredQuestIds.join(', ') }
              })
            }}
          </span>
          <span>
            {{
              translateApp('quest.strategy.executionSummary', {
                params: {
                  covered: plan.executionSummary.coveredQuestCount,
                  routes: plan.executionSummary.routeCount,
                  consolidated: plan.executionSummary.consolidatedRouteSetups
                }
              })
            }}
          </span>
          <span>
            {{
              plan.executionSummary.availableQuestSlots === undefined
                ? translateApp('quest.strategy.slotSummaryUnknown', {
                    params: {
                      required: plan.executionSummary.additionalQuestSlots
                    }
                  })
                : translateApp('quest.strategy.slotSummary', {
                    params: {
                      required: plan.executionSummary.additionalQuestSlots,
                      available: plan.executionSummary.availableQuestSlots
                    }
                  })
            }}
          </span>
        </div>
      </details>

      <div v-if="plan.steps.length > 0" class="quest-strategy-steps">
        <article
          v-for="(step, stepIndex) in plan.steps"
          :key="step.recipeId"
          class="quest-strategy-step"
        >
          <header>
            <span class="quest-strategy-step-number">{{ stepIndex + 1 }}</span>
            <div>
              <strong>{{ step.title }}</strong>
              <small>
                {{
                  translateApp('quest.strategy.stepMeta', {
                    params: {
                      map: step.mapKey,
                      score: step.score.total,
                      revision: step.recipeRevision
                    }
                  })
                }}
              </small>
            </div>
          </header>

          <dl class="quest-strategy-facts">
            <div>
              <dt>{{ translateApp('quest.strategy.routes') }}</dt>
              <dd>{{ step.routeLabels.join(' / ') }}</dd>
            </div>
            <div>
              <dt>{{ translateApp('quest.strategy.targets') }}</dt>
              <dd>{{ step.targetNodes.join(' / ') }}</dd>
            </div>
            <div>
              <dt>{{ translateApp('quest.strategy.fleet') }}</dt>
              <dd>
                {{
                  translateApp('quest.strategy.fleetSize', {
                    params: {
                      minimum: step.fleet.minimumShips,
                      maximum: step.fleet.maximumShips
                    }
                  })
                }}
                <template v-if="step.fleet.shipTypeConstraints.length > 0">
                  ・{{ step.fleet.shipTypeConstraints.map((item) => item.label).join(' / ') }}
                </template>
                <template v-if="step.fleet.specificShipConstraints?.length">
                  ・{{ step.fleet.specificShipConstraints.map((item) => item.label).join(' / ') }}
                </template>
              </dd>
            </div>
            <div v-if="step.equipmentTypeConstraints.length > 0">
              <dt>{{ translateApp('quest.strategy.equipment') }}</dt>
              <dd>
                {{
                  step.equipmentTypeConstraints
                    .map(
                      (item) =>
                        `${item.label}（${translateApp(
                          item.required ? 'quest.strategy.required' : 'quest.strategy.recommended'
                        )}）`
                    )
                    .join(' / ')
                }}
              </dd>
            </div>
            <div v-if="step.formations.length > 0">
              <dt>{{ translateApp('quest.strategy.formations') }}</dt>
              <dd>
                {{
                  step.formations
                    .map((item) => (item.when ? `${item.label}（${item.when}）` : item.label))
                    .join(' / ')
                }}
              </dd>
            </div>
            <div v-if="step.airState">
              <dt>{{ translateApp('quest.strategy.airState') }}</dt>
              <dd>{{ step.airState.summary }}</dd>
            </div>
          </dl>

          <section>
            <h4>{{ translateApp('quest.strategy.objectives') }}</h4>
            <ul>
              <li
                v-for="contribution in step.stageContributions"
                :key="`${step.recipeId}:${contribution.questId}:${contribution.stageIndex}`"
              >
                #{{ contribution.questId }} {{ questTitle(contribution.questId) }}:
                {{
                  translateApp('quest.strategy.stageContribution', {
                    params: { stage: contribution.stageIndex + 1 }
                  })
                }}
                {{ objectiveText(contribution.objective) }}
                <span v-if="!contribution.machineConstraintComplete" class="warning">
                  {{ translateApp('quest.strategy.constraintIncomplete') }}
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h4>{{ translateApp('quest.strategy.actions') }}</h4>
            <ol>
              <li v-for="action in step.actions" :key="action">{{ action }}</li>
            </ol>
          </section>

          <details class="quest-strategy-score">
            <summary>{{ translateApp('quest.strategy.score.title') }}</summary>
            <dl>
              <div>
                <dt>{{ translateApp('quest.strategy.score.coCompletion') }}</dt>
                <dd>{{ step.score.coCompletion }}</dd>
              </div>
              <div>
                <dt>{{ translateApp('quest.strategy.score.deadline') }}</dt>
                <dd>{{ step.score.deadlineUrgency }}</dd>
              </div>
              <div>
                <dt>{{ translateApp('quest.strategy.score.prerequisite') }}</dt>
                <dd>{{ step.score.prerequisiteProgress }}</dd>
              </div>
              <div>
                <dt>{{ translateApp('quest.strategy.score.readiness') }}</dt>
                <dd>{{ step.score.readiness }}</dd>
              </div>
              <div>
                <dt>{{ translateApp('quest.strategy.score.preference') }}</dt>
                <dd>{{ step.score.preferenceAdjustment }}</dd>
              </div>
              <div>
                <dt>{{ translateApp('quest.strategy.score.unknownPenalty') }}</dt>
                <dd>{{ step.score.unknownInputPenalty }}</dd>
              </div>
              <div>
                <dt>{{ translateApp('quest.strategy.score.stalePenalty') }}</dt>
                <dd>{{ step.score.staleEvidencePenalty }}</dd>
              </div>
            </dl>
          </details>

          <section
            v-if="step.checks.some((check) => check.state === 'unknown')"
            class="quest-strategy-confirmations"
          >
            <h4>{{ translateApp('quest.strategy.confirmations') }}</h4>
            <ul>
              <li
                v-for="check in step.checks.filter((item) => item.state === 'unknown')"
                :key="check.code"
              >
                {{ check.message }}
              </li>
            </ul>
          </section>

          <ul v-if="step.warnings.length > 0" class="quest-strategy-warnings">
            <li v-for="warning in step.warnings" :key="warning">{{ warning }}</li>
          </ul>

          <footer>
            <span>{{ translateApp('quest.strategy.evidence') }}</span>
            <button
              v-for="evidence in step.evidence"
              :key="evidence.sourceId"
              type="button"
              :title="evidence.summary"
              @click="openEvidence(evidence.url)"
            >
              {{ evidence.sourceLabel }}
            </button>
            <button type="button" @click="hideRecipe(step.recipeId)">
              {{ translateApp('quest.strategy.recipe.hide') }}
            </button>
          </footer>
        </article>
      </div>
      <details
        v-if="plan.questCoverage.some((coverage) => !coverage.complete)"
        class="quest-strategy-fallbacks"
      >
        <summary>
          {{
            translateApp('quest.strategy.fallback.compact', {
              params: {
                count: plan.questCoverage.filter((coverage) => !coverage.complete).length
              }
            })
          }}
        </summary>
        <p>{{ translateApp('quest.strategy.fallback.description') }}</p>
        <article
          v-for="coverage in plan.questCoverage.filter((item) => !item.complete)"
          :key="coverage.questId"
          class="quest-strategy-fallback"
        >
          <header>
            <strong>#{{ coverage.questId }} {{ questTitle(coverage.questId) }}</strong>
            <span>{{ coverageStatusText(coverage.coverageStatus) }}</span>
          </header>
          <ul v-if="coverage.requiredStages.length > 0">
            <li
              v-for="(_, stageIndex) in coverage.requiredStages"
              :key="`${coverage.questId}:stage:${stageIndex}`"
              :class="{
                completed: coverage.contributedStageIndexes.includes(stageIndex),
                remaining: coverage.remainingStageIndexes.includes(stageIndex)
              }"
            >
              {{
                coverage.contributedStageIndexes.includes(stageIndex)
                  ? translateApp('quest.strategy.stageCovered')
                  : translateApp('quest.strategy.stageRemaining')
              }}
              {{ stageText(coverage, stageIndex) }}
            </li>
          </ul>
          <p v-else>{{ translateApp('quest.strategy.fallback.insufficient') }}</p>
        </article>
      </details>

      <details v-if="plan.blocked.length > 0" class="quest-strategy-blocked">
        <summary>
          {{
            translateApp('quest.strategy.blocked', {
              params: { count: plan.blocked.length }
            })
          }}
        </summary>
        <div v-for="candidate in plan.blocked" :key="candidate.recipeId">
          <strong>{{ candidate.title }}</strong>
          <ul>
            <li v-for="reason in candidate.reasons" :key="reason">{{ reason }}</li>
          </ul>
        </div>
      </details>

      <details v-if="plan.alternatives.length > 0" class="quest-strategy-alternatives">
        <summary>
          {{
            translateApp('quest.strategy.alternatives', {
              params: { count: plan.alternatives.length }
            })
          }}
        </summary>
        <article v-for="alternative in plan.alternatives" :key="alternative.recipeId">
          <div>
            <strong>{{ alternative.title }}</strong>
            <small>
              {{
                translateApp('quest.strategy.alternativeMeta', {
                  params: {
                    map: alternative.mapKey,
                    score: alternative.score.total,
                    quests: alternative.coveredQuestIds.join(', ')
                  }
                })
              }}
            </small>
          </div>
          <button type="button" @click="hideRecipe(alternative.recipeId)">
            {{ translateApp('quest.strategy.recipe.hide') }}
          </button>
        </article>
      </details>
    </template>
    <p v-else-if="candidates.length > 0 && selectionMode === 'manual'" class="quest-strategy-empty">
      {{ translateApp('quest.strategy.noSelection') }}
    </p>

    <details v-if="hiddenRecipeIds.length > 0" class="quest-strategy-hidden">
      <summary>
        {{
          translateApp('quest.strategy.hidden', {
            params: { count: hiddenRecipeIds.length }
          })
        }}
      </summary>
      <button
        v-for="recipeId in hiddenRecipeIds"
        :key="recipeId"
        type="button"
        @click="restoreRecipe(recipeId)"
      >
        {{ translateApp('quest.strategy.recipe.restore', { params: { recipe: recipeId } }) }}
      </button>
    </details>
  </section>
</template>

<style scoped>
.quest-strategy-route {
  display: grid;
  gap: 0.75rem;
  padding: 0.9rem;
  border: 1px solid rgba(122, 122, 122, 0.28);
  border-radius: 6px;
}

.quest-strategy-header,
.quest-strategy-step > header,
.quest-strategy-step > footer {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
}

.quest-strategy-header > div,
.quest-strategy-step > header > div {
  display: grid;
  gap: 0.2rem;
}

.quest-strategy-hero,
.quest-strategy-zero-ready {
  display: grid;
  gap: 0.45rem;
  padding: 0.85rem;
  border-left: 3px solid #3273dc;
  background: rgba(50, 115, 220, 0.08);
}

.quest-strategy-hero h2,
.quest-strategy-hero p,
.quest-strategy-hero ul,
.quest-strategy-zero-ready p {
  margin: 0;
}

.quest-strategy-zero-ready {
  border-left-color: rgba(122, 122, 122, 0.55);
  background: rgba(122, 122, 122, 0.06);
}

.quest-strategy-zero-ready > div,
.quest-strategy-control-toolbar {
  display: flex;
  gap: 0.45rem 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.quest-strategy-controls > summary,
.quest-strategy-candidate-group > summary,
.quest-strategy-summary > summary,
.quest-strategy-fallbacks > summary {
  cursor: pointer;
  font-weight: 600;
}

.quest-strategy-controls[open] > summary,
.quest-strategy-candidate-group[open] > summary,
.quest-strategy-summary[open] > summary,
.quest-strategy-fallbacks[open] > summary {
  margin-bottom: 0.55rem;
}

.quest-strategy-control-toolbar {
  justify-content: space-between;
  margin-bottom: 0.65rem;
}

.quest-strategy-candidate-list {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  margin: 0;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(122, 122, 122, 0.22);
}

.quest-strategy-candidate {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(6.5rem, auto);
  gap: 0.35rem 0.55rem;
  align-items: center;
  min-width: 0;
  padding: 0.3rem 0;
}

.quest-strategy-candidate-title {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quest-strategy-candidate-title small,
.quest-strategy-candidate .coverage-status {
  display: inline-block;
  padding: 0.08rem 0.35rem;
  border-radius: 999px;
  background: rgba(72, 199, 142, 0.16);
}

.quest-strategy-candidate .coverage-status {
  justify-self: end;
  text-align: center;
  background: rgba(50, 115, 220, 0.14);
}

.quest-strategy-candidate-group {
  margin-top: 0.55rem;
}

.quest-strategy-preset {
  display: grid;
  gap: 0.25rem;
}

.quest-strategy-summary {
  opacity: 0.9;
}

.quest-strategy-summary > div {
  display: flex;
  gap: 0.5rem 1rem;
  flex-wrap: wrap;
}

.quest-strategy-steps {
  display: grid;
  gap: 0.75rem;
}

.quest-strategy-step {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border-left: 3px solid #3273dc;
  background: rgba(122, 122, 122, 0.06);
}

.quest-strategy-step-number {
  display: inline-grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  flex: 0 0 auto;
  border-radius: 50%;
  color: white;
  background: #3273dc;
}

.quest-strategy-facts {
  display: grid;
  gap: 0.3rem;
  margin: 0;
}

.quest-strategy-facts > div {
  display: grid;
  grid-template-columns: minmax(5rem, auto) 1fr;
  gap: 0.6rem;
}

.quest-strategy-facts dt,
.quest-strategy-step h4 {
  font-weight: 600;
}

.quest-strategy-facts dd,
.quest-strategy-step h4,
.quest-strategy-step ol,
.quest-strategy-step ul {
  margin: 0;
}

.quest-strategy-score dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: 0.35rem 0.75rem;
  margin: 0.5rem 0 0;
}

.quest-strategy-score dl > div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.quest-strategy-alternatives > article {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  margin-top: 0.5rem;
}

.quest-strategy-alternatives > article > div {
  display: grid;
}

.quest-strategy-fallbacks {
  display: grid;
  gap: 0.55rem;
}

.quest-strategy-fallbacks > h3,
.quest-strategy-fallbacks > p,
.quest-strategy-fallback ul,
.quest-strategy-fallback p {
  margin: 0;
}

.quest-strategy-fallback {
  display: grid;
  gap: 0.4rem;
  padding: 0.65rem 0.75rem;
  border-left: 2px solid rgba(122, 122, 122, 0.45);
  background: rgba(122, 122, 122, 0.05);
}

.quest-strategy-fallback > header {
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
}

.quest-strategy-fallback li.completed {
  opacity: 0.68;
}

.quest-strategy-fallback li.remaining {
  font-weight: 600;
}

.quest-strategy-hidden {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.quest-strategy-step > footer {
  justify-content: flex-start;
  flex-wrap: wrap;
  align-items: center;
}

.quest-strategy-warnings,
.quest-strategy-summary .warning {
  color: #b86b00;
}

.quest-strategy-empty {
  margin: 0;
  opacity: 0.75;
}

.quest-strategy-blocked > div {
  margin-top: 0.5rem;
}

.quest-strategy-route button:focus-visible,
.quest-strategy-route summary:focus-visible,
.quest-strategy-route input:focus-visible,
.quest-strategy-route select:focus-visible {
  outline: 2px solid #3273dc;
  outline-offset: 2px;
}

@media (max-width: 420px) {
  .quest-strategy-candidate {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .quest-strategy-candidate .coverage-status {
    grid-column: 2;
    justify-self: start;
  }

  .quest-strategy-control-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>

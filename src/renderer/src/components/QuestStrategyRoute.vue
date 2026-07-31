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
  normalizeQuestStrategySelection,
  QuestStrategyMaximumSelection
} from '@renderer/common/quest-strategy-view'
import { translateApp } from '@renderer/store/global_setting'
import { questStrategyKnowledge } from '@renderer/store/quest_strategy'

const SelectionStorageKey = 'questStrategyRouteSelection:v1'
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

function storedSelection(): unknown {
  try {
    const value = localStorage.getItem(SelectionStorageKey)
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
  listQuestStrategyCandidates(activeRecipes.value, props.recommendations)
)
const candidateQuestIds = computed(
  () => new Set(candidates.value.map((candidate) => candidate.questId))
)
const selectedQuestIds = ref<number[]>(
  normalizeQuestStrategySelection(storedSelection(), candidateQuestIds.value)
)
const preset = ref<StrategyPreferencePreset>(
  normalizePreset(localStorage.getItem(PresetStorageKey))
)

function defaultSelection(): number[] {
  const active = candidates.value
    .filter((candidate) => candidate.active)
    .map((candidate) => candidate.questId)
  return (
    active.length > 0 ? active : candidates.value.map((candidate) => candidate.questId)
  ).slice(0, QuestStrategyMaximumSelection)
}

watch(
  () => candidates.value.map((candidate) => candidate.questId).join(','),
  () => {
    const normalized = normalizeQuestStrategySelection(
      selectedQuestIds.value,
      candidateQuestIds.value
    )
    selectedQuestIds.value = normalized.length > 0 ? normalized : defaultSelection()
  },
  { immediate: true }
)
watch(
  selectedQuestIds,
  (value) => {
    localStorage.setItem(SelectionStorageKey, JSON.stringify(value))
  },
  { deep: true }
)
watch(preset, (value) => {
  localStorage.setItem(PresetStorageKey, value)
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
const plan = computed(() => {
  if (selectedQuestIds.value.length === 0) {
    return undefined
  }
  const generatedAt = props.now.toISOString()
  const snapshot = buildQuestStrategyLocalSnapshot({
    capturedAt: generatedAt,
    selectedQuestIds: selectedQuestIds.value,
    recommendations: props.recommendations,
    recipes: activeRecipes.value,
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
    recipes: activeRecipes.value,
    snapshot,
    preferences: {
      preset: preset.value,
      maximumRoutes: QuestStrategyMaximumSelection
    },
    conflictedQuestIds: props.recommendations
      .filter((recommendation) => recommendation.knowledge.conflicts.length > 0)
      .map((recommendation) => recommendation.quest.api_no)
  })
})

function toggleQuest(questId: number): void {
  if (selectedQuestIds.value.includes(questId)) {
    selectedQuestIds.value = selectedQuestIds.value.filter((value) => value !== questId)
    return
  }
  if (selectedQuestIds.value.length < QuestStrategyMaximumSelection) {
    selectedQuestIds.value = [...selectedQuestIds.value, questId]
  }
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

    <div v-if="candidates.length > 0" class="quest-strategy-controls">
      <fieldset>
        <legend>
          {{
            translateApp('quest.strategy.selection', {
              params: {
                selected: selectedQuestIds.length,
                maximum: QuestStrategyMaximumSelection
              }
            })
          }}
        </legend>
        <label
          v-for="candidate in candidates"
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
          <span>#{{ candidate.questId }} {{ candidate.title }}</span>
          <small v-if="candidate.active">{{ translateApp('quest.strategy.active') }}</small>
          <small class="coverage-status">{{ coverageStatusText(candidate.coverageStatus) }}</small>
        </label>
      </fieldset>
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
    <p v-else class="quest-strategy-empty">
      {{ translateApp('quest.strategy.noCandidates') }}
    </p>

    <template v-if="plan">
      <div class="quest-strategy-summary">
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
      <p v-else class="quest-strategy-empty">
        {{ translateApp('quest.strategy.noRoute') }}
      </p>

      <section
        v-if="plan.questCoverage.some((coverage) => !coverage.complete)"
        class="quest-strategy-fallbacks"
      >
        <h3>{{ translateApp('quest.strategy.fallback.title') }}</h3>
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
      </section>

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
    <p v-else-if="candidates.length > 0" class="quest-strategy-empty">
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
.quest-strategy-controls,
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

.quest-strategy-controls {
  flex-wrap: wrap;
}

.quest-strategy-controls fieldset {
  display: flex;
  flex: 1 1 420px;
  gap: 0.45rem 0.8rem;
  flex-wrap: wrap;
  min-width: 0;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(122, 122, 122, 0.22);
}

.quest-strategy-candidate {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.quest-strategy-candidate small {
  padding: 0.08rem 0.35rem;
  border-radius: 999px;
  background: rgba(72, 199, 142, 0.16);
}

.quest-strategy-candidate .coverage-status {
  background: rgba(50, 115, 220, 0.14);
}

.quest-strategy-preset {
  display: grid;
  gap: 0.25rem;
}

.quest-strategy-summary {
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
  border-left: 3px solid #ffb70f;
  background: rgba(255, 183, 15, 0.08);
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
</style>

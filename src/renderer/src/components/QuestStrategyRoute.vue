<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { QuestGuideRecommendation } from '@common/quest_guide'
import {
  buildQuestStrategyRoutePlan,
  type StrategyPreferencePreset,
  type StrategyQuestObjective
} from '@common/quest_strategy'
import { BundledQuestStrategyKnowledge } from '@common/quest_strategy_knowledge'
import {
  buildQuestStrategyLocalSnapshot,
  listQuestStrategyCandidates,
  normalizeQuestStrategySelection,
  QuestStrategyMaximumSelection
} from '@renderer/common/quest-strategy-view'
import { translateApp } from '@renderer/store/global_setting'

const SelectionStorageKey = 'questStrategyRouteSelection:v1'
const PresetStorageKey = 'questStrategyRoutePreset:v1'

const props = defineProps<{
  recommendations: readonly QuestGuideRecommendation[]
  availableMapKeys: ReadonlySet<string>
  mapDataAvailable: boolean
  shipTypeCounts: Readonly<Record<string, number>>
  equipmentTypeCounts: Readonly<Record<string, number>>
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

const candidates = computed(() =>
  listQuestStrategyCandidates(BundledQuestStrategyKnowledge.recipes, props.recommendations)
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
    recipes: BundledQuestStrategyKnowledge.recipes,
    availableMapKeys: props.availableMapKeys,
    mapDataAvailable: props.mapDataAvailable,
    shipTypeCounts: props.shipTypeCounts,
    equipmentTypeCounts: props.equipmentTypeCounts,
    activeQuestCount: props.activeQuestCount,
    questCapacity: props.questCapacity
  })
  return buildQuestStrategyRoutePlan({
    knowledgeVersion: BundledQuestStrategyKnowledge.version,
    generatedAt,
    recipes: BundledQuestStrategyKnowledge.recipes,
    snapshot,
    preferences: {
      preset: preset.value,
      maximumRoutes: QuestStrategyMaximumSelection
    }
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

function openEvidence(url: string): void {
  void window.api.openExternalUrl(url)
}
</script>

<template>
  <section class="quest-strategy-route">
    <header class="quest-strategy-header">
      <div>
        <strong>{{ translateApp('quest.strategy.title') }}</strong>
        <span>{{ translateApp('quest.strategy.description') }}</span>
      </div>
      <small>
        {{
          translateApp('quest.strategy.knowledgeVersion', {
            params: { version: BundledQuestStrategyKnowledge.version }
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
                v-for="objective in step.objectives.filter((item) =>
                  step.coveredQuestIds.includes(item.questId)
                )"
                :key="`${step.recipeId}:${objective.questId}`"
              >
                #{{ objective.questId }} {{ questTitle(objective.questId) }}:
                {{ objectiveText(objective) }}
              </li>
            </ul>
          </section>

          <section>
            <h4>{{ translateApp('quest.strategy.actions') }}</h4>
            <ol>
              <li v-for="action in step.actions" :key="action">{{ action }}</li>
            </ol>
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
          </footer>
        </article>
      </div>
      <p v-else class="quest-strategy-empty">
        {{ translateApp('quest.strategy.noRoute') }}
      </p>

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
    </template>
    <p v-else-if="candidates.length > 0" class="quest-strategy-empty">
      {{ translateApp('quest.strategy.noSelection') }}
    </p>
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

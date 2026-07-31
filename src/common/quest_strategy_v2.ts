import {
  buildQuestStrategyRoutePlan,
  type BuildQuestStrategyRoutePlanInput,
  type QuestStrategyRecipe,
  type StrategyQuestObjective,
  type StrategyRoutePlan,
  type StrategyRouteStep
} from '@common/quest_strategy'
import {
  projectQuestStrategyObjective,
  type QuestStrategyInventoryObjectiveStage,
  type QuestStrategyObjectiveProjection
} from '@common/quest_strategy_inventory'

export type QuestStrategyCoverageStatus =
  | 'route-ready'
  | 'objective-only'
  | 'route-unreviewed'
  | 'conflicted'
  | 'unsupported-v1-multi-stage'
  | 'knowledge-insufficient'
  | 'withdrawn'

export interface QuestStrategyStageContribution {
  questId: number
  stageIndex: number
  mapKey: string
  objective: StrategyQuestObjective
  machineConstraintComplete: boolean
}

export interface QuestStrategyRecipeObjectiveAudit {
  questId: number
  requiredStageCount: number
  contributions: QuestStrategyStageContribution[]
  complete: boolean
  coverageStatus: QuestStrategyCoverageStatus
}

export interface QuestStrategyQuestCoverage {
  questId: number
  requiredStages: QuestStrategyInventoryObjectiveStage[]
  contributedStageIndexes: number[]
  remainingStageIndexes: number[]
  complete: boolean
  partial: boolean
  coverageStatus: QuestStrategyCoverageStatus
}

export interface QuestStrategyRouteStepV2 extends StrategyRouteStep {
  stageContributions: QuestStrategyStageContribution[]
  completedQuestIds: number[]
  partialQuestIds: number[]
}

export interface QuestStrategyRoutePlanV2 extends Omit<
  StrategyRoutePlan,
  'schemaVersion' | 'coveredQuestIds' | 'uncoveredQuestIds' | 'steps' | 'alternatives'
> {
  schemaVersion: 2
  coveredQuestIds: number[]
  partialQuestIds: number[]
  uncoveredQuestIds: number[]
  questCoverage: QuestStrategyQuestCoverage[]
  steps: QuestStrategyRouteStepV2[]
  alternatives: QuestStrategyRouteStepV2[]
}

export interface BuildQuestStrategyRoutePlanV2Input extends BuildQuestStrategyRoutePlanInput {
  conflictedQuestIds?: readonly number[]
}

export function questStrategyRecipeIsOperational(
  recipe: QuestStrategyRecipe,
  generatedAt: string
): boolean {
  const now = Date.parse(generatedAt)
  if (!Number.isFinite(now) || recipe.status !== 'approved') {
    return false
  }
  if (!recipe.evidence.some((item) => !item.validUntil || Date.parse(item.validUntil) > now)) {
    return false
  }
  if (recipe.validity.startsAt && now < Date.parse(recipe.validity.startsAt)) {
    return false
  }
  return !recipe.validity.endsAt || now < Date.parse(recipe.validity.endsAt)
}

function objectiveProjection(questId: number): QuestStrategyObjectiveProjection | undefined {
  try {
    return projectQuestStrategyObjective(questId)
  } catch {
    return undefined
  }
}

function matchingStageIndexes(
  recipe: QuestStrategyRecipe,
  objective: StrategyQuestObjective,
  stages: readonly QuestStrategyInventoryObjectiveStage[]
): number[] {
  const result: number[] = []
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex]
    if (
      stage.requiredCount === objective.requiredCount &&
      stage.targets.some(
        (target) => target.mapKey === recipe.mapKey && target.result === objective.result
      )
    ) {
      result.push(stageIndex)
    }
  }
  return result
}

export function auditQuestStrategyRecipeObjective(
  recipe: QuestStrategyRecipe,
  questId: number
): QuestStrategyRecipeObjectiveAudit {
  const projection = objectiveProjection(questId)
  const objective = recipe.objectives?.find((item) => item.questId === questId)
  const machineConstraintComplete = projection?.fleetConstraint !== 'opaque'
  const stageIndexes = objective
    ? matchingStageIndexes(recipe, objective, projection?.objectiveStages ?? [])
    : []
  const contributions = stageIndexes.map((stageIndex) => ({
    questId,
    stageIndex,
    mapKey: recipe.mapKey,
    objective: { ...objective! },
    machineConstraintComplete
  }))
  const complete =
    machineConstraintComplete &&
    (projection?.objectiveStages.length ?? 0) > 0 &&
    new Set(stageIndexes).size === projection?.objectiveStages.length
  const coverageStatus: QuestStrategyCoverageStatus = complete
    ? 'route-ready'
    : contributions.length > 0
      ? (projection?.objectiveStages.length ?? 0) > 1
        ? 'unsupported-v1-multi-stage'
        : 'route-unreviewed'
      : (projection?.objectiveStages.length ?? 0) > 0
        ? 'objective-only'
        : 'knowledge-insufficient'
  return {
    questId,
    requiredStageCount: projection?.objectiveStages.length ?? 0,
    contributions,
    complete,
    coverageStatus
  }
}

export function questStrategyCoverageStatus(
  questId: number,
  recipes: readonly QuestStrategyRecipe[],
  generatedAt: string,
  conflicted = false
): QuestStrategyCoverageStatus {
  if (conflicted) {
    return 'conflicted'
  }
  const matchingRecipes = recipes.filter((recipe) => recipe.questIds.includes(questId))
  const operationalRecipes = matchingRecipes.filter((recipe) =>
    questStrategyRecipeIsOperational(recipe, generatedAt)
  )
  const audits = operationalRecipes.map((recipe) =>
    auditQuestStrategyRecipeObjective(recipe, questId)
  )
  if (audits.some((audit) => audit.complete)) {
    return 'route-ready'
  }
  const partial = audits.find((audit) => audit.contributions.length > 0)
  if (partial) {
    return partial.coverageStatus
  }
  if (matchingRecipes.some((recipe) => recipe.status === 'withdrawn')) {
    return 'withdrawn'
  }
  if (matchingRecipes.length > 0) {
    return 'route-unreviewed'
  }
  const projection = objectiveProjection(questId)
  return (projection?.objectiveStages.length ?? 0) > 0 ? 'objective-only' : 'knowledge-insufficient'
}

function stageContributionsForStep(
  step: StrategyRouteStep,
  recipe: QuestStrategyRecipe
): QuestStrategyStageContribution[] {
  return step.coveredQuestIds.flatMap(
    (questId) => auditQuestStrategyRecipeObjective(recipe, questId).contributions
  )
}

function coverageForQuest(
  questId: number,
  contributions: readonly QuestStrategyStageContribution[],
  recipes: readonly QuestStrategyRecipe[],
  generatedAt: string,
  conflicted: boolean
): QuestStrategyQuestCoverage {
  const projection = objectiveProjection(questId)
  const questContributions = contributions.filter((item) => item.questId === questId)
  const contributedStageIndexes = [
    ...new Set(
      questContributions
        .filter((item) => item.machineConstraintComplete && !conflicted)
        .map((item) => item.stageIndex)
    )
  ].sort((left, right) => left - right)
  const requiredStages = projection?.objectiveStages ?? []
  const remainingStageIndexes = requiredStages
    .map((_, index) => index)
    .filter((index) => !contributedStageIndexes.includes(index))
  const complete = requiredStages.length > 0 && remainingStageIndexes.length === 0
  const partial = !complete && questContributions.length > 0
  return {
    questId,
    requiredStages,
    contributedStageIndexes,
    remainingStageIndexes,
    complete,
    partial,
    coverageStatus: questStrategyCoverageStatus(questId, recipes, generatedAt, conflicted)
  }
}

function upgradeStep(
  step: StrategyRouteStep,
  recipesById: ReadonlyMap<string, QuestStrategyRecipe>,
  coverageByQuest: ReadonlyMap<number, QuestStrategyQuestCoverage>
): QuestStrategyRouteStepV2 {
  const recipe = recipesById.get(step.recipeId)
  const stageContributions = recipe ? stageContributionsForStep(step, recipe) : []
  const targetedQuestIds = [...new Set(stageContributions.map((item) => item.questId))]
  return {
    ...step,
    stageContributions,
    completedQuestIds: targetedQuestIds.filter((questId) => coverageByQuest.get(questId)?.complete),
    partialQuestIds: targetedQuestIds.filter((questId) => coverageByQuest.get(questId)?.partial)
  }
}

export function buildQuestStrategyRoutePlanV2(
  input: BuildQuestStrategyRoutePlanV2Input
): QuestStrategyRoutePlanV2 {
  const legacyPlan = buildQuestStrategyRoutePlan(input)
  const recipesById = new Map(input.recipes.map((recipe) => [recipe.id, recipe]))
  const selectedStepContributions = legacyPlan.steps.flatMap((step) => {
    const recipe = recipesById.get(step.recipeId)
    return recipe ? stageContributionsForStep(step, recipe) : []
  })
  const conflictedQuestIds = new Set(input.conflictedQuestIds ?? [])
  const questCoverage = legacyPlan.selectedQuestIds.map((questId) =>
    coverageForQuest(
      questId,
      selectedStepContributions,
      input.recipes,
      input.generatedAt,
      conflictedQuestIds.has(questId)
    )
  )
  const coverageByQuest = new Map(questCoverage.map((coverage) => [coverage.questId, coverage]))
  const coveredQuestIds = questCoverage
    .filter((coverage) => coverage.complete)
    .map((coverage) => coverage.questId)
  const partialQuestIds = questCoverage
    .filter((coverage) => coverage.partial)
    .map((coverage) => coverage.questId)
  const uncoveredQuestIds = questCoverage
    .filter((coverage) => !coverage.complete)
    .map((coverage) => coverage.questId)
  const warnings = [
    ...legacyPlan.warnings.filter(
      (warning) => !warning.includes('件の選択任務に利用可能な攻略手順がありません')
    ),
    ...(partialQuestIds.length > 0
      ? [`${partialQuestIds.length} 件は一部 stage の攻略手順だけを表示しています`]
      : []),
    ...(uncoveredQuestIds.length > partialQuestIds.length
      ? [
          `${
            uncoveredQuestIds.length - partialQuestIds.length
          } 件は目的事実のみで、審査済みルートがありません`
        ]
      : [])
  ]
  return {
    ...legacyPlan,
    schemaVersion: 2,
    coveredQuestIds,
    partialQuestIds,
    uncoveredQuestIds,
    questCoverage,
    steps: legacyPlan.steps.map((step) => upgradeStep(step, recipesById, coverageByQuest)),
    alternatives: legacyPlan.alternatives.map((step) =>
      upgradeStep(step, recipesById, coverageByQuest)
    ),
    warnings,
    executionSummary: {
      ...legacyPlan.executionSummary,
      coveredQuestCount: coveredQuestIds.length,
      consolidatedRouteSetups: Math.max(0, coveredQuestIds.length - legacyPlan.steps.length)
    }
  }
}

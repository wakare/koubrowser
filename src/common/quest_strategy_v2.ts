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
import { getQuestFleetCondition, type QuestFleetRule } from '@common/kcquest'

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

function sameIds(left: readonly number[], right: readonly number[]): boolean {
  const sortedLeft = [...left].sort((a, b) => a - b)
  const sortedRight = [...right].sort((a, b) => a - b)
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((typeId, index) => typeId === sortedRight[index])
  )
}

function recipeSatisfiesFleetRule(recipe: QuestStrategyRecipe, rule: QuestFleetRule): boolean {
  switch (rule.kind) {
    case 'ship-count':
      return (
        (rule.min === undefined || recipe.fleet.minimumShips >= rule.min) &&
        (rule.exact === undefined ||
          (recipe.fleet.minimumShips === rule.exact && recipe.fleet.maximumShips === rule.exact)) &&
        (rule.maximum === undefined || recipe.fleet.maximumShips <= rule.maximum)
      )
    case 'flagship-type':
      return (
        rule.minimumLevel === undefined &&
        !!recipe.fleet.flagshipTypeIds?.length &&
        recipe.fleet.flagshipTypeIds.every((typeId) => new Set<number>(rule.types).has(typeId))
      )
    case 'ship-type-count': {
      if (rule.minimumLevel !== undefined || rule.excludePositions !== undefined) {
        return false
      }
      const constraint = recipe.fleet.shipTypeConstraints.find((item) =>
        sameIds(item.shipTypeIds, rule.types)
      )
      return (
        constraint !== undefined &&
        (rule.min === undefined || constraint.minimum >= rule.min) &&
        (rule.exact === undefined ||
          (constraint.minimum === rule.exact && constraint.maximum === rule.exact)) &&
        (rule.maximum === undefined ||
          (constraint.maximum !== undefined && constraint.maximum <= rule.maximum))
      )
    }
    case 'specific-ship-count': {
      if (
        rule.minimumLevel !== undefined ||
        rule.exactMasterIds !== undefined ||
        rule.excludePositions !== undefined
      ) {
        return false
      }
      const constraint = recipe.fleet.specificShipConstraints?.find((item) =>
        sameIds(item.baseShipIds, rule.baseShipIds)
      )
      return (
        constraint !== undefined &&
        (rule.min === undefined || constraint.minimum >= rule.min) &&
        (rule.exact === undefined ||
          (constraint.minimum === rule.exact && constraint.maximum === rule.exact)) &&
        (rule.maximum === undefined ||
          (constraint.maximum !== undefined && constraint.maximum <= rule.maximum))
      )
    }
    case 'allowed-ship-types':
      return (
        !!recipe.fleet.allowedShipTypeIds?.length &&
        recipe.fleet.allowedShipTypeIds.every((typeId) =>
          new Set<number>(rule.types).has(typeId)
        ) &&
        recipe.fleet.shipTypeConstraints.every((constraint) =>
          constraint.shipTypeIds.every((typeId) => new Set<number>(rule.types).has(typeId))
        )
      )
    default:
      return false
  }
}

function recipeHasMachineCompleteFleetConstraint(
  recipe: QuestStrategyRecipe,
  questId: number,
  projection: QuestStrategyObjectiveProjection | undefined
): boolean {
  if (!projection || projection.fleetConstraint !== 'opaque') {
    return projection !== undefined
  }
  const condition = getQuestFleetCondition(questId)
  return !!condition && condition.rules.every((rule) => recipeSatisfiesFleetRule(recipe, rule))
}

function matchingStageIndexes(
  recipe: QuestStrategyRecipe,
  objective: StrategyQuestObjective,
  stages: readonly QuestStrategyInventoryObjectiveStage[]
): number[] {
  const targetCellIds = [...(recipe.targetCellIds ?? [])].sort((left, right) => left - right)
  const result: number[] = []
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex]
    if (
      stage.requiredCount === objective.requiredCount &&
      stage.targets.some((target) => {
        if (target.mapKey !== recipe.mapKey || target.result !== objective.result) {
          return false
        }
        const stageTargetCells = [...target.targetCells].sort((left, right) => left - right)
        return (
          targetCellIds.length === stageTargetCells.length &&
          targetCellIds.every((cellId, index) => cellId === stageTargetCells[index])
        )
      })
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
  const machineConstraintComplete = recipeHasMachineCompleteFleetConstraint(
    recipe,
    questId,
    projection
  )
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
  const projection = objectiveProjection(questId)
  const contributedStageIndexes = new Set(
    audits.flatMap((audit) =>
      audit.contributions
        .filter((contribution) => contribution.machineConstraintComplete)
        .map((contribution) => contribution.stageIndex)
    )
  )
  if (
    (projection?.objectiveStages.length ?? 0) > 0 &&
    projection!.objectiveStages.every((_, stageIndex) => contributedStageIndexes.has(stageIndex))
  ) {
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

function stageContributionKey(contribution: QuestStrategyStageContribution): string {
  return `${contribution.questId}:${contribution.stageIndex}`
}

function selectStageAwareSteps(
  candidates: readonly StrategyRouteStep[],
  recipesById: ReadonlyMap<string, QuestStrategyRecipe>,
  maximumRoutes: number
): { steps: StrategyRouteStep[]; alternatives: StrategyRouteStep[] } {
  const contributionsByRecipeId = new Map(
    candidates.map((step) => {
      const recipe = recipesById.get(step.recipeId)
      return [
        step.recipeId,
        recipe
          ? stageContributionsForStep(step, recipe).filter(
              (contribution) => contribution.machineConstraintComplete
            )
          : []
      ] as const
    })
  )
  const coveredContributions = new Set<string>()
  const selectedAlternatives = new Map<string, string>()
  const remaining = [...candidates]
  const steps: StrategyRouteStep[] = []

  while (steps.length < maximumRoutes) {
    const candidate = remaining
      .filter((step) => {
        const alternative = step.prerequisiteAlternative
        const hasNewContribution = (contributionsByRecipeId.get(step.recipeId) ?? []).some(
          (contribution) => !coveredContributions.has(stageContributionKey(contribution))
        )
        return (
          hasNewContribution &&
          (!alternative ||
            !selectedAlternatives.has(alternative.groupId) ||
            selectedAlternatives.get(alternative.groupId) === alternative.optionId)
        )
      })
      .sort((left, right) => {
        const leftMarginal = (contributionsByRecipeId.get(left.recipeId) ?? []).filter(
          (contribution) => !coveredContributions.has(stageContributionKey(contribution))
        ).length
        const rightMarginal = (contributionsByRecipeId.get(right.recipeId) ?? []).filter(
          (contribution) => !coveredContributions.has(stageContributionKey(contribution))
        ).length
        return (
          rightMarginal - leftMarginal ||
          right.score.total - left.score.total ||
          (left.recipeId < right.recipeId ? -1 : left.recipeId > right.recipeId ? 1 : 0)
        )
      })[0]
    if (!candidate) break

    steps.push(candidate)
    for (const contribution of contributionsByRecipeId.get(candidate.recipeId) ?? []) {
      coveredContributions.add(stageContributionKey(contribution))
    }
    const alternative = candidate.prerequisiteAlternative
    if (alternative) {
      selectedAlternatives.set(alternative.groupId, alternative.optionId)
    }
    remaining.splice(remaining.indexOf(candidate), 1)
  }

  const selectedRecipeIds = new Set(steps.map((step) => step.recipeId))
  return {
    steps,
    alternatives: candidates.filter((step) => !selectedRecipeIds.has(step.recipeId))
  }
}

export function buildQuestStrategyRoutePlanV2(
  input: BuildQuestStrategyRoutePlanV2Input
): QuestStrategyRoutePlanV2 {
  const legacyPlan = buildQuestStrategyRoutePlan(input)
  const recipesById = new Map(input.recipes.map((recipe) => [recipe.id, recipe]))
  const evaluatedByRecipeId = new Map(
    [...legacyPlan.steps, ...legacyPlan.alternatives].map((step) => [step.recipeId, step])
  )
  const stageSelection = selectStageAwareSteps(
    [...evaluatedByRecipeId.values()],
    recipesById,
    input.preferences.maximumRoutes
  )
  const selectedStepContributions = stageSelection.steps.flatMap((step) => {
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
    ...new Set(stageSelection.steps.flatMap((step) => step.warnings)),
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
    steps: stageSelection.steps.map((step) => upgradeStep(step, recipesById, coverageByQuest)),
    alternatives: stageSelection.alternatives.map((step) =>
      upgradeStep(step, recipesById, coverageByQuest)
    ),
    warnings,
    executionSummary: {
      ...legacyPlan.executionSummary,
      routeCount: stageSelection.steps.length,
      coveredQuestCount: coveredQuestIds.length,
      consolidatedRouteSetups: Math.max(0, coveredQuestIds.length - stageSelection.steps.length)
    }
  }
}

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { listCuratedQuestKnowledge } from '@common/quest_knowledge'
import { BundledQuestStrategyKnowledge } from '@common/quest_strategy_knowledge'
import {
  buildQuestStrategyInventory,
  summarizeQuestStrategyInventory,
  type QuestStrategyCadenceCatalog,
  type QuestStrategyInventoryCadence,
  type QuestStrategyInventoryEntry
} from '@common/quest_strategy_inventory'

interface InventoryArguments {
  check: boolean
  outputDirectory: string
  sourceCommit: string
}

interface CadenceCatalogFile {
  complete: boolean
  source: {
    sourceId: string
    url: string
    retrievedOn: string
    contentDigest: string
  }
  entries: {
    questId: number
    cadence: QuestStrategyInventoryCadence
    sourceCode: string
  }[]
}

interface CoveragePolicy {
  policyId: string
  revision: number
  gates: {
    compiledRecipeMaximum: number
  }
  runtimeV2Triggers: {
    losslessCoverageBelowBasisPoints: number
    unsupportedMultiStageAboveBasisPoints: number
    compiledRecipeAbove: number
    zeroHitRequiresLossyRecipe: boolean
  }
}

const OutputFilenames = [
  'coverage-inventory.json',
  'v1-lossless-report.json',
  'fact-lineage-report.json',
  'conflict-and-gap-report.json'
] as const

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonicalize(item)])
    )
  }
  return value
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function gitHead(root: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8'
  }).trim()
}

function parseArguments(argv: readonly string[], root: string): InventoryArguments {
  let check = false
  let outputDirectory = path.join(root, 'knowledge', 'quest-strategy', 'generated')
  let sourceCommit: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--check') {
      check = true
      continue
    }
    if (argument === '--output-dir' || argument === '--source-commit') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error(`${argument} requires a value`)
      }
      index += 1
      if (argument === '--output-dir') {
        outputDirectory = path.resolve(root, value)
      } else {
        if (!/^[0-9a-f]{40}$/.test(value)) {
          throw new Error('invalid --source-commit')
        }
        sourceCommit = value
      }
      continue
    }
    throw new Error(`unsupported argument: ${argument}`)
  }
  if (!sourceCommit && check) {
    const existingInventoryPath = path.join(outputDirectory, 'coverage-inventory.json')
    if (fs.existsSync(existingInventoryPath)) {
      const existing = readJson<{ source?: { repositoryCommit?: string } }>(existingInventoryPath)
      sourceCommit = existing.source?.repositoryCommit
    }
  }
  return { check, outputDirectory, sourceCommit: sourceCommit ?? gitHead(root) }
}

function countReasons(entries: readonly QuestStrategyInventoryEntry[]): Record<string, number> {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const reason of entry.reasonCodes) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1)
    }
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)))
}

function auditBundledRecipes(entries: readonly QuestStrategyInventoryEntry[]) {
  const entriesById = new Map(entries.map((entry) => [entry.questId, entry]))
  return BundledQuestStrategyKnowledge.recipes.map((recipe) => {
    const objectives = recipe.objectives.map((objective) => {
      const entry = entriesById.get(objective.questId)
      const stage = entry?.objectiveStages.length === 1 ? entry.objectiveStages[0] : undefined
      const lossless =
        stage !== undefined &&
        stage.requiredCount === objective.requiredCount &&
        stage.targets.some(
          (target) => target.mapKey === recipe.mapKey && target.result === objective.result
        )
      return {
        questId: objective.questId,
        lossless,
        reason: lossless
          ? 'COMPLETE_OBJECTIVE'
          : entry?.objectiveStages.length === 1
            ? 'OBJECTIVE_OR_MAP_MISMATCH'
            : 'PARTIAL_MULTI_STAGE_OBJECTIVE'
      }
    })
    return {
      recipeId: recipe.id,
      lossless: objectives.every((objective) => objective.lossless),
      objectives
    }
  })
}

export function buildQuestStrategyInventoryArtifacts(
  root: string,
  sourceCommit: string
): Record<(typeof OutputFilenames)[number], unknown> {
  const policyPath = path.join(root, 'knowledge', 'quest-strategy', 'coverage-policy.json')
  const cadenceCatalogPath = path.join(root, 'knowledge', 'quest-strategy', 'cadence-catalog.json')
  const questCatalogPath = path.join(root, 'src', 'common', 'kcquest.ts')
  const curatedKnowledgePath = path.join(root, 'src', 'common', 'quest_knowledge.ts')
  const policy = readJson<CoveragePolicy>(policyPath)
  const cadenceCatalogFile = readJson<CadenceCatalogFile>(cadenceCatalogPath)
  const cadenceCatalog: QuestStrategyCadenceCatalog = {
    complete: cadenceCatalogFile.complete,
    entries: new Map(cadenceCatalogFile.entries.map((entry) => [entry.questId, entry.cadence]))
  }
  const entries = buildQuestStrategyInventory(cadenceCatalog)
  const summary = summarizeQuestStrategyInventory(entries, cadenceCatalog.complete)
  const source = {
    repositoryCommit: sourceCommit,
    questCatalogDigest: sha256(fs.readFileSync(questCatalogPath)),
    cadenceCatalogDigest: sha256(fs.readFileSync(cadenceCatalogPath)),
    cadenceEvidence: cadenceCatalogFile.source,
    curatedKnowledgeDigest: sha256(fs.readFileSync(curatedKnowledgePath)),
    coveragePolicyId: policy.policyId,
    coveragePolicyRevision: policy.revision
  }
  const primaryEntries = entries.filter((entry) => entry.denominatorEligible)
  const gaps = primaryEntries.filter((entry) => entry.classification !== 'lossless-v1')
  const curatedConflicts = listCuratedQuestKnowledge()
    .filter((knowledge) => knowledge.conflicts.length > 0)
    .map((knowledge) => ({
      questId: knowledge.questId,
      conflictKinds: [...new Set(knowledge.conflicts.map((conflict) => conflict.kind))].sort()
    }))
  const losslessBasisPoints = summary.v1LosslessCoverageBasisPoints
  const multiStageBasisPoints = summary.unsupportedV1MultiStageBasisPoints
  const runtimeV2Reasons = [
    ...(!summary.cadenceCatalogComplete ? ['CADENCE_CATALOG_INCOMPLETE'] : []),
    ...(losslessBasisPoints !== undefined &&
    losslessBasisPoints < policy.runtimeV2Triggers.losslessCoverageBelowBasisPoints
      ? ['LOSSLESS_COVERAGE_BELOW_THRESHOLD']
      : []),
    ...(multiStageBasisPoints !== undefined &&
    multiStageBasisPoints > policy.runtimeV2Triggers.unsupportedMultiStageAboveBasisPoints
      ? ['UNSUPPORTED_MULTI_STAGE_ABOVE_THRESHOLD']
      : [])
  ]
  const bundledRecipeAudit = auditBundledRecipes(entries)

  return {
    'coverage-inventory.json': {
      schemaVersion: 1,
      source,
      summary,
      entries
    },
    'v1-lossless-report.json': {
      schemaVersion: 1,
      source,
      denominatorId: policy.policyId,
      primaryDenominatorCount: summary.primaryDenominatorCount,
      losslessV1Count: summary.losslessV1Count,
      v1LosslessCoverageBasisPoints: losslessBasisPoints,
      unsupportedV1MultiStageCount: summary.unsupportedV1MultiStageCount,
      unsupportedV1MultiStageBasisPoints: multiStageBasisPoints,
      compiledRecipeMaximum: policy.gates.compiledRecipeMaximum,
      runtimeV2Decision: runtimeV2Reasons.includes('CADENCE_CATALOG_INCOMPLETE')
        ? 'INVENTORY_INCOMPLETE'
        : runtimeV2Reasons.length === 0
          ? 'CONTINUE_V1_PILOT'
          : 'OPEN_RUNTIME_V2_DECISION',
      runtimeV2Reasons,
      bundledRecipeAudit,
      losslessQuestIds: primaryEntries
        .filter((entry) => entry.classification === 'lossless-v1')
        .map((entry) => entry.questId),
      unsupportedQuestIds: gaps.map((entry) => ({
        questId: entry.questId,
        classification: entry.classification,
        reasonCodes: entry.reasonCodes
      }))
    },
    'fact-lineage-report.json': {
      schemaVersion: 1,
      source,
      lineage: entries.map((entry) => ({
        questId: entry.questId,
        module: 'src/common/kcquest',
        accessor: 'getQuestStuff',
        sourceCommit,
        projectionDigest: sha256(canonicalJson(entry))
      }))
    },
    'conflict-and-gap-report.json': {
      schemaVersion: 1,
      source,
      curatedPrerequisiteConflicts: curatedConflicts,
      primaryGapCount: gaps.length,
      gapReasonCounts: countReasons(gaps),
      bundledPartialRecipeIds: bundledRecipeAudit
        .filter((recipe) => !recipe.lossless)
        .map((recipe) => recipe.recipeId),
      gaps: gaps.map((entry) => ({
        questId: entry.questId,
        classification: entry.classification,
        reasonCodes: entry.reasonCodes
      }))
    }
  }
}

function verifyOrWrite(
  outputDirectory: string,
  artifacts: Record<string, unknown>,
  check: boolean
): void {
  if (!check) {
    fs.mkdirSync(outputDirectory, { recursive: true })
  }
  for (const filename of OutputFilenames) {
    const outputPath = path.join(outputDirectory, filename)
    const expected = canonicalJson(artifacts[filename])
    if (check) {
      if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== expected) {
        throw new Error(
          `${filename} is not reproducible; run npm run data:quest-strategy:inventory`
        )
      }
    } else {
      fs.writeFileSync(outputPath, expected, 'utf8')
    }
  }
}

export function runQuestStrategyInventory(
  argv: readonly string[] = process.argv.slice(2),
  root = process.cwd()
): void {
  const options = parseArguments(argv, root)
  const artifacts = buildQuestStrategyInventoryArtifacts(root, options.sourceCommit)
  verifyOrWrite(options.outputDirectory, artifacts, options.check)
  const report = artifacts['v1-lossless-report.json'] as {
    primaryDenominatorCount: number
    losslessV1Count: number
    runtimeV2Decision: string
  }
  console.log(
    `Quest strategy inventory ${options.check ? 'verified' : 'generated'}: ` +
      `${report.losslessV1Count}/${report.primaryDenominatorCount} lossless, ` +
      `${report.runtimeV2Decision}`
  )
}

runQuestStrategyInventory()

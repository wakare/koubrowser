import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { BundledQuestStrategyKnowledge } from '@common/quest_strategy_knowledge'
import { auditQuestStrategyRecipeObjective } from '@common/quest_strategy_v2'

interface CoverageInventory {
  source: {
    repositoryCommit: string
    questCatalogDigest: string
    cadenceCatalogDigest: string
    curatedKnowledgeDigest: string
    coveragePolicyId: string
    coveragePolicyRevision: number
  }
  entries: {
    questId: number
    cadence?: string
    denominatorEligible: boolean
    classification: string
    reasonCodes: string[]
    objectiveStages: unknown[]
    fleetConstraint: string
  }[]
}

const CompilerVersion = 'quest-strategy-v2-compiler/1'
const OutputFilenames = [
  'runtime-v2-bundle.json',
  'runtime-v2-manifest.json',
  'runtime-v2-withdrawal-dependencies.json'
] as const

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    )
  }
  return value
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

export function buildQuestStrategyV2Artifacts(root: string): Record<string, unknown> {
  const inventoryPath = path.join(
    root,
    'knowledge',
    'quest-strategy',
    'generated',
    'coverage-inventory.json'
  )
  const policyPath = path.join(root, 'knowledge', 'quest-strategy', 'coverage-policy.json')
  const pilotManifestPath = path.join(
    root,
    'knowledge',
    'quest-strategy',
    'pilot-authoring-manifest.json'
  )
  execFileSync(
    process.execPath,
    [
      path.join(root, 'scripts', 'validate-quest-strategy-authoring.js'),
      '--manifest',
      path.relative(root, pilotManifestPath)
    ],
    { cwd: root, stdio: 'pipe' }
  )
  const inventory = readJson<CoverageInventory>(inventoryPath)
  const policy = readJson<{ revision: number; runtimeOutputSchema: number }>(policyPath)
  if (policy.runtimeOutputSchema !== 2) {
    throw new Error('coverage policy has not accepted runtime schema v2')
  }

  const unsupported: {
    recipeId: string
    questId: number
    reason: string
  }[] = []
  const routes = BundledQuestStrategyKnowledge.recipes
    .map((recipe) => {
      const contributions = recipe.questIds.flatMap((questId) => {
        const audit = auditQuestStrategyRecipeObjective(recipe, questId)
        if (audit.contributions.length === 0) {
          unsupported.push({
            recipeId: recipe.id,
            questId,
            reason: 'OBJECTIVE_OR_MAP_MISMATCH'
          })
          return []
        }
        const accepted = audit.contributions.filter(
          (contribution) => contribution.machineConstraintComplete
        )
        if (accepted.length === 0) {
          unsupported.push({
            recipeId: recipe.id,
            questId,
            reason: 'HARD_FLEET_CONSTRAINT_NOT_MACHINE_COMPLETE'
          })
        }
        return accepted.map((contribution) => ({
          questId: contribution.questId,
          stageIndex: contribution.stageIndex,
          mapKey: contribution.mapKey,
          result: contribution.objective.result,
          requiredCount: contribution.objective.requiredCount
        }))
      })
      if (contributions.length === 0) {
        return undefined
      }
      return {
        routeId: recipe.id,
        revision: recipe.revision,
        status: recipe.status,
        title: recipe.title,
        mapKey: recipe.mapKey,
        contributions,
        routeLabels: recipe.routeLabels,
        targetNodes: recipe.targetNodes,
        fleet: recipe.fleet,
        equipmentTypeConstraints: recipe.equipmentTypeConstraints,
        formations: recipe.formations,
        ...(recipe.airState ? { airState: recipe.airState } : {}),
        actions: recipe.actions,
        cost: recipe.cost,
        risk: recipe.risk,
        evidence: recipe.evidence,
        validity: recipe.validity
      }
    })
    .filter((route) => route !== undefined)

  const objectiveFacts = inventory.entries
    .filter((entry) => entry.denominatorEligible)
    .map((entry) => ({
      questId: entry.questId,
      cadence: entry.cadence,
      classification: entry.classification,
      reasonCodes: entry.reasonCodes,
      objectiveStages: entry.objectiveStages,
      fleetConstraint: entry.fleetConstraint
    }))
  const source = {
    repositoryCommit: inventory.source.repositoryCommit,
    questCatalogDigest: inventory.source.questCatalogDigest,
    cadenceCatalogDigest: inventory.source.cadenceCatalogDigest,
    curatedKnowledgeDigest: inventory.source.curatedKnowledgeDigest,
    coveragePolicyId: inventory.source.coveragePolicyId,
    coveragePolicyRevision: policy.revision,
    inventoryDigest: sha256(fs.readFileSync(inventoryPath)),
    pilotAuthoringManifestDigest: sha256(fs.readFileSync(pilotManifestPath)),
    legacyKnowledgeDigest: sha256(canonicalJson(BundledQuestStrategyKnowledge))
  }
  const bundle = {
    schemaVersion: 2,
    version: `${BundledQuestStrategyKnowledge.version}.v2`,
    compilerVersion: CompilerVersion,
    source,
    objectiveFacts,
    routes
  }
  const bundleDigest = sha256(canonicalJson(bundle))
  const manifest = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    source,
    output: {
      schemaVersion: 2,
      bundleDigest,
      objectiveFactCount: objectiveFacts.length,
      routeCount: routes.length,
      stageContributionCount: routes.reduce((count, route) => count + route.contributions.length, 0)
    },
    unsupported
  }
  const withdrawalDependencies = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    withdrawals: [],
    dependencies: routes.map((route) => ({
      routeId: route.routeId,
      questStageDependencies: route.contributions.map((contribution) => ({
        questId: contribution.questId,
        stageIndex: contribution.stageIndex
      })),
      evidenceDependencies: route.evidence.map((evidence) => evidence.sourceId)
    }))
  }
  return {
    'runtime-v2-bundle.json': bundle,
    'runtime-v2-manifest.json': manifest,
    'runtime-v2-withdrawal-dependencies.json': withdrawalDependencies
  }
}

function verifyOrWrite(root: string, artifacts: Record<string, unknown>, check: boolean): void {
  const outputDirectory = path.join(root, 'knowledge', 'quest-strategy', 'generated')
  for (const filename of OutputFilenames) {
    const outputPath = path.join(outputDirectory, filename)
    const expected = canonicalJson(artifacts[filename])
    if (check) {
      if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== expected) {
        throw new Error(`${filename} is not reproducible; run npm run data:quest-strategy:compile`)
      }
    } else {
      fs.writeFileSync(outputPath, expected, 'utf8')
    }
  }
}

function main(): void {
  const check = process.argv.includes('--check')
  const artifacts = buildQuestStrategyV2Artifacts(process.cwd())
  verifyOrWrite(process.cwd(), artifacts, check)
  const manifest = artifacts['runtime-v2-manifest.json'] as {
    output: {
      objectiveFactCount: number
      routeCount: number
      stageContributionCount: number
    }
    unsupported: unknown[]
  }
  console.log(
    `Quest strategy runtime v2 ${check ? 'verified' : 'compiled'}: ` +
      `${manifest.output.objectiveFactCount} facts, ${manifest.output.routeCount} routes, ` +
      `${manifest.output.stageContributionCount} stage contributions, ` +
      `${manifest.unsupported.length} rejected objectives`
  )
}

main()

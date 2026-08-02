import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const GeneratedDirectory = path.resolve(process.cwd(), 'knowledge', 'quest-strategy', 'generated')

function read<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(GeneratedDirectory, filename), 'utf8')) as T
}

describe('quest strategy runtime v2 compiler', () => {
  it('reproduces the checked-in runtime artifacts', () => {
    const output = execFileSync(
      process.execPath,
      [
        path.resolve(process.cwd(), 'node_modules', 'vite-node', 'vite-node.mjs'),
        '--config',
        'vitest.config.ts',
        'scripts/compile-quest-strategy-v2.ts',
        '--check'
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    )

    expect(output).toContain('27 facts, 16 routes, 29 stage contributions, 1 rejected objectives')
  })

  it('compiles exact stage contributions without promoting partial multi-stage quests', () => {
    const bundle = read<{
      schemaVersion: number
      objectiveFacts: { questId: number; objectiveStages: unknown[] }[]
      routes: {
        routeId: string
        contributions: { questId: number; stageIndex: number; mapKey: string }[]
      }[]
    }>('runtime-v2-bundle.json')
    const western = bundle.routes.find((route) => route.routeId === 'normal-4-2-western-periodic')!
    const quarterly = western.contributions.filter((contribution) => contribution.questId === 845)

    expect(bundle.schemaVersion).toBe(2)
    expect(bundle.objectiveFacts).toHaveLength(27)
    expect(
      bundle.objectiveFacts.find((fact) => fact.questId === 845)?.objectiveStages
    ).toHaveLength(5)
    expect(quarterly).toMatchObject([{ questId: 845, stageIndex: 1, mapKey: '4-2' }])
    expect(
      bundle.routes
        .flatMap((route) => route.contributions)
        .filter((contribution) => contribution.questId === 845)
        .sort((left, right) => left.stageIndex - right.stageIndex)
    ).toMatchObject([
      { questId: 845, stageIndex: 0, mapKey: '4-1' },
      { questId: 845, stageIndex: 1, mapKey: '4-2' },
      { questId: 845, stageIndex: 2, mapKey: '4-3' },
      { questId: 845, stageIndex: 3, mapKey: '4-4' },
      { questId: 845, stageIndex: 4, mapKey: '4-5' }
    ])

    const southwest = bundle.routes.find(
      (route) => route.routeId === 'normal-2-1-southwest-periodic'
    )!
    expect(southwest.contributions).toMatchObject([
      { questId: 226, stageIndex: 0, mapKey: '2-1' },
      { questId: 280, stageIndex: 3, mapKey: '2-1' },
      { questId: 284, stageIndex: 1, mapKey: '2-1' },
      { questId: 894, stageIndex: 2, mapKey: '2-1' }
    ])
  })

  it('rejects opaque hard constraints and emits withdrawal dependencies', () => {
    const manifest = read<{
      output: { bundleDigest: string }
      unsupported: { questId: number; reason: string; recipeId: string }[]
    }>('runtime-v2-manifest.json')
    const withdrawals = read<{
      withdrawals: unknown[]
      dependencies: { routeId: string; questStageDependencies: unknown[] }[]
    }>('runtime-v2-withdrawal-dependencies.json')

    expect(manifest.output.bundleDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(manifest.unsupported).toEqual([
      {
        questId: 257,
        reason: 'HARD_FLEET_CONSTRAINT_NOT_MACHINE_COMPLETE',
        recipeId: 'normal-1-4-light-fleet-periodic'
      }
    ])
    expect(withdrawals.withdrawals).toEqual([])
    expect(withdrawals.dependencies).toHaveLength(16)
  })

  it('binds every runtime route to an approved template and exact objective facts', () => {
    const authoring = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), 'knowledge', 'quest-strategy', 'pilot-authoring-manifest.json'),
        'utf8'
      )
    ) as {
      questFacts: { questId: number; status: string }[]
      mapTemplates: { fleetConstraintRef?: string; status: string }[]
    }
    const bundle = read<{
      routes: { routeId: string; contributions: { questId: number }[] }[]
    }>('runtime-v2-bundle.json')
    const approvedQuestIds = new Set(
      authoring.questFacts.filter((fact) => fact.status === 'approved').map((fact) => fact.questId)
    )
    const approvedRecipeIds = new Set(
      authoring.mapTemplates
        .filter(
          (template) =>
            template.status === 'approved' &&
            template.fleetConstraintRef?.startsWith('legacy-recipe:')
        )
        .map((template) => template.fleetConstraintRef!.slice('legacy-recipe:'.length))
    )

    expect(bundle.routes.every((route) => approvedRecipeIds.has(route.routeId))).toBe(true)
    expect(
      bundle.routes.every((route) =>
        route.contributions.every((contribution) => approvedQuestIds.has(contribution.questId))
      )
    ).toBe(true)
  })
})

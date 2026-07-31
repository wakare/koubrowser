import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const GeneratedDirectory = path.resolve(
  process.cwd(),
  'knowledge',
  'quest-strategy',
  'generated'
)

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

    expect(output).toContain(
      '27 facts, 3 routes, 8 stage contributions, 1 rejected objectives'
    )
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
    const western = bundle.routes.find(
      (route) => route.routeId === 'normal-4-2-western-periodic'
    )!
    const quarterly = western.contributions.filter(
      (contribution) => contribution.questId === 845
    )

    expect(bundle.schemaVersion).toBe(2)
    expect(bundle.objectiveFacts).toHaveLength(27)
    expect(bundle.objectiveFacts.find((fact) => fact.questId === 845)?.objectiveStages).toHaveLength(
      5
    )
    expect(quarterly).toMatchObject([{ questId: 845, stageIndex: 1, mapKey: '4-2' }])
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
    expect(withdrawals.dependencies).toHaveLength(3)
  })
})

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildReviewedQuestKnowledgeCandidate } from '@common/quest_knowledge_export'
import type { QuestCuratedClaim } from '@common/quest_knowledge'
import { parseQuestKnowledgeUpdate } from '@common/quest_knowledge_update'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'koubrowser-quest-export-'))
  temporaryDirectories.push(directory)
  return directory
}

function claim(
  source: QuestCuratedClaim['source'],
  questId: number,
  prerequisiteId: number,
  reviewStatus?: QuestCuratedClaim['reviewStatus']
): QuestCuratedClaim {
  return {
    source,
    sourceLabel: source === 'wikiwiki' ? '日本語攻略Wiki' : '中文KCWiki',
    url:
      source === 'wikiwiki'
        ? 'https://wikiwiki.jp/kancolle/任務/出撃任務'
        : 'https://zh.kcwiki.cn/wiki/任务分类',
    lastVerifiedAt: '2026-07-30',
    dataVersion: 'export test',
    questId,
    questTitle: `quest ${questId}`,
    prerequisites: [
      {
        mode: 'all',
        quests: [{ questId: prerequisiteId, title: `quest ${prerequisiteId}` }]
      }
    ],
    ...(reviewStatus ? { reviewStatus, reviewNote: 'test review state' } : {})
  }
}

describe('reviewed quest knowledge export', () => {
  it('includes only matching verified claims from both independent sources', () => {
    const report = buildReviewedQuestKnowledgeCandidate()
    const claimsByQuest = new Map<number, typeof report.candidate.claims>()
    for (const claim of report.candidate.claims) {
      const entries = claimsByQuest.get(claim.questId) ?? []
      entries.push(claim)
      claimsByQuest.set(claim.questId, entries)
    }

    expect(report.includedQuestCount).toBeGreaterThan(0)
    expect(report.includedClaimCount).toBe(report.includedQuestCount * 2)
    expect(report.excludedQuestCounts.unresolvedReview).toBeGreaterThan(0)
    for (const claims of claimsByQuest.values()) {
      expect(claims.map((claim) => claim.source).sort()).toEqual(['kcwiki', 'wikiwiki'])
      expect(
        new Set(
          claims.map((claim) =>
            JSON.stringify({
              questTitle: claim.questTitle,
              prerequisites: claim.prerequisites
            })
          )
        ).size
      ).toBe(1)
      expect(
        claims.every(
          (claim) => claim.reviewStatus === undefined || claim.reviewStatus === 'verified'
        )
      ).toBe(true)
    }
  })

  it('classifies unresolved, single-source, and disagreeing quest groups', () => {
    const report = buildReviewedQuestKnowledgeCandidate([
      claim('wikiwiki', 100, 1),
      claim('kcwiki', 100, 1),
      claim('wikiwiki', 200, 2, 'under-review'),
      claim('kcwiki', 200, 2),
      claim('wikiwiki', 300, 3),
      claim('wikiwiki', 400, 4),
      claim('kcwiki', 400, 5)
    ])

    expect(report.candidate.claims.map((entry) => entry.questId)).toEqual([100, 100])
    expect(report.excludedQuestCounts).toEqual({
      unresolvedReview: 1,
      missingIndependentSource: 1,
      sourceDisagreement: 1
    })
  })

  it('keeps the checked-in candidate synchronized with curated claims', () => {
    const expected = buildReviewedQuestKnowledgeCandidate().candidate
    const candidatePath = path.resolve(
      process.cwd(),
      'docs/data-update-candidates/quest-knowledge-reviewed-v1.json'
    )
    const actual = parseQuestKnowledgeUpdate(readFileSync(candidatePath, 'utf8'))

    expect(actual).toEqual(expected)
  })

  it('exports once and rejects unknown arguments or overwrites', () => {
    const root = createTemporaryDirectory()
    const outputPath = path.join(root, 'candidate.json')
    const command = path.resolve(process.cwd(), 'node_modules/vite-node/vite-node.mjs')
    const script = path.resolve(process.cwd(), 'scripts/export-reviewed-quest-knowledge.ts')
    const commonArguments = [
      command,
      '--config',
      path.resolve(process.cwd(), 'vitest.config.ts'),
      script
    ]

    const output = execFileSync(process.execPath, [...commonArguments, '--output', outputPath], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })
    expect(output).toContain('independently reviewed quests')
    expect(() => parseQuestKnowledgeUpdate(readFileSync(outputPath, 'utf8'))).not.toThrow()

    expect(() =>
      execFileSync(process.execPath, [...commonArguments, '--output', outputPath], {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    ).toThrow('output path already exists')

    const untouchedPath = path.join(root, 'untouched.json')
    expect(() =>
      execFileSync(
        process.execPath,
        [...commonArguments, '--output', untouchedPath, '--include-under-review', 'true'],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('unsupported argument: --include-under-review')
    expect(existsSync(untouchedPath)).toBe(false)
  })
})

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.resolve(repoRoot, relativePath), 'utf8')) as T
}

function fileDigest(relativePath: string): string {
  const bytes = readFileSync(path.resolve(repoRoot, relativePath))
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

describe('quest strategy real-account display acceptance packet', () => {
  it('binds the owner decision to the current screenshot-free read-only command and sources', () => {
    const request = readJson<{
      revision: number
      status: string
      implementationBasis: {
        packageJsonSha256: string
        smokeHarnessSha256: string
        questGuideSha256: string
        questStrategyRouteSha256: string
        questStrategyViewSha256: string
        bundledKnowledgeSha256: string
        protectedCommunicationSha256: Record<string, string>
      }
      requestedAuthorization: {
        executionAuthorization: string
        maximumExecutions: number
        command: string
        mode: string
      }
      evidenceContract: {
        screenshotCaptureAllowed: boolean
        rawLogRetentionAllowed: boolean
        accountDataExportAllowed: boolean
      }
      executionBoundary: Record<string, boolean>
      review: { approver: string | null; approvalDigest: string | null }
    }>('knowledge/quest-strategy/decisions/real-account-display-acceptance-request.json')
    const packageJson = readJson<{ scripts: Record<string, string> }>('package.json')

    expect(request.status).toBe('owner-decision-required')
    expect(request.revision).toBe(3)
    expect(request.requestedAuthorization).toEqual({
      gateId: 'quest-strategy-real-account-display-acceptance',
      executionAuthorization: 'not-authorized',
      maximumExecutions: 1,
      command: 'npm run smoke:accept:quest-strategy',
      mode: 'owner-login-readonly-redacted-no-screenshot'
    })
    expect(packageJson.scripts['smoke:accept:quest-strategy']).toBe(
      'node scripts/electron-smoke.js --manual-game-start --workspace-pages --task-guide ' +
        '--wide-workspace --summary --timeout 300000 --total-timeout 900000'
    )
    expect(packageJson.scripts['smoke:accept:quest-strategy']).not.toContain('--screenshot-dir')
    expect(packageJson.scripts['smoke:accept:quest-strategy']).not.toContain('--allow-game-start')

    expect(request.implementationBasis).toMatchObject({
      packageJsonSha256: fileDigest('package.json'),
      smokeHarnessSha256: fileDigest('scripts/electron-smoke.js'),
      questGuideSha256: fileDigest('src/renderer/src/components/QuestGuide.vue'),
      questStrategyRouteSha256: fileDigest(
        'src/renderer/src/components/QuestStrategyRoute.vue'
      ),
      questStrategyViewSha256: fileDigest(
        'src/renderer/src/common/quest-strategy-view.ts'
      ),
      bundledKnowledgeSha256: fileDigest(
        'knowledge/quest-strategy/generated/runtime-v2-bundle.json'
      )
    })
    for (const [relativePath, digest] of Object.entries(
      request.implementationBasis.protectedCommunicationSha256
    )) {
      expect(digest).toBe(fileDigest(relativePath))
    }

    expect(request.evidenceContract).toMatchObject({
      screenshotCaptureAllowed: false,
      rawLogRetentionAllowed: false,
      accountDataExportAllowed: false
    })
    expect(Object.values(request.executionBoundary)).toEqual(
      expect.arrayContaining([false])
    )
    expect(Object.values(request.executionBoundary).every((value) => value === false)).toBe(true)
    expect(request.review).toMatchObject({ approver: null, approvalDigest: null })
  })
})

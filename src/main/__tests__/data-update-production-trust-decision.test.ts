import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { bundledDataUpdateDeployment } from '../data-update-deployment'

const repoRoot = process.cwd()

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.resolve(repoRoot, relativePath), 'utf8')) as T
}

function fileDigest(relativePath: string): string {
  return `sha256:${createHash('sha256')
    .update(readFileSync(path.resolve(repoRoot, relativePath)))
    .digest('hex')}`
}

describe('data-update production trust configuration authoring decision', () => {
  it('keeps production disabled and binds authoring to public trust inputs and four paths', () => {
    const request = readJson<{
      revision: number
      status: string
      sourceSnapshot: Record<string, string>
      currentFailClosedState: Record<string, unknown>
      requestedAuthorization: {
        implementationAuthorization: string
        maximumImplementationCommits: number
        authorizedPaths: string[]
      }
      requiredPublicInputs: string[]
      inputHandling: { repositoryAndChatProhibited: string[] }
      executionBoundary: Record<string, boolean>
      review: { approver: string | null; approvalDigest: string | null }
    }>('knowledge/data-update/decisions/production-trust-configuration-authoring-request.json')

    expect(bundledDataUpdateDeployment).toEqual({
      manifestUrl: undefined,
      publicKey: undefined,
      publicKeySha256: undefined
    })
    expect(request.status).toBe('owner-decision-required')
    expect(request.revision).toBe(2)
    expect(request.sourceSnapshot).toMatchObject({
      deploymentSourceSha256: fileDigest('src/main/data-update-deployment.ts'),
      deploymentTestSha256: fileDigest('src/main/__tests__/data-update-deployment.test.ts'),
      keyOperationsDocSha256: fileDigest('docs/data-update-key-operations.md'),
      dataUpdateDocSha256: fileDigest('docs/data-update.md'),
      reviewedQuestCandidateSha256: fileDigest(
        'docs/data-update-candidates/quest-knowledge-reviewed-v1.json'
      ),
      offlineTrustInputVerifierSha256: fileDigest(
        'scripts/verify-data-update-production-trust-inputs.js'
      )
    })
    expect(request.requestedAuthorization).toEqual({
      gateId: 'data-update-production-trust-configuration-authoring',
      implementationAuthorization: 'not-authorized',
      maximumImplementationCommits: 1,
      authorizedPaths: [
        'src/main/data-update-deployment.ts',
        'src/main/__tests__/data-update-deployment.test.ts',
        'docs/data-update.md',
        'docs/data-update-key-operations.md'
      ]
    })
    expect(request.requiredPublicInputs).toHaveLength(5)
    expect(request.inputHandling.repositoryAndChatProhibited).toEqual(
      expect.arrayContaining(['private-key', 'passphrase', 'credential', 'token', 'account-data'])
    )
    expect(Object.values(request.executionBoundary).every((value) => value === false)).toBe(true)
    expect(request.review).toEqual({
      author: 'codex-data-update-trust-packet-author',
      approver: null,
      reviewedAt: null,
      approvalDigest: null
    })
  })
})

import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject
} from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  AllowedPublicEvidenceFields,
  ProhibitedOutputFields,
  ReviewBoundary,
  ReviewRoleContract,
  parseReviewArguments,
  reviewSignedBundleEvidence,
  validateProtectedCommunicationDigests,
  validateReviewEvidence,
  validateReviewFiles,
  validateRoleSeparation,
  validateSchemaDefinition
} = require('../../../scripts/quest-growth-r7-signed-bundle-evidence-review.js') as {
  AllowedPublicEvidenceFields: string[]
  ProhibitedOutputFields: string[]
  ReviewBoundary: Record<string, unknown>
  ReviewRoleContract: Record<string, string>
  parseReviewArguments: (argv: string[]) => Record<string, string>
  reviewSignedBundleEvidence: (options: {
    root: string
    bundleDirectory: string
    publicKey: string
  }) => Record<string, any>
  validateProtectedCommunicationDigests: (root: string) => boolean
  validateReviewEvidence: (value: Record<string, any>) => Record<string, any>
  validateReviewFiles: (root: string) => {
    schema: Record<string, any>
    fixture: Record<string, any>
  }
  validateRoleSeparation: () => Record<string, string>
  validateSchemaDefinition: (value: Record<string, any>) => Record<string, any>
}

const Root = process.cwd()
const CandidatePath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r7',
  'runtime-publication-candidate.json'
)

interface AnonymousBundle {
  directory: string
  publicKey: string
  publicKeyDer: Buffer
  remove: () => void
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

function signingPayload(manifest: Record<string, any>): string {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    dataVersion: manifest.dataVersion,
    publishedAt: manifest.publishedAt,
    files: [...manifest.files]
      .sort((left, right) => left.path.localeCompare(right.path))
      .map((file) => ({
        path: file.path,
        sha256: file.sha256,
        size: file.size
      }))
  })
}

function createAnonymousSignedBundle(options: {
  mutateRoutes?: (routes: Record<string, any>[]) => void
} = {}): AnonymousBundle {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'koubrowser-r7-signed-review-anonymous-')
  )
  const keys = generateKeyPairSync('ed25519')
  const candidate = JSON.parse(fs.readFileSync(CandidatePath, 'utf8')) as Record<
    string,
    any
  >
  const routes = structuredClone(candidate.routes) as Record<string, any>[]
  options.mutateRoutes?.(routes)
  const questKnowledgeData = Buffer.from(
    `${JSON.stringify(
      {
        schemaVersion: 1,
        claims: [
          {
            source: 'wikiwiki',
            sourceLabel: '日本語攻略Wiki',
            url: 'https://wikiwiki.jp/kancolle/任務/出撃任務',
            lastVerifiedAt: '2026-08-02',
            dataVersion: 'anonymous signed review fixture 1',
            questId: 900007,
            questTitle: '匿名 signed bundle review fixture',
            prerequisites: []
          }
        ],
        growthRoutes: {
          schemaVersion: 1,
          version: 'r7.synthetic.signed-review.1',
          publicationAuthorization: 'R7_RUNTIME_SIGNED_CANDIDATE',
          routes
        }
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  const manifest: Record<string, any> = {
    schemaVersion: 1,
    dataVersion: 'r7.synthetic.signed-review.1',
    publishedAt: '2026-08-02T00:00:00.000Z',
    files: [
      {
        path: 'quest/knowledge.json',
        sha256: sha256(questKnowledgeData),
        size: questKnowledgeData.byteLength
      }
    ],
    signature: ''
  }
  manifest.signature = sign(
    null,
    Buffer.from(signingPayload(manifest), 'utf8'),
    keys.privateKey as KeyObject
  ).toString('base64')
  fs.mkdirSync(path.join(directory, 'quest'))
  fs.writeFileSync(path.join(directory, 'quest', 'knowledge.json'), questKnowledgeData)
  fs.writeFileSync(
    path.join(directory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  )
  const publicKeyDer = keys.publicKey.export({ format: 'der', type: 'spki' })
  return {
    directory,
    publicKey: publicKeyDer.toString('base64'),
    publicKeyDer,
    remove: () => fs.rmSync(directory, { recursive: true, force: true })
  }
}

describe('R7 signed bundle evidence review authoring', () => {
  it('validates the strict schema and anonymous evidence fixture', () => {
    const result = validateReviewFiles(Root)

    expect(result.schema.additionalProperties).toBe(false)
    expect(validateSchemaDefinition(result.schema)).toBe(result.schema)
    expect(result.fixture).toMatchObject({
      routeCount: 2,
      requiredCheckCount: 10,
      redactedAcceptanceStatus: 'anonymous-fixture-passed'
    })
  })

  it('reviews an ephemeral anonymous signed bundle offline', () => {
    const bundle = createAnonymousSignedBundle()
    try {
      const evidence = reviewSignedBundleEvidence({
        root: Root,
        bundleDirectory: bundle.directory,
        publicKey: bundle.publicKey
      })

      expect(Object.keys(evidence)).toEqual(AllowedPublicEvidenceFields)
      expect(evidence).toMatchObject({
        dataVersion: 'r7.synthetic.signed-review.1',
        routeCount: 2,
        requiredCheckCount: 10,
        redactedAcceptanceStatus: 'review-passed'
      })
    } finally {
      bundle.remove()
    }
  })

  it('rejects unknown result fields through the closed contract', () => {
    const fixture = validateReviewFiles(Root).fixture

    expect(() =>
      validateReviewEvidence({ ...fixture, unexpected: true })
    ).toThrow('unexpected R7 signed bundle review evidence unexpected')
  })

  it('rejects a tampered Ed25519 signature or file hash', () => {
    const bundle = createAnonymousSignedBundle()
    try {
      const manifestPath = path.join(bundle.directory, 'manifest.json')
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<
        string,
        any
      >
      manifest.signature = Buffer.alloc(64).toString('base64')
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

      expect(() =>
        reviewSignedBundleEvidence({
          root: Root,
          bundleDirectory: bundle.directory,
          publicKey: bundle.publicKey
        })
      ).toThrow('data manifest signature verification failed')
    } finally {
      bundle.remove()
    }
  })

  it('rejects any route binding outside the fixed reviewed candidate', () => {
    const bundle = createAnonymousSignedBundle({
      mutateRoutes: (routes) => {
        routes[0].semanticDigest = `sha256:${'0'.repeat(64)}`
      }
    })
    try {
      expect(() =>
        reviewSignedBundleEvidence({
          root: Root,
          bundleDirectory: bundle.directory,
          publicKey: bundle.publicKey
        })
      ).toThrow('does not match a fixed reviewed route')
    } finally {
      bundle.remove()
    }
  })

  it('recomputes only the public fingerprint without emitting key bytes', () => {
    const bundle = createAnonymousSignedBundle()
    try {
      const evidence = reviewSignedBundleEvidence({
        root: Root,
        bundleDirectory: bundle.directory,
        publicKey: bundle.publicKey
      })
      const serialized = JSON.stringify(evidence)

      expect(evidence.publicKeySha256).toBe(`sha256:${sha256(bundle.publicKeyDer)}`)
      expect(serialized).not.toContain(bundle.publicKey)
      expect(serialized).not.toContain('publicKeyBytes')
    } finally {
      bundle.remove()
    }
  })

  it('rejects every prohibited secret, URL, path, raw, and signature field', () => {
    const fixture = validateReviewFiles(Root).fixture

    expect(ProhibitedOutputFields).toHaveLength(15)
    for (const field of ProhibitedOutputFields) {
      expect(() => validateReviewEvidence({ ...fixture, [field]: 'forbidden' })).toThrow(
        `unexpected R7 signed bundle review evidence ${field}`
      )
    }
  })

  it('keeps release author, reviewer, and staging operator distinct', () => {
    expect(validateRoleSeparation()).toBe(ReviewRoleContract)
    expect(new Set(Object.values(ReviewRoleContract)).size).toBe(3)
    expect(ReviewBoundary.privateKeyPersistenceAllowed).toBe(false)
  })

  it('accepts no URL, private-key, or endpoint CLI argument', () => {
    expect(() =>
      parseReviewArguments([
        '--bundle',
        'anonymous-bundle',
        '--public-key-file',
        'anonymous-public-key',
        '--manifest-url',
        'https://r7-staging.invalid/manifest.json'
      ])
    ).toThrow('unsupported argument: --manifest-url')
  })

  it('keeps protected communication and all execution gates closed', () => {
    expect(validateProtectedCommunicationDigests(Root)).toBe(true)
    expect(ReviewBoundary).toEqual({
      offlineOnly: true,
      privateKeyPersistenceAllowed: false,
      realReviewExecutionAuthorized: false,
      realPublicKeyOrFingerprintReviewAuthorized: false,
      externalEndpointConnectionAuthorized: false,
      stagingAcceptanceAuthorized: false,
      runtimePublicationAuthorized: false,
      defaultEnabled: false,
      runtimeEligibleCount: 0
    })
  })
})

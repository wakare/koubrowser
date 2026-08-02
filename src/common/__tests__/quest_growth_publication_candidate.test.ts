import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  publicationCandidateReviewSemanticDigest,
  validateCandidate,
  validatePublicationCandidateFiles,
  validateReview
} = require('../../../scripts/quest-growth-r7-publication-candidate.js') as {
  publicationCandidateReviewSemanticDigest: (value: Record<string, unknown>) => string
  validateCandidate: (
    value: Record<string, unknown>,
    routeCatalog: Record<string, unknown>,
    reviewTime: number
  ) => { value: Record<string, unknown>; canonicalDigest: string; routeCount: number }
  validatePublicationCandidateFiles: (root: string) => {
    candidate: {
      value: Record<string, unknown>
      canonicalDigest: string
      routeCount: number
    }
    review: {
      value: Record<string, unknown>
      semanticDigest: string
      requiredCheckCount: number
    }
  }
  validateReview: (
    value: Record<string, unknown>,
    candidate: { value: Record<string, unknown>; canonicalDigest: string; routeCount: number },
    root: string
  ) => { semanticDigest: string; requiredCheckCount: number }
}

const Root = process.cwd()
const CandidatePath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r7',
  'runtime-publication-candidate.json'
)
const ReviewPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'reviews',
  'r7-runtime-publication-candidate-review.json'
)
const CatalogPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r7',
  'route-catalog.json'
)

function read<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as T
}

describe('R7 runtime publication candidate', () => {
  it('validates the fixed unsigned candidate and owner review packet', () => {
    const result = validatePublicationCandidateFiles(Root)

    expect(result.candidate.canonicalDigest).toBe(
      'sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c'
    )
    expect(result.candidate.routeCount).toBe(2)
    expect(result.review.semanticDigest).toBe(
      'sha256:4e0d52638b60b90e2aec0bfdc9f9c2eaca500d4c32751245e649a5e43adac94c'
    )
    expect(result.review.requiredCheckCount).toBe(8)
    expect(result.review.value.status).toBe('owner-decision-required')
    expect(result.review.value.decision).toBeNull()
  })

  it('keeps review approval metadata outside the review semantic digest', () => {
    const review = read<Record<string, unknown> & {
      status: string
      decision: string | null
      review: Record<string, unknown>
    }>(ReviewPath)
    const approved = structuredClone(review)
    approved.status = 'approved'
    approved.decision = 'approved'
    approved.review.approver = 'project-owner'
    approved.review.reviewedAt = '2026-08-02T11:30:00.000Z'
    approved.review.approvalDigest = publicationCandidateReviewSemanticDigest(review)

    expect(publicationCandidateReviewSemanticDigest(approved)).toBe(
      publicationCandidateReviewSemanticDigest(review)
    )
  })

  it('rejects candidate field expansion', () => {
    const candidate = read<Record<string, unknown>>(CandidatePath)
    const catalog = read<Record<string, unknown>>(CatalogPath)
    const tampered = { ...candidate, signature: 'not-allowed' }

    expect(() =>
      validateCandidate(tampered, catalog, Date.parse('2026-08-02T10:55:16.725Z'))
    ).toThrow('unexpected R7 publication candidate signature')
  })

  it('rejects a withdrawn candidate binding', () => {
    const candidate = read<
      Record<string, unknown> & { routes: Array<Record<string, unknown>> }
    >(CandidatePath)
    const catalog = read<Record<string, unknown>>(CatalogPath)
    const tampered = structuredClone(candidate)
    tampered.routes[1].status = 'withdrawn'

    expect(() =>
      validateCandidate(tampered, catalog, Date.parse('2026-08-02T10:55:16.725Z'))
    ).toThrow('R7 publication candidate contract mismatch')
  })

  it('rejects reviewed route content drift', () => {
    const candidate = read<Record<string, unknown>>(CandidatePath)
    const catalog = read<
      Record<string, unknown> & { routes: Array<Record<string, unknown>> }
    >(CatalogPath)
    const tampered = structuredClone(catalog)
    tampered.routes[0].summary = 'changed'

    expect(() =>
      validateCandidate(candidate, tampered, Date.parse('2026-08-02T10:55:16.725Z'))
    ).toThrow('R7 publication candidate route drift')
  })

  it('rejects a review time outside route currentness', () => {
    const candidate = read<Record<string, unknown>>(CandidatePath)
    const catalog = read<Record<string, unknown>>(CatalogPath)

    expect(() =>
      validateCandidate(candidate, catalog, Date.parse('2026-10-01T00:00:00.000Z'))
    ).toThrow('R7 publication candidate route currentness expired')
  })

  it('rejects a non-independent reviewer packet', () => {
    const result = validatePublicationCandidateFiles(Root)
    const review = read<
      Record<string, unknown> & {
        review: Record<string, unknown>
        candidate: Record<string, unknown>
      }
    >(ReviewPath)
    const tampered = structuredClone(review)
    tampered.review.author = tampered.candidate.candidateAuthor

    expect(() => validateReview(tampered, result.candidate, Root)).toThrow(
      'R7 publication candidate independent review mismatch'
    )
  })

  it('rejects protected communication digest drift in the review basis', () => {
    const result = validatePublicationCandidateFiles(Root)
    const review = read<
      Record<string, unknown> & {
        evidenceBasis: { protectedCommunicationDigests: Record<string, string> }
      }
    >(ReviewPath)
    const tampered = structuredClone(review)
    tampered.evidenceBasis.protectedCommunicationDigests['src/main/kcbrowser.ts'] =
      'sha256:0000000000000000000000000000000000000000000000000000000000000000'

    expect(() => validateReview(tampered, result.candidate, Root)).toThrow(
      'R7 publication candidate evidence basis mismatch'
    )
  })
})

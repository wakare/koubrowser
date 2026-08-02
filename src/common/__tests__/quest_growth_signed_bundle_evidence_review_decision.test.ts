import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  buildR7SignedBundleEvidenceReviewDecisionArtifacts,
  signedBundleEvidenceReviewRequestSemanticDigest,
  validateR7SignedBundleEvidenceReviewAuthoringRequest
} = require('../../../scripts/quest-growth-r7-signed-bundle-evidence-review-decision.js') as {
  buildR7SignedBundleEvidenceReviewDecisionArtifacts: (options: {
    root: string
  }) => { artifacts: Record<string, Record<string, any>> }
  signedBundleEvidenceReviewRequestSemanticDigest: (
    value: Record<string, any>
  ) => string
  validateR7SignedBundleEvidenceReviewAuthoringRequest: (
    value: Record<string, any>,
    root: string
  ) => { semanticDigest: string }
}
const { buildQuestGrowthArtifacts } = require('../../../scripts/compile-quest-growth.js') as {
  buildQuestGrowthArtifacts: (root: string) => Record<string, Record<string, any>>
}

const Root = process.cwd()
const RequestPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'decisions',
  'r7-signed-bundle-evidence-review-authoring-request.json'
)

function request(): Record<string, any> {
  return JSON.parse(fs.readFileSync(RequestPath, 'utf8')) as Record<string, any>
}

describe('R7 signed bundle evidence review authoring decision', () => {
  it('produces the fixed owner-review semantic digest', () => {
    const result = validateR7SignedBundleEvidenceReviewAuthoringRequest(
      request(),
      Root
    )

    expect(result.semanticDigest).toBe(
      'sha256:eb599466cdcf580d6a4fabad4439a274ca483d5f1d6888f80f3d467ed4ce2080'
    )
  })

  it('records consumed authoring while keeping real review and publication unauthorized', () => {
    const result = buildR7SignedBundleEvidenceReviewDecisionArtifacts({ root: Root })
    const report =
      result.artifacts['r7-signed-bundle-evidence-review-authoring-report.json']

    expect(report).toMatchObject({
      status: 'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_AUTHORED_REAL_REVIEW_NOT_AUTHORIZED',
      authorizationState: 'consumed',
      authoringAuthorization: 'consumed',
      routeCount: 2,
      allowedPublicEvidenceFieldCount: 10,
      prohibitedOutputFieldCount: 15,
      requiredRoleCount: 3,
      requiredCheckCount: 10,
      realSignedBundleReviewed: false,
      realPublicKeyOrFingerprintReviewed: false,
      runtimeEligibleCount: 0,
      publicationAuthorization: 'R7_NOT_AUTHORIZED',
      defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED'
    })
  })

  it('rejects public key bytes or a URL in the approved output fields', () => {
    const value = request()
    value.reviewHarnessContract.allowedPublicEvidenceFields.push('publicKeyBytes')

    expect(signedBundleEvidenceReviewRequestSemanticDigest(value)).not.toBe(
      signedBundleEvidenceReviewRequestSemanticDigest(request())
    )
    expect(() =>
      validateR7SignedBundleEvidenceReviewAuthoringRequest(value, Root)
    ).toThrow('R7 signed bundle evidence review harness contract mismatch')
  })

  it('rejects allowing the reviewer to access the private key', () => {
    const value = request()
    value.roleSeparationContract.reviewerMayAccessPrivateKey = true

    expect(() =>
      validateR7SignedBundleEvidenceReviewAuthoringRequest(value, Root)
    ).toThrow('R7 signed bundle evidence review role separation mismatch')
  })

  it('integrates the implemented authoring decision into the compiler', () => {
    const artifacts = buildQuestGrowthArtifacts(Root)
    const sourceManifest = artifacts['source-manifest.json']
    const conflictReport = artifacts['conflict-and-gap-report.json']

    expect(sourceManifest.output).toMatchObject({
      r7SignedBundleEvidenceReviewOwnerDecisionRequired: false,
      r7SignedBundleEvidenceReviewAuthorizedNotImplemented: false,
      r7SignedBundleEvidenceReviewImplemented: true,
      r7SignedBundleEvidenceReviewExecuted: false,
      r7SignedBundleEvidenceReviewRequiredCheckCount: 10,
      r7SignedBundleEvidenceReviewAuthorizedPathCount: 4
    })
    expect(conflictReport.globalStops).toContain(
      'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_AUTHORED_REAL_REVIEW_NOT_AUTHORIZED'
    )
  })
})

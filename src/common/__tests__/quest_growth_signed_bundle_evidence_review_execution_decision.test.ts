import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  buildR7SignedBundleEvidenceReviewExecutionDecisionArtifacts,
  signedBundleEvidenceReviewExecutionSemanticDigest,
  validateR7SignedBundleEvidenceReviewExecutionRequest
} = require('../../../scripts/quest-growth-r7-signed-bundle-evidence-review-execution-decision.js') as {
  buildR7SignedBundleEvidenceReviewExecutionDecisionArtifacts: (options: {
    root: string
  }) => { artifacts: Record<string, Record<string, any>> }
  signedBundleEvidenceReviewExecutionSemanticDigest: (
    value: Record<string, any>
  ) => string
  validateR7SignedBundleEvidenceReviewExecutionRequest: (
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
  'r7-signed-bundle-evidence-review-execution-request.json'
)

function request(): Record<string, any> {
  return JSON.parse(fs.readFileSync(RequestPath, 'utf8')) as Record<string, any>
}

describe('R7 signed bundle evidence review execution decision', () => {
  it('produces the fixed execution semantic digest', () => {
    const result = validateR7SignedBundleEvidenceReviewExecutionRequest(
      request(),
      Root
    )

    expect(result.semanticDigest).toBe(
      'sha256:dad3d775d17865f0f8f78000af1adc8b1d204e0d820e483638cc0c202d10c177'
    )
  })

  it('requires an owner decision before a single offline review', () => {
    const result =
      buildR7SignedBundleEvidenceReviewExecutionDecisionArtifacts({ root: Root })
    const report =
      result.artifacts['r7-signed-bundle-evidence-review-execution-report.json']

    expect(report).toMatchObject({
      status: 'OWNER_DECISION_REQUIRED_R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_EXECUTION',
      authorizationState: 'not-authorized',
      executionAuthorization: 'not-authorized',
      maximumExecutions: 1,
      routeCount: 2,
      requiredInputCount: 2,
      allowedPublicEvidenceFieldCount: 10,
      prohibitedOutputFieldCount: 15,
      requiredCheckCount: 10,
      realSignedBundleReviewed: false,
      realPublicKeyOrFingerprintReviewed: false,
      runtimeEligibleCount: 0,
      publicationAuthorization: 'R7_NOT_AUTHORIZED'
    })
  })

  it('rejects widening the request to multiple executions', () => {
    const value = request()
    value.requestedAuthorization.maximumExecutions = 2

    expect(signedBundleEvidenceReviewExecutionSemanticDigest(value)).not.toBe(
      signedBundleEvidenceReviewExecutionSemanticDigest(request())
    )
    expect(() =>
      validateR7SignedBundleEvidenceReviewExecutionRequest(value, Root)
    ).toThrow('R7 signed bundle evidence review execution authorization mismatch')
  })

  it('rejects private-key handling by the reviewer', () => {
    const value = request()
    value.inputContract.privateKeyAllowed = true

    expect(() =>
      validateR7SignedBundleEvidenceReviewExecutionRequest(value, Root)
    ).toThrow('R7 signed bundle evidence review input contract mismatch')
  })

  it('integrates the pending execution decision into the compiler', () => {
    const artifacts = buildQuestGrowthArtifacts(Root)
    const sourceManifest = artifacts['source-manifest.json']
    const conflictReport = artifacts['conflict-and-gap-report.json']

    expect(sourceManifest.output).toMatchObject({
      r7SignedBundleEvidenceReviewExecutionOwnerDecisionRequired: true,
      r7SignedBundleEvidenceReviewExecutionAuthorized: false,
      r7SignedBundleEvidenceReviewExecutionConsumed: false,
      r7SignedBundleEvidenceReviewExecutionPassed: false,
      r7SignedBundleEvidenceReviewExecutionMaximumExecutions: 1,
      r7SignedBundleEvidenceReviewExecutionRequiredCheckCount: 10
    })
    expect(conflictReport.globalStops).toContain(
      'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_EXECUTION_OWNER_DECISION_REQUIRED'
    )
  })
})

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  buildR7SignedBundleEvidenceReviewResultRecordingDecisionArtifacts,
  recordingSemanticDigest,
  validateR7SignedBundleEvidenceReviewResultRecordingRequest
} = require('../../../scripts/quest-growth-r7-signed-bundle-evidence-review-result-recording-decision.js') as {
  buildR7SignedBundleEvidenceReviewResultRecordingDecisionArtifacts: (options: {
    root: string
  }) => { artifacts: Record<string, Record<string, any>> }
  recordingSemanticDigest: (value: Record<string, any>) => string
  validateR7SignedBundleEvidenceReviewResultRecordingRequest: (
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
  'r7-signed-bundle-evidence-review-result-recording-request.json'
)

function request(): Record<string, any> {
  return JSON.parse(fs.readFileSync(RequestPath, 'utf8')) as Record<string, any>
}

describe('R7 signed bundle evidence review result recording decision', () => {
  it('produces a stable semantic digest for the fixed recording request', () => {
    const result = validateR7SignedBundleEvidenceReviewResultRecordingRequest(
      request(),
      Root
    )

    expect(result.semanticDigest).toBe(
      'sha256:2f0dd74cbb96f119f89bd048b54a6fc98e19a3dd3db95ef8cab69e227cfd555d'
    )
  })

  it('requires owner approval without persisting the observed result', () => {
    const result =
      buildR7SignedBundleEvidenceReviewResultRecordingDecisionArtifacts({
        root: Root
      })
    const report =
      result.artifacts[
        'r7-signed-bundle-evidence-review-result-recording-report.json'
      ]

    expect(report).toMatchObject({
      status:
        'OWNER_DECISION_REQUIRED_R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_RESULT_RECORDING',
      authorizationState: 'not-authorized',
      resultRecordingAuthorization: 'not-authorized',
      maximumRecords: 1,
      completedExecutionCount: 1,
      recordedResultCount: 0,
      allowedPublicEvidenceFieldCount: 10,
      prohibitedRecordFieldCount: 15,
      authorizedRepositoryPathCount: 4,
      requiredCheckCount: 10,
      executionRerunAuthorized: false,
      inputRereadAuthorized: false,
      runtimeEligibleCount: 0
    })
  })

  it('rejects review reruns and input rereads', () => {
    const rerun = request()
    rerun.requestedAuthorization.executionRerunAuthorized = true
    expect(recordingSemanticDigest(rerun)).not.toBe(
      recordingSemanticDigest(request())
    )
    expect(() =>
      validateR7SignedBundleEvidenceReviewResultRecordingRequest(rerun, Root)
    ).toThrow('R7 signed bundle review result recording authorization mismatch')

    const reread = request()
    reread.recordingContract.bundleOrPublicKeyReadAllowed = true
    expect(() =>
      validateR7SignedBundleEvidenceReviewResultRecordingRequest(reread, Root)
    ).toThrow('R7 signed bundle review result recording contract mismatch')
  })

  it('integrates the pending recording decision into the compiler', () => {
    const artifacts = buildQuestGrowthArtifacts(Root)
    const sourceManifest = artifacts['source-manifest.json']
    const conflictReport = artifacts['conflict-and-gap-report.json']

    expect(sourceManifest.output).toMatchObject({
      r7SignedBundleEvidenceReviewResultRecordingOwnerDecisionRequired: true,
      r7SignedBundleEvidenceReviewResultRecordingAuthorized: false,
      r7SignedBundleEvidenceReviewResultRecorded: false,
      r7SignedBundleEvidenceReviewResultRecordingMaximumRecords: 1,
      r7SignedBundleEvidenceReviewResultRecordingAllowedFieldCount: 10
    })
    expect(conflictReport.globalStops).toContain(
      'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_RESULT_RECORDING_OWNER_DECISION_REQUIRED'
    )
  })
})

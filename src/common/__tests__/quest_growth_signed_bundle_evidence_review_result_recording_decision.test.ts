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
      'sha256:74a0e6dbe0b9e0d00214c6b82fb651e8b15b77bb0ad25ef9773b5a13bdddbd01'
    )
  })

  it('records the approved result without authorizing a rerun', () => {
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
        'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_RESULT_RECORDED',
      authorizationState: 'consumed',
      resultRecordingAuthorization: 'consumed',
      maximumRecords: 1,
      completedExecutionCount: 1,
      recordedResultCount: 1,
      allowedPublicEvidenceFieldCount: 10,
      prohibitedRecordFieldCount: 15,
      authorizedRepositoryPathCount: 4,
      requiredCheckCount: 10,
      executionRerunAuthorized: false,
      inputRereadAuthorized: false,
      runtimeEligibleCount: 0,
      publicationAuthorization: 'R7_NOT_AUTHORIZED',
      defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED',
      recordedResult: {
        dataVersion: 'r7.20260802.1',
        routeCount: 2,
        requiredCheckCount: 10,
        redactedAcceptanceStatus: 'review-passed'
      }
    })
    expect(Object.keys(report.recordedResult)).toHaveLength(10)
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
      r7SignedBundleEvidenceReviewResultRecordingOwnerDecisionRequired: false,
      r7SignedBundleEvidenceReviewResultRecordingAuthorized: true,
      r7SignedBundleEvidenceReviewResultRecorded: true,
      r7SignedBundleEvidenceReviewResultRecordingMaximumRecords: 1,
      r7SignedBundleEvidenceReviewResultRecordingAllowedFieldCount: 10,
      r7SignedBundleEvidenceReviewExecutionOwnerDecisionRequired: false,
      r7SignedBundleEvidenceReviewExecutionAuthorized: true,
      r7SignedBundleEvidenceReviewExecutionConsumed: true,
      r7SignedBundleEvidenceReviewExecutionPassed: true
    })
    expect(conflictReport.globalStops).not.toContain(
      'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_RESULT_RECORDING_OWNER_DECISION_REQUIRED'
    )
    expect(conflictReport.globalStops).not.toContain(
      'R7_SIGNED_BUNDLE_EVIDENCE_REVIEW_EXECUTION_OWNER_DECISION_REQUIRED'
    )
  })
})

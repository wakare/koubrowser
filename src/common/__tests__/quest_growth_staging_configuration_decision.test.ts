import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  buildR7StagingConfigurationDecisionArtifacts,
  stagingConfigurationRequestSemanticDigest,
  validateR7StagingConfigurationAuthoringRequest
} = require('../../../scripts/quest-growth-r7-staging-configuration-decision.js') as {
  buildR7StagingConfigurationDecisionArtifacts: (options: { root: string }) => {
    artifacts: Record<string, Record<string, any>>
    output: Record<string, unknown>
  }
  stagingConfigurationRequestSemanticDigest: (value: Record<string, any>) => string
  validateR7StagingConfigurationAuthoringRequest: (
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
  'r7-staging-configuration-authoring-request.json'
)

function request(): Record<string, any> {
  return JSON.parse(fs.readFileSync(RequestPath, 'utf8')) as Record<string, any>
}

describe('R7 staging configuration authoring decision', () => {
  it('fixes the authored draft to the owner-review semantic digest', () => {
    const result = validateR7StagingConfigurationAuthoringRequest(request(), Root)

    expect(result.semanticDigest).toBe(
      'sha256:3873731e2d84a85dde4685da9625fe2e4ed072f41c0de8973fa5c94e7e8cec93'
    )
  })

  it('reports an owner fixed-digest decision without publication authorization', () => {
    const result = buildR7StagingConfigurationDecisionArtifacts({ root: Root })
    const report = result.artifacts['r7-staging-configuration-authoring-report.json']

    expect(report).toMatchObject({
      status: 'R7_STAGING_CONFIGURATION_DRAFTED_OWNER_FIXED_DIGEST_REQUIRED',
      ownerReviewStatus: 'fixed-semantic-digest-required',
      routeCount: 2,
      requiredCheckCount: 9,
      fullTestCount: 1259,
      keyMaterialPresent: false,
      externalConnectionAuthorized: false,
      runtimeEligibleCount: 0,
      publicationAuthorization: 'R7_NOT_AUTHORIZED',
      defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED'
    })
  })

  it('rejects widening the placeholder to a real endpoint', () => {
    const value = request()
    value.configurationContract.placeholderManifestUrl =
      'https://updates.example/data/manifest.json'

    expect(stagingConfigurationRequestSemanticDigest(value)).not.toBe(
      stagingConfigurationRequestSemanticDigest(request())
    )
    expect(() => validateR7StagingConfigurationAuthoringRequest(value, Root)).toThrow(
      'R7 staging configuration contract mismatch'
    )
  })

  it('rejects owner approval metadata before the fixed digest is approved', () => {
    const value = request()
    value.review.approver = 'project-owner'
    value.review.reviewedAt = '2026-08-02T12:00:00.000Z'
    value.review.approvalDigest = stagingConfigurationRequestSemanticDigest(value)

    expect(() => validateR7StagingConfigurationAuthoringRequest(value, Root)).toThrow(
      'draft R7 staging configuration must not claim owner approval'
    )
  })

  it('integrates the pending staging gate into the authoring manifest', () => {
    const artifacts = buildQuestGrowthArtifacts(Root)
    const sourceManifest = artifacts['source-manifest.json']
    const conflictReport = artifacts['conflict-and-gap-report.json']

    expect(sourceManifest.output).toMatchObject({
      r7StagingConfigurationOwnerDecisionRequired: true,
      r7StagingConfigurationDrafted: true,
      r7StagingConfigurationRequiredCheckCount: 9,
      r7StagingConfigurationRouteCount: 2
    })
    expect(conflictReport.globalStops).toContain(
      'R7_STAGING_CONFIGURATION_OWNER_FIXED_DIGEST_REQUIRED'
    )
  })
})

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  buildR7StagingEvidenceDecisionArtifacts,
  stagingEvidenceRequestSemanticDigest,
  validateR7StagingEvidenceAuthoringRequest
} = require('../../../scripts/quest-growth-r7-staging-evidence-decision.js') as {
  buildR7StagingEvidenceDecisionArtifacts: (options: { root: string }) => {
    artifacts: Record<string, Record<string, any>>
  }
  stagingEvidenceRequestSemanticDigest: (value: Record<string, any>) => string
  validateR7StagingEvidenceAuthoringRequest: (
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
  'r7-staging-evidence-authoring-request.json'
)

function request(): Record<string, any> {
  return JSON.parse(fs.readFileSync(RequestPath, 'utf8')) as Record<string, any>
}

describe('R7 staging evidence authoring decision', () => {
  it('produces the fixed owner-review semantic digest', () => {
    const result = validateR7StagingEvidenceAuthoringRequest(request(), Root)

    expect(result.semanticDigest).toBe(
      'sha256:17bb4894a614e0f07157a3aa38a956d3d86b586a134fb2e301a249da4e4b63b3'
    )
  })

  it('records consumed evidence authoring while all execution stays unauthorized', () => {
    const result = buildR7StagingEvidenceDecisionArtifacts({ root: Root })
    const report = result.artifacts['r7-staging-evidence-authoring-report.json']

    expect(report).toMatchObject({
      status: 'R7_STAGING_EVIDENCE_AUTHORED_REAL_EVIDENCE_NOT_AUTHORIZED',
      authorizationState: 'consumed',
      authoringAuthorization: 'consumed',
      routeCount: 2,
      requiredRoleCount: 3,
      requiredCheckCount: 10,
      keyMaterialPresent: false,
      realEndpointPresent: false,
      runtimeEligibleCount: 0,
      publicationAuthorization: 'R7_NOT_AUTHORIZED',
      defaultEnablementAuthorization: 'R7_NOT_AUTHORIZED'
    })
  })

  it('rejects adding a raw public key to allowed evidence', () => {
    const value = request()
    value.evidenceContract.allowedPublicEvidenceFields.push('publicKeyBytes')

    expect(stagingEvidenceRequestSemanticDigest(value)).not.toBe(
      stagingEvidenceRequestSemanticDigest(request())
    )
    expect(() => validateR7StagingEvidenceAuthoringRequest(value, Root)).toThrow(
      'R7 staging evidence contract mismatch'
    )
  })

  it('rejects collapsing the independent roles', () => {
    const value = request()
    value.roleSeparationContract.allRolesMustBeDistinct = false

    expect(() => validateR7StagingEvidenceAuthoringRequest(value, Root)).toThrow(
      'R7 staging evidence role separation mismatch'
    )
  })

  it('integrates the implemented authoring gate into the compiler', () => {
    const artifacts = buildQuestGrowthArtifacts(Root)
    const sourceManifest = artifacts['source-manifest.json']
    const conflictReport = artifacts['conflict-and-gap-report.json']

    expect(sourceManifest.output).toMatchObject({
      r7StagingEvidenceOwnerDecisionRequired: false,
      r7StagingEvidenceAuthorizedNotImplemented: false,
      r7StagingEvidenceImplemented: true,
      r7StagingEvidenceRequiredCheckCount: 10,
      r7StagingEvidenceAuthorizedPathCount: 4
    })
    expect(conflictReport.globalStops).toContain(
      'R7_STAGING_EVIDENCE_AUTHORED_REAL_EVIDENCE_NOT_AUTHORIZED'
    )
  })
})

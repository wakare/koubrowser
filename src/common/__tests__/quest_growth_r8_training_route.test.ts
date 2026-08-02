import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { routeSemanticDigest } = require('../../../scripts/quest-growth-r8-eo-route.js') as {
  routeSemanticDigest: (route: Record<string, any>) => string
}
const { buildR8TrainingRouteArtifacts, validateTrainingCatalog, validateTrainingEvidence } =
  require('../../../scripts/quest-growth-r8-training-route.js') as {
    buildR8TrainingRouteArtifacts: (options: { root: string }) => {
      artifacts: Record<string, Record<string, any>>
    }
    validateTrainingCatalog: (
      catalog: Record<string, any>,
      evidence: Record<string, any>,
      lineages: Record<string, any>,
      units: Record<string, any>
    ) => Record<string, any>
    validateTrainingEvidence: (value: Record<string, any>) => Record<string, any>
  }

const Root = process.cwd()
const CatalogPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r8',
  'training-route-catalog.json'
)
const EvidencePath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r8',
  'training-evidence-snapshots.json'
)
const LineagesPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'authoring',
  'route-lineages.json'
)
const UnitsPath = path.join(Root, 'knowledge', 'quest-growth', 'authoring', 'route-units.json')

function readJson(filePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>
}

describe('R8 practice, remodel and modernization route', () => {
  it('binds all three manual segments to the R6 lineage and claim-level independent evidence', () => {
    const result = validateTrainingCatalog(
      readJson(CatalogPath),
      validateTrainingEvidence(readJson(EvidencePath)),
      readJson(LineagesPath),
      readJson(UnitsPath)
    )

    expect(result.route).toMatchObject({
      routeId: 'route:practice-remodel-modernization-loop:draft-1',
      routeFamily: 'experience-remodel-modernization',
      status: 'reviewed',
      outputClass: 'manual-check-route'
    })
    expect(
      result.route.segments.map((segment: Record<string, any>) => segment.actionCategory)
    ).toEqual(['training', 'remodel', 'modernization'])
    expect(
      result.route.segments.every(
        (segment: Record<string, any>) =>
          new Set(
            segment.concreteEvidenceRefs.map(
              (reference: Record<string, any>) => reference.independenceGroupId
            )
          ).size === 2
      )
    ).toBe(true)
    expect(routeSemanticDigest(result.route)).toBe(result.route.review.approvalDigest)
  })

  it('keeps the route bundled, opt-in, session-only and runtime-ineligible', () => {
    const report = buildR8TrainingRouteArtifacts({ root: Root }).artifacts[
      'r8-training-route-validation-report.json'
    ]

    expect(report).toMatchObject({
      status: 'R8_TRAINING_BUNDLED_OPT_IN_ROUTE_REVIEWED',
      reviewedRouteCount: 1,
      evidenceSourceCount: 3,
      independentEvidenceGroupCount: 2,
      defaultVisible: false,
      sessionOnly: true,
      runtimePublicationAuthorized: false,
      runtimeEligibleCount: 0
    })
  })

  it('fails closed on segment drift, claim drift and missing evidence', () => {
    const evidence = validateTrainingEvidence(readJson(EvidencePath))
    const catalog = readJson(CatalogPath)
    catalog.routes[0].segments[2].actionCategory = 'training'
    expect(() =>
      validateTrainingCatalog(catalog, evidence, readJson(LineagesPath), readJson(UnitsPath))
    ).toThrow('R8 training segment 2 mechanic binding mismatch')

    const claimDrift = readJson(CatalogPath)
    claimDrift.routes[0].segments[0].concreteEvidenceRefs[1].claimRef =
      'claim:modernization-before-after-remodel'
    expect(() =>
      validateTrainingCatalog(claimDrift, evidence, readJson(LineagesPath), readJson(UnitsPath))
    ).toThrow('R8 training evidence reference mismatch')

    const missingSource = readJson(EvidencePath)
    missingSource.sources.pop()
    expect(() => validateTrainingEvidence(missingSource)).toThrow(
      'R8 training route requires exactly three evidence sources'
    )
  })
})

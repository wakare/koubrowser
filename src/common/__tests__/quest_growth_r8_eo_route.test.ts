import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  buildR8EoRouteArtifacts,
  routeSemanticDigest,
  validateCatalog,
  validateEvidence
} = require('../../../scripts/quest-growth-r8-eo-route.js') as {
  buildR8EoRouteArtifacts: (options: { root: string }) => {
    artifacts: Record<string, Record<string, any>>
  }
  routeSemanticDigest: (route: Record<string, any>) => string
  validateCatalog: (
    catalog: Record<string, any>,
    evidence: Record<string, any>,
    lineages: Record<string, any>
  ) => Record<string, any>
  validateEvidence: (value: Record<string, any>) => Record<string, any>
}

const Root = process.cwd()
const CatalogPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r8',
  'route-catalog.json'
)
const EvidencePath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r8',
  'evidence-snapshots.json'
)
const LineagesPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'authoring',
  'route-lineages.json'
)

function readJson(filePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>
}

describe('R8 monthly 1-5 EO route', () => {
  it('binds the reviewed route to two independent current sources', () => {
    const catalog = readJson(CatalogPath)
    const evidence = validateEvidence(readJson(EvidencePath))
    const result = validateCatalog(catalog, evidence, readJson(LineagesPath))

    expect(result.route).toMatchObject({
      routeId: 'route:1-5-monthly-eo-medal-loop:draft-1',
      routeFamily: 'normal-map-eo-blueprint-loop',
      status: 'reviewed',
      outputClass: 'manual-check-route'
    })
    expect(result.route.segments[0].concreteEvidenceRefs).toHaveLength(2)
    expect(
      new Set(
        result.route.segments[0].concreteEvidenceRefs.map(
          (reference: { independenceGroupId: string }) => reference.independenceGroupId
        )
      ).size
    ).toBe(2)
    expect(routeSemanticDigest(result.route)).toBe(result.route.review.approvalDigest)
  })

  it('keeps the new route bundled, opt-in, session-only and runtime-ineligible', () => {
    const result = buildR8EoRouteArtifacts({ root: Root })
    const report = result.artifacts['r8-eo-route-validation-report.json']

    expect(report).toMatchObject({
      status: 'R8_EO_BUNDLED_OPT_IN_ROUTE_REVIEWED',
      reviewedRouteCount: 1,
      evidenceSourceCount: 2,
      independentEvidenceGroupCount: 2,
      defaultVisible: false,
      sessionOnly: true,
      runtimePublicationAuthorized: false,
      runtimeEligibleCount: 0
    })
  })

  it('fails closed on route drift and single-source evidence', () => {
    const catalog = readJson(CatalogPath)
    catalog.routes[0].segments[0].targetNodes = ['A', 'D', 'F', 'J']
    expect(() =>
      validateCatalog(catalog, validateEvidence(readJson(EvidencePath)), readJson(LineagesPath))
    ).toThrow('R8 EO segment mechanic binding mismatch')

    const evidence = readJson(EvidencePath)
    evidence.sources.pop()
    expect(() => validateEvidence(evidence)).toThrow(
      'R8 EO route requires exactly two evidence sources'
    )
  })
})

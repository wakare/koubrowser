import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { routeSemanticDigest } = require('../../../scripts/quest-growth-r8-eo-route.js') as {
  routeSemanticDigest: (route: Record<string, any>) => string
}
const {
  buildR8SurfaceRouteArtifacts,
  validateSurfaceCatalog,
  validateSurfaceEvidence
} = require('../../../scripts/quest-growth-r8-surface-route.js') as {
  buildR8SurfaceRouteArtifacts: (options: { root: string }) => {
    artifacts: Record<string, Record<string, any>>
  }
  validateSurfaceCatalog: (
    catalog: Record<string, any>,
    evidence: Record<string, any>,
    lineages: Record<string, any>,
    units: Record<string, any>
  ) => Record<string, any>
  validateSurfaceEvidence: (value: Record<string, any>) => Record<string, any>
}

const Root = process.cwd()
const CatalogPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r8',
  'surface-route-catalog.json'
)
const EvidencePath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r8',
  'surface-evidence-snapshots.json'
)
const LineagesPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'authoring',
  'route-lineages.json'
)
const UnitsPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'authoring',
  'route-units.json'
)

function readJson(filePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>
}

describe('R8 2-1 surface and air foundation route', () => {
  it('binds the reviewed route to its R6 lineage and two independent sources', () => {
    const result = validateSurfaceCatalog(
      readJson(CatalogPath),
      validateSurfaceEvidence(readJson(EvidencePath)),
      readJson(LineagesPath),
      readJson(UnitsPath)
    )

    expect(result.route).toMatchObject({
      routeId: 'route:2-1-surface-air-baseline:draft-1',
      routeFamily: 'surface-air-los-foundation',
      status: 'reviewed',
      outputClass: 'manual-check-route'
    })
    expect(result.route.segments[0]).toMatchObject({
      mapKey: '2-1',
      targetNodes: ['C', 'D/E', 'H'],
      formations: ['line-ahead'],
      airState: 'air-superiority-81-with-margin-manual-check'
    })
    expect(result.route.segments[0].concreteEvidenceRefs).toHaveLength(2)
    expect(routeSemanticDigest(result.route)).toBe(result.route.review.approvalDigest)
  })

  it('keeps the route bundled, opt-in, session-only and runtime-ineligible', () => {
    const report = buildR8SurfaceRouteArtifacts({ root: Root }).artifacts[
      'r8-surface-route-validation-report.json'
    ]

    expect(report).toMatchObject({
      status: 'R8_SURFACE_BUNDLED_OPT_IN_ROUTE_REVIEWED',
      reviewedRouteCount: 1,
      evidenceSourceCount: 2,
      independentEvidenceGroupCount: 2,
      defaultVisible: false,
      sessionOnly: true,
      runtimePublicationAuthorized: false,
      runtimeEligibleCount: 0
    })
  })

  it('fails closed on air threshold drift and single-source evidence', () => {
    const catalog = readJson(CatalogPath)
    catalog.routes[0].segments[0].airState = 'air-superiority-72'
    expect(() =>
      validateSurfaceCatalog(
        catalog,
        validateSurfaceEvidence(readJson(EvidencePath)),
        readJson(LineagesPath),
        readJson(UnitsPath)
      )
    ).toThrow('R8 surface segment mechanic binding mismatch')

    const evidence = readJson(EvidencePath)
    evidence.sources.pop()
    expect(() => validateSurfaceEvidence(evidence)).toThrow(
      'R8 surface route requires exactly two evidence sources'
    )
  })
})

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { routeSemanticDigest } = require('../../../scripts/quest-growth-r8-eo-route.js') as {
  routeSemanticDigest: (route: Record<string, any>) => string
}
const {
  buildR8UnlockRouteArtifacts,
  validateUnlockCatalog,
  validateUnlockEvidence
} = require('../../../scripts/quest-growth-r8-unlock-route.js') as {
  buildR8UnlockRouteArtifacts: (options: { root: string }) => {
    artifacts: Record<string, Record<string, any>>
  }
  validateUnlockCatalog: (
    catalog: Record<string, any>,
    evidence: Record<string, any>,
    lineages: Record<string, any>,
    units: Record<string, any>
  ) => Record<string, any>
  validateUnlockEvidence: (value: Record<string, any>) => Record<string, any>
}

const Root = process.cwd()
const CatalogPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r8',
  'unlock-route-catalog.json'
)
const EvidencePath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r8',
  'unlock-evidence-snapshots.json'
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

describe('R8 fleet unlock quest-chain route', () => {
  it('binds the three fixed segments to the R6 lineage and independent sources', () => {
    const result = validateUnlockCatalog(
      readJson(CatalogPath),
      validateUnlockEvidence(readJson(EvidencePath)),
      readJson(LineagesPath),
      readJson(UnitsPath)
    )

    expect(result.route).toMatchObject({
      routeId: 'route:fleet-2-4-unlock-chain:draft-1',
      routeFamily: 'system-fleet-unlock',
      status: 'reviewed',
      outputClass: 'manual-check-route'
    })
    expect(result.route.segments.map((segment: Record<string, any>) => segment.targetNodes)).toEqual([
      ['A1', 'A2', 'A3', 'A4'],
      ['A5', 'A7', 'A14'],
      ['A15', 'A16']
    ])
    expect(
      result.route.segments.every(
        (segment: Record<string, any>) => segment.concreteEvidenceRefs.length === 2
      )
    ).toBe(true)
    expect(routeSemanticDigest(result.route)).toBe(result.route.review.approvalDigest)
  })

  it('keeps the route bundled, opt-in, session-only and runtime-ineligible', () => {
    const report = buildR8UnlockRouteArtifacts({ root: Root }).artifacts[
      'r8-unlock-route-validation-report.json'
    ]

    expect(report).toMatchObject({
      status: 'R8_UNLOCK_BUNDLED_OPT_IN_ROUTE_REVIEWED',
      reviewedRouteCount: 1,
      evidenceSourceCount: 2,
      independentEvidenceGroupCount: 2,
      defaultVisible: false,
      sessionOnly: true,
      runtimePublicationAuthorized: false,
      runtimeEligibleCount: 0
    })
  })

  it('fails closed on quest order drift and single-source evidence', () => {
    const catalog = readJson(CatalogPath)
    catalog.routes[0].segments[1].targetNodes = ['A5', 'A14']
    expect(() =>
      validateUnlockCatalog(
        catalog,
        validateUnlockEvidence(readJson(EvidencePath)),
        readJson(LineagesPath),
        readJson(UnitsPath)
      )
    ).toThrow('R8 unlock segment 1 mechanic binding mismatch')

    const evidence = readJson(EvidencePath)
    evidence.sources.pop()
    expect(() => validateUnlockEvidence(evidence)).toThrow(
      'R8 unlock route requires exactly two evidence sources'
    )
  })
})

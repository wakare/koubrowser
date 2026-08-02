import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import {
  QuestGrowthReviewedRouteCatalog,
  selectQuestGrowthReviewedRoutes,
  setQuestGrowthRuntimeRouteUpdate,
  validateQuestGrowthRuntimeRouteUpdate,
  type QuestGrowthRuntimeRouteUpdate
} from '../quest_growth_reviewed_routes'

const require = createRequire(import.meta.url)
const { routeReviewSemanticDigest } = require('../../../scripts/quest-growth-r7-route-review-decision.js') as {
  routeReviewSemanticDigest: (value: Record<string, unknown>) => string
}
const ReviewedAt = new Date('2026-08-02T02:07:16.639Z')

function runtimeUpdate(
  statuses: Partial<Record<string, 'reviewed' | 'withdrawn'>> = {}
): QuestGrowthRuntimeRouteUpdate {
  return {
    schemaVersion: 1,
    version: 'signed-growth-routes-1',
    publicationAuthorization: 'R7_RUNTIME_SIGNED_CANDIDATE',
    routes: QuestGrowthReviewedRouteCatalog.routes.map((route) => ({
      routeId: route.routeId,
      routeFamily: route.routeFamily,
      revision: route.revision,
      semanticDigest: route.review.approvalDigest!,
      status: statuses[route.routeId] ?? 'reviewed'
    }))
  }
}

afterEach(() => {
  setQuestGrowthRuntimeRouteUpdate(null)
})

describe('reviewed quest growth routes', () => {
  it('selects exactly one reviewed manual-check route for each approved focus', () => {
    const resources = selectQuestGrowthReviewedRoutes('resources', ReviewedAt)
    const asw = selectQuestGrowthReviewedRoutes('asw', ReviewedAt)

    expect(resources.state).toBe('available')
    expect(resources.routes).toHaveLength(1)
    expect(resources.routes[0]).toMatchObject({
      routeFamily: 'expedition-resource-periodic-loop',
      status: 'reviewed',
      outputClass: 'manual-check-route'
    })
    expect(asw.state).toBe('available')
    expect(asw.routes).toHaveLength(1)
    expect(asw.routes[0].routeFamily).toBe('anti-submarine-foundation')
  })

  it('keeps every route bound to its independently approved semantic digest', () => {
    expect(QuestGrowthReviewedRouteCatalog.routes).toHaveLength(2)
    for (const route of QuestGrowthReviewedRouteCatalog.routes) {
      expect(routeReviewSemanticDigest(route as unknown as Record<string, unknown>)).toBe(
        route.review.approvalDigest
      )
      expect(route.review.approver).toBe('project-owner')
      expect(route.review.author).not.toBe(route.review.approver)
    }
  })

  it('does not display a route until an approved focus is selected', () => {
    expect(selectQuestGrowthReviewedRoutes('unset', ReviewedAt)).toEqual({
      state: 'select-focus',
      routes: []
    })
    expect(selectQuestGrowthReviewedRoutes('surface', ReviewedAt)).toEqual({
      state: 'select-focus',
      routes: []
    })
  })

  it('fails closed on status, digest, currentness, and route-count changes', () => {
    const statusChanged = structuredClone(QuestGrowthReviewedRouteCatalog)
    statusChanged.routes[0].status = 'draft'
    expect(selectQuestGrowthReviewedRoutes('resources', ReviewedAt, statusChanged).state).toBe(
      'knowledge-review-required'
    )

    const digestChanged = structuredClone(QuestGrowthReviewedRouteCatalog)
    digestChanged.routes[0].review.approvalDigest = 'sha256:'.padEnd(71, '0')
    expect(selectQuestGrowthReviewedRoutes('resources', ReviewedAt, digestChanged).state).toBe(
      'knowledge-review-required'
    )

    expect(
      selectQuestGrowthReviewedRoutes('asw', new Date('2026-09-30T00:00:00.000Z')).state
    ).toBe('knowledge-review-required')

    const extraRoute = structuredClone(QuestGrowthReviewedRouteCatalog)
    extraRoute.routes.push(structuredClone(extraRoute.routes[0]))
    expect(selectQuestGrowthReviewedRoutes('resources', ReviewedAt, extraRoute).state).toBe(
      'knowledge-review-required'
    )
  })

  it('contains no account identifier or runtime publication authorization', () => {
    const serialized = JSON.stringify(QuestGrowthReviewedRouteCatalog)
    expect(QuestGrowthReviewedRouteCatalog.publicationAuthorization).toBe('R7_NOT_AUTHORIZED')
    expect(serialized).not.toMatch(/api_member|accountId|cookie|token|rawPayload/i)
  })

  it('accepts only the two fixed reviewed bindings from a signed candidate', () => {
    const update = runtimeUpdate()

    expect(validateQuestGrowthRuntimeRouteUpdate(update)).toEqual(update)
    setQuestGrowthRuntimeRouteUpdate(update)
    expect(selectQuestGrowthReviewedRoutes('resources', ReviewedAt).state).toBe('available')
    expect(selectQuestGrowthReviewedRoutes('asw', ReviewedAt).state).toBe('available')
  })

  it('uses a newer signed withdrawal instead of falling back to an older route', () => {
    setQuestGrowthRuntimeRouteUpdate(
      runtimeUpdate({ 'route:1-5-basic-asw-three-battle:draft-1': 'withdrawn' })
    )

    expect(selectQuestGrowthReviewedRoutes('resources', ReviewedAt).state).toBe('available')
    expect(selectQuestGrowthReviewedRoutes('asw', ReviewedAt)).toEqual({
      state: 'knowledge-review-required',
      routes: []
    })
  })

  it('restores the bundled opt-in catalog when no signed route update is active', () => {
    setQuestGrowthRuntimeRouteUpdate(
      runtimeUpdate({ 'route:expedition-05-resource-loop:draft-1': 'withdrawn' })
    )
    expect(selectQuestGrowthReviewedRoutes('resources', ReviewedAt).state).toBe(
      'knowledge-review-required'
    )

    setQuestGrowthRuntimeRouteUpdate(null)
    expect(selectQuestGrowthReviewedRoutes('resources', ReviewedAt).state).toBe('available')
  })

  it('rejects draft, digest-mismatched, unknown-version and unknown-field updates', () => {
    const draft = structuredClone(runtimeUpdate()) as unknown as {
      routes: { status: string }[]
    }
    draft.routes[0].status = 'draft'
    expect(() => validateQuestGrowthRuntimeRouteUpdate(draft)).toThrow(
      'does not match a fixed reviewed route'
    )

    const digestMismatch = structuredClone(runtimeUpdate()) as unknown as {
      routes: { semanticDigest: string }[]
    }
    digestMismatch.routes[0].semanticDigest = 'sha256:'.padEnd(71, '0')
    expect(() => validateQuestGrowthRuntimeRouteUpdate(digestMismatch)).toThrow(
      'does not match a fixed reviewed route'
    )

    const unknownVersion = { ...runtimeUpdate(), schemaVersion: 2 }
    expect(() => validateQuestGrowthRuntimeRouteUpdate(unknownVersion)).toThrow(
      'invalid quest growth route update'
    )

    const unknownField = { ...runtimeUpdate(), executable: 'alert(1)' }
    expect(() => validateQuestGrowthRuntimeRouteUpdate(unknownField)).toThrow(
      'unsupported or missing fields'
    )
  })
})

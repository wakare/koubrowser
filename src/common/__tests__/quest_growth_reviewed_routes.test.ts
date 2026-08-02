import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  QuestGrowthReviewedRouteCatalog,
  selectQuestGrowthReviewedRoutes
} from '../quest_growth_reviewed_routes'

const require = createRequire(import.meta.url)
const { routeReviewSemanticDigest } = require('../../../scripts/quest-growth-r7-route-review-decision.js') as {
  routeReviewSemanticDigest: (value: Record<string, unknown>) => string
}
const ReviewedAt = new Date('2026-08-02T02:07:16.639Z')

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
})

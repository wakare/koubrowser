import { describe, expect, it } from 'vitest'
import {
  QuestGrowthR8EoRouteCatalog,
  QuestGrowthR8SurfaceRouteCatalog,
  QuestGrowthR8UnlockRouteCatalog,
  selectQuestGrowthRecommendedRoutes
} from '../quest_growth_recommended_routes'

const ReviewedAt = new Date('2026-08-15T00:00:00.000Z')

describe('quest growth recommended routes', () => {
  it('keeps the existing R7 resources and ASW selections available', () => {
    expect(selectQuestGrowthRecommendedRoutes('resources', ReviewedAt)).toMatchObject({
      state: 'available',
      routes: [{ routeFamily: 'expedition-resource-periodic-loop' }]
    })
    expect(selectQuestGrowthRecommendedRoutes('asw', ReviewedAt)).toMatchObject({
      state: 'available',
      routes: [{ routeFamily: 'anti-submarine-foundation' }]
    })
  })

  it('selects the reviewed bundled EO route without widening runtime publication', () => {
    const selection = selectQuestGrowthRecommendedRoutes('eo', ReviewedAt)

    expect(selection).toMatchObject({
      state: 'available',
      routes: [
        {
          routeId: 'route:1-5-monthly-eo-medal-loop:draft-1',
          routeFamily: 'normal-map-eo-blueprint-loop',
          status: 'reviewed',
          outputClass: 'manual-check-route'
        }
      ]
    })
    expect(QuestGrowthR8EoRouteCatalog.runtimeContract).toEqual({
      defaultVisible: false,
      sessionOnly: true,
      runtimePublicationAuthorized: false,
      runtimeEligibleCount: 0
    })
  })

  it('selects the reviewed bundled 2-1 surface and air route', () => {
    const selection = selectQuestGrowthRecommendedRoutes('surface', ReviewedAt)

    expect(selection).toMatchObject({
      state: 'available',
      routes: [
        {
          routeId: 'route:2-1-surface-air-baseline:draft-1',
          routeFamily: 'surface-air-los-foundation',
          status: 'reviewed',
          outputClass: 'manual-check-route'
        }
      ]
    })
    expect(QuestGrowthR8SurfaceRouteCatalog.runtimeContract).toEqual({
      defaultVisible: false,
      sessionOnly: true,
      runtimePublicationAuthorized: false,
      runtimeEligibleCount: 0
    })
  })

  it('selects the reviewed bundled fleet unlock quest chain', () => {
    const selection = selectQuestGrowthRecommendedRoutes('unlock', ReviewedAt)

    expect(selection).toMatchObject({
      state: 'available',
      routes: [
        {
          routeId: 'route:fleet-2-4-unlock-chain:draft-1',
          routeFamily: 'system-fleet-unlock',
          status: 'reviewed',
          outputClass: 'manual-check-route'
        }
      ]
    })
    expect(QuestGrowthR8UnlockRouteCatalog.routes[0].segments).toHaveLength(3)
    expect(QuestGrowthR8UnlockRouteCatalog.runtimeContract).toEqual({
      defaultVisible: false,
      sessionOnly: true,
      runtimePublicationAuthorized: false,
      runtimeEligibleCount: 0
    })
  })

  it('fails closed after the knowledge review deadline', () => {
    expect(
      selectQuestGrowthRecommendedRoutes('eo', new Date('2026-08-31T00:00:00.000Z'))
    ).toEqual({ state: 'knowledge-review-required', routes: [] })
  })

  it('fails closed when the bundled-only boundary is widened', () => {
    const changed = structuredClone(QuestGrowthR8EoRouteCatalog)
    changed.runtimeContract.defaultVisible = true

    expect(selectQuestGrowthRecommendedRoutes('eo', ReviewedAt, changed)).toEqual({
      state: 'knowledge-review-required',
      routes: []
    })
  })

  it('fails closed when the surface route semantic binding drifts', () => {
    const changed = structuredClone(QuestGrowthR8SurfaceRouteCatalog)
    changed.routes[0].segments[0].targetNodes = ['C', 'H']

    expect(
      selectQuestGrowthRecommendedRoutes(
        'surface',
        ReviewedAt,
        QuestGrowthR8EoRouteCatalog,
        changed
      )
    ).toEqual({ state: 'knowledge-review-required', routes: [] })
  })

  it('fails closed when the unlock quest order drifts', () => {
    const changed = structuredClone(QuestGrowthR8UnlockRouteCatalog)
    changed.routes[0].segments[2].targetNodes = ['A16']

    expect(
      selectQuestGrowthRecommendedRoutes(
        'unlock',
        ReviewedAt,
        QuestGrowthR8EoRouteCatalog,
        QuestGrowthR8SurfaceRouteCatalog,
        changed
      )
    ).toEqual({ state: 'knowledge-review-required', routes: [] })
  })
})

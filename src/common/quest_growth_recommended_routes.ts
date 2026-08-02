import r8EoRouteCatalogJson from '../../knowledge/quest-growth/r8/route-catalog.json'
import {
  selectQuestGrowthReviewedRoutes,
  type QuestGrowthReviewedRoute,
  type QuestGrowthRouteFocus,
  type QuestGrowthRouteSelection
} from './quest_growth_reviewed_routes'

interface QuestGrowthR8RouteCatalog {
  publicationAuthorization: string
  runtimeContract: {
    defaultVisible: boolean
    sessionOnly: boolean
    runtimePublicationAuthorized: boolean
    runtimeEligibleCount: number
  }
  routes: QuestGrowthReviewedRoute[]
}

const EoRouteId = 'route:1-5-monthly-eo-medal-loop:draft-1'
const EoRouteFamily = 'normal-map-eo-blueprint-loop'
const EoRouteDigest =
  'sha256:94fce9facb9cd86ac11e9a1a1b3349e9e5bb6303ebdfb986ad9992a3cfc23d0a'

export const QuestGrowthR8EoRouteCatalog =
  r8EoRouteCatalogJson as unknown as QuestGrowthR8RouteCatalog

function validTimestamp(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value))
}

function eoRouteIsDisplayable(route: QuestGrowthReviewedRoute, now: number): boolean {
  if (
    route.routeId !== EoRouteId ||
    route.routeFamily !== EoRouteFamily ||
    route.revision !== 1 ||
    route.status !== 'reviewed' ||
    route.outputClass !== 'manual-check-route' ||
    route.review.author !== 'codex-r8-eo-route-author' ||
    route.review.approver !== 'project-owner' ||
    route.review.approvalDigest !== EoRouteDigest ||
    !validTimestamp(route.review.reviewedAt) ||
    !validTimestamp(route.currentness.reviewBy) ||
    !validTimestamp(route.currentness.validUntil) ||
    Date.parse(route.review.reviewedAt) >= Date.parse(route.currentness.reviewBy) ||
    now >= Date.parse(route.currentness.reviewBy) ||
    now >= Date.parse(route.currentness.validUntil) ||
    route.segments.length !== 1
  ) {
    return false
  }

  const segment = route.segments[0]
  return (
    segment.segmentId === 'segment:1-5-adfgj-monthly-eo' &&
    segment.mapKey === '1-5' &&
    segment.targetNodes.join('-') === 'A-D-F-G-J' &&
    segment.formations.length === 1 &&
    segment.formations[0] === 'line-abreast' &&
    segment.fleetConstraints.length > 0 &&
    segment.equipmentConstraints.length > 0 &&
    segment.branchConditions.length > 0 &&
    segment.sortieInstructions.length > 0 &&
    segment.fallback.trim().length > 0
  )
}

export function selectQuestGrowthRecommendedRoutes(
  focus: QuestGrowthRouteFocus,
  now: Date | number,
  eoCatalog: QuestGrowthR8RouteCatalog = QuestGrowthR8EoRouteCatalog
): QuestGrowthRouteSelection {
  if (focus !== 'eo') return selectQuestGrowthReviewedRoutes(focus, now)

  const timestamp = now instanceof Date ? now.getTime() : now
  if (
    !Number.isFinite(timestamp) ||
    eoCatalog.publicationAuthorization !== 'R8_BUNDLED_OPT_IN_ONLY' ||
    eoCatalog.runtimeContract.defaultVisible !== false ||
    eoCatalog.runtimeContract.sessionOnly !== true ||
    eoCatalog.runtimeContract.runtimePublicationAuthorized !== false ||
    eoCatalog.runtimeContract.runtimeEligibleCount !== 0 ||
    !Array.isArray(eoCatalog.routes) ||
    eoCatalog.routes.length !== 1 ||
    !eoRouteIsDisplayable(eoCatalog.routes[0], timestamp)
  ) {
    return { state: 'knowledge-review-required', routes: [] }
  }

  return { state: 'available', routes: eoCatalog.routes }
}

export type { QuestGrowthReviewedRouteSegment } from './quest_growth_reviewed_routes'

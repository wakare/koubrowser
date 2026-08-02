import r8EoRouteCatalogJson from '../../knowledge/quest-growth/r8/route-catalog.json'
import r8SurfaceRouteCatalogJson from '../../knowledge/quest-growth/r8/surface-route-catalog.json'
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
const SurfaceRouteId = 'route:2-1-surface-air-baseline:draft-1'
const SurfaceRouteFamily = 'surface-air-los-foundation'
const SurfaceRouteDigest =
  'sha256:6de12b626dacdf252746d21593268167105614242f3158a046a1a126db8e3f86'

export const QuestGrowthR8EoRouteCatalog =
  r8EoRouteCatalogJson as unknown as QuestGrowthR8RouteCatalog
export const QuestGrowthR8SurfaceRouteCatalog =
  r8SurfaceRouteCatalogJson as unknown as QuestGrowthR8RouteCatalog

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

function catalogKeepsBundledBoundary(catalog: QuestGrowthR8RouteCatalog): boolean {
  return (
    catalog.publicationAuthorization === 'R8_BUNDLED_OPT_IN_ONLY' &&
    catalog.runtimeContract.defaultVisible === false &&
    catalog.runtimeContract.sessionOnly === true &&
    catalog.runtimeContract.runtimePublicationAuthorized === false &&
    catalog.runtimeContract.runtimeEligibleCount === 0 &&
    Array.isArray(catalog.routes) &&
    catalog.routes.length === 1
  )
}

function surfaceRouteIsDisplayable(route: QuestGrowthReviewedRoute, now: number): boolean {
  if (
    route.routeId !== SurfaceRouteId ||
    route.routeFamily !== SurfaceRouteFamily ||
    route.revision !== 1 ||
    route.status !== 'reviewed' ||
    route.outputClass !== 'manual-check-route' ||
    route.review.author !== 'codex-r8-surface-route-author' ||
    route.review.approver !== 'project-owner' ||
    route.review.approvalDigest !== SurfaceRouteDigest ||
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

  const segment = route.segments[0] as QuestGrowthReviewedRoute['segments'][number] & {
    airState?: unknown
  }
  return (
    segment.segmentId === 'segment:2-1-cdeh-surface-air' &&
    segment.mapKey === '2-1' &&
    segment.targetNodes.join('-') === 'C-D/E-H' &&
    segment.formations.length === 1 &&
    segment.formations[0] === 'line-ahead' &&
    segment.airState === 'air-superiority-81-with-margin-manual-check' &&
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
  eoCatalog: QuestGrowthR8RouteCatalog = QuestGrowthR8EoRouteCatalog,
  surfaceCatalog: QuestGrowthR8RouteCatalog = QuestGrowthR8SurfaceRouteCatalog
): QuestGrowthRouteSelection {
  if (focus !== 'eo' && focus !== 'surface') {
    return selectQuestGrowthReviewedRoutes(focus, now)
  }

  const timestamp = now instanceof Date ? now.getTime() : now
  if (!Number.isFinite(timestamp)) {
    return { state: 'knowledge-review-required', routes: [] }
  }

  const catalog = focus === 'eo' ? eoCatalog : surfaceCatalog
  if (!catalogKeepsBundledBoundary(catalog)) {
    return { state: 'knowledge-review-required', routes: [] }
  }
  const displayable =
    focus === 'eo'
      ? eoRouteIsDisplayable(catalog.routes[0], timestamp)
      : surfaceRouteIsDisplayable(catalog.routes[0], timestamp)
  if (!displayable) {
    return { state: 'knowledge-review-required', routes: [] }
  }
  return { state: 'available', routes: catalog.routes }
}

export type { QuestGrowthReviewedRouteSegment } from './quest_growth_reviewed_routes'

import routeCatalogJson from '../../knowledge/quest-growth/r7/route-catalog.json'

export type QuestGrowthRouteFocus =
  | 'unset'
  | 'resources'
  | 'asw'
  | 'surface'
  | 'eo'
  | 'breadth'
  | 'event'

export interface QuestGrowthReviewedRouteSegment {
  segmentId: string
  actionCategory: string
  mapKey: string | null
  targetNodes: string[]
  fleetConstraints: string[]
  equipmentConstraints: string[]
  formations: string[]
  branchConditions: string[]
  sortieInstructions: string[]
  fallback: string
}

export interface QuestGrowthReviewedRoute {
  routeId: string
  routeFamily: string
  revision: number
  status: string
  outputClass: string
  title: string
  summary: string
  applicability: string[]
  segments: QuestGrowthReviewedRouteSegment[]
  currentness: {
    reviewBy: string
    validUntil: string
  }
  fallback: string
  review: {
    author: string
    approver: string | null
    reviewedAt: string | null
    approvalDigest: string | null
  }
}

interface QuestGrowthReviewedRouteCatalog {
  publicationAuthorization: string
  routes: QuestGrowthReviewedRoute[]
}

export interface QuestGrowthRuntimeRouteBinding {
  readonly routeId: string
  readonly routeFamily: string
  readonly revision: number
  readonly semanticDigest: string
  readonly status: 'reviewed' | 'withdrawn'
}

export interface QuestGrowthRuntimeRouteUpdate {
  readonly schemaVersion: 1
  readonly version: string
  readonly publicationAuthorization: 'R7_RUNTIME_SIGNED_CANDIDATE'
  readonly routes: readonly QuestGrowthRuntimeRouteBinding[]
}

export type QuestGrowthRouteSelection =
  | { state: 'available'; routes: readonly QuestGrowthReviewedRoute[] }
  | {
      state: 'select-focus' | 'no-route' | 'knowledge-review-required'
      routes: readonly []
    }

const ApprovedRouteBindings = {
  'route:expedition-05-resource-loop:draft-1': {
    family: 'expedition-resource-periodic-loop',
    focus: 'resources',
    revision: 1,
    digest: 'sha256:05e4cdbbcbdbf7a781ba73bbe1bb3498cc7c0bab6985fef4b1cae6173acda55a'
  },
  'route:1-5-basic-asw-three-battle:draft-1': {
    family: 'anti-submarine-foundation',
    focus: 'asw',
    revision: 1,
    digest: 'sha256:9b675d5c8a33b3ec974c678a3f258200324222f1e7bec1c2b2ba5e4c3512e78d'
  }
} as const

const RuntimeRouteVersionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/

let activeRuntimeRouteUpdate: QuestGrowthRuntimeRouteUpdate | null = null

export const QuestGrowthReviewedRouteCatalog =
  routeCatalogJson as unknown as QuestGrowthReviewedRouteCatalog

function validTimestamp(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  description: string
): void {
  const allowed = new Set(required)
  if (
    required.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) ||
    Object.keys(value).some((key) => !allowed.has(key))
  ) {
    throw new Error(`${description} has unsupported or missing fields`)
  }
}

export function validateQuestGrowthRuntimeRouteUpdate(
  value: unknown
): QuestGrowthRuntimeRouteUpdate {
  if (!isRecord(value)) {
    throw new Error('quest growth route update must be an object')
  }
  requireExactKeys(
    value,
    ['schemaVersion', 'version', 'publicationAuthorization', 'routes'],
    'quest growth route update'
  )
  if (
    value.schemaVersion !== 1 ||
    typeof value.version !== 'string' ||
    !RuntimeRouteVersionPattern.test(value.version) ||
    value.publicationAuthorization !== 'R7_RUNTIME_SIGNED_CANDIDATE' ||
    !Array.isArray(value.routes) ||
    value.routes.length !== 2
  ) {
    throw new Error('invalid quest growth route update')
  }

  const seenRouteIds = new Set<string>()
  const routes = value.routes.map((route, index): QuestGrowthRuntimeRouteBinding => {
    const description = `quest growth route binding ${index}`
    if (!isRecord(route)) {
      throw new Error(`${description} must be an object`)
    }
    requireExactKeys(
      route,
      ['routeId', 'routeFamily', 'revision', 'semanticDigest', 'status'],
      description
    )
    if (typeof route.routeId !== 'string' || seenRouteIds.has(route.routeId)) {
      throw new Error(`invalid ${description} route ID`)
    }
    const approved = ApprovedRouteBindings[
      route.routeId as keyof typeof ApprovedRouteBindings
    ]
    if (
      !approved ||
      route.routeFamily !== approved.family ||
      route.revision !== approved.revision ||
      route.semanticDigest !== approved.digest ||
      (route.status !== 'reviewed' && route.status !== 'withdrawn')
    ) {
      throw new Error(`${description} does not match a fixed reviewed route`)
    }
    seenRouteIds.add(route.routeId)
    return {
      routeId: route.routeId,
      routeFamily: approved.family,
      revision: approved.revision,
      semanticDigest: approved.digest,
      status: route.status
    }
  })
  if (seenRouteIds.size !== Object.keys(ApprovedRouteBindings).length) {
    throw new Error('quest growth route update does not cover every fixed route')
  }
  return {
    schemaVersion: 1,
    version: value.version,
    publicationAuthorization: 'R7_RUNTIME_SIGNED_CANDIDATE',
    routes
  }
}

export function setQuestGrowthRuntimeRouteUpdate(
  update: QuestGrowthRuntimeRouteUpdate | null
): void {
  activeRuntimeRouteUpdate =
    update === null ? null : validateQuestGrowthRuntimeRouteUpdate(update)
}

function routeIsDisplayable(route: QuestGrowthReviewedRoute, now: number): boolean {
  const binding = ApprovedRouteBindings[route.routeId as keyof typeof ApprovedRouteBindings]
  if (!binding) return false
  if (
    route.routeFamily !== binding.family ||
    route.revision !== binding.revision ||
    route.status !== 'reviewed' ||
    route.outputClass !== 'manual-check-route' ||
    route.review.approver !== 'project-owner' ||
    route.review.approvalDigest !== binding.digest ||
    route.review.author === route.review.approver ||
    !validTimestamp(route.review.reviewedAt) ||
    !validTimestamp(route.currentness.reviewBy) ||
    !validTimestamp(route.currentness.validUntil) ||
    Date.parse(route.review.reviewedAt) >= Date.parse(route.currentness.reviewBy) ||
    now >= Date.parse(route.currentness.reviewBy) ||
    now >= Date.parse(route.currentness.validUntil) ||
    route.segments.length === 0
  ) {
    return false
  }
  return route.segments.every(
    (segment) =>
      segment.fleetConstraints.length > 0 &&
      segment.branchConditions.length > 0 &&
      segment.sortieInstructions.length > 0 &&
      segment.fallback.trim().length > 0
  )
}

export function selectQuestGrowthReviewedRoutes(
  focus: QuestGrowthRouteFocus,
  now: Date | number,
  catalog: QuestGrowthReviewedRouteCatalog = QuestGrowthReviewedRouteCatalog
): QuestGrowthRouteSelection {
  const runtimeBinding =
    catalog === QuestGrowthReviewedRouteCatalog
      ? activeRuntimeRouteUpdate?.routes.find((route) => {
          const approved = ApprovedRouteBindings[
            route.routeId as keyof typeof ApprovedRouteBindings
          ]
          return approved?.focus === focus
        })
      : undefined
  if (
    catalog.publicationAuthorization !== 'R7_NOT_AUTHORIZED' ||
    !Array.isArray(catalog.routes) ||
    catalog.routes.length !== 2
  ) {
    return { state: 'knowledge-review-required', routes: [] }
  }
  if (!['resources', 'asw'].includes(focus)) {
    return { state: 'select-focus', routes: [] }
  }
  if (activeRuntimeRouteUpdate && catalog === QuestGrowthReviewedRouteCatalog) {
    if (!runtimeBinding || runtimeBinding.status === 'withdrawn') {
      return { state: 'knowledge-review-required', routes: [] }
    }
  }
  const timestamp = now instanceof Date ? now.getTime() : now
  if (!Number.isFinite(timestamp)) {
    return { state: 'knowledge-review-required', routes: [] }
  }
  const matching = catalog.routes.filter((route) => {
    const binding = ApprovedRouteBindings[route.routeId as keyof typeof ApprovedRouteBindings]
    return binding?.focus === focus
  })
  if (matching.length === 0) return { state: 'no-route', routes: [] }
  if (matching.length !== 1 || !routeIsDisplayable(matching[0], timestamp)) {
    return { state: 'knowledge-review-required', routes: [] }
  }
  return { state: 'available', routes: matching }
}

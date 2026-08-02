const fs = require('node:fs')
const path = require('node:path')
const {
  canonicalJson,
  digest,
  routeSemanticDigest
} = require('./quest-growth-r8-eo-route')

const CompilerVersion = 'quest-growth-r8-surface-route-validator/1'
const R8SurfaceRouteOutputFilenames = ['r8-surface-route-validation-report.json']
const CatalogPath = 'knowledge/quest-growth/r8/surface-route-catalog.json'
const EvidencePath = 'knowledge/quest-growth/r8/surface-evidence-snapshots.json'
const R6LineagesPath = 'knowledge/quest-growth/authoring/route-lineages.json'
const R6UnitsPath = 'knowledge/quest-growth/authoring/route-units.json'
const FixedRouteId = 'route:2-1-surface-air-baseline:draft-1'
const FixedFamily = 'surface-air-los-foundation'
const FixedLineageId = 'growth-lineage:surface-air-los-foundation'
const FixedUnitId = 'growth-route:surface-air-los-foundation:baseline'
const FixedClaim = 'claim:adaptive-growth-priorities'
const FixedGroups = ['group:wikiwiki-ja', 'group:kcwiki-zh']
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function exactKeys(value, required, description) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`invalid ${description}`)
  }
  const allowed = new Set(required)
  if (
    required.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) ||
    Object.keys(value).some((key) => !allowed.has(key))
  ) {
    throw new Error(`invalid ${description} keys`)
  }
}

function requiredText(value, description) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function timestamp(value, description) {
  const result = requiredText(value, description)
  if (!TimestampPattern.test(result) || !Number.isFinite(Date.parse(result))) {
    throw new Error(`invalid ${description}`)
  }
  return result
}

function uniqueTextList(value, description, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum) {
    throw new Error(`invalid ${description}`)
  }
  value.forEach((item) => requiredText(item, description))
  if (new Set(value).size !== value.length) throw new Error(`duplicate ${description}`)
  return value
}

function validateSurfaceEvidence(value) {
  exactKeys(
    value,
    ['authoringSchema', 'snapshotVersion', 'sourceSnapshot', 'sources'],
    'R8 surface evidence packet'
  )
  if (
    value.authoringSchema !== 'QuestGrowthR8EvidenceSnapshots/1alpha' ||
    value.snapshotVersion !== '1.0.0-alpha.1'
  ) {
    throw new Error('unsupported R8 surface evidence packet')
  }
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R8 surface snapshot')
  if (!/^[0-9a-f]{40}$/.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R8 surface evidence base commit')
  }
  timestamp(value.sourceSnapshot.checkedAt, 'R8 surface evidence checkedAt')
  if (!Array.isArray(value.sources) || value.sources.length !== 2) {
    throw new Error('R8 surface route requires exactly two evidence sources')
  }

  const sourcesByDigest = new Map()
  value.sources.forEach((source, index) => {
    exactKeys(
      source,
      [
        'sourceId',
        'independenceGroupId',
        'url',
        'title',
        'site',
        'language',
        'accessibility',
        'evidenceClass',
        'checkedAt',
        'reviewBy',
        'validUntil',
        'supportedClaims',
        'facts',
        'notes'
      ],
      `R8 surface source ${index}`
    )
    requiredText(source.sourceId, 'R8 surface source id')
    if (
      source.independenceGroupId !== FixedGroups[index] ||
      !/^https:\/\//.test(source.url) ||
      source.accessibility !== 'independently-readable' ||
      source.evidenceClass !== 'mechanic' ||
      JSON.stringify(source.supportedClaims) !== JSON.stringify([FixedClaim])
    ) {
      throw new Error(`R8 surface source ${index} binding mismatch`)
    }
    requiredText(source.title, 'R8 surface source title')
    requiredText(source.site, 'R8 surface source site')
    requiredText(source.language, 'R8 surface source language')
    const checkedAt = timestamp(source.checkedAt, 'R8 surface source checkedAt')
    const reviewBy = timestamp(source.reviewBy, 'R8 surface source reviewBy')
    const validUntil = timestamp(source.validUntil, 'R8 surface source validUntil')
    if (Date.parse(checkedAt) >= Date.parse(reviewBy) || Date.parse(reviewBy) >= Date.parse(validUntil)) {
      throw new Error('R8 surface source currentness window mismatch')
    }
    if (!Array.isArray(source.facts) || source.facts.length < 4) {
      throw new Error('R8 surface source has insufficient concrete facts')
    }
    source.facts.forEach((fact) => {
      exactKeys(fact, ['factId', 'statement'], 'R8 surface evidence fact')
      requiredText(fact.factId, 'R8 surface fact id')
      requiredText(fact.statement, 'R8 surface fact statement')
    })
    uniqueTextList(source.notes, 'R8 surface source notes', 1)
    sourcesByDigest.set(digest(canonicalJson(source)), source)
  })
  if (new Set(value.sources.map((source) => source.independenceGroupId)).size !== 2) {
    throw new Error('R8 surface sources are not independent')
  }
  return { value, sourcesByDigest }
}

function validateSurfaceCatalog(value, evidence, r6Lineages, r6Units) {
  exactKeys(
    value,
    [
      'authoringSchema',
      'catalogVersion',
      'status',
      'sourceSnapshot',
      'selectedFamilies',
      'publicationAuthorization',
      'runtimeContract',
      'routes'
    ],
    'R8 surface catalog'
  )
  if (
    value.authoringSchema !== 'QuestGrowthR8ConcreteRouteCatalog/1alpha' ||
    value.catalogVersion !== '1.0.0-alpha.1' ||
    value.status !== 'reviewed' ||
    JSON.stringify(value.selectedFamilies) !== JSON.stringify([FixedFamily]) ||
    value.publicationAuthorization !== 'R8_BUNDLED_OPT_IN_ONLY' ||
    !Array.isArray(value.routes) ||
    value.routes.length !== 1
  ) {
    throw new Error('R8 surface catalog contract mismatch')
  }
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R8 surface catalog snapshot')
  if (!/^[0-9a-f]{40}$/.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R8 surface catalog base commit')
  }
  const checkedAt = timestamp(value.sourceSnapshot.checkedAt, 'R8 surface catalog checkedAt')
  exactKeys(
    value.runtimeContract,
    ['defaultVisible', 'sessionOnly', 'runtimePublicationAuthorized', 'runtimeEligibleCount'],
    'R8 surface runtime contract'
  )
  if (
    value.runtimeContract.defaultVisible !== false ||
    value.runtimeContract.sessionOnly !== true ||
    value.runtimeContract.runtimePublicationAuthorized !== false ||
    value.runtimeContract.runtimeEligibleCount !== 0
  ) {
    throw new Error('R8 surface runtime boundary widened')
  }

  const lineage = r6Lineages.lineages.find(
    (item) => item.routeLineageId === FixedLineageId && item.revision === 1
  )
  const unit = r6Units.units.find(
    (item) => item.routeUnitId === FixedUnitId && item.revision === 1
  )
  if (
    !lineage ||
    lineage.status !== 'reviewed' ||
    lineage.routeFamily !== FixedFamily ||
    !lineage.claimRefs.includes(FixedClaim) ||
    !lineage.routeUnitRefs.some((reference) => reference.id === FixedUnitId && reference.revision === 1) ||
    !unit ||
    unit.status !== 'reviewed' ||
    unit.lineageRef.id !== FixedLineageId ||
    !unit.prerequisites.includes('target-formula:reviewed')
  ) {
    throw new Error('R8 surface route is not bound to the reviewed R6 lineage and unit')
  }

  const route = value.routes[0]
  exactKeys(
    route,
    [
      'routeId',
      'lineageRef',
      'routeFamily',
      'revision',
      'status',
      'outputClass',
      'title',
      'summary',
      'applicability',
      'segments',
      'currentness',
      'fallback',
      'review'
    ],
    'R8 surface route'
  )
  if (
    route.routeId !== FixedRouteId ||
    route.routeFamily !== FixedFamily ||
    route.revision !== 1 ||
    route.status !== 'reviewed' ||
    route.outputClass !== 'manual-check-route'
  ) {
    throw new Error('R8 surface route identity mismatch')
  }
  exactKeys(route.lineageRef, ['id', 'revision'], 'R8 surface lineage reference')
  if (route.lineageRef.id !== FixedLineageId || route.lineageRef.revision !== 1) {
    throw new Error('R8 surface lineage reference mismatch')
  }
  requiredText(route.title, 'R8 surface route title')
  requiredText(route.summary, 'R8 surface route summary')
  uniqueTextList(route.applicability, 'R8 surface route applicability', 4)
  if (!Array.isArray(route.segments) || route.segments.length !== 1) {
    throw new Error('R8 surface route requires one segment')
  }
  const segment = route.segments[0]
  exactKeys(
    segment,
    [
      'segmentId',
      'actionCategory',
      'mapKey',
      'targetNodes',
      'fleetConstraints',
      'equipmentConstraints',
      'formations',
      'airState',
      'branchConditions',
      'sortieInstructions',
      'concreteEvidenceRefs',
      'fallback'
    ],
    'R8 surface segment'
  )
  if (
    segment.segmentId !== 'segment:2-1-cdeh-surface-air' ||
    segment.actionCategory !== 'sortie' ||
    segment.mapKey !== '2-1' ||
    JSON.stringify(segment.targetNodes) !== JSON.stringify(['C', 'D/E', 'H']) ||
    JSON.stringify(segment.formations) !== JSON.stringify(['line-ahead']) ||
    segment.airState !== 'air-superiority-81-with-margin-manual-check'
  ) {
    throw new Error('R8 surface segment mechanic binding mismatch')
  }
  uniqueTextList(segment.fleetConstraints, 'R8 surface fleet constraints', 4)
  uniqueTextList(segment.equipmentConstraints, 'R8 surface equipment constraints', 3)
  uniqueTextList(segment.branchConditions, 'R8 surface branch conditions', 3)
  uniqueTextList(segment.sortieInstructions, 'R8 surface instructions', 5)
  requiredText(segment.fallback, 'R8 surface segment fallback')
  if (!Array.isArray(segment.concreteEvidenceRefs) || segment.concreteEvidenceRefs.length !== 2) {
    throw new Error('R8 surface route requires two evidence references')
  }
  segment.concreteEvidenceRefs.forEach((reference, index) => {
    exactKeys(reference, ['claimRef', 'independenceGroupId', 'sourceDigest'], 'R8 surface evidence ref')
    const source = evidence.sourcesByDigest.get(reference.sourceDigest)
    if (
      reference.claimRef !== FixedClaim ||
      reference.independenceGroupId !== FixedGroups[index] ||
      !DigestPattern.test(reference.sourceDigest) ||
      source?.independenceGroupId !== reference.independenceGroupId
    ) {
      throw new Error('R8 surface evidence reference mismatch')
    }
  })
  exactKeys(route.currentness, ['reviewBy', 'validUntil'], 'R8 surface route currentness')
  const reviewBy = timestamp(route.currentness.reviewBy, 'R8 surface route reviewBy')
  const validUntil = timestamp(route.currentness.validUntil, 'R8 surface route validUntil')
  if (
    Date.parse(checkedAt) >= Date.parse(reviewBy) ||
    Date.parse(reviewBy) >= Date.parse(validUntil) ||
    reviewBy !== lineage.currentness.reviewBy ||
    validUntil !== lineage.currentness.validUntil
  ) {
    throw new Error('R8 surface route currentness window mismatch')
  }
  requiredText(route.fallback, 'R8 surface route fallback')
  exactKeys(route.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'R8 surface review')
  if (
    route.review.author !== 'codex-r8-surface-route-author' ||
    route.review.approver !== 'project-owner' ||
    timestamp(route.review.reviewedAt, 'R8 surface reviewedAt') !== checkedAt ||
    route.review.approvalDigest !== routeSemanticDigest(route)
  ) {
    throw new Error('R8 surface independent review mismatch')
  }
  return { value, route, routeSemanticDigest: routeSemanticDigest(route) }
}

function buildR8SurfaceRouteArtifacts({ root }) {
  const catalogRaw = fs.readFileSync(path.join(root, ...CatalogPath.split('/')))
  const evidenceRaw = fs.readFileSync(path.join(root, ...EvidencePath.split('/')))
  const r6Lineages = JSON.parse(
    fs.readFileSync(path.join(root, ...R6LineagesPath.split('/')), 'utf8')
  )
  const r6Units = JSON.parse(
    fs.readFileSync(path.join(root, ...R6UnitsPath.split('/')), 'utf8')
  )
  const evidence = validateSurfaceEvidence(JSON.parse(evidenceRaw))
  const catalog = validateSurfaceCatalog(
    JSON.parse(catalogRaw),
    evidence,
    r6Lineages,
    r6Units
  )
  const report = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    generatedAt: catalog.value.sourceSnapshot.checkedAt,
    status: 'R8_SURFACE_BUNDLED_OPT_IN_ROUTE_REVIEWED',
    catalogDigest: digest(catalogRaw),
    evidenceSnapshotDigest: digest(evidenceRaw),
    routeId: catalog.route.routeId,
    routeFamily: catalog.route.routeFamily,
    routeSemanticDigest: catalog.routeSemanticDigest,
    evidenceSourceCount: evidence.value.sources.length,
    independentEvidenceGroupCount: evidence.value.sources.length,
    reviewedRouteCount: 1,
    defaultVisible: false,
    sessionOnly: true,
    runtimePublicationAuthorized: false,
    runtimeEligibleCount: 0
  }
  return {
    artifacts: { 'r8-surface-route-validation-report.json': report },
    source: {
      r8SurfaceRouteCatalogDigest: report.catalogDigest,
      r8SurfaceEvidenceSnapshotDigest: report.evidenceSnapshotDigest
    },
    output: {
      r8SurfaceReviewedRouteCount: report.reviewedRouteCount,
      r8SurfaceEvidenceSourceCount: report.evidenceSourceCount,
      r8SurfaceRuntimeEligibleCount: 0,
      r8SurfaceRuntimePublicationAuthorized: false
    }
  }
}

module.exports = {
  R8SurfaceRouteOutputFilenames,
  buildR8SurfaceRouteArtifacts,
  validateSurfaceCatalog,
  validateSurfaceEvidence
}

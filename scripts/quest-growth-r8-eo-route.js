const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const CompilerVersion = 'quest-growth-r8-eo-route-validator/1'
const R8EoRouteOutputFilenames = ['r8-eo-route-validation-report.json']
const CatalogPath = 'knowledge/quest-growth/r8/route-catalog.json'
const EvidencePath = 'knowledge/quest-growth/r8/evidence-snapshots.json'
const R6LineagesPath = 'knowledge/quest-growth/authoring/route-lineages.json'
const FixedRouteId = 'route:1-5-monthly-eo-medal-loop:draft-1'
const FixedFamily = 'normal-map-eo-blueprint-loop'
const FixedLineageId = 'growth-lineage:normal-map-eo-blueprint-loop'
const FixedClaim = 'claim:eo-medal-blueprint-loop'
const FixedGroups = ['group:wikiwiki-ja', 'group:kcwiki-zh']
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    )
  }
  return value
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`
}

function digest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

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

function routeSemanticDigest(route) {
  return digest(
    canonicalJson(
      Object.fromEntries(
        Object.entries(route).filter(([key]) => key !== 'status' && key !== 'review')
      )
    )
  )
}

function validateEvidence(value) {
  exactKeys(
    value,
    ['authoringSchema', 'snapshotVersion', 'sourceSnapshot', 'sources'],
    'R8 evidence packet'
  )
  if (
    value.authoringSchema !== 'QuestGrowthR8EvidenceSnapshots/1alpha' ||
    value.snapshotVersion !== '1.0.0-alpha.1'
  ) {
    throw new Error('unsupported R8 evidence packet')
  }
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R8 evidence snapshot')
  if (!/^[0-9a-f]{40}$/.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R8 evidence base commit')
  }
  timestamp(value.sourceSnapshot.checkedAt, 'R8 evidence checkedAt')
  if (!Array.isArray(value.sources) || value.sources.length !== 2) {
    throw new Error('R8 EO route requires exactly two evidence sources')
  }
  const sourcesByDigest = new Map()
  const groups = []
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
      `R8 evidence source ${index}`
    )
    requiredText(source.sourceId, 'R8 source id')
    if (
      source.independenceGroupId !== FixedGroups[index] ||
      !/^https:\/\//.test(source.url) ||
      source.accessibility !== 'independently-readable' ||
      source.evidenceClass !== 'mechanic' ||
      JSON.stringify(source.supportedClaims) !== JSON.stringify([FixedClaim])
    ) {
      throw new Error(`R8 evidence source ${index} binding mismatch`)
    }
    requiredText(source.title, 'R8 source title')
    requiredText(source.site, 'R8 source site')
    requiredText(source.language, 'R8 source language')
    const checkedAt = timestamp(source.checkedAt, 'R8 source checkedAt')
    const reviewBy = timestamp(source.reviewBy, 'R8 source reviewBy')
    const validUntil = timestamp(source.validUntil, 'R8 source validUntil')
    if (Date.parse(checkedAt) >= Date.parse(reviewBy) || Date.parse(reviewBy) >= Date.parse(validUntil)) {
      throw new Error('R8 source currentness window mismatch')
    }
    if (!Array.isArray(source.facts) || source.facts.length < 3) {
      throw new Error('R8 source has insufficient concrete facts')
    }
    source.facts.forEach((fact) => {
      exactKeys(fact, ['factId', 'statement'], 'R8 evidence fact')
      requiredText(fact.factId, 'R8 fact id')
      requiredText(fact.statement, 'R8 fact statement')
    })
    uniqueTextList(source.notes, 'R8 source notes', 1)
    const sourceDigest = digest(canonicalJson(source))
    sourcesByDigest.set(sourceDigest, source)
    groups.push(source.independenceGroupId)
  })
  if (new Set(groups).size !== 2) throw new Error('R8 sources are not independent')
  return { value, sourcesByDigest }
}

function validateCatalog(value, evidence, r6Lineages) {
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
    'R8 EO catalog'
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
    throw new Error('R8 EO catalog contract mismatch')
  }
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R8 catalog snapshot')
  if (!/^[0-9a-f]{40}$/.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R8 catalog base commit')
  }
  const checkedAt = timestamp(value.sourceSnapshot.checkedAt, 'R8 catalog checkedAt')
  exactKeys(
    value.runtimeContract,
    ['defaultVisible', 'sessionOnly', 'runtimePublicationAuthorized', 'runtimeEligibleCount'],
    'R8 runtime contract'
  )
  if (
    value.runtimeContract.defaultVisible !== false ||
    value.runtimeContract.sessionOnly !== true ||
    value.runtimeContract.runtimePublicationAuthorized !== false ||
    value.runtimeContract.runtimeEligibleCount !== 0
  ) {
    throw new Error('R8 runtime boundary widened')
  }
  const lineage = r6Lineages.lineages.find(
    (item) => item.routeLineageId === FixedLineageId && item.revision === 1
  )
  if (
    !lineage ||
    lineage.status !== 'reviewed' ||
    lineage.routeFamily !== FixedFamily ||
    !lineage.claimRefs.includes(FixedClaim)
  ) {
    throw new Error('R8 EO route is not bound to the reviewed R6 lineage')
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
    'R8 EO route'
  )
  if (
    route.routeId !== FixedRouteId ||
    route.routeFamily !== FixedFamily ||
    route.revision !== 1 ||
    route.status !== 'reviewed' ||
    route.outputClass !== 'manual-check-route'
  ) {
    throw new Error('R8 EO route identity mismatch')
  }
  exactKeys(route.lineageRef, ['id', 'revision'], 'R8 lineage reference')
  if (route.lineageRef.id !== FixedLineageId || route.lineageRef.revision !== 1) {
    throw new Error('R8 EO lineage reference mismatch')
  }
  requiredText(route.title, 'R8 route title')
  requiredText(route.summary, 'R8 route summary')
  uniqueTextList(route.applicability, 'R8 route applicability', 4)
  if (!Array.isArray(route.segments) || route.segments.length !== 1) {
    throw new Error('R8 EO route requires one segment')
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
    'R8 EO segment'
  )
  if (
    segment.segmentId !== 'segment:1-5-adfgj-monthly-eo' ||
    segment.actionCategory !== 'sortie' ||
    segment.mapKey !== '1-5' ||
    JSON.stringify(segment.targetNodes) !== JSON.stringify(['A', 'D', 'F', 'G', 'J']) ||
    JSON.stringify(segment.formations) !== JSON.stringify(['line-abreast']) ||
    segment.airState !== null
  ) {
    throw new Error('R8 EO segment mechanic binding mismatch')
  }
  uniqueTextList(segment.fleetConstraints, 'R8 fleet constraints', 4)
  uniqueTextList(segment.equipmentConstraints, 'R8 equipment constraints', 2)
  uniqueTextList(segment.branchConditions, 'R8 branch conditions', 3)
  uniqueTextList(segment.sortieInstructions, 'R8 instructions', 5)
  requiredText(segment.fallback, 'R8 segment fallback')
  if (!Array.isArray(segment.concreteEvidenceRefs) || segment.concreteEvidenceRefs.length !== 2) {
    throw new Error('R8 EO route requires two evidence references')
  }
  segment.concreteEvidenceRefs.forEach((reference, index) => {
    exactKeys(reference, ['claimRef', 'independenceGroupId', 'sourceDigest'], 'R8 evidence ref')
    const source = evidence.sourcesByDigest.get(reference.sourceDigest)
    if (
      reference.claimRef !== FixedClaim ||
      reference.independenceGroupId !== FixedGroups[index] ||
      !DigestPattern.test(reference.sourceDigest) ||
      source?.independenceGroupId !== reference.independenceGroupId
    ) {
      throw new Error('R8 EO evidence reference mismatch')
    }
  })
  exactKeys(route.currentness, ['reviewBy', 'validUntil'], 'R8 route currentness')
  const reviewBy = timestamp(route.currentness.reviewBy, 'R8 route reviewBy')
  const validUntil = timestamp(route.currentness.validUntil, 'R8 route validUntil')
  if (Date.parse(checkedAt) >= Date.parse(reviewBy) || Date.parse(reviewBy) >= Date.parse(validUntil)) {
    throw new Error('R8 route currentness window mismatch')
  }
  requiredText(route.fallback, 'R8 route fallback')
  exactKeys(route.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'R8 review')
  if (
    route.review.author !== 'codex-r8-eo-route-author' ||
    route.review.approver !== 'project-owner' ||
    route.review.author === route.review.approver ||
    timestamp(route.review.reviewedAt, 'R8 reviewedAt') !== checkedAt ||
    route.review.approvalDigest !== routeSemanticDigest(route)
  ) {
    throw new Error('R8 EO independent review mismatch')
  }
  return { value, route, routeSemanticDigest: routeSemanticDigest(route) }
}

function buildR8EoRouteArtifacts({ root }) {
  const catalogRaw = fs.readFileSync(path.join(root, ...CatalogPath.split('/')))
  const evidenceRaw = fs.readFileSync(path.join(root, ...EvidencePath.split('/')))
  const r6Lineages = JSON.parse(
    fs.readFileSync(path.join(root, ...R6LineagesPath.split('/')), 'utf8')
  )
  const evidence = validateEvidence(JSON.parse(evidenceRaw))
  const catalog = validateCatalog(JSON.parse(catalogRaw), evidence, r6Lineages)
  const report = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    generatedAt: catalog.value.sourceSnapshot.checkedAt,
    status: 'R8_EO_BUNDLED_OPT_IN_ROUTE_REVIEWED',
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
    artifacts: { 'r8-eo-route-validation-report.json': report },
    source: {
      r8EoRouteCatalogDigest: report.catalogDigest,
      r8EoEvidenceSnapshotDigest: report.evidenceSnapshotDigest
    },
    output: {
      r8EoReviewedRouteCount: report.reviewedRouteCount,
      r8EoEvidenceSourceCount: report.evidenceSourceCount,
      r8EoRuntimeEligibleCount: 0,
      r8EoRuntimePublicationAuthorized: false
    }
  }
}

module.exports = {
  R8EoRouteOutputFilenames,
  buildR8EoRouteArtifacts,
  canonicalJson,
  digest,
  routeSemanticDigest,
  validateCatalog,
  validateEvidence
}

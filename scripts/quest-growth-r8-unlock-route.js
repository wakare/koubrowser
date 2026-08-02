const fs = require('node:fs')
const path = require('node:path')
const {
  canonicalJson,
  digest,
  routeSemanticDigest
} = require('./quest-growth-r8-eo-route')

const CompilerVersion = 'quest-growth-r8-unlock-route-validator/1'
const R8UnlockRouteOutputFilenames = ['r8-unlock-route-validation-report.json']
const CatalogPath = 'knowledge/quest-growth/r8/unlock-route-catalog.json'
const EvidencePath = 'knowledge/quest-growth/r8/unlock-evidence-snapshots.json'
const R6LineagesPath = 'knowledge/quest-growth/authoring/route-lineages.json'
const R6UnitsPath = 'knowledge/quest-growth/authoring/route-units.json'
const FixedRouteId = 'route:fleet-2-4-unlock-chain:draft-1'
const FixedFamily = 'system-fleet-unlock'
const FixedLineageId = 'growth-lineage:system-fleet-unlock'
const FixedUnitId = 'growth-route:system-fleet-unlock:baseline'
const FixedClaim = 'claim:expedition-resource-loop'
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

function validateUnlockEvidence(value) {
  exactKeys(
    value,
    ['authoringSchema', 'snapshotVersion', 'sourceSnapshot', 'sources'],
    'R8 unlock evidence packet'
  )
  if (
    value.authoringSchema !== 'QuestGrowthR8EvidenceSnapshots/1alpha' ||
    value.snapshotVersion !== '1.0.0-alpha.1'
  ) {
    throw new Error('unsupported R8 unlock evidence packet')
  }
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R8 unlock snapshot')
  if (!/^[0-9a-f]{40}$/.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R8 unlock evidence base commit')
  }
  timestamp(value.sourceSnapshot.checkedAt, 'R8 unlock evidence checkedAt')
  if (!Array.isArray(value.sources) || value.sources.length !== 2) {
    throw new Error('R8 unlock route requires exactly two evidence sources')
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
      `R8 unlock source ${index}`
    )
    requiredText(source.sourceId, 'R8 unlock source id')
    if (
      source.independenceGroupId !== FixedGroups[index] ||
      !/^https:\/\//.test(source.url) ||
      source.accessibility !== 'independently-readable' ||
      source.evidenceClass !== 'quest-chain' ||
      JSON.stringify(source.supportedClaims) !== JSON.stringify([FixedClaim])
    ) {
      throw new Error(`R8 unlock source ${index} binding mismatch`)
    }
    requiredText(source.title, 'R8 unlock source title')
    requiredText(source.site, 'R8 unlock source site')
    requiredText(source.language, 'R8 unlock source language')
    const checkedAt = timestamp(source.checkedAt, 'R8 unlock source checkedAt')
    const reviewBy = timestamp(source.reviewBy, 'R8 unlock source reviewBy')
    const validUntil = timestamp(source.validUntil, 'R8 unlock source validUntil')
    if (Date.parse(checkedAt) >= Date.parse(reviewBy) || Date.parse(reviewBy) >= Date.parse(validUntil)) {
      throw new Error('R8 unlock source currentness window mismatch')
    }
    if (!Array.isArray(source.facts) || source.facts.length < 4) {
      throw new Error('R8 unlock source has insufficient concrete facts')
    }
    source.facts.forEach((fact) => {
      exactKeys(fact, ['factId', 'statement'], 'R8 unlock evidence fact')
      requiredText(fact.factId, 'R8 unlock fact id')
      requiredText(fact.statement, 'R8 unlock fact statement')
    })
    uniqueTextList(source.notes, 'R8 unlock source notes', 2)
    sourcesByDigest.set(digest(canonicalJson(source)), source)
  })
  if (new Set(value.sources.map((source) => source.independenceGroupId)).size !== 2) {
    throw new Error('R8 unlock sources are not independent')
  }
  return { value, sourcesByDigest }
}

const FixedSegments = [
  {
    segmentId: 'segment:a1-a4-second-fleet',
    targetNodes: ['A1', 'A2', 'A3', 'A4']
  },
  {
    segmentId: 'segment:a5-a14-third-fleet',
    targetNodes: ['A5', 'A7', 'A14']
  },
  {
    segmentId: 'segment:a15-a16-fourth-fleet',
    targetNodes: ['A15', 'A16']
  }
]

function validateSegment(segment, index, evidence) {
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
    `R8 unlock segment ${index}`
  )
  const fixed = FixedSegments[index]
  if (
    !fixed ||
    segment.segmentId !== fixed.segmentId ||
    segment.actionCategory !== 'quest-chain' ||
    segment.mapKey !== null ||
    JSON.stringify(segment.targetNodes) !== JSON.stringify(fixed.targetNodes) ||
    JSON.stringify(segment.formations) !== '[]' ||
    segment.airState !== null
  ) {
    throw new Error(`R8 unlock segment ${index} mechanic binding mismatch`)
  }
  uniqueTextList(segment.fleetConstraints, 'R8 unlock fleet constraints', 4)
  uniqueTextList(segment.equipmentConstraints, 'R8 unlock equipment constraints', 1)
  uniqueTextList(segment.branchConditions, 'R8 unlock branch conditions', 3)
  uniqueTextList(segment.sortieInstructions, 'R8 unlock instructions', 5)
  requiredText(segment.fallback, 'R8 unlock segment fallback')
  if (!Array.isArray(segment.concreteEvidenceRefs) || segment.concreteEvidenceRefs.length !== 2) {
    throw new Error('R8 unlock segment requires two evidence references')
  }
  segment.concreteEvidenceRefs.forEach((reference, sourceIndex) => {
    exactKeys(reference, ['claimRef', 'independenceGroupId', 'sourceDigest'], 'R8 unlock evidence ref')
    const source = evidence.sourcesByDigest.get(reference.sourceDigest)
    if (
      reference.claimRef !== FixedClaim ||
      reference.independenceGroupId !== FixedGroups[sourceIndex] ||
      !DigestPattern.test(reference.sourceDigest) ||
      source?.independenceGroupId !== reference.independenceGroupId
    ) {
      throw new Error('R8 unlock evidence reference mismatch')
    }
  })
}

function validateUnlockCatalog(value, evidence, r6Lineages, r6Units) {
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
    'R8 unlock catalog'
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
    throw new Error('R8 unlock catalog contract mismatch')
  }
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R8 unlock catalog snapshot')
  if (!/^[0-9a-f]{40}$/.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R8 unlock catalog base commit')
  }
  const checkedAt = timestamp(value.sourceSnapshot.checkedAt, 'R8 unlock catalog checkedAt')
  exactKeys(
    value.runtimeContract,
    ['defaultVisible', 'sessionOnly', 'runtimePublicationAuthorized', 'runtimeEligibleCount'],
    'R8 unlock runtime contract'
  )
  if (
    value.runtimeContract.defaultVisible !== false ||
    value.runtimeContract.sessionOnly !== true ||
    value.runtimeContract.runtimePublicationAuthorized !== false ||
    value.runtimeContract.runtimeEligibleCount !== 0
  ) {
    throw new Error('R8 unlock runtime boundary widened')
  }

  const lineage = r6Lineages.lineages.find(
    (item) => item.routeLineageId === FixedLineageId && item.revision === 1
  )
  const unit = r6Units.units.find(
    (item) => item.routeUnitId === FixedUnitId && item.revision === 1
  )
  const requiredObservables = new Set(
    unit?.requiredObservables?.map((observable) => observable.observableId)
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
    !unit.prerequisites.includes('quest-screen:loaded') ||
    !requiredObservables.has('fleet.unlocked-count') ||
    !requiredObservables.has('quest.visible-chain') ||
    !requiredObservables.has('expedition.unlocked-ids')
  ) {
    throw new Error('R8 unlock route is not bound to the reviewed R6 lineage and unit')
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
    'R8 unlock route'
  )
  if (
    route.routeId !== FixedRouteId ||
    route.routeFamily !== FixedFamily ||
    route.revision !== 1 ||
    route.status !== 'reviewed' ||
    route.outputClass !== 'manual-check-route'
  ) {
    throw new Error('R8 unlock route identity mismatch')
  }
  exactKeys(route.lineageRef, ['id', 'revision'], 'R8 unlock lineage reference')
  if (route.lineageRef.id !== FixedLineageId || route.lineageRef.revision !== 1) {
    throw new Error('R8 unlock lineage reference mismatch')
  }
  requiredText(route.title, 'R8 unlock route title')
  requiredText(route.summary, 'R8 unlock route summary')
  uniqueTextList(route.applicability, 'R8 unlock route applicability', 4)
  if (!Array.isArray(route.segments) || route.segments.length !== FixedSegments.length) {
    throw new Error('R8 unlock route requires three fixed segments')
  }
  route.segments.forEach((segment, index) => validateSegment(segment, index, evidence))

  exactKeys(route.currentness, ['reviewBy', 'validUntil'], 'R8 unlock route currentness')
  const reviewBy = timestamp(route.currentness.reviewBy, 'R8 unlock route reviewBy')
  const validUntil = timestamp(route.currentness.validUntil, 'R8 unlock route validUntil')
  if (
    Date.parse(checkedAt) >= Date.parse(reviewBy) ||
    Date.parse(reviewBy) >= Date.parse(validUntil) ||
    reviewBy !== lineage.currentness.reviewBy ||
    validUntil !== lineage.currentness.validUntil
  ) {
    throw new Error('R8 unlock route currentness window mismatch')
  }
  requiredText(route.fallback, 'R8 unlock route fallback')
  exactKeys(route.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'R8 unlock review')
  if (
    route.review.author !== 'codex-r8-unlock-route-author' ||
    route.review.approver !== 'project-owner' ||
    timestamp(route.review.reviewedAt, 'R8 unlock reviewedAt') !== checkedAt ||
    route.review.approvalDigest !== routeSemanticDigest(route)
  ) {
    throw new Error('R8 unlock independent review mismatch')
  }
  return { value, route, routeSemanticDigest: routeSemanticDigest(route) }
}

function buildR8UnlockRouteArtifacts({ root }) {
  const catalogRaw = fs.readFileSync(path.join(root, ...CatalogPath.split('/')))
  const evidenceRaw = fs.readFileSync(path.join(root, ...EvidencePath.split('/')))
  const r6Lineages = JSON.parse(
    fs.readFileSync(path.join(root, ...R6LineagesPath.split('/')), 'utf8')
  )
  const r6Units = JSON.parse(
    fs.readFileSync(path.join(root, ...R6UnitsPath.split('/')), 'utf8')
  )
  const evidence = validateUnlockEvidence(JSON.parse(evidenceRaw))
  const catalog = validateUnlockCatalog(
    JSON.parse(catalogRaw),
    evidence,
    r6Lineages,
    r6Units
  )
  const report = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    generatedAt: catalog.value.sourceSnapshot.checkedAt,
    status: 'R8_UNLOCK_BUNDLED_OPT_IN_ROUTE_REVIEWED',
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
    artifacts: { 'r8-unlock-route-validation-report.json': report },
    source: {
      r8UnlockRouteCatalogDigest: report.catalogDigest,
      r8UnlockEvidenceSnapshotDigest: report.evidenceSnapshotDigest
    },
    output: {
      r8UnlockReviewedRouteCount: report.reviewedRouteCount,
      r8UnlockEvidenceSourceCount: report.evidenceSourceCount,
      r8UnlockRuntimeEligibleCount: 0,
      r8UnlockRuntimePublicationAuthorized: false
    }
  }
}

module.exports = {
  R8UnlockRouteOutputFilenames,
  buildR8UnlockRouteArtifacts,
  validateUnlockCatalog,
  validateUnlockEvidence
}

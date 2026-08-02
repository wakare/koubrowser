const fs = require('node:fs')
const path = require('node:path')
const { canonicalJson, digest, routeSemanticDigest } = require('./quest-growth-r8-eo-route')

const CompilerVersion = 'quest-growth-r8-training-route-validator/1'
const R8TrainingRouteOutputFilenames = ['r8-training-route-validation-report.json']
const CatalogPath = 'knowledge/quest-growth/r8/training-route-catalog.json'
const EvidencePath = 'knowledge/quest-growth/r8/training-evidence-snapshots.json'
const R6LineagesPath = 'knowledge/quest-growth/authoring/route-lineages.json'
const R6UnitsPath = 'knowledge/quest-growth/authoring/route-units.json'
const FixedRouteId = 'route:practice-remodel-modernization-loop:draft-1'
const FixedFamily = 'experience-remodel-modernization'
const FixedLineageId = 'growth-lineage:experience-remodel-modernization'
const FixedUnitId = 'growth-route:experience-remodel-modernization:baseline'
const ExerciseClaim = 'claim:exercise-low-repair-training'
const ModernizationClaim = 'claim:modernization-before-after-remodel'
const FixedSourceBindings = [
  {
    sourceId: 'source:wikiwiki-newcomer-r8-training',
    group: 'group:wikiwiki-ja',
    claims: [ExerciseClaim, ModernizationClaim],
    evidenceClass: 'training-and-modernization'
  },
  {
    sourceId: 'source:kcwiki-leveling-r8-training',
    group: 'group:kcwiki-zh',
    claims: [ExerciseClaim],
    evidenceClass: 'training'
  },
  {
    sourceId: 'source:kcwiki-modernization-r8-training',
    group: 'group:kcwiki-zh',
    claims: [ModernizationClaim],
    evidenceClass: 'modernization'
  }
]
const FixedSegments = [
  {
    segmentId: 'segment:practice-training-check',
    actionCategory: 'training',
    targetNodes: ['演習'],
    claim: ExerciseClaim,
    sourceIndexes: [0, 1]
  },
  {
    segmentId: 'segment:remodel-readiness-check',
    actionCategory: 'remodel',
    targetNodes: ['改造'],
    claim: ModernizationClaim,
    sourceIndexes: [0, 2]
  },
  {
    segmentId: 'segment:normal-modernization-check',
    actionCategory: 'modernization',
    targetNodes: ['近代化改修'],
    claim: ModernizationClaim,
    sourceIndexes: [0, 2]
  }
]
const RequiredObservables = [
  'practice.available-count',
  'ships.level-bands',
  'ships.remodel-ready',
  'modernization.gaps',
  'modernization.material-summary'
]
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

function validateTrainingEvidence(value) {
  exactKeys(
    value,
    ['authoringSchema', 'snapshotVersion', 'sourceSnapshot', 'sources'],
    'R8 training evidence packet'
  )
  if (
    value.authoringSchema !== 'QuestGrowthR8EvidenceSnapshots/1alpha' ||
    value.snapshotVersion !== '1.0.0-alpha.1'
  ) {
    throw new Error('unsupported R8 training evidence packet')
  }
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R8 training snapshot')
  if (!/^[0-9a-f]{40}$/.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R8 training evidence base commit')
  }
  timestamp(value.sourceSnapshot.checkedAt, 'R8 training evidence checkedAt')
  if (!Array.isArray(value.sources) || value.sources.length !== FixedSourceBindings.length) {
    throw new Error('R8 training route requires exactly three evidence sources')
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
      `R8 training source ${index}`
    )
    const binding = FixedSourceBindings[index]
    if (
      source.sourceId !== binding.sourceId ||
      source.independenceGroupId !== binding.group ||
      !/^https:\/\//.test(source.url) ||
      source.accessibility !== 'independently-readable' ||
      source.evidenceClass !== binding.evidenceClass ||
      JSON.stringify(source.supportedClaims) !== JSON.stringify(binding.claims)
    ) {
      throw new Error(`R8 training source ${index} binding mismatch`)
    }
    requiredText(source.title, 'R8 training source title')
    requiredText(source.site, 'R8 training source site')
    requiredText(source.language, 'R8 training source language')
    const checkedAt = timestamp(source.checkedAt, 'R8 training source checkedAt')
    const reviewBy = timestamp(source.reviewBy, 'R8 training source reviewBy')
    const validUntil = timestamp(source.validUntil, 'R8 training source validUntil')
    if (
      Date.parse(checkedAt) >= Date.parse(reviewBy) ||
      Date.parse(reviewBy) >= Date.parse(validUntil)
    ) {
      throw new Error('R8 training source currentness window mismatch')
    }
    if (!Array.isArray(source.facts) || source.facts.length < 4) {
      throw new Error('R8 training source has insufficient concrete facts')
    }
    source.facts.forEach((fact) => {
      exactKeys(fact, ['factId', 'statement'], 'R8 training evidence fact')
      requiredText(fact.factId, 'R8 training fact id')
      requiredText(fact.statement, 'R8 training fact statement')
    })
    uniqueTextList(source.notes, 'R8 training source notes', 2)
    sourcesByDigest.set(digest(canonicalJson(source)), source)
  })
  if (new Set(value.sources.map((source) => source.independenceGroupId)).size !== 2) {
    throw new Error('R8 training evidence must retain two independent groups')
  }
  return { value, sourcesByDigest }
}

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
    `R8 training segment ${index}`
  )
  const fixed = FixedSegments[index]
  if (
    !fixed ||
    segment.segmentId !== fixed.segmentId ||
    segment.actionCategory !== fixed.actionCategory ||
    segment.mapKey !== null ||
    JSON.stringify(segment.targetNodes) !== JSON.stringify(fixed.targetNodes) ||
    JSON.stringify(segment.formations) !== '[]' ||
    segment.airState !== null
  ) {
    throw new Error(`R8 training segment ${index} mechanic binding mismatch`)
  }
  uniqueTextList(segment.fleetConstraints, 'R8 training fleet constraints', 4)
  uniqueTextList(segment.equipmentConstraints, 'R8 training equipment constraints', 1)
  uniqueTextList(segment.branchConditions, 'R8 training branch conditions', 3)
  uniqueTextList(segment.sortieInstructions, 'R8 training instructions', 5)
  requiredText(segment.fallback, 'R8 training segment fallback')
  if (!Array.isArray(segment.concreteEvidenceRefs) || segment.concreteEvidenceRefs.length !== 2) {
    throw new Error('R8 training segment requires two evidence references')
  }
  segment.concreteEvidenceRefs.forEach((reference, sourceIndex) => {
    exactKeys(
      reference,
      ['claimRef', 'independenceGroupId', 'sourceDigest'],
      'R8 training evidence ref'
    )
    const source = evidence.sourcesByDigest.get(reference.sourceDigest)
    const expectedSource = evidence.value.sources[fixed.sourceIndexes[sourceIndex]]
    if (
      reference.claimRef !== fixed.claim ||
      reference.independenceGroupId !== expectedSource.independenceGroupId ||
      !DigestPattern.test(reference.sourceDigest) ||
      source !== expectedSource ||
      !source.supportedClaims.includes(fixed.claim)
    ) {
      throw new Error('R8 training evidence reference mismatch')
    }
  })
  if (new Set(segment.concreteEvidenceRefs.map((item) => item.independenceGroupId)).size !== 2) {
    throw new Error('R8 training segment evidence is not independent')
  }
}

function validateTrainingCatalog(value, evidence, r6Lineages, r6Units) {
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
    'R8 training catalog'
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
    throw new Error('R8 training catalog contract mismatch')
  }
  exactKeys(
    value.sourceSnapshot,
    ['auditedBaseCommit', 'checkedAt'],
    'R8 training catalog snapshot'
  )
  if (!/^[0-9a-f]{40}$/.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R8 training catalog base commit')
  }
  const checkedAt = timestamp(value.sourceSnapshot.checkedAt, 'R8 training catalog checkedAt')
  exactKeys(
    value.runtimeContract,
    ['defaultVisible', 'sessionOnly', 'runtimePublicationAuthorized', 'runtimeEligibleCount'],
    'R8 training runtime contract'
  )
  if (
    value.runtimeContract.defaultVisible !== false ||
    value.runtimeContract.sessionOnly !== true ||
    value.runtimeContract.runtimePublicationAuthorized !== false ||
    value.runtimeContract.runtimeEligibleCount !== 0
  ) {
    throw new Error('R8 training runtime boundary widened')
  }

  const lineage = r6Lineages.lineages.find(
    (item) => item.routeLineageId === FixedLineageId && item.revision === 1
  )
  const unit = r6Units.units.find((item) => item.routeUnitId === FixedUnitId && item.revision === 1)
  const observableIds = new Set(
    unit?.requiredObservables?.map((observable) => observable.observableId)
  )
  if (
    !lineage ||
    lineage.status !== 'reviewed' ||
    lineage.routeFamily !== FixedFamily ||
    !lineage.claimRefs.includes(ExerciseClaim) ||
    !lineage.claimRefs.includes(ModernizationClaim) ||
    !lineage.routeUnitRefs.some(
      (reference) => reference.id === FixedUnitId && reference.revision === 1
    ) ||
    !unit ||
    unit.status !== 'reviewed' ||
    unit.lineageRef.id !== FixedLineageId ||
    !unit.prerequisites.includes('material-safety:manual-check') ||
    RequiredObservables.some((observableId) => !observableIds.has(observableId))
  ) {
    throw new Error('R8 training route is not bound to the reviewed R6 lineage and unit')
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
    'R8 training route'
  )
  if (
    route.routeId !== FixedRouteId ||
    route.routeFamily !== FixedFamily ||
    route.revision !== 1 ||
    route.status !== 'reviewed' ||
    route.outputClass !== 'manual-check-route'
  ) {
    throw new Error('R8 training route identity mismatch')
  }
  exactKeys(route.lineageRef, ['id', 'revision'], 'R8 training lineage reference')
  if (route.lineageRef.id !== FixedLineageId || route.lineageRef.revision !== 1) {
    throw new Error('R8 training lineage reference mismatch')
  }
  requiredText(route.title, 'R8 training route title')
  requiredText(route.summary, 'R8 training route summary')
  uniqueTextList(route.applicability, 'R8 training route applicability', 5)
  if (!Array.isArray(route.segments) || route.segments.length !== FixedSegments.length) {
    throw new Error('R8 training route requires three fixed segments')
  }
  route.segments.forEach((segment, index) => validateSegment(segment, index, evidence))

  exactKeys(route.currentness, ['reviewBy', 'validUntil'], 'R8 training route currentness')
  const reviewBy = timestamp(route.currentness.reviewBy, 'R8 training route reviewBy')
  const validUntil = timestamp(route.currentness.validUntil, 'R8 training route validUntil')
  if (
    Date.parse(checkedAt) >= Date.parse(reviewBy) ||
    Date.parse(reviewBy) >= Date.parse(validUntil) ||
    reviewBy !== lineage.currentness.reviewBy ||
    validUntil !== lineage.currentness.validUntil
  ) {
    throw new Error('R8 training route currentness window mismatch')
  }
  requiredText(route.fallback, 'R8 training route fallback')
  exactKeys(
    route.review,
    ['author', 'approver', 'reviewedAt', 'approvalDigest'],
    'R8 training review'
  )
  if (
    route.review.author !== 'codex-r8-training-route-author' ||
    route.review.approver !== 'project-owner' ||
    timestamp(route.review.reviewedAt, 'R8 training reviewedAt') !== checkedAt ||
    route.review.approvalDigest !== routeSemanticDigest(route)
  ) {
    throw new Error('R8 training independent review mismatch')
  }
  return { value, route, routeSemanticDigest: routeSemanticDigest(route) }
}

function buildR8TrainingRouteArtifacts({ root }) {
  const catalogRaw = fs.readFileSync(path.join(root, ...CatalogPath.split('/')))
  const evidenceRaw = fs.readFileSync(path.join(root, ...EvidencePath.split('/')))
  const r6Lineages = JSON.parse(
    fs.readFileSync(path.join(root, ...R6LineagesPath.split('/')), 'utf8')
  )
  const r6Units = JSON.parse(fs.readFileSync(path.join(root, ...R6UnitsPath.split('/')), 'utf8'))
  const evidence = validateTrainingEvidence(JSON.parse(evidenceRaw))
  const catalog = validateTrainingCatalog(JSON.parse(catalogRaw), evidence, r6Lineages, r6Units)
  const report = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    generatedAt: catalog.value.sourceSnapshot.checkedAt,
    status: 'R8_TRAINING_BUNDLED_OPT_IN_ROUTE_REVIEWED',
    catalogDigest: digest(catalogRaw),
    evidenceSnapshotDigest: digest(evidenceRaw),
    routeId: catalog.route.routeId,
    routeFamily: catalog.route.routeFamily,
    routeSemanticDigest: catalog.routeSemanticDigest,
    evidenceSourceCount: evidence.value.sources.length,
    independentEvidenceGroupCount: new Set(
      evidence.value.sources.map((source) => source.independenceGroupId)
    ).size,
    reviewedRouteCount: 1,
    defaultVisible: false,
    sessionOnly: true,
    runtimePublicationAuthorized: false,
    runtimeEligibleCount: 0
  }
  return {
    artifacts: { 'r8-training-route-validation-report.json': report },
    source: {
      r8TrainingRouteCatalogDigest: report.catalogDigest,
      r8TrainingEvidenceSnapshotDigest: report.evidenceSnapshotDigest
    },
    output: {
      r8TrainingReviewedRouteCount: report.reviewedRouteCount,
      r8TrainingEvidenceSourceCount: report.evidenceSourceCount,
      r8TrainingIndependentEvidenceGroupCount: report.independentEvidenceGroupCount,
      r8TrainingRuntimeEligibleCount: 0,
      r8TrainingRuntimePublicationAuthorized: false
    }
  }
}

module.exports = {
  R8TrainingRouteOutputFilenames,
  buildR8TrainingRouteArtifacts,
  validateTrainingCatalog,
  validateTrainingEvidence
}

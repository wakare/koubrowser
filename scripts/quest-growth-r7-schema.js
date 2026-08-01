const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const R7SchemaCompilerVersion = 'quest-growth-r7-schema-validator/2'
const R7SchemaOutputFilenames = ['r7-schema-validation-report.json']
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const FixtureIdentifierPattern = /^fixture:[A-Za-z0-9._:/-]+$/
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const SelectedPilotFamilies = ['expedition-resource-periodic-loop', 'anti-submarine-foundation']

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
  for (const key of required) {
    if (!(key in value)) throw new Error(`missing ${description} ${key}`)
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`unexpected ${description} ${key}`)
  }
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function requiredText(value, description) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`invalid ${description}`)
  return value
}

function identifier(value, description) {
  const result = requiredText(value, description)
  if (!IdentifierPattern.test(result)) throw new Error(`invalid ${description}`)
  return result
}

function timestamp(value, description) {
  const result = requiredText(value, description)
  if (!TimestampPattern.test(result) || !Number.isFinite(Date.parse(result))) {
    throw new Error(`invalid ${description}`)
  }
  return result
}

function uniqueList(value, description, validate, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum) throw new Error(`invalid ${description}`)
  const result = value.map((item, index) => validate(item, `${description} ${index}`))
  if (new Set(result.map((item) => JSON.stringify(item))).size !== result.length) {
    throw new Error(`duplicate ${description}`)
  }
  return result
}

function validateSchemaContract(schema) {
  exactKeys(
    schema,
    [
      '$schema',
      '$id',
      'title',
      'description',
      'type',
      'additionalProperties',
      'required',
      'properties',
      '$defs'
    ],
    'R7 schema'
  )
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    throw new Error('R7 schema must use JSON Schema 2020-12')
  }
  if (schema.title !== 'QuestGrowthConcreteRouteAuthoring/1alpha') {
    throw new Error('unsupported R7 schema title')
  }
  if (schema.type !== 'object' || schema.additionalProperties !== false) {
    throw new Error('R7 catalog schema must reject unknown fields')
  }
  if (schema.properties?.publicationAuthorization?.const !== 'R7_NOT_AUTHORIZED') {
    throw new Error('R7 schema must keep publication unauthorized')
  }
  const route = schema.$defs?.concreteRoute
  const segment = schema.$defs?.concreteSegment
  if (route?.additionalProperties !== false || segment?.additionalProperties !== false) {
    throw new Error('R7 concrete schema must reject unknown fields')
  }
  const requiredConcreteFields = [
    'mapKey',
    'targetNodes',
    'fleetConstraints',
    'equipmentConstraints',
    'formations',
    'airState',
    'branchConditions',
    'sortieInstructions',
    'concreteEvidenceRefs'
  ]
  if (requiredConcreteFields.some((field) => !segment.required.includes(field))) {
    throw new Error('R7 schema is missing a required concrete field')
  }
  if (segment.properties?.concreteEvidenceRefs?.minItems !== 2) {
    throw new Error('R7 schema must require two concrete evidence references')
  }
  if (!same(schema.properties?.selectedPilotFamilies?.maxItems, 2)) {
    throw new Error('R7 schema pilot limit mismatch')
  }
  return schema
}

function validateEvidenceSnapshots(packet, knownIndependenceGroups) {
  exactKeys(
    packet,
    ['authoringSchema', 'snapshotVersion', 'sourceSnapshot', 'sources'],
    'R7 evidence snapshot packet'
  )
  if (packet.authoringSchema !== 'QuestGrowthR7EvidenceSnapshots/1alpha') {
    throw new Error('unsupported R7 evidence snapshot schema')
  }
  requiredText(packet.snapshotVersion, 'R7 evidence snapshot version')
  exactKeys(
    packet.sourceSnapshot,
    ['auditedBaseCommit', 'checkedAt'],
    'R7 evidence source snapshot'
  )
  if (!/^[0-9a-f]{40}$/.test(packet.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R7 evidence audited base commit')
  }
  timestamp(packet.sourceSnapshot.checkedAt, 'R7 evidence checkedAt')
  const sourcesByDigest = new Map()
  const sourceIds = new Set()
  uniqueList(
    packet.sources,
    'R7 concrete evidence sources',
    (source, description) => {
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
        description
      )
      const sourceId = identifier(source.sourceId, `${description} id`)
      if (sourceIds.has(sourceId)) throw new Error(`duplicate R7 evidence source ${sourceId}`)
      sourceIds.add(sourceId)
      const independenceGroupId = identifier(
        source.independenceGroupId,
        `${description} independence group`
      )
      if (!knownIndependenceGroups.has(independenceGroupId)) {
        throw new Error(`${description} references an unapproved R6 independence group`)
      }
      if (!/^https:\/\//.test(requiredText(source.url, `${description} URL`))) {
        throw new Error(`invalid ${description} URL`)
      }
      requiredText(source.title, `${description} title`)
      requiredText(source.site, `${description} site`)
      requiredText(source.language, `${description} language`)
      if (source.accessibility !== 'independently-readable') {
        throw new Error(`${description} must be independently readable`)
      }
      if (!['mechanic', 'editorial'].includes(source.evidenceClass)) {
        throw new Error(`invalid ${description} evidence class`)
      }
      const checkedAt = timestamp(source.checkedAt, `${description} checkedAt`)
      const reviewBy = timestamp(source.reviewBy, `${description} reviewBy`)
      const validUntil = timestamp(source.validUntil, `${description} validUntil`)
      if (
        Date.parse(checkedAt) >= Date.parse(reviewBy) ||
        Date.parse(reviewBy) >= Date.parse(validUntil)
      ) {
        throw new Error(`${description} currentness window is invalid`)
      }
      uniqueList(source.supportedClaims, `${description} supported claims`, identifier, 1)
      uniqueList(
        source.facts,
        `${description} facts`,
        (fact, factDescription) => {
          exactKeys(fact, ['factId', 'statement'], factDescription)
          identifier(fact.factId, `${factDescription} id`)
          requiredText(fact.statement, `${factDescription} statement`)
          return fact.factId
        },
        1
      )
      uniqueList(source.notes, `${description} notes`, requiredText, 1)
      const sourceDigest = digest(canonicalJson(source))
      if (sourcesByDigest.has(sourceDigest)) throw new Error('duplicate R7 evidence source digest')
      sourcesByDigest.set(sourceDigest, source)
      return sourceId
    },
    4
  )
  return { packet, sourcesByDigest }
}

function validateConcreteRoute(route, binding, evidence, contentRequest) {
  const routeKeys = [
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
  ]
  exactKeys(route, routeKeys, 'R7 concrete route')
  identifier(route.routeId, 'R7 route id')
  if (route.routeFamily !== binding.routeFamily || route.revision !== 1) {
    throw new Error(`R7 route binding mismatch ${route.routeId}`)
  }
  exactKeys(route.lineageRef, ['id', 'revision'], 'R7 route lineage reference')
  if (
    route.lineageRef.id !== binding.lineage.id ||
    route.lineageRef.revision !== binding.lineage.revision ||
    !DigestPattern.test(binding.lineage.semanticDigest)
  ) {
    throw new Error(`R7 route lineage approval binding mismatch ${route.routeId}`)
  }
  if (route.status !== 'draft') throw new Error(`R7 route must remain draft ${route.routeId}`)
  if (!contentRequest.authoringRequirements.allowedOutputClasses.includes(route.outputClass)) {
    throw new Error(`R7 route output class is not authorized ${route.routeId}`)
  }
  if (route.outputClass === 'reviewed-concrete-route') {
    throw new Error(`R7 reviewed route output is not authorized ${route.routeId}`)
  }
  requiredText(route.title, 'R7 route title')
  requiredText(route.summary, 'R7 route summary')
  uniqueList(route.applicability, 'R7 route applicability', requiredText, 1)
  const expectedClaim =
    route.routeFamily === 'expedition-resource-periodic-loop'
      ? 'claim:expedition-resource-loop'
      : 'claim:conditional-leveling-maps'
  uniqueList(
    route.segments,
    'R7 route segments',
    (segment, description) => {
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
        description
      )
      identifier(segment.segmentId, `${description} id`)
      if (
        !['manual-check', 'expedition', 'sortie', 'stop-and-reassess'].includes(
          segment.actionCategory
        )
      ) {
        throw new Error(`invalid ${description} action category`)
      }
      if (segment.mapKey !== null) requiredText(segment.mapKey, `${description} map key`)
      uniqueList(segment.targetNodes, `${description} target nodes`, identifier)
      uniqueList(segment.fleetConstraints, `${description} fleet constraints`, requiredText, 1)
      uniqueList(segment.equipmentConstraints, `${description} equipment constraints`, requiredText)
      uniqueList(segment.formations, `${description} formations`, identifier)
      if (segment.airState !== null) requiredText(segment.airState, `${description} air state`)
      uniqueList(segment.branchConditions, `${description} branch conditions`, requiredText, 1)
      uniqueList(segment.sortieInstructions, `${description} instructions`, requiredText, 1)
      const evidenceGroups = new Set()
      uniqueList(
        segment.concreteEvidenceRefs,
        `${description} evidence references`,
        (reference, referenceDescription) => {
          exactKeys(
            reference,
            ['claimRef', 'independenceGroupId', 'sourceDigest'],
            referenceDescription
          )
          if (reference.claimRef !== expectedClaim) {
            throw new Error(`${referenceDescription} claim does not match the R6 lineage`)
          }
          identifier(reference.independenceGroupId, `${referenceDescription} group`)
          if (!DigestPattern.test(reference.sourceDigest)) {
            throw new Error(`invalid ${referenceDescription} source digest`)
          }
          const source = evidence.sourcesByDigest.get(reference.sourceDigest)
          if (
            !source ||
            source.independenceGroupId !== reference.independenceGroupId ||
            !source.supportedClaims.includes(reference.claimRef)
          ) {
            throw new Error(`${referenceDescription} source binding mismatch`)
          }
          evidenceGroups.add(reference.independenceGroupId)
          return `${reference.claimRef}:${reference.independenceGroupId}:${reference.sourceDigest}`
        },
        2
      )
      if (evidenceGroups.size < 2) {
        throw new Error(`${description} requires two independent editorial groups`)
      }
      requiredText(segment.fallback, `${description} fallback`)
      return segment.segmentId
    },
    1
  )
  exactKeys(route.currentness, ['reviewBy', 'validUntil'], 'R7 route currentness')
  const reviewBy = timestamp(route.currentness.reviewBy, 'R7 route reviewBy')
  const validUntil = timestamp(route.currentness.validUntil, 'R7 route validUntil')
  if (Date.parse(reviewBy) >= Date.parse(validUntil)) {
    throw new Error(`R7 route currentness window is invalid ${route.routeId}`)
  }
  requiredText(route.fallback, 'R7 route fallback')
  exactKeys(route.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], 'R7 route review')
  identifier(route.review.author, 'R7 route author')
  if (
    route.review.author === contentRequest.review.approver ||
    route.review.approver !== null ||
    route.review.reviewedAt !== null ||
    route.review.approvalDigest !== null
  ) {
    throw new Error(`R7 draft route must remain independently unreviewed ${route.routeId}`)
  }
  return route.routeId
}

function validateCatalog(catalog, request, decisionReport, contentRequest, evidence) {
  exactKeys(
    catalog,
    [
      'authoringSchema',
      'catalogVersion',
      'status',
      'sourceSnapshot',
      'decisionRequestRef',
      'selectedPilotFamilies',
      'publicationAuthorization',
      'routes'
    ],
    'R7 route catalog'
  )
  if (
    catalog.authoringSchema !== 'QuestGrowthConcreteRouteCatalog/1alpha' ||
    catalog.status !== 'draft'
  ) {
    throw new Error('R7 catalog must remain draft')
  }
  const schemaGate = decisionReport.authorizationGates.find(
    (gate) => gate.gateId === 'r7-schema-output-class'
  )
  const contentGate = decisionReport.authorizationGates.find(
    (gate) => gate.gateId === 'r7-pilot-content-authoring'
  )
  if (schemaGate?.authorizationState !== 'authorized') {
    throw new Error('R7 schema gate is not authorized')
  }
  if (contentGate?.authorizationState !== 'authorized') {
    throw new Error('R7 pilot content gate is not authorized')
  }
  if (
    catalog.decisionRequestRef.id !== request.requestId ||
    catalog.decisionRequestRef.revision !== request.revision ||
    catalog.decisionRequestRef.schemaGateDigest !== schemaGate.semanticDigest
  ) {
    throw new Error('R7 catalog decision binding mismatch')
  }
  if (
    !same(catalog.selectedPilotFamilies, SelectedPilotFamilies) ||
    !same(catalog.selectedPilotFamilies, request.pilotProposal.selectedInitialFamilies)
  ) {
    throw new Error('R7 catalog selected pilot mismatch')
  }
  if (catalog.publicationAuthorization !== 'R7_NOT_AUTHORIZED') {
    throw new Error('R7 catalog must not authorize publication')
  }
  if (!Array.isArray(catalog.routes) || catalog.routes.length !== 2) {
    throw new Error('R7 pilot content catalog must contain exactly two approved-family drafts')
  }
  const bindings = new Map(
    contentRequest.pilotBindings.map((binding) => [binding.routeFamily, binding])
  )
  const families = uniqueList(
    catalog.routes,
    'R7 concrete routes',
    (route) => {
      const binding = bindings.get(route.routeFamily)
      if (!binding) throw new Error(`R7 route outside selected pilot families ${route.routeFamily}`)
      validateConcreteRoute(route, binding, evidence, contentRequest)
      return route.routeFamily
    },
    2
  )
  if (!same(families, SelectedPilotFamilies)) {
    throw new Error('R7 route family set or order mismatch')
  }
  return catalog
}

function requireFixtureIdentifier(value, description) {
  if (!FixtureIdentifierPattern.test(value)) throw new Error(`non-anonymous ${description}`)
}

function validateConcreteFixture(route, containsAccountIdentifier) {
  if (containsAccountIdentifier) return ['FIXTURE_PRIVACY_VIOLATION']
  const routeKeys = [
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
  ]
  try {
    exactKeys(route, routeKeys, 'fixture route')
  } catch (error) {
    if (String(error.message).includes('unexpected')) return ['UNKNOWN_FIELD']
    throw error
  }
  requireFixtureIdentifier(route.routeId, 'fixture route id')
  if (!Array.isArray(route.segments) || route.segments.length === 0) {
    return ['CONCRETE_SEGMENT_MISSING']
  }
  const segmentKeys = [
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
  ]
  for (const segment of route.segments) {
    try {
      exactKeys(segment, segmentKeys, 'fixture segment')
    } catch (error) {
      if (String(error.message).includes('unexpected')) return ['UNKNOWN_FIELD']
      throw error
    }
    requireFixtureIdentifier(segment.segmentId, 'segment id')
    requireFixtureIdentifier(segment.mapKey, 'map key')
    for (const value of [...segment.targetNodes, ...segment.formations]) {
      requireFixtureIdentifier(value, 'route token')
    }
    if (!Array.isArray(segment.concreteEvidenceRefs) || segment.concreteEvidenceRefs.length < 2) {
      return ['CONCRETE_FIELD_EVIDENCE_MISSING']
    }
    for (const evidence of segment.concreteEvidenceRefs) {
      requireFixtureIdentifier(evidence.claimRef, 'claim reference')
      requireFixtureIdentifier(evidence.independenceGroupId, 'independence group')
      if (!DigestPattern.test(evidence.sourceDigest)) return ['INVALID_EVIDENCE_DIGEST']
    }
  }
  return []
}

function applyMutation(baseRoute, mutation) {
  const route = structuredClone(baseRoute)
  if (mutation === 'none') return route
  if (mutation === 'remove-concrete-evidence') {
    route.segments[0].concreteEvidenceRefs = []
    return route
  }
  if (mutation === 'add-unknown-field') {
    route.unknownField = true
    return route
  }
  throw new Error(`unsupported R7 fixture mutation ${mutation}`)
}

function validateFixturePacket(packet, contentAuthorized = true) {
  exactKeys(
    packet,
    ['authoringSchema', 'fixtureVersion', 'privacy', 'baseRoute', 'cases'],
    'R7 fixture packet'
  )
  if (packet.authoringSchema !== 'QuestGrowthR7SchemaFixtures/1alpha') {
    throw new Error('unsupported R7 fixture schema')
  }
  if (
    packet.privacy?.containsAccountIdentifier !== false ||
    packet.privacy?.containsRawPayload !== false
  ) {
    throw new Error('R7 fixture packet must be anonymous and synthetic')
  }
  if (!Array.isArray(packet.cases) || packet.cases.length === 0) {
    throw new Error('R7 fixture cases missing')
  }
  const caseIds = new Set()
  const results = packet.cases.map((fixtureCase) => {
    exactKeys(
      fixtureCase,
      ['caseId', 'mutation', 'containsAccountIdentifier', 'expected'],
      'R7 fixture case'
    )
    if (caseIds.has(fixtureCase.caseId)) throw new Error('duplicate R7 fixture case id')
    caseIds.add(fixtureCase.caseId)
    const route = applyMutation(packet.baseRoute, fixtureCase.mutation)
    const reasonCodes = validateConcreteFixture(route, fixtureCase.containsAccountIdentifier)
    const schemaDecision = reasonCodes.length === 0 ? 'VALID' : 'INVALID'
    const actual = {
      schemaDecision,
      contentDecision:
        schemaDecision === 'VALID' && contentAuthorized ? 'AUTHORIZED_DRAFT_ONLY' : 'BLOCKED',
      reasonCodes:
        reasonCodes.length === 0
          ? [contentAuthorized ? 'R7_DRAFT_ONLY_NO_RUNTIME' : 'R7_PILOT_CONTENT_NOT_AUTHORIZED']
          : reasonCodes
    }
    if (!same(actual, fixtureCase.expected)) {
      throw new Error(`R7 fixture expectation mismatch ${fixtureCase.caseId}`)
    }
    return { caseId: fixtureCase.caseId, ...actual }
  })
  return results
}

function buildR7SchemaArtifacts({ base, r7DecisionReport }) {
  const schemaPath = path.join(base, 'r7-authoring-schema-1alpha.json')
  const catalogPath = path.join(base, 'r7', 'route-catalog.json')
  const fixturePath = path.join(base, 'fixtures', 'r7-schema', 'schema-cases.json')
  const requestPath = path.join(base, 'decisions', 'r7-authorization-request.json')
  const contentRequestPath = path.join(
    base,
    'decisions',
    'r7-pilot-content-authorization-request.json'
  )
  const evidencePath = path.join(base, 'r7', 'evidence-snapshots.json')
  const routeEvidenceLineagePath = path.join(base, 'authoring', 'route-evidence-lineage.json')
  const schemaRaw = fs.readFileSync(schemaPath)
  const catalogRaw = fs.readFileSync(catalogPath)
  const fixtureRaw = fs.readFileSync(fixturePath)
  const requestRaw = fs.readFileSync(requestPath)
  const contentRequestRaw = fs.readFileSync(contentRequestPath)
  const evidenceRaw = fs.readFileSync(evidencePath)
  const routeEvidenceLineageRaw = fs.readFileSync(routeEvidenceLineagePath)
  const schema = validateSchemaContract(JSON.parse(schemaRaw))
  const request = JSON.parse(requestRaw)
  const contentRequest = JSON.parse(contentRequestRaw)
  const routeEvidenceLineage = JSON.parse(routeEvidenceLineageRaw)
  const knownIndependenceGroups = new Set(
    routeEvidenceLineage.independenceGroups.map((group) => group.independenceGroupId)
  )
  const evidence = validateEvidenceSnapshots(JSON.parse(evidenceRaw), knownIndependenceGroups)
  const catalog = validateCatalog(
    JSON.parse(catalogRaw),
    request,
    r7DecisionReport,
    contentRequest,
    evidence
  )
  const fixtureResults = validateFixturePacket(JSON.parse(fixtureRaw), true)
  const report = {
    schemaVersion: 1,
    compilerVersion: R7SchemaCompilerVersion,
    generatedAt: catalog.sourceSnapshot.checkedAt,
    status: 'CONTENT_AUTHORING_AUTHORIZED_DRAFT_ONLY',
    schemaTitle: schema.title,
    schemaGateAuthorization: 'authorized',
    pilotContentAuthorization: 'authorized',
    selectedPilotFamilies: catalog.selectedPilotFamilies,
    schemaDigest: digest(schemaRaw),
    catalogDigest: digest(catalogRaw),
    fixtureDigest: digest(fixtureRaw),
    evidenceSnapshotDigest: digest(evidenceRaw),
    evidenceSourceCount: evidence.packet.sources.length,
    catalogRouteCount: catalog.routes.length,
    concreteRouteArtifactCount: catalog.routes.length,
    fixtureCaseCount: fixtureResults.length,
    fixtureValidationPassed: true,
    fixtureResults,
    publicationAuthorization: 'R7_NOT_AUTHORIZED',
    runtimeEligibleCount: 0
  }
  return {
    artifacts: { 'r7-schema-validation-report.json': report },
    source: {
      r7AuthoringSchemaDigest: digest(schemaRaw),
      r7RouteCatalogDigest: digest(catalogRaw),
      r7SchemaFixtureDigest: digest(fixtureRaw),
      r7EvidenceSnapshotDigest: digest(evidenceRaw)
    },
    output: {
      r7SchemaFixtureCaseCount: fixtureResults.length,
      r7SchemaFixtureValidationPassed: true,
      r7ConcreteEvidenceSourceCount: evidence.packet.sources.length,
      r7CatalogRouteCount: catalog.routes.length,
      r7SchemaRuntimeEligibleCount: 0
    }
  }
}

module.exports = {
  R7SchemaOutputFilenames,
  buildR7SchemaArtifacts,
  validateCatalog,
  validateEvidenceSnapshots,
  validateFixturePacket,
  validateSchemaContract
}

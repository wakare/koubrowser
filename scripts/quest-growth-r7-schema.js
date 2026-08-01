const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const R7SchemaCompilerVersion = 'quest-growth-r7-schema-validator/1'
const R7SchemaOutputFilenames = ['r7-schema-validation-report.json']
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const FixtureIdentifierPattern = /^fixture:[A-Za-z0-9._:/-]+$/
const SelectedPilotFamilies = [
  'expedition-resource-periodic-loop',
  'anti-submarine-foundation'
]

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

function validateSchemaContract(schema) {
  exactKeys(
    schema,
    ['$schema', '$id', 'title', 'description', 'type', 'additionalProperties', 'required', 'properties', '$defs'],
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

function validateCatalog(catalog, request, decisionReport) {
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
    catalog.status !== 'schema-only'
  ) {
    throw new Error('R7 catalog must remain schema-only')
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
  if (contentGate?.authorizationState !== 'not-authorized') {
    throw new Error('R7 pilot content gate must remain unauthorized')
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
  if (!Array.isArray(catalog.routes) || catalog.routes.length !== 0) {
    throw new Error('R7 pilot content is not authorized; route catalog must be empty')
  }
  return catalog
}

function requireFixtureIdentifier(value, description) {
  if (!FixtureIdentifierPattern.test(value)) throw new Error(`non-anonymous ${description}`)
}

function validateConcreteFixture(route, containsAccountIdentifier) {
  if (containsAccountIdentifier) return ['FIXTURE_PRIVACY_VIOLATION']
  const routeKeys = [
    'routeId', 'lineageRef', 'routeFamily', 'revision', 'status', 'outputClass', 'title',
    'summary', 'applicability', 'segments', 'currentness', 'fallback', 'review'
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
    'segmentId', 'actionCategory', 'mapKey', 'targetNodes', 'fleetConstraints',
    'equipmentConstraints', 'formations', 'airState', 'branchConditions',
    'sortieInstructions', 'concreteEvidenceRefs', 'fallback'
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

function validateFixturePacket(packet) {
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
    const actual = {
      schemaDecision: reasonCodes.length === 0 ? 'VALID' : 'INVALID',
      contentDecision: 'BLOCKED',
      reasonCodes: reasonCodes.length === 0
        ? ['R7_PILOT_CONTENT_NOT_AUTHORIZED']
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
  const schemaRaw = fs.readFileSync(schemaPath)
  const catalogRaw = fs.readFileSync(catalogPath)
  const fixtureRaw = fs.readFileSync(fixturePath)
  const requestRaw = fs.readFileSync(requestPath)
  const schema = validateSchemaContract(JSON.parse(schemaRaw))
  const request = JSON.parse(requestRaw)
  const catalog = validateCatalog(JSON.parse(catalogRaw), request, r7DecisionReport)
  const fixtureResults = validateFixturePacket(JSON.parse(fixtureRaw))
  const report = {
    schemaVersion: 1,
    compilerVersion: R7SchemaCompilerVersion,
    generatedAt: catalog.sourceSnapshot.checkedAt,
    status: 'SCHEMA_GATE_VALIDATED_CONTENT_GATE_BLOCKED',
    schemaTitle: schema.title,
    schemaGateAuthorization: 'authorized',
    pilotContentAuthorization: 'not-authorized',
    selectedPilotFamilies: catalog.selectedPilotFamilies,
    schemaDigest: digest(schemaRaw),
    catalogDigest: digest(catalogRaw),
    fixtureDigest: digest(fixtureRaw),
    catalogRouteCount: catalog.routes.length,
    concreteRouteArtifactCount: 0,
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
      r7SchemaFixtureDigest: digest(fixtureRaw)
    },
    output: {
      r7SchemaFixtureCaseCount: fixtureResults.length,
      r7SchemaFixtureValidationPassed: true,
      r7CatalogRouteCount: 0,
      r7SchemaRuntimeEligibleCount: 0
    }
  }
}

module.exports = {
  R7SchemaOutputFilenames,
  buildR7SchemaArtifacts,
  validateCatalog,
  validateFixturePacket,
  validateSchemaContract
}

const fs = require('node:fs')
const path = require('node:path')
const {
  validatePublicationCandidateFiles
} = require('./quest-growth-r7-publication-candidate')

const SchemaPath = 'knowledge/quest-growth/r7/staging-configuration.schema.json'
const FixturePath =
  'knowledge/quest-growth/r7/fixtures/staging-configuration-anonymous.json'
const FixedCandidateVersion = 'r7.candidate.20260802.1'
const FixedCandidateDigest =
  'sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c'
const FixedBindings = [
  {
    routeId: 'route:expedition-05-resource-loop:draft-1',
    routeFamily: 'expedition-resource-periodic-loop',
    revision: 1,
    semanticDigest:
      'sha256:05e4cdbbcbdbf7a781ba73bbe1bb3498cc7c0bab6985fef4b1cae6173acda55a',
    status: 'reviewed'
  },
  {
    routeId: 'route:1-5-basic-asw-three-battle:draft-1',
    routeFamily: 'anti-submarine-foundation',
    revision: 1,
    semanticDigest:
      'sha256:9b675d5c8a33b3ec974c678a3f258200324222f1e7bec1c2b2ba5e4c3512e78d',
    status: 'reviewed'
  }
]
const FixedProhibitions = [
  'key-material',
  'bundle-signing',
  'real-staging-or-production-url',
  'external-endpoint-connection',
  'runtime-publication',
  'default-enablement',
  'other-route-family',
  'game-communication-mutation',
  'installer-build'
]

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

function validateReservedManifestUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('invalid R7 staging placeholder URL')
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'r7-staging.invalid' ||
    url.username !== '' ||
    url.password !== '' ||
    url.hash !== '' ||
    url.toString() !== 'https://r7-staging.invalid/data/manifest.json'
  ) {
    throw new Error('R7 staging URL must remain a reserved .invalid placeholder')
  }
  return url.toString()
}

function validateSchemaDefinition(value) {
  exactKeys(
    value,
    ['$schema', '$id', 'title', 'type', 'additionalProperties', 'required', 'properties', '$defs'],
    'R7 staging configuration schema'
  )
  if (
    value.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
    value.$id !==
      'https://koubrowser.invalid/schema/quest-growth-r7-staging-configuration-1.json' ||
    value.type !== 'object' ||
    value.additionalProperties !== false
  ) {
    throw new Error('R7 staging configuration schema boundary mismatch')
  }
  const objectSchemas = [
    value,
    value.properties?.candidate,
    value.properties?.endpointContract,
    value.properties?.trustContract,
    value.properties?.runtimeContract,
    value.$defs?.resourcesRoute,
    value.$defs?.aswRoute
  ]
  if (
    objectSchemas.some(
      (schema) =>
        !schema || schema.type !== 'object' || schema.additionalProperties !== false
    )
  ) {
    throw new Error('R7 staging configuration schema must reject unknown fields')
  }
  if (
    value.properties?.candidate?.properties?.routeBindings?.minItems !== 2 ||
    value.properties?.candidate?.properties?.routeBindings?.maxItems !== 2 ||
    value.properties?.candidate?.properties?.routeBindings?.items !== false
  ) {
    throw new Error('R7 staging configuration schema route cardinality mismatch')
  }
  return value
}

function validateStagingConfiguration(value, root = process.cwd()) {
  exactKeys(
    value,
    [
      'schemaVersion',
      'configurationId',
      'mode',
      'candidate',
      'endpointContract',
      'trustContract',
      'runtimeContract',
      'prohibitions'
    ],
    'R7 staging configuration'
  )
  if (
    value.schemaVersion !== 1 ||
    value.configurationId !== 'r7.staging.anonymous.20260802.1' ||
    value.mode !== 'anonymous-authoring-fixture'
  ) {
    throw new Error('R7 staging configuration identity mismatch')
  }

  exactKeys(
    value.candidate,
    ['version', 'canonicalDigest', 'routeBindings'],
    'R7 staging candidate'
  )
  if (
    value.candidate.version !== FixedCandidateVersion ||
    value.candidate.canonicalDigest !== FixedCandidateDigest ||
    !same(value.candidate.routeBindings, FixedBindings)
  ) {
    throw new Error('R7 staging candidate binding mismatch')
  }
  const approvedCandidate = validatePublicationCandidateFiles(root)
  if (
    approvedCandidate.candidate.value.version !== value.candidate.version ||
    approvedCandidate.candidate.canonicalDigest !== value.candidate.canonicalDigest ||
    !same(approvedCandidate.candidate.value.routes, value.candidate.routeBindings) ||
    approvedCandidate.review.approved !== true
  ) {
    throw new Error('R7 staging candidate approval basis mismatch')
  }

  exactKeys(
    value.endpointContract,
    ['endpointClass', 'manifestUrl', 'credentialsAllowed', 'externalConnectionAllowed'],
    'R7 staging endpoint contract'
  )
  if (
    value.endpointContract.endpointClass !== 'reserved-invalid-placeholder' ||
    value.endpointContract.credentialsAllowed !== false ||
    value.endpointContract.externalConnectionAllowed !== false
  ) {
    throw new Error('R7 staging endpoint authorization widened')
  }
  validateReservedManifestUrl(value.endpointContract.manifestUrl)

  exactKeys(
    value.trustContract,
    ['algorithm', 'keyMaterialState', 'fingerprintState'],
    'R7 staging trust contract'
  )
  if (
    value.trustContract.algorithm !== 'Ed25519' ||
    value.trustContract.keyMaterialState !== 'absent-separate-gate-required' ||
    value.trustContract.fingerprintState !== 'absent-separate-gate-required'
  ) {
    throw new Error('R7 staging trust material boundary mismatch')
  }

  exactKeys(
    value.runtimeContract,
    [
      'publicationAuthorized',
      'defaultEnabled',
      'runtimeEligibleCount',
      'sessionOnly',
      'fallback'
    ],
    'R7 staging runtime contract'
  )
  if (
    value.runtimeContract.publicationAuthorized !== false ||
    value.runtimeContract.defaultEnabled !== false ||
    value.runtimeContract.runtimeEligibleCount !== 0 ||
    value.runtimeContract.sessionOnly !== true ||
    value.runtimeContract.fallback !== 'bundled-opt-in-catalog'
  ) {
    throw new Error('R7 staging runtime authorization widened')
  }
  if (!same(value.prohibitions, FixedProhibitions)) {
    throw new Error('R7 staging prohibition contract mismatch')
  }
  return {
    value,
    routeCount: value.candidate.routeBindings.length,
    candidateVersion: value.candidate.version,
    candidateCanonicalDigest: value.candidate.canonicalDigest,
    placeholderHost: 'r7-staging.invalid',
    keyMaterialPresent: false,
    externalConnectionAuthorized: false,
    runtimeEligibleCount: 0,
    defaultEnabled: false
  }
}

function validateStagingConfigurationFiles(root = process.cwd()) {
  const schema = JSON.parse(fs.readFileSync(path.join(root, ...SchemaPath.split('/')), 'utf8'))
  const fixture = JSON.parse(fs.readFileSync(path.join(root, ...FixturePath.split('/')), 'utf8'))
  validateSchemaDefinition(schema)
  return {
    schema,
    fixture: validateStagingConfiguration(fixture, root)
  }
}

if (require.main === module) {
  try {
    const result = validateStagingConfigurationFiles(process.cwd())
    console.log(
      JSON.stringify(
        {
          configurationId: result.fixture.value.configurationId,
          candidateVersion: result.fixture.candidateVersion,
          candidateCanonicalDigest: result.fixture.candidateCanonicalDigest,
          routeCount: result.fixture.routeCount,
          placeholderHost: result.fixture.placeholderHost,
          keyMaterialPresent: result.fixture.keyMaterialPresent,
          externalConnectionAuthorized: result.fixture.externalConnectionAuthorized,
          runtimeEligibleCount: result.fixture.runtimeEligibleCount,
          defaultEnabled: result.fixture.defaultEnabled
        },
        null,
        2
      )
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

module.exports = {
  FixedBindings,
  FixedProhibitions,
  validateReservedManifestUrl,
  validateSchemaDefinition,
  validateStagingConfiguration,
  validateStagingConfigurationFiles
}

const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const SchemaPath = 'knowledge/quest-growth/r7/staging-evidence.schema.json'
const FixturePath =
  'knowledge/quest-growth/r7/fixtures/staging-evidence-anonymous.json'
const CandidatePath = 'knowledge/quest-growth/r7/runtime-publication-candidate.json'
const StagingConfigurationReportPath =
  'knowledge/quest-growth/generated/r7-staging-configuration-authoring-report.json'
const ProtectedDigests = {
  'src/main/kcbrowser.ts':
    'sha256:a18725b27912dd516982a21e7146847635b3b3929a8ab1ad8b54feb53c7a0b9f',
  'src/preload/xhr-hook.ts':
    'sha256:5e0c0391350cf325a111ed7049f4fc5407d273eae0e14d0677e27cd5ebe2c502',
  'src/common/kcsapi_hook.ts':
    'sha256:e68415a7b73a2b54ed33308a260900bb4eadb8dd15e2927420ab69da63200a1e'
}
const FixedRouteIds = [
  'route:expedition-05-resource-loop:draft-1',
  'route:1-5-basic-asw-three-battle:draft-1'
]
const AllowedPublicEvidenceFields = [
  'dataVersion',
  'publishedAt',
  'manifestSha256',
  'questKnowledgeSha256',
  'publicKeySha256',
  'fileCount',
  'payloadBytes',
  'routeCount',
  'requiredCheckCount',
  'redactedAcceptanceStatus'
]
const ProhibitedFields = [
  'privateKey',
  'passphrase',
  'credential',
  'token',
  'publicKeyBytes',
  'manifestUrl',
  'localPath',
  'accountData',
  'personalIdentifier',
  'rawLog',
  'screenshot'
]
const FixedSyntheticEvidence = {
  dataVersion: 'r7.synthetic.evidence.1',
  publishedAt: '2026-08-02T00:00:00.000Z',
  manifestSha256:
    'sha256:1111111111111111111111111111111111111111111111111111111111111111',
  questKnowledgeSha256:
    'sha256:2222222222222222222222222222222222222222222222222222222222222222',
  publicKeySha256:
    'sha256:3333333333333333333333333333333333333333333333333333333333333333',
  fileCount: 1,
  payloadBytes: 1,
  routeCount: 2,
  requiredCheckCount: 10,
  redactedAcceptanceStatus: 'not-executed'
}
const FixedRoles = {
  releaseAuthor: 'actor:synthetic-external-release-author',
  evidenceReviewer: 'actor:synthetic-independent-evidence-reviewer',
  stagingOperator: 'actor:synthetic-staging-acceptance-operator'
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

function validateSchemaDefinition(value) {
  exactKeys(
    value,
    ['$schema', '$id', 'title', 'type', 'additionalProperties', 'required', 'properties'],
    'R7 staging evidence schema'
  )
  if (
    value.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
    value.$id !==
      'https://koubrowser.invalid/schema/quest-growth-r7-staging-evidence-1.json' ||
    value.type !== 'object' ||
    value.additionalProperties !== false
  ) {
    throw new Error('R7 staging evidence schema boundary mismatch')
  }
  const objectSchemas = [
    value,
    value.properties?.bindings,
    value.properties?.publicEvidence,
    value.properties?.roleSeparation,
    value.properties?.authorization
  ]
  if (
    objectSchemas.some(
      (schema) =>
        !schema || schema.type !== 'object' || schema.additionalProperties !== false
    )
  ) {
    throw new Error('R7 staging evidence schema must reject unknown fields')
  }
  return value
}

function validateProtectedCommunicationDigests(root) {
  for (const [filename, expected] of Object.entries(ProtectedDigests)) {
    const actual = digest(fs.readFileSync(path.join(root, ...filename.split('/'))))
    if (actual !== expected) {
      throw new Error(`R7 staging evidence protected communication drift: ${filename}`)
    }
  }
  return true
}

function validateStagingEvidence(value, root = process.cwd()) {
  exactKeys(
    value,
    [
      'schemaVersion',
      'evidenceId',
      'mode',
      'bindings',
      'publicEvidence',
      'roleSeparation',
      'endpointRepresentation',
      'authorization',
      'prohibitedFields'
    ],
    'R7 staging evidence'
  )
  if (
    value.schemaVersion !== 1 ||
    value.evidenceId !== 'r7.staging.evidence.anonymous.20260802.1' ||
    value.mode !== 'anonymous-offline-evidence-only'
  ) {
    throw new Error('R7 staging evidence identity mismatch')
  }

  exactKeys(
    value.bindings,
    [
      'candidateVersion',
      'candidateCanonicalDigest',
      'stagingConfigurationSemanticDigest',
      'routeIds'
    ],
    'R7 staging evidence bindings'
  )
  if (
    value.bindings.candidateVersion !== 'r7.candidate.20260802.1' ||
    value.bindings.candidateCanonicalDigest !==
      'sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c' ||
    value.bindings.stagingConfigurationSemanticDigest !==
      'sha256:3873731e2d84a85dde4685da9625fe2e4ed072f41c0de8973fa5c94e7e8cec93' ||
    !same(value.bindings.routeIds, FixedRouteIds)
  ) {
    throw new Error('R7 staging evidence binding mismatch')
  }
  const candidate = JSON.parse(
    fs.readFileSync(path.join(root, ...CandidatePath.split('/')), 'utf8')
  )
  const stagingConfiguration = JSON.parse(
    fs.readFileSync(
      path.join(root, ...StagingConfigurationReportPath.split('/')),
      'utf8'
    )
  )
  if (
    candidate.version !== value.bindings.candidateVersion ||
    stagingConfiguration.semanticDigest !==
      value.bindings.stagingConfigurationSemanticDigest ||
    stagingConfiguration.status !== 'R7_STAGING_CONFIGURATION_AUTHORING_APPROVED' ||
    stagingConfiguration.runtimeEligibleCount !== 0
  ) {
    throw new Error('R7 staging evidence approved basis mismatch')
  }

  exactKeys(value.publicEvidence, AllowedPublicEvidenceFields, 'R7 public evidence')
  if (!same(value.publicEvidence, FixedSyntheticEvidence)) {
    throw new Error('R7 staging evidence must remain fixed and synthetic')
  }

  exactKeys(value.roleSeparation, Object.keys(FixedRoles), 'R7 evidence roles')
  if (
    !same(value.roleSeparation, FixedRoles) ||
    new Set(Object.values(value.roleSeparation)).size !== 3
  ) {
    throw new Error('R7 staging evidence roles must remain distinct')
  }
  if (value.endpointRepresentation !== 'reserved-invalid-placeholder-only') {
    throw new Error('R7 staging evidence endpoint representation widened')
  }

  exactKeys(
    value.authorization,
    [
      'offlineOnly',
      'keyMaterialPresent',
      'realFingerprintPresent',
      'realEndpointPresent',
      'stagingAcceptanceAuthorized',
      'runtimePublicationAuthorized',
      'defaultEnabled',
      'runtimeEligibleCount'
    ],
    'R7 staging evidence authorization'
  )
  if (
    value.authorization.offlineOnly !== true ||
    value.authorization.runtimeEligibleCount !== 0 ||
    Object.entries(value.authorization)
      .filter(([key]) => key !== 'offlineOnly' && key !== 'runtimeEligibleCount')
      .some(([, item]) => item !== false)
  ) {
    throw new Error('R7 staging evidence execution boundary widened')
  }
  if (!same(value.prohibitedFields, ProhibitedFields)) {
    throw new Error('R7 staging evidence prohibited field mismatch')
  }
  validateProtectedCommunicationDigests(root)
  return {
    value,
    routeCount: 2,
    publicEvidenceFieldCount: AllowedPublicEvidenceFields.length,
    prohibitedFieldCount: ProhibitedFields.length,
    distinctRoleCount: 3,
    requiredCheckCount: 10,
    syntheticOnly: true,
    keyMaterialPresent: false,
    realFingerprintPresent: false,
    realEndpointPresent: false,
    stagingAcceptanceAuthorized: false,
    runtimePublicationAuthorized: false,
    defaultEnabled: false,
    runtimeEligibleCount: 0,
    protectedCommunicationDigestsFixed: true
  }
}

function validateStagingEvidenceFiles(root = process.cwd()) {
  const schema = JSON.parse(fs.readFileSync(path.join(root, ...SchemaPath.split('/')), 'utf8'))
  const fixture = JSON.parse(fs.readFileSync(path.join(root, ...FixturePath.split('/')), 'utf8'))
  validateSchemaDefinition(schema)
  return {
    schema,
    fixture: validateStagingEvidence(fixture, root)
  }
}

if (require.main === module) {
  try {
    const result = validateStagingEvidenceFiles(process.cwd()).fixture
    console.log(
      JSON.stringify(
        {
          evidenceId: result.value.evidenceId,
          routeCount: result.routeCount,
          publicEvidenceFieldCount: result.publicEvidenceFieldCount,
          prohibitedFieldCount: result.prohibitedFieldCount,
          distinctRoleCount: result.distinctRoleCount,
          requiredCheckCount: result.requiredCheckCount,
          syntheticOnly: result.syntheticOnly,
          keyMaterialPresent: result.keyMaterialPresent,
          realFingerprintPresent: result.realFingerprintPresent,
          realEndpointPresent: result.realEndpointPresent,
          stagingAcceptanceAuthorized: result.stagingAcceptanceAuthorized,
          runtimePublicationAuthorized: result.runtimePublicationAuthorized,
          defaultEnabled: result.defaultEnabled,
          runtimeEligibleCount: result.runtimeEligibleCount
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
  AllowedPublicEvidenceFields,
  ProhibitedFields,
  validateProtectedCommunicationDigests,
  validateSchemaDefinition,
  validateStagingEvidence,
  validateStagingEvidenceFiles
}

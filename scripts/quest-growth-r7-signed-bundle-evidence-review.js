const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const {
  parseArguments,
  publicKeySha256,
  requireAllowedArguments,
  requireArgument,
  verifyBundleDirectory
} = require('./create-data-update-bundle')

const SchemaPath =
  'knowledge/quest-growth/r7/signed-bundle-evidence-review.schema.json'
const FixturePath =
  'knowledge/quest-growth/r7/fixtures/signed-bundle-evidence-review-anonymous.json'
const CandidatePath = 'knowledge/quest-growth/r7/runtime-publication-candidate.json'
const QuestKnowledgePath = 'quest/knowledge.json'
const CandidateCanonicalDigest =
  'sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c'
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const VersionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/
const ProtectedDigests = {
  'src/main/kcbrowser.ts':
    'sha256:a18725b27912dd516982a21e7146847635b3b3929a8ab1ad8b54feb53c7a0b9f',
  'src/preload/xhr-hook.ts':
    'sha256:5e0c0391350cf325a111ed7049f4fc5407d273eae0e14d0677e27cd5ebe2c502',
  'src/common/kcsapi_hook.ts':
    'sha256:e68415a7b73a2b54ed33308a260900bb4eadb8dd15e2927420ab69da63200a1e'
}
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
const ProhibitedOutputFields = [
  'privateKey',
  'passphrase',
  'credential',
  'token',
  'publicKeyBytes',
  'manifestUrl',
  'stagingUrl',
  'productionUrl',
  'localPath',
  'accountData',
  'personalIdentifier',
  'rawLog',
  'screenshot',
  'bundleBytes',
  'signatureBytes'
]
const RequiredBindings = [
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
const ReviewRoleContract = Object.freeze({
  releaseAuthor: 'actor:external-release-author',
  evidenceReviewer: 'actor:independent-bundle-evidence-reviewer',
  stagingOperator: 'actor:staging-acceptance-operator'
})
const ReviewBoundary = Object.freeze({
  offlineOnly: true,
  privateKeyPersistenceAllowed: false,
  realReviewExecutionAuthorized: false,
  realPublicKeyOrFingerprintReviewAuthorized: false,
  externalEndpointConnectionAuthorized: false,
  stagingAcceptanceAuthorized: false,
  runtimePublicationAuthorized: false,
  defaultEnabled: false,
  runtimeEligibleCount: 0
})

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

function validTimestamp(value) {
  return (
    typeof value === 'string' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  )
}

function validateSchemaDefinition(value) {
  exactKeys(
    value,
    ['$schema', '$id', 'title', 'type', 'additionalProperties', 'required', 'properties'],
    'R7 signed bundle review schema'
  )
  if (
    value.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
    value.$id !==
      'https://koubrowser.invalid/schema/quest-growth-r7-signed-bundle-evidence-review-1.json' ||
    value.type !== 'object' ||
    value.additionalProperties !== false ||
    !same(value.required, AllowedPublicEvidenceFields)
  ) {
    throw new Error('R7 signed bundle review schema boundary mismatch')
  }
  exactKeys(
    value.properties,
    AllowedPublicEvidenceFields,
    'R7 signed bundle review schema properties'
  )
  return value
}

function validateReviewEvidence(value) {
  exactKeys(value, AllowedPublicEvidenceFields, 'R7 signed bundle review evidence')
  if (!VersionPattern.test(value.dataVersion) || !validTimestamp(value.publishedAt)) {
    throw new Error('R7 signed bundle review evidence identity mismatch')
  }
  for (const key of [
    'manifestSha256',
    'questKnowledgeSha256',
    'publicKeySha256'
  ]) {
    if (!DigestPattern.test(value[key])) {
      throw new Error(`invalid R7 signed bundle review evidence ${key}`)
    }
  }
  if (
    !Number.isInteger(value.fileCount) ||
    value.fileCount < 1 ||
    value.fileCount > 512 ||
    !Number.isInteger(value.payloadBytes) ||
    value.payloadBytes < 1 ||
    value.payloadBytes > 64 * 1024 * 1024 ||
    value.routeCount !== 2 ||
    value.requiredCheckCount !== 10 ||
    !['review-passed', 'anonymous-fixture-passed'].includes(
      value.redactedAcceptanceStatus
    )
  ) {
    throw new Error('R7 signed bundle review evidence contract mismatch')
  }
  return value
}

function validateCandidate(value) {
  exactKeys(
    value,
    ['schemaVersion', 'version', 'publicationAuthorization', 'routes'],
    'R7 signed bundle review candidate'
  )
  if (
    value.schemaVersion !== 1 ||
    value.version !== 'r7.candidate.20260802.1' ||
    value.publicationAuthorization !== 'R7_RUNTIME_SIGNED_CANDIDATE' ||
    !same(value.routes, RequiredBindings) ||
    digest(canonicalJson(value)) !== CandidateCanonicalDigest
  ) {
    throw new Error('R7 signed bundle review candidate binding mismatch')
  }
  return value
}

function validateProtectedCommunicationDigests(root) {
  for (const [filename, expected] of Object.entries(ProtectedDigests)) {
    const actual = digest(fs.readFileSync(path.join(root, ...filename.split('/'))))
    if (actual !== expected) {
      throw new Error(`R7 signed bundle review protected communication drift: ${filename}`)
    }
  }
  return true
}

function validateRoleSeparation() {
  if (new Set(Object.values(ReviewRoleContract)).size !== 3) {
    throw new Error('R7 signed bundle review roles must remain distinct')
  }
  return ReviewRoleContract
}

function readPublicKeyFile(filename) {
  const resolved = path.resolve(filename)
  const stats = fs.lstatSync(resolved)
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error('R7 signed bundle review public key input must be a real file')
  }
  return fs.readFileSync(resolved, 'utf8').trim()
}

function parseReviewArguments(argv) {
  const argumentsMap = parseArguments(argv)
  requireAllowedArguments(argumentsMap, new Set(['bundle', 'public-key-file']))
  return {
    bundleDirectory: requireArgument(argumentsMap, 'bundle'),
    publicKeyFile: requireArgument(argumentsMap, 'public-key-file')
  }
}

function reviewSignedBundleEvidence({ root = process.cwd(), bundleDirectory, publicKey }) {
  validateProtectedCommunicationDigests(root)
  validateRoleSeparation()
  const candidate = validateCandidate(
    JSON.parse(
      fs.readFileSync(path.join(root, ...CandidatePath.split('/')), 'utf8')
    )
  )
  const report = verifyBundleDirectory(bundleDirectory, publicKey)
  const questFile = report.files.find((item) => item.path === QuestKnowledgePath)
  if (!questFile) {
    throw new Error('R7 signed bundle review requires quest knowledge')
  }
  const questKnowledgeData = fs.readFileSync(
    path.join(bundleDirectory, ...QuestKnowledgePath.split('/'))
  )
  const questKnowledge = JSON.parse(questKnowledgeData.toString('utf8'))
  if (
    !questKnowledge.growthRoutes ||
    questKnowledge.growthRoutes.schemaVersion !== 1 ||
    questKnowledge.growthRoutes.publicationAuthorization !==
      'R7_RUNTIME_SIGNED_CANDIDATE' ||
    !same(questKnowledge.growthRoutes.routes, candidate.routes)
  ) {
    throw new Error('R7 signed bundle review route binding mismatch')
  }
  const manifestData = fs.readFileSync(path.join(bundleDirectory, 'manifest.json'))
  return validateReviewEvidence({
    dataVersion: report.dataVersion,
    publishedAt: report.publishedAt,
    manifestSha256: digest(manifestData),
    questKnowledgeSha256: digest(questKnowledgeData),
    publicKeySha256: `sha256:${publicKeySha256(publicKey)}`,
    fileCount: report.fileCount,
    payloadBytes: report.totalSize,
    routeCount: candidate.routes.length,
    requiredCheckCount: 10,
    redactedAcceptanceStatus: 'review-passed'
  })
}

function validateReviewFiles(root = process.cwd()) {
  const schema = JSON.parse(
    fs.readFileSync(path.join(root, ...SchemaPath.split('/')), 'utf8')
  )
  const fixture = JSON.parse(
    fs.readFileSync(path.join(root, ...FixturePath.split('/')), 'utf8')
  )
  return {
    schema: validateSchemaDefinition(schema),
    fixture: validateReviewEvidence(fixture)
  }
}

function runReviewCli(argv, root = process.cwd()) {
  const options = parseReviewArguments(argv)
  const evidence = reviewSignedBundleEvidence({
    root,
    bundleDirectory: options.bundleDirectory,
    publicKey: readPublicKeyFile(options.publicKeyFile)
  })
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`)
}

if (require.main === module) {
  try {
    runReviewCli(process.argv.slice(2), process.cwd())
  } catch {
    console.error('R7 signed bundle evidence review failed')
    process.exitCode = 1
  }
}

module.exports = {
  AllowedPublicEvidenceFields,
  ProhibitedOutputFields,
  ReviewBoundary,
  ReviewRoleContract,
  parseReviewArguments,
  reviewSignedBundleEvidence,
  validateCandidate,
  validateProtectedCommunicationDigests,
  validateReviewEvidence,
  validateReviewFiles,
  validateRoleSeparation,
  validateSchemaDefinition
}

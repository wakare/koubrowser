const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const R7DecisionCompilerVersion = 'quest-growth-r7-decision-compiler/1'
const R7DecisionOutputFilenames = ['r7-authorization-report.json']
const CommitPattern = /^[0-9a-f]{40}$/
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
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

function exactKeys(value, required, optional, description) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`invalid ${description}`)
  }
  const allowed = new Set([...required, ...optional])
  for (const key of required) {
    if (!(key in value)) throw new Error(`missing ${description} ${key}`)
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`unexpected ${description} ${key}`)
  }
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

function unique(values, description, validate, minimum = 0) {
  if (!Array.isArray(values) || values.length < minimum) throw new Error(`invalid ${description}`)
  const result = values.map((item, index) => validate(item, `${description} ${index}`))
  if (new Set(result.map((item) => JSON.stringify(item))).size !== result.length) {
    throw new Error(`duplicate ${description}`)
  }
  return result
}

function oneOf(value, allowed, description) {
  if (!allowed.includes(value)) throw new Error(`invalid ${description}`)
  return value
}

function semanticDigest(value, excludedKeys = []) {
  const excluded = new Set(excludedKeys)
  const payload = Object.fromEntries(
    Object.entries(value).filter(([key]) => !excluded.has(key))
  )
  return digest(canonicalJson(payload))
}

function authorizationRequestSemanticDigest(value) {
  const payload = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'status' && key !== 'review')
  )
  return digest(
    canonicalJson({
      ...payload,
      authorizationGates: payload.authorizationGates.map((gate) =>
        Object.fromEntries(
          Object.entries(gate).filter(([key]) => key !== 'authorizationState')
        )
      )
    })
  )
}

function validateR7AuthorizationRequest(value, routeApprovalPacket, routeEligibilityReport) {
  exactKeys(
    value,
    [
      'authoringSchema',
      'requestId',
      'revision',
      'status',
      'scope',
      'sourceSnapshot',
      'r6ApprovalBasis',
      'authorizationGates',
      'proposedOutputContract',
      'pilotProposal',
      'requiredSequence',
      'review'
    ],
    [],
    'R7 authorization request'
  )
  if (value.authoringSchema !== 'QuestGrowthR7AuthorizationRequest/1alpha') {
    throw new Error('unsupported R7 authorization request schema')
  }
  identifier(value.requestId, 'R7 request id')
  if (!Number.isInteger(value.revision) || value.revision < 1) {
    throw new Error('invalid R7 request revision')
  }
  if (value.status !== 'draft' || value.scope !== 'R7_DECISION_ONLY') {
    throw new Error('R7-0 must remain a draft decision-only request')
  }
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], [], 'R7 source snapshot')
  if (!CommitPattern.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R7 audited base commit')
  }
  timestamp(value.sourceSnapshot.checkedAt, 'R7 checkedAt')

  exactKeys(
    value.r6ApprovalBasis,
    ['packetDigest', 'packetStatus', 'publicationAuthorization'],
    [],
    'R6 approval basis'
  )
  if (!DigestPattern.test(value.r6ApprovalBasis.packetDigest)) {
    throw new Error('invalid R6 approval packet digest')
  }
  if (routeApprovalPacket.status !== 'R6_AUTHORING_APPROVED') {
    throw new Error('R7 decision request requires approved R6 authoring')
  }
  if (value.r6ApprovalBasis.packetStatus !== routeApprovalPacket.status) {
    throw new Error('R7 request R6 packet status mismatch')
  }
  if (
    value.r6ApprovalBasis.packetDigest !== digest(canonicalJson(routeApprovalPacket))
  ) {
    throw new Error('R7 request R6 approval packet digest mismatch')
  }
  if (
    value.r6ApprovalBasis.publicationAuthorization !== 'R7_NOT_AUTHORIZED' ||
    routeApprovalPacket.publicationAuthorization !== 'R7_NOT_AUTHORIZED'
  ) {
    throw new Error('R7-0 must not authorize publication')
  }

  const gates = new Map()
  unique(
    value.authorizationGates,
    'R7 authorization gates',
    (gate, description) => {
      exactKeys(
        gate,
        ['gateId', 'authorizationState', 'summary', 'requiredEvidence'],
        [],
        description
      )
      const gateId = identifier(gate.gateId, `${description} id`)
      if (gate.authorizationState !== 'not-authorized') {
        throw new Error(`${description} is authorized before owner decision`)
      }
      requiredText(gate.summary, `${description} summary`)
      unique(gate.requiredEvidence, `${description} required evidence`, requiredText, 2)
      gates.set(gateId, {
        ...gate,
        semanticDigest: semanticDigest(gate, ['authorizationState'])
      })
      return gateId
    },
    1
  )

  const requiredGateIds = [
    'r7-schema-output-class',
    'r7-pilot-content-authoring',
    'r7-renderer-opt-in-integration',
    'r7-real-account-readonly-acceptance',
    'r7-runtime-publication',
    'r7-default-enablement'
  ]
  if (JSON.stringify([...gates.keys()]) !== JSON.stringify(requiredGateIds)) {
    throw new Error('R7 authorization gate set or order mismatch')
  }
  if (JSON.stringify(value.requiredSequence) !== JSON.stringify(requiredGateIds)) {
    throw new Error('R7 required sequence mismatch')
  }

  exactKeys(
    value.proposedOutputContract,
    ['outputClasses', 'concreteFieldsRequiringEvidence', 'alwaysProhibited', 'unknownPolicy'],
    [],
    'R7 proposed output contract'
  )
  const outputClasses = unique(
    value.proposedOutputContract.outputClasses,
    'R7 output classes',
    identifier,
    1
  )
  const requiredOutputClasses = [
    'reviewed-concrete-route',
    'manual-check-route',
    'objective-only',
    'knowledge-insufficient',
    'withdrawn'
  ]
  if (JSON.stringify(outputClasses) !== JSON.stringify(requiredOutputClasses)) {
    throw new Error('R7 output class set or order mismatch')
  }
  const concreteFields = unique(
    value.proposedOutputContract.concreteFieldsRequiringEvidence,
    'R7 concrete fields',
    identifier,
    1
  )
  for (const field of ['mapKey', 'fleetConstraints', 'equipmentConstraints', 'sortieInstructions']) {
    if (!concreteFields.includes(field)) throw new Error(`R7 concrete field missing ${field}`)
  }
  const prohibited = unique(
    value.proposedOutputContract.alwaysProhibited,
    'R7 prohibited behavior',
    identifier,
    1
  )
  for (const behavior of [
    'automatic-game-operation',
    'game-communication-mutation',
    'runtime-web-scraping',
    'account-data-export'
  ]) {
    if (!prohibited.includes(behavior)) throw new Error(`R7 prohibited behavior missing ${behavior}`)
  }
  if (value.proposedOutputContract.unknownPolicy !== 'fallback') {
    throw new Error('R7 unknown policy must be fallback')
  }

  exactKeys(
    value.pilotProposal,
    ['selectionState', 'maximumInitialFamilies', 'candidates'],
    [],
    'R7 pilot proposal'
  )
  if (value.pilotProposal.selectionState !== 'owner-decision-required') {
    throw new Error('R7 pilot must require an owner decision')
  }
  if (
    !Number.isInteger(value.pilotProposal.maximumInitialFamilies) ||
    value.pilotProposal.maximumInitialFamilies < 1 ||
    value.pilotProposal.maximumInitialFamilies > 2
  ) {
    throw new Error('R7 pilot may propose at most two initial families')
  }
  const auditByFamily = new Map(
    routeEligibilityReport.routeUnitAudits.map((audit) => [audit.routeFamily, audit])
  )
  const candidates = new Map()
  unique(
    value.pilotProposal.candidates,
    'R7 pilot candidates',
    (candidate, description) => {
      exactKeys(
        candidate,
        ['routeFamily', 'r6ContentDecision', 'disposition', 'reason'],
        [],
        description
      )
      const routeFamily = identifier(candidate.routeFamily, `${description} route family`)
      const audit = auditByFamily.get(routeFamily)
      if (!audit) throw new Error(`${description} references unknown R6 route family`)
      if (candidate.r6ContentDecision !== audit.contentDecision) {
        throw new Error(`${description} R6 content decision mismatch`)
      }
      oneOf(
        candidate.disposition,
        ['recommended-wave-a', 'defer'],
        `${description} disposition`
      )
      requiredText(candidate.reason, `${description} reason`)
      candidates.set(routeFamily, candidate)
      return routeFamily
    },
    1
  )
  if (
    candidates.size !== auditByFamily.size ||
    [...auditByFamily.keys()].some((routeFamily) => !candidates.has(routeFamily))
  ) {
    throw new Error('R7 pilot candidates must cover every R6 route family')
  }
  const recommendedFamilies = [...candidates.values()]
    .filter((candidate) => candidate.disposition === 'recommended-wave-a')
    .map((candidate) => candidate.routeFamily)
  if (
    recommendedFamilies.length < 1 ||
    recommendedFamilies.length > value.pilotProposal.maximumInitialFamilies
  ) {
    throw new Error('R7 recommended pilot family count exceeds the decision boundary')
  }

  exactKeys(value.review, ['author', 'approver', 'reviewedAt', 'approvalDigest'], [], 'R7 review')
  identifier(value.review.author, 'R7 review author')
  if (
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('draft R7 decision request must not claim owner approval')
  }

  return {
    value,
    gates,
    candidates,
    recommendedFamilies,
    semanticDigest: authorizationRequestSemanticDigest(value)
  }
}

function buildR7DecisionArtifacts({ base, routeApprovalPacket, routeEligibilityReport }) {
  const requestPath = path.join(base, 'decisions', 'r7-authorization-request.json')
  const requestRaw = fs.readFileSync(requestPath)
  const request = validateR7AuthorizationRequest(
    JSON.parse(requestRaw),
    routeApprovalPacket,
    routeEligibilityReport
  )
  const runtimeEligibleCount = routeEligibilityReport.routeUnitAudits.filter(
    (audit) => audit.effectiveState === 'RUNTIME_ELIGIBLE'
  ).length
  if (runtimeEligibleCount !== 0) {
    throw new Error('R7-0 decision packet must not make route units runtime eligible')
  }
  const report = {
    schemaVersion: 1,
    compilerVersion: R7DecisionCompilerVersion,
    requestId: request.value.requestId,
    revision: request.value.revision,
    generatedAt: request.value.sourceSnapshot.checkedAt,
    status: 'OWNER_DECISION_REQUIRED',
    scope: request.value.scope,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    r6ApprovalBasis: request.value.r6ApprovalBasis,
    authorizationGates: [...request.gates.values()].map((gate) => ({
      gateId: gate.gateId,
      authorizationState: gate.authorizationState,
      semanticDigest: gate.semanticDigest
    })),
    pilotProposal: {
      selectionState: request.value.pilotProposal.selectionState,
      maximumInitialFamilies: request.value.pilotProposal.maximumInitialFamilies,
      recommendedFamilies: request.recommendedFamilies,
      selectedInitialFamilies: []
    },
    implementationAuthorization: 'R7_NOT_AUTHORIZED',
    concreteRouteArtifactCount: 0,
    runtimeEligibleCount
  }
  return {
    artifacts: { 'r7-authorization-report.json': report },
    source: { r7AuthorizationRequestDigest: digest(requestRaw) },
    output: {
      r7DecisionGateCount: request.gates.size,
      r7AuthorizedGateCount: 0,
      r7PilotCandidateCount: request.candidates.size,
      r7RecommendedPilotFamilyCount: request.recommendedFamilies.length,
      r7ConcreteRouteArtifactCount: 0
    }
  }
}

module.exports = {
  R7DecisionOutputFilenames,
  authorizationRequestSemanticDigest,
  buildR7DecisionArtifacts,
  validateR7AuthorizationRequest
}

const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const R7ContentDecisionCompilerVersion = 'quest-growth-r7-content-decision-compiler/2'
const R7ContentDecisionOutputFilenames = ['r7-pilot-content-authorization-report.json']
const CommitPattern = /^[0-9a-f]{40}$/
const DigestPattern = /^sha256:[0-9a-f]{64}$/
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const SelectedPilotFamilies = ['expedition-resource-periodic-loop', 'anti-submarine-foundation']
const ApprovedContentSemanticDigest =
  'sha256:d2c474af9b09a959cb9e9a1532ba954e1f11da8669feb2fc5049421715a972fc'
const ApprovedContentBasis = {
  authorizationRequestDigest:
    'sha256:1c068752121f6de81e82e2dc54ab8c5f9443c1e66f744d370065bcb3439ec72a',
  schemaGateDigest: 'sha256:bbc64d5f81725d2a15c2b986047dde40518c3a5d76745fb6cc81d6c221b455ed',
  pilotContentGateDigest: 'sha256:2b0276b3f43adb54d4cce3fb831150872cc39d211fb9d87410957f08d1e434f3',
  authoringSchemaDigest: 'sha256:660baa094b6a493a12de1bcedb26d26e455f8ee2c4a4dc6e8b9f08de58835b68',
  emptyCatalogDigest: 'sha256:2c431964a73b1c9d6b736bb914fe9a6d5b96ec4e967093d249f18841579b9043',
  r6ApprovalPacketDigest: 'sha256:9982237824796126a35a5490d7a7e39fec839552624b130f37f8b4ae75cf0164'
}

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

function identifier(value, description) {
  if (typeof value !== 'string' || !IdentifierPattern.test(value)) {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function timestamp(value, description) {
  if (
    typeof value !== 'string' ||
    !TimestampPattern.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function uniqueTextList(value, description, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) throw new Error(`invalid ${description}`)
  for (const item of value) identifier(item, description)
  if (new Set(value).size !== value.length) throw new Error(`duplicate ${description}`)
  return value
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function contentAuthorizationSemanticDigest(value) {
  const payload = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'status' && key !== 'review')
  )
  return digest(
    canonicalJson({
      ...payload,
      requestedAuthorization: Object.fromEntries(
        Object.entries(payload.requestedAuthorization).filter(
          ([key]) => key !== 'authorizationState'
        )
      )
    })
  )
}

function validateVersionedBinding(value, expected, description) {
  exactKeys(value, ['id', 'revision', 'semanticDigest'], description)
  identifier(value.id, `${description} id`)
  if (!Number.isInteger(value.revision) || value.revision < 1) {
    throw new Error(`invalid ${description} revision`)
  }
  if (!DigestPattern.test(value.semanticDigest)) throw new Error(`invalid ${description} digest`)
  if (!same(value, expected)) throw new Error(`${description} approval binding mismatch`)
}

function validateR7ContentAuthorizationRequest(
  value,
  { base, routeApprovalPacket, r7AuthorizationReport, r7SchemaReport }
) {
  exactKeys(
    value,
    [
      'authoringSchema',
      'requestId',
      'revision',
      'status',
      'scope',
      'sourceSnapshot',
      'approvalBasis',
      'requestedAuthorization',
      'pilotBindings',
      'authoringRequirements',
      'stillProhibited',
      'review'
    ],
    'R7 pilot content authorization request'
  )
  if (value.authoringSchema !== 'QuestGrowthR7PilotContentAuthorizationRequest/1alpha') {
    throw new Error('unsupported R7 pilot content authorization request schema')
  }
  identifier(value.requestId, 'R7 content request id')
  if (value.revision !== 1) throw new Error('invalid R7 content request revision')
  if (value.status !== 'approved' || value.scope !== 'R7_PILOT_CONTENT_AUTHORING_REVIEW_ONLY') {
    throw new Error('R7 content request must be approved and remain review-only')
  }
  exactKeys(value.sourceSnapshot, ['auditedBaseCommit', 'checkedAt'], 'R7 content source snapshot')
  if (!CommitPattern.test(value.sourceSnapshot.auditedBaseCommit)) {
    throw new Error('invalid R7 content audited base commit')
  }
  timestamp(value.sourceSnapshot.checkedAt, 'R7 content checkedAt')

  exactKeys(
    value.approvalBasis,
    [
      'authorizationRequestDigest',
      'schemaGateDigest',
      'pilotContentGateDigest',
      'authoringSchemaDigest',
      'emptyCatalogDigest',
      'r6ApprovalPacketDigest'
    ],
    'R7 content approval basis'
  )
  for (const [key, item] of Object.entries(value.approvalBasis)) {
    if (!DigestPattern.test(item)) throw new Error(`invalid R7 content approval basis ${key}`)
  }
  const contentGate = r7AuthorizationReport.authorizationGates.find(
    (gate) => gate.gateId === 'r7-pilot-content-authoring'
  )
  const schemaGate = r7AuthorizationReport.authorizationGates.find(
    (gate) => gate.gateId === 'r7-schema-output-class'
  )
  if (!same(value.approvalBasis, ApprovedContentBasis)) {
    throw new Error('R7 content approval basis mismatch')
  }
  if (digest(canonicalJson(routeApprovalPacket)) !== ApprovedContentBasis.r6ApprovalPacketDigest) {
    throw new Error('R7 content R6 approval packet digest mismatch')
  }
  if (
    schemaGate?.authorizationState !== 'authorized' ||
    contentGate?.authorizationState !== 'authorized' ||
    r7SchemaReport.status !== 'CONTENT_AUTHORING_AUTHORIZED_DRAFT_ONLY' ||
    r7SchemaReport.catalogRouteCount > 2
  ) {
    throw new Error('R7 content authoring approval prerequisites are invalid')
  }

  exactKeys(
    value.requestedAuthorization,
    [
      'gateId',
      'authorizationState',
      'maximumRouteArtifacts',
      'maximumRouteArtifactsPerFamily',
      'maximumAuthoringStatus',
      'selectedPilotFamilies'
    ],
    'R7 requested content authorization'
  )
  if (
    value.requestedAuthorization.gateId !== 'r7-pilot-content-authoring' ||
    value.requestedAuthorization.authorizationState !== 'authorized' ||
    value.requestedAuthorization.maximumRouteArtifacts !== 2 ||
    value.requestedAuthorization.maximumRouteArtifactsPerFamily !== 1 ||
    value.requestedAuthorization.maximumAuthoringStatus !== 'draft' ||
    !same(value.requestedAuthorization.selectedPilotFamilies, SelectedPilotFamilies)
  ) {
    throw new Error('R7 requested content authorization boundary mismatch')
  }

  if (!Array.isArray(value.pilotBindings) || value.pilotBindings.length !== 2) {
    throw new Error('R7 pilot binding count mismatch')
  }
  for (const [index, binding] of value.pilotBindings.entries()) {
    exactKeys(binding, ['routeFamily', 'lineage', 'routeUnit'], 'R7 pilot binding')
    const routeFamily = SelectedPilotFamilies[index]
    if (binding.routeFamily !== routeFamily) throw new Error('R7 pilot binding order mismatch')
    const lineage = routeApprovalPacket.lineages.find(
      (item) => item.routeLineageId === `growth-lineage:${routeFamily}`
    )
    const routeUnit = routeApprovalPacket.routeUnits.find(
      (item) => item.routeUnitId === `growth-route:${routeFamily}:baseline`
    )
    validateVersionedBinding(
      binding.lineage,
      {
        id: lineage?.routeLineageId,
        revision: lineage?.revision,
        semanticDigest: lineage?.semanticDigest
      },
      `${routeFamily} lineage`
    )
    validateVersionedBinding(
      binding.routeUnit,
      {
        id: routeUnit?.routeUnitId,
        revision: routeUnit?.revision,
        semanticDigest: routeUnit?.semanticDigest
      },
      `${routeFamily} route unit`
    )
  }

  exactKeys(
    value.authoringRequirements,
    ['allowedOutputClasses', 'requiredEvidenceRules', 'requiredReviewRules'],
    'R7 authoring requirements'
  )
  const expectedOutputClasses = [
    'manual-check-route',
    'objective-only',
    'knowledge-insufficient',
    'withdrawn'
  ]
  if (!same(value.authoringRequirements.allowedOutputClasses, expectedOutputClasses)) {
    throw new Error('R7 draft output class boundary mismatch')
  }
  if (
    !Array.isArray(value.authoringRequirements.requiredEvidenceRules) ||
    value.authoringRequirements.requiredEvidenceRules.length !== 5 ||
    !Array.isArray(value.authoringRequirements.requiredReviewRules) ||
    value.authoringRequirements.requiredReviewRules.length !== 3
  ) {
    throw new Error('R7 authoring requirement set mismatch')
  }
  for (const rule of [
    ...value.authoringRequirements.requiredEvidenceRules,
    ...value.authoringRequirements.requiredReviewRules
  ]) {
    if (typeof rule !== 'string' || rule.trim() === '') throw new Error('invalid R7 authoring rule')
  }

  const prohibited = uniqueTextList(value.stillProhibited, 'R7 prohibited behavior', 10)
  for (const required of [
    'content-outside-selected-pilots',
    'reviewed-status-without-route-approval',
    'renderer-integration',
    'real-account-acceptance',
    'runtime-publication',
    'default-enablement',
    'automatic-game-operation',
    'game-communication-mutation',
    'runtime-web-scraping',
    'account-data-export'
  ]) {
    if (!prohibited.includes(required))
      throw new Error(`R7 prohibited behavior missing ${required}`)
  }

  exactKeys(
    value.review,
    ['author', 'approver', 'reviewedAt', 'approvalDigest'],
    'R7 content review'
  )
  identifier(value.review.author, 'R7 content review author')
  identifier(value.review.approver, 'R7 content review approver')
  timestamp(value.review.reviewedAt, 'R7 content review reviewedAt')
  if (
    value.review.author === value.review.approver ||
    value.review.approvalDigest !== ApprovedContentSemanticDigest
  ) {
    throw new Error('R7 content approval review mismatch')
  }
  const semanticDigest = contentAuthorizationSemanticDigest(value)
  if (semanticDigest !== ApprovedContentSemanticDigest) {
    throw new Error('R7 content approval semantic digest mismatch')
  }
  return { value, semanticDigest }
}

function buildR7ContentDecisionArtifacts({
  base,
  routeApprovalPacket,
  r7AuthorizationReport,
  r7SchemaReport
}) {
  const requestPath = path.join(base, 'decisions', 'r7-pilot-content-authorization-request.json')
  const requestRaw = fs.readFileSync(requestPath)
  const request = validateR7ContentAuthorizationRequest(JSON.parse(requestRaw), {
    base,
    routeApprovalPacket,
    r7AuthorizationReport,
    r7SchemaReport
  })
  const report = {
    schemaVersion: 1,
    compilerVersion: R7ContentDecisionCompilerVersion,
    generatedAt: request.value.sourceSnapshot.checkedAt,
    status: 'CONTENT_AUTHORING_AUTHORIZED_DRAFT_ONLY',
    scope: request.value.scope,
    requestId: request.value.requestId,
    revision: request.value.revision,
    requestDigest: digest(requestRaw),
    semanticDigest: request.semanticDigest,
    gateId: request.value.requestedAuthorization.gateId,
    gateSemanticDigest: request.value.approvalBasis.pilotContentGateDigest,
    authorizationState: 'authorized',
    selectedPilotFamilies: request.value.requestedAuthorization.selectedPilotFamilies,
    maximumRouteArtifacts: request.value.requestedAuthorization.maximumRouteArtifacts,
    maximumRouteArtifactsPerFamily:
      request.value.requestedAuthorization.maximumRouteArtifactsPerFamily,
    maximumAuthoringStatus: request.value.requestedAuthorization.maximumAuthoringStatus,
    pilotBindings: request.value.pilotBindings,
    requiredEvidenceRuleCount: request.value.authoringRequirements.requiredEvidenceRules.length,
    requiredReviewRuleCount: request.value.authoringRequirements.requiredReviewRules.length,
    stillProhibited: request.value.stillProhibited,
    currentCatalogRouteCount: r7SchemaReport.catalogRouteCount,
    draftConcreteRouteArtifactCount: r7SchemaReport.concreteRouteArtifactCount,
    reviewedConcreteRouteArtifactCount: 0,
    runtimeEligibleCount: 0,
    publicationAuthorization: 'R7_NOT_AUTHORIZED'
  }
  return {
    artifacts: { 'r7-pilot-content-authorization-report.json': report },
    source: { r7PilotContentAuthorizationRequestDigest: digest(requestRaw) },
    output: {
      r7PilotContentDecisionGateCount: 1,
      r7PilotContentAuthorizedGateCount: 1,
      r7PilotContentMaximumRouteArtifactCount: report.maximumRouteArtifacts,
      r7PilotContentCurrentRouteArtifactCount: report.currentCatalogRouteCount
    }
  }
}

module.exports = {
  R7ContentDecisionOutputFilenames,
  buildR7ContentDecisionArtifacts,
  contentAuthorizationSemanticDigest,
  validateR7ContentAuthorizationRequest
}

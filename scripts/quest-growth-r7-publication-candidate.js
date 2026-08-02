const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const {
  routeReviewSemanticDigest
} = require('./quest-growth-r7-route-review-decision')

const CandidatePath = 'knowledge/quest-growth/r7/runtime-publication-candidate.json'
const ReviewPath =
  'knowledge/quest-growth/reviews/r7-runtime-publication-candidate-review.json'
const RouteCatalogPath = 'knowledge/quest-growth/r7/route-catalog.json'
const CandidateVersion = 'r7.candidate.20260802.1'
const ProtectedDigests = {
  'src/main/kcbrowser.ts':
    'sha256:a18725b27912dd516982a21e7146847635b3b3929a8ab1ad8b54feb53c7a0b9f',
  'src/preload/xhr-hook.ts':
    'sha256:5e0c0391350cf325a111ed7049f4fc5407d273eae0e14d0677e27cd5ebe2c502',
  'src/common/kcsapi_hook.ts':
    'sha256:e68415a7b73a2b54ed33308a260900bb4eadb8dd15e2927420ab69da63200a1e'
}
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
const RequiredChecks = [
  'candidate-has-exactly-two-fixed-reviewed-route-bindings',
  'candidate-schema-version-and-fields-are-strict',
  'candidate-canonical-digest-is-reproducible',
  'route-content-and-reviewed-route-digests-are-unchanged',
  'both-route-currentness-windows-cover-the-review-time',
  'reviewer-is-independent-from-candidate-author',
  'no-signature-private-key-or-distribution-endpoint-is-used',
  'protected-game-communication-digests-remain-fixed'
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

function exactKeys(value, keys, description) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`invalid ${description}`)
  }
  const allowed = new Set(keys)
  for (const key of keys) {
    if (!(key in value)) throw new Error(`missing ${description} ${key}`)
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`unexpected ${description} ${key}`)
  }
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function timestamp(value, description) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`invalid ${description}`)
  }
  return Date.parse(value)
}

function validateCandidate(value, routeCatalog, reviewTime) {
  exactKeys(
    value,
    ['schemaVersion', 'version', 'publicationAuthorization', 'routes'],
    'R7 publication candidate'
  )
  if (
    value.schemaVersion !== 1 ||
    value.version !== CandidateVersion ||
    value.publicationAuthorization !== 'R7_RUNTIME_SIGNED_CANDIDATE' ||
    !Array.isArray(value.routes) ||
    !same(value.routes, RequiredBindings)
  ) {
    throw new Error('R7 publication candidate contract mismatch')
  }
  if (
    !routeCatalog ||
    routeCatalog.publicationAuthorization !== 'R7_NOT_AUTHORIZED' ||
    !Array.isArray(routeCatalog.routes) ||
    routeCatalog.routes.length !== 2
  ) {
    throw new Error('R7 publication candidate route catalog mismatch')
  }
  for (const binding of RequiredBindings) {
    const route = routeCatalog.routes.find((item) => item.routeId === binding.routeId)
    if (
      !route ||
      route.status !== 'reviewed' ||
      route.routeFamily !== binding.routeFamily ||
      route.revision !== binding.revision ||
      routeReviewSemanticDigest(route) !== binding.semanticDigest
    ) {
      throw new Error(`R7 publication candidate route drift: ${binding.routeId}`)
    }
    const reviewedAt = timestamp(route.review?.reviewedAt, `${binding.routeId} reviewedAt`)
    const reviewBy = timestamp(route.currentness?.reviewBy, `${binding.routeId} reviewBy`)
    const validUntil = timestamp(route.currentness?.validUntil, `${binding.routeId} validUntil`)
    if (reviewedAt >= reviewBy || reviewTime >= reviewBy || reviewTime >= validUntil) {
      throw new Error(`R7 publication candidate route currentness expired: ${binding.routeId}`)
    }
  }
  return {
    value,
    canonicalDigest: digest(canonicalJson(value)),
    routeCount: value.routes.length
  }
}

function publicationCandidateReviewSemanticDigest(value) {
  return digest(
    canonicalJson(
      Object.fromEntries(
        Object.entries(value).filter(
          ([key]) => !['status', 'decision', 'review'].includes(key)
        )
      )
    )
  )
}

function validateReview(value, candidate, root) {
  exactKeys(
    value,
    [
      'reviewSchema',
      'reviewId',
      'revision',
      'status',
      'createdAt',
      'candidate',
      'evidenceBasis',
      'checks',
      'decision',
      'review'
    ],
    'R7 publication candidate review record'
  )
  const createdAt = timestamp(value.createdAt, 'R7 candidate review createdAt')
  const approved = value.status === 'approved'
  if (
    value.reviewSchema !== 'QuestGrowthR7RuntimePublicationCandidateReview/1alpha' ||
    value.reviewId !== 'review:quest-growth-r7-runtime-publication-candidate-1' ||
    value.revision !== 1 ||
    !['owner-decision-required', 'approved'].includes(value.status) ||
    value.decision !== (approved ? 'approved' : null)
  ) {
    throw new Error('R7 publication candidate review state mismatch')
  }

  exactKeys(
    value.candidate,
    ['path', 'version', 'canonicalDigest', 'routeCount', 'candidateAuthor', 'signatureMode'],
    'R7 candidate review candidate reference'
  )
  if (
    value.candidate.path !== CandidatePath ||
    value.candidate.version !== CandidateVersion ||
    value.candidate.canonicalDigest !== candidate.canonicalDigest ||
    value.candidate.routeCount !== 2 ||
    value.candidate.candidateAuthor !== 'codex-r7-publication-candidate-author' ||
    value.candidate.signatureMode !== 'none-canonical-payload-only'
  ) {
    throw new Error('R7 publication candidate review reference mismatch')
  }

  exactKeys(
    value.evidenceBasis,
    [
      'routeCatalogDigest',
      'runtimeAuthoringSemanticDigest',
      'runtimeAuthoringImplementationCommit',
      'protectedCommunicationDigests'
    ],
    'R7 candidate evidence basis'
  )
  exactKeys(
    value.evidenceBasis.protectedCommunicationDigests,
    Object.keys(ProtectedDigests),
    'R7 candidate protected communication digests'
  )
  const routeCatalogDigest = digest(fs.readFileSync(path.join(root, RouteCatalogPath)))
  if (
    value.evidenceBasis.routeCatalogDigest !== routeCatalogDigest ||
    value.evidenceBasis.runtimeAuthoringSemanticDigest !==
      'sha256:580d7002173588b74d1e6327adf4235a20eeb12477d43689a9599adb86b42104' ||
    value.evidenceBasis.runtimeAuthoringImplementationCommit !==
      '221a1643730ba6da4dee831602ea7c06682f4632' ||
    !same(value.evidenceBasis.protectedCommunicationDigests, ProtectedDigests)
  ) {
    throw new Error('R7 publication candidate evidence basis mismatch')
  }
  for (const [protectedPath, expectedDigest] of Object.entries(ProtectedDigests)) {
    if (digest(fs.readFileSync(path.join(root, ...protectedPath.split('/')))) !== expectedDigest) {
      throw new Error(`R7 publication candidate protected path drift: ${protectedPath}`)
    }
  }

  if (!Array.isArray(value.checks) || value.checks.length !== RequiredChecks.length) {
    throw new Error('R7 publication candidate review checklist mismatch')
  }
  value.checks.forEach((check, index) => {
    exactKeys(check, ['checkId', 'evidence'], `R7 candidate check ${index}`)
    if (
      check.checkId !== RequiredChecks[index] ||
      typeof check.evidence !== 'string' ||
      check.evidence.trim().length === 0
    ) {
      throw new Error(`R7 publication candidate check mismatch: ${index}`)
    }
  })

  exactKeys(
    value.review,
    ['author', 'requiredReviewerRole', 'approver', 'reviewedAt', 'approvalDigest'],
    'R7 candidate review metadata'
  )
  if (
    value.review.author !== 'codex-r7-publication-candidate-review-packet-author' ||
    value.review.requiredReviewerRole !== 'project-owner' ||
    value.review.author === value.candidate.candidateAuthor
  ) {
    throw new Error('R7 publication candidate independent review mismatch')
  }
  const semanticDigest = publicationCandidateReviewSemanticDigest(value)
  if (approved) {
    if (
      value.review.approver !== 'project-owner' ||
      timestamp(value.review.reviewedAt, 'R7 candidate review reviewedAt') < createdAt ||
      value.review.approvalDigest !== semanticDigest
    ) {
      throw new Error('R7 publication candidate approval mismatch')
    }
  } else if (
    value.review.approver !== null ||
    value.review.reviewedAt !== null ||
    value.review.approvalDigest !== null
  ) {
    throw new Error('pending R7 publication candidate review must not claim approval')
  }
  return {
    value,
    createdAt,
    semanticDigest,
    approved,
    requiredCheckCount: value.checks.length
  }
}

function validatePublicationCandidateFiles(root) {
  const review = JSON.parse(fs.readFileSync(path.join(root, ReviewPath), 'utf8'))
  const reviewTime = timestamp(review.createdAt, 'R7 candidate review createdAt')
  const routeCatalog = JSON.parse(
    fs.readFileSync(path.join(root, RouteCatalogPath), 'utf8')
  )
  const candidate = validateCandidate(
    JSON.parse(fs.readFileSync(path.join(root, CandidatePath), 'utf8')),
    routeCatalog,
    reviewTime
  )
  return { candidate, review: validateReview(review, candidate, root) }
}

if (require.main === module) {
  const result = validatePublicationCandidateFiles(path.resolve(__dirname, '..'))
  process.stdout.write(
    `${JSON.stringify(
      {
        candidateVersion: result.candidate.value.version,
        candidateCanonicalDigest: result.candidate.canonicalDigest,
        routeCount: result.candidate.routeCount,
        reviewSemanticDigest: result.review.semanticDigest,
        requiredCheckCount: result.review.requiredCheckCount,
        status: result.review.value.status,
        signatureMode: result.review.value.candidate.signatureMode,
        runtimePublicationAuthorized: false
      },
      null,
      2
    )}\n`
  )
}

module.exports = {
  CandidatePath,
  ReviewPath,
  canonicalJson,
  publicationCandidateReviewSemanticDigest,
  validateCandidate,
  validatePublicationCandidateFiles,
  validateReview
}

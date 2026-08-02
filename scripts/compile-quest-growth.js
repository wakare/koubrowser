const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { RouteOutputFilenames, buildRouteLineageArtifacts } = require('./quest-growth-route-lineage')
const {
  R7DecisionOutputFilenames,
  buildR7DecisionArtifacts
} = require('./quest-growth-r7-decision')
const { R7SchemaOutputFilenames, buildR7SchemaArtifacts } = require('./quest-growth-r7-schema')
const {
  R7ContentDecisionOutputFilenames,
  buildR7ContentDecisionArtifacts
} = require('./quest-growth-r7-content-decision')
const {
  R7RouteReviewDecisionOutputFilenames,
  buildR7RouteReviewDecisionArtifacts
} = require('./quest-growth-r7-route-review-decision')
const {
  R7RendererDecisionOutputFilenames,
  buildR7RendererDecisionArtifacts
} = require('./quest-growth-r7-renderer-decision')
const {
  R7RealAccountDecisionOutputFilenames,
  buildR7RealAccountDecisionArtifacts
} = require('./quest-growth-r7-real-account-decision')
const {
  R7ResponsiveLayoutDecisionOutputFilenames,
  buildR7ResponsiveLayoutDecisionArtifacts
} = require('./quest-growth-r7-responsive-layout-decision')
const {
  R7RuntimePublicationDecisionOutputFilenames,
  buildR7RuntimePublicationDecisionArtifacts
} = require('./quest-growth-r7-runtime-publication-decision')
const {
  R7PublicationCandidateReviewDecisionOutputFilenames,
  buildR7PublicationCandidateReviewDecisionArtifacts
} = require('./quest-growth-r7-publication-candidate-review-decision')
const {
  R7StagingConfigurationDecisionOutputFilenames,
  buildR7StagingConfigurationDecisionArtifacts
} = require('./quest-growth-r7-staging-configuration-decision')

const CompilerVersion = 'quest-growth-authoring-compiler/24'
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const CommitPattern = /^[0-9a-f]{40}$/
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
const OutputFilenames = [
  'source-manifest.json',
  'conflict-and-gap-report.json',
  ...RouteOutputFilenames,
  ...R7DecisionOutputFilenames,
  ...R7SchemaOutputFilenames,
  ...R7ContentDecisionOutputFilenames,
  ...R7RouteReviewDecisionOutputFilenames,
  ...R7RendererDecisionOutputFilenames,
  ...R7RealAccountDecisionOutputFilenames,
  ...R7ResponsiveLayoutDecisionOutputFilenames,
  ...R7RuntimePublicationDecisionOutputFilenames,
  ...R7PublicationCandidateReviewDecisionOutputFilenames,
  ...R7StagingConfigurationDecisionOutputFilenames
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

function sha256(value) {
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

function text(value, description) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`invalid ${description}`)
  return value
}

function identifier(value, description) {
  const result = text(value, description)
  if (!IdentifierPattern.test(result)) throw new Error(`invalid ${description}`)
  return result
}

function timestamp(value, description) {
  const result = text(value, description)
  if (!TimestampPattern.test(result) || !Number.isFinite(Date.parse(result))) {
    throw new Error(`invalid ${description}`)
  }
  return result
}

function oneOf(value, allowed, description) {
  if (!allowed.includes(value)) throw new Error(`invalid ${description}`)
  return value
}

function unique(values, description, validate, minimum = 0) {
  if (!Array.isArray(values) || values.length < minimum) throw new Error(`invalid ${description}`)
  const result = values.map((item, index) => validate(item, `${description} ${index}`))
  if (new Set(result.map((item) => JSON.stringify(item))).size !== result.length) {
    throw new Error(`duplicate ${description}`)
  }
  return result
}

function validateSnapshot(value, description) {
  exactKeys(value, ['auditedBaseCommit', 'checkedAt'], [], description)
  if (!CommitPattern.test(value.auditedBaseCommit)) throw new Error(`invalid ${description} commit`)
  timestamp(value.checkedAt, `${description} checkedAt`)
}

function validateEvidenceLedger(value) {
  exactKeys(
    value,
    ['authoringSchema', 'ledgerVersion', 'sourceSnapshot', 'claims', 'sources'],
    [],
    'evidence ledger'
  )
  if (value.authoringSchema !== 'QuestGrowthEvidenceLedger/1alpha') {
    throw new Error('unsupported evidence ledger schema')
  }
  text(value.ledgerVersion, 'evidence ledger version')
  validateSnapshot(value.sourceSnapshot, 'evidence ledger source snapshot')

  const sources = new Map()
  unique(
    value.sources,
    'evidence sources',
    (source, description) => {
      exactKeys(
        source,
        [
          'sourceId',
          'url',
          'title',
          'site',
          'language',
          'evidenceClass',
          'accessibility',
          'independence',
          'supportedClaims',
          'checkedAt',
          'reviewBy',
          'validUntil',
          'currentnessRisk',
          'notes'
        ],
        ['author', 'publishedAt', 'updatedAt'],
        description
      )
      const sourceId = identifier(source.sourceId, `${description} sourceId`)
      const url = text(source.url, `${description} url`)
      if (new URL(url).protocol !== 'https:') throw new Error(`invalid ${description} url`)
      text(source.title, `${description} title`)
      text(source.site, `${description} site`)
      if (source.author !== undefined) text(source.author, `${description} author`)
      oneOf(source.language, ['zh-CN', 'ja-JP'], `${description} language`)
      oneOf(
        source.evidenceClass,
        ['mechanic', 'editorial', 'historical', 'mixed'],
        `${description} class`
      )
      oneOf(
        source.accessibility,
        ['independently-readable', 'unreadable', 'prompt-supplied-observation'],
        `${description} accessibility`
      )
      oneOf(
        source.independence,
        ['independent', 'same-editorial-ecosystem', 'derivative', 'unknown'],
        `${description} independence`
      )
      unique(source.supportedClaims, `${description} supportedClaims`, identifier, 1)
      timestamp(source.checkedAt, `${description} checkedAt`)
      const reviewBy = timestamp(source.reviewBy, `${description} reviewBy`)
      const validUntil = timestamp(source.validUntil, `${description} validUntil`)
      if (Date.parse(reviewBy) > Date.parse(validUntil)) {
        throw new Error(`${description} reviewBy exceeds validUntil`)
      }
      if (source.publishedAt !== undefined)
        timestamp(source.publishedAt, `${description} publishedAt`)
      if (source.updatedAt !== undefined) timestamp(source.updatedAt, `${description} updatedAt`)
      oneOf(source.currentnessRisk, ['low', 'medium', 'high'], `${description} currentnessRisk`)
      unique(source.notes, `${description} notes`, text)
      sources.set(sourceId, source)
      return sourceId
    },
    2
  )

  const claims = new Map()
  unique(
    value.claims,
    'evidence claims',
    (claim, description) => {
      exactKeys(
        claim,
        [
          'claimId',
          'classification',
          'summary',
          'sourceIds',
          'confidence',
          'promotionStatus',
          'conditions',
          'contradictions'
        ],
        [],
        description
      )
      const claimId = identifier(claim.claimId, `${description} claimId`)
      oneOf(
        claim.classification,
        ['mechanic', 'editorial', 'historical'],
        `${description} classification`
      )
      text(claim.summary, `${description} summary`)
      const sourceIds = unique(claim.sourceIds, `${description} sourceIds`, identifier, 1)
      for (const sourceId of sourceIds) {
        if (!sources.has(sourceId))
          throw new Error(`${description} references unknown source ${sourceId}`)
      }
      oneOf(
        claim.confidence,
        ['high', 'medium', 'conditional', 'insufficient'],
        `${description} confidence`
      )
      oneOf(
        claim.promotionStatus,
        ['candidate', 'research-only', 'rejected'],
        `${description} promotionStatus`
      )
      unique(claim.conditions, `${description} conditions`, text)
      unique(claim.contradictions, `${description} contradictions`, text)
      claims.set(claimId, claim)
      return claimId
    },
    1
  )

  for (const source of sources.values()) {
    for (const claimId of source.supportedClaims) {
      if (!claims.has(claimId))
        throw new Error(`source ${source.sourceId} references unknown claim ${claimId}`)
      if (!claims.get(claimId).sourceIds.includes(source.sourceId)) {
        throw new Error(`source ${source.sourceId} claim link is not reciprocal`)
      }
    }
  }
  return { value, sources, claims }
}

function validatePredicate(value, description) {
  exactKeys(value, ['observable', 'condition', 'unknownPolicy'], [], description)
  identifier(value.observable, `${description} observable`)
  text(value.condition, `${description} condition`)
  oneOf(value.unknownPolicy, ['block', 'fallback', 'manual-check'], `${description} unknownPolicy`)
  return `${value.observable}:${value.condition}:${value.unknownPolicy}`
}

function validateMilestoneCatalog(value, evidence) {
  exactKeys(
    value,
    ['authoringSchema', 'catalogVersion', 'sourceSnapshot', 'milestones'],
    [],
    'milestone catalog'
  )
  if (value.authoringSchema !== 'QuestGrowthMilestones/1alpha') {
    throw new Error('unsupported milestone catalog schema')
  }
  text(value.catalogVersion, 'milestone catalog version')
  validateSnapshot(value.sourceSnapshot, 'milestone catalog source snapshot')
  if (value.sourceSnapshot.auditedBaseCommit !== evidence.value.sourceSnapshot.auditedBaseCommit) {
    throw new Error('growth authoring snapshots do not share the same audited base commit')
  }

  const milestones = new Map()
  unique(
    value.milestones,
    'growth milestones',
    (milestone, description) => {
      exactKeys(
        milestone,
        [
          'id',
          'revision',
          'status',
          'phase',
          'goal',
          'rationale',
          'decisionKind',
          'requiredObservables',
          'prerequisites',
          'triggers',
          'guidance',
          'expectedBenefits',
          'costs',
          'risks',
          'stopConditions',
          'questLinks',
          'claimRefs',
          'confidence',
          'currentness',
          'review'
        ],
        [],
        description
      )
      const id = identifier(milestone.id, `${description} id`)
      if (!Number.isInteger(milestone.revision) || milestone.revision < 1) {
        throw new Error(`invalid ${description} revision`)
      }
      oneOf(milestone.status, ['draft', 'approved', 'withdrawn'], `${description} status`)
      oneOf(
        milestone.phase,
        [
          'safety',
          'system-unlock',
          'experience-loop',
          'resource-loop',
          'capability',
          'normal-map-and-eo',
          'event-readiness'
        ],
        `${description} phase`
      )
      text(milestone.goal, `${description} goal`)
      text(milestone.rationale, `${description} rationale`)
      oneOf(
        milestone.decisionKind,
        ['deterministic-mechanic', 'editorial-community', 'mixed'],
        `${description} decisionKind`
      )
      unique(milestone.requiredObservables, `${description} requiredObservables`, identifier, 1)
      unique(milestone.prerequisites, `${description} prerequisites`, validatePredicate)
      unique(milestone.triggers, `${description} triggers`, validatePredicate, 1)
      exactKeys(
        milestone.guidance,
        ['now', 'next', 'longTerm', 'fallback'],
        [],
        `${description} guidance`
      )
      for (const key of ['now', 'next', 'longTerm', 'fallback']) {
        text(milestone.guidance[key], `${description} guidance ${key}`)
      }
      unique(milestone.expectedBenefits, `${description} expectedBenefits`, text, 1)
      unique(milestone.costs, `${description} costs`, text)
      unique(milestone.risks, `${description} risks`, text, 1)
      unique(milestone.stopConditions, `${description} stopConditions`, identifier, 1)
      unique(milestone.questLinks, `${description} questLinks`, (link, linkDescription) => {
        exactKeys(link, ['questId', 'stageIndex', 'eligibility'], ['routeId'], linkDescription)
        if (!Number.isInteger(link.questId) || link.questId < 1)
          throw new Error(`invalid ${linkDescription} questId`)
        if (!Number.isInteger(link.stageIndex) || link.stageIndex < 0)
          throw new Error(`invalid ${linkDescription} stageIndex`)
        oneOf(
          link.eligibility,
          ['route-ready-only', 'manual-partial'],
          `${linkDescription} eligibility`
        )
        if (link.routeId !== undefined) identifier(link.routeId, `${linkDescription} routeId`)
        return `${link.questId}:${link.stageIndex}:${link.routeId || ''}`
      })
      const claimRefs = unique(milestone.claimRefs, `${description} claimRefs`, identifier, 1)
      for (const claimRef of claimRefs) {
        if (!evidence.claims.has(claimRef))
          throw new Error(`${description} references unknown claim ${claimRef}`)
      }
      oneOf(
        milestone.confidence,
        ['high', 'medium', 'conditional', 'insufficient'],
        `${description} confidence`
      )
      exactKeys(
        milestone.currentness,
        ['checkedAt', 'reviewBy', 'validUntil'],
        ['expireOnEventEnd'],
        `${description} currentness`
      )
      timestamp(milestone.currentness.checkedAt, `${description} checkedAt`)
      const reviewBy = timestamp(milestone.currentness.reviewBy, `${description} reviewBy`)
      const validUntil = timestamp(milestone.currentness.validUntil, `${description} validUntil`)
      if (Date.parse(reviewBy) > Date.parse(validUntil))
        throw new Error(`${description} review window is invalid`)
      if (
        milestone.currentness.expireOnEventEnd !== undefined &&
        typeof milestone.currentness.expireOnEventEnd !== 'boolean'
      ) {
        throw new Error(`invalid ${description} expireOnEventEnd`)
      }
      exactKeys(milestone.review, ['author', 'approver', 'reviewedAt'], [], `${description} review`)
      const author = identifier(milestone.review.author, `${description} author`)
      if (milestone.review.approver !== null)
        identifier(milestone.review.approver, `${description} approver`)
      if (milestone.review.reviewedAt !== null)
        timestamp(milestone.review.reviewedAt, `${description} reviewedAt`)
      if (milestone.status === 'approved') {
        if (!milestone.review.approver || !milestone.review.reviewedAt) {
          throw new Error(`${description} approved milestone requires an independent review`)
        }
        if (author === milestone.review.approver) {
          throw new Error(`${description} author and approver must differ`)
        }
      } else if (milestone.review.approver !== null || milestone.review.reviewedAt !== null) {
        throw new Error(`${description} draft or withdrawn review must not claim approval`)
      }
      milestones.set(id, milestone)
      return id
    },
    1
  )
  return { value, milestones }
}

function milestoneObservableIds(milestone) {
  return [
    ...milestone.requiredObservables,
    ...milestone.prerequisites.map((predicate) => predicate.observable),
    ...milestone.triggers.map((predicate) => predicate.observable)
  ]
}

function validateObservabilityAudit(value, root) {
  exactKeys(
    value,
    ['authoringSchema', 'auditVersion', 'sourceSnapshot', 'policy', 'observables'],
    [],
    'observability audit'
  )
  if (value.authoringSchema !== 'QuestGrowthObservabilityAudit/1alpha') {
    throw new Error('unsupported observability audit schema')
  }
  text(value.auditVersion, 'observability audit version')
  validateSnapshot(value.sourceSnapshot, 'observability audit source snapshot')
  exactKeys(
    value.policy,
    [
      'newCommunicationHooksAllowed',
      'accountDataExportAllowed',
      'permittedOrigins',
      'prohibitedData'
    ],
    [],
    'observability policy'
  )
  if (value.policy.newCommunicationHooksAllowed !== false) {
    throw new Error('observability audit must not allow new communication hooks')
  }
  if (value.policy.accountDataExportAllowed !== false) {
    throw new Error('observability audit must not allow account data export')
  }
  const allowedOrigins = [
    'renderer-readonly-state',
    'local-record-query',
    'bundled-knowledge',
    'pure-composite',
    'none'
  ]
  const permittedOrigins = unique(
    value.policy.permittedOrigins,
    'observability policy permittedOrigins',
    (origin, description) => oneOf(origin, allowedOrigins, description),
    1
  )
  if (
    permittedOrigins.length !== allowedOrigins.length ||
    allowedOrigins.some((origin) => !permittedOrigins.includes(origin))
  ) {
    throw new Error('observability policy permittedOrigins is incomplete')
  }
  const prohibitedData = unique(
    value.policy.prohibitedData,
    'observability policy prohibitedData',
    text,
    1
  )
  for (const required of [
    'account-identifier',
    'raw-game-payload',
    'cookie-or-session',
    'remote-account-snapshot'
  ]) {
    if (!prohibitedData.includes(required)) {
      throw new Error(`observability policy does not prohibit ${required}`)
    }
  }

  const observables = new Map()
  unique(
    value.observables,
    'observability entries',
    (observable, description) => {
      exactKeys(
        observable,
        [
          'id',
          'coverage',
          'origins',
          'freshness',
          'runtimeUse',
          'derivation',
          'evidence',
          'limitations',
          'unknownFallback'
        ],
        [],
        description
      )
      const id = identifier(observable.id, `${description} id`)
      const coverage = oneOf(
        observable.coverage,
        ['complete', 'partial', 'unavailable'],
        `${description} coverage`
      )
      const origins = unique(
        observable.origins,
        `${description} origins`,
        (origin, originDescription) => oneOf(origin, permittedOrigins, originDescription),
        1
      )
      oneOf(
        observable.freshness,
        ['live-session', 'cached-session', 'historical', 'release-bound', 'none'],
        `${description} freshness`
      )
      const runtimeUse = oneOf(
        observable.runtimeUse,
        ['candidate', 'fallback-only', 'blocked'],
        `${description} runtimeUse`
      )
      text(observable.derivation, `${description} derivation`)
      unique(
        observable.evidence,
        `${description} evidence`,
        (entry, evidenceDescription) => {
          exactKeys(entry, ['path', 'symbol', 'role'], [], evidenceDescription)
          const evidencePath = text(entry.path, `${evidenceDescription} path`)
          if (
            path.isAbsolute(evidencePath) ||
            evidencePath.includes('\\') ||
            evidencePath.split('/').includes('..')
          ) {
            throw new Error(`invalid ${evidenceDescription} repository path`)
          }
          const resolved = path.resolve(root, evidencePath)
          if (
            !resolved.startsWith(`${path.resolve(root)}${path.sep}`) ||
            !fs.existsSync(resolved)
          ) {
            throw new Error(`missing ${evidenceDescription} repository path ${evidencePath}`)
          }
          text(entry.symbol, `${evidenceDescription} symbol`)
          text(entry.role, `${evidenceDescription} role`)
          return `${evidencePath}:${entry.symbol}`
        },
        1
      )
      unique(observable.limitations, `${description} limitations`, text, 1)
      text(observable.unknownFallback, `${description} unknownFallback`)
      if (origins.includes('none') && (origins.length !== 1 || coverage !== 'unavailable')) {
        throw new Error(`${description} none origin is only valid for unavailable coverage`)
      }
      if (coverage === 'unavailable' && runtimeUse === 'candidate') {
        throw new Error(`${description} unavailable observable cannot be a runtime candidate`)
      }
      if (runtimeUse === 'candidate' && coverage !== 'complete') {
        throw new Error(`${description} runtime candidate must have complete coverage`)
      }
      observables.set(id, observable)
      return id
    },
    1
  )
  return { value, observables }
}

function validateDecisionRubrics(value, root) {
  exactKeys(
    value,
    ['authoringSchema', 'packetVersion', 'sourceSnapshot', 'rubrics'],
    [],
    'decision rubric packet'
  )
  if (value.authoringSchema !== 'QuestGrowthDecisionRubrics/1alpha') {
    throw new Error('unsupported decision rubric schema')
  }
  text(value.packetVersion, 'decision rubric packet version')
  validateSnapshot(value.sourceSnapshot, 'decision rubric source snapshot')
  const rubrics = new Map()
  const rubricIds = new Set()
  unique(
    value.rubrics,
    'decision rubrics',
    (rubric, description) => {
      exactKeys(
        rubric,
        [
          'rubricId',
          'observableId',
          'revision',
          'status',
          'decisionMode',
          'proposal',
          'fallback',
          'acceptanceTests',
          'evidence',
          'review'
        ],
        [],
        description
      )
      const rubricId = identifier(rubric.rubricId, `${description} rubricId`)
      if (rubricIds.has(rubricId)) throw new Error(`duplicate rubric id ${rubricId}`)
      rubricIds.add(rubricId)
      const observableId = identifier(rubric.observableId, `${description} observableId`)
      if (!Number.isInteger(rubric.revision) || rubric.revision < 1) {
        throw new Error(`invalid ${description} revision`)
      }
      oneOf(rubric.status, ['draft', 'approved', 'withdrawn'], `${description} status`)
      oneOf(
        rubric.decisionMode,
        ['automatic-fact', 'manual-decision', 'fail-closed-composite'],
        `${description} decisionMode`
      )
      exactKeys(
        rubric.proposal,
        ['automaticOutputs', 'manualInputs', 'prohibitedInferences'],
        [],
        `${description} proposal`
      )
      unique(rubric.proposal.automaticOutputs, `${description} automaticOutputs`, text, 1)
      unique(rubric.proposal.manualInputs, `${description} manualInputs`, text, 1)
      unique(rubric.proposal.prohibitedInferences, `${description} prohibitedInferences`, text, 1)
      text(rubric.fallback, `${description} fallback`)
      unique(rubric.acceptanceTests, `${description} acceptanceTests`, text, 2)
      unique(
        rubric.evidence,
        `${description} evidence`,
        (entry, evidenceDescription) => {
          exactKeys(entry, ['path', 'symbol'], [], evidenceDescription)
          const evidencePath = text(entry.path, `${evidenceDescription} path`)
          if (
            path.isAbsolute(evidencePath) ||
            evidencePath.includes('\\') ||
            evidencePath.split('/').includes('..')
          ) {
            throw new Error(`invalid ${evidenceDescription} repository path`)
          }
          const resolved = path.resolve(root, evidencePath)
          if (
            !resolved.startsWith(`${path.resolve(root)}${path.sep}`) ||
            !fs.existsSync(resolved)
          ) {
            throw new Error(`missing ${evidenceDescription} repository path ${evidencePath}`)
          }
          text(entry.symbol, `${evidenceDescription} symbol`)
          return `${evidencePath}:${entry.symbol}`
        },
        1
      )
      exactKeys(rubric.review, ['author', 'approver', 'reviewedAt'], [], `${description} review`)
      const author = identifier(rubric.review.author, `${description} author`)
      if (rubric.review.approver !== null) {
        identifier(rubric.review.approver, `${description} approver`)
      }
      if (rubric.review.reviewedAt !== null) {
        timestamp(rubric.review.reviewedAt, `${description} reviewedAt`)
      }
      if (rubric.status === 'approved') {
        if (!rubric.review.approver || !rubric.review.reviewedAt) {
          throw new Error(`${description} approved rubric requires an independent review`)
        }
        if (author === rubric.review.approver) {
          throw new Error(`${description} rubric author and approver must differ`)
        }
      } else if (rubric.review.approver !== null || rubric.review.reviewedAt !== null) {
        throw new Error(`${description} unapproved rubric must not claim approval`)
      }
      rubrics.set(observableId, rubric)
      return observableId
    },
    1
  )
  return { value, rubrics }
}

function claimAudit(claim, sources) {
  const readableIndependent = claim.sourceIds.filter((sourceId) => {
    const source = sources.get(sourceId)
    return (
      source.accessibility === 'independently-readable' && source.independence === 'independent'
    )
  })
  const blockers = []
  if (claim.promotionStatus !== 'candidate') blockers.push('CLAIM_NOT_PROMOTION_CANDIDATE')
  if (claim.confidence === 'insufficient') blockers.push('CLAIM_CONFIDENCE_INSUFFICIENT')
  if (readableIndependent.length < 2) blockers.push('CLAIM_LACKS_TWO_INDEPENDENT_READABLE_SOURCES')
  if (claim.contradictions.length > 0)
    blockers.push('CLAIM_HAS_UNRESOLVED_CONDITIONS_OR_CONTRADICTIONS')
  return { readableIndependentSourceIds: readableIndependent, blockers }
}

function validateFixture(value, filename) {
  exactKeys(
    value,
    ['schemaVersion', 'fixtureId', 'observables', 'privacy', 'expectations'],
    [],
    `fixture ${filename}`
  )
  if (value.schemaVersion !== 2) throw new Error(`unsupported fixture ${filename} schema`)
  identifier(value.fixtureId, `fixture ${filename} id`)
  if (
    !value.observables ||
    typeof value.observables !== 'object' ||
    Array.isArray(value.observables)
  ) {
    throw new Error(`invalid fixture ${filename} observables`)
  }
  const observableIds = Object.keys(value.observables)
  if (observableIds.length === 0) throw new Error(`fixture ${filename} has no observables`)
  for (const observableId of observableIds) {
    identifier(observableId, `fixture ${filename} observable id`)
    const observable = value.observables[observableId]
    if (!observable || typeof observable !== 'object' || Array.isArray(observable)) {
      throw new Error(`invalid fixture ${filename} observable ${observableId}`)
    }
  }
  exactKeys(
    value.privacy,
    ['containsAccountIdentifier', 'containsRawPayload'],
    [],
    `fixture ${filename} privacy`
  )
  if (value.privacy.containsAccountIdentifier || value.privacy.containsRawPayload) {
    throw new Error(`fixture ${filename} contains prohibited identifying or raw data`)
  }
  exactKeys(
    value.expectations,
    ['nonEmptyFallbackRequired', 'expectedOutcomeKinds'],
    [],
    `fixture ${filename} expectations`
  )
  if (value.expectations.nonEmptyFallbackRequired !== true) {
    throw new Error(`fixture ${filename} must require a non-empty fallback`)
  }
  if (
    !value.expectations.expectedOutcomeKinds ||
    typeof value.expectations.expectedOutcomeKinds !== 'object' ||
    Array.isArray(value.expectations.expectedOutcomeKinds)
  ) {
    throw new Error(`invalid fixture ${filename} expected outcome kinds`)
  }
  const expectedObservableIds = Object.keys(value.expectations.expectedOutcomeKinds)
  if (
    expectedObservableIds.length !== observableIds.length ||
    expectedObservableIds.some((observableId) => !observableIds.includes(observableId))
  ) {
    throw new Error(`fixture ${filename} expected outcomes must cover every observable`)
  }
  for (const [observableId, outcomeKind] of Object.entries(
    value.expectations.expectedOutcomeKinds
  )) {
    oneOf(
      outcomeKind,
      ['manual-check', 'data-acquisition'],
      `fixture ${filename} expected outcome for ${observableId}`
    )
  }
  return value.fixtureId
}

function buildQuestGrowthArtifacts(root) {
  const base = path.join(root, 'knowledge', 'quest-growth')
  const ledgerPath = path.join(base, 'authoring', 'evidence-ledger.json')
  const milestonesPath = path.join(base, 'authoring', 'milestone-candidates.json')
  const observabilityPath = path.join(base, 'authoring', 'observability-map.json')
  const decisionRubricsPath = path.join(base, 'authoring', 'decision-rubrics.json')
  const ledgerRaw = fs.readFileSync(ledgerPath)
  const milestonesRaw = fs.readFileSync(milestonesPath)
  const observabilityRaw = fs.readFileSync(observabilityPath)
  const decisionRubricsRaw = fs.readFileSync(decisionRubricsPath)
  const evidence = validateEvidenceLedger(JSON.parse(ledgerRaw))
  const catalog = validateMilestoneCatalog(JSON.parse(milestonesRaw), evidence)
  const observability = validateObservabilityAudit(JSON.parse(observabilityRaw), root)
  const decisionRubrics = validateDecisionRubrics(JSON.parse(decisionRubricsRaw), root)
  const referencedObservableIds = new Set(
    [...catalog.milestones.values()].flatMap(milestoneObservableIds)
  )
  for (const observableId of referencedObservableIds) {
    if (!observability.observables.has(observableId)) {
      throw new Error(`milestone references unaudited observable ${observableId}`)
    }
  }
  for (const observableId of observability.observables.keys()) {
    if (!referencedObservableIds.has(observableId)) {
      throw new Error(`observability audit contains unused observable ${observableId}`)
    }
  }
  const partialObservableIds = new Set(
    [...observability.observables.values()]
      .filter((observable) => observable.coverage === 'partial')
      .map((observable) => observable.id)
  )
  for (const observableId of partialObservableIds) {
    if (!decisionRubrics.rubrics.has(observableId)) {
      throw new Error(`partial observable lacks decision rubric ${observableId}`)
    }
  }
  for (const observableId of decisionRubrics.rubrics.keys()) {
    if (!partialObservableIds.has(observableId)) {
      throw new Error(`decision rubric does not target a partial observable ${observableId}`)
    }
  }
  const fixtureDirectory = path.join(base, 'fixtures')
  const fixtureFiles = fs
    .readdirSync(fixtureDirectory)
    .filter((name) => name.endsWith('.json'))
    .sort()
  const fixtureDigests = {}
  for (const filename of fixtureFiles) {
    const raw = fs.readFileSync(path.join(fixtureDirectory, filename))
    validateFixture(JSON.parse(raw), filename)
    fixtureDigests[filename] = sha256(raw)
  }

  const routeLineage = buildRouteLineageArtifacts({
    root,
    base,
    evidence,
    catalog,
    observability,
    decisionRubrics
  })
  const r7Decision = buildR7DecisionArtifacts({
    base,
    routeApprovalPacket: routeLineage.artifacts['route-approval-packet.json'],
    routeEligibilityReport: routeLineage.eligibilityReport
  })
  const r7Schema = buildR7SchemaArtifacts({
    base,
    r7DecisionReport: r7Decision.artifacts['r7-authorization-report.json']
  })
  const r7ContentDecision = buildR7ContentDecisionArtifacts({
    base,
    routeApprovalPacket: routeLineage.artifacts['route-approval-packet.json'],
    r7AuthorizationReport: r7Decision.artifacts['r7-authorization-report.json'],
    r7SchemaReport: r7Schema.artifacts['r7-schema-validation-report.json']
  })
  const r7RouteReviewDecision = buildR7RouteReviewDecisionArtifacts({
    base,
    r7ContentAuthorizationReport:
      r7ContentDecision.artifacts['r7-pilot-content-authorization-report.json'],
    r7SchemaReport: r7Schema.artifacts['r7-schema-validation-report.json']
  })
  const r7RendererDecision = buildR7RendererDecisionArtifacts({
    root,
    base,
    r7AuthorizationReport: r7Decision.artifacts['r7-authorization-report.json'],
    r7SchemaReport: r7Schema.artifacts['r7-schema-validation-report.json'],
    r7RouteReviewReport:
      r7RouteReviewDecision.artifacts['r7-pilot-route-review-report.json']
  })
  const r7RealAccountDecision = buildR7RealAccountDecisionArtifacts({
    root,
    base,
    r7AuthorizationReport: r7Decision.artifacts['r7-authorization-report.json'],
    r7RendererReport: r7RendererDecision.artifacts['r7-renderer-integration-report.json']
  })
  const r7ResponsiveLayoutDecision = buildR7ResponsiveLayoutDecisionArtifacts({
    root,
    base
  })
  const r7RuntimePublicationDecision = buildR7RuntimePublicationDecisionArtifacts({
    root,
    base
  })
  const r7PublicationCandidateReviewDecision =
    buildR7PublicationCandidateReviewDecisionArtifacts({ root, base })
  const r7StagingConfigurationDecision =
    buildR7StagingConfigurationDecisionArtifacts({ root })

  const claims = [...evidence.claims.values()].map((claim) => ({
    claimId: claim.claimId,
    ...claimAudit(claim, evidence.sources)
  }))
  const milestoneGaps = []
  let eligibleForRuntimeCount = 0
  for (const milestone of catalog.milestones.values()) {
    const reasonCodes = []
    if (milestone.status !== 'approved') reasonCodes.push('MILESTONE_NOT_INDEPENDENTLY_APPROVED')
    for (const observableId of new Set(milestoneObservableIds(milestone))) {
      const observable = observability.observables.get(observableId)
      if (observable.coverage === 'partial') {
        reasonCodes.push(`OBSERVABLE_PARTIAL:${observableId}`)
        const rubric = decisionRubrics.rubrics.get(observableId)
        if (rubric.status !== 'approved') {
          reasonCodes.push(`RUBRIC_NOT_INDEPENDENTLY_APPROVED:${observableId}`)
        }
      } else if (observable.coverage === 'unavailable') {
        reasonCodes.push(`OBSERVABLE_UNAVAILABLE:${observableId}`)
      }
      if (observable.runtimeUse === 'blocked') {
        reasonCodes.push(`OBSERVABLE_RUNTIME_BLOCKED:${observableId}`)
      }
    }
    for (const claimRef of milestone.claimRefs) {
      const audit = claims.find((item) => item.claimId === claimRef)
      if (audit.blockers.length > 0) reasonCodes.push(`EVIDENCE_BLOCKED:${claimRef}`)
    }
    const uniqueReasons = [...new Set(reasonCodes)]
    if (uniqueReasons.length === 0) eligibleForRuntimeCount += 1
    else milestoneGaps.push({ milestoneId: milestone.id, reasonCodes: uniqueReasons })
  }

  const sourceManifest = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    source: {
      auditedBaseCommit: evidence.value.sourceSnapshot.auditedBaseCommit,
      checkedAt: evidence.value.sourceSnapshot.checkedAt,
      observabilityAuditedBaseCommit: observability.value.sourceSnapshot.auditedBaseCommit,
      observabilityCheckedAt: observability.value.sourceSnapshot.checkedAt,
      evidenceLedgerDigest: sha256(ledgerRaw),
      milestoneCandidatesDigest: sha256(milestonesRaw),
      observabilityAuditDigest: sha256(observabilityRaw),
      decisionRubricsDigest: sha256(decisionRubricsRaw),
      ...routeLineage.source,
      ...r7Decision.source,
      ...r7Schema.source,
      ...r7ContentDecision.source,
      ...r7RouteReviewDecision.source,
      ...r7RendererDecision.source,
      ...r7RealAccountDecision.source,
      ...r7ResponsiveLayoutDecision.source,
      ...r7RuntimePublicationDecision.source,
      ...r7PublicationCandidateReviewDecision.source,
      ...r7StagingConfigurationDecision.source,
      fixtureDigests
    },
    output: {
      sourceCount: evidence.sources.size,
      claimCount: evidence.claims.size,
      milestoneCount: catalog.milestones.size,
      approvedMilestoneCount: [...catalog.milestones.values()].filter(
        (item) => item.status === 'approved'
      ).length,
      eligibleForRuntimeCount,
      fixtureCount: fixtureFiles.length,
      observableCount: observability.observables.size,
      fullyObservedCount: [...observability.observables.values()].filter(
        (item) => item.coverage === 'complete'
      ).length,
      partiallyObservedCount: [...observability.observables.values()].filter(
        (item) => item.coverage === 'partial'
      ).length,
      unavailableObservableCount: [...observability.observables.values()].filter(
        (item) => item.coverage === 'unavailable'
      ).length,
      decisionRubricCount: decisionRubrics.rubrics.size,
      approvedDecisionRubricCount: [...decisionRubrics.rubrics.values()].filter(
        (item) => item.status === 'approved'
      ).length,
      independenceGroupCount: routeLineage.output.independenceGroupCount,
      claimSupportCount: routeLineage.output.claimSupportCount,
      routeLineageCount: routeLineage.output.routeLineageCount,
      routeUnitCount: routeLineage.output.routeUnitCount,
      reviewedRouteUnitCount: routeLineage.output.reviewedRouteUnitCount,
      manualCheckOnlyCount: routeLineage.output.manualCheckOnlyCount,
      r7CandidateCount: routeLineage.output.r7CandidateCount,
      routeRuntimeEligibleCount: routeLineage.output.runtimeEligibleCount,
      routeValidationCaseCount: routeLineage.output.validationCaseCount,
      ...r7Decision.output,
      ...r7Schema.output,
      ...r7ContentDecision.output,
      ...r7RouteReviewDecision.output,
      ...r7RendererDecision.output,
      ...r7RealAccountDecision.output,
      ...r7ResponsiveLayoutDecision.output,
      ...r7RuntimePublicationDecision.output,
      ...r7PublicationCandidateReviewDecision.output,
      ...r7StagingConfigurationDecision.output
    },
    runtimePromotion: {
      status: 'blocked',
      reason:
        r7RealAccountDecision.output.r7RealAccountAcceptanceFailClosed
          ? 'R7_REAL_ACCOUNT_ACCEPTANCE_FAIL_CLOSED'
          : r7RealAccountDecision.output.r7RealAccountAcceptancePassed
          ? 'R7_REAL_ACCOUNT_ACCEPTANCE_PASSED_PUBLICATION_NOT_AUTHORIZED'
          : r7RealAccountDecision.output.r7RealAccountAcceptanceAuthorizedRouteCount > 0
          ? 'R7_REAL_ACCOUNT_ACCEPTANCE_AUTHORIZED_NOT_RUN'
          : r7RealAccountDecision.output.r7RealAccountAcceptanceOwnerDecisionRequired
            ? 'R7_REAL_ACCOUNT_ACCEPTANCE_RETRY_OWNER_DECISION_REQUIRED'
          : r7RendererDecision.output.r7RendererAuthorizedRouteCount > 0
          ? 'R7_RENDERER_INTEGRATION_AUTHORIZED_REAL_ACCOUNT_NOT_AUTHORIZED'
          : r7RouteReviewDecision.output.r7ReviewedConcreteRouteCount > 0
          ? 'R7_REVIEWED_ROUTES_RENDERER_NOT_AUTHORIZED'
          : 'R7_DRAFT_CONTENT_ONLY_RENDERER_NOT_AUTHORIZED'
    }
  }
  const independentApprovalPending =
    [...catalog.milestones.values()].some((item) => item.status !== 'approved') ||
    [...decisionRubrics.rubrics.values()].some((item) => item.status !== 'approved')
  const conflictAndGapReport = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    runtimePromotionStatus: 'blocked',
    claimAudits: claims,
    observableAudits: [...observability.observables.values()].map((observable) => ({
      observableId: observable.id,
      coverage: observable.coverage,
      origins: observable.origins,
      freshness: observable.freshness,
      runtimeUse: observable.runtimeUse,
      limitations: observable.limitations,
      unknownFallback: observable.unknownFallback
    })),
    decisionRubricAudits: [...decisionRubrics.rubrics.values()].map((rubric) => ({
      rubricId: rubric.rubricId,
      observableId: rubric.observableId,
      status: rubric.status,
      decisionMode: rubric.decisionMode,
      fallback: rubric.fallback,
      acceptanceTestCount: rubric.acceptanceTests.length
    })),
    routeLineageAudits: routeLineage.eligibilityReport.routeUnitAudits,
    milestoneGaps,
    globalStops: [
      'NO_ROUTE_KNOWLEDGE_RUNTIME_BUNDLE_IN_CONTEXT_UI_STAGE',
      ...(independentApprovalPending ? ['INDEPENDENT_APPROVER_REQUIRED'] : []),
      ...([...observability.observables.values()].some(
        (item) => item.coverage !== 'complete' || item.runtimeUse !== 'candidate'
      )
        ? ['OBSERVABILITY_GAPS_REMAIN']
        : []),
      ...([...decisionRubrics.rubrics.values()].some((item) => item.status !== 'approved')
        ? ['DECISION_RUBRICS_NOT_INDEPENDENTLY_APPROVED']
        : []),
      ...(r7RealAccountDecision.output.r7RealAccountAcceptanceFailClosed
        ? ['R7_REAL_ACCOUNT_ACCEPTANCE_FAIL_CLOSED']
        : r7RealAccountDecision.output.r7RealAccountAcceptancePassed
          ? ['R7_REAL_ACCOUNT_ACCEPTANCE_PASSED_PUBLICATION_NOT_AUTHORIZED']
        : r7RealAccountDecision.output.r7RealAccountAcceptanceOwnerDecisionRequired
          ? ['R7_REAL_ACCOUNT_ACCEPTANCE_RETRY_OWNER_DECISION_REQUIRED']
          : ['R7_REAL_ACCOUNT_ACCEPTANCE_AUTHORIZED_NOT_RUN']),
      ...(r7RuntimePublicationDecision.output
        .r7RuntimePublicationAuthoringOwnerDecisionRequired
        ? ['R7_RUNTIME_PUBLICATION_AUTHORING_OWNER_DECISION_REQUIRED']
        : r7RuntimePublicationDecision.output
            .r7RuntimePublicationAuthoringAuthorizedNotImplemented
          ? ['R7_RUNTIME_PUBLICATION_AUTHORING_AUTHORIZED_NOT_IMPLEMENTED']
          : r7RuntimePublicationDecision.output.r7RuntimePublicationAuthoringImplemented
            ? ['R7_RUNTIME_PUBLICATION_AUTHORING_IMPLEMENTED_PUBLICATION_NOT_AUTHORIZED']
            : []),
      ...(r7PublicationCandidateReviewDecision.output
        .r7PublicationCandidateReviewOwnerDecisionRequired
        ? ['R7_PUBLICATION_CANDIDATE_REVIEW_AUTHORING_OWNER_DECISION_REQUIRED']
        : r7PublicationCandidateReviewDecision.output
            .r7PublicationCandidateReviewAuthorizedNotImplemented
          ? ['R7_PUBLICATION_CANDIDATE_REVIEW_AUTHORING_AUTHORIZED_NOT_IMPLEMENTED']
          : r7PublicationCandidateReviewDecision.output
              .r7PublicationCandidateReviewImplemented
            ? ['R7_PUBLICATION_CANDIDATE_OWNER_REVIEW_REQUIRED']
            : r7PublicationCandidateReviewDecision.output
                .r7PublicationCandidateReviewApproved
              ? ['R7_PUBLICATION_CANDIDATE_APPROVED_SIGNING_NOT_AUTHORIZED']
              : []),
      ...(r7StagingConfigurationDecision.output
        .r7StagingConfigurationOwnerDecisionRequired
        ? ['R7_STAGING_CONFIGURATION_OWNER_FIXED_DIGEST_REQUIRED']
        : r7StagingConfigurationDecision.output.r7StagingConfigurationApproved
          ? ['R7_STAGING_CONFIGURATION_APPROVED_REAL_STAGING_NOT_AUTHORIZED']
          : [])
    ]
  }
  return {
    'source-manifest.json': sourceManifest,
    'conflict-and-gap-report.json': conflictAndGapReport,
    ...routeLineage.artifacts,
    ...r7Decision.artifacts,
    ...r7Schema.artifacts,
    ...r7ContentDecision.artifacts,
    ...r7RouteReviewDecision.artifacts,
    ...r7RendererDecision.artifacts,
    ...r7RealAccountDecision.artifacts,
    ...r7ResponsiveLayoutDecision.artifacts,
    ...r7RuntimePublicationDecision.artifacts,
    ...r7PublicationCandidateReviewDecision.artifacts,
    ...r7StagingConfigurationDecision.artifacts
  }
}

function verifyOrWrite(root, artifacts, check) {
  const outputDirectory = path.join(root, 'knowledge', 'quest-growth', 'generated')
  for (const filename of OutputFilenames) {
    const outputPath = path.join(outputDirectory, filename)
    const expected = canonicalJson(artifacts[filename])
    if (check) {
      if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== expected) {
        throw new Error(`${filename} is not reproducible; run npm run data:quest-growth:compile`)
      }
    } else {
      fs.writeFileSync(outputPath, expected, 'utf8')
    }
  }
}

function main() {
  const check = process.argv.includes('--check')
  const artifacts = buildQuestGrowthArtifacts(process.cwd())
  verifyOrWrite(process.cwd(), artifacts, check)
  const output = artifacts['source-manifest.json'].output
  console.log(
    `Quest growth authoring ${check ? 'verified' : 'compiled'}: ` +
      `${output.sourceCount} sources, ${output.claimCount} claims, ` +
      `${output.approvedMilestoneCount}/${output.milestoneCount} approved milestones, ` +
      `${output.fixtureCount} fixtures, ` +
      `${output.observableCount} observables ` +
      `(${output.fullyObservedCount} complete, ${output.partiallyObservedCount} partial, ` +
      `${output.unavailableObservableCount} unavailable), ` +
      `${output.approvedDecisionRubricCount}/${output.decisionRubricCount} approved rubrics, ` +
      `${output.routeLineageCount} route lineages, ${output.routeUnitCount} route units ` +
      `(${output.manualCheckOnlyCount} manual-check-only), ` +
      `${output.eligibleForRuntimeCount} runtime-eligible`
  )
}

if (require.main === module) main()

module.exports = {
  buildQuestGrowthArtifacts,
  canonicalJson,
  validateEvidenceLedger,
  validateFixture,
  validateMilestoneCatalog,
  validateObservabilityAudit,
  validateDecisionRubrics
}

const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const CompilerVersion = 'quest-growth-authoring-compiler/1'
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const CommitPattern = /^[0-9a-f]{40}$/
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
const OutputFilenames = ['source-manifest.json', 'conflict-and-gap-report.json']

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
  if (value.schemaVersion !== 1) throw new Error(`unsupported fixture ${filename} schema`)
  identifier(value.fixtureId, `fixture ${filename} id`)
  if (
    !value.observables ||
    typeof value.observables !== 'object' ||
    Array.isArray(value.observables)
  ) {
    throw new Error(`invalid fixture ${filename} observables`)
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
    ['nonEmptyFallbackRequired'],
    [],
    `fixture ${filename} expectations`
  )
  if (value.expectations.nonEmptyFallbackRequired !== true) {
    throw new Error(`fixture ${filename} must require a non-empty fallback`)
  }
  return value.fixtureId
}

function buildQuestGrowthArtifacts(root) {
  const base = path.join(root, 'knowledge', 'quest-growth')
  const ledgerPath = path.join(base, 'authoring', 'evidence-ledger.json')
  const milestonesPath = path.join(base, 'authoring', 'milestone-candidates.json')
  const ledgerRaw = fs.readFileSync(ledgerPath)
  const milestonesRaw = fs.readFileSync(milestonesPath)
  const evidence = validateEvidenceLedger(JSON.parse(ledgerRaw))
  const catalog = validateMilestoneCatalog(JSON.parse(milestonesRaw), evidence)
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

  const claims = [...evidence.claims.values()].map((claim) => ({
    claimId: claim.claimId,
    ...claimAudit(claim, evidence.sources)
  }))
  const milestoneGaps = []
  let eligibleForRuntimeCount = 0
  for (const milestone of catalog.milestones.values()) {
    const reasonCodes = []
    if (milestone.status !== 'approved') reasonCodes.push('MILESTONE_NOT_INDEPENDENTLY_APPROVED')
    reasonCodes.push('LOCAL_OBSERVABILITY_NOT_AUDITED')
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
      evidenceLedgerDigest: sha256(ledgerRaw),
      milestoneCandidatesDigest: sha256(milestonesRaw),
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
      fixtureCount: fixtureFiles.length
    },
    runtimePromotion: {
      status: 'blocked',
      reason: 'WAVE_1_AUTHORING_ONLY'
    }
  }
  const conflictAndGapReport = {
    schemaVersion: 1,
    compilerVersion: CompilerVersion,
    runtimePromotionStatus: eligibleForRuntimeCount > 0 ? 'review-required' : 'blocked',
    claimAudits: claims,
    milestoneGaps,
    globalStops: [
      'NO_RUNTIME_BUNDLE_IN_WAVE_1',
      'INDEPENDENT_APPROVER_REQUIRED',
      'LOCAL_OBSERVABILITY_AUDIT_REQUIRED',
      'QUEST_STRATEGY_LINEAGE_GATE_UNRESOLVED'
    ]
  }
  return {
    'source-manifest.json': sourceManifest,
    'conflict-and-gap-report.json': conflictAndGapReport
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
      `${output.milestoneCount} draft milestones, ${output.fixtureCount} fixtures, ` +
      `${output.eligibleForRuntimeCount} runtime-eligible`
  )
}

if (require.main === module) main()

module.exports = {
  buildQuestGrowthArtifacts,
  canonicalJson,
  validateEvidenceLedger,
  validateFixture,
  validateMilestoneCatalog
}

const fs = require('node:fs')
const path = require('node:path')

const AuthoringSchemaId = 'QuestStrategyAuthoring/2alpha'
const CoveragePolicyId = 'QSTRAT_RECURRING_NORMAL_SORTIE_V1'
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const Sha256Pattern = /^sha256:[0-9a-f]{64}$/
const CommitPattern = /^[0-9a-f]{40}$/
const MapKeyPattern = /^[1-9]\d*-[1-9]\d*$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
const CoverageStatuses = [
  'route-ready',
  'objective-only',
  'route-unreviewed',
  'conflicted',
  'unsupported-v1-multi-stage',
  'knowledge-insufficient',
  'withdrawn'
]
const AuthoringStatuses = ['draft', 'approved', 'conflicted', 'insufficient', 'withdrawn']

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value, required, optional, description) {
  if (!isRecord(value)) {
    throw new Error(`${description} must be an object`)
  }
  const allowed = new Set([...required, ...optional])
  if (
    required.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) ||
    Object.keys(value).some((key) => !allowed.has(key))
  ) {
    throw new Error(`${description} has unsupported or missing fields`)
  }
}

function text(value, description) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`invalid ${description}`)
  }
  return value.trim()
}

function identifier(value, description) {
  const result = text(value, description)
  if (!IdentifierPattern.test(result)) {
    throw new Error(`invalid ${description}`)
  }
  return result
}

function integer(value, description, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function boolean(value, description) {
  if (typeof value !== 'boolean') {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function oneOf(value, allowed, description) {
  if (!allowed.includes(value)) {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function timestamp(value, description) {
  const result = text(value, description)
  if (!TimestampPattern.test(result) || !Number.isFinite(Date.parse(result))) {
    throw new Error(`invalid ${description}`)
  }
  return result
}

function uniqueArray(value, description, validate, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum) {
    throw new Error(`invalid ${description}`)
  }
  const result = value.map((item, index) => validate(item, `${description}[${index}]`))
  if (new Set(result.map((item) => JSON.stringify(item))).size !== result.length) {
    throw new Error(`duplicate ${description}`)
  }
  return result
}

function sha256(value, description) {
  const result = text(value, description)
  if (!Sha256Pattern.test(result)) {
    throw new Error(`invalid ${description}`)
  }
  return result
}

function validateCoveragePolicy(value) {
  exactKeys(
    value,
    [
      'schemaVersion',
      'policyId',
      'revision',
      'status',
      'runtimeOutputSchema',
      'selection',
      'denominators',
      'coverageStatuses',
      'gates',
      'freshness',
      'review',
      'compilation',
      'runtimeV2Triggers'
    ],
    [],
    'coverage policy'
  )
  if (value.schemaVersion !== 1 || value.runtimeOutputSchema !== 2) {
    throw new Error('coverage policy must select runtime schema v2')
  }
  if (value.policyId !== CoveragePolicyId || value.status !== 'frozen') {
    throw new Error('invalid coverage policy identity')
  }
  integer(value.revision, 'coverage policy revision', 1)

  exactKeys(value.selection, ['minimum', 'maximum', 'coCompletionMinimum'], [], 'selection')
  if (
    value.selection.minimum !== 1 ||
    value.selection.maximum !== 5 ||
    value.selection.coCompletionMinimum !== 2
  ) {
    throw new Error('selection contract must be 1..5 with co-completion from 2')
  }

  exactKeys(value.denominators, ['primary', 'fallback'], [], 'denominators')
  exactKeys(
    value.denominators.primary,
    ['id', 'cadences', 'objectiveType', 'mapScope', 'excludedScopes', 'multiStageCounting'],
    [],
    'primary denominator'
  )
  if (
    value.denominators.primary.id !== CoveragePolicyId ||
    value.denominators.primary.objectiveType !== 'sortie' ||
    value.denominators.primary.mapScope !== 'normal' ||
    value.denominators.primary.multiStageCounting !== 'once-complete-only'
  ) {
    throw new Error('invalid primary denominator')
  }
  uniqueArray(
    value.denominators.primary.cadences,
    'primary cadences',
    (item, description) => oneOf(item, ['daily', 'weekly', 'monthly', 'quarterly'], description),
    4
  )
  uniqueArray(
    value.denominators.primary.excludedScopes,
    'primary excluded scopes',
    (item, description) => oneOf(item, ['event', 'limited', 'invalid'], description),
    3
  )
  exactKeys(value.denominators.fallback, ['id', 'predicate'], [], 'fallback denominator')
  if (
    value.denominators.fallback.id !== 'QSTRAT_VISIBLE_NON_CLAIM' ||
    value.denominators.fallback.predicate !== 'visible-recommendation-and-status-not-claim'
  ) {
    throw new Error('invalid fallback denominator')
  }
  const statuses = uniqueArray(
    value.coverageStatuses,
    'coverage statuses',
    (item, description) => oneOf(item, CoverageStatuses, description),
    CoverageStatuses.length
  )
  if (
    statuses.length !== CoverageStatuses.length ||
    CoverageStatuses.some((status) => !statuses.includes(status))
  ) {
    throw new Error('coverage status taxonomy is incomplete')
  }

  exactKeys(
    value.gates,
    [
      'classificationCoverageBasisPoints',
      'fallbackDisplayCoverageBasisPoints',
      'provisionalRouteCoverageBasisPoints',
      'routeCoverageTargetState',
      'zeroHitSnapshotMaximum',
      'hardConflictCompiledMaximum',
      'expiredAutoRecommendMaximum',
      'withdrawnEligibleMaximum',
      'deterministicHashMismatchMaximum',
      'compiledRecipeMaximum',
      'privacyFindingMaximum',
      'protectedCommunicationDiffMaximum'
    ],
    [],
    'coverage gates'
  )
  if (
    value.gates.classificationCoverageBasisPoints !== 10_000 ||
    value.gates.fallbackDisplayCoverageBasisPoints !== 10_000 ||
    value.gates.provisionalRouteCoverageBasisPoints !== 8_000 ||
    value.gates.routeCoverageTargetState !== 'runtime-v2-accepted' ||
    value.gates.compiledRecipeMaximum !== 512
  ) {
    throw new Error('invalid coverage gate threshold')
  }
  for (const key of [
    'zeroHitSnapshotMaximum',
    'hardConflictCompiledMaximum',
    'expiredAutoRecommendMaximum',
    'withdrawnEligibleMaximum',
    'deterministicHashMismatchMaximum',
    'privacyFindingMaximum',
    'protectedCommunicationDiffMaximum'
  ]) {
    if (value.gates[key] !== 0) {
      throw new Error(`${key} must remain zero`)
    }
  }

  exactKeys(value.freshness, ['normalReviewDays', 'normalHardExpiryDays'], [], 'freshness')
  if (value.freshness.normalReviewDays !== 90 || value.freshness.normalHardExpiryDays !== 365) {
    throw new Error('invalid normal-map freshness window')
  }
  exactKeys(
    value.review,
    [
      'authorApproverSeparationRequired',
      'extractorMayApprove',
      'hardConflictBlocksCompilation',
      'approvedRequiresReviewBy',
      'approvedRequiresValidUntil'
    ],
    [],
    'review policy'
  )
  if (
    value.review.authorApproverSeparationRequired !== true ||
    value.review.extractorMayApprove !== false ||
    value.review.hardConflictBlocksCompilation !== true ||
    value.review.approvedRequiresReviewBy !== true ||
    value.review.approvedRequiresValidUntil !== true
  ) {
    throw new Error('review separation and expiry requirements must remain strict')
  }

  exactKeys(
    value.compilation,
    ['mode', 'unknownHardFact', 'recipeOverflow', 'powerSetGenerationAllowed', 'approvedOnly'],
    [],
    'compilation policy'
  )
  if (
    value.compilation.mode !== 'deterministic-stage-aware-v2' ||
    value.compilation.unknownHardFact !== 'reject-combination' ||
    value.compilation.recipeOverflow !== 'fail' ||
    value.compilation.powerSetGenerationAllowed !== false ||
    value.compilation.approvedOnly !== true
  ) {
    throw new Error('compilation policy must remain deterministic, lossless and bounded')
  }

  exactKeys(
    value.runtimeV2Triggers,
    [
      'losslessCoverageBelowBasisPoints',
      'unsupportedMultiStageAboveBasisPoints',
      'compiledRecipeAbove',
      'zeroHitRequiresLossyRecipe'
    ],
    [],
    'runtime v2 triggers'
  )
  if (
    value.runtimeV2Triggers.losslessCoverageBelowBasisPoints !== 8_000 ||
    value.runtimeV2Triggers.unsupportedMultiStageAboveBasisPoints !== 2_000 ||
    value.runtimeV2Triggers.compiledRecipeAbove !== 512 ||
    value.runtimeV2Triggers.zeroHitRequiresLossyRecipe !== true
  ) {
    throw new Error('invalid runtime v2 trigger')
  }
  return value
}

function validateAuthoringSchema(value) {
  exactKeys(
    value,
    ['$schema', '$id', 'title', 'type', 'additionalProperties', 'required', 'properties', '$defs'],
    [],
    'authoring JSON schema'
  )
  if (
    value.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
    value.title !== AuthoringSchemaId ||
    value.type !== 'object' ||
    value.additionalProperties !== false
  ) {
    throw new Error('invalid authoring JSON schema identity')
  }
  const requiredTopLevel = [
    'authoringSchema',
    'manifestVersion',
    'sourceSnapshot',
    'coveragePolicyId',
    'questFacts',
    'mapTemplates',
    'composabilityRules',
    'evidenceReviews',
    'withdrawals'
  ]
  const required = uniqueArray(value.required, 'authoring schema required fields', text)
  if (
    required.length !== requiredTopLevel.length ||
    requiredTopLevel.some((key) => !required.includes(key))
  ) {
    throw new Error('authoring JSON schema top-level contract is incomplete')
  }
  if (
    value.properties?.authoringSchema?.const !== AuthoringSchemaId ||
    value.properties?.coveragePolicyId?.const !== CoveragePolicyId ||
    value.$defs?.composabilityRule?.properties?.unknownPolicy?.const !== 'reject-combination'
  ) {
    throw new Error('authoring JSON schema does not preserve frozen identities')
  }
  return value
}

function validateSourceSnapshot(value) {
  exactKeys(
    value,
    ['repositoryCommit', 'questCatalogDigest', 'curatedKnowledgeDigest'],
    [],
    'source snapshot'
  )
  if (!CommitPattern.test(text(value.repositoryCommit, 'source repository commit'))) {
    throw new Error('invalid source repository commit')
  }
  sha256(value.questCatalogDigest, 'quest catalog digest')
  sha256(value.curatedKnowledgeDigest, 'curated knowledge digest')
}

function validateReview(value, description, approvedEvidenceReviewIds) {
  exactKeys(
    value,
    ['author', 'approver', 'reviewedAt', 'reviewBy', 'validUntil', 'evidenceReviewIds'],
    [],
    description
  )
  const author = identifier(value.author, `${description} author`)
  const approver = identifier(value.approver, `${description} approver`)
  if (author === approver) {
    throw new Error(`${description} author and approver must differ`)
  }
  const reviewedAt = timestamp(value.reviewedAt, `${description} reviewedAt`)
  const reviewBy = timestamp(value.reviewBy, `${description} reviewBy`)
  const validUntil = timestamp(value.validUntil, `${description} validUntil`)
  if (
    Date.parse(reviewedAt) >= Date.parse(reviewBy) ||
    Date.parse(reviewBy) >= Date.parse(validUntil)
  ) {
    throw new Error(`${description} has invalid freshness order`)
  }
  uniqueArray(
    value.evidenceReviewIds,
    `${description} evidenceReviewIds`,
    (item, itemDescription) => {
      const id = identifier(item, itemDescription)
      if (!approvedEvidenceReviewIds.has(id)) {
        throw new Error(`${description} references unknown or unapproved evidence review ${id}`)
      }
      return id
    },
    1
  )
}

function validateEvidenceReview(value, description) {
  exactKeys(
    value,
    [
      'reviewId',
      'status',
      'sourceUrl',
      'sourceLabel',
      'reviewer',
      'reviewedAt',
      'validUntil',
      'confidence'
    ],
    [],
    description
  )
  const reviewId = identifier(value.reviewId, `${description} reviewId`)
  oneOf(value.status, AuthoringStatuses, `${description} status`)
  const sourceUrl = text(value.sourceUrl, `${description} sourceUrl`)
  try {
    if (new URL(sourceUrl).protocol !== 'https:') {
      throw new Error()
    }
  } catch {
    throw new Error(`invalid ${description} sourceUrl`)
  }
  text(value.sourceLabel, `${description} sourceLabel`)
  identifier(value.reviewer, `${description} reviewer`)
  const reviewedAt = timestamp(value.reviewedAt, `${description} reviewedAt`)
  const validUntil = timestamp(value.validUntil, `${description} validUntil`)
  if (Date.parse(reviewedAt) >= Date.parse(validUntil)) {
    throw new Error(`${description} has invalid validity window`)
  }
  oneOf(value.confidence, ['verified', 'supported'], `${description} confidence`)
  return reviewId
}

function validateCommonEntry(
  value,
  description,
  idKey,
  approvedEvidenceReviewIds,
  required,
  optional = []
) {
  exactKeys(value, [idKey, 'revision', 'status', ...required], ['review', ...optional], description)
  const id = identifier(value[idKey], `${description} ${idKey}`)
  integer(value.revision, `${description} revision`, 1)
  const status = oneOf(value.status, AuthoringStatuses, `${description} status`)
  if (status === 'approved') {
    if (value.review === undefined) {
      throw new Error(`${description} approved entry requires review`)
    }
    validateReview(value.review, `${description} review`, approvedEvidenceReviewIds)
  } else if (value.review !== undefined) {
    validateReview(value.review, `${description} review`, approvedEvidenceReviewIds)
  }
  return id
}

function validateQuestFact(value, description, approvedEvidenceReviewIds) {
  const id = validateCommonEntry(value, description, 'factId', approvedEvidenceReviewIds, [
    'questId',
    'origin',
    'lineage',
    'classification',
    'objectiveStages'
  ])
  integer(value.questId, `${description} questId`, 1)
  oneOf(value.origin, ['canonical-projection', 'reviewed-supplement'], `${description} origin`)
  exactKeys(
    value.lineage,
    ['module', 'accessor', 'sourceCommit', 'projectionDigest'],
    [],
    `${description} lineage`
  )
  if (
    value.lineage.module !== 'src/common/kcquest' ||
    value.lineage.accessor !== 'getQuestStuff' ||
    !CommitPattern.test(value.lineage.sourceCommit)
  ) {
    throw new Error(`${description} has invalid canonical lineage`)
  }
  sha256(value.lineage.projectionDigest, `${description} projectionDigest`)
  const classification = oneOf(
    value.classification,
    [
      'lossless-v1',
      'multi-stage',
      'opaque-constraint',
      'conflicted',
      'missing-structured-fact',
      'out-of-scope'
    ],
    `${description} classification`
  )
  uniqueArray(
    value.objectiveStages,
    `${description} objectiveStages`,
    (stage, stageDescription) => {
      exactKeys(stage, ['requiredCount', 'targets'], [], stageDescription)
      integer(stage.requiredCount, `${stageDescription} requiredCount`, 1)
      uniqueArray(
        stage.targets,
        `${stageDescription} targets`,
        (target, targetDescription) => {
          exactKeys(target, ['mapKey', 'result', 'targetCells'], [], targetDescription)
          if (!MapKeyPattern.test(text(target.mapKey, `${targetDescription} mapKey`))) {
            throw new Error(`invalid ${targetDescription} mapKey`)
          }
          oneOf(target.result, ['arrival', 'victory', 'A', 'S'], `${targetDescription} result`)
          uniqueArray(
            target.targetCells,
            `${targetDescription} targetCells`,
            (cell, cellDescription) => integer(cell, cellDescription, 1)
          )
          return target
        },
        1
      )
      return stage
    },
    classification === 'lossless-v1' ? 1 : 0
  )
  return id
}

function validateMapTemplate(value, description, approvedEvidenceReviewIds) {
  const id = validateCommonEntry(
    value,
    description,
    'templateId',
    approvedEvidenceReviewIds,
    ['mapKey', 'routeLabels', 'targetNodes', 'formations', 'actions', 'cost', 'risk'],
    ['fleetConstraintRef', 'targetCellIds']
  )
  if (!MapKeyPattern.test(text(value.mapKey, `${description} mapKey`))) {
    throw new Error(`invalid ${description} mapKey`)
  }
  uniqueArray(value.routeLabels, `${description} routeLabels`, text, 1)
  uniqueArray(value.targetNodes, `${description} targetNodes`, text, 1)
  if (value.targetCellIds !== undefined) {
    uniqueArray(
      value.targetCellIds,
      `${description} targetCellIds`,
      (cellId, cellDescription) => integer(cellId, cellDescription, 1),
      1
    )
  }
  if (value.fleetConstraintRef !== undefined) {
    identifier(value.fleetConstraintRef, `${description} fleetConstraintRef`)
  }
  uniqueArray(
    value.formations,
    `${description} formations`,
    (formation, formationDescription) => {
      exactKeys(formation, ['formationId', 'label'], ['when'], formationDescription)
      integer(formation.formationId, `${formationDescription} formationId`, 1)
      text(formation.label, `${formationDescription} label`)
      if (formation.when !== undefined) {
        text(formation.when, `${formationDescription} when`)
      }
      return formation
    },
    1
  )
  uniqueArray(value.actions, `${description} actions`, text)
  oneOf(value.cost, ['low', 'medium', 'high'], `${description} cost`)
  oneOf(value.risk, ['low', 'medium', 'high'], `${description} risk`)
  return id
}

function validateComposabilityRule(value, description, approvedEvidenceReviewIds) {
  const id = validateCommonEntry(value, description, 'ruleId', approvedEvidenceReviewIds, [
    'conditions',
    'unknownPolicy'
  ])
  uniqueArray(
    value.conditions,
    `${description} conditions`,
    (condition, conditionDescription) =>
      oneOf(
        condition,
        [
          'same-map-key',
          'exact-stage-contribution',
          'hard-constraint-intersection-satisfiable',
          'no-hard-evidence-conflict'
        ],
        conditionDescription
      ),
    1
  )
  if (value.unknownPolicy !== 'reject-combination') {
    throw new Error(`${description} unknown hard facts must reject combination`)
  }
  return id
}

function validateWithdrawal(value, description, targetIds) {
  exactKeys(
    value,
    ['recordId', 'targetId', 'targetRevision', 'reason', 'withdrawnAt', 'approver'],
    [],
    description
  )
  const recordId = identifier(value.recordId, `${description} recordId`)
  const targetId = identifier(value.targetId, `${description} targetId`)
  if (!targetIds.has(targetId)) {
    throw new Error(`${description} references unknown target ${targetId}`)
  }
  integer(value.targetRevision, `${description} targetRevision`, 1)
  text(value.reason, `${description} reason`)
  timestamp(value.withdrawnAt, `${description} withdrawnAt`)
  identifier(value.approver, `${description} approver`)
  return recordId
}

function validateAuthoringManifest(value) {
  exactKeys(
    value,
    [
      'authoringSchema',
      'manifestVersion',
      'sourceSnapshot',
      'coveragePolicyId',
      'questFacts',
      'mapTemplates',
      'composabilityRules',
      'evidenceReviews',
      'withdrawals'
    ],
    [],
    'authoring manifest'
  )
  if (value.authoringSchema !== AuthoringSchemaId || value.coveragePolicyId !== CoveragePolicyId) {
    throw new Error('invalid authoring manifest identity')
  }
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/.test(text(value.manifestVersion, 'manifest version'))) {
    throw new Error('invalid manifest version')
  }
  validateSourceSnapshot(value.sourceSnapshot)

  const evidenceReviewIds = uniqueArray(
    value.evidenceReviews,
    'evidence reviews',
    validateEvidenceReview
  )
  const approvedEvidenceReviewIds = new Set(
    value.evidenceReviews
      .filter((review) => review.status === 'approved')
      .map((review) => review.reviewId)
  )
  const targetIdList = [
    ...uniqueArray(value.questFacts, 'quest facts', (item, description) =>
      validateQuestFact(item, description, approvedEvidenceReviewIds)
    ),
    ...uniqueArray(value.mapTemplates, 'map templates', (item, description) =>
      validateMapTemplate(item, description, approvedEvidenceReviewIds)
    ),
    ...uniqueArray(value.composabilityRules, 'composability rules', (item, description) =>
      validateComposabilityRule(item, description, approvedEvidenceReviewIds)
    ),
    ...evidenceReviewIds
  ]
  const targetIds = new Set(targetIdList)
  if (targetIds.size !== targetIdList.length) {
    throw new Error('duplicate authoring target IDs')
  }
  uniqueArray(value.withdrawals, 'withdrawals', (item, description) =>
    validateWithdrawal(item, description, targetIds)
  )
  return value
}

function evaluateCoverageSnapshot(value) {
  exactKeys(
    value,
    [
      'schemaVersion',
      'sampleId',
      'visibleNonClaimCount',
      'primaryEligibleVisibleCount',
      'routeReadyCount',
      'fallbackEntryCount',
      'containsAccountIdentifier',
      'containsQuestTitle',
      'containsRawPayload'
    ],
    [],
    'coverage snapshot'
  )
  if (value.schemaVersion !== 1) {
    throw new Error('unsupported coverage snapshot schema')
  }
  identifier(value.sampleId, 'coverage snapshot sampleId')
  const visible = integer(value.visibleNonClaimCount, 'visibleNonClaimCount')
  const primary = integer(value.primaryEligibleVisibleCount, 'primaryEligibleVisibleCount')
  const routeReady = integer(value.routeReadyCount, 'routeReadyCount')
  const fallback = integer(value.fallbackEntryCount, 'fallbackEntryCount')
  if (primary > visible || routeReady > visible || fallback > visible) {
    throw new Error('coverage snapshot counts exceed visible source')
  }
  if (
    boolean(value.containsAccountIdentifier, 'containsAccountIdentifier') ||
    boolean(value.containsQuestTitle, 'containsQuestTitle') ||
    boolean(value.containsRawPayload, 'containsRawPayload')
  ) {
    throw new Error('coverage snapshot contains prohibited identifying or raw data')
  }

  const failures = []
  if (visible > 0 && routeReady + fallback === 0) {
    failures.push('FAIL_EMPTY_STRATEGY_WITH_NONEMPTY_SOURCE')
  }
  if (primary > 0 && routeReady === 0) {
    failures.push('FAIL_PRIMARY_DENOMINATOR_ZERO_HIT')
  }
  if (routeReady + fallback !== visible) {
    failures.push('FAIL_INCOMPLETE_FALLBACK_COVERAGE')
  }
  return {
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failures
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function parseArguments(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    const value = argv[index + 1]
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(`invalid argument near ${name ?? '(end)'}`)
    }
    const normalizedName = name.slice(2)
    if (!['manifest', 'snapshot'].includes(normalizedName) || values.has(normalizedName)) {
      throw new Error(`unsupported or duplicate argument: --${normalizedName}`)
    }
    values.set(normalizedName, value)
  }
  return values
}

function run(argv = process.argv.slice(2), root = process.cwd()) {
  const argumentsMap = parseArguments(argv)
  const schemaPath = path.join(root, 'knowledge', 'quest-strategy', 'authoring-schema-2alpha.json')
  const policyPath = path.join(root, 'knowledge', 'quest-strategy', 'coverage-policy.json')
  validateAuthoringSchema(readJson(schemaPath))
  validateCoveragePolicy(readJson(policyPath))

  const manifestPath = argumentsMap.get('manifest')
  if (manifestPath) {
    validateAuthoringManifest(readJson(path.resolve(root, manifestPath)))
  }
  const snapshotPath = argumentsMap.get('snapshot')
  if (snapshotPath) {
    const result = evaluateCoverageSnapshot(readJson(path.resolve(root, snapshotPath)))
    if (result.status !== 'PASS') {
      throw new Error(result.failures.join(', '))
    }
  }
  return 'Quest strategy authoring contract validation passed'
}

if (require.main === module) {
  try {
    console.log(run())
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

module.exports = {
  evaluateCoverageSnapshot,
  run,
  validateAuthoringManifest,
  validateAuthoringSchema,
  validateCoveragePolicy
}

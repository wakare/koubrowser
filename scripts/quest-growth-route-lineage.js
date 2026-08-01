const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const RouteCompilerVersion = 'quest-growth-route-lineage-compiler/2'
const R6AuditedBaseCommit = '6b52e143af9fcab1dbb00b74f7e89bcf695e5e38'
const CommitPattern = /^[0-9a-f]{40}$/
const IdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const RouteOutputFilenames = [
  'route-lineage-manifest.json',
  'route-eligibility-report.json',
  'route-validation-matrix.json',
  'route-approval-packet.json'
]

function digest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
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

function semanticApprovalDigest(value) {
  const payload = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'status' && key !== 'review')
  )
  return digest(`${JSON.stringify(canonicalize(payload), null, 2)}\n`)
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

function validateSnapshot(value, expectedCommit, description) {
  exactKeys(value, ['auditedBaseCommit', 'checkedAt'], [], description)
  if (!CommitPattern.test(value.auditedBaseCommit)) throw new Error(`invalid ${description} commit`)
  if (value.auditedBaseCommit !== expectedCommit) throw new Error(`${description} commit mismatch`)
  timestamp(value.checkedAt, `${description} checkedAt`)
}

function validateVersionedRef(value, description) {
  exactKeys(value, ['id', 'revision'], [], description)
  identifier(value.id, `${description} id`)
  if (!Number.isInteger(value.revision) || value.revision < 1) {
    throw new Error(`invalid ${description} revision`)
  }
  return value
}

function validateReview(value, status, description, expectedApprovalDigest) {
  exactKeys(value, ['author', 'approver', 'reviewedAt', 'approvalDigest'], [], description)
  identifier(value.author, `${description} author`)
  for (const key of ['approver', 'reviewedAt', 'approvalDigest']) {
    if (value[key] !== null && typeof value[key] !== 'string') {
      throw new Error(`invalid ${description} ${key}`)
    }
  }
  if (value.reviewedAt !== null) timestamp(value.reviewedAt, `${description} reviewedAt`)
  if (status === 'draft') {
    if (value.approver !== null || value.reviewedAt !== null || value.approvalDigest !== null) {
      throw new Error(`${description} draft must not contain approval metadata`)
    }
  }
  if (status === 'reviewed' || status === 'approved') {
    requiredText(value.approver, `${description} approver`)
    timestamp(value.reviewedAt, `${description} reviewedAt`)
    requiredText(value.approvalDigest, `${description} approvalDigest`)
    if (value.author === value.approver) throw new Error(`${description} author is approver`)
    if (value.approvalDigest !== expectedApprovalDigest) {
      throw new Error(`${description} approval digest mismatch`)
    }
  }
}

function validateCurrentness(value, evaluationAsOf, description) {
  exactKeys(value, ['reviewedAt', 'reviewBy', 'validUntil'], [], description)
  const reviewedAt = timestamp(value.reviewedAt, `${description} reviewedAt`)
  const reviewBy = timestamp(value.reviewBy, `${description} reviewBy`)
  const validUntil = timestamp(value.validUntil, `${description} validUntil`)
  if (
    Date.parse(reviewedAt) > Date.parse(reviewBy) ||
    Date.parse(reviewBy) > Date.parse(validUntil)
  ) {
    throw new Error(`invalid ${description} ordering`)
  }
  return {
    reviewedAt,
    reviewBy,
    validUntil,
    reviewDue: Date.parse(evaluationAsOf) > Date.parse(reviewBy),
    expired: Date.parse(evaluationAsOf) > Date.parse(validUntil)
  }
}

function validateFreshnessWindow(currentness, reviewMaximumDays, validMaximumDays, description) {
  const day = 24 * 60 * 60 * 1000
  if (
    Date.parse(currentness.reviewBy) - Date.parse(currentness.reviewedAt) >
    reviewMaximumDays * day
  ) {
    throw new Error(`${description} review window exceeds policy`)
  }
  if (
    Date.parse(currentness.validUntil) - Date.parse(currentness.reviewedAt) >
    validMaximumDays * day
  ) {
    throw new Error(`${description} validity window exceeds policy`)
  }
}

function readJson(filename) {
  const raw = fs.readFileSync(filename)
  return { raw, value: JSON.parse(raw) }
}

function findForbiddenFields(value, forbiddenFields, pathPrefix = '$') {
  const matches = []
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      matches.push(...findForbiddenFields(item, forbiddenFields, `${pathPrefix}[${index}]`))
    })
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenFields.has(key)) matches.push(`${pathPrefix}.${key}`)
      matches.push(...findForbiddenFields(item, forbiddenFields, `${pathPrefix}.${key}`))
    }
  }
  return matches
}

function validatePolicy(value, expectedCommit) {
  exactKeys(
    value,
    [
      'authoringSchema',
      'policyId',
      'policyVersion',
      'status',
      'sourceSnapshot',
      'evaluationAsOf',
      'publicationAuthorization',
      'globalSafetyMilestoneRef',
      'evidenceThresholds',
      'freshnessMaximumDays',
      'routeFamilies',
      'stepCategories',
      'forbiddenFields',
      'failureReasons',
      'review'
    ],
    [],
    'route eligibility policy'
  )
  if (value.authoringSchema !== 'QuestGrowthRouteEligibilityPolicy/1alpha') {
    throw new Error('unsupported route eligibility policy schema')
  }
  identifier(value.policyId, 'policy id')
  requiredText(value.policyVersion, 'policy version')
  oneOf(value.status, ['draft', 'approved', 'withdrawn'], 'policy status')
  validateSnapshot(value.sourceSnapshot, expectedCommit, 'policy source snapshot')
  timestamp(value.evaluationAsOf, 'policy evaluationAsOf')
  if (value.publicationAuthorization !== 'R7_NOT_AUTHORIZED') {
    throw new Error('R7 concrete route publication is not authorized')
  }
  validateVersionedRef(value.globalSafetyMilestoneRef, 'global safety milestone ref')
  exactKeys(
    value.evidenceThresholds,
    ['evergreenMechanicGroups', 'routeMechanicGroups', 'editorialGroups'],
    [],
    'evidence thresholds'
  )
  for (const [key, count] of Object.entries(value.evidenceThresholds)) {
    if (!Number.isInteger(count) || count < 2) throw new Error(`invalid evidence threshold ${key}`)
  }
  exactKeys(value.freshnessMaximumDays, [], Object.keys(value.freshnessMaximumDays), 'freshness')
  for (const [key, days] of Object.entries(value.freshnessMaximumDays)) {
    identifier(key, `freshness key ${key}`)
    if (!Number.isInteger(days) || days < 1) throw new Error(`invalid freshness ${key}`)
  }
  for (const key of [
    'evergreen-mechanic-review',
    'evergreen-mechanic-valid',
    'evergreen-editorial-review',
    'evergreen-editorial-valid',
    'normal-map-review',
    'normal-map-valid',
    'eo-review',
    'eo-valid',
    'event-overlay-review',
    'event-overlay-valid'
  ]) {
    if (!(key in value.freshnessMaximumDays)) throw new Error(`missing freshness policy ${key}`)
  }
  const routeFamilies = new Set(unique(value.routeFamilies, 'route families', identifier, 1))
  const stepCategories = new Set(unique(value.stepCategories, 'step categories', identifier, 1))
  const forbiddenFields = new Set(unique(value.forbiddenFields, 'forbidden fields', identifier, 1))
  const failureReasons = new Set(unique(value.failureReasons, 'failure reasons', identifier, 1))
  const approvalDigest = semanticApprovalDigest(value)
  validateReview(value.review, value.status, 'policy review', approvalDigest)
  return {
    value,
    routeFamilies,
    stepCategories,
    forbiddenFields,
    failureReasons,
    approvalDigest
  }
}

function validateEvidenceLineage(value, expectedCommit, evidence, policy) {
  exactKeys(
    value,
    ['authoringSchema', 'lineageVersion', 'sourceSnapshot', 'independenceGroups', 'claimSupports'],
    [],
    'route evidence lineage'
  )
  if (value.authoringSchema !== 'QuestGrowthRouteEvidenceLineage/1alpha') {
    throw new Error('unsupported route evidence lineage schema')
  }
  requiredText(value.lineageVersion, 'route evidence lineage version')
  validateSnapshot(value.sourceSnapshot, expectedCommit, 'route evidence lineage source snapshot')
  const groups = new Map()
  const sourceGroup = new Map()
  unique(
    value.independenceGroups,
    'independence groups',
    (group, description) => {
      exactKeys(
        group,
        ['independenceGroupId', 'label', 'sourceRefs', 'upstreamGroupRefs', 'notes'],
        [],
        description
      )
      const groupId = identifier(group.independenceGroupId, `${description} id`)
      requiredText(group.label, `${description} label`)
      unique(
        group.sourceRefs,
        `${description} source refs`,
        (sourceRef, sourceDescription) => {
          const id = identifier(sourceRef, sourceDescription)
          if (!evidence.sources.has(id)) throw new Error(`unknown route evidence source ${id}`)
          if (sourceGroup.has(id))
            throw new Error(`source assigned to multiple independence groups ${id}`)
          sourceGroup.set(id, groupId)
          return id
        },
        1
      )
      unique(group.upstreamGroupRefs, `${description} upstream refs`, identifier)
      unique(group.notes, `${description} notes`, requiredText)
      groups.set(groupId, group)
      return groupId
    },
    2
  )
  for (const group of groups.values()) {
    for (const ref of group.upstreamGroupRefs) {
      if (!groups.has(ref) || ref === group.independenceGroupId) {
        throw new Error(`invalid upstream independence group ${ref}`)
      }
    }
  }
  const supports = new Map()
  unique(
    value.claimSupports,
    'claim supports',
    (support, description) => {
      exactKeys(
        support,
        [
          'claimSupportId',
          'claimRef',
          'sourceRef',
          'supportKind',
          'minimumClaim',
          'independenceGroupId',
          'derivationKind',
          'accessibilityAtReview',
          'reviewedAt',
          'reviewBy',
          'validUntil',
          'reviewer',
          'notes'
        ],
        [],
        description
      )
      const supportId = identifier(support.claimSupportId, `${description} id`)
      identifier(support.claimRef, `${description} claim ref`)
      identifier(support.sourceRef, `${description} source ref`)
      identifier(support.independenceGroupId, `${description} group id`)
      if (!evidence.claims.has(support.claimRef))
        throw new Error(`unknown claim ${support.claimRef}`)
      const source = evidence.sources.get(support.sourceRef)
      if (!source) throw new Error(`unknown source ${support.sourceRef}`)
      if (sourceGroup.get(support.sourceRef) !== support.independenceGroupId) {
        throw new Error(`claim support independence group mismatch ${supportId}`)
      }
      if (source.accessibility !== support.accessibilityAtReview) {
        throw new Error(`claim support accessibility mismatch ${supportId}`)
      }
      if (!source.supportedClaims.includes(support.claimRef)) {
        throw new Error(`source does not declare claim support ${supportId}`)
      }
      oneOf(
        support.supportKind,
        ['direct', 'conditional', 'contradicts', 'historical'],
        `${description} support kind`
      )
      requiredText(support.minimumClaim, `${description} minimum claim`)
      oneOf(
        support.derivationKind,
        ['original', 'translation', 'excerpt', 'reprint', 'same-editorial-ecosystem', 'unknown'],
        `${description} derivation kind`
      )
      oneOf(
        support.accessibilityAtReview,
        ['independently-readable', 'unreadable', 'prompt-supplied-observation'],
        `${description} accessibility`
      )
      const reviewedAt = timestamp(support.reviewedAt, `${description} reviewedAt`)
      const reviewBy = timestamp(support.reviewBy, `${description} reviewBy`)
      const validUntil = timestamp(support.validUntil, `${description} validUntil`)
      if (
        Date.parse(reviewedAt) > Date.parse(reviewBy) ||
        Date.parse(reviewBy) > Date.parse(validUntil)
      ) {
        throw new Error(`invalid ${description} currentness ordering`)
      }
      identifier(support.reviewer, `${description} reviewer`)
      unique(support.notes, `${description} notes`, requiredText)
      const claim = evidence.claims.get(support.claimRef)
      const freshnessClass =
        claim.classification === 'mechanic' ? 'evergreen-mechanic' : 'evergreen-editorial'
      validateFreshnessWindow(
        { reviewedAt, reviewBy, validUntil },
        policy.value.freshnessMaximumDays[`${freshnessClass}-review`],
        policy.value.freshnessMaximumDays[`${freshnessClass}-valid`],
        description
      )
      supports.set(supportId, {
        ...support,
        reviewDue: Date.parse(policy.value.evaluationAsOf) > Date.parse(reviewBy),
        expired: Date.parse(policy.value.evaluationAsOf) > Date.parse(validUntil)
      })
      return supportId
    },
    1
  )
  return { value, groups, supports }
}

function validateLineages(value, expectedCommit, policy, catalog, evidence, rubrics) {
  exactKeys(
    value,
    ['authoringSchema', 'catalogVersion', 'sourceSnapshot', 'lineages'],
    [],
    'route lineage catalog'
  )
  if (value.authoringSchema !== 'QuestGrowthRouteLineages/1alpha') {
    throw new Error('unsupported route lineage catalog schema')
  }
  requiredText(value.catalogVersion, 'route lineage catalog version')
  validateSnapshot(value.sourceSnapshot, expectedCommit, 'route lineage catalog source snapshot')
  const lineages = new Map()
  const families = new Set()
  const rubricIds = new Set([...rubrics.values()].map((item) => item.rubricId))
  unique(
    value.lineages,
    'route lineages',
    (lineage, description) => {
      exactKeys(
        lineage,
        [
          'routeLineageId',
          'revision',
          'status',
          'routeFamily',
          'scopeClass',
          'goal',
          'milestoneRefs',
          'rubricRefs',
          'claimRefs',
          'applicabilityEnvelope',
          'routeUnitRefs',
          'supersedes',
          'changeSummary',
          'currentness',
          'gameVersionScope',
          'review',
          'boundaryPolicyRef',
          'concreteOutputAllowed'
        ],
        [],
        description
      )
      const id = identifier(lineage.routeLineageId, `${description} id`)
      if (!Number.isInteger(lineage.revision) || lineage.revision < 1)
        throw new Error(`invalid ${description} revision`)
      oneOf(lineage.status, ['draft', 'reviewed', 'withdrawn'], `${description} status`)
      identifier(lineage.routeFamily, `${description} route family`)
      if (!policy.routeFamilies.has(lineage.routeFamily))
        throw new Error(`unknown route family ${lineage.routeFamily}`)
      if (families.has(lineage.routeFamily))
        throw new Error(`duplicate route family lineage ${lineage.routeFamily}`)
      families.add(lineage.routeFamily)
      oneOf(
        lineage.scopeClass,
        ['evergreen', 'normal-map', 'eo', 'event-overlay'],
        `${description} scope class`
      )
      if (lineage.scopeClass === 'event-overlay')
        throw new Error('event overlay is excluded from the R6 pilot')
      requiredText(lineage.goal, `${description} goal`)
      unique(
        lineage.milestoneRefs,
        `${description} milestone refs`,
        (ref, refDescription) => {
          validateVersionedRef(ref, refDescription)
          const milestone = catalog.milestones.get(ref.id)
          if (!milestone) throw new Error(`unknown milestone ${ref.id}`)
          if (milestone.revision !== ref.revision)
            throw new Error(`milestone revision mismatch ${ref.id}`)
          return `${ref.id}@${ref.revision}`
        },
        1
      )
      unique(lineage.rubricRefs, `${description} rubric refs`, (ref, refDescription) => {
        const rubricRef = identifier(ref, refDescription)
        if (!rubricIds.has(rubricRef)) throw new Error(`unknown decision rubric ${rubricRef}`)
        return rubricRef
      })
      unique(
        lineage.claimRefs,
        `${description} claim refs`,
        (ref, refDescription) => {
          const claimRef = identifier(ref, refDescription)
          if (!evidence.claims.has(claimRef)) throw new Error(`unknown claim ${claimRef}`)
          return claimRef
        },
        1
      )
      unique(lineage.applicabilityEnvelope, `${description} applicability`, requiredText, 1)
      unique(
        lineage.routeUnitRefs,
        `${description} unit refs`,
        (ref, refDescription) => {
          validateVersionedRef(ref, refDescription)
          return `${ref.id}@${ref.revision}`
        },
        1
      )
      if (lineage.supersedes !== null)
        validateVersionedRef(lineage.supersedes, `${description} supersedes`)
      if (typeof lineage.changeSummary !== 'string')
        throw new Error(`invalid ${description} change summary`)
      const currentness = validateCurrentness(
        lineage.currentness,
        policy.value.evaluationAsOf,
        `${description} currentness`
      )
      const freshnessClass =
        lineage.scopeClass === 'evergreen' ? 'evergreen-editorial' : lineage.scopeClass
      validateFreshnessWindow(
        currentness,
        policy.value.freshnessMaximumDays[`${freshnessClass}-review`],
        policy.value.freshnessMaximumDays[`${freshnessClass}-valid`],
        description
      )
      requiredText(lineage.gameVersionScope, `${description} game version scope`)
      const approvalDigest = semanticApprovalDigest(lineage)
      validateReview(lineage.review, lineage.status, `${description} review`, approvalDigest)
      if (lineage.boundaryPolicyRef !== policy.value.policyId)
        throw new Error(`${description} policy mismatch`)
      if (lineage.concreteOutputAllowed !== false)
        throw new Error(`${description} concrete output must be false`)
      lineages.set(id, { ...lineage, currentnessAudit: currentness, approvalDigest })
      return id
    },
    policy.routeFamilies.size
  )
  if (lineages.size !== policy.routeFamilies.size || families.size !== policy.routeFamilies.size) {
    throw new Error('R6 pilot must define exactly one lineage for every approved route family')
  }
  return { value, lineages }
}

function validateUnits(value, expectedCommit, policy, lineages, observability, rubrics, evidence) {
  exactKeys(
    value,
    ['authoringSchema', 'catalogVersion', 'sourceSnapshot', 'units'],
    [],
    'route unit catalog'
  )
  if (value.authoringSchema !== 'QuestGrowthRouteUnits/1alpha') {
    throw new Error('unsupported route unit catalog schema')
  }
  requiredText(value.catalogVersion, 'route unit catalog version')
  validateSnapshot(value.sourceSnapshot, expectedCommit, 'route unit catalog source snapshot')
  const forbiddenPaths = findForbiddenFields(value.units, policy.forbiddenFields)
  if (forbiddenPaths.length > 0) {
    throw new Error(`FORBIDDEN_R6_CONCRETE_STEP_FIELD ${forbiddenPaths.join(', ')}`)
  }
  const rubricObservableIds = new Set(rubrics.keys())
  const units = new Map()
  unique(
    value.units,
    'route units',
    (unit, description) => {
      exactKeys(
        unit,
        [
          'routeUnitId',
          'lineageRef',
          'revision',
          'status',
          'objective',
          'applicability',
          'prerequisites',
          'requiredObservables',
          'unknownPolicy',
          'stepCategories',
          'benefits',
          'costs',
          'risks',
          'stopConditions',
          'fallback',
          'evidenceRefs',
          'gameVersion',
          'eventScope',
          'currentness',
          'review',
          'eligibilityPolicyRef',
          'questStrategyRefs',
          'publicationClass'
        ],
        [],
        description
      )
      const id = identifier(unit.routeUnitId, `${description} id`)
      validateVersionedRef(unit.lineageRef, `${description} lineage ref`)
      const lineage = lineages.get(unit.lineageRef.id)
      if (!lineage) throw new Error(`unknown route lineage ${unit.lineageRef.id}`)
      if (lineage.revision !== unit.lineageRef.revision)
        throw new Error(`route lineage revision mismatch ${id}`)
      if (!Number.isInteger(unit.revision) || unit.revision < 1)
        throw new Error(`invalid ${description} revision`)
      oneOf(unit.status, ['draft', 'reviewed', 'withdrawn'], `${description} status`)
      exactKeys(unit.objective, ['kind', 'summary'], [], `${description} objective`)
      identifier(unit.objective.kind, `${description} objective kind`)
      requiredText(unit.objective.summary, `${description} objective summary`)
      for (const key of [
        'applicability',
        'prerequisites',
        'benefits',
        'costs',
        'risks',
        'stopConditions'
      ]) {
        unique(unit[key], `${description} ${key}`, requiredText, 1)
      }
      if (!unit.prerequisites.includes('global-safety-gate:manual-check')) {
        throw new Error(`missing global safety gate ${id}`)
      }
      const observableAudits = []
      unique(
        unit.requiredObservables,
        `${description} required observables`,
        (requirement, requirementDescription) => {
          exactKeys(
            requirement,
            ['observableId', 'role', 'use', 'unknownPolicy'],
            [],
            requirementDescription
          )
          const observableId = identifier(requirement.observableId, `${requirementDescription} id`)
          const observable = observability.get(observableId)
          if (!observable) throw new Error(`unknown observable ${observableId}`)
          requiredText(requirement.role, `${requirementDescription} role`)
          oneOf(
            requirement.use,
            ['gate', 'manual-context', 'fallback-context'],
            `${requirementDescription} use`
          )
          oneOf(
            requirement.unknownPolicy,
            ['block', 'manual-check', 'fallback'],
            `${requirementDescription} unknown policy`
          )
          if (observable.coverage === 'partial' && requirement.use === 'gate') {
            throw new Error(`OBSERVABLE_PARTIAL_GATE_FORBIDDEN ${observableId}`)
          }
          if (observable.coverage === 'partial' && !rubricObservableIds.has(observableId)) {
            throw new Error(`REQUIRED_RUBRIC_MISSING ${observableId}`)
          }
          if (
            observable.coverage === 'partial' &&
            !lineage.rubricRefs.includes(rubrics.get(observableId).rubricId)
          ) {
            throw new Error(`lineage omits required rubric ${observableId}`)
          }
          if (observable.coverage === 'unavailable' && requirement.use === 'gate') {
            throw new Error(`OBSERVABLE_UNAVAILABLE ${observableId}`)
          }
          observableAudits.push({
            observableId,
            coverage: observable.coverage,
            use: requirement.use
          })
          return observableId
        },
        1
      )
      oneOf(
        unit.unknownPolicy,
        ['block', 'manual-check', 'fallback'],
        `${description} unknown policy`
      )
      unique(
        unit.stepCategories,
        `${description} step categories`,
        (category, categoryDescription) => {
          const result = identifier(category, categoryDescription)
          if (!policy.stepCategories.has(result)) throw new Error(`unknown step category ${result}`)
          return result
        },
        1
      )
      requiredText(unit.fallback, `${description} fallback`)
      unique(
        unit.evidenceRefs,
        `${description} evidence refs`,
        (claimRef, claimDescription) => {
          const result = identifier(claimRef, claimDescription)
          if (!evidence.claims.has(result)) throw new Error(`unknown claim ${result}`)
          return result
        },
        1
      )
      for (const claimRef of unit.evidenceRefs) {
        if (!lineage.claimRefs.includes(claimRef)) {
          throw new Error(`route unit evidence is outside lineage ${id}: ${claimRef}`)
        }
      }
      requiredText(unit.gameVersion, `${description} game version`)
      if (unit.eventScope !== null)
        throw new Error(`${description} event scope is excluded from R6`)
      const currentness = validateCurrentness(
        unit.currentness,
        policy.value.evaluationAsOf,
        `${description} currentness`
      )
      const freshnessClass =
        lineage.scopeClass === 'evergreen' ? 'evergreen-editorial' : lineage.scopeClass
      validateFreshnessWindow(
        currentness,
        policy.value.freshnessMaximumDays[`${freshnessClass}-review`],
        policy.value.freshnessMaximumDays[`${freshnessClass}-valid`],
        description
      )
      const approvalDigest = semanticApprovalDigest(unit)
      validateReview(unit.review, unit.status, `${description} review`, approvalDigest)
      if (unit.eligibilityPolicyRef !== policy.value.policyId)
        throw new Error(`${description} policy mismatch`)
      if (!Array.isArray(unit.questStrategyRefs) || unit.questStrategyRefs.length !== 0) {
        throw new Error(`QUEST_STRATEGY_FACT_DUPLICATED ${id}`)
      }
      if (unit.publicationClass !== 'reviewed-authoring-only')
        throw new Error(`invalid ${description} publication class`)
      units.set(id, {
        ...unit,
        observableAudits,
        currentnessAudit: currentness,
        approvalDigest
      })
      return id
    },
    lineages.size
  )
  for (const lineage of lineages.values()) {
    for (const ref of lineage.routeUnitRefs) {
      const unit = units.get(ref.id)
      if (!unit) throw new Error(`unknown route unit ${ref.id}`)
      if (unit.revision !== ref.revision || unit.lineageRef.id !== lineage.routeLineageId) {
        throw new Error(`route unit reference mismatch ${ref.id}`)
      }
    }
  }
  if (units.size !== lineages.size)
    throw new Error('R6 pilot must define exactly one unit per lineage')
  return { value, units }
}

function claimEvidenceAudit(claimRef, routeEvidence, evidence, policy, evaluationAsOf) {
  const claim = evidence.claims.get(claimRef)
  const supports = [...routeEvidence.supports.values()].filter(
    (item) => item.claimRef === claimRef && item.supportKind !== 'contradicts'
  )
  const accessible = supports.filter(
    (item) =>
      item.accessibilityAtReview === 'independently-readable' &&
      evidence.sources.get(item.sourceRef).independence === 'independent' &&
      !item.expired &&
      Date.parse(item.reviewedAt) <= Date.parse(evaluationAsOf) &&
      !['reprint', 'same-editorial-ecosystem'].includes(item.derivationKind)
  )
  const groups = [...new Set(accessible.map((item) => item.independenceGroupId))]
  const blockers = []
  if (claim.promotionStatus !== 'candidate') blockers.push('CLAIM_NOT_PROMOTION_CANDIDATE')
  if (claim.confidence === 'insufficient') blockers.push('CLAIM_CONFIDENCE_INSUFFICIENT')
  const evidenceThreshold =
    claim.classification === 'mechanic'
      ? policy.value.evidenceThresholds.evergreenMechanicGroups
      : policy.value.evidenceThresholds.editorialGroups
  if (groups.length < evidenceThreshold) {
    blockers.push(
      claim.classification === 'mechanic'
        ? 'MINIMUM_MECHANIC_EVIDENCE_NOT_MET'
        : 'MINIMUM_EDITORIAL_EVIDENCE_NOT_MET'
    )
  }
  if (supports.some((item) => item.supportKind === 'contradicts'))
    blockers.push('HARD_MECHANIC_CONFLICT')
  if (supports.some((item) => item.reviewDue)) blockers.push('REVIEW_DUE')
  if (supports.some((item) => item.expired)) blockers.push('EVIDENCE_EXPIRED')
  return { claimRef, accessibleIndependentGroups: groups, supportCount: supports.length, blockers }
}

function auditUnit(unit, lineage, routeEvidence, evidence, policy) {
  const reasonCodes = []
  if (policy.value.status !== 'approved') reasonCodes.push('POLICY_OWNER_APPROVAL_MISSING')
  if (lineage.status !== 'reviewed' || unit.status !== 'reviewed')
    reasonCodes.push('ROUTE_NOT_REVIEWED')
  if (!lineage.review.approver || !unit.review.approver) reasonCodes.push('APPROVER_MISSING')
  if (lineage.currentnessAudit.reviewDue || unit.currentnessAudit.reviewDue)
    reasonCodes.push('REVIEW_DUE')
  if (lineage.currentnessAudit.expired || unit.currentnessAudit.expired)
    reasonCodes.push('EVIDENCE_EXPIRED')
  const claimAudits = unit.evidenceRefs.map((ref) =>
    claimEvidenceAudit(ref, routeEvidence, evidence, policy, policy.value.evaluationAsOf)
  )
  reasonCodes.push(...claimAudits.flatMap((item) => item.blockers))
  for (const observable of unit.observableAudits) {
    if (observable.coverage === 'partial' && observable.use === 'gate') {
      reasonCodes.push('OBSERVABLE_PARTIAL_GATE_FORBIDDEN')
    }
    if (observable.coverage === 'unavailable') reasonCodes.push('OBSERVABLE_UNAVAILABLE')
  }
  if (policy.value.publicationAuthorization !== 'R7_AUTHORIZED') {
    reasonCodes.push('R7_AUTHORIZATION_MISSING')
  }
  const uniqueReasons = [...new Set(reasonCodes)]
  const contentDecision = uniqueReasons.some((reason) =>
    ['HARD_MECHANIC_CONFLICT', 'EVIDENCE_EXPIRED'].includes(reason)
  )
    ? 'INELIGIBLE'
    : uniqueReasons.some((reason) => reason !== 'R7_AUTHORIZATION_MISSING')
      ? 'MANUAL_CHECK_ONLY'
      : 'R7_CANDIDATE'
  return {
    routeUnitId: unit.routeUnitId,
    routeLineageId: lineage.routeLineageId,
    routeFamily: lineage.routeFamily,
    contentDecision,
    effectiveState: contentDecision === 'R7_CANDIDATE' ? 'BLOCKED_R7_NOT_AUTHORIZED' : 'BLOCKED',
    reasonCodes: uniqueReasons,
    claimAudits,
    observableAudits: unit.observableAudits,
    fallback: unit.fallback
  }
}

function evaluateFixtureCase(item) {
  const reasonCodes = []
  let contentDecision = 'R7_CANDIDATE'
  if (item.forbiddenFields.length > 0 || item.axes.schema === 'invalid') {
    contentDecision = 'INELIGIBLE'
    reasonCodes.push('FORBIDDEN_R6_CONCRETE_STEP_FIELD')
  } else if (item.axes.conflict === 'fail') {
    contentDecision = 'INELIGIBLE'
    reasonCodes.push('HARD_MECHANIC_CONFLICT')
  } else if (item.axes.evidence !== 'pass') {
    contentDecision = 'MANUAL_CHECK_ONLY'
    reasonCodes.push(
      item.caseId.includes('same-independence')
        ? 'INDEPENDENCE_GROUP_DUPLICATE'
        : 'SOURCE_PROMPT_SUPPLIED_ONLY'
    )
  } else if (item.axes.observability !== 'pass') {
    contentDecision = 'MANUAL_CHECK_ONLY'
    reasonCodes.push(
      item.axes.observability === 'fail'
        ? 'OBSERVABLE_UNAVAILABLE'
        : 'OBSERVABLE_PARTIAL_GATE_FORBIDDEN'
    )
  } else if (item.axes.approval !== 'pass') {
    contentDecision = 'MANUAL_CHECK_ONLY'
    reasonCodes.push('APPROVER_MISSING')
  } else if (item.publicationAuthorization !== 'R7_AUTHORIZED') {
    reasonCodes.push('R7_AUTHORIZATION_MISSING')
  }
  return {
    contentDecision,
    effectiveState:
      contentDecision === 'R7_CANDIDATE'
        ? item.publicationAuthorization === 'R7_AUTHORIZED'
          ? 'RUNTIME_ELIGIBLE'
          : 'BLOCKED_R7_NOT_AUTHORIZED'
        : 'BLOCKED',
    reasonCodes
  }
}

function validateFixtures(value, policy) {
  exactKeys(value, ['authoringSchema', 'fixtureVersion', 'privacy', 'cases'], [], 'route fixtures')
  if (value.authoringSchema !== 'QuestGrowthRouteEligibilityFixtures/1alpha') {
    throw new Error('unsupported route fixture schema')
  }
  requiredText(value.fixtureVersion, 'route fixture version')
  exactKeys(
    value.privacy,
    ['containsAccountIdentifier', 'containsRawPayload'],
    [],
    'route fixture privacy'
  )
  if (
    value.privacy.containsAccountIdentifier !== false ||
    value.privacy.containsRawPayload !== false
  ) {
    throw new Error('route fixtures must be anonymous and contain no raw payload')
  }
  const results = unique(
    value.cases,
    'route fixture cases',
    (item, description) => {
      exactKeys(
        item,
        ['caseId', 'axes', 'publicationAuthorization', 'forbiddenFields', 'expected'],
        [],
        description
      )
      const caseId = identifier(item.caseId, `${description} id`)
      exactKeys(item.axes, [], Object.keys(item.axes), `${description} axes`)
      for (const [axis, state] of Object.entries(item.axes)) {
        identifier(axis, `${description} axis`)
        oneOf(state, ['pass', 'fail', 'insufficient', 'invalid'], `${description} axis state`)
      }
      oneOf(
        item.publicationAuthorization,
        ['R7_NOT_AUTHORIZED', 'R7_AUTHORIZED'],
        `${description} publication`
      )
      unique(item.forbiddenFields, `${description} forbidden fields`, identifier)
      for (const field of item.forbiddenFields) {
        if (!policy.forbiddenFields.has(field))
          throw new Error(`fixture uses unknown forbidden field ${field}`)
      }
      exactKeys(
        item.expected,
        ['contentDecision', 'effectiveState', 'reasonCodes'],
        [],
        `${description} expected`
      )
      oneOf(
        item.expected.contentDecision,
        ['INELIGIBLE', 'MANUAL_CHECK_ONLY', 'R7_CANDIDATE'],
        `${description} content decision`
      )
      oneOf(
        item.expected.effectiveState,
        ['BLOCKED', 'BLOCKED_R7_NOT_AUTHORIZED', 'RUNTIME_ELIGIBLE'],
        `${description} effective state`
      )
      unique(item.expected.reasonCodes, `${description} reason codes`, identifier)
      for (const reason of item.expected.reasonCodes) {
        if (!policy.failureReasons.has(reason)) throw new Error(`unknown fixture reason ${reason}`)
      }
      const observed = evaluateFixtureCase(item)
      if (JSON.stringify(observed) !== JSON.stringify(item.expected)) {
        throw new Error(`route fixture expectation mismatch ${caseId}`)
      }
      return { caseId, expected: item.expected, observed, passed: true }
    },
    1
  )
  return results
}

function buildRouteLineageArtifacts({
  root,
  base,
  evidence,
  catalog,
  observability,
  decisionRubrics
}) {
  const paths = {
    schema: path.join(base, 'authoring-schema-2alpha.json'),
    policy: path.join(base, 'authoring', 'route-eligibility-policy.json'),
    evidenceLineage: path.join(base, 'authoring', 'route-evidence-lineage.json'),
    lineages: path.join(base, 'authoring', 'route-lineages.json'),
    units: path.join(base, 'authoring', 'route-units.json'),
    fixtures: path.join(base, 'fixtures', 'route-lineage', 'eligibility-cases.json')
  }
  const inputs = Object.fromEntries(
    Object.entries(paths).map(([key, filename]) => [key, readJson(filename)])
  )
  if (inputs.schema.value.title !== 'QuestGrowthRouteAuthoring/2alpha') {
    throw new Error('unsupported R6 route authoring schema')
  }
  const expectedCommit = R6AuditedBaseCommit
  const policy = validatePolicy(inputs.policy.value, expectedCommit)
  const safetyMilestone = catalog.milestones.get(policy.value.globalSafetyMilestoneRef.id)
  if (
    !safetyMilestone ||
    safetyMilestone.revision !== policy.value.globalSafetyMilestoneRef.revision
  ) {
    throw new Error('global safety milestone reference mismatch')
  }
  const routeEvidence = validateEvidenceLineage(
    inputs.evidenceLineage.value,
    expectedCommit,
    evidence,
    policy
  )
  const lineages = validateLineages(
    inputs.lineages.value,
    expectedCommit,
    policy,
    catalog,
    evidence,
    decisionRubrics.rubrics
  )
  const units = validateUnits(
    inputs.units.value,
    expectedCommit,
    policy,
    lineages.lineages,
    observability.observables,
    decisionRubrics.rubrics,
    evidence
  )
  const fixtureResults = validateFixtures(inputs.fixtures.value, policy)
  const routeUnitAudits = [...units.units.values()].map((unit) =>
    auditUnit(unit, lineages.lineages.get(unit.lineageRef.id), routeEvidence, evidence, policy)
  )
  for (const audit of routeUnitAudits) {
    for (const reason of audit.reasonCodes) {
      if (!policy.failureReasons.has(reason)) {
        throw new Error(`route audit produced unregistered reason ${reason}`)
      }
    }
  }
  const reviewedCount = [...units.units.values()].filter(
    (item) => item.status === 'reviewed'
  ).length
  const manualCheckOnlyCount = routeUnitAudits.filter(
    (item) => item.contentDecision === 'MANUAL_CHECK_ONLY'
  ).length
  const r7CandidateCount = routeUnitAudits.filter(
    (item) => item.contentDecision === 'R7_CANDIDATE'
  ).length
  const runtimeEligibleCount = routeUnitAudits.filter(
    (item) => item.effectiveState === 'RUNTIME_ELIGIBLE'
  ).length
  if (runtimeEligibleCount !== 0)
    throw new Error('R6 must not produce runtime-eligible route units')
  const inputDigests = Object.fromEntries(
    Object.entries(inputs).map(([key, input]) => [`${key}Digest`, digest(input.raw)])
  )
  const routeLineageManifest = {
    schemaVersion: 1,
    compilerVersion: RouteCompilerVersion,
    source: {
      auditedBaseCommit: expectedCommit,
      evaluationAsOf: policy.value.evaluationAsOf,
      ...inputDigests
    },
    output: {
      independenceGroupCount: routeEvidence.groups.size,
      claimSupportCount: routeEvidence.supports.size,
      routeLineageCount: lineages.lineages.size,
      routeUnitCount: units.units.size,
      reviewedRouteUnitCount: reviewedCount,
      manualCheckOnlyCount,
      r7CandidateCount,
      runtimeEligibleCount,
      validationCaseCount: fixtureResults.length
    },
    publicationAuthorization: policy.value.publicationAuthorization
  }
  const routeEligibilityReport = {
    schemaVersion: 1,
    compilerVersion: RouteCompilerVersion,
    evaluationAsOf: policy.value.evaluationAsOf,
    policyId: policy.value.policyId,
    policyStatus: policy.value.status,
    publicationAuthorization: policy.value.publicationAuthorization,
    routeUnitAudits,
    globalStops: [
      ...(policy.value.status === 'approved' ? [] : ['POLICY_OWNER_APPROVAL_MISSING']),
      'R7_AUTHORIZATION_MISSING'
    ]
  }
  const routeValidationMatrix = {
    schemaVersion: 1,
    compilerVersion: RouteCompilerVersion,
    fixtureVersion: inputs.fixtures.value.fixtureVersion,
    passed: fixtureResults.every((item) => item.passed),
    cases: fixtureResults
  }
  const routeApprovalPacket = {
    schemaVersion: 1,
    compilerVersion: RouteCompilerVersion,
    packetVersion: '1.0.0-alpha.1',
    generatedAt: policy.value.evaluationAsOf,
    status: 'AWAITING_PROJECT_OWNER_REVIEW',
    scope: 'R6_AUTHORING_REVIEW_ONLY',
    publicationAuthorization: policy.value.publicationAuthorization,
    evidenceLineageDigest: inputDigests.evidenceLineageDigest,
    policy: {
      policyId: policy.value.policyId,
      policyVersion: policy.value.policyVersion,
      currentStatus: policy.value.status,
      semanticDigest: policy.approvalDigest
    },
    lineages: [...lineages.lineages.values()].map((lineage) => ({
      routeLineageId: lineage.routeLineageId,
      revision: lineage.revision,
      currentStatus: lineage.status,
      semanticDigest: lineage.approvalDigest
    })),
    routeUnits: [...units.units.values()].map((unit) => ({
      routeUnitId: unit.routeUnitId,
      revision: unit.revision,
      currentStatus: unit.status,
      semanticDigest: unit.approvalDigest
    })),
    approvalRequirements: {
      requiredApprover: 'project-owner',
      authorApproverMustDiffer: true,
      exactDigestMatchRequired: true,
      r7AuthorizationIncluded: false,
      runtimePublicationIncluded: false,
      realAccountAcceptanceIncluded: false
    }
  }
  return {
    artifacts: {
      'route-lineage-manifest.json': routeLineageManifest,
      'route-eligibility-report.json': routeEligibilityReport,
      'route-validation-matrix.json': routeValidationMatrix,
      'route-approval-packet.json': routeApprovalPacket
    },
    source: inputDigests,
    output: routeLineageManifest.output,
    eligibilityReport: routeEligibilityReport
  }
}

module.exports = {
  RouteOutputFilenames,
  buildRouteLineageArtifacts,
  evaluateFixtureCase,
  findForbiddenFields,
  semanticApprovalDigest,
  validatePolicy
}

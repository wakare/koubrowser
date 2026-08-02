const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
const VersionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/
const MapKeyPattern = /^[1-9]\d*-[1-9]\d*$/
const MaximumRecipes = 512

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

function integer(value, description, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`invalid ${description}`)
  }
  return value
}

function oneOf(value, values, description) {
  if (!values.includes(value)) {
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

function uniqueArray(value, description, validate, minimumLength = 0) {
  if (!Array.isArray(value) || value.length < minimumLength) {
    throw new Error(`invalid ${description}`)
  }
  const result = value.map((item, index) => validate(item, `${description} ${index}`))
  if (new Set(result.map((item) => JSON.stringify(item))).size !== result.length) {
    throw new Error(`duplicate ${description}`)
  }
  return result
}

function validateEvidence(value, description) {
  exactKeys(
    value,
    ['sourceId', 'sourceLabel', 'url', 'reviewedAt', 'confidence', 'summary'],
    ['validUntil'],
    description
  )
  const url = text(value.url, `${description} URL`)
  try {
    if (new URL(url).protocol !== 'https:') {
      throw new Error()
    }
  } catch {
    throw new Error(`invalid ${description} URL`)
  }
  timestamp(value.reviewedAt, `${description} reviewedAt`)
  if (value.validUntil !== undefined) {
    timestamp(value.validUntil, `${description} validUntil`)
  }
  oneOf(value.confidence, ['verified', 'supported'], `${description} confidence`)
  text(value.sourceId, `${description} sourceId`)
  text(value.sourceLabel, `${description} sourceLabel`)
  text(value.summary, `${description} summary`)
  return value.sourceId
}

function validateValidity(value, description) {
  exactKeys(value, [], ['startsAt', 'endsAt', 'reviewBy', 'eventOnly'], description)
  const startsAt =
    value.startsAt === undefined ? undefined : timestamp(value.startsAt, `${description} startsAt`)
  const endsAt =
    value.endsAt === undefined ? undefined : timestamp(value.endsAt, `${description} endsAt`)
  if (value.reviewBy !== undefined) {
    timestamp(value.reviewBy, `${description} reviewBy`)
  }
  if (value.eventOnly !== undefined && typeof value.eventOnly !== 'boolean') {
    throw new Error(`invalid ${description} eventOnly`)
  }
  if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) {
    throw new Error(`invalid ${description} window`)
  }
  if (value.eventOnly && (!startsAt || !endsAt)) {
    throw new Error(`${description} event-only window is incomplete`)
  }
}

function validateObjective(value, description) {
  exactKeys(value, ['questId', 'result', 'requiredCount'], [], description)
  integer(value.questId, `${description} questId`, 1)
  integer(value.requiredCount, `${description} requiredCount`, 1)
  oneOf(value.result, ['arrival', 'victory', 'A', 'S'], `${description} result`)
  return value.questId
}

function validateTypeConstraint(value, description, typeKey, requireRequired, allowMaximum = false) {
  exactKeys(
    value,
    [typeKey, 'minimum', 'label', ...(requireRequired ? ['required'] : [])],
    allowMaximum ? ['maximum'] : [],
    description
  )
  uniqueArray(
    value[typeKey],
    `${description} ${typeKey}`,
    (item, itemDescription) => integer(item, itemDescription, 1),
    1
  )
  const minimum = integer(value.minimum, `${description} minimum`, 1)
  if (value.maximum !== undefined) {
    integer(value.maximum, `${description} maximum`, minimum)
  }
  text(value.label, `${description} label`)
  if (requireRequired && typeof value.required !== 'boolean') {
    throw new Error(`invalid ${description} required`)
  }
}

function validateRecipe(value, description) {
  exactKeys(
    value,
    [
      'schemaVersion',
      'id',
      'revision',
      'title',
      'status',
      'questIds',
      'objectives',
      'mapKey',
      'routeLabels',
      'targetNodes',
      'fleet',
      'equipmentTypeConstraints',
      'formations',
      'actions',
      'cost',
      'risk',
      'evidence',
      'validity'
    ],
    ['targetCellIds', 'airState', 'prerequisiteAlternative'],
    description
  )
  if (value.schemaVersion !== 1) {
    throw new Error(`unsupported ${description} schema`)
  }
  const id = text(value.id, `${description} id`)
  integer(value.revision, `${description} revision`, 1)
  text(value.title, `${description} title`)
  oneOf(value.status, ['approved', 'draft', 'withdrawn'], `${description} status`)
  const questIds = uniqueArray(
    value.questIds,
    `${description} questIds`,
    (item, itemDescription) => integer(item, itemDescription, 1),
    1
  )
  const objectiveQuestIds = uniqueArray(
    value.objectives,
    `${description} objectives`,
    validateObjective,
    1
  )
  if (
    [...questIds].sort((a, b) => a - b).join(',') !==
    [...objectiveQuestIds].sort((a, b) => a - b).join(',')
  ) {
    throw new Error(`${description} objectives do not match questIds`)
  }
  if (!MapKeyPattern.test(text(value.mapKey, `${description} mapKey`))) {
    throw new Error(`invalid ${description} mapKey`)
  }
  uniqueArray(value.routeLabels, `${description} routeLabels`, text, 1)
  uniqueArray(value.targetNodes, `${description} targetNodes`, text, 1)
  if (value.targetCellIds !== undefined) {
    uniqueArray(
      value.targetCellIds,
      `${description} targetCellIds`,
      (item, itemDescription) => integer(item, itemDescription, 1),
      1
    )
  }
  exactKeys(
    value.fleet,
    ['minimumShips', 'maximumShips', 'shipTypeConstraints'],
    ['flagshipTypeIds', 'allowedShipTypeIds'],
    `${description} fleet`
  )
  const minimumShips = integer(value.fleet.minimumShips, `${description} fleet minimumShips`, 1)
  integer(value.fleet.maximumShips, `${description} fleet maximumShips`, minimumShips)
  for (const key of ['flagshipTypeIds', 'allowedShipTypeIds']) {
    if (value.fleet[key] !== undefined) {
      uniqueArray(
        value.fleet[key],
        `${description} fleet ${key}`,
        (item, itemDescription) => integer(item, itemDescription, 1),
        1
      )
    }
  }
  uniqueArray(
    value.fleet.shipTypeConstraints,
    `${description} shipTypeConstraints`,
    (item, itemDescription) => {
      validateTypeConstraint(item, itemDescription, 'shipTypeIds', false, true)
      return JSON.stringify(item)
    }
  )
  uniqueArray(
    value.equipmentTypeConstraints,
    `${description} equipmentTypeConstraints`,
    (item, itemDescription) => {
      validateTypeConstraint(item, itemDescription, 'equipmentTypeIds', true)
      return JSON.stringify(item)
    }
  )
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
      return `${formation.formationId}:${formation.label}:${formation.when ?? ''}`
    },
    1
  )
  if (value.airState !== undefined) {
    exactKeys(value.airState, ['target', 'summary'], [], `${description} airState`)
    oneOf(
      value.airState.target,
      ['denial', 'parity', 'superiority', 'supremacy'],
      `${description} airState target`
    )
    text(value.airState.summary, `${description} airState summary`)
  }
  uniqueArray(value.actions, `${description} actions`, text)
  oneOf(value.cost, ['low', 'medium', 'high'], `${description} cost`)
  oneOf(value.risk, ['low', 'medium', 'high'], `${description} risk`)
  uniqueArray(value.evidence, `${description} evidence`, validateEvidence)
  validateValidity(value.validity, `${description} validity`)
  if (value.prerequisiteAlternative !== undefined) {
    const alternative = value.prerequisiteAlternative
    exactKeys(
      alternative,
      ['groupId', 'optionId', 'requiredQuestIds'],
      [],
      `${description} prerequisiteAlternative`
    )
    text(alternative.groupId, `${description} prerequisiteAlternative groupId`)
    text(alternative.optionId, `${description} prerequisiteAlternative optionId`)
    uniqueArray(
      alternative.requiredQuestIds,
      `${description} prerequisiteAlternative requiredQuestIds`,
      (item, itemDescription) => integer(item, itemDescription, 1),
      1
    )
  }
  return id
}

function validateQuestStrategyKnowledge(value) {
  exactKeys(value, ['schemaVersion', 'version', 'recipes'], [], 'quest strategy knowledge')
  if (value.schemaVersion !== 1) {
    throw new Error('unsupported quest strategy knowledge schema')
  }
  if (typeof value.version !== 'string' || !VersionPattern.test(value.version)) {
    throw new Error('invalid quest strategy knowledge version')
  }
  if (
    !Array.isArray(value.recipes) ||
    value.recipes.length === 0 ||
    value.recipes.length > MaximumRecipes
  ) {
    throw new Error('invalid quest strategy recipe list')
  }
  uniqueArray(value.recipes, 'quest strategy recipes', validateRecipe, 1)
}

module.exports = {
  validateQuestStrategyKnowledge
}

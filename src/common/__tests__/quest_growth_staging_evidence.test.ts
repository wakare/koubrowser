import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  buildSyntheticPublicEvidence,
  validateSchemaDefinition,
  validateStagingEvidence,
  validateStagingEvidenceFiles
} = require('../../../scripts/quest-growth-r7-staging-evidence.js') as {
  buildSyntheticPublicEvidence: () => Record<string, unknown>
  validateSchemaDefinition: (value: Record<string, unknown>) => Record<string, unknown>
  validateStagingEvidence: (
    value: Record<string, any>,
    root?: string
  ) => Record<string, any>
  validateStagingEvidenceFiles: (root?: string) => {
    schema: Record<string, any>
    fixture: Record<string, any>
  }
}

const Root = process.cwd()
const FixturePath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r7',
  'fixtures',
  'staging-evidence-anonymous.json'
)
const SchemaPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r7',
  'staging-evidence.schema.json'
)

function read<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as T
}

function fixture(): Record<string, any> {
  return read<Record<string, any>>(FixturePath)
}

describe('R7 staging evidence anonymous authoring', () => {
  it('validates the approved closed schema and synthetic fixture offline', () => {
    const result = validateStagingEvidenceFiles(Root).fixture

    expect(result).toMatchObject({
      routeCount: 2,
      publicEvidenceFieldCount: 10,
      prohibitedFieldCount: 11,
      distinctRoleCount: 3,
      requiredCheckCount: 10,
      syntheticOnly: true,
      runtimeEligibleCount: 0
    })
  })

  it('keeps every evidence object schema closed to unknown fields', () => {
    const schema = read<Record<string, any>>(SchemaPath)
    expect(validateSchemaDefinition(schema)).toBe(schema)
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.bindings.additionalProperties).toBe(false)
    expect(schema.properties.publicEvidence.additionalProperties).toBe(false)
    expect(schema.properties.roleSeparation.additionalProperties).toBe(false)
    expect(schema.properties.authorization.additionalProperties).toBe(false)
  })

  it('rejects candidate or staging configuration drift', () => {
    const value = fixture()
    value.bindings.candidateCanonicalDigest =
      'sha256:0000000000000000000000000000000000000000000000000000000000000000'

    expect(() => validateStagingEvidence(value, Root)).toThrow(
      'R7 staging evidence binding mismatch'
    )
  })

  it('rejects a third route', () => {
    const value = fixture()
    value.bindings.routeIds.push('route:not-authorized')

    expect(() => validateStagingEvidence(value, Root)).toThrow(
      'R7 staging evidence binding mismatch'
    )
  })

  it('rejects an unknown public evidence field', () => {
    const value = fixture()
    value.publicEvidence.extraDigest =
      'sha256:4444444444444444444444444444444444444444444444444444444444444444'

    expect(() => validateStagingEvidence(value, Root)).toThrow(
      'unexpected R7 public evidence extraDigest'
    )
  })

  it('rejects prohibited secret, URL, path, and account fields', () => {
    const value = fixture()
    value.publicEvidence.manifestUrl = 'https://r7-evidence.invalid/manifest.json'

    expect(() => validateStagingEvidence(value, Root)).toThrow(
      'unexpected R7 public evidence manifestUrl'
    )
  })

  it('rejects collapsing the three independent roles', () => {
    const value = fixture()
    value.roleSeparation.stagingOperator = value.roleSeparation.evidenceReviewer

    expect(() => validateStagingEvidence(value, Root)).toThrow(
      'R7 staging evidence roles must remain distinct'
    )
  })

  it('rejects any real endpoint representation', () => {
    const value = fixture()
    value.endpointRepresentation = 'https-staging'

    expect(() => validateStagingEvidence(value, Root)).toThrow(
      'R7 staging evidence endpoint representation widened'
    )
  })

  it('rejects staging, publication, default enablement, or runtime eligibility', () => {
    const value = fixture()
    value.authorization.stagingAcceptanceAuthorized = true
    expect(() => validateStagingEvidence(value, Root)).toThrow(
      'R7 staging evidence execution boundary widened'
    )

    const eligible = fixture()
    eligible.authorization.runtimeEligibleCount = 1
    expect(() => validateStagingEvidence(eligible, Root)).toThrow(
      'R7 staging evidence execution boundary widened'
    )
  })

  it('emits only redacted synthetic status without sensitive values', () => {
    const value = fixture()
    const result = validateStagingEvidence(value, Root)

    expect(value.publicEvidence).toEqual(buildSyntheticPublicEvidence())
    expect(result).toMatchObject({
      syntheticOnly: true,
      keyMaterialPresent: false,
      realFingerprintPresent: false,
      realEndpointPresent: false,
      stagingAcceptanceAuthorized: false,
      runtimePublicationAuthorized: false,
      defaultEnabled: false,
      runtimeEligibleCount: 0,
      protectedCommunicationDigestsFixed: true
    })
  })
})

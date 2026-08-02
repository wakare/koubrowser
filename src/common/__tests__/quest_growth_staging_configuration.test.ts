import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  validateSchemaDefinition,
  validateStagingConfiguration,
  validateStagingConfigurationFiles
} = require('../../../scripts/quest-growth-r7-staging-configuration.js') as {
  validateSchemaDefinition: (value: Record<string, unknown>) => Record<string, unknown>
  validateStagingConfiguration: (
    value: Record<string, unknown>,
    root?: string
  ) => {
    routeCount: number
    placeholderHost: string
    keyMaterialPresent: boolean
    externalConnectionAuthorized: boolean
    runtimeEligibleCount: number
    defaultEnabled: boolean
  }
  validateStagingConfigurationFiles: (root?: string) => {
    schema: Record<string, unknown>
    fixture: { routeCount: number; candidateCanonicalDigest: string }
  }
}

const Root = process.cwd()
const FixturePath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r7',
  'fixtures',
  'staging-configuration-anonymous.json'
)
const SchemaPath = path.join(
  Root,
  'knowledge',
  'quest-growth',
  'r7',
  'staging-configuration.schema.json'
)

function read<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as T
}

function fixture(): Record<string, any> {
  return read<Record<string, any>>(FixturePath)
}

describe('R7 staging configuration authoring fixture', () => {
  it('validates the strict schema and anonymous fixture offline', () => {
    const result = validateStagingConfigurationFiles(Root)

    expect(result.fixture.routeCount).toBe(2)
    expect(result.fixture.candidateCanonicalDigest).toBe(
      'sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c'
    )
  })

  it('keeps every object schema closed to unknown fields', () => {
    const schema = read<Record<string, any>>(SchemaPath)
    expect(validateSchemaDefinition(schema)).toBe(schema)
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.candidate.additionalProperties).toBe(false)
    expect(schema.properties.endpointContract.additionalProperties).toBe(false)
    expect(schema.properties.trustContract.additionalProperties).toBe(false)
    expect(schema.properties.runtimeContract.additionalProperties).toBe(false)
  })

  it('rejects a third route family', () => {
    const value = fixture()
    value.candidate.routeBindings.push({ ...value.candidate.routeBindings[0] })

    expect(() => validateStagingConfiguration(value, Root)).toThrow(
      'R7 staging candidate binding mismatch'
    )
  })

  it('rejects unknown key material fields', () => {
    const value = fixture()
    value.trustContract.publicKey = 'not-allowed'

    expect(() => validateStagingConfiguration(value, Root)).toThrow(
      'unexpected R7 staging trust contract publicKey'
    )
  })

  it('rejects a real or external endpoint', () => {
    const value = fixture()
    value.endpointContract.manifestUrl = 'https://updates.example/data/manifest.json'

    expect(() => validateStagingConfiguration(value, Root)).toThrow(
      'R7 staging URL must remain a reserved .invalid placeholder'
    )
  })

  it('rejects external connection authorization', () => {
    const value = fixture()
    value.endpointContract.externalConnectionAllowed = true

    expect(() => validateStagingConfiguration(value, Root)).toThrow(
      'R7 staging endpoint authorization widened'
    )
  })

  it('rejects default enablement or runtime eligibility', () => {
    const enabled = fixture()
    enabled.runtimeContract.defaultEnabled = true
    expect(() => validateStagingConfiguration(enabled, Root)).toThrow(
      'R7 staging runtime authorization widened'
    )

    const eligible = fixture()
    eligible.runtimeContract.runtimeEligibleCount = 1
    expect(() => validateStagingConfiguration(eligible, Root)).toThrow(
      'R7 staging runtime authorization widened'
    )
  })

  it('rejects candidate digest drift', () => {
    const value = fixture()
    value.candidate.canonicalDigest =
      'sha256:0000000000000000000000000000000000000000000000000000000000000000'

    expect(() => validateStagingConfiguration(value, Root)).toThrow(
      'R7 staging candidate binding mismatch'
    )
  })

  it('reports only non-secret, non-endpoint acceptance fields', () => {
    const result = validateStagingConfiguration(fixture(), Root)

    expect(result).toMatchObject({
      routeCount: 2,
      placeholderHost: 'r7-staging.invalid',
      keyMaterialPresent: false,
      externalConnectionAuthorized: false,
      runtimeEligibleCount: 0,
      defaultEnabled: false
    })
  })
})

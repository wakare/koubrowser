import { generateKeyPairSync, createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  bundledDataUpdateDeployment,
  selectDataUpdateDeployment,
  type DataUpdateDeploymentValues
} from '../data-update-deployment'
import { resolveDataUpdateConfiguration } from '../data-update'

function createPublicKey(): { publicKey: string; sha256: string } {
  const keys = generateKeyPairSync('ed25519')
  const der = keys.publicKey.export({ format: 'der', type: 'spki' })
  return {
    publicKey: der.toString('base64'),
    sha256: createHash('sha256').update(der).digest('hex')
  }
}

describe('data update deployment selection', () => {
  it('keeps the checked-in bundled deployment internally consistent', () => {
    const configuration = resolveDataUpdateConfiguration(
      bundledDataUpdateDeployment.manifestUrl,
      bundledDataUpdateDeployment.publicKey,
      false,
      bundledDataUpdateDeployment.publicKeySha256
    )

    expect(configuration.status).not.toBe('invalid')
  })

  it('ignores environment trust settings in a production selection', () => {
    const bundledKey = createPublicKey()
    const environmentKey = createPublicKey()
    const bundled: DataUpdateDeploymentValues = {
      manifestUrl: 'https://updates.example/bundled/manifest.json',
      publicKey: bundledKey.publicKey,
      publicKeySha256: bundledKey.sha256
    }

    expect(
      selectDataUpdateDeployment(
        {
          KOU_DATA_UPDATE_MANIFEST_URL: 'https://updates.example/environment/manifest.json',
          KOU_DATA_UPDATE_PUBLIC_KEY: environmentKey.publicKey
        },
        false,
        bundled
      )
    ).toEqual({
      source: 'bundled',
      ...bundled
    })
  })

  it('allows an explicit development or smoke environment override', () => {
    const bundledKey = createPublicKey()
    const environmentKey = createPublicKey()
    const bundled: DataUpdateDeploymentValues = {
      manifestUrl: 'https://updates.example/bundled/manifest.json',
      publicKey: bundledKey.publicKey,
      publicKeySha256: bundledKey.sha256
    }

    expect(
      selectDataUpdateDeployment(
        {
          KOU_DATA_UPDATE_MANIFEST_URL: 'https://updates.example/environment/manifest.json',
          KOU_DATA_UPDATE_PUBLIC_KEY: environmentKey.publicKey
        },
        true,
        bundled
      )
    ).toEqual({
      source: 'environment',
      manifestUrl: 'https://updates.example/environment/manifest.json',
      publicKey: environmentKey.publicKey,
      publicKeySha256: undefined
    })
  })
})

import { createHash, generateKeyPairSync } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function createPublicKeyFixture(): { publicKeyFile: string; fingerprint: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'koubrowser-production-trust-inputs-'))
  const key = generateKeyPairSync('ed25519').publicKey
  const der = key.export({ format: 'der', type: 'spki' })
  const publicKeyFile = path.join(root, 'public-key.txt')
  writeFileSync(publicKeyFile, `${der.toString('base64')}\n`, 'utf8')
  return {
    publicKeyFile,
    fingerprint: createHash('sha256').update(der).digest('hex')
  }
}

function run(argumentsList: string[]): string {
  return execFileSync(
    process.execPath,
    [
      path.resolve(process.cwd(), 'scripts/verify-data-update-production-trust-inputs.js'),
      ...argumentsList
    ],
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
}

describe('data-update production trust input verifier', () => {
  it('verifies the public inputs offline without echoing the URL or key', () => {
    const fixture = createPublicKeyFixture()
    const manifestUrl = 'https://updates.example.invalid/koubrowser/manifest.json'
    const output = run([
      '--manifest-url',
      manifestUrl,
      '--public-key-file',
      fixture.publicKeyFile,
      '--public-key-sha256',
      fixture.fingerprint
    ])

    expect(output).toContain('Status: PASS')
    expect(output).toContain('Algorithm: Ed25519')
    expect(output).toContain(`Public key SHA-256: ${fixture.fingerprint}`)
    expect(output).toContain('Network access: none')
    expect(output).not.toContain(manifestUrl)
    expect(output).not.toContain(readFileSync(fixture.publicKeyFile, 'utf8').trim())
  })

  it('rejects a mismatched fingerprint and unsafe URL forms', () => {
    const fixture = createPublicKeyFixture()
    const baseArguments = [
      '--public-key-file',
      fixture.publicKeyFile,
      '--public-key-sha256',
      fixture.fingerprint
    ]

    expect(() =>
      run([
        '--manifest-url',
        'https://updates.example.invalid/manifest.json',
        ...baseArguments.slice(0, 2),
        '--public-key-sha256',
        '0'.repeat(64)
      ])
    ).toThrow()
    for (const manifestUrl of [
      'http://updates.example.invalid/manifest.json',
      'https://user:password@updates.example.invalid/manifest.json',
      'https://updates.example.invalid/manifest.json?token=secret',
      'https://updates.example.invalid/manifest.json#fragment'
    ]) {
      expect(() => run(['--manifest-url', manifestUrl, ...baseArguments])).toThrow()
    }
  })

  it('contains no network client and rejects unknown arguments', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'scripts/verify-data-update-production-trust-inputs.js'),
      'utf8'
    )
    expect(source).not.toMatch(/\bfetch\s*\(/)
    expect(source).not.toContain("require('node:http')")
    expect(source).not.toContain("require('node:https')")

    const fixture = createPublicKeyFixture()
    expect(() =>
      run([
        '--manifest-url',
        'https://updates.example.invalid/manifest.json',
        '--public-key-file',
        fixture.publicKeyFile,
        '--public-key-sha256',
        fixture.fingerprint,
        '--connect',
        'true'
      ])
    ).toThrow()
  })
})

import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  type DataFetch,
  type DataManifest,
  dataManifestSigningPayload,
  installDataUpdate,
  isMapData,
  loadActiveDataBundle,
  parseDataManifest,
  resolveDataUpdateConfiguration,
  verifyDataManifest
} from '@main/data-update'
import { getActiveQuestKnowledgeUpdate, setActiveDataDirectory } from '@main/data-path'

const temporaryDirectories: string[] = []

afterEach(() => {
  setActiveDataDirectory(null)
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'koubrowser-data-update-'))
  temporaryDirectories.push(directory)
  return directory
}

function createSigningKeys(): {
  publicKey: string
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']
} {
  const keys = generateKeyPairSync('ed25519')
  return {
    publicKey: keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    privateKey: keys.privateKey
  }
}

function createMapData(no: number): Buffer {
  return Buffer.from(
    JSON.stringify({
      spots: [{ no, x: 100, y: 200 }],
      checks: []
    }),
    'utf8'
  )
}

function createPublishedBundle(options: {
  root: string
  label: string
  keys: ReturnType<typeof createSigningKeys>
  dataVersion: string
  publishedAt: string
  mapNo: number
  questKnowledgePath?: string
}): {
  bundleDirectory: string
  publicKeyPath: string
} {
  const sourceDirectory = path.join(options.root, `${options.label}-source`)
  const bundleDirectory = path.join(options.root, `${options.label}-bundle`)
  const privateKeyPath = path.join(options.root, `${options.label}-private-key.pem`)
  const publicKeyPath = path.join(options.root, `${options.label}-public-key.txt`)
  mkdirSync(sourceDirectory)
  writeFileSync(path.join(sourceDirectory, '001_01_map.json'), createMapData(options.mapNo))
  writeFileSync(
    privateKeyPath,
    options.keys.privateKey.export({ format: 'pem', type: 'pkcs8' }),
    'utf8'
  )
  writeFileSync(publicKeyPath, `${options.keys.publicKey}\n`, 'utf8')
  execFileSync(
    process.execPath,
    [
      path.resolve(process.cwd(), 'scripts/create-data-update-bundle.js'),
      '--version',
      options.dataVersion,
      '--published-at',
      options.publishedAt,
      '--private-key',
      privateKeyPath,
      '--source',
      sourceDirectory,
      ...(options.questKnowledgePath ? ['--quest-knowledge', options.questKnowledgePath] : []),
      '--output',
      bundleDirectory
    ],
    { cwd: process.cwd(), stdio: 'pipe' }
  )
  return {
    bundleDirectory,
    publicKeyPath
  }
}

function createManifest(
  dataVersion: string,
  publishedAt: string,
  data: Buffer,
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'],
  dataPath = 'map/001_01_map.json'
): DataManifest {
  const unsigned: DataManifest = {
    schemaVersion: 1,
    dataVersion,
    publishedAt,
    files: [
      {
        path: dataPath,
        sha256: createHash('sha256').update(data).digest('hex'),
        size: data.byteLength
      }
    ],
    signature: 'AA=='
  }
  return {
    ...unsigned,
    signature: sign(
      null,
      Buffer.from(dataManifestSigningPayload(unsigned), 'utf8'),
      privateKey
    ).toString('base64')
  }
}

function createFetch(manifest: DataManifest, data: Buffer): DataFetch {
  return async (input) => {
    if (input === 'https://updates.example/data/manifest.json') {
      return new Response(JSON.stringify(manifest))
    }
    if (input === `https://updates.example/data/${manifest.files[0].path}`) {
      return new Response(data.toString('utf8'))
    }
    return new Response('not found', { status: 404 })
  }
}

describe('data update', () => {
  it('keeps data updates disabled when deployment settings are absent', () => {
    expect(resolveDataUpdateConfiguration(undefined, undefined)).toEqual({
      status: 'disabled'
    })
    expect(resolveDataUpdateConfiguration('  ', '\t')).toEqual({
      status: 'disabled'
    })
  })

  it('rejects partial deployment settings without exposing their values', () => {
    expect(resolveDataUpdateConfiguration(undefined, 'configured-public-key')).toEqual({
      status: 'invalid',
      reason: 'missing-manifest-url'
    })
    expect(
      resolveDataUpdateConfiguration('https://updates.example/data/manifest.json', undefined)
    ).toEqual({
      status: 'invalid',
      reason: 'missing-public-key'
    })
  })

  it('accepts only HTTPS deployment URLs and Ed25519 public keys', () => {
    const keys = createSigningKeys()
    const rsaKeys = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const rsaPublicKey = rsaKeys.publicKey
      .export({ format: 'der', type: 'spki' })
      .toString('base64')

    expect(
      resolveDataUpdateConfiguration('https://updates.example/data/manifest.json', keys.publicKey)
    ).toEqual({
      status: 'enabled',
      manifestUrl: 'https://updates.example/data/manifest.json',
      publicKey: keys.publicKey
    })
    expect(
      resolveDataUpdateConfiguration('http://updates.example/data/manifest.json', keys.publicKey)
    ).toEqual({
      status: 'invalid',
      reason: 'invalid-manifest-url'
    })
    expect(
      resolveDataUpdateConfiguration(
        'https://user:password@updates.example/data/manifest.json',
        keys.publicKey
      )
    ).toEqual({
      status: 'invalid',
      reason: 'invalid-manifest-url'
    })
    expect(
      resolveDataUpdateConfiguration(
        'https://updates.example/data/manifest.json#review',
        keys.publicKey
      )
    ).toEqual({
      status: 'invalid',
      reason: 'invalid-manifest-url'
    })
    expect(
      resolveDataUpdateConfiguration('https://updates.example/data/manifest.json', 'not-base64')
    ).toEqual({
      status: 'invalid',
      reason: 'invalid-public-key'
    })
    expect(
      resolveDataUpdateConfiguration('https://updates.example/data/manifest.json', rsaPublicKey)
    ).toEqual({
      status: 'invalid',
      reason: 'invalid-public-key'
    })

    const publicKeyFingerprint = createHash('sha256')
      .update(Buffer.from(keys.publicKey, 'base64'))
      .digest('hex')
    expect(
      resolveDataUpdateConfiguration(
        'https://updates.example/data/manifest.json',
        keys.publicKey,
        false,
        publicKeyFingerprint
      )
    ).toEqual({
      status: 'enabled',
      manifestUrl: 'https://updates.example/data/manifest.json',
      publicKey: keys.publicKey
    })
    expect(
      resolveDataUpdateConfiguration(
        'https://updates.example/data/manifest.json',
        keys.publicKey,
        false,
        '0'.repeat(64)
      )
    ).toEqual({
      status: 'invalid',
      reason: 'invalid-public-key-fingerprint'
    })
  })

  it('allows an HTTP localhost deployment URL only in development', () => {
    const keys = createSigningKeys()
    const manifestUrl = 'http://127.0.0.1:4173/data/manifest.json'

    expect(resolveDataUpdateConfiguration(manifestUrl, keys.publicKey)).toEqual({
      status: 'invalid',
      reason: 'invalid-manifest-url'
    })
    expect(resolveDataUpdateConfiguration(manifestUrl, keys.publicKey, true)).toEqual({
      status: 'enabled',
      manifestUrl,
      publicKey: keys.publicKey
    })
  })

  it('accepts every bundled map data file', () => {
    const mapDirectory = path.resolve(process.cwd(), 'resources/map')
    const filenames = readdirSync(mapDirectory).filter((filename) => filename.endsWith('.json'))

    expect(filenames.length).toBeGreaterThan(0)
    for (const filename of filenames) {
      const value = JSON.parse(readFileSync(path.join(mapDirectory, filename), 'utf8'))
      expect(isMapData(value), filename).toBe(true)
    }
  })

  it('parses and verifies a signed manifest', () => {
    const keys = createSigningKeys()
    const data = createMapData(1)
    const manifest = createManifest(
      '2026.07.29.1',
      '2026-07-29T00:00:00.000Z',
      data,
      keys.privateKey
    )

    const parsed = parseDataManifest(JSON.stringify(manifest))

    expect(() => verifyDataManifest(parsed, keys.publicKey)).not.toThrow()
  })

  it('rejects unsupported data paths before downloading files', () => {
    const keys = createSigningKeys()
    const data = createMapData(1)
    const manifest = createManifest(
      '2026.07.29.1',
      '2026-07-29T00:00:00.000Z',
      data,
      keys.privateKey
    )
    const invalidManifest = {
      ...manifest,
      files: [{ ...manifest.files[0], path: '../private.json' }]
    }

    expect(() => parseDataManifest(JSON.stringify(invalidManifest))).toThrow(
      'invalid data file path'
    )
  })

  it('rejects a cross-origin manifest redirect', async () => {
    const cacheRoot = createTemporaryDirectory()
    const keys = createSigningKeys()
    let requestCount = 0

    await expect(
      installDataUpdate({
        cacheRoot,
        manifestUrl: 'https://updates.example/data/manifest.json',
        publicKey: keys.publicKey,
        fetch: async () => {
          requestCount += 1
          return {
            ok: true,
            status: 200,
            url: 'https://redirected.example/data/manifest.json',
            body: null,
            arrayBuffer: async () => new ArrayBuffer(0)
          }
        }
      })
    ).rejects.toThrow('data manifest redirected to another origin')
    expect(requestCount).toBe(1)
  })

  it('rejects an invalid public key before making a request', async () => {
    let requestCount = 0

    await expect(
      installDataUpdate({
        cacheRoot: createTemporaryDirectory(),
        manifestUrl: 'https://updates.example/data/manifest.json',
        publicKey: 'not-base64',
        fetch: async () => {
          requestCount += 1
          return new Response('unexpected')
        }
      })
    ).rejects.toThrow('invalid data update public key')
    expect(requestCount).toBe(0)
  })

  it('installs a verified map bundle and loads it on the next start', async () => {
    const cacheRoot = createTemporaryDirectory()
    const keys = createSigningKeys()
    const data = createMapData(7)
    const manifest = createManifest(
      '2026.07.29.1',
      '2026-07-29T00:00:00.000Z',
      data,
      keys.privateKey
    )

    await expect(
      installDataUpdate({
        cacheRoot,
        manifestUrl: 'https://updates.example/data/manifest.json',
        publicKey: keys.publicKey,
        fetch: createFetch(manifest, data)
      })
    ).resolves.toEqual({ status: 'installed', version: '2026.07.29.1' })

    const active = loadActiveDataBundle(cacheRoot, keys.publicKey)
    expect(active?.manifest.dataVersion).toBe('2026.07.29.1')
    expect(
      JSON.parse(readFileSync(path.join(active!.directory, 'map/001_01_map.json'), 'utf8'))
    ).toEqual({
      spots: [{ no: 7, x: 100, y: 200 }],
      checks: []
    })
  })

  it('installs and exposes strictly validated quest knowledge', async () => {
    const cacheRoot = createTemporaryDirectory()
    const keys = createSigningKeys()
    const data = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        claims: [
          {
            source: 'wikiwiki',
            sourceLabel: '日本語攻略Wiki',
            url: 'https://wikiwiki.jp/kancolle/任務/出撃任務',
            lastVerifiedAt: '2026-07-29',
            dataVersion: 'ページ確認 2026-07-29',
            questId: 900001,
            questTitle: '配信テスト任務',
            prerequisites: []
          }
        ]
      }),
      'utf8'
    )
    const manifest = createManifest(
      '2026.07.29.quest',
      '2026-07-29T05:00:00.000Z',
      data,
      keys.privateKey,
      'quest/knowledge.json'
    )

    await installDataUpdate({
      cacheRoot,
      manifestUrl: 'https://updates.example/data/manifest.json',
      publicKey: keys.publicKey,
      fetch: createFetch(manifest, data)
    })
    const active = loadActiveDataBundle(cacheRoot, keys.publicKey)
    expect(active).not.toBeNull()

    setActiveDataDirectory(active!.directory)
    expect(getActiveQuestKnowledgeUpdate()?.claims[0]).toEqual(
      expect.objectContaining({
        questId: 900001,
        questTitle: '配信テスト任務'
      })
    )
  })

  it('rejects malformed quest knowledge before activating the bundle', async () => {
    const cacheRoot = createTemporaryDirectory()
    const keys = createSigningKeys()
    const data = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        claims: [],
        executable: 'alert(1)'
      }),
      'utf8'
    )
    const manifest = createManifest(
      '2026.07.29.invalid-quest',
      '2026-07-29T06:00:00.000Z',
      data,
      keys.privateKey,
      'quest/knowledge.json'
    )

    await expect(
      installDataUpdate({
        cacheRoot,
        manifestUrl: 'https://updates.example/data/manifest.json',
        publicKey: keys.publicKey,
        fetch: createFetch(manifest, data)
      })
    ).rejects.toThrow('unsupported or missing fields')
    expect(loadActiveDataBundle(cacheRoot, keys.publicKey)).toBeNull()
  })

  it('keeps the previous verified bundle when a new file fails validation', async () => {
    const cacheRoot = createTemporaryDirectory()
    const keys = createSigningKeys()
    const firstData = createMapData(1)
    const firstManifest = createManifest(
      '2026.07.29.1',
      '2026-07-29T00:00:00.000Z',
      firstData,
      keys.privateKey
    )
    await installDataUpdate({
      cacheRoot,
      manifestUrl: 'https://updates.example/data/manifest.json',
      publicKey: keys.publicKey,
      fetch: createFetch(firstManifest, firstData)
    })

    const secondData = createMapData(2)
    const secondManifest = createManifest(
      '2026.07.29.2',
      '2026-07-29T01:00:00.000Z',
      secondData,
      keys.privateKey
    )
    const corruptedData = createMapData(999)

    await expect(
      installDataUpdate({
        cacheRoot,
        manifestUrl: 'https://updates.example/data/manifest.json',
        publicKey: keys.publicKey,
        fetch: createFetch(secondManifest, corruptedData)
      })
    ).rejects.toThrow('data file size mismatch')

    expect(loadActiveDataBundle(cacheRoot, keys.publicKey)?.manifest.dataVersion).toBe(
      '2026.07.29.1'
    )
  })

  it('does not roll back to an older signed bundle', async () => {
    const cacheRoot = createTemporaryDirectory()
    const keys = createSigningKeys()
    const currentData = createMapData(2)
    const currentManifest = createManifest(
      '2026.07.29.2',
      '2026-07-29T01:00:00.000Z',
      currentData,
      keys.privateKey
    )
    await installDataUpdate({
      cacheRoot,
      manifestUrl: 'https://updates.example/data/manifest.json',
      publicKey: keys.publicKey,
      fetch: createFetch(currentManifest, currentData)
    })

    const oldData = createMapData(1)
    const oldManifest = createManifest(
      '2026.07.29.1',
      '2026-07-29T00:00:00.000Z',
      oldData,
      keys.privateKey
    )
    await expect(
      installDataUpdate({
        cacheRoot,
        manifestUrl: 'https://updates.example/data/manifest.json',
        publicKey: keys.publicKey,
        fetch: createFetch(oldManifest, oldData)
      })
    ).resolves.toEqual({ status: 'current', version: '2026.07.29.2' })
  })

  it('ignores a cached bundle after local file tampering', async () => {
    const cacheRoot = createTemporaryDirectory()
    const keys = createSigningKeys()
    const data = createMapData(1)
    const manifest = createManifest(
      '2026.07.29.1',
      '2026-07-29T00:00:00.000Z',
      data,
      keys.privateKey
    )
    await installDataUpdate({
      cacheRoot,
      manifestUrl: 'https://updates.example/data/manifest.json',
      publicKey: keys.publicKey,
      fetch: createFetch(manifest, data)
    })
    const active = loadActiveDataBundle(cacheRoot, keys.publicKey)
    expect(active).not.toBeNull()

    const tampered = createMapData(99)
    const filePath = path.join(active!.directory, 'map/001_01_map.json')
    writeFileSync(filePath, tampered)

    expect(loadActiveDataBundle(cacheRoot, keys.publicKey)).toBeNull()
  })

  it('repairs a corrupt directory when the same version is published', async () => {
    const cacheRoot = createTemporaryDirectory()
    const keys = createSigningKeys()
    const data = createMapData(4)
    const manifest = createManifest(
      '2026.07.29.4',
      '2026-07-29T04:00:00.000Z',
      data,
      keys.privateKey
    )
    await installDataUpdate({
      cacheRoot,
      manifestUrl: 'https://updates.example/data/manifest.json',
      publicKey: keys.publicKey,
      fetch: createFetch(manifest, data)
    })
    const active = loadActiveDataBundle(cacheRoot, keys.publicKey)!
    writeFileSync(path.join(active.directory, 'map/001_01_map.json'), createMapData(44))
    expect(loadActiveDataBundle(cacheRoot, keys.publicKey)).toBeNull()

    await expect(
      installDataUpdate({
        cacheRoot,
        manifestUrl: 'https://updates.example/data/manifest.json',
        publicKey: keys.publicKey,
        fetch: createFetch(manifest, data)
      })
    ).resolves.toEqual({ status: 'installed', version: '2026.07.29.4' })
    expect(loadActiveDataBundle(cacheRoot, keys.publicKey)?.manifest.dataVersion).toBe(
      '2026.07.29.4'
    )
  })

  it('creates a compatible signed bundle with the publisher script', () => {
    const root = createTemporaryDirectory()
    const source = path.join(root, 'source')
    const output = path.join(root, 'output')
    const privateKeyPath = path.join(root, 'private-key.pem')
    const questKnowledgePath = path.join(root, 'quest-knowledge.json')
    const keys = createSigningKeys()
    mkdirSync(source)
    writeFileSync(path.join(source, '001_01_map.json'), createMapData(3))
    const questKnowledge = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        claims: [
          {
            source: 'kcwiki',
            sourceLabel: '中文KCWiki',
            url: 'https://zh.kcwiki.cn/wiki/任务分类',
            lastVerifiedAt: '2026-07-29',
            dataVersion: '页面确认 2026-07-29',
            questId: 900002,
            questTitle: '发布测试任务',
            prerequisites: []
          }
        ]
      }),
      'utf8'
    )
    writeFileSync(questKnowledgePath, questKnowledge)
    writeFileSync(privateKeyPath, keys.privateKey.export({ format: 'pem', type: 'pkcs8' }), 'utf8')

    const publisherOutput = execFileSync(
      process.execPath,
      [
        path.resolve(process.cwd(), 'scripts/create-data-update-bundle.js'),
        '--version',
        '2026.07.29.3',
        '--published-at',
        '2026-07-29T03:00:00.000Z',
        '--private-key',
        privateKeyPath,
        '--source',
        source,
        '--quest-knowledge',
        questKnowledgePath,
        '--output',
        output
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    )
    const publicKeyFingerprint = createHash('sha256')
      .update(Buffer.from(keys.publicKey, 'base64'))
      .digest('hex')
    expect(publisherOutput).toContain(`KOU_DATA_UPDATE_PUBLIC_KEY_SHA256=${publicKeyFingerprint}`)

    const manifest = parseDataManifest(readFileSync(path.join(output, 'manifest.json'), 'utf8'))
    expect(() => verifyDataManifest(manifest, keys.publicKey)).not.toThrow()
    expect(readFileSync(path.join(output, 'map/001_01_map.json'))).toEqual(createMapData(3))
    expect(readFileSync(path.join(output, 'quest/knowledge.json'))).toEqual(questKnowledge)

    const auditOutput = execFileSync(
      process.execPath,
      [
        path.resolve(process.cwd(), 'scripts/verify-data-update-bundle.js'),
        '--bundle',
        output,
        '--public-key',
        keys.publicKey
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    )
    expect(auditOutput).toContain('Verified data bundle 2026.07.29.3.')
    expect(auditOutput).toContain('Files: 2')
    expect(auditOutput).toContain('Quest knowledge: included')
    expect(auditOutput).toContain(`Public key SHA-256: ${publicKeyFingerprint}`)

    writeFileSync(path.join(output, 'unlisted-review-note.txt'), 'must not be published')
    expect(() =>
      execFileSync(
        process.execPath,
        [
          path.resolve(process.cwd(), 'scripts/verify-data-update-bundle.js'),
          '--bundle',
          output,
          '--public-key',
          keys.publicKey
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow()
  })

  it('publishes with an encrypted private key without putting its passphrase on the command line', () => {
    const root = createTemporaryDirectory()
    const source = path.join(root, 'source')
    const output = path.join(root, 'output')
    const rejectedOutput = path.join(root, 'rejected-output')
    const invalidPassphraseOutput = path.join(root, 'invalid-passphrase-output')
    const privateKeyPath = path.join(root, 'private-key.pem')
    const publicKeyPath = path.join(root, 'public-key.txt')
    const passphrasePath = path.join(root, 'private-key-passphrase.txt')
    const wrongPassphrasePath = path.join(root, 'wrong-private-key-passphrase.txt')
    const invalidPassphrasePath = path.join(root, 'invalid-private-key-passphrase.txt')
    const passphrase = 'correct horse battery staple'
    mkdirSync(source)
    writeFileSync(path.join(source, '001_01_map.json'), createMapData(8))
    writeFileSync(passphrasePath, `${passphrase}\r\n`, 'utf8')
    writeFileSync(wrongPassphrasePath, 'incorrect passphrase\n', 'utf8')
    writeFileSync(invalidPassphrasePath, 'first line\nsecond line\n', 'utf8')

    const keyGenerator = path.resolve(process.cwd(), 'scripts/generate-data-update-key.js')
    const keyGeneratorArguments = [
      keyGenerator,
      '--private-key-output',
      privateKeyPath,
      '--public-key-output',
      publicKeyPath,
      '--private-key-passphrase-file',
      passphrasePath
    ]
    const keyGeneratorOutput = execFileSync(process.execPath, keyGeneratorArguments, {
      cwd: process.cwd(),
      encoding: 'utf8'
    })
    expect(keyGeneratorOutput).toContain('Created encrypted Ed25519 data update signing key.')
    expect(keyGeneratorOutput).not.toContain(passphrase)
    expect(readFileSync(privateKeyPath, 'utf8')).toContain('BEGIN ENCRYPTED PRIVATE KEY')
    expect(readFileSync(privateKeyPath, 'utf8')).not.toContain(passphrase)
    const publicKey = readFileSync(publicKeyPath, 'utf8').trim()
    const privateKeySha256 = createHash('sha256').update(readFileSync(privateKeyPath)).digest('hex')
    const publicKeySha256 = createHash('sha256').update(readFileSync(publicKeyPath)).digest('hex')

    expect(() =>
      execFileSync(process.execPath, keyGeneratorArguments, {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    ).toThrow('private key output already exists')
    expect(createHash('sha256').update(readFileSync(privateKeyPath)).digest('hex')).toBe(
      privateKeySha256
    )
    expect(createHash('sha256').update(readFileSync(publicKeyPath)).digest('hex')).toBe(
      publicKeySha256
    )

    const publisher = path.resolve(process.cwd(), 'scripts/create-data-update-bundle.js')
    const publisherOutput = execFileSync(
      process.execPath,
      [
        publisher,
        '--version',
        '2026.07.30.encrypted-key',
        '--published-at',
        '2026-07-30T06:00:00.000Z',
        '--private-key',
        privateKeyPath,
        '--private-key-passphrase-file',
        passphrasePath,
        '--source',
        source,
        '--output',
        output
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    )

    expect(publisherOutput).toContain('Created data bundle 2026.07.30.encrypted-key')
    expect(publisherOutput).not.toContain(passphrase)
    const manifest = parseDataManifest(readFileSync(path.join(output, 'manifest.json'), 'utf8'))
    expect(() => verifyDataManifest(manifest, publicKey)).not.toThrow()

    expect(() =>
      execFileSync(
        process.execPath,
        [
          publisher,
          '--version',
          '2026.07.30.wrong-passphrase',
          '--private-key',
          privateKeyPath,
          '--private-key-passphrase-file',
          wrongPassphrasePath,
          '--source',
          source,
          '--output',
          rejectedOutput
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('private key could not be read; encrypted PEM requires --private-key-passphrase-file')
    expect(existsSync(rejectedOutput)).toBe(false)

    expect(() =>
      execFileSync(
        process.execPath,
        [
          publisher,
          '--version',
          '2026.07.30.invalid-passphrase-file',
          '--private-key',
          privateKeyPath,
          '--private-key-passphrase-file',
          invalidPassphrasePath,
          '--source',
          source,
          '--output',
          invalidPassphraseOutput
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('private key passphrase file must contain one non-empty line')
    expect(existsSync(invalidPassphraseOutput)).toBe(false)
  })

  it('publishes the checked-in independently reviewed quest candidate', () => {
    const root = createTemporaryDirectory()
    const keys = createSigningKeys()
    const candidatePath = path.resolve(
      process.cwd(),
      'docs/data-update-candidates/quest-knowledge-reviewed-v1.json'
    )
    const bundle = createPublishedBundle({
      root,
      label: 'reviewed-candidate',
      keys,
      dataVersion: '2026.07.30.reviewed-candidate',
      publishedAt: '2026-07-30T04:00:00.000Z',
      mapNo: 1,
      questKnowledgePath: candidatePath
    })

    const output = execFileSync(
      process.execPath,
      [
        path.resolve(process.cwd(), 'scripts/verify-data-update-bundle.js'),
        '--bundle',
        bundle.bundleDirectory,
        '--public-key-file',
        bundle.publicKeyPath
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    )
    expect(output).toContain('Verified data bundle 2026.07.30.reviewed-candidate.')
    expect(output).toContain('Quest knowledge: included')
  })

  it('binds a release record to the reviewed candidate, key, URL, and signed bundle', () => {
    const root = createTemporaryDirectory()
    const keys = createSigningKeys()
    const candidatePath = path.resolve(
      process.cwd(),
      'docs/data-update-candidates/quest-knowledge-reviewed-v1.json'
    )
    const bundle = createPublishedBundle({
      root,
      label: 'release-record',
      keys,
      dataVersion: '2026.07.30.release-record',
      publishedAt: '2026-07-30T05:00:00.000Z',
      mapNo: 1,
      questKnowledgePath: candidatePath
    })
    const recordPath = path.join(root, 'release-record.json')
    const command = path.resolve(process.cwd(), 'scripts/create-data-update-release-record.js')
    const verifyCommand = path.resolve(
      process.cwd(),
      'scripts/verify-data-update-release-record.js'
    )
    const commonArguments = [
      command,
      '--bundle',
      bundle.bundleDirectory,
      '--public-key-file',
      bundle.publicKeyPath,
      '--manifest-url',
      'https://updates.example/data/manifest.json',
      '--quest-candidate',
      candidatePath
    ]

    const output = execFileSync(process.execPath, [...commonArguments, '--output', recordPath], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })
    const record = JSON.parse(readFileSync(recordPath, 'utf8'))
    const publicKeyFingerprint = createHash('sha256')
      .update(Buffer.from(keys.publicKey, 'base64'))
      .digest('hex')
    const questCandidateSha256 = createHash('sha256')
      .update(readFileSync(candidatePath))
      .digest('hex')

    expect(output).toContain('Created release review record for 2026.07.30.release-record.')
    expect(record).toMatchObject({
      schemaVersion: 1,
      dataVersion: '2026.07.30.release-record',
      publishedAt: '2026-07-30T05:00:00.000Z',
      manifestUrl: 'https://updates.example/data/manifest.json',
      publicKeySha256: publicKeyFingerprint,
      fileCount: 2,
      mapFileCount: 1,
      questKnowledge: {
        sha256: questCandidateSha256,
        size: readFileSync(candidatePath).byteLength,
        claimCount: 258
      }
    })
    expect(record.manifestSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(record)).not.toContain(root)
    expect(JSON.stringify(record)).not.toContain(keys.publicKey)

    const verificationOutput = execFileSync(
      process.execPath,
      [verifyCommand, ...commonArguments.slice(1), '--record', recordPath],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    )
    expect(verificationOutput).toContain(
      'Verified release review record for 2026.07.30.release-record.'
    )
    expect(verificationOutput).toContain(`Public key SHA-256: ${publicKeyFingerprint}`)
    expect(verificationOutput).not.toContain(root)
    expect(verificationOutput).not.toContain(keys.publicKey)
    expect(verificationOutput).not.toContain('https://updates.example')

    const tamperedRecordPath = path.join(root, 'tampered-release-record.json')
    writeFileSync(
      tamperedRecordPath,
      `${JSON.stringify(
        {
          ...record,
          questKnowledge: {
            ...record.questKnowledge,
            claimCount: record.questKnowledge.claimCount + 1
          }
        },
        null,
        2
      )}\n`,
      'utf8'
    )
    expect(() =>
      execFileSync(
        process.execPath,
        [verifyCommand, ...commonArguments.slice(1), '--record', tamperedRecordPath],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('release review record does not match the supplied release evidence')

    const differentUrlArguments = [...commonArguments.slice(1)]
    differentUrlArguments[
      differentUrlArguments.indexOf('https://updates.example/data/manifest.json')
    ] = 'https://updates.example/data/other-manifest.json'
    expect(() =>
      execFileSync(
        process.execPath,
        [verifyCommand, ...differentUrlArguments, '--record', recordPath],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('release review record does not match the supplied release evidence')

    const unsupportedRecordPath = path.join(root, 'unsupported-release-record.json')
    writeFileSync(
      unsupportedRecordPath,
      `${JSON.stringify({ ...record, reviewer: 'must not be stored' }, null, 2)}\n`,
      'utf8'
    )
    expect(() =>
      execFileSync(
        process.execPath,
        [verifyCommand, ...commonArguments.slice(1), '--record', unsupportedRecordPath],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('release review record has unsupported fields')

    const tamperedCandidatePath = path.join(root, 'tampered-candidate.json')
    writeFileSync(
      tamperedCandidatePath,
      Buffer.concat([readFileSync(candidatePath), Buffer.from(' ')]),
      'utf8'
    )
    const rejectedRecordPath = path.join(root, 'rejected-record.json')
    expect(() =>
      execFileSync(
        process.execPath,
        [...commonArguments.slice(0, -1), tamperedCandidatePath, '--output', rejectedRecordPath],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('release bundle quest knowledge does not match the reviewed candidate')
    expect(existsSync(rejectedRecordPath)).toBe(false)

    const invalidUrlArguments = [...commonArguments]
    invalidUrlArguments[invalidUrlArguments.indexOf('https://updates.example/data/manifest.json')] =
      'https://user:password@updates.example/data/manifest.json#private'
    const invalidUrlRecordPath = path.join(root, 'invalid-url-record.json')
    expect(() =>
      execFileSync(process.execPath, [...invalidUrlArguments, '--output', invalidUrlRecordPath], {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    ).toThrow('release manifest URL must use HTTPS without credentials or a fragment')
    expect(existsSync(invalidUrlRecordPath)).toBe(false)
  })

  it('rejects unknown and duplicate release arguments before writing output', () => {
    const root = createTemporaryDirectory()
    const output = path.join(root, 'output')
    const publisher = path.resolve(process.cwd(), 'scripts/create-data-update-bundle.js')
    const keyGenerator = path.resolve(process.cwd(), 'scripts/generate-data-update-key.js')
    const verifier = path.resolve(process.cwd(), 'scripts/verify-data-update-bundle.js')
    const rotationVerifier = path.resolve(
      process.cwd(),
      'scripts/verify-data-update-key-rotation.js'
    )
    const releaseRecordCreator = path.resolve(
      process.cwd(),
      'scripts/create-data-update-release-record.js'
    )
    const releaseRecordVerifier = path.resolve(
      process.cwd(),
      'scripts/verify-data-update-release-record.js'
    )

    expect(() =>
      execFileSync(
        process.execPath,
        [
          publisher,
          '--version',
          '2026.07.30.strict',
          '--private-key',
          path.join(root, 'missing-private-key.pem'),
          '--output',
          output,
          '--quest-knwoledge',
          path.join(root, 'missing-knowledge.json')
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('unsupported argument: --quest-knwoledge')
    expect(existsSync(output)).toBe(false)

    expect(() =>
      execFileSync(
        process.execPath,
        [
          publisher,
          '--version',
          '2026.07.30.strict',
          '--private-key',
          path.join(root, 'missing-private-key.pem'),
          '--private-key-passphrase',
          'must-never-be-accepted',
          '--output',
          output
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('unsupported argument: --private-key-passphrase')
    expect(existsSync(output)).toBe(false)

    expect(() =>
      execFileSync(
        process.execPath,
        [
          keyGenerator,
          '--private-key-output',
          path.join(root, 'private-key.pem'),
          '--public-key-output',
          path.join(root, 'public-key.txt'),
          '--private-key-passphrase',
          'must-never-be-accepted'
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('unsupported argument: --private-key-passphrase')
    expect(existsSync(path.join(root, 'private-key.pem'))).toBe(false)
    expect(existsSync(path.join(root, 'public-key.txt'))).toBe(false)

    expect(() =>
      execFileSync(
        process.execPath,
        [
          publisher,
          '--version',
          '2026.07.30.strict',
          '--version',
          '2026.07.30.overridden',
          '--private-key',
          path.join(root, 'missing-private-key.pem'),
          '--output',
          output
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('duplicate argument: --version')
    expect(existsSync(output)).toBe(false)

    expect(() =>
      execFileSync(
        process.execPath,
        [
          verifier,
          '--bundle',
          path.join(root, 'missing-bundle'),
          '--public-key',
          'first',
          '--public-key',
          'second'
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('duplicate argument: --public-key')

    expect(() =>
      execFileSync(
        process.execPath,
        [rotationVerifier, '--new-public-key', path.join(root, 'missing-public-key.txt')],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('unsupported argument: --new-public-key')

    expect(() =>
      execFileSync(
        process.execPath,
        [releaseRecordCreator, '--reviewer', 'not-a-supported-field'],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('unsupported argument: --reviewer')

    expect(() =>
      execFileSync(
        process.execPath,
        [releaseRecordVerifier, '--reviewer', 'not-a-supported-field'],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('unsupported argument: --reviewer')
  })

  it('inspects an Ed25519 public key without bundle or private key access', () => {
    const root = createTemporaryDirectory()
    const publicKeyPath = path.join(root, 'public-key.txt')
    const keys = createSigningKeys()
    const publicKeyFingerprint = createHash('sha256')
      .update(Buffer.from(keys.publicKey, 'base64'))
      .digest('hex')
    writeFileSync(publicKeyPath, `${keys.publicKey}\n`, 'utf8')

    const output = execFileSync(
      process.execPath,
      [
        path.resolve(process.cwd(), 'scripts/inspect-data-update-public-key.js'),
        '--public-key-file',
        publicKeyPath
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    )

    expect(output).toContain('Algorithm: Ed25519')
    expect(output).toContain(`KOU_DATA_UPDATE_PUBLIC_KEY=${keys.publicKey}`)
    expect(output).toContain(`KOU_DATA_UPDATE_PUBLIC_KEY_SHA256=${publicKeyFingerprint}`)
  })

  it('verifies an offline data update key rotation', () => {
    const root = createTemporaryDirectory()
    const oldKeys = createSigningKeys()
    const newKeys = createSigningKeys()
    const oldBundle = createPublishedBundle({
      root,
      label: 'old',
      keys: oldKeys,
      dataVersion: '2026.07.30.old',
      publishedAt: '2026-07-30T01:00:00.000Z',
      mapNo: 1
    })
    const newBundle = createPublishedBundle({
      root,
      label: 'new',
      keys: newKeys,
      dataVersion: '2026.07.30.new',
      publishedAt: '2026-07-30T02:00:00.000Z',
      mapNo: 2
    })
    const oldFingerprint = createHash('sha256')
      .update(Buffer.from(oldKeys.publicKey, 'base64'))
      .digest('hex')
    const newFingerprint = createHash('sha256')
      .update(Buffer.from(newKeys.publicKey, 'base64'))
      .digest('hex')

    const output = execFileSync(
      process.execPath,
      [
        path.resolve(process.cwd(), 'scripts/verify-data-update-key-rotation.js'),
        '--old-bundle',
        oldBundle.bundleDirectory,
        '--old-public-key-file',
        oldBundle.publicKeyPath,
        '--new-bundle',
        newBundle.bundleDirectory,
        '--new-public-key-file',
        newBundle.publicKeyPath
      ],
      { cwd: process.cwd(), encoding: 'utf8' }
    )

    expect(output).toContain('Verified data update key rotation.')
    expect(output).toContain('Old data version: 2026.07.30.old')
    expect(output).toContain(`Old public key SHA-256: ${oldFingerprint}`)
    expect(output).toContain('New data version: 2026.07.30.new')
    expect(output).toContain(`New public key SHA-256: ${newFingerprint}`)
  })

  it('rejects a key rotation without distinct keys or forward publication time', () => {
    const root = createTemporaryDirectory()
    const sharedKeys = createSigningKeys()
    const oldBundle = createPublishedBundle({
      root,
      label: 'old',
      keys: sharedKeys,
      dataVersion: '2026.07.30.old',
      publishedAt: '2026-07-30T02:00:00.000Z',
      mapNo: 1
    })
    const sameKeyBundle = createPublishedBundle({
      root,
      label: 'same-key',
      keys: sharedKeys,
      dataVersion: '2026.07.30.same-key',
      publishedAt: '2026-07-30T03:00:00.000Z',
      mapNo: 2
    })
    const verifier = path.resolve(process.cwd(), 'scripts/verify-data-update-key-rotation.js')

    expect(() =>
      execFileSync(
        process.execPath,
        [
          verifier,
          '--old-bundle',
          oldBundle.bundleDirectory,
          '--old-public-key-file',
          oldBundle.publicKeyPath,
          '--new-bundle',
          sameKeyBundle.bundleDirectory,
          '--new-public-key-file',
          sameKeyBundle.publicKeyPath
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('old and new public keys must differ')

    const newKeys = createSigningKeys()
    const olderNewBundle = createPublishedBundle({
      root,
      label: 'older-new',
      keys: newKeys,
      dataVersion: '2026.07.30.older-new',
      publishedAt: '2026-07-30T01:00:00.000Z',
      mapNo: 3
    })
    expect(() =>
      execFileSync(
        process.execPath,
        [
          verifier,
          '--old-bundle',
          oldBundle.bundleDirectory,
          '--old-public-key-file',
          oldBundle.publicKeyPath,
          '--new-bundle',
          olderNewBundle.bundleDirectory,
          '--new-public-key-file',
          olderNewBundle.publicKeyPath
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow('new bundle published-at must be later than old bundle')
  })

  it('refuses to publish quest knowledge that the client would reject', () => {
    const root = createTemporaryDirectory()
    const source = path.join(root, 'source')
    const output = path.join(root, 'output')
    const privateKeyPath = path.join(root, 'private-key.pem')
    const questKnowledgePath = path.join(root, 'invalid-quest-knowledge.json')
    const keys = createSigningKeys()
    mkdirSync(source)
    writeFileSync(path.join(source, '001_01_map.json'), createMapData(3))
    writeFileSync(privateKeyPath, keys.privateKey.export({ format: 'pem', type: 'pkcs8' }), 'utf8')
    writeFileSync(
      questKnowledgePath,
      JSON.stringify({
        schemaVersion: 1,
        claims: [
          {
            source: 'wikiwiki',
            sourceLabel: '日本語攻略Wiki',
            url: 'https://example.com/unreviewed',
            lastVerifiedAt: '2026-07-29',
            dataVersion: 'ページ確認 2026-07-29',
            questId: 900003,
            questTitle: '不正な配信テスト任務',
            prerequisites: []
          }
        ]
      }),
      'utf8'
    )

    expect(() =>
      execFileSync(
        process.execPath,
        [
          path.resolve(process.cwd(), 'scripts/create-data-update-bundle.js'),
          '--version',
          '2026.07.29.invalid-publish',
          '--private-key',
          privateKeyPath,
          '--source',
          source,
          '--quest-knowledge',
          questKnowledgePath,
          '--output',
          output
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow()
    expect(existsSync(path.join(output, 'manifest.json'))).toBe(false)
  })

  it('refuses to publish map data that the client would reject', () => {
    const root = createTemporaryDirectory()
    const source = path.join(root, 'source')
    const output = path.join(root, 'output')
    const privateKeyPath = path.join(root, 'private-key.pem')
    const keys = createSigningKeys()
    mkdirSync(source)
    writeFileSync(
      path.join(source, '001_01_map.json'),
      JSON.stringify({
        spots: [{ no: 1, x: 'not-a-number', y: 200 }]
      }),
      'utf8'
    )
    writeFileSync(privateKeyPath, keys.privateKey.export({ format: 'pem', type: 'pkcs8' }), 'utf8')

    expect(() =>
      execFileSync(
        process.execPath,
        [
          path.resolve(process.cwd(), 'scripts/create-data-update-bundle.js'),
          '--version',
          '2026.07.30.invalid-map',
          '--private-key',
          privateKeyPath,
          '--source',
          source,
          '--output',
          output
        ],
        { cwd: process.cwd(), stdio: 'pipe' }
      )
    ).toThrow()
    expect(existsSync(path.join(output, 'manifest.json'))).toBe(false)
  })
})

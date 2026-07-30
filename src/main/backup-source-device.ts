import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const SchemaVersion = 1
const IdentityFilename = 'backup-source-device.json'
const MaxIdentityBytes = 1024
const UuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface BackupSourceDeviceIdentity {
  readonly schemaVersion: 1
  readonly deviceId: string
}

const identityPromises = new Map<string, Promise<string>>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseBackupSourceDeviceIdentity(text: string): string {
  if (Buffer.byteLength(text, 'utf8') > MaxIdentityBytes) {
    throw new Error('backup source device identity is too large')
  }

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('backup source device identity is not valid JSON')
  }
  if (!isRecord(value)) {
    throw new Error('backup source device identity must be an object')
  }
  const keys = Object.keys(value).sort()
  if (
    keys.length !== 2 ||
    keys[0] !== 'deviceId' ||
    keys[1] !== 'schemaVersion'
  ) {
    throw new Error('backup source device identity has unsupported fields')
  }
  if (
    value.schemaVersion !== SchemaVersion ||
    typeof value.deviceId !== 'string' ||
    !UuidPattern.test(value.deviceId)
  ) {
    throw new Error('invalid backup source device identity')
  }
  return value.deviceId
}

async function requireRealDirectory(directory: string): Promise<string> {
  const stats = await fs.promises.lstat(directory)
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error('application data root must be a real directory')
  }
  return fs.promises.realpath(directory)
}

async function readIdentity(identityPath: string): Promise<string> {
  const stats = await fs.promises.lstat(identityPath)
  if (
    stats.isSymbolicLink() ||
    !stats.isFile() ||
    stats.size > MaxIdentityBytes
  ) {
    throw new Error('backup source device identity must be a regular file')
  }
  return parseBackupSourceDeviceIdentity(
    await fs.promises.readFile(identityPath, 'utf8')
  )
}

async function writeTemporaryIdentity(
  temporaryPath: string,
  identity: BackupSourceDeviceIdentity
): Promise<void> {
  const handle = await fs.promises.open(temporaryPath, 'wx', 0o600)
  try {
    await handle.writeFile(JSON.stringify(identity), 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function loadOrCreate(realRoot: string): Promise<string> {
  const identityPath = path.join(realRoot, IdentityFilename)
  try {
    return await readIdentity(identityPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  const deviceId = randomUUID()
  const temporaryPath = path.join(
    realRoot,
    `.${IdentityFilename}.${randomUUID()}.tmp`
  )
  try {
    await writeTemporaryIdentity(temporaryPath, {
      schemaVersion: SchemaVersion,
      deviceId
    })
    try {
      // A hard link publishes the fully flushed temporary file only when the
      // final name does not exist. A concurrent process can never be replaced.
      await fs.promises.link(temporaryPath, identityPath)
      return deviceId
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
      return await readIdentity(identityPath)
    }
  } finally {
    await fs.promises.rm(temporaryPath, { force: true })
  }
}

/**
 * Return the stable, non-secret UUID used only to identify bundles produced by
 * this application data directory.
 */
export async function loadOrCreateBackupSourceDeviceId(
  appDataRoot: string
): Promise<string> {
  const realRoot = await requireRealDirectory(appDataRoot)
  let identityPromise = identityPromises.get(realRoot)
  if (!identityPromise) {
    identityPromise = loadOrCreate(realRoot)
    identityPromises.set(realRoot, identityPromise)
    void identityPromise.catch(() => {
      if (identityPromises.get(realRoot) === identityPromise) {
        identityPromises.delete(realRoot)
      }
    })
  }
  return identityPromise
}

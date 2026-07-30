import os from 'node:os'
import path from 'node:path'

export const LayoutFixtureEnvironmentVariable = 'KOUBROWSER_LAYOUT_FIXTURE'
export const LayoutFixtureUserDataEnvironmentVariable = 'KOUBROWSER_LAYOUT_FIXTURE_USER_DATA'
export const PseudoLocaleEnvironmentVariable = 'KOUBROWSER_PSEUDO_LOCALE'
export const AccountRestoreFixtureEnvironmentVariable = 'KOUBROWSER_ACCOUNT_RESTORE_FIXTURE'
export const DataUpdateDownloadFixtureEnvironmentVariable =
  'KOUBROWSER_DATA_UPDATE_DOWNLOAD_FIXTURE'
export const DataUpdateConfigurationOverrideEnvironmentVariable =
  'KOUBROWSER_DATA_UPDATE_CONFIG_OVERRIDE'

export function isLayoutFixtureEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment[LayoutFixtureEnvironmentVariable] === '1'
}

export function isPseudoLocaleFixtureEnabled(
  environment: NodeJS.ProcessEnv = process.env
): boolean {
  return isLayoutFixtureEnabled(environment) && environment[PseudoLocaleEnvironmentVariable] === '1'
}

export function isAccountRestoreFixtureEnabled(
  environment: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    isLayoutFixtureEnabled(environment) &&
    environment[AccountRestoreFixtureEnvironmentVariable] === '1'
  )
}

export function isDataUpdateDownloadFixtureEnabled(
  environment: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    isLayoutFixtureEnabled(environment) &&
    environment.KOUBROWSER_SMOKE_IPC === '1' &&
    environment[DataUpdateDownloadFixtureEnvironmentVariable] === '1'
  )
}

export function isDataUpdateConfigurationOverrideEnabled(
  environment: NodeJS.ProcessEnv = process.env,
  hasIpcChannel: boolean = typeof process.send === 'function'
): boolean {
  return (
    isLayoutFixtureEnabled(environment) &&
    environment.KOUBROWSER_SMOKE_IPC === '1' &&
    Boolean(environment.KOUBROWSER_SMOKE_IPC_TOKEN) &&
    hasIpcChannel &&
    environment[DataUpdateConfigurationOverrideEnvironmentVariable] === '1'
  )
}

export function layoutFixtureUserDataPath(
  environment: NodeJS.ProcessEnv = process.env,
  temporaryDirectory: string = os.tmpdir()
): string | null {
  const value = environment[LayoutFixtureUserDataEnvironmentVariable]
  if (!isLayoutFixtureEnabled(environment) || !value) {
    return null
  }

  const resolved = path.resolve(value)
  const expectedParent = path.resolve(temporaryDirectory)
  if (
    path.dirname(resolved) !== expectedParent ||
    !path.basename(resolved).startsWith('koubrowser-layout-smoke-')
  ) {
    throw new Error('invalid layout fixture user-data directory')
  }
  return resolved
}

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AssistPanelDiagnosticReport } from '@common/assist-diagnostic'
import { saveAssistPanelDiagnosticReport } from '@main/assist-diagnostic'
import { isTrustedAssistDiagnosticRequest } from '@main/assist-diagnostic-request'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true }))
  )
})

describe('assist diagnostic main-process boundary', () => {
  it('allows only main frames belonging to the main or assist renderer', () => {
    expect(isTrustedAssistDiagnosticRequest(10, true, [10, 20])).toBe(true)
    expect(isTrustedAssistDiagnosticRequest(20, true, [10, 20])).toBe(true)
    expect(isTrustedAssistDiagnosticRequest(30, true, [10, 20])).toBe(false)
    expect(isTrustedAssistDiagnosticRequest(10, false, [10, 20])).toBe(false)
    expect(isTrustedAssistDiagnosticRequest(20, true, [10, undefined])).toBe(false)
  })

  it('saves a new JSON report without overwriting existing evidence', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'koubrowser-assist-diagnostic-'))
    temporaryDirectories.push(directory)
    const filePath = path.join(directory, 'diagnostic.json')
    const report: AssistPanelDiagnosticReport = {
      schemaVersion: 1,
      kind: 'koubrowser-assist-panel-diagnostic',
      generatedAt: '2026-07-30T12:01:02.345Z',
      occurredAt: '2026-07-30T12:00:00.000Z',
      build: {
        appVersion: '1.0.5'
      },
      environment: {
        platform: 'win32',
        operatingSystemRelease: '10.0.26100',
        architecture: 'x64'
      },
      panel: {
        name: 'missioncheck',
        phase: 'setup function'
      },
      error: {
        name: 'TypeError',
        message: 'expedition calculation failed',
        stack: '[APP]/out/renderer/index.js:100:20'
      },
      privacy: {
        rawAccountState: 'not-collected',
        rawGameApiPayloads: 'not-collected',
        localPaths: 'redacted',
        urls: 'redacted',
        credentials: 'redacted'
      }
    }

    await saveAssistPanelDiagnosticReport(filePath, report)
    expect(JSON.parse(await fs.readFile(filePath, 'utf8'))).toEqual(report)
    await expect(saveAssistPanelDiagnosticReport(filePath, report)).rejects.toMatchObject({
      code: 'EEXIST'
    })
  })
})

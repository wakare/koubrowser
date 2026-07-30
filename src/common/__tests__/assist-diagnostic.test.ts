import { describe, expect, it } from 'vitest'
import {
  assistPanelDiagnosticFilename,
  createAssistPanelDiagnosticReport
} from '@common/assist-diagnostic'

describe('assist panel diagnostic report', () => {
  it('keeps actionable app locations while excluding account data and local identities', () => {
    const report = createAssistPanelDiagnosticReport(
      {
        schemaVersion: 1,
        occurredAt: '2026-07-30T12:00:00.000Z',
        panelName: 'missioncheck',
        phase: 'setup function',
        error: {
          name: 'TypeError',
          message:
            'failed at C:\\Users\\Alice\\private.json while rendering; "api_member_id": "12345" https://example.invalid alice@example.com',
          stack: [
            'TypeError: expedition calculation failed',
            '    at calculate (D:\\Work\\KanColle\\src\\renderer\\src\\components\\MissionCheck.vue:42:10)',
            '    at file:///C:/Users/Alice/AppData/Local/app/out/renderer/index.js:100:20'
          ].join('\n')
        }
      },
      {
        generatedAt: new Date('2026-07-30T12:01:02.345Z'),
        appVersion: '1.0.5',
        platform: 'win32',
        operatingSystemRelease: '10.0.26100',
        architecture: 'x64'
      }
    )

    expect(report).toMatchObject({
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
      privacy: {
        rawAccountState: 'not-collected',
        rawGameApiPayloads: 'not-collected',
        localPaths: 'redacted',
        urls: 'redacted',
        credentials: 'redacted'
      }
    })
    const serialized = JSON.stringify(report)
    expect(serialized).not.toContain('Alice')
    expect(serialized).not.toContain('12345')
    expect(serialized).not.toContain('example.invalid')
    expect(serialized).not.toContain('alice@example.com')
    expect(report.error.message).toContain('while rendering')
    expect(report.error.stack).toContain('[APP]/src/renderer/src/components/MissionCheck.vue:42:10')
    expect(report.error.stack).toContain('[APP]/out/renderer/index.js:100:20')
  })

  it('rejects unknown panels, extra fields, and malformed timestamps', () => {
    const options = {
      generatedAt: new Date('2026-07-30T12:01:02.345Z'),
      appVersion: '1.0.5',
      platform: 'win32',
      operatingSystemRelease: '10.0.26100',
      architecture: 'x64'
    }
    const input = {
      schemaVersion: 1,
      occurredAt: '2026-07-30T12:00:00.000Z',
      panelName: 'missioncheck',
      phase: 'setup function',
      error: {
        name: 'Error',
        message: 'failed',
        stack: null
      }
    }

    expect(() =>
      createAssistPanelDiagnosticReport({ ...input, panelName: 'game-webview' }, options)
    ).toThrow('Invalid assist diagnostic input')
    expect(() =>
      createAssistPanelDiagnosticReport({ ...input, accountId: 'must not be accepted' }, options)
    ).toThrow('Invalid assist diagnostic input')
    expect(() =>
      createAssistPanelDiagnosticReport({ ...input, occurredAt: 'today' }, options)
    ).toThrow('Invalid assist diagnostic input')
  })

  it('creates a timestamped filename without local identity', () => {
    expect(assistPanelDiagnosticFilename(new Date('2026-07-30T12:01:02.345Z'))).toBe(
      'koubrowser-assist-diagnostic-20260730T120102Z.json'
    )
  })
})

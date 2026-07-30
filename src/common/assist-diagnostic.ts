export const AssistDiagnosticPanelNames = [
  'deckport',
  'missioncheck',
  'battletab',
  'shipitems',
  'dropbymap',
  'dropbyship',
  'dockquestlist',
  'questguide',
  'chart',
  'about'
] as const

export type AssistDiagnosticPanelName = (typeof AssistDiagnosticPanelNames)[number]

export interface AssistPanelDiagnosticInput {
  readonly schemaVersion: 1
  readonly occurredAt: string
  readonly panelName: AssistDiagnosticPanelName
  readonly phase: string
  readonly error: {
    readonly name: string
    readonly message: string
    readonly stack: string | null
  }
}

export interface AssistPanelDiagnosticReport {
  readonly schemaVersion: 1
  readonly kind: 'koubrowser-assist-panel-diagnostic'
  readonly generatedAt: string
  readonly occurredAt: string
  readonly build: {
    readonly appVersion: string
  }
  readonly environment: {
    readonly platform: string
    readonly operatingSystemRelease: string
    readonly architecture: string
  }
  readonly panel: {
    readonly name: AssistDiagnosticPanelName
    readonly phase: string
  }
  readonly error: {
    readonly name: string
    readonly message: string
    readonly stack: string | null
  }
  readonly privacy: {
    readonly rawAccountState: 'not-collected'
    readonly rawGameApiPayloads: 'not-collected'
    readonly localPaths: 'redacted'
    readonly urls: 'redacted'
    readonly credentials: 'redacted'
  }
}

export type AssistPanelDiagnosticSaveResult =
  | { readonly status: 'cancelled' }
  | { readonly status: 'saved'; readonly fileName: string }

export interface AssistPanelDiagnosticReportOptions {
  readonly generatedAt: Date
  readonly appVersion: string
  readonly platform: string
  readonly operatingSystemRelease: string
  readonly architecture: string
}

const PanelNameSet = new Set<string>(AssistDiagnosticPanelNames)
const IsoTimestampMaxLength = 32
const PhaseMaxLength = 160
const ErrorNameMaxLength = 80
const ErrorMessageInputMaxLength = 8192
const ErrorStackInputMaxLength = 65536
const ErrorMessageReportMaxLength = 2000
const ErrorStackReportMaxLength = 12000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= IsoTimestampMaxLength &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  )
}

function requireBoundedString(
  value: unknown,
  description: string,
  maxLength: number,
  allowEmpty = false
): string {
  if (
    typeof value !== 'string' ||
    value.length > maxLength ||
    (!allowEmpty && value.trim().length === 0)
  ) {
    throw new Error(`Invalid assist diagnostic ${description}`)
  }
  return value
}

function parseAssistPanelDiagnosticInput(value: unknown): AssistPanelDiagnosticInput {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['schemaVersion', 'occurredAt', 'panelName', 'phase', 'error']) ||
    value.schemaVersion !== 1 ||
    !isIsoTimestamp(value.occurredAt) ||
    typeof value.panelName !== 'string' ||
    !PanelNameSet.has(value.panelName) ||
    !isRecord(value.error) ||
    !hasExactKeys(value.error, ['name', 'message', 'stack'])
  ) {
    throw new Error('Invalid assist diagnostic input')
  }

  const stack =
    value.error.stack === null
      ? null
      : requireBoundedString(value.error.stack, 'error stack', ErrorStackInputMaxLength, true)
  return {
    schemaVersion: 1,
    occurredAt: value.occurredAt,
    panelName: value.panelName as AssistDiagnosticPanelName,
    phase: requireBoundedString(value.phase, 'phase', PhaseMaxLength),
    error: {
      name: requireBoundedString(value.error.name, 'error name', ErrorNameMaxLength),
      message: requireBoundedString(
        value.error.message,
        'error message',
        ErrorMessageInputMaxLength,
        true
      ),
      stack
    }
  }
}

function appRelativePath(value: string): string {
  const normalized = value.replace(/^file:\/\/\/?/i, '').replace(/\\/g, '/')
  for (const marker of ['/src/', '/out/', '/app.asar/']) {
    const index = normalized.toLowerCase().indexOf(marker)
    if (index >= 0) {
      const suffix =
        marker === '/app.asar/'
          ? normalized.slice(index + '/app.asar'.length)
          : normalized.slice(index)
      return `[APP]${suffix}`
    }
  }
  const fileLocation = normalized.match(/\/([^/:]+:\d+:\d+)$/)
  return fileLocation ? `[LOCAL_PATH]/${fileLocation[1]}` : '[LOCAL_PATH]'
}

function redactDiagnosticText(value: string, maxLength: number): string {
  const withoutControls = value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  const redacted = withoutControls
    .replace(/file:\/\/\/[^\s)\]"']+/gi, (match) => appRelativePath(match))
    .replace(/[A-Za-z]:\\[^\r\n)"']*?:\d+:\d+/g, (match) => appRelativePath(match))
    .replace(/[A-Za-z]:\\Users\\[^\\\r\n]+/gi, '[LOCAL_HOME]')
    .replace(/[A-Za-z]:\\[^\s)"']+/g, (match) => appRelativePath(match))
    .replace(/\/(?:Users|home)\/[^\s/]+\/[^\r\n)"']*?:\d+:\d+/g, (match) => appRelativePath(match))
    .replace(/\/(?:Users|home)\/[^/\r\n]+/g, '[LOCAL_HOME]')
    .replace(/\/(?:Users|home)\/[^\s/]+\/[^\s)"']+/g, (match) => appRelativePath(match))
    .replace(/\\\\[^\\\s]+\\[^\s)"']+/g, '[LOCAL_PATH]')
    .replace(/\bhttps?:\/\/[^\s)\]"']+/gi, '[URL]')
    .replace(
      /["']?\bapi_[A-Za-z0-9_]+["']?\s*[:=]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,\s}\]]+)/gi,
      '[GAME_API_FIELD_REDACTED]'
    )
    .replace(
      /\b(?:api[_-]?token|authorization|cookie|memberId|api_member_id|serverId|password|passphrase)\b\s*[:=]\s*[^\s,;}\]]+/gi,
      '[CREDENTIAL_REDACTED]'
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL_REDACTED]')
    .trim()

  return redacted.length > maxLength ? `${redacted.slice(0, maxLength - 3)}...` : redacted
}

export function createAssistPanelDiagnosticReport(
  value: unknown,
  options: AssistPanelDiagnosticReportOptions
): AssistPanelDiagnosticReport {
  const input = parseAssistPanelDiagnosticInput(value)
  return {
    schemaVersion: 1,
    kind: 'koubrowser-assist-panel-diagnostic',
    generatedAt: options.generatedAt.toISOString(),
    occurredAt: input.occurredAt,
    build: {
      appVersion: options.appVersion
    },
    environment: {
      platform: options.platform,
      operatingSystemRelease: options.operatingSystemRelease,
      architecture: options.architecture
    },
    panel: {
      name: input.panelName,
      phase: redactDiagnosticText(input.phase, PhaseMaxLength)
    },
    error: {
      name: redactDiagnosticText(input.error.name, ErrorNameMaxLength),
      message: redactDiagnosticText(input.error.message, ErrorMessageReportMaxLength),
      stack:
        input.error.stack === null
          ? null
          : redactDiagnosticText(input.error.stack, ErrorStackReportMaxLength)
    },
    privacy: {
      rawAccountState: 'not-collected',
      rawGameApiPayloads: 'not-collected',
      localPaths: 'redacted',
      urls: 'redacted',
      credentials: 'redacted'
    }
  }
}

export function assistPanelDiagnosticFilename(generatedAt: Date): string {
  return `koubrowser-assist-diagnostic-${generatedAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')}.json`
}

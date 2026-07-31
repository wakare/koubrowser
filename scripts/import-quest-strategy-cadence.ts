import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Window } from 'happy-dom'

type Cadence = 'daily' | 'weekly' | 'monthly' | 'quarterly'

interface CatalogEntry {
  questId: number
  cadence: Cadence
  sourceCode: string
  matchMethod: 'normalized-title' | 'reviewed-override'
}

interface CadenceCatalog {
  schemaVersion: 1
  version: string
  scope: 'daily-weekly-monthly-quarterly-sortie-quests'
  complete: boolean
  source: {
    sourceId: 'wikiwiki-periodic-sortie'
    url: string
    retrievedOn: string
    contentDigest: string
  }
  entries: CatalogEntry[]
}

const SourceUrl = 'https://wikiwiki.jp/kancolle/任務/出撃定期'
const OutputPath = path.join('knowledge', 'quest-strategy', 'cadence-catalog.json')
const ReviewedOverrides = new Map<string, number>([['Bm2', 256]])

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function normalizeTitle(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\s/gu, '')
    .replace(/["「」『』]/gu, '')
}

function cadenceOf(sourceCode: string): Cadence | undefined {
  if (/^Bd\d+$/.test(sourceCode)) return 'daily'
  if (/^Bw\d+$/.test(sourceCode)) return 'weekly'
  if (/^Bm\d+$/.test(sourceCode)) return 'monthly'
  if (/^Bq\d+$/.test(sourceCode)) return 'quarterly'
  return undefined
}

function localTitles(source: string): Map<string, number[]> {
  const titles = new Map<string, number[]>()
  for (const match of source.matchAll(/^\/\/\s*(\d+):\s*(.+?)\s*$/gmu)) {
    const title = normalizeTitle(match[2])
    const ids = titles.get(title) ?? []
    ids.push(Number(match[1]))
    titles.set(title, ids)
  }
  return titles
}

function parseWikiRows(html: string): { sourceCode: string; title: string; cadence: Cadence }[] {
  const window = new Window()
  window.document.body.innerHTML = html
  const rows: { sourceCode: string; title: string; cadence: Cadence }[] = []
  for (const row of window.document.querySelectorAll('tr')) {
    const cells = row.querySelectorAll('td')
    if (cells.length < 2) continue
    const sourceCode = cells[0].textContent.trim()
    const cadence = cadenceOf(sourceCode)
    if (!cadence) continue
    rows.push({
      sourceCode,
      title: cells[1].textContent.trim(),
      cadence
    })
  }
  window.close()
  return rows
}

function buildCatalog(html: string, questSource: string, retrievedOn: string): CadenceCatalog {
  const titleIndex = localTitles(questSource)
  const entries: CatalogEntry[] = []
  const failures: string[] = []
  const seenCodes = new Set<string>()
  for (const row of parseWikiRows(html)) {
    if (seenCodes.has(row.sourceCode)) {
      failures.push(`${row.sourceCode}: duplicate Wiki row`)
      continue
    }
    seenCodes.add(row.sourceCode)
    const override = ReviewedOverrides.get(row.sourceCode)
    const matches = titleIndex.get(normalizeTitle(row.title)) ?? []
    if (override !== undefined) {
      if (!matches.includes(override)) {
        failures.push(`${row.sourceCode}: reviewed override no longer matches local title`)
        continue
      }
      entries.push({
        questId: override,
        cadence: row.cadence,
        sourceCode: row.sourceCode,
        matchMethod: 'reviewed-override'
      })
      continue
    }
    if (matches.length !== 1) {
      failures.push(`${row.sourceCode}: expected one local title match, found ${matches.length}`)
      continue
    }
    entries.push({
      questId: matches[0],
      cadence: row.cadence,
      sourceCode: row.sourceCode,
      matchMethod: 'normalized-title'
    })
  }
  if (entries.length === 0) {
    failures.push('Wiki page contains no supported periodic sortie rows')
  }
  if (new Set(entries.map((entry) => entry.questId)).size !== entries.length) {
    failures.push('multiple Wiki rows matched the same quest ID')
  }
  if (failures.length > 0) {
    throw new Error(`cadence catalog is incomplete:\n${failures.join('\n')}`)
  }
  entries.sort((left, right) => left.questId - right.questId)
  return {
    schemaVersion: 1,
    version: `${retrievedOn}.1`,
    scope: 'daily-weekly-monthly-quarterly-sortie-quests',
    complete: true,
    source: {
      sourceId: 'wikiwiki-periodic-sortie',
      url: SourceUrl,
      retrievedOn,
      contentDigest: sha256(html)
    },
    entries
  }
}

function validateCatalog(catalog: CadenceCatalog, questSource: string): void {
  if (
    catalog.schemaVersion !== 1 ||
    catalog.scope !== 'daily-weekly-monthly-quarterly-sortie-quests' ||
    catalog.complete !== true
  ) {
    throw new Error('cadence catalog header is invalid or incomplete')
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(catalog.source.contentDigest)) {
    throw new Error('cadence catalog source digest is invalid')
  }
  const registeredIds = new Set(
    [...questSource.matchAll(/^\/\/\s*(\d+):\s*(.+?)\s*$/gmu)].map((match) => Number(match[1]))
  )
  const ids = new Set<number>()
  const sourceCodes = new Set<string>()
  for (const entry of catalog.entries) {
    if (
      !registeredIds.has(entry.questId) ||
      cadenceOf(entry.sourceCode) !== entry.cadence ||
      ids.has(entry.questId) ||
      sourceCodes.has(entry.sourceCode)
    ) {
      throw new Error(`invalid cadence catalog entry: ${JSON.stringify(entry)}`)
    }
    ids.add(entry.questId)
    sourceCodes.add(entry.sourceCode)
  }
}

async function main(): Promise<void> {
  const root = process.cwd()
  const outputPath = path.join(root, OutputPath)
  const questSource = fs.readFileSync(path.join(root, 'src', 'common', 'kcquest.ts'), 'utf8')
  if (process.argv.includes('--check')) {
    const catalog = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as CadenceCatalog
    validateCatalog(catalog, questSource)
    console.log(`Quest strategy cadence catalog verified: ${catalog.entries.length} entries`)
    return
  }
  const retrievedOn =
    process.argv.find((argument) => argument.startsWith('--retrieved-on='))?.split('=')[1] ??
    new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(retrievedOn)) {
    throw new Error('invalid --retrieved-on value')
  }
  const response = await fetch(SourceUrl)
  if (!response.ok) {
    throw new Error(`Wiki fetch failed: HTTP ${response.status}`)
  }
  const html = await response.text()
  const catalog = buildCatalog(html, questSource, retrievedOn)
  validateCatalog(catalog, questSource)
  fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(`Quest strategy cadence catalog generated: ${catalog.entries.length} entries`)
}

void main()

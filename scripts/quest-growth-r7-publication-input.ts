import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import {
  validateQuestKnowledgeUpdate,
  type QuestKnowledgeUpdate
} from '../src/common/quest_knowledge_update'

const require = createRequire(import.meta.url)
const {
  validatePublicationCandidateFiles
} = require('./quest-growth-r7-publication-candidate.js') as {
  validatePublicationCandidateFiles: (root: string) => {
    candidate: {
      value: Record<string, unknown>
      canonicalDigest: string
      routeCount: number
    }
    review: { approved: boolean }
  }
}

export const BaseQuestKnowledgePath =
  'docs/data-update-candidates/quest-knowledge-reviewed-v1.json'
export const BaseQuestKnowledgeDigest =
  'a916ab1be73f27deb3411587916faf96d7510b513ae4f16d60e721032d0ffb04'
export const CandidateCanonicalDigest =
  'sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c'

export interface R7PublicationInputResult {
  readonly value: QuestKnowledgeUpdate
  readonly serialized: string
  readonly sha256: string
  readonly claimCount: number
  readonly routeCount: number
  readonly candidateCanonicalDigest: string
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function parseArguments(argv: readonly string[]): Map<string, string> {
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    const value = argv[index + 1]
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(`invalid argument near ${name ?? '(end)'}`)
    }
    const normalizedName = name.slice(2)
    if (values.has(normalizedName)) {
      throw new Error(`duplicate argument: --${normalizedName}`)
    }
    values.set(normalizedName, value)
  }
  return values
}

export function buildR7PublicationInput(
  root: string = process.cwd()
): R7PublicationInputResult {
  const baseData = fs.readFileSync(
    path.join(root, ...BaseQuestKnowledgePath.split('/'))
  )
  if (sha256(baseData) !== BaseQuestKnowledgeDigest) {
    throw new Error('reviewed quest knowledge candidate digest mismatch')
  }
  const base = JSON.parse(baseData.toString('utf8')) as Record<string, unknown>
  if (
    Object.keys(base).join(',') !== 'schemaVersion,claims' ||
    base.schemaVersion !== 1 ||
    !Array.isArray(base.claims) ||
    base.claims.length === 0
  ) {
    throw new Error('reviewed quest knowledge candidate contract mismatch')
  }

  const publication = validatePublicationCandidateFiles(root)
  if (
    publication.candidate.canonicalDigest !== CandidateCanonicalDigest ||
    publication.candidate.routeCount !== 2 ||
    publication.review.approved !== true
  ) {
    throw new Error('R7 publication candidate is not independently approved')
  }

  const value = validateQuestKnowledgeUpdate({
    schemaVersion: base.schemaVersion,
    claims: base.claims,
    growthRoutes: publication.candidate.value
  })
  const serialized = `${JSON.stringify(value, null, 2)}\n`
  return {
    value,
    serialized,
    sha256: sha256(serialized),
    claimCount: base.claims.length,
    routeCount: publication.candidate.routeCount,
    candidateCanonicalDigest: publication.candidate.canonicalDigest
  }
}

export function materializeR7PublicationInput(
  argv: readonly string[],
  root: string = process.cwd()
): R7PublicationInputResult {
  const argumentsMap = parseArguments(argv)
  for (const name of argumentsMap.keys()) {
    if (name !== 'output') throw new Error(`unsupported argument: --${name}`)
  }
  const outputValue = argumentsMap.get('output')
  if (!outputValue) throw new Error('--output is required')
  const outputPath = path.resolve(outputValue)
  if (fs.existsSync(outputPath)) throw new Error('output path already exists')

  const result = buildR7PublicationInput(root)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, result.serialized, { encoding: 'utf8', flag: 'wx' })
  console.log('Created unsigned R7 quest growth publication input.')
  console.log(`Claims: ${result.claimCount}`)
  console.log(`Reviewed routes: ${result.routeCount}`)
  console.log(`Candidate canonical digest: ${result.candidateCanonicalDigest}`)
  console.log(`Publication input SHA-256: ${result.sha256}`)
  return result
}

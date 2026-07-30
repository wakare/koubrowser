import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildReviewedQuestKnowledgeCandidate } from '../src/common/quest_knowledge_export'

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

function exportReviewedQuestKnowledge(argv: readonly string[]): void {
  const argumentsMap = parseArguments(argv)
  for (const name of argumentsMap.keys()) {
    if (name !== 'output') {
      throw new Error(`unsupported argument: --${name}`)
    }
  }
  const outputValue = argumentsMap.get('output')
  if (!outputValue) {
    throw new Error('--output is required')
  }
  const outputPath = path.resolve(outputValue)
  if (existsSync(outputPath)) {
    throw new Error('output path already exists')
  }

  const report = buildReviewedQuestKnowledgeCandidate()
  const serializedCandidate = `${JSON.stringify(report.candidate, null, 2)}\n`
  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, serializedCandidate, 'utf8')

  console.log(`Exported ${report.includedQuestCount} independently reviewed quests.`)
  console.log(`Claims: ${report.includedClaimCount}`)
  console.log(
    `Candidate SHA-256: ${createHash('sha256').update(serializedCandidate).digest('hex')}`
  )
  console.log(`Excluded unresolved review: ${report.excludedQuestCounts.unresolvedReview}`)
  console.log(
    `Excluded without two independent sources: ${report.excludedQuestCounts.missingIndependentSource}`
  )
  console.log(`Excluded source disagreement: ${report.excludedQuestCounts.sourceDisagreement}`)
}

try {
  exportReviewedQuestKnowledge(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildR7PublicationInput,
  materializeR7PublicationInput
} from '../../../scripts/quest-growth-r7-publication-input'
import { validateQuestKnowledgeUpdate } from '../quest_knowledge_update'

const Root = process.cwd()
const CheckedInPath = path.join(
  Root,
  'docs',
  'data-update-candidates',
  'quest-knowledge-r7-reviewed-v1.json'
)
const temporaryDirectories: string[] = []

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'koubrowser-r7-input-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop()!, { recursive: true, force: true })
  }
})

describe('R7 quest growth publication input', () => {
  it('combines the fixed reviewed claims and two approved routes', () => {
    const result = buildR7PublicationInput(Root)

    expect(result.claimCount).toBe(258)
    expect(result.routeCount).toBe(2)
    expect(result.candidateCanonicalDigest).toBe(
      'sha256:6f1c952ba5030a46e6cf437d740991e5a5eb99cae337cab6db2d1fcf77636a8c'
    )
    expect(result.sha256).toBe(
      '0b0226c9bfc983b6f0da81684e14ff484ef383596fad0ac92b2302783dd49d14'
    )
    const growthRoutes = result.value.growthRoutes
    expect(growthRoutes).toBeDefined()
    expect(growthRoutes!.routes).toHaveLength(2)
    expect(growthRoutes!.routes.every((route) => route.status === 'reviewed')).toBe(true)
  })

  it('reproduces the checked-in unsigned publication input byte for byte', () => {
    const result = buildR7PublicationInput(Root)

    expect(fs.readFileSync(CheckedInPath, 'utf8')).toBe(result.serialized)
  })

  it('passes the same strict quest knowledge validator used by the publisher', () => {
    const result = buildR7PublicationInput(Root)

    expect(() => validateQuestKnowledgeUpdate(JSON.parse(result.serialized))).not.toThrow()
  })

  it('writes once and refuses to overwrite an existing output', () => {
    const output = path.join(temporaryDirectory(), 'publication-input.json')
    const result = materializeR7PublicationInput(['--output', output], Root)

    expect(fs.readFileSync(output, 'utf8')).toBe(result.serialized)
    expect(() =>
      materializeR7PublicationInput(['--output', output], Root)
    ).toThrow('output path already exists')
  })

  it('rejects unknown and duplicate CLI arguments before writing output', () => {
    const directory = temporaryDirectory()
    const unknownOutput = path.join(directory, 'unknown.json')
    const duplicateOutput = path.join(directory, 'duplicate.json')

    expect(() =>
      materializeR7PublicationInput(
        ['--output', unknownOutput, '--private-key', 'not-allowed'],
        Root
      )
    ).toThrow('unsupported argument: --private-key')
    expect(() =>
      materializeR7PublicationInput(
        ['--output', duplicateOutput, '--output', duplicateOutput],
        Root
      )
    ).toThrow('duplicate argument: --output')
    expect(fs.existsSync(unknownOutput)).toBe(false)
    expect(fs.existsSync(duplicateOutput)).toBe(false)
  })
})

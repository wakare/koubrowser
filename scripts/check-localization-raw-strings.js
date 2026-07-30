const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { parse } = require('@vue/compiler-sfc')
const { baseParse, NodeTypes } = require('@vue/compiler-dom')

const JapanesePattern = /[ぁ-んァ-ヶ一-龠々〆〤]/u
const RepositoryRoot = path.resolve(__dirname, '..')
const RendererRoot = path.join(RepositoryRoot, 'src', 'renderer', 'src')
const AllowlistPath = path.join(
  __dirname,
  'localization-raw-string-allowlist.json'
)

function normalizeFile(file) {
  return path.relative(RepositoryRoot, file).replaceAll(path.sep, '/')
}

function normalizeValue(value) {
  return value.trim().replace(/\s+/gu, ' ')
}

function findingId(finding) {
  return `${finding.file}\u0000${finding.kind}\u0000${finding.value}`
}

function collectFiles(directory, extension, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      collectFiles(file, extension, files)
    } else if (entry.isFile() && file.endsWith(extension)) {
      files.push(file)
    }
  }
  return files
}

function addFinding(findings, file, kind, value) {
  const normalized = normalizeValue(value)
  if (!JapanesePattern.test(normalized)) {
    return
  }
  findings.push({
    file: normalizeFile(file),
    kind,
    value: normalized
  })
}

function collectScriptFindings(file, source, findings) {
  const script = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      addFinding(findings, file, 'script', node.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(script)
}

function collectTemplateFindings(file, source, findings) {
  const descriptor = parse(source, { filename: file }).descriptor
  if (descriptor.script) {
    collectScriptFindings(file, descriptor.script.content, findings)
  }
  if (descriptor.scriptSetup) {
    collectScriptFindings(file, descriptor.scriptSetup.content, findings)
  }
  if (!descriptor.template) {
    return
  }

  const template = baseParse(descriptor.template.content, {
    onError: () => {
      // Vue's production compiler accepts the repository's legacy template
      // structure. The recovery AST still exposes all text and attributes.
    }
  })
  const visit = (node) => {
    if (node.type === NodeTypes.TEXT) {
      addFinding(findings, file, 'text', node.content)
    } else if (node.type === NodeTypes.INTERPOLATION) {
      addFinding(findings, file, 'interpolation', node.content.content)
    } else if (node.type === NodeTypes.ELEMENT) {
      for (const property of node.props) {
        if (property.type === NodeTypes.ATTRIBUTE && property.value) {
          addFinding(
            findings,
            file,
            `attribute:${property.name}`,
            property.value.content
          )
        } else if (property.type === NodeTypes.DIRECTIVE && property.exp) {
          addFinding(
            findings,
            file,
            `expression:${property.name}`,
            property.exp.content
          )
        }
      }
    }

    if (node.children) {
      node.children.forEach(visit)
    }
    if (node.type === NodeTypes.IF) {
      node.branches.forEach(visit)
    }
  }
  visit(template)
}

function collectMainFindings(findings) {
  const file = path.join(RepositoryRoot, 'src', 'main', 'kcbrowser.ts')
  collectScriptFindings(file, fs.readFileSync(file, 'utf8'), findings)
}

function countById(items) {
  const counts = new Map()
  for (const item of items) {
    const id = findingId(item)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

function validateAllowlist(findings, allowlist) {
  const findingCounts = countById(findings)
  const allowedCounts = new Map()
  const errors = []

  for (const entry of allowlist) {
    if (
      typeof entry.file !== 'string' ||
      typeof entry.kind !== 'string' ||
      typeof entry.value !== 'string' ||
      typeof entry.reason !== 'string' ||
      entry.reason.trim().length === 0
    ) {
      errors.push(`Invalid allowlist entry: ${JSON.stringify(entry)}`)
      continue
    }
    const normalizedEntry = {
      file: entry.file.replaceAll('\\', '/'),
      kind: entry.kind,
      value: normalizeValue(entry.value)
    }
    const id = findingId(normalizedEntry)
    const count = entry.occurrences ?? 1
    if (!Number.isInteger(count) || count < 1) {
      errors.push(`Invalid occurrence count for ${entry.file}: ${entry.value}`)
      continue
    }
    if (allowedCounts.has(id)) {
      errors.push(`Duplicate allowlist entry: ${entry.file}: ${entry.value}`)
      continue
    }
    allowedCounts.set(id, count)
  }

  for (const finding of findings) {
    const id = findingId(finding)
    if (!allowedCounts.has(id)) {
      errors.push(
        `Unallowlisted raw string: ${finding.file} [${finding.kind}] ${finding.value}`
      )
    }
  }

  for (const [id, allowedCount] of allowedCounts) {
    const actualCount = findingCounts.get(id) ?? 0
    if (actualCount !== allowedCount) {
      const [file, kind, value] = id.split('\u0000')
      errors.push(
        `Stale/count-mismatched allowlist entry: ${file} [${kind}] ` +
          `${value}; expected=${allowedCount} actual=${actualCount}`
      )
    }
  }
  return errors
}

function run() {
  const findings = []
  for (const file of collectFiles(RendererRoot, '.vue')) {
    collectTemplateFindings(file, fs.readFileSync(file, 'utf8'), findings)
  }
  collectMainFindings(findings)

  const allowlist = JSON.parse(fs.readFileSync(AllowlistPath, 'utf8'))
  const errors = validateAllowlist(findings, allowlist)
  if (errors.length > 0) {
    console.error(errors.join('\n'))
    process.exitCode = 1
    return
  }
  console.log(
    `Localization raw-string audit passed: ${findings.length} ` +
      'explicit game-owned/fixture occurrences allowlisted.'
  )
}

if (require.main === module) {
  run()
}

module.exports = {
  collectTemplateFindings,
  validateAllowlist
}

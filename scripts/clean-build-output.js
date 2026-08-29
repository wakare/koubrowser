const fs = require('node:fs')
const path = require('node:path')

const repositoryRoot = path.resolve(__dirname, '..')
const outputDirectoryNames = ['dist', 'out']

let failed = false

for (const name of outputDirectoryNames) {
  const target = path.resolve(repositoryRoot, name)

  if (path.dirname(target) !== repositoryRoot || path.basename(target) !== name) {
    throw new Error(`Refusing to clean unexpected path: ${target}`)
  }

  if (!fs.existsSync(target)) {
    continue
  }

  try {
    fs.rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 250
    })
    console.log(`Removed ${name}/`)
  } catch (error) {
    failed = true
    const code = error && typeof error === 'object' ? error.code : undefined

    if (code === 'EBUSY' || code === 'EPERM') {
      console.error(
        `Could not remove ${name}/ because it is in use. Close any KouBrowser instance launched from dist/ and retry.`
      )
    } else {
      console.error(`Could not remove ${name}/:`, error)
    }
  }
}

if (failed) {
  process.exitCode = 1
}

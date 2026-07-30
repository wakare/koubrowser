const { spawn } = require('node:child_process')

const scripts = process.argv.slice(2)
if (scripts.length === 0) {
  console.error('Usage: node scripts/run-npm-scripts-parallel.js <script> [...]')
  process.exitCode = 1
  return
}

const npmExecPath = process.env.npm_execpath
const npmCommand = npmExecPath ? process.execPath : 'npm'
const children = new Set()

const runScript = (script) =>
  new Promise((resolve) => {
    const args = npmExecPath
      ? [npmExecPath, 'run', script]
      : ['run', script]
    const child = spawn(npmCommand, args, {
      stdio: 'inherit',
      shell: !npmExecPath && process.platform === 'win32'
    })
    children.add(child)

    child.once('error', (error) => {
      children.delete(child)
      console.error(`Failed to start npm script "${script}":`, error)
      resolve(false)
    })
    child.once('exit', (code, signal) => {
      children.delete(child)
      if (signal) {
        console.error(`npm script "${script}" stopped by ${signal}`)
      }
      resolve(code === 0)
    })
  })

const terminateChildren = () => {
  for (const child of children) {
    child.kill()
  }
}

process.once('SIGINT', terminateChildren)
process.once('SIGTERM', terminateChildren)

Promise.all(scripts.map(runScript))
  .then((results) => {
    if (results.some((result) => !result)) {
      process.exitCode = 1
    }
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })

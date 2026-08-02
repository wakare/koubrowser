import { materializeR7PublicationInput } from './quest-growth-r7-publication-input'

try {
  materializeR7PublicationInput(process.argv.slice(2), process.cwd())
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

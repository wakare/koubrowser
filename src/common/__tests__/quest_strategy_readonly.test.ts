import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const StrategyImplementationFiles = [
  'src/common/quest_strategy.ts',
  'src/common/quest_strategy_v2.ts',
  'src/common/quest_strategy_knowledge.ts',
  'src/renderer/src/common/quest-strategy-view.ts',
  'src/renderer/src/store/quest_strategy.ts',
  'src/renderer/src/components/QuestStrategyRoute.vue'
]

function source(filename: string): string {
  return readFileSync(resolve(process.cwd(), filename), 'utf8')
}

describe('quest strategy read-only boundary', () => {
  it.each(StrategyImplementationFiles)(
    'does not add a game communication or renderer IPC path in %s',
    (filename) => {
      const content = source(filename)
      expect(content).not.toMatch(/from ['"]@(?:main|preload)\//)
      expect(content).not.toMatch(
        /\b(?:fetch|XMLHttpRequest|ipcRenderer|webRequest|postMessage)\b|<webview|\bsession\./
      )
    }
  )

  it('keeps the route component limited to reviewed external evidence links', () => {
    const content = source('src/renderer/src/components/QuestStrategyRoute.vue')
    expect(content).toContain('window.api.openExternalUrl(url)')
    expect(content).not.toMatch(
      /\b(?:api_data|api_token|api_port|api_member_id|admiralName|shipInstanceId)\b/
    )
  })
})

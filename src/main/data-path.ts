import fs from 'node:fs'
import path from 'node:path'
import { AppStuff } from '@main/app'
import {
  parseQuestKnowledgeUpdate,
  type QuestKnowledgeUpdate
} from '@common/quest_knowledge_update'

let activeDataDirectory: string | null = null
let activeQuestKnowledgeUpdate: QuestKnowledgeUpdate | null = null

export function setActiveDataDirectory(directory: string | null): void {
  activeDataDirectory = directory
  activeQuestKnowledgeUpdate = null
  if (directory) {
    const questKnowledgePath = path.join(directory, 'quest', 'knowledge.json')
    if (fs.existsSync(questKnowledgePath)) {
      try {
        activeQuestKnowledgeUpdate = parseQuestKnowledgeUpdate(
          fs.readFileSync(questKnowledgePath, 'utf8')
        )
      } catch {
        // The verified map data remains usable; quest guidance uses its bundled fallback.
      }
    }
  }
}

export function getActiveDataDirectory(): string | null {
  return activeDataDirectory
}

export function getActiveQuestKnowledgeUpdate(): QuestKnowledgeUpdate | null {
  return activeQuestKnowledgeUpdate
}

export function resolveDataResourcePath(relativePath: string): string {
  if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
    throw new Error('invalid data resource path')
  }
  if (activeDataDirectory) {
    const externalPath = path.join(activeDataDirectory, relativePath)
    if (fs.existsSync(externalPath)) {
      return externalPath
    }
  }
  return AppStuff.resolveResourcePath(relativePath)
}

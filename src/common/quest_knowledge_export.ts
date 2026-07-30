import {
  CuratedQuestClaims,
  type QuestCuratedClaim,
  type QuestCuratedPrerequisiteGroup
} from '@common/quest_knowledge'
import {
  validateQuestKnowledgeUpdate,
  type QuestKnowledgeUpdate
} from '@common/quest_knowledge_update'

export interface QuestKnowledgeExportReport {
  readonly candidate: QuestKnowledgeUpdate
  readonly includedQuestCount: number
  readonly includedClaimCount: number
  readonly excludedQuestCounts: {
    readonly unresolvedReview: number
    readonly missingIndependentSource: number
    readonly sourceDisagreement: number
  }
}

function reviewStatus(claim: QuestCuratedClaim): string {
  if (claim.prerequisitesComplete === false) {
    return 'incomplete'
  }
  return claim.reviewStatus ?? 'verified'
}

function prerequisiteSignature(prerequisites: readonly QuestCuratedPrerequisiteGroup[]): string {
  return prerequisites
    .map(
      (group) =>
        `${group.mode}:${group.quests
          .map((quest) => `${quest.questId}:${quest.title}`)
          .sort()
          .join(',')}`
    )
    .sort()
    .join('|')
}

export function buildReviewedQuestKnowledgeCandidate(
  claims: readonly QuestCuratedClaim[] = CuratedQuestClaims
): QuestKnowledgeExportReport {
  const claimsByQuest = new Map<number, QuestCuratedClaim[]>()
  for (const claim of claims) {
    const entries = claimsByQuest.get(claim.questId) ?? []
    entries.push(claim)
    claimsByQuest.set(claim.questId, entries)
  }

  const includedClaims: QuestCuratedClaim[] = []
  let unresolvedReview = 0
  let missingIndependentSource = 0
  let sourceDisagreement = 0

  for (const [, questClaims] of [...claimsByQuest].sort(([left], [right]) => left - right)) {
    if (questClaims.some((claim) => reviewStatus(claim) !== 'verified')) {
      unresolvedReview += 1
      continue
    }

    const sources = new Set(questClaims.map((claim) => claim.source))
    if (
      questClaims.length !== 2 ||
      sources.size !== 2 ||
      !sources.has('wikiwiki') ||
      !sources.has('kcwiki')
    ) {
      missingIndependentSource += 1
      continue
    }

    const titles = new Set(questClaims.map((claim) => claim.questTitle))
    const prerequisiteSignatures = new Set(
      questClaims.map((claim) => prerequisiteSignature(claim.prerequisites))
    )
    if (titles.size !== 1 || prerequisiteSignatures.size !== 1) {
      sourceDisagreement += 1
      continue
    }

    includedClaims.push(
      ...[...questClaims].sort((left, right) => left.source.localeCompare(right.source))
    )
  }

  const candidate = validateQuestKnowledgeUpdate({
    schemaVersion: 1,
    claims: includedClaims
  })
  return {
    candidate,
    includedQuestCount: new Set(includedClaims.map((claim) => claim.questId)).size,
    includedClaimCount: includedClaims.length,
    excludedQuestCounts: {
      unresolvedReview,
      missingIndependentSource,
      sourceDisagreement
    }
  }
}

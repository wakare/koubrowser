import type { QuestGuideLimitedEvidence } from '@common/quest_guide'

interface ReviewedQuestLimitedEvidence extends QuestGuideLimitedEvidence {
  questId: number
}

/**
 * Reviewed limited-time evidence that is safe to use for automatic urgency.
 *
 * Add an exact `endsAt` only when an official announcement states an
 * unambiguous timestamp. Relative wording such as "next maintenance" may
 * confirm that a quest is limited, but must stay without `endsAt`.
 */
const reviewedQuestLimitedEvidence: readonly ReviewedQuestLimitedEvidence[] = []

const evidenceById = new Map<number, QuestGuideLimitedEvidence[]>()
for (const { questId, ...evidence } of reviewedQuestLimitedEvidence) {
  const entries = evidenceById.get(questId) ?? []
  entries.push(evidence)
  evidenceById.set(questId, entries)
}

export const questGuideReviewedLimitedEvidenceById: ReadonlyMap<
  number,
  readonly QuestGuideLimitedEvidence[]
> = evidenceById

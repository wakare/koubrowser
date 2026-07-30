import type { RecordingTarget } from '@common/option'

export type RecordingMediaSource = 'desktop' | 'tab'

export interface RecordingSource {
  readonly target: RecordingTarget
  readonly mediaSource: RecordingMediaSource
  readonly id: string
  readonly width: number
  readonly height: number
}

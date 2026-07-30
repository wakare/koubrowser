import type { RecordingSource } from '@common/recording'

interface ChromiumCaptureConstraint {
  readonly mandatory: {
    readonly chromeMediaSource: RecordingSource['mediaSource']
    readonly chromeMediaSourceId: string
    readonly minWidth?: number
    readonly maxWidth?: number
    readonly minHeight?: number
    readonly maxHeight?: number
  }
}

export function recordingMediaConstraints(
  source: RecordingSource
): MediaStreamConstraints {
  const audio: ChromiumCaptureConstraint = {
    mandatory: {
      chromeMediaSource: source.mediaSource,
      chromeMediaSourceId: source.id
    }
  }
  const video: ChromiumCaptureConstraint = {
    mandatory: {
      chromeMediaSource: source.mediaSource,
      chromeMediaSourceId: source.id,
      minWidth: source.width,
      maxWidth: source.width,
      minHeight: source.height,
      maxHeight: source.height
    }
  }
  return { audio, video } as MediaStreamConstraints
}

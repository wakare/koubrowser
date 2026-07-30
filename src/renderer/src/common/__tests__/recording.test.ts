import { describe, expect, it } from 'vitest'
import { recordingMediaConstraints } from '@renderer/common/recording'

describe('recordingMediaConstraints', () => {
  it('captures the game webview as a 1200 x 720 tab source', () => {
    expect(
      recordingMediaConstraints({
        target: 'game',
        mediaSource: 'tab',
        id: 'web-contents-media-source',
        width: 1200,
        height: 720
      })
    ).toEqual({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: 'web-contents-media-source'
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: 'web-contents-media-source',
          minWidth: 1200,
          maxWidth: 1200,
          minHeight: 720,
          maxHeight: 720
        }
      }
    })
  })

  it('keeps whole-window recording on the desktop capture source', () => {
    const constraints = recordingMediaConstraints({
      target: 'window',
      mediaSource: 'desktop',
      id: 'window:1:0',
      width: 1800,
      height: 960
    })

    expect(
      (constraints.video as unknown as { mandatory: Record<string, unknown> })
        .mandatory
    ).toMatchObject({
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: 'window:1:0',
      minWidth: 1800,
      maxWidth: 1800,
      minHeight: 960,
      maxHeight: 960
    })
  })
})

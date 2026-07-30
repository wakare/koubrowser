import { describe, expect, it } from 'vitest'
import { isTrustedRecordingSourceRequest } from '@main/recording-source'

describe('recording source request boundary', () => {
  it('accepts only the main frame of the main application renderer', () => {
    expect(isTrustedRecordingSourceRequest(10, true, 10)).toBe(true)
    expect(isTrustedRecordingSourceRequest(10, false, 10)).toBe(false)
    expect(isTrustedRecordingSourceRequest(11, true, 10)).toBe(false)
  })
})

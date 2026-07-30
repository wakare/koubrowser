import { describe, expect, it } from 'vitest'
import {
  isTrustedExternalUrlRequest,
  normalizeExternalUrl
} from '@main/external-url'

describe('normalizeExternalUrl', () => {
  it.each([
    'https://koubrowser.app/',
    'https://kanlog.info/',
    'https://wikiwiki.jp/kancolle/%E4%BB%BB%E5%8B%99',
    'https://zh.kcwiki.cn/wiki/%E4%BB%BB%E5%8A%A1'
  ])('accepts an application-owned HTTPS destination: %s', (url) => {
    expect(normalizeExternalUrl(url)).toBe(url)
  })

  it.each([
    'http://wikiwiki.jp/kancolle/',
    'file:///C:/Windows/System32/calc.exe',
    'mailto:test@example.com',
    'https://example.com/',
    'https://wikiwiki.jp:444/kancolle/',
    'https://user:password@wikiwiki.jp/kancolle/',
    'not a url'
  ])('rejects an unsafe external destination: %s', (url) => {
    expect(normalizeExternalUrl(url)).toBeUndefined()
  })

  it('rejects non-string and oversized IPC values', () => {
    expect(normalizeExternalUrl(undefined)).toBeUndefined()
    expect(normalizeExternalUrl({ url: 'https://wikiwiki.jp/' })).toBeUndefined()
    expect(normalizeExternalUrl(`https://wikiwiki.jp/${'a'.repeat(2048)}`)).toBeUndefined()
  })

  it('accepts only a top-level frame from a trusted application window', () => {
    const trustedIds = [10, 20, undefined]

    expect(isTrustedExternalUrlRequest(10, true, trustedIds)).toBe(true)
    expect(isTrustedExternalUrlRequest(20, true, trustedIds)).toBe(true)
    expect(isTrustedExternalUrlRequest(10, false, trustedIds)).toBe(false)
    expect(isTrustedExternalUrlRequest(30, true, trustedIds)).toBe(false)
  })
})

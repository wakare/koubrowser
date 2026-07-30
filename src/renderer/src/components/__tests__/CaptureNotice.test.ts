import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CaptureNotice from '@renderer/components/CaptureNotice.vue'

describe('CaptureNotice.vue', () => {
  it('shows the saved filename as a polite status', () => {
    const wrapper = mount(CaptureNotice, {
      props: {
        kind: 'success',
        message: '保存しました: 20260729-123456.png'
      }
    })

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-live')).toBe('polite')
    expect(wrapper.text()).toContain('20260729-123456.png')
  })

  it('announces a capture failure as an alert', () => {
    const wrapper = mount(CaptureNotice, {
      props: {
        kind: 'error',
        message: 'スクリーンショットの保存に失敗しました'
      }
    })

    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.attributes('aria-live')).toBe('assertive')
    expect(wrapper.classes()).toContain('is-error')
  })
})

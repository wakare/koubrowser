import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Invalid from '../Invalid.vue'

describe('Invalid.vue', () => {
  it('renders the localized default waiting shell', () => {
    const wrapper = mount(Invalid)

    expect(wrapper.get('.invalid-title').text()).toBe('艦隊情報表示')
    expect(wrapper.findAll('.invalid-message').map((line) => line.text())).toEqual([
      'DMM ログイン後、「GAME START」画面まで自動で遷移を行います。',
      '「GAME START」ボタンからゲームを開始すると情報が表示されます。'
    ])
  })

  it('preserves an explicitly supplied message', () => {
    const wrapper = mount(Invalid, {
      props: {
        message: 'Operator note\nKeep this value'
      }
    })

    expect(wrapper.findAll('.invalid-message').map((line) => line.text())).toEqual([
      'Operator note',
      'Keep this value'
    ])
  })
})

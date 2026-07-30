import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TaihaInputBlocker from '@renderer/components/TaihaInputBlocker.vue'

describe('TaihaInputBlocker', () => {
  it('keeps ordinary clicks blocked and requires Ctrl+click acknowledgement', async () => {
    const wrapper = mount(TaihaInputBlocker)
    const button = wrapper.get('button')

    expect(wrapper.attributes('role')).toBe('alertdialog')
    expect(wrapper.attributes('aria-modal')).toBe('true')
    expect(wrapper.text()).toContain('大破艦があります')

    await button.trigger('click')
    expect(wrapper.emitted('acknowledge')).toBeUndefined()

    await button.trigger('click', { ctrlKey: true })
    expect(wrapper.emitted('acknowledge')).toHaveLength(1)
  })

  it('supports Ctrl+Enter for keyboard users', async () => {
    const wrapper = mount(TaihaInputBlocker)

    await wrapper.get('button').trigger('keydown', {
      key: 'Enter',
      ctrlKey: true
    })

    expect(wrapper.emitted('acknowledge')).toHaveLength(1)
  })
})

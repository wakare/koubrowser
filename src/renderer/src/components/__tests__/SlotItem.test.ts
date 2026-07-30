import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ApiSlotitem, MstSlotitem, SlotWithOnSlot } from '@common/kcs'
import SlotItem from '../SlotItem.vue'

describe('SlotItem.vue', () => {
  it('loads the equipment type icon eagerly inside scrollable tables', () => {
    const slotitem = {
      api: {
        api_alv: 0,
        api_level: 0
      } as ApiSlotitem,
      mst: {
        api_name: 'テスト装備',
        api_type: [0, 0, 0, 1]
      } as unknown as MstSlotitem,
      onslot: 0,
      onslotMax: -1,
      onslotMaxMst: -1
    } satisfies SlotWithOnSlot

    const wrapper = mount(SlotItem, {
      props: { slotitem }
    })
    const typeIcon = wrapper.get('img.slot-type-img')

    expect(typeIcon.attributes('loading')).toBe('eager')
    expect(typeIcon.attributes('src')).toBeTruthy()
  })
})

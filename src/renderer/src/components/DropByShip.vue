<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import { RankDropCountIndex, AggregatedCellShipDrop, RankDropCounts } from '@common/calc_record';
import { KcsUtil } from '@common/kcs';
import { getAreaName, getEventPeriodName } from '@common/area_name';
import DropByShipArea from '@renderer/components/DropByShipArea.vue';
import { DropShipMapInfo } from '@renderer/common/drop-ship';
import DropByShipControl from './DropByShipControl.vue';
import { svdata } from '@renderer/store/svdata';
import { MapLvText } from '@common/locale';
import { useObservedElementHeight } from './table/use-observed-element-height';
import FixedCanvasViewport from './layout/FixedCanvasViewport.vue';
import {
  getDropByShipId,
  saveDropByShipId
} from '@renderer/store/panel_view_state'
import { withPanelLoadTimeout } from '@renderer/common/panel-load'
import { translateApp } from '@renderer/store/global_setting'

// -----------------------------------------------------------------
// ref elem
const tableEl = ref<HTMLElement | null>(null);

// -----------------------------------------------------------------
// show drop ship id
const dropShipId = ref(getDropByShipId());

// -----------------------------------------------------------------
// table header ship text
const shipHeaderText = ref('');

// -----------------------------------------------------------------
// ship drop map select
const dropShipMapInfo = ref<DropShipMapInfo | null>(null);

// -----------------------------------------------------------------
// table data
interface ShipDropTableData extends AggregatedCellShipDrop {
  rate: number;
  dropCount: number;
  rankDropCount: number;
  rankOrder: number;
}

const calcPercent = (count: number, total: number): number => {
  const percent = (count / total) * 100;
  return Math.round(percent * 100) / 100;
}

const datas = ref<ShipDropTableData[]>([])
const selectedData = ref<ShipDropTableData | null>(null);
const dropByShipAreaKey = ref(0)

const totalDropCount = ref(-1)

function onSelect(row: ShipDropTableData | null, rowOld: ShipDropTableData | null): void {
  console.log('ship drop table onSelect data:', row, rowOld);
  if (row) {
    dropShipMapInfo.value = {
      area_id: row.areaId,
      area_no: row.areaNo,
      map_lv: row.mapLv,
      cell_no: row.cellNo,
      cell_label: row.cellLabel,
      is_boss: row.isBoss,
      hilight_ship_id: dropShipId.value,
    };
    dropByShipAreaKey.value += 1;
  } else {
    dropShipMapInfo.value = null;
  }
}

// -----------------------------------------------------------------
// sorting state
const currentSortField = ref<string>('')
const currentSortOrder = ref<'asc' | 'desc' | ''>('')

function onSort(field: string, order:'asc' | 'desc'): void {
  console.log('ship list onSort sorting:', order, 'sorting.field:', field)
  currentSortField.value = field
  currentSortOrder.value = order
}

function isSortedField(field: string): boolean {
  return currentSortField.value === field
}

function getOrderText(): string {
  if (currentSortOrder.value === 'asc') {
    return '▲'
  } else if (currentSortOrder.value === 'desc') {
    return '▼'
  }
  return ''
}

const getRankDropOrder = (counts: RankDropCounts): number => {
  let ret = 0;
  const dropS = counts[RankDropCountIndex.S];
  const dropA = counts[RankDropCountIndex.A];
  const dropB = counts[RankDropCountIndex.B];
  ret += 10000000000 * dropS;
  ret += 100000 * dropA;
  ret += 1 * dropB;
  return ret;
}

const getRankOrder = (counts: RankDropCounts): number => {
  let ret = 0;
  if (counts[RankDropCountIndex.S] > 0) {
     ret += 100;
  }
  if (counts[RankDropCountIndex.A] > 0) {
    ret += 10;
  }
  if (counts[RankDropCountIndex.B] > 0) {
    ret += 1;
  }
  return ret;
}

// -----------------------------------------------------------------
// main state
let currentFetchShipId = 0
const recordFetching = ref(false);
const hasRecordError = ref(false)
let shipDropRequestId = 0
const listHeight = useObservedElementHeight(tableEl, 294);
let _selectionObserver: MutationObserver | null = null;
let _tableHeaderHeight = 0;

function scrollSelectedIntoView(): void {
  const wrapper = tableEl.value?.querySelector('.b-table .table-wrapper') as HTMLElement | null;
  if (!wrapper) {
    console.log('table wrapper not found for scrollSelectedIntoView');
    return;
  }
  const selected = wrapper.querySelector('tr.is-selected') as HTMLElement | null;
  if (!selected) {
    console.log('no selected row for scrollSelectedIntoView');
    return;
  }

  const wrapperRect = wrapper.getBoundingClientRect();
  const elemRect = selected.getBoundingClientRect();

  // sticky header の高さを取得
  if (! _tableHeaderHeight) {
    const tableRoot = wrapper.closest('.b-table') as HTMLElement | null;
    if (tableRoot) {
      const thead = tableRoot.querySelector('thead') as HTMLElement | null;
      if (thead) {
        const theadRect = thead.getBoundingClientRect();
        _tableHeaderHeight = Math.max(0, theadRect.bottom - wrapperRect.top);
      }
    }
  }

  // 選択要素が上部に表示しきれていない場合
  const checkTop = wrapperRect.top + _tableHeaderHeight;
  if (elemRect.top < checkTop) {
    // 選択要素の上端が見えるようにスクロール位置を調整
    // 以下は行わない、画面全体がスクロールされてしまう
    // scrollIntoViewの仕様による
    //   selected.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
    const targetScrollTop = wrapper.scrollTop + (elemRect.top - wrapperRect.top) - _tableHeaderHeight;
    wrapper.scrollTo({ top: targetScrollTop, behavior: 'auto' });

  } else if (elemRect.bottom > wrapperRect.bottom) {
    selected.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'auto' });
  }
}

async function fetchShipDropRecords(
  newShipId: number,
  force = false
): Promise<void> {
  if (newShipId <= 0) {
    return
  }
  if (
    !force &&
    currentFetchShipId === newShipId &&
    !hasRecordError.value
  ) {
    console.log('ship drop records already fetched for ship id:', newShipId);
    return;
  }

  const requestId = ++shipDropRequestId
  currentFetchShipId = newShipId;
  recordFetching.value = true;
  hasRecordError.value = false

  try {
    // The worker cancels an older aggregation only within this renderer. A
    // separately opened assist window has its own request scope.
    const calced = await withPanelLoadTimeout(
      window.api.aggregateShipDrop(newShipId),
      'Ship drop query timed out'
    )
    console.log('drop ship records fetched. count:', calced.length, 'for ship id:', newShipId);
    if (
      requestId !== shipDropRequestId ||
      currentFetchShipId !== newShipId
    ) {
      console.log('ship drop records fetch aborted for ship id:', newShipId,
        'currentFetchShipId changed to:', currentFetchShipId);
      return;
    }
    const localDatas: ShipDropTableData[] = calced.map((data) => {
      const dropCount = data.counts.reduce((a, b) => a + b, 0);
      const rate = calcPercent(dropCount, data.totalCount);
      return {
        ...data,
        rate,
        dropCount,
        rankDropCount: getRankDropOrder(data.counts),
        rankOrder: getRankOrder(data.counts),
      }
    });
    shipHeaderText.value = svdata.mstShip(newShipId)?.api_name || '';

    // 頭行選択の為、テーブルではなくこちらでソートする
    if (currentSortField.value) {
      console.log('applying current sort to fetched data:', currentSortField.value, currentSortOrder.value);
      localDatas.sort((a, b) => {
        const valA: number = (a as any)[currentSortField.value];
        const valB: number = (b as any)[currentSortField.value];
        // number 比較
        if (currentSortOrder.value === 'asc') {
          return valA - valB;
        } else {
          return valB - valA;
        }
      });
    }

    datas.value = localDatas;
    if (localDatas.length > 0) {
      const data0 = datas.value[0];
      dropShipMapInfo.value = {
        area_id: data0.areaId,
        area_no: data0.areaNo,
        map_lv: data0.mapLv,
        cell_label: data0.cellLabel,
        cell_no: data0.cellNo,
        is_boss: data0.isBoss,
        hilight_ship_id: dropShipId.value,
      };
      totalDropCount.value = localDatas.reduce((sum, data) => sum + data.dropCount, 0);
      selectedData.value = data0;
      dropByShipAreaKey.value += 1;
    } else {
      totalDropCount.value = 0;
      dropShipMapInfo.value = null;
      selectedData.value = null;
    }
  } catch (err) {
    if (
      requestId !== shipDropRequestId ||
      currentFetchShipId !== newShipId
    ) {
      return
    }
    console.error('error fetching drop ship records for ship id:', newShipId, err);
    hasRecordError.value = true
  } finally {
    if (
      requestId === shipDropRequestId &&
      currentFetchShipId === newShipId
    ) {
      recordFetching.value = false;
    }
  }
}

watch(dropShipId, (newShipId) => {
  saveDropByShipId(newShipId)
  console.log('showDropShipId changed:', newShipId);
  if (newShipId > 0) {
    void fetchShipDropRecords(newShipId)
  } else {
    shipDropRequestId += 1
    currentFetchShipId = 0
    recordFetching.value = false
    hasRecordError.value = false
  }
}, { immediate: true });

function retryShipDropRecords(): void {
  void fetchShipDropRecords(dropShipId.value, true)
}

onMounted(() => {
  console.log('drop ship history mounted');

  // 既存のマウント処理の後にテーブルラッパーを監視して選択変化でスクロール
  nextTick(() => {
    const wrapper = tableEl.value?.querySelector('.b-table .table-wrapper') as HTMLElement | null;
    if (wrapper) {
      console.log('setting up selection observer for drop ship history table');
      _selectionObserver = new MutationObserver(() => {
        // DOM/クラス変化があれば選択行を可視化
        nextTick(scrollSelectedIntoView);
      });
      _selectionObserver.observe(wrapper, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      console.log('selection observer set up completed');
    } else {
      console.log('table wrapper not found. selection observer not set up');
    }
  })
})

onUnmounted(() => {
  console.log('drop ship history destroyed')
  shipDropRequestId += 1
  _selectionObserver?.disconnect()
  _selectionObserver = null
})

const emptyText = computed<string>(() => {
  return translateApp('status.dropShip.recordEmpty');
})

// -----------------------------------------------------------------
// for row
const buildRankHtml = (data: ShipDropTableData): string => {
  const ret: string[] = []
  if (data.counts[RankDropCountIndex.S]) {
    ret.push(`<span class="rank-s">S</span>`);
  }
  if (data.counts[RankDropCountIndex.A]) {
    ret.push(`<span class="rank-a">A</span>`);
  }
  if (data.counts[RankDropCountIndex.B]) {
    ret.push(`<span class="rank-b">B</span>`);
  }
  return ret.length > 0 ? ret.join(' ') : '-';
}

const getRankDropCountText = (data: ShipDropTableData): string => {
  const countS = data.counts[RankDropCountIndex.S];
  const countA = data.counts[RankDropCountIndex.A];
  const countB = data.counts[RankDropCountIndex.B];
  return `S:${countS} A:${countA} B:${countB}`
}

const getAreaNameText = (data: ShipDropTableData): string => {
  return getAreaName(data.areaId, data.areaNo) || 'Unknown Area';
}

const getAreaCellText = (data: ShipDropTableData): string => {
  const noOrLabel = data.cellLabel ?? 'cell'+data.cellNo;
  const isEvent = KcsUtil.isEventAreaId(data.areaId)
  const mapLvText = isEvent ? (MapLvText[data.mapLv] ?? '') : ''

  // イベント名が不明な場合は空表示とする
  const eventName = isEvent ? getEventPeriodName(data.areaId) : ''

  const namePrefix = isEvent ? (eventName ?? '') +
    'E'+data.areaNo : data.areaId + '-' + data.areaNo
  const bossText = data.isBoss ? '(Boss)' : '';
    return `${namePrefix}${mapLvText} ${noOrLabel}${bossText}`;
}

const helpText = computed<string>(() => {
  if (! dropShipId.value) {
    return translateApp('status.dropShip.select');
  }
  if (recordFetching.value) {
    const mst = svdata.mstShip(dropShipId.value);
    return mst
      ? translateApp('status.dropShip.loadingForShip', {
          params: { shipName: mst.api_name }
        })
      : translateApp('status.dropShip.loading');
  }
  if (hasRecordError.value) {
    return translateApp('status.dropShip.error');
  }
  return translateApp('status.dropShip.empty');
});

const noMapInfoTitle = computed<string>(() => {
  return '3-5 北方AL海域 K(Boss)'
});

const isOverlayHelpVisible = computed<boolean>(() => {
  if(!dropShipId.value || recordFetching.value || hasRecordError.value) {
    return true;
  }
  if (datas.value.length === 0) {
    return true;
  }
  return false;
});

const isInitialState = computed<boolean>(() => {
  return totalDropCount.value < 0;
});


</script>
<template>
  <section class="drop-history-ship-root">
    <div class="ship-select-control-content">
      <DropByShipControl v-model:selected_ship_id="dropShipId"/>
    </div>
    <div v-if="isOverlayHelpVisible" class="overlay-background"></div>
    <div
      v-if="isOverlayHelpVisible"
      class="overlay-help"
      :class="{ 'is-error': hasRecordError }"
    >
      <span>{{ helpText }}</span>
      <button
        v-if="hasRecordError"
        type="button"
        @click="retryShipDropRecords"
      >
        {{ translateApp('common.retry') }}
      </button>
    </div>
    <div class="ship-drop-table" ref="tableEl">
      <b-table
        :data="datas"
        :paginated="false"
        :show-detail-icon="false"
        :bordered="false"
        :striped="true"
        :narrowed="false"
        :hoverable="false"
        :mobile-cards="false"
        :sticky-header="true"
        v-model:selected="selectedData"
        focusable
        @select="onSelect"
        default-sort-direction="desc"
        :height="listHeight"
        @sort="onSort"
      >
        <b-table-column centered header-class="drop-area" sortable field="areaId" cell-class="drop-area">
          <template #header>
            <span>{{ translateApp('drop.byShip.areaColumn', { params: { shipName: shipHeaderText } }) }}<span v-if="isSortedField('areaId')" class="order-text">{{ getOrderText() }}</span></span>
          </template>
          <template #default="props">
            <div class="area-content"><div 
              class="area-name">{{ getAreaNameText(props.row) }}</div><div 
              class="area-cell">{{ getAreaCellText(props.row) }}</div></div>
          </template>
        </b-table-column>

        <b-table-column centered header-class="drop-rate" sortable field="rate" cell-class="drop-rate">
          <template #header>
            <span>{{ translateApp('drop.column.rate') }}<span v-if="isSortedField('rate')" class="order-text">{{ getOrderText() }}</span></span>
          </template>
          <template #default="props">
            <span>{{ props.row.rate }}%</span>
          </template>
        </b-table-column>

        <b-table-column centered header-class="drop-count" sortable field="dropCount" cell-class="drop-count">
          <template #header>
            <span>{{ translateApp('drop.column.dropCount') }}<span v-if="totalDropCount >= 0">({{ totalDropCount }})</span><span v-if="isSortedField('dropCount')" class="order-text">{{ getOrderText() }}</span></span>
          </template>
          <template #default="props">
            <span>{{ props.row.dropCount }}</span>
          </template>
        </b-table-column>

        <b-table-column centered header-class="rank-drop-count" sortable field="rankDropCount" cell-class="rank-drop-count">
          <template #header>
            <span>{{ translateApp('drop.column.rankDropCount') }}<span v-if="isSortedField('rankDropCount')" class="order-text">{{ getOrderText() }}</span></span>
          </template>
          <template #default="props">
            <span>{{ getRankDropCountText(props.row) }}</span>
          </template>
        </b-table-column>

        <b-table-column centered header-class="drop-rank" sortable field="rankOrder" cell-class="drop-rank">
          <template #header>
            <span>{{ translateApp('drop.column.winRank') }}<span v-if="isSortedField('rankOrder')" class="order-text">{{ getOrderText() }}</span></span>
          </template>
          <template #default="props">
            <span v-html="buildRankHtml(props.row)"></span>
          </template>
        </b-table-column>

        <template #empty>
          <img v-if="isInitialState" src="../assets/img/app/ship-drop-table.png" class="fix-line-height"/>
          <div v-else class="has-text-centered">{{ emptyText }}</div>
        </template>

      </b-table>
    </div>
    <div class="drop-ship-map-content">
      <FixedCanvasViewport :logical-width="600" :logical-height="360">
        <DropByShipArea
          v-if="dropShipMapInfo"
          :key="dropByShipAreaKey"
          :info="dropShipMapInfo"
        />
        <div v-else class="map-container no-map-info">
          <img src="../assets/img/app/drop-ship-map.png" />
          <div class="map-title blur"><span>{{ noMapInfoTitle }}</span></div>
        </div>
      </FixedCanvasViewport>
    </div>
  </section>
</template>

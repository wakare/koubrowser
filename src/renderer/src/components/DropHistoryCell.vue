<script setup lang="ts">
import { Spot } from '@common/map';
import { DbName, DropRecord, DropRecordQuery, toRecordMapId } from '@common/record';
import { mapInfoCache } from '@renderer/common/mapinfo';
import { svdata } from '@renderer/store/svdata'
import ShipTypePie from '@renderer/components/chart/ShipTypePie.vue'
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import { ShipTypePieData } from '@renderer/components/chart/types';
import { 
  AggregateShipType, 
  RankDropCountIndex, 
  RankDropCounts, 
  RecordCalculator, 
  AggregatedShipDrop, 
  AggregatedShipTypeDrop } from '@common/calc_record';
import { 
  ApiShipBacks, 
  MstShip, 
  WinRankDrop,
  isShipRare, 
  isShipUnique,
 } from '@common/kcs';
import { ShipDropRareType } from '@common/store';
import { appSetting } from '@renderer/store/app_setting';
import { withPanelLoadTimeout } from '@renderer/common/panel-load';
import { globalSetting, translateApp } from '@renderer/store/global_setting'
import {
  getDropShipRarityText,
  getDropShipTypeText
} from '@renderer/common/drop-view'

/////////////////////////////////////////////////////////////////////////////////////
// デバッグログ
const DEBUG = false;

const debug = (...args: any[]) => {
  if (DEBUG) console.debug("[DropHistoryCell]", ...args);
};

// -----------------------------------------------------------------
// ref elem
const tableColumn = ref<HTMLElement | null>(null);

// -----------------------------------------------------------------
// table data
interface ShipDropTableData extends AggregatedShipDrop {
  backs: ApiShipBacks;
  shipName: string;
  rate: number;
  count: number;
  rankOrder: number;
}

// -----------------------------------------------------------------
// sorting state
const currentSortField = ref<string>('')
const currentSortOrder = ref<'asc' | 'desc' | ''>('')

function onSort(field: string, order:'asc' | 'desc'): void {
  debug('ship list onSort sorting:', order, 'sorting.field:', field)
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

// -----------------------------------------------------------------
// main state
const pieKey = ref(0);
const shipTypePieDatas = ref<ShipTypePieData[]>([]);
let calcedShipTypeDrop: AggregatedShipTypeDrop[] = [];
let calcedShipDrop: AggregatedShipDrop[] = []
const datas = ref<ShipDropTableData[]>([])
const totalCount = ref<number>(0);

const rareGroup = ref<Array<ShipDropRareType>>([
  ...appSetting.shipDropMap.filterRare
]);

const getRareGroup = (): Array<ShipDropRareType> => {
  const rares = [...toRaw(rareGroup.value)]
  if (rares.length === 0) {
    // none selected, treat as all selected
    return ['unique', 'rare', 'common'];
  }
  return rares;
}

const rankGroup = ref<Array<WinRankDrop>>([
  ...appSetting.shipDropMap.filterWinRank
]);

const getRankGroup = (): Array<WinRankDrop> => {
  const ranks = [...toRaw(rankGroup.value)]
  if (ranks.length === 0) {
    // none selected, treat as all selected
    return ['S', 'A', 'B'];
  }
  return ranks;
}

watch(rareGroup, (newVal) => {
  appSetting.shipDropMap.filterRare = [...toRaw(newVal)];
  debug('appSetting.shipDropMap.filterRare updated:', appSetting.shipDropMap.filterRare);
}, { deep: false });

watch(rankGroup, (newVal) => {
  appSetting.shipDropMap.filterWinRank = [...toRaw(newVal)];
  debug('appSetting.shipDropMap.filterWinRank updated:', appSetting.shipDropMap.filterWinRank);
}, { deep: true });

const selectedShipTypes = ref<AggregateShipType[]>([]);

function onShipTypeSelectChange(type: AggregateShipType, selected: boolean): void {
  debug('ship type visible changed1:', type, selected, 'selected ship types:', selectedShipTypes.value);

  if (selected) {
    if (!selectedShipTypes.value.includes(type)) {
      selectedShipTypes.value.push(type);
    }
  } else {
    selectedShipTypes.value = selectedShipTypes.value.filter(t => t !== type);
  }
  debug('ship type visible changed2:', type, selected, 'selected ship types:', selectedShipTypes.value);
  updateTableDatas();
}

const props = withDefaults(
  defineProps<{
    area_id: number
    area_no: number
    selected_spot: Spot | null
  }>(),
  {
  }
)

let currentFetchMapId = 0
const recordFetching = ref(false);
const hasRecordError = ref(false)
let recordRequestId = 0

const sumCounts = (data: AggregatedShipDrop): number => {
  return data.counts.reduce((acc, cur) => acc + cur, 0);
}

const calcPercent = (calced: AggregatedShipDrop, total: number): number => {
  const percent = (sumCounts(calced) / total) * 100;
  return Math.round(percent * 100) / 100;
}

const getRankOrder = (counts: RankDropCounts, ranks: Array<WinRankDrop>): number => {
  let ret = 0;
  if (ranks.includes('S') && counts[RankDropCountIndex.S] > 0) {
     ret += 100;
  }
  if (ranks.includes('A') && counts[RankDropCountIndex.A] > 0) {
    ret += 10;
  }
  if (ranks.includes('B') && counts[RankDropCountIndex.B] > 0) {
    ret += 1;
  }
  return ret;
}

const sumRankDropCounts = (counts: RankDropCounts, ranks: Array<WinRankDrop>): number => {
  let count = 0;
  ranks.forEach((rank) => {
    const index = RankDropCountIndex[rank]
    if (counts[index]){
      count += counts[index];
    }
  });
  return count;
}

const isRareMatch = (
  mst: MstShip | undefined | null, 
  rareGroups: Array<ShipDropRareType>): boolean => {
  if (!mst) {
    // drop無しの場合で全レア表示なら許可
    return rareGroups.length === 3;
  }
  const backs: ApiShipBacks = mst.api_backs;
  if (isShipUnique(backs)) {
    return rareGroups.includes('unique');
  } else if (isShipRare(backs)) {
    return rareGroups.includes('rare');
  } else {
    return rareGroups.includes('common');
  }
}

function updateShipTypePieData() {
  debug('updateShipTypePieData called. shipType calced count:', 
    calcedShipTypeDrop.length, 'rankGroup:', rankGroup.value, 'pie chart length:', shipTypePieDatas.value.length);

  type ShipTypePieItem = (typeof shipTypePieDatas.value)[number];
  const datas: ShipTypePieItem[] = [];
  const filterRank = getRankGroup();
  calcedShipTypeDrop.forEach((el) => {
    const y = sumRankDropCounts(el.counts, filterRank);
    datas.push({ name: getDropShipTypeText(el.type, translateApp), y, type: el.type});
  });
  shipTypePieDatas.value = datas;
}

function updateTableDatas() {
  type DataType = (typeof datas.value)[number];
  const newList: DataType[]= [];
  const filterShipTypes = selectedShipTypes.value;
  let total = 0;
  const filterRank = getRankGroup();
  const filterRare = getRareGroup();
  calcedShipDrop.forEach((el) => {
    //debug('shipId:', el.shipId, 'data:', el.counts);
    const mst = el.shipId > 0 ? svdata.mstShip(el.shipId) : null;
    const shipName = el.shipId > 0
      ? (mst ? mst.api_name : '????')
      : translateApp('drop.common.noDrop');
    let aggType
    if (el.shipId >= 0) {
      aggType = mst ? RecordCalculator.getAggregateShipType(mst) : undefined;
    } else {
      aggType = AggregateShipType.nodrop;
    }
    if (! aggType) {
      debug('unknown aggregate ship type for shipId:', el.shipId, 'name:', shipName);
      return ;
    }
    
    const dropCount = sumRankDropCounts(el.counts, filterRank);
    if (! dropCount) {
      return ;
    }

    total += dropCount;

    // filter: ship type
    if (filterShipTypes.length > 0 && ! filterShipTypes.includes(aggType)) {
      return ;
    }

    // filter: rare
    if (!isRareMatch(mst, filterRare)) {
      return ;
    }

    // add table data
    const v = {
      ...el,
      shipName,
      backs: mst ? mst.api_backs : 0,
      rate: 0,
      count: dropCount,
      rankOrder: getRankOrder(el.counts, filterRank),
    }
    //debug('table push data:', v);
    newList.push(v)
  })

  // calc percent
  if (total > 0) {
    newList.forEach((data) => {
      data.rate = calcPercent(data, total);
    });
  }

  // sort if not ordered
  if (! currentSortField.value) {
    newList.sort((a, b) => b.count - a.count);
  }
  totalCount.value = total;
  datas.value = newList;
}

const resetTableScrollPos = (): void => {
  if (tableColumn.value) {
    const tableBody = tableColumn.value.querySelector('.table-wrapper');
    if (tableBody) {
      tableBody.scrollTop = 0;
    }
  }
}

async function fetchRecord(spot: Spot): Promise<void> {
  currentFetchMapId = toRecordMapId(props.area_id, props.area_no);
  const query: DropRecordQuery = {
    dbName: DbName.drop,
    find: {
      mapId: currentFetchMapId,
      cellId: { $in: mapInfoCache.findCellNos(props.area_id, props.area_no, spot.no) },
      rank: { $in: ['S', 'A', 'B'] }
    },
    projection: {
      shipId: 1,
      mapId: 1,
      cellId: 1,
      rank: 1,
      count: 1,
      isBoss: 1,
    }
  };

  // save fetch map id,no
  const fetchingMapId = currentFetchMapId;
  const requestId = ++recordRequestId
  recordFetching.value = true;
  hasRecordError.value = false
  try {
    const queryReturn = await withPanelLoadTimeout(
      window.api.queryDb(query),
      'Drop history cell query timed out'
    )
    const records = queryReturn as DropRecord[]
    if (
      requestId !== recordRequestId ||
      fetchingMapId !== currentFetchMapId
    ) {
      debug('drop record fetched but mapId changed. ignore the result for mapId:', fetchingMapId);
      return;
    }
    debug('drop record queried. record count:', records.length, 'for mapId:', currentFetchMapId);

    // calc total drop count
    calcedShipDrop = RecordCalculator.aggregateShipDrop(records);
    calcedShipTypeDrop = RecordCalculator.aggregateShipTypeDrop(calcedShipDrop, svdata);
    debug('calced ship drop count:', calcedShipDrop.length, 'calced ship type drop count:', calcedShipTypeDrop.length);

    // init ship type pie chart by current filter
    // init table datas by current filter
    selectedShipTypes.value = [];
    shipTypePieDatas.value = [];
    updateShipTypePieData();
    pieKey.value++;
    updateTableDatas();
    resetTableScrollPos();
  } catch (error) {
    if (
      requestId !== recordRequestId ||
      fetchingMapId !== currentFetchMapId
    ) {
      return
    }
    hasRecordError.value = true
    console.error('drop record query failed for mapId:', currentFetchMapId, 'error:', error);
  } finally {
    if (
      requestId === recordRequestId &&
      fetchingMapId === currentFetchMapId
    ) {
      recordFetching.value = false;
    }
  }
}

function retryFetchRecord(): void {
  if (props.selected_spot) {
    void fetchRecord(props.selected_spot)
  }
}

watch(
  () => [props.area_id, props.area_no, props.selected_spot],
  ([area_id, area_no, selected_spot]) => {
    debug(
      'drop histoy area no change. cell info updated.',
      area_id,
      area_no,
      selected_spot
    )
    if (props.selected_spot) {
      void fetchRecord(props.selected_spot);
    } else {
      recordRequestId += 1
      recordFetching.value = false
      hasRecordError.value = false
      // clear data
      calcedShipDrop = [];
      calcedShipTypeDrop = [];
      datas.value = [];
      shipTypePieDatas.value = [];
    }
  },
  { immediate: true }
)

const listHeight = computed<number>(() => {
  return 536;
})

onMounted(() => {
  debug('drop history cell mounted', props.area_id, props.area_no)
})

onUnmounted(() => {
  recordRequestId += 1
  debug('drop history cell destroyed', props.area_id, props.area_no)
})

const emptyText = computed<string>(() => {
  if (! props.selected_spot) {
    return '';//マップ上のセルを選択してください';
  }
  if (recordFetching.value) {
    return translateApp('status.dropHistory.loading');
  }
  if (hasRecordError.value) {
    return translateApp('status.dropHistory.error');
  }

  const filterShipTypes = selectedShipTypes.value;
  const filterRank = getRankGroup();
  const filterRare = getRareGroup();
  let isFiltered = false;
  if (filterRank.length < 3) {
    isFiltered = true;
  }
  if (filterRare.length < 3) {
    isFiltered = true;
  }
  if (filterShipTypes.length > 0) {
    isFiltered = true;
  }
  if (isFiltered) {
    return translateApp('status.dropHistory.emptyFiltered');
  }
  return translateApp('status.dropHistory.empty');
})

const isShipTypePieEnable = computed<boolean>(() => {
  return shipTypePieDatas.value.length > 0;
});

function getShipNameTitle(data: ShipDropTableData): string {
  if (data.shipId < 0) {
    return '';
  }
  return `id:${data.shipId} ${data.shipName}`;
}

// -----------------------------------------------------------------
// for row
const buildRankHtml = (data: AggregatedShipDrop): string => {
  const ret: string[] = []
  const filterRank = getRankGroup();
  if (filterRank.includes('S') && data.counts[RankDropCountIndex.S]) {
    ret.push(`<span class="rank-s">S</span>`);
  }
  if (filterRank.includes('A') && data.counts[RankDropCountIndex.A]) {
    ret.push(`<span class="rank-a">A</span>`);
  }
  if (filterRank.includes('B') && data.counts[RankDropCountIndex.B]) {
    ret.push(`<span class="rank-b">B</span>`);
  }
  return ret.length > 0 ? ret.join(' ') : '-';
}

function onRareFilterChanged() {
  debug('rare filter changed to:', rareGroup.value);
  updateTableDatas();
}

function onRankFilterChanged() {
  debug('rank filter changed to:', rankGroup.value);
  updateShipTypePieData();
  updateTableDatas();
}

watch(
  () => globalSetting.locale,
  () => {
    updateShipTypePieData()
    updateTableDatas()
  }
)

</script>

<template>
  <section class="drop-history-cell-root">
    <div v-if="!props.selected_spot" class="overlay-help">{{ translateApp('drop.cell.select') }}</div>
    <div v-if="!props.selected_spot" class="overlay-background"></div>
    <div class="columns">
      <div class="column" ref="tableColumn">
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
          default-sort-direction="desc"
          :height="listHeight"
          @sort="onSort"
        >
          <b-table-column centered 
            header-class="drop-rare" sortable field="backs" cell-class="drop-rare">
            <template #header>
              <span>{{ translateApp('drop.column.rarity') }}<span v-if="isSortedField('backs')" class="order-text">{{ getOrderText() }}</span></span>
            </template>
            <template #default="props">
              <span :class="{
                'is-rare': isShipRare(props.row.backs), 
                'is-unique': isShipUnique(props.row.backs)          
              }">{{ getDropShipRarityText(props.row.backs, translateApp) }}</span>
            </template>
          </b-table-column>

          <b-table-column centered header-class="drop-ship-name" sortable field="shipName" cell-class="drop-ship-name">
            <template #header>
              <span>{{ translateApp('drop.column.shipName') }}<span v-if="isSortedField('shipName')" class="order-text">{{ getOrderText() }}</span></span>
            </template>
            <template #default="props">
              <span :class="{
                'is-rare': isShipRare(props.row.backs), 
                'is-unique': isShipUnique(props.row.backs)          
              }"
              :title="getShipNameTitle(props.row)">{{ props.row.shipName }}</span>
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

          <b-table-column centered header-class="drop-count" sortable field="count" cell-class="drop-count">
            <template #header>
              <span>{{ translateApp('drop.column.dropCount') }}<span
                v-if="totalCount > 0">({{ translateApp('drop.column.dropCountTotal', { params: { count: totalCount } }) }})</span><span v-if="isSortedField('count')" class="order-text">{{ getOrderText() }}</span></span>
            </template>
            <template #default="props">
              <span>{{ props.row.count }} (S:{{ props.row.counts[RankDropCountIndex.S] }} A:{{ props.row.counts[RankDropCountIndex.A] }} B:{{ props.row.counts[RankDropCountIndex.B] }})</span>
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
            <div class="has-text-centered">{{ emptyText }}</div>
            <button
              v-if="hasRecordError"
              type="button"
              class="drop-history-cell-retry"
              @click="retryFetchRecord"
            >
              {{ translateApp('common.retry') }}
            </button>
            <img v-if="!props.selected_spot" src="../assets/img/app/drop-history-cell-table.png"/>
          </template>

        </b-table>
      </div>
      <div class="column">
        <div class="filter-container">
          <div class="filter-content rare">
            <div class="filter-title">{{ translateApp('drop.filter.rarity') }}</div>
            <b-field class="filters" grouped>
              <b-checkbox-button size="is-small" v-model="rareGroup" native-value="unique" 
                @change="onRareFilterChanged" type="is-checked">{{ translateApp('drop.filter.rarity.unique') }}</b-checkbox-button>
              <b-checkbox-button size="is-small" v-model="rareGroup" native-value="rare" 
                @change="onRareFilterChanged" type="is-checked">{{ translateApp('drop.filter.rarity.rare') }}</b-checkbox-button>
              <b-checkbox-button size="is-small" v-model="rareGroup" native-value="common" 
                @change="onRareFilterChanged" type="is-checked">{{ translateApp('drop.filter.rarity.common') }}</b-checkbox-button>
            </b-field>
          </div>
          <div class="filter-content">
            <div class="filter-title">{{ translateApp('drop.filter.winRank') }}</div>
            <b-field class="filters" grouped>
              <b-checkbox-button size="is-small" v-model="rankGroup" native-value="S" 
                @change="onRankFilterChanged" type="is-checked">S</b-checkbox-button>
              <b-checkbox-button size="is-small" v-model="rankGroup" native-value="A" 
                @change="onRankFilterChanged" type="is-checked">A</b-checkbox-button>
              <b-checkbox-button size="is-small" v-model="rankGroup" native-value="B" 
                @change="onRankFilterChanged" type="is-checked">B</b-checkbox-button>
            </b-field>
          </div>
        </div>
        <div class="ship-type-pie-container">
          <ShipTypePie
            v-if="isShipTypePieEnable"
            :key="pieKey"
            :seriesData="shipTypePieDatas"
            @ship-type-select-change="onShipTypeSelectChange"
          /><img v-else class="blur-img" src="../assets/img/app/ship-type-pie-chart.png"/>
        </div>
      </div>
    </div>
  </section>
</template>

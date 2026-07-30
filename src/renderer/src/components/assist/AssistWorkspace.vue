<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AssistPanelHost from './AssistPanelHost.vue'
import {
  getAssistPanelSubtitle,
  getAssistPanelTitle,
  getAssistPanelTitleLines,
  getWorkspacePageDefinitions,
  getWorkspacePanelCatalog,
  getWorkspacePanelDefinitions,
  type AssistPanelName,
  type AssistPanelWorkspaceArea,
  type AssistPanelWorkspacePageId
} from '@renderer/common/assist-panel'
import {
  getWorkspacePageDisplayTitle,
  WorkspacePanelHeightMax,
  WorkspacePanelHeightMin,
  WorkspacePanelWidthMax,
  WorkspacePanelWidthMin
} from '@renderer/common/workspace-layout'
import {
  createWorkspacePage,
  deleteWorkspacePage,
  duplicateWorkspacePage,
  getWorkspacePageLayout,
  getWorkspacePages,
  getHiddenWorkspacePages,
  hideEmptyWorkspacePage,
  isWorkspacePageCustomized,
  isWorkspacePagePanelLayoutCustomized,
  moveWorkspacePage,
  moveWorkspacePanelByName,
  renameWorkspacePage,
  reorderWorkspacePanelByName,
  resetWorkspaceLayout,
  restoreWorkspacePage,
  setAllWorkspacePanelsVisible,
  setWorkspacePanelHeight,
  setWorkspacePanelSize,
  setWorkspacePanelWidth,
  setWorkspacePanelVisible
} from '@renderer/store/workspace_layout'
import { translateApp } from '@renderer/store/global_setting'
import { getActiveWorkspacePage, saveActiveWorkspacePage } from '@renderer/store/panel_view_state'

const props = defineProps<{
  area: AssistPanelWorkspaceArea
}>()

const CompactHeightQuery = '(max-height: 899px)'
const compactHeight = ref(false)
const pageDefinitions = new Map(
  getWorkspacePageDefinitions(props.area).map((page) => [page.id, page])
)
const pages = computed(() =>
  getWorkspacePages(props.area).filter((page) => {
    const definition = pageDefinitions.get(page.id)
    return page.visible && (!definition?.compactHeightOnly || compactHeight.value)
  })
)
const hiddenPages = computed(() => getHiddenWorkspacePages(props.area))
const workspaceVisible = computed(() => props.area !== 'primary' || !compactHeight.value)
const initialPageIds = pages.value.map((page) => page.id)
const activePageId = ref<AssistPanelWorkspacePageId>(
  getActiveWorkspacePage(props.area, initialPageIds) ?? initialPageIds[0]
)
const lastRegularPageId = ref(activePageId.value)
const activePage = computed(
  () => pages.value.find((page) => page.id === activePageId.value) ?? pages.value[0]
)
const editorOpen = ref(false)
const panelCatalog = [
  ...new Map(
    [
      ...getWorkspacePanelCatalog(props.area),
      ...getWorkspacePageDefinitions(props.area).flatMap((page) =>
        getWorkspacePanelDefinitions(props.area, page.id)
      )
    ].map((panel) => [panel.name, panel] as const)
  ).values()
]
const panelDefinitionsByName = new Map(panelCatalog.map((panel) => [panel.name, panel] as const))
const pageLayout = computed(() =>
  activePage.value ? getWorkspacePageLayout(activePage.value.id) : []
)
const visibleAreaPageCount = computed(
  () => getWorkspacePages(props.area).filter((page) => page.visible).length
)
const panels = computed(() =>
  pageLayout.value
    .filter((panel) => panel.visible)
    .map((panel) => panelDefinitionsByName.get(panel.name))
    .filter((panel) => panel !== undefined)
)
const activePageDefinition = computed(() =>
  activePage.value ? pageDefinitions.get(activePage.value.id) : undefined
)
const pageCustomizable = computed(() => activePageDefinition.value?.customizable !== false)
const pageCustomized = computed(
  () =>
    Boolean(activePage.value) &&
    pageCustomizable.value &&
    isWorkspacePageCustomized(activePage.value.id)
)
const pagePanelLayoutCustomized = computed(
  () => Boolean(activePage.value) && isWorkspacePagePanelLayoutCustomized(activePage.value.id)
)
const draggedPanelName = ref<AssistPanelName>()
const resizePreview = ref<{
  name: AssistPanelName
  width: number
  height: number
}>()
let compactHeightMedia: MediaQueryList | undefined
let stopPanelResize: (() => void) | undefined

watch(activePageId, (pageId) => {
  stopPanelResize?.()
  editorOpen.value = false
  const definition = pageDefinitions.get(pageId)
  if (!definition?.compactHeightOnly) {
    lastRegularPageId.value = pageId
    saveActiveWorkspacePage(props.area, pageId)
  }
})

watch(pages, (availablePages) => {
  if (availablePages.some((page) => page.id === activePageId.value)) {
    return
  }

  activePageId.value =
    availablePages.find((page) => page.id === lastRegularPageId.value)?.id ?? availablePages[0]?.id
})

function updateCompactHeight(event?: MediaQueryListEvent): void {
  compactHeight.value = event?.matches ?? compactHeightMedia?.matches ?? false
}

onMounted(() => {
  if (typeof window.matchMedia !== 'function') {
    return
  }

  compactHeightMedia = window.matchMedia(CompactHeightQuery)
  compactHeightMedia.addEventListener('change', updateCompactHeight)
  updateCompactHeight()
})

onUnmounted(() => {
  compactHeightMedia?.removeEventListener('change', updateCompactHeight)
  stopPanelResize?.()
})

function panelTitle(panel: (typeof panelCatalog)[number]): string {
  return getAssistPanelTitleLines(panel, translateApp).join('')
}

function panelSubtitle(panel: (typeof panelCatalog)[number]): string | undefined {
  return getAssistPanelSubtitle(panel, translateApp)
}

function pageTitle(page: NonNullable<typeof activePage.value>): string {
  return getWorkspacePageDisplayTitle(page, translateApp)
}

function layoutPanelTitle(name: AssistPanelName): string {
  const panel = panelDefinitionsByName.get(name)
  return panel ? getAssistPanelTitle(panel, translateApp) : name
}

function panelWidth(name: AssistPanelName): number {
  return pageLayout.value.find((panel) => panel.name === name)?.width ?? WorkspacePanelWidthMax / 2
}

function panelHeight(name: AssistPanelName): number {
  return pageLayout.value.find((panel) => panel.name === name)?.height ?? 3
}

function panelStyle(name: AssistPanelName): Record<string, string> {
  return {
    '--workspace-panel-width': `${panelWidth(name)}`,
    '--workspace-panel-height': `${panelHeight(name)}`
  }
}

function movePanel(name: AssistPanelName, offset: -1 | 1): void {
  if (activePage.value) {
    moveWorkspacePanelByName(activePage.value.id, name, offset)
  }
}

function changePanelVisibility(name: AssistPanelName, event: Event): void {
  const input = event.target
  if (input instanceof HTMLInputElement && activePage.value) {
    setWorkspacePanelVisible(activePage.value.id, name, input.checked)
  }
}

function setAllPanelsVisible(visible: boolean): void {
  if (activePage.value) {
    setAllWorkspacePanelsVisible(activePage.value.id, visible)
  }
}

function changePanelWidth(name: AssistPanelName, event: Event): void {
  const select = event.target
  if (select instanceof HTMLSelectElement && activePage.value) {
    setWorkspacePanelWidth(activePage.value.id, name, Number(select.value))
  }
}

function changePanelHeight(name: AssistPanelName, event: Event): void {
  const select = event.target
  if (select instanceof HTMLSelectElement && activePage.value) {
    setWorkspacePanelHeight(activePage.value.id, name, Number(select.value))
  }
}

async function addPage(): Promise<void> {
  const pageId = createWorkspacePage(props.area, activePage.value?.id)
  if (pageId) {
    activePageId.value = pageId
    await nextTick()
    editorOpen.value = true
  }
}

async function duplicatePage(): Promise<void> {
  if (!activePage.value) {
    return
  }
  const pageId = duplicateWorkspacePage(activePage.value.id)
  if (pageId) {
    activePageId.value = pageId
    await nextTick()
    editorOpen.value = true
  }
}

function renamePage(event: Event): void {
  const input = event.target
  if (input instanceof HTMLInputElement && activePage.value) {
    renameWorkspacePage(activePage.value.id, input.value)
  }
}

function removePage(): void {
  if (
    !activePage.value?.userCreated ||
    visibleAreaPageCount.value <= 1 ||
    !window.confirm(
      translateApp('workspace.confirm.deleteUserPage', {
        params: { page: pageTitle(activePage.value) }
      })
    )
  ) {
    return
  }
  const nextPageId = deleteWorkspacePage(activePage.value.id)
  if (nextPageId) {
    activePageId.value = nextPageId
  }
}

function removeEmptyPage(): void {
  const page = activePage.value
  if (!page || panels.value.length > 0 || visibleAreaPageCount.value <= 1) {
    return
  }
  const message = page.userCreated
    ? translateApp('workspace.confirm.deleteEmptyUserPage', {
        params: { page: pageTitle(page) }
      })
    : translateApp('workspace.confirm.hideEmptyBuiltInPage', {
        params: { page: pageTitle(page) }
      })
  if (!window.confirm(message)) {
    return
  }

  const nextPageId = page.userCreated
    ? deleteWorkspacePage(page.id)
    : hideEmptyWorkspacePage(page.id)
  if (nextPageId && nextPageId !== page.id) {
    activePageId.value = nextPageId
  }
}

function restorePage(pageId: AssistPanelWorkspacePageId): void {
  restoreWorkspacePage(pageId)
}

function restoreDefaults(): void {
  if (window.confirm(translateApp('workspace.confirm.resetAll'))) {
    resetWorkspaceLayout()
  }
}

function startPanelDrag(name: AssistPanelName, event: DragEvent): void {
  if (!editorOpen.value) {
    event.preventDefault()
    return
  }
  draggedPanelName.value = name
  event.dataTransfer?.setData('text/plain', name)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function dropPanel(targetName: AssistPanelName, event: DragEvent): void {
  event.preventDefault()
  const sourceName =
    draggedPanelName.value ??
    (event.dataTransfer?.getData('text/plain') as AssistPanelName | undefined)
  if (sourceName && activePage.value) {
    reorderWorkspacePanelByName(activePage.value.id, sourceName, targetName)
  }
  draggedPanelName.value = undefined
}

function startPanelResize(name: AssistPanelName, event: PointerEvent): void {
  if (!activePage.value) {
    return
  }
  event.preventDefault()
  const startX = event.clientX
  const startY = event.clientY
  const startWidth = panelWidth(name)
  const startHeight = panelHeight(name)
  const pageId = activePage.value.id
  const grid = (event.currentTarget as HTMLElement).closest('.workspace-page-grid')
  const columnWidth = (grid?.clientWidth || 720) / WorkspacePanelWidthMax
  stopPanelResize?.()

  const onPointerMove = (moveEvent: PointerEvent): void => {
    const deltaX = moveEvent.clientX - startX
    const deltaY = moveEvent.clientY - startY
    const width = Math.min(
      Math.max(startWidth + Math.round(deltaX / columnWidth), WorkspacePanelWidthMin),
      WorkspacePanelWidthMax
    )
    const height = Math.min(
      Math.max(startHeight + Math.round(deltaY / 72), WorkspacePanelHeightMin),
      WorkspacePanelHeightMax
    )
    resizePreview.value = { name, width, height }
  }

  const cleanupResize = (): void => {
    resizePreview.value = undefined
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', finishResize)
    window.removeEventListener('pointercancel', finishResize)
    if (stopPanelResize === cleanupResize) {
      stopPanelResize = undefined
    }
  }

  const finishResize = (): void => {
    const preview = resizePreview.value
    if (preview?.name === name) {
      setWorkspacePanelSize(pageId, name, preview.width, preview.height)
    }
    cleanupResize()
  }

  stopPanelResize = cleanupResize
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', finishResize)
  window.addEventListener('pointercancel', finishResize)
}
</script>

<template>
  <aside
    v-if="workspaceVisible"
    class="assist-workspace"
    :class="`assist-workspace--${props.area}`"
  >
    <nav
      v-if="pages.length > 0"
      class="workspace-page-tabs"
      :aria-label="
        props.area === 'primary'
          ? translateApp('workspace.aria.primaryPanels')
          : translateApp('workspace.aria.secondaryPanels')
      "
      role="tablist"
    >
      <button
        v-for="page in pages"
        :key="page.id"
        type="button"
        role="tab"
        :class="{ 'is-active': page.id === activePage.id }"
        :data-workspace-page-id="page.id"
        :aria-selected="page.id === activePage.id"
        :aria-controls="`${props.area}-workspace-page`"
        @click="activePageId = page.id"
      >
        {{ pageTitle(page) }}
      </button>
      <button
        type="button"
        class="workspace-add-page-button"
        :aria-label="translateApp('workspace.page.add')"
        :title="translateApp('workspace.page.add')"
        @click="addPage"
      >
        ＋
      </button>
      <button
        v-show="pageCustomizable"
        type="button"
        class="workspace-layout-button"
        :class="{ 'is-open': editorOpen, 'is-customized': pageCustomized }"
        :aria-expanded="editorOpen"
        :aria-label="
          pageCustomized
            ? translateApp('workspace.layout.changedTitle')
            : translateApp('workspace.layout.title')
        "
        aria-controls="workspace-layout-editor"
        :title="
          pageCustomized
            ? translateApp('workspace.layout.changedTitle')
            : translateApp('workspace.layout.title')
        "
        @click="editorOpen = !editorOpen"
      >
        {{ translateApp('workspace.layout.button') }}<span
          v-if="pageCustomized"
          class="workspace-layout-button-status"
        >{{ translateApp('workspace.layout.changedSuffix') }}</span>
      </button>
    </nav>
    <section
      v-if="editorOpen && activePage"
      id="workspace-layout-editor"
      class="workspace-layout-editor"
      :aria-label="translateApp('workspace.layout.editorAria')"
    >
      <header>
        <strong>{{
          translateApp('workspace.layout.editorTitle', {
            params: { page: pageTitle(activePage) }
          })
        }}</strong>
        <button type="button" @click="editorOpen = false">
          {{ translateApp('common.close') }}
        </button>
      </header>
      <div class="workspace-page-actions">
        <input
          type="text"
          :value="pageTitle(activePage)"
          maxlength="40"
          :aria-label="translateApp('workspace.page.name')"
          @change="renamePage"
        />
        <button type="button" @click="duplicatePage">
          {{ translateApp('workspace.page.duplicate') }}
        </button>
        <button
          v-if="activePage.userCreated"
          type="button"
          @click="moveWorkspacePage(activePage.id, -1)"
        >
          ←
        </button>
        <button
          v-if="activePage.userCreated"
          type="button"
          @click="moveWorkspacePage(activePage.id, 1)"
        >
          →
        </button>
        <button
          v-if="activePage.userCreated"
          type="button"
          class="is-danger"
          :disabled="visibleAreaPageCount <= 1"
          :title="
            visibleAreaPageCount <= 1
              ? translateApp('status.workspace.lastPageCannotDelete')
              : translateApp('workspace.page.deleteTitle')
          "
          @click="removePage"
        >
          {{ translateApp('workspace.page.delete') }}
        </button>
      </div>
      <p>{{ translateApp('workspace.layout.help') }}</p>
      <div class="workspace-layout-visibility-actions">
        <button type="button" @click="setAllPanelsVisible(true)">
          {{ translateApp('workspace.layout.showAll') }}
        </button>
        <button type="button" @click="setAllPanelsVisible(false)">
          {{ translateApp('workspace.layout.hideAll') }}
        </button>
      </div>
      <ol>
        <li
          v-for="(layoutPanel, index) in pageLayout"
          :key="layoutPanel.name"
          :data-layout-panel-name="layoutPanel.name"
        >
          <label>
            <input
              type="checkbox"
              :checked="layoutPanel.visible"
              @change="changePanelVisibility(layoutPanel.name, $event)"
            />
            <span>{{ layoutPanelTitle(layoutPanel.name) }}</span>
          </label>
          <div class="workspace-layout-row-actions">
            <button
              type="button"
              :title="translateApp('workspace.layout.moveEarlier')"
              :disabled="index === 0"
              @click="movePanel(layoutPanel.name, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              :title="translateApp('workspace.layout.moveLater')"
              :disabled="index === pageLayout.length - 1"
              @click="movePanel(layoutPanel.name, 1)"
            >
              ↓
            </button>
            <select
              :value="layoutPanel.width"
              :aria-label="translateApp('workspace.layout.panelWidth')"
              @change="changePanelWidth(layoutPanel.name, $event)"
            >
              <option
                v-for="width in WorkspacePanelWidthMax - WorkspacePanelWidthMin + 1"
                :key="width + WorkspacePanelWidthMin - 1"
                :value="width + WorkspacePanelWidthMin - 1"
              >
                {{
                  width + WorkspacePanelWidthMin - 1 === WorkspacePanelWidthMax
                    ? translateApp('workspace.layout.fullWidth')
                    : translateApp('workspace.layout.widthValue', {
                        params: { width: width + WorkspacePanelWidthMin - 1 }
                      })
                }}
              </option>
            </select>
            <select
              :value="layoutPanel.height"
              :aria-label="translateApp('workspace.layout.panelHeight')"
              @change="changePanelHeight(layoutPanel.name, $event)"
            >
              <option
                v-for="height in WorkspacePanelHeightMax"
                :key="height"
                :value="height"
              >
                {{
                  translateApp('workspace.layout.heightValue', {
                    params: { height }
                  })
                }}
              </option>
            </select>
          </div>
        </li>
      </ol>
      <section v-if="hiddenPages.length > 0" class="workspace-hidden-pages">
        <strong>{{ translateApp('workspace.hiddenPages') }}</strong>
        <ul>
          <li
            v-for="page in hiddenPages"
            :key="page.id"
            :data-workspace-page-id="page.id"
          >
            <span>{{ pageTitle(page) }}</span>
            <button type="button" @click="restorePage(page.id)">
              {{ translateApp('workspace.restorePage') }}
            </button>
          </li>
        </ul>
      </section>
      <footer>
        <button type="button" @click="restoreDefaults">
          {{ translateApp('workspace.resetAll') }}
        </button>
      </footer>
    </section>
    <div
      v-if="activePage"
      class="workspace-page-viewport"
    >
      <div class="workspace-page-canvas">
        <div
          class="workspace-page-grid"
          :id="`${props.area}-workspace-page`"
          :data-workspace-page="activePage.id"
          :data-workspace-customized="pagePanelLayoutCustomized"
          role="tabpanel"
        >
          <article
            v-for="panel in panels"
            :key="panel.name"
            class="workspace-panel"
            :class="{
              'is-layout-editing': editorOpen,
              'is-resizing': resizePreview?.name === panel.name
            }"
            :data-panel-name="panel.name"
            :data-layout-kind="panel.layoutKind"
            :data-workspace-width="panel.workspace.width"
            :data-workspace-height="panel.workspace.height"
            :data-workspace-columns="panelWidth(panel.name)"
            :style="panelStyle(panel.name)"
            @dragover.prevent
            @drop="dropPanel(panel.name, $event)"
          >
            <header
              class="workspace-panel-header"
              :draggable="editorOpen"
              @dragstart="startPanelDrag(panel.name, $event)"
              @dragend="draggedPanelName = undefined"
            >
              <span>{{ panelTitle(panel) }}</span>
              <small v-if="panel.subtitleKey">{{ panelSubtitle(panel) }}</small>
            </header>
            <div class="workspace-panel-body">
              <AssistPanelHost :panel-name="panel.name" />
            </div>
            <div
              v-if="resizePreview?.name === panel.name"
              class="workspace-panel-resize-preview"
              aria-live="polite"
            >
              {{
                translateApp('workspace.resizePreview', {
                  params: {
                    width: resizePreview.width,
                    height: resizePreview.height
                  }
                })
              }}
            </div>
            <button
              type="button"
              class="workspace-panel-resize-handle"
              :aria-label="translateApp('workspace.resizeAria')"
              :title="translateApp('workspace.resizeTitle')"
              @pointerdown="startPanelResize(panel.name, $event)"
            >
              ↘
            </button>
          </article>
          <div v-if="panels.length === 0" class="workspace-page-empty">
            <p>{{ translateApp('status.workspace.noPanels') }}</p>
            <div>
              <button type="button" @click="editorOpen = true">
                {{ translateApp('status.workspace.configurePanels') }}
              </button>
              <button
                type="button"
                class="is-danger"
                :disabled="visibleAreaPageCount <= 1"
                :title="
                  visibleAreaPageCount <= 1
                    ? translateApp('status.workspace.lastPageCannotDelete')
                    : translateApp('status.workspace.deleteEmptyPageTitle')
                "
                @click="removeEmptyPage"
              >
                {{ translateApp('status.workspace.deleteEmptyPage') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

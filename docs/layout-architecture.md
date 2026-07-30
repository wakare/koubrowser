# Layout architecture baseline

## Goal

Keep the current game stage stable while making the non-game modules usable as
responsive panels. The intended future workspace is a frameless 4K window that
can show the fixed game stage and several assist panels at the same time without
clipping controls, pagination, or chart content.

This work does not change, inject, or interfere with game-server communication.

## Current classic layout

The compatibility baseline is:

| Region                  | Size        |
| ----------------------- | ----------- |
| Game stage              | 1200 × 720  |
| Right assist panel      | 600 px wide |
| Bottom assist row       | 168 px high |
| Custom title bar        | 32 px high  |
| Combined window content | 1800 × 920  |

`src/common/layout.ts` is the shared source for derived classic geometry.
Renderer CSS variables still provide safe fallback values before Vue mounts.

Three layout surfaces are now named explicitly:

- `classic-combined`: fixed game stage, right assist panel, and bottom summary
- `game-only`: aspect-ratio-resized game window
- `assist-window`: separate assist BrowserWindow
- `workspace`: resizable frameless dashboard with a fixed game stage and
  responsive assist cards

## Technical-debt inventory

### Multiple size sources

Window creation uses `Const`, renderer layout mixes runtime CSS variables with
Sass constants, and recording has independent fixed capture constraints. A
change to one source can silently disagree with the others.

Policy:

- window and classic shell geometry come from `classicLayoutMetrics`;
- panel layout uses container dimensions, not screen dimensions;
- capture/output dimensions remain a separate concern and must not drive UI
  layout.

### A tab is also a component lifecycle

The stable panel ids, metadata, and component mapping now live in the assist
panel registry. `Assist.vue` is the classic tab presentation of that registry;
panel-specific loading, such as resource chart data, belongs to the panel
component instead of the tab controller.

Classic mode still unmounts inactive panels to preserve its existing resource
usage. A workspace presentation can mount several `AssistPanelHost` instances
at once without duplicating the tab definitions.

### Async panel loading

Panels that wait for IPC or worker results own an explicit loading lifecycle.
Loading overlays must have ready, empty, and retryable error exits; a rejected
or stalled request must not leave an indefinite spinner. Resource charts and
battle-score history, battle history, ship-specific drop history, and
cell-specific drop history, ship-drop map details, and in-game timeline scores
use the shared 15-second panel timeout and expose an explicit retry action.
They ignore stale responses after a newer request, selection change, retry, or
unmount. Empty timeline score data has its own terminal message instead of
retaining the loading label. Chart panels keep their render targets mounted
while initial data is loading. Worker failure and early exit reject every
pending driver request so the renderer can reach its error state. The
application-information cache-clear action uses the same bounded lifecycle:
failure or timeout re-enables the action with an explicit retry message, and
an unmounted panel ignores the stale completion.

### Fixed canvas and responsive content are mixed

The assist stylesheet contains many fixed dimensions and absolute overlays.
They fall into different migration strategies:

| Content type                 | Strategy                                        |
| ---------------------------- | ----------------------------------------------- |
| Forms, cards, summaries      | normal flow and auto-fit grid                   |
| Tables and histories         | fluid columns, minimum widths, local scrolling  |
| Charts                       | fill the panel and reflow from `ResizeObserver` |
| Maps and coordinate overlays | fixed logical canvas, scaled as one unit        |

Map coordinates must not be converted piecemeal to percentages. Scale the
logical map canvas or provide a separately designed wide layout.

### Height ownership

Only the panel body should scroll. Headers, filters, and pagination must remain
in normal flex/grid flow. Avoid nested `100vh`, hard-coded page heights, or
absolute pagination inside panel content.

### Window persistence

The separate assist window persists visibility, position, and content size.
Workspace mode persists its normal bounds, maximized state, and a versioned
layout-mode record. Restored main and assist bounds are clamped to the current
display work area, and legacy settings without these fields remain valid.
The workspace minimum width includes a 1000 px minimum game stage, one 280 px
compact assist column, and the shell padding/gap, for a 1316 × 632 logical
minimum. The game keeps its 5:3 aspect ratio and scales up to the native
1200 × 720 stage when the window reaches 1516 px wide. A Surface-class
2880 × 1920 display at 200% scaling exposes about 1440 × 960 logical pixels;
inside a 1440 × 928 work area the workspace therefore keeps one window with a
1124 × 674 game stage instead of splitting the assist UI into another window.
At the normal 1756 px baseline the assist track expands to 520 px. Narrow-mode
page controls reduce their padding and reserve less width for the layout
button; dense content remains reachable through panel-local scrolling and
pagination. The window therefore cannot be resized to a geometry that leaves
the assist column outside the visible viewport.

Startup and layout switching use Electron's logical display work areas rather
than raw display bounds. If the requested classic 1800 × 920 combined view does
not fit but the 1316 × 632 responsive workspace does, the app selects workspace
mode automatically. If neither inline layout fits, it preserves the existing
game-only plus separate-assist fallback. Returning from workspace follows the
same policy and never creates an oversized classic window outside the work
area.

Display topology changes use the same resolver at runtime. Electron display
add/remove/metrics events are debounced, saved spanning bounds are assigned to
the display with the largest visible intersection, and the current inline
layout is retained when the new work area supports it. A compact display can
move classic combined mode to workspace; when no display supports either inline
layout, the app falls back to game-only plus a separate assist window. Moving a
window between displays preserves a valid maximized workspace and otherwise
clamps the complete window bounds inside the selected logical work area. An
already-open separate assist window is reconciled as part of the same event, so
removing its display or changing its logical work area cannot leave it
unreachable. The user's requested inline-assist preference is stored separately
from the currently effective state: a forced game-only fallback does not erase
that preference, so reconnecting a capable display restores an inline layout.
An explicit game-only preference remains game-only when display capability
returns.

Workspace panel order, span, and visibility are persisted independently from
window geometry in a versioned renderer-local record. Invalid or older records
fall back to defaults, and panels introduced by a later release are appended
automatically. The battle/history, ships/equipment, and ship-drop panels also
persist their selected internal tab for both classic assist and main workspace
windows. The classic main window's outer panel selection remains ephemeral.
The active workspace page, ship/equipment list filters, and the last submitted
battle-history query are persisted per window role because workspace page
switches unmount those dense panels. The same panel-view record retains the
selected fleet, expedition area/monthly filters, resource or consumable chart,
drop-map world and map, and selected drop ship. Heavy query results and live
game-derived values are not persisted and are refreshed when their panel
mounts. Draft battle-history inputs are not saved until the user runs the
search, so returning to the panel reproduces the query that produced the
visible results.
Responsive pagination remains ephemeral: its page size changes with panel
height, so an old page number could point at a different or missing row after a
resize. Task-guide expanded rows are also ephemeral because ranked data can
change between visits.

Ship-drop aggregation cancellation is scoped to the requesting renderer
window. Selecting another ship in one window supersedes its older request,
while a main workspace and a separately opened assist window can query without
cancelling one another.

Saved bounds must be clamped to the current display work area.

## Target shell

The game stage remains a native logical 1200 × 720 region in classic mode and
in workspace windows with sufficient width. The surrounding shell has two
compatible presentations:

1. Classic mode keeps the current 1800 × 920 layout.
2. Workspace mode fills the available frameless window, keeps the 5:3 game
   stage visible at 1000 × 600 through 1200 × 720, and presents bounded groups
   of assist panels as workspace pages.

Every assist panel is a named CSS size container. Components should use
container queries for their own breakpoints instead of global viewport media
queries.

Workspace metadata also records each panel's horizontal and vertical demand:

- `compact`: low-priority, low-density information;
- `standard`: one grid track;
- `wide`: two grid tracks for dense tables or table-and-map combinations;
- `tall`: enough vertical room for an operational view.

The registry also assigns each panel to one ordered workspace page. The shell
reads page and size metadata through data attributes; layout CSS must not infer
panel grouping from component names.

Suggested panel width bands:

- below 560 px: compact controls, reduced optional columns;
- 560–839 px: current dense layout;
- 840 px and above: expanded columns or multi-column detail.

These are component breakpoints, not application-wide breakpoints; individual
panels may refine them.

## Migration order

1. **Baseline and invariants — implemented**
   - centralize classic derived dimensions;
   - name layout surfaces and panel containers;
   - make charts observe their containers;
   - keep classic visuals unchanged.
2. **Window and panel state — implemented**
   - persist separate assist bounds; **implemented**
   - add a versioned layout-mode setting; **implemented**
   - introduce a panel registry independent of tab selection. **implemented**
3. **Responsive primitives — partially implemented**
   - shared workspace panel shell and scroll body; **implemented**
   - fluid ship, equipment, and mission table containers; **implemented**
   - fixed logical-canvas scaler for operational, drop, and battle-history
     maps; **implemented**
   - observed table-body height for ship-drop and battle-history records;
     **implemented**
   - battle-score chart reflow and container-owned vertical tracks;
     **implemented**
   - wrapped ship/expedition/battle-history toolbars and horizontally reachable
     fixed-width history tables; **implemented**
   - narrow dense-table identity columns without hiding data; **implemented**
   - component/container test fixtures at compact, baseline, and wide sizes;
     **implemented**
   - explicit timeout, failure, retry, and stale-request handling for panels
     with loading overlays; **implemented**
4. **Content migration**
   - flow content first;
   - ship/equipment/mission tables next;
   - ship-drop, battle-history, and battle-score fixed vertical stacks;
     **implemented**
   - remaining mixed panels, including the fleet/area stack; **implemented**
   - maps last, using fixed logical canvases.
5. **4K workspace — bounded default layout implemented**
   - enable the resizable/maximizable frameless workspace window;
     **implemented**
   - add a paged 4K panel arrangement based on panel information density;
     **implemented**
   - prohibit page-level workspace scrolling so the game remains visible;
     **implemented**
   - preserve a one-click return to classic mode; **implemented**
   - add user customization of panel order, visibility, and spans;
     **implemented**

The game remains a fixed 1200 × 720 region in the left column. Its lower panel
area shows full-width quest recommendations without a redundant one-item page
switcher.

The right column has three workflow pages:

- `運用`: fleet composition and expedition checks above a full-width resource
  chart switcher;
- `戦闘・装備`: battle records and ship/equipment lists;
- `ドロップ`: map and ship drop histories, with compact application
  information below the map history.

Only the active page is mounted. Each page fits the available workspace height;
panels own their local scrolling or pagination. Below 2400 px, a pair of
secondary panels stacks vertically. At wider sizes it uses two information-
density-weighted columns. The workspace shell itself never scrolls, so changing
pages cannot move the game stage out of view. At short window heights the legacy
bottom summary collapses before any part of the fixed game stage is sacrificed.

The secondary page bar includes a compact configuration editor. Users can
reorder panels, hide panels, and choose one-column or full-width spans without
moving the fixed game stage. Every panel may be hidden; an empty page keeps a
configuration entry point so panels can be restored, and an empty built-in page
may also be removed from the tab bar and restored later. A single action
restores the complete workspace to its default arrangement.

Before game data is ready, the workspace shows one shared guidance message
instead of repeating the same empty state in every panel.

Pagination policy is content-driven:

- ship and equipment lists keep pagination visible and derive their page size
  from the panel's measured table height;
- expedition checks use the same responsive page-size policy;
- quest recommendations show six ranked entries per page;
- resource and consumable charts share one panel with an internal view switch.

Fixed map coordinates stay on their original 600 × 360 logical canvas. A shared
viewport observes the containing panel, scales the map and all overlays down as
one unit when necessary, centers it when extra width is available, and does not
upscale bitmap content by default.

The fleet composition panel applies the same boundary to its two legacy
information regions: the 600 × 333 fleet table and the 600 × 660 area/enemy
stack scale independently. The panel owns any vertical overflow, so a narrow or
short secondary card never pushes the workspace page beyond the viewport.

Ship-drop and battle-history records now derive table height from their actual
grid track through `ResizeObserver`; resizing a window no longer leaves the
table at its initial height. Battle-score content uses the same height ownership:
the task summary has a bounded track while the chart takes remaining space and
reflows when its panel changes size. Legacy mixed panels that still use fixed
logical heights scroll inside the panel body until their dedicated responsive
migration is complete; their content must remain reachable rather than being
clipped.

Filter toolbars no longer assume a single 45 px row. Ship filters, expedition
area/monthly filters, and battle-history search controls wrap according to
their own panel width and contribute their measured height to the table layout.
The ship-drop and battle-history tables keep their complete fixed-width column
sets and expose local horizontal scrolling when a panel is narrower than the
table, instead of clipping the final columns.

Ship, equipment, and expedition tables also retain their complete column sets.
At panel widths up to 720 px, the ship name, equipment name, or expedition name
stays pinned to the left edge while the remaining columns scroll underneath.
This keeps each row identifiable without silently hiding statistics or pushing
horizontal overflow onto the workspace page.

## Verification matrix

At minimum, layout regression checks should cover:

| Surface                    | Viewport    |
| -------------------------- | ----------- |
| Classic combined           | 1800 × 920  |
| Separate assist baseline   | 600 × 928   |
| Separate assist medium     | 720 × 900   |
| Separate assist wide       | 960 × 900   |
| Workspace minimum          | 1316 × 632  |
| Workspace Surface 200%     | 1440 × 928  |
| Workspace native compact   | 1516 × 752  |
| Workspace baseline         | 1756 × 900  |
| Workspace Full HD          | 1920 × 1080 |
| Workspace                  | 2560 × 1440 |
| Workspace                  | 3840 × 2160 |

For every size, verify that tabs/toolbars, the last data row, pagination,
tooltips, and chart labels are reachable. Also test Windows display scaling
because Electron bounds use device-independent pixels rather than raw panel
pixels.

The workspace customization shell has browser-level production-CSS fixtures at
the 1316 × 632 minimum, 1440 × 928 Surface case, 1516 × 752 native compact
case, 1756 × 900 baseline, 1920 × 1080, 2560 × 1440, and 3840 × 2160.
Measured viewports keep the game region at its calculated 5:3 size and contain
the secondary grid, every panel, and the configuration editor inside the
visible workspace.
The operations, records, and drop pages were each checked in both stacked and
wide arrangements. Dense ship, equipment, and expedition tables were also
rendered at 600 × 928 and 960 × 900; narrow tables retained local horizontal
scrolling and sticky identity columns. This production-CSS audit was repeated
after the minimum-width correction on 2026-07-26; the only browser console
entries were fixture asset/favicon misses. Component interaction coverage also
verifies ordering, visibility, width span, active-page and dense-filter/query
persistence, invalid-state fallback, and restoring defaults.
The production CSS was also rendered with `devicePixelRatio = 2` at the
1440 × 928 Surface case, 1756 × 900 baseline, and 3840 × 2160; the game stage, panels, and
configuration editor remained inside the viewport. Source-level CSS contract
tests additionally guard the aspect-ratio-preserving game stage, page-level overflow
containment, panel-owned scrolling, narrow high-DPI controls, configuration
editor bounds, and compact-height fallbacks.

### Physical display acceptance checklist

Browser fixtures and geometry unit tests do not reproduce Windows compositor,
taskbar, mixed-DPI, or live monitor-topology behavior. Before a release that
changes window or workspace layout, run the following checks against the
packaged application and record the Windows version, GPU, display arrangement,
and scaling percentages used.

- Single 3840 × 2160 display:
  - verify workspace mode at 100%, 150%, 200%, and 250% scaling;
  - at 250%, verify the compact 1516 px logical-width layout rather than an
    oversized classic combined window;
  - maximize, restore, resize to the minimum, restart, and confirm the complete
    window returns inside the work area.
- Surface-class 2880 × 1920 display:
  - at 200% scaling, verify the logical work area remains one workspace;
  - verify the game stage is 1124 × 674 at a 1440 × 928 viewport and the
    `ドック・任務` page exposes repair docks, construction docks, and task status;
  - exercise the page tabs and dock/task rows with touch, then restart and
    confirm the same workspace mode and bounds are restored.
- Mixed-DPI displays:
  - use a 3840 × 2160 display at 150% or 200% beside a 1920 × 1080 display at
    100%;
  - repeat with the secondary display positioned left of and above the primary
    display so negative desktop coordinates are exercised;
  - move both normal and maximized workspace windows between displays and
    confirm bounds, game size, pointer hit targets, and text remain aligned.
- Live topology changes:
  - disconnect the display containing the main window and confirm the window
    is moved or clamped fully onto a remaining display;
  - reconnect the display, change the primary display, rotate a display, and
    change its scale while the app is running;
  - confirm a supported inline layout is retained, classic mode falls back to
    compact workspace when necessary, and an undersized desktop falls back to
    game-only plus a separate assist window;
  - while inline assist is selected, force that undersized fallback and then
    reconnect a capable display; confirm inline assist returns automatically.
    Repeat after explicitly selecting game-only and confirm it stays game-only.
- Workspace invariants at every tested topology:
  - the game stage remains visible at its calculated 5:3 size (native
    1200 × 720 when width permits, never below 1000 × 600 in workspace mode)
    while operations, dock/task, records, and drop pages are selected;
  - no workspace panel extends beyond the visible work area and the workspace
    page itself does not acquire a content scrollbar;
  - dense tables keep their identity column visible and expose local horizontal
    scrolling instead of clipping columns;
  - the last row, pagination, panel tabs, layout editor, tooltips, chart labels,
    and equipment icons remain reachable;
  - panel order, span, visibility, active page, internal tabs, and
    normal/maximized window state survive restart.

The checklist is a release gate, not evidence that a particular hardware
combination has already passed. Record failures with a screenshot, physical
and logical work-area sizes, `devicePixelRatio`, active layout mode, and
whether the window was maximized; that information is sufficient to reproduce
most failures in the browser fixtures or geometry tests.

Two issue-specific commands turn the reported hardware into an executable
release gate:

- `npm run smoke:accept:issue-23` requires a touch-enabled 2880 × 1920 display
  at 200% scaling with a workspace-capable logical work area.
- `npm run smoke:accept:issue-34` requires a 1920 × 1080 primary display and a
  separate 1920 × 1200 workspace-capable display.

The gate derives physical pixels from Electron's logical display bounds and
scale factor. It fails before claiming acceptance if the topology differs,
then runs the isolated production Electron matrix on every matched display.
The dock/task page is selected through a CDP touch event rather than a DOM
`.click()`, persisted, restored after a graceful restart, and followed by the
existing Ctrl+0 geometry check. The summary records the matched display IDs,
physical and logical sizes, touch support, per-display inspection, restart,
and zoom-reset evidence. PNG artifacts are written below the matching
`output/acceptance-issue-*` directory; no real account or game-server
communication is used.

### Reusable Electron smoke gate

`npm run smoke:electron` launches the already-built production bundle,
verifies the application document geometry, and closes only the process tree
that it started. Live and pre-game checks do not enable Chromium remote
debugging. Instead, an environment-gated parent/child IPC bridge evaluates the
application and game webview only inside the spawned smoke process. The
default path never clicks `GAME START`.

The IPC bridge also shows and focuses the live smoke window before interactive
work begins. Progress output distinguishes launch, DMM login, `GAME START`,
game loading, account-data readiness, and geometry inspection. `--timeout`
limits an individual readiness stage, while `--total-timeout` caps the complete
run so sequential waits cannot silently exceed the requested test budget.

The live account path requires explicit opt-in. With `--allow-game-start
--workspace-pages --task-guide --wide-workspace`, it verifies the HTTPS DMM game
page and expected 1200 × 720 frame before sending the one normal button click.
It then waits for account-scoped data, checks the fixed game stage, visits every
available secondary workspace page, and verifies that its tabs, panels, and
visible pagination remain reachable inside the viewport. The task page
additionally verifies the recurring-relation unregistered, unresolved, and
combined review filters. When the current display provides at least a 2480 ×
1150 logical work area, wide inspection checks the 1440 × 928 Surface case,
1600 × 800 compact-height boundary, 1756 × 900 baseline, 1920 × 1200 tall
layout, and then temporarily uses the complete available area. Each size checks
every available secondary page, including `ドック・任務`; sizes that expose the
primary task guide check it as well. All
inspections restore the previous workspace page, task-guide filter, window
bounds, and window state.

When coordinate-based GAME START input is unsuitable, `--manual-game-start`
keeps the same process and cleanup guarantees but waits for the user to click
the visible game button. After account data becomes ready, either live path
temporarily switches a saved classic inline-assist layout to workspace mode
before inspection. The exact pre-run settings file is restored when the
process exits. If the DMM login is stored only for the lifetime of the previous
application process, the user must log in again inside the smoke-owned window.

`npm run verify:layout` runs the complete static gate, builds the production
bundle, and then invokes `npm run smoke:layout` as the deterministic geometry
gate. The latter launches
the current production bundle with an isolated temporary Electron user-data
directory, forces workspace mode, and injects only three local readiness
responses for master, port, and equipment data. It never clicks `GAME START`,
does not use the signed-in DMM profile, and does not read or write the normal
settings or record database. The gate inspects the 1316 × 632 minimum on every
capable display, the 1440 × 928 Surface case, 1600 × 800 compact-height
boundary, 1756 × 900 baseline, 1920 × 1200 tall layout, and the complete
available work area. The temporary directory is
removed after both successful and failed runs. This deterministic gate covers
panel mounting, page selection, containment, overflow, and reachable visible
pagination. It then saves a 1440 × 928 Surface workspace with `ドック・任務`
selected through an emulated touch tap, performs a graceful application restart
in the same isolated profile, and verifies the bounds, 1124 × 674 game stage,
active dock/task page, and Ctrl+0-resistant zoom again. Normal shutdown flushes Electron DOM storage
before exiting so workspace and dense-panel state cannot race the process
termination. The live opt-in path remains the final check for data-volume
dependent behavior. This isolated fixture path alone uses a local DevTools port.

`npm run smoke:layout:capture` uses the same deterministic matrix and saves a
viewport PNG for every available page at every tested size below a
timestamped `output/layout-smoke` directory. `npm run smoke:live` applies the
same capture flow to the opt-in live account gate. These images complement
containment assertions with a compact visual-review artifact.

For iteration speed, `npm run verify:quick` prepares generated sources and
runs the parallel type-check and test gate without rebuilding the production
bundle. `npm run verify:layout` remains the milestone gate, while
`npm run smoke:live` is reserved for accepted account-data milestones.

The tool refuses to run while a project or installed KouBrowser process is
already active. It backs up `koubrowser.json`, terminates its own Electron
process tree, restores the exact settings hash, and removes the temporary
backup on every normal, failed, or interrupted exit. It does not change display
resolution or game communication semantics. Physical DPI, rotation, and
hot-plug acceptance remains a separate manual release gate.

The first automated live run exposed and corrected an early-click race: the
DMM iframe can reach 1200 × 720 before its game canvas has settled. The smoke
gate now waits for a stable frame and rechecks it immediately before the one
authorized click; it never retries the click after a readiness failure. The
final live run completed in about 36 seconds, loaded account data, selected the
task guide's recurring-relation filters, and confirmed the exact 5
unregistered, 22 unresolved, and 27 combined results against the summary.
The same compact task guide exposed the goal-number/title search while
reporting equal 289 px client and scroll widths; the 1516 × 752 document and
1200 × 720 game stage remained contained. The smoke gate then restored the
previous task filter and workspace page. Type checking, all 594 tests in 47
files, and the production bundle passed. Both the default and live smoke paths
restored the original settings hash, closed their process trees and debugging
port, and removed every temporary backup without changing the two 2560 × 1440
logical displays.

The four-page follow-up turned the former manual compact-page sweep into the
same live smoke gate. Its first run found a 25 px local horizontal overflow in
the flow-layout application-information panel even though the document and
panel shell were contained. Application controls, status text, and links now
wrap within the panel. The gate also rejects horizontal overflow in every
flow-layout panel while retaining local scrolling for table, canvas, and mixed
content. The final run inspected `運用`, `戦闘・装備`, `ドロップ`, and `任務`;
all tabs and panels were contained, the mission, ship/equipment, and task-guide
pagination controls were reachable, and the application-information body
reported equal 299 px client and scroll widths. Type checking, all 595 tests
in 47 files, the production bundle, and the live smoke passed.

Wide inspection initially exposed a maximize-transition sampling gap in the
smoke tool: one page could be measured during the temporary compact frame even
though the window subsequently reached its wide bounds. Every inspected page
now has to retain the expected document size and stable page-tab set before its
snapshot is accepted. The final size-matrix run inspected all four compact
pages at 1516 × 752, all three regular secondary pages plus the primary task
guide at 1756 × 900, and the same regular pages at 2560 × 1392 after maximizing
through the application's own window action. Every sampled page retained its
target dimensions. The game stayed 1200 × 720, the primary guide reported equal
1173 px client and scroll widths at both larger sizes, and the window returned
to 1516 × 752.

### Recorded packaged-application acceptance

The 2026-07-26 Windows run used the unpacked application from installer build
SHA-256
`8EE31A66506610393F8606B722C211A0AED1FB04A45ACE107A92E0D6778832E5`.
The environment was Windows 10.0.26200.0 with an NVIDIA GeForce RTX 4090
(driver 32.0.16.1062) and two 3840 × 2160 displays at 150% effective scaling
(`devicePixelRatio = 1.5`). Their logical bounds were 2560 × 1440 with
2560 × 1392 work areas; the secondary display was positioned to the right of
the primary display.

The following checks passed:

- the maximized workspace used the complete 2560 × 1392 logical work area,
  retained the 1200 × 720 game stage, and had no document-level horizontal or
  vertical overflow;
- after `GAME START`, the operations, records, and drop pages kept every panel
  inside the visible secondary workspace; pagination and the configuration
  editor also remained inside the viewport;
- intentional table, canvas, and application-information overflow stayed
  local to the owning panel;
- the minimum 1516 × 752 workspace retained the complete game stage and a
  316 px assist column; all three page bars, compact panel stacks, pagination,
  and the 300 × 204 configuration editor remained reachable without
  document-level scrolling;
- a normal 1516 × 752 window restored at the same size and position after
  restart; a maximized window restored to 2560 × 1392 after restart;
- a normal window moved from the primary display to the secondary display at
  `(2700, 100)`, maximized to the secondary 2560 × 1392 work area, then moved
  back and maximized on the primary display without changing DPR or losing
  bounds.

The application was closed cleanly after the run with the original maximized
primary-display preference restored. This run does not cover 100%, 200%, or
250% scaling, mixed-DPI displays, negative desktop coordinates, display
rotation, or live display disconnect/reconnect; those combinations remain
release-gate items rather than inferred passes.

An additional isolated-profile packaged run used Chromium's
`--force-device-scale-factor=2.5` on the same 3840 × 2160 display. It selected
workspace mode automatically, produced a 1536 × 836 logical work area, kept
the game region at 1200 × 720, and introduced no document-level overflow.
Because this changes Electron's reported DPR without changing the Windows
desktop setting, it is startup-resolver evidence only and does not replace the
remaining physical 250% scaling check.

Geometry tests additionally cover logical 4K work areas at 200% and 250%,
displays positioned left of and above the primary with negative coordinates,
restoring oversized windows into those work areas, and choosing a remaining
capable display when the former current display has disappeared. These tests
also cover the transient topology-update case where Electron's current display
id is no longer present in the freshly enumerated display list: the runtime now
falls back to the display with the largest bounds overlap instead of assuming
display zero. They exercise deterministic resolver and bounds-clamping
behavior; they do not replace the mixed-DPI compositor or live cable disconnect
checks above.

A follow-up installer containing the runtime topology reconciliation changes
was built with SHA-256
`6915D9ABCEDAEFF9B1C58472D695043C74D7D3D9E27B3ADE20F3EFCD433BBFC6`.
On the same 150% display setup, a packaged startup smoke test clicked the real
`GAME START` surface, waited for the placeholder to be replaced, and observed
both workspace regions, three default visible panels, and all inspected layout
bounds inside the 2560 × 1392 viewport. The application then closed cleanly
through its title-bar close action.

A later follow-up installer containing lightweight panel-view persistence and
renderer-scoped ship-drop aggregation was built with SHA-256
`87F3321FFAA51C209B8A3F2FD0C9C2D27D683EB562DFE3AFE043C37019B9C1D1`.
The packaged application was again tested only after clicking the real
`GAME START` surface and observing both workspace regions replace the waiting
state. Resource/material view, selected fleet, mission-area filter, and
drop-world selection each survived leaving and returning to their owning
workspace page. The acceptance changed every tested value, verified its
restoration after remount, then restored the user's original values.

At both 2560 × 1392 and 1516 × 752 logical viewport sizes, the operations,
records, and drop pages kept all three visible panels and inspected pagination
or tab controls inside the viewport, had no document-level overflow, and kept
the 1200 × 720 game stage visible. Resource-record loading also left the
indeterminate state and exposed a retryable error state when no records could
be loaded. The window was returned to its original maximized state and closed
cleanly after the run.

The installer rebuilt after the transient display-id reconciliation fix has
SHA-256
`0EAC42423E85E6E0DAA42373DD62611836D057287CEB864C29CB4DCFA8B03216`.
Its packaged main bundle was checked for the id-first, bounds-overlap fallback
and all three live display listeners. A smoke run then clicked the real
`GAME START` surface, observed both workspace regions replace the waiting
state, and checked the operations, records, and drop pages at 2560 × 1392.
Every page retained three visible panels inside the viewport, no document-level
overflow appeared, and the 1200 × 720 game stage remained visible. The
application was returned to the operations page and closed cleanly.

The installer rebuilt after adding bounded loading and retry handling to battle
history, ship-specific drop history, and cell-specific drop history has
SHA-256
`C97DE5C3479C7D9E20502BCC2342CED2D78FE9C08FBE18382210FB3AFD544F6E`.
The unsigned installer is 237,931,834 bytes. Its packaged renderer bundle was
checked for all three timeout paths and retryable error messages. The packaged
application was then launched on the 2560 × 1392 logical viewport and the real
`GAME START` surface was clicked before checking any assist UI. Both workspace
regions replaced the waiting state. Battle history completed without retaining
its loading overlay, and a ship-specific drop-history query settled to an
explicit result state instead of spinning indefinitely. The operations,
records, and drop pages each retained the visible 1200 × 720 game stage and had
no document-level horizontal or vertical overflow. The original persisted
panel state was restored before the application was closed through its
title-bar close action.

A further installer centralizing the renderer panel timeout and extending the
same lifecycle to ship-drop map details and in-game timeline scores has SHA-256
`07712307794CDA692CE9D02BC5FD30E49DEAA3EEF01B830CFCF5B1D9E11169ED`.
The unsigned installer is 237,930,213 bytes. Type checking and all 523 tests in
38 files passed. The packaged renderer was checked for the shared timeout,
detail retry message, timeline empty state, and timeline error state. The
packaged application was then launched on the 2560 × 1392 logical viewport and
the real `GAME START` surface was clicked before opening the timeline. Its
current-month score query settled and displayed the chart without retaining
the loading label. The local packaged-test profile had no drop records, so the
ship-drop map-detail data path was covered by component tests for success,
database failure and retry, and stalled map information rather than fabricated
runtime data. The operations, records, and drop pages still kept the
1200 × 720 game stage visible and introduced no document-level overflow. The
original panel and UI state were restored before the application was closed
through its title-bar action.

The installer rebuilt after separating the requested inline-assist preference
from the display-restricted effective state has SHA-256
`386D46DD1BB125650CFBF02E5F63228EC9B8D813394581B6E6EC417317865A1E`.
The unsigned installer is 237,931,535 bytes. Type checking and all 526 tests in
39 files passed. Resolver tests cover forced game-only fallback, recovery when
a capable display returns, preservation of an explicit game-only preference,
removed-display recovery, and mixed-DPI logical work areas. The packaged main
bundle was checked for the requested/effective state separation and all three
live display listeners.

The packaged application was launched on the 2560 × 1392 logical viewport at
`devicePixelRatio = 1.5`. The real `GAME START` surface was clicked before any
assist UI was inspected. The operations, records, and drop pages each retained
the 1200 × 720 game stage, kept every visible panel inside the viewport, and
introduced no document-level horizontal or vertical overflow. The original
renderer-local state was restored, the operations page was selected, and the
application closed cleanly through its title-bar action. Live cable
disconnect/reconnect, rotation, and mixed-DPI compositor behavior remain the
physical acceptance gate described above; deterministic resolver coverage is
not recorded as a substitute for those checks.

The follow-up loading-lifecycle audit found one remaining user-visible
unbounded action in the application-information panel: cache clearing handled
success only. It now uses the shared 15-second timeout, exposes a retryable
failure message, re-enables the action after failure, and ignores a completion
after unmount. The same audit corrected the title-bar daily-score guard to read
the Vue ref value rather than treating the ref object itself as the loaded
state. Type checking and all 529 tests in 39 files passed.

The resulting unsigned installer is 237,930,134 bytes with SHA-256
`B533F9BBECC0D31035BAE87B3F477E3A2261D30D2C548C739D624A34CDAD1C60`.
Its packaged renderer contains the timeout and retry message. A packaged smoke
run clicked the real `GAME START` surface before navigating to the drop page,
confirmed that the application-information panel and cache action were
reachable, retained the 1200 × 720 game stage, kept all visible panels inside
the 2560 × 1392 logical viewport, and had no document-level overflow. The cache
action itself was not invoked because clearing the user's live browser session
would be a destructive acceptance step; its success, failure, timeout, and
retry transitions are covered by component tests. Renderer-local state was
restored before the application closed through its title-bar action.

The title-bar daily-score baseline query was subsequently moved behind the
same bounded renderer-loading contract. The controller now shares one pending
database request between concurrent callers, falls back to the current score
when the day has no earlier port record, permits an explicit retry after
failure or timeout, and ignores late completion after disposal. Type checking
and all 537 tests in 40 files passed, including the 02:00 boundary, empty data,
database failure, timeout, single-flight, retry, and disposal cases.

The resulting unsigned installer is 237,931,137 bytes with SHA-256
`BEEC46B87F1A69CA2C2627406D59AC755B8C4B97428F48B124E5A1153CA63442`.
Its packaged renderer contains the bounded daily-score timeout path. During
the packaged acceptance run, the assist workspace was intentionally inspected
before `GAME START` and confirmed absent. The real `GAME START` surface was
then clicked; both assist workspace regions appeared, the title-bar score
settled from `--` to `0`, and the game stage measured 1200 × 720. At the
2560 × 1392 logical viewport with `devicePixelRatio = 1.5`, the document
retained matching client and scroll dimensions, so no document-level
horizontal or vertical overflow was introduced. Renderer-local state was
restored before the application closed through its title-bar action, leaving
no packaged application process running.

The compact-height acceptance audit found one remaining reachability gap. At a
1516 × 752 logical viewport the fixed 1200 × 720 game stage correctly occupied
the full left side, but the primary workspace had to be removed and there was
no remaining route to the task guide. The secondary workspace now exposes a
compact-height-only `任務` page. It reuses the task-guide panel definition,
unmounts the hidden primary instance instead of keeping duplicate live
components, fills the available secondary page height with a single row, and
does not persist its transient selection. When the viewport grows beyond the
compact-height breakpoint, the temporary page disappears and the previously
selected regular secondary page is restored.

Type checking and all 540 tests in 40 files passed after this change. Coverage
includes compact-page visibility, transient selection and restoration,
primary task-guide unmount/remount behavior, legacy workspace-state migration,
panel-definition reuse, and the single-column/single-row CSS contract.

The resulting unsigned installer is 237,933,688 bytes with SHA-256
`D618FD14A95DEA2D41168111EC0184CDD35BB2613449577F54656DA14A8C9725`.
The packaged application was launched at a 2560 × 1392 logical viewport with
`devicePixelRatio = 1.5`. The real `GAME START` surface was visibly confirmed
and clicked before any assist UI was accepted. At 1516 × 752 the document
retained matching client and scroll dimensions, the game stage measured
1200 × 720, the primary workspace was absent, and the compact `任務` page
filled the 316 × 684 secondary page grid with its task guide. At 1756 × 900
the compact page disappeared, the regular `運用` page was restored, and the
primary task guide remounted below the unchanged 1200 × 720 game stage.
Maximizing again to 2560 × 1392 retained the three regular secondary pages and
introduced no document-level overflow. All renderer-local state touched by
the acceptance run was restored before the application closed through its
title-bar action, leaving no packaged application process running.

The subsequent all-page compact matrix exposed a narrower control-level defect:
the map-drop world tab list was about 591 px wide inside a 299 px tab viewport,
while the tab navigation still inherited `overflow-x: hidden`. Only the first
worlds were reachable even though the surrounding workspace panel was correctly
bounded. The workspace-specific map-drop tab navigation now owns a thin local
horizontal scrollbar. It does not change the classic surface, the fixed game
stage, or document scrolling.

The final packaged acceptance again waited for and clicked the real
`GAME START` surface. At 1516 × 752, all four compact secondary pages
(`運用`, `戦闘・装備`, `ドロップ`, and `任務`) retained every panel and
visible pagination control inside the viewport with no loading overlay or
document-level overflow. The map-drop world navigation reported a 292 px local
scroll range; after scrolling to the end, the `6: 中部海域` tab was fully
visible and could be selected. The game stage remained 1200 × 720.

At 2560 × 1392, all three regular secondary pages retained every panel and
visible paginator inside the viewport. The primary task guide remained mounted
below the game, and the 440 × 230 layout editor stayed within the secondary
workspace. Client and scroll dimensions matched at both viewport sizes. Type
checking during the Windows build and all 540 tests in 40 files passed. The
resulting unsigned installer is 237,931,634 bytes with SHA-256
`1463016340D74EA4B245ADD7061CDEAB16E098BED75444D3E3C17094D58FE2D6`.
Renderer-local state was restored and the packaged application left no running
process.

The compact interactive-control audit then found two related filter-toolbar
failures. `BattleHistory`, `ShipList`, and `MissionCheck` used Buefy's
unrecognized `multiline` attribute, so the rendered grouped field never gained
its wrapping class. At 1516 × 752 the battle-history grid therefore expanded
its implicit column from 284 px to 587 px before the panel clipped it, and the
ship keyword field and clear action were also pushed beyond the narrow panel.
The fields now use `group-multiline`, their rendered field body and grouped
field explicitly allow shrinking and wrapping, and the battle-history grid
uses a `minmax(0, 1fr)` column.

The packaged acceptance visibly confirmed the real `GAME START` surface in the
game WebContents and clicked it before inspecting the assist UI. At the
1516 × 752 logical viewport with `devicePixelRatio = 1.5`, the
battle-history root reported matching 284 px client and scroll widths and a
284 px grid track. Its area selectors, date range, search action, clear action,
and cell-status action all stayed inside the panel. The ship and mission
filter fields rendered `is-grouped-multiline`, reported matching client and
scroll widths, and kept every visible input and action inside their 299 px
panels. The document had no horizontal or vertical overflow. Maximizing to
2560 × 1392 retained matching document client and scroll dimensions and kept
the game and both workspace regions visible.

Type checking, the Windows build, and all 541 tests in 40 files passed. The
resulting unsigned installer is 237,935,133 bytes with SHA-256
`EABE1995D9C772EC2068A1A062069B14CC0E9261946292C0094A3186F2678DAE`.
Renderer-local state and the restored window size were returned to their
pre-acceptance values before the application closed, leaving no packaged
application process running.

The next compact-height pass found that wrapping alone was insufficient for
the mission panel. At 1516 × 752, the wrapped mission filters consumed almost
the entire 216 px panel height. The result table was reduced to 14 px and its
pagination was rendered below the panel's clipped boundary. The compact
mission panel now presents two mutually exclusive views: the default result
view retains the mission rows and pagination, while `絞り込み条件` opens a
locally scrollable filter editor. `遠征一覧に戻る` returns to the results.
This keeps both modes reachable without introducing document scrolling or
allowing the panel to grow beyond its workspace cell.

Packaged acceptance again required the real game flow: the `GAME START`
surface was visibly confirmed in the game WebContents and clicked before the
assist workspace was inspected. At 1516 × 752 with
`devicePixelRatio = 1.5`, the collapsed mission view retained its pagination
inside the panel. The expanded filter view exposed all eight checkbox inputs,
used only local vertical scrolling, and hid the result table. All four compact
secondary pages retained their panels and controls inside the viewport, the
document reported no horizontal or vertical overflow, and the game stage
remained 1200 × 720.

The same packaged process was resized through 1600 × 800, 1756 × 900,
2048 × 1100, 2304 × 1296, and 2560 × 1392. Every regular secondary page
retained its panels, visible controls, and mission pagination inside the
viewport with no document-level overflow. The primary workspace appeared at
the non-compact heights and remained absent at 752 px as designed. A
Highcharts one-pixel select located far above the viewport was verified as its
intentional hidden accessibility/range-selector proxy rather than a layout
overflow.

Type checking, the Windows build, and all 542 tests in 40 files passed. The
resulting unsigned installer is 237,934,604 bytes with SHA-256
`1B20B636008C91B4B12CB55953396B0C6354E9F9109F7425F7BF8D6A09CE8A2E`.
The acceptance run restored the renderer-local state and original window
geometry before closing through the title-bar action, leaving no packaged
application process running.

Physical-display acceptance used the two attached 3840 × 2160 landscape
displays, both configured at 150% Windows scaling and therefore exposing
2560 × 1392 logical work areas. Moving the 1516 × 752 application window from
the primary display to the secondary display exposed one additional compact
layout defect: the task guide's 289 px viewport had a 408 px grid track, so
task cards and their Wiki/evidence actions required horizontal scrolling. The
grid track inherited the cards' min-content width even though the surrounding
workspace panel itself remained bounded.

The task guide now hides horizontal overflow, defines its list track as
`minmax(0, 1fr)`, and allows each task card to shrink. In the rebuilt packaged
application, the real `GAME START` surface was visibly confirmed and clicked
before validation. On the secondary display, both the task guide and its list
reported equal 289 px client and scroll widths; the visible Wiki/evidence
actions remained inside the panel. Moving the same running window back to the
primary display preserved those measurements, the fixed game stage remained
1200 × 720, the mission pagination remained inside its panel, and neither
display introduced document-level overflow.

Both physical displays currently use the same DPI and orientation, so this
pass validates cross-display movement but not mixed-DPI, portrait rotation, or
hot-plug transitions. Type checking, the Windows build, and all 543 tests in
40 files passed. The resulting unsigned installer is 237,933,498 bytes with
SHA-256
`4CBB803BA1FBE582AEF800E326D2E4B1D5B4CFB001AF6A72DE7B5FE249A77FE9`.
Renderer-local state and the original primary-display window geometry were
restored before the application closed, leaving no packaged application
process running.

The display-topology orchestration audit found a recovery defect that was not
visible on the two same-DPI physical displays. If a small display had forced a
classic combined window into game-only mode with a separate assist window,
adding a classic-capable display produced the correct resolver result but the
show-assist handler still evaluated the small current display. It could
therefore switch to workspace mode instead of restoring classic assist on the
resolved display.

Topology reconciliation now passes its selected display into the classic
assist restore path. The current display remains preferred when it already
supports classic assist; otherwise only the explicit reconciliation target is
used. A normal user-triggered show action still stays on the current display
and may use the existing workspace fallback, so it does not silently move the
window to another monitor.

Deterministic coverage now includes current-display removal, mixed logical DPI
work areas, rotation from a 4K landscape work area to a 4K portrait work area,
portrait-only fallback to game-only plus a separate assist window, and
recovery onto an explicitly selected classic-capable display. Type checking,
the Windows build, and all 547 tests in 40 files passed.

The rebuilt packaged application was started from `win-unpacked`; the real
`GAME START` surface was visibly confirmed and clicked before inspecting the
assist UI. At the 1516 × 752 logical viewport with
`devicePixelRatio = 1.5`, the loaded application retained a 1200 × 720 game
stage and a 316 × 720 secondary workspace with no document-level horizontal
or vertical overflow. Renderer-local state was restored before closing through
the title-bar action, leaving no packaged application process running.

The resulting unsigned installer is 237,934,143 bytes with SHA-256
`AA415D6ABC92D469A6BF32089890973AC212BAF79201C36EDDBB3940707B4614`.
Physical mixed-DPI, portrait rotation, and display hot-plug acceptance still
requires a controlled desktop reconfiguration; the current attached displays
remain matching 150% landscape panels.

A follow-up startup audit found a separate mixed-DPI restore defect. The
initial layout resolver could correctly determine that classic combined mode
was available on one display while the saved classic bounds were restored on a
different display whose logical work area had become too small after a scale
change. Because the classic window uses a fixed 1800 × 920 content size, the
restored position could leave part of the window outside that smaller work
area.

Inline startup placement now prefers the display associated with restored
bounds only when that display still satisfies the selected layout's logical
minimum. Otherwise it selects a capable display and places the classic window
in its center. Compact workspace mode can still remain on the restored
high-DPI display when its smaller minimum fits, and explicit game-only mode
continues to restore independently of inline-layout requirements.

Topology policy tests also exercise the cross-product of classic/workspace
mode, requested assist visibility, valid and stale current-display indices,
empty topology, small/compact/full logical work areas, portrait work areas,
and mixed-display sets. Every inline result must identify a work area that
actually supports its resolved mode; restricted and explicit game-only
results must never expose an inline target.

Type checking, all 550 tests in 40 files, and the Windows build passed. The
rebuilt packaged application initially encountered the external DMM
`Now loading...` surface; after one normal page reload the real active
`GAME START` surface was visibly confirmed and clicked. The loaded UI retained
the 1200 × 720 game stage and 316 × 720 secondary workspace at a
1516 × 752 logical viewport with `devicePixelRatio = 1.5`, and reported no
document-level horizontal or vertical overflow. Renderer-local state was
restored before closing through the title-bar action.

The resulting unsigned installer is 237,933,461 bytes with SHA-256
`AB126F9FB685643C35232BD8C2D198A3D7B5F19243038D170CD27B4DED1635E7`.

Controlled physical-display acceptance then exercised the remaining topology
matrix on the two attached 3840 × 2160 displays. The packaged application was
started from `win-unpacked`, the real `GAME START` surface was visibly
confirmed and clicked, and the loaded game and assist UI remained in the same
process throughout the tests.

Changing the secondary display from 150% to 250% scaling exposed one final
runtime defect. Moving the existing 1516 × 752 logical window onto that display
preserved its physical rectangle, so Electron reported a 2527 × 1254 logical
window on a 1536 × 816 logical work area. Display topology and scale events
were already reconciled, but an ordinary cross-display window move did not
produce either event. The main window now schedules the same debounced display
reconciliation after `move`, allowing the target display's final scale factor
and logical work area to settle before the layout is resolved.

With that change in the rebuilt package, the same 250% secondary display
reported a 1536 × 816 window, `devicePixelRatio = 2.5`, a 1200 × 720 game
stage, a 300 × 760 secondary workspace, and zero document-level horizontal or
vertical overflow. The secondary display was then restored to 150% scaling.

Rotating the secondary display to portrait produced a 2160 × 3840 physical
work area that could not contain the selected inline layout. Attempting to move
the application onto it correctly returned the 1516 × 752 window to the
capable landscape primary display, preserving a 1200 × 720 game stage, a
316 × 720 workspace, and zero overflow. The display was immediately restored
to landscape. Temporarily switching to a single-display topology and extending
the desktop again likewise preserved the loaded UI and its geometry without
overflow or a stale loading overlay.

After topology testing, the compact 1516 × 752 workspace retained all panels
and its visible pagination controls on `運用`, `戦闘・装備`, `ドロップ`, and
`任務`. At 2560 × 1392, the three regular secondary pages retained every panel
inside the viewport while the task guide stayed visible below the game. The
resource chart's failed database request resolved to its explicit retryable
error state rather than an indefinite spinner.

The application was returned to its original 1516 × 752 position and
`運用` page. Both displays were restored and verified against the pre-test
snapshot: the primary is 3840 × 2160 at 240 Hz and the secondary is
3840 × 2160 at 165 Hz, both landscape at 150% scaling, with the secondary to
the right of the primary. The DPI registry values and key set also match the
snapshot.

Type checking, all 550 tests in 40 files, and the Windows build passed. The
resulting unsigned installer is 237,933,021 bytes with SHA-256
`2A0C59E14A05EBA6D2FA80F7BF05EFB91150F5B8DDDFB2764BDB255EB48111AB`.

### Account-scoped resource-chart startup

A later production-flow acceptance found that the resource chart could mount
before `GAME START` and invoke the main-process aggregation before the current
account's NeDB files had been initialized. The request correctly left the
spinner through the existing error state, but it remained there after the game
became ready unless the user retried it manually.

The renderer now keeps the chart in a stable pre-game waiting state and starts
the request when ship data becomes available. Application readiness also
requires account-scoped ship data, so every panel that depends on the record
database remains unmounted until the `require_info` flow has created the
current account's recorder. The main process independently waits for the
record database initialization promise before dispatching the aggregation, so
renderer timing cannot reintroduce the race.

Database initialization now joins duplicate in-flight requests, reports load
errors instead of replying with a false success, and permits a later retry
after a transient failure. A terminated Worker rejects new requests
immediately instead of leaving them pending indefinitely.

Type checking, all 585 tests in 46 files, and the production application build
passed. Runtime acceptance confirmed that no account panel mounted before the
real `GAME START`, then clicked it and confirmed that the workspace replaced
the waiting state, both Highcharts instances loaded automatically, and neither
the resource panel nor the document overflowed. The application log contained
no database-not-initialized, initialization, resource-chart IPC, or Worker
error. The test application and debugging endpoints were closed without
changing display resolution.

### Game-only and separate-assist geometry audit

A follow-up window-foundation review found that game-only sizing was not using
one consistent work-area rule. Startup in the restricted separate-window mode
subtracted the assist width but did not cap the resulting game window by the
available height. Restored game-only bounds and a later manual resize could
likewise keep a width whose aspect-ratio height no longer fit after a display
change.

Game-only startup, restore, mode switching, topology reconciliation, and manual
resize now use one pure logical-work-area calculation. It preserves the fixed
game-stage aspect ratio, includes the custom title bar in the returned height,
caps the requested minimum on exceptionally small displays, and updates the
persisted game-only size after a user resize. The separate assist window also
schedules the same debounced reconciliation after an ordinary cross-display
move, covering the mixed-DPI move case that does not emit a display-topology
event.

Type checking, all 587 tests in 46 files, and the production application bundle
passed. A real Electron run refreshed the external DMM entry page, visibly
confirmed and clicked `GAME START`, then changed workspace to classic and
game-only modes. Forcing the game-only window toward a 2500 × 700 rectangle on
the 2560 × 1392 logical work area produced a bounded 2266-pixel-wide,
aspect-ratio-preserving window with no document overflow. Forcing the separate
assist window to `(-500, -500, 3000, 1600)` triggered its move reconciliation
and clamped the outer bounds to `(0, 0, 2560, 1392)`, also with no document
overflow. The original 1516 × 752 workspace, application settings, 3840 × 2160
display resolution, and closed debugging ports were all restored after the
run.

### High-DPI split-window and zoom-reset regression

GitHub issue #34 reports v1.0.5 separating the game and assist windows on a
Windows 11 system with 1920 × 1080 and 1920 × 1200 displays, followed by the
game becoming larger after the browser zoom-reset shortcut. The attached
screenshot shows the legacy restricted layout with a scaled game-only window
and a separate assist window.

At 125% Windows scaling, representative logical work areas of 1536 × 824 and
1536 × 920 cannot contain the legacy 1800 × 920 combined surface, but both can
contain the 1516 × 752 compact workspace. Startup and live display
reconciliation tests now explicitly require that topology to stay in one
workspace instead of entering the restricted two-window fallback.

Electron's existing shortcut helper blocked zoom in and zoom out but not
`Ctrl+0`, and it only covered BrowserWindow contents. All application
WebContents, including the game webview, now reject keyboard zoom
in/out/reset, mouse-wheel zoom requests, and visual pinch zoom. A rejected
request restores the application-owned factor: 1 for application surfaces and
the calculated game-only factor for the game webview. This keeps the visible
game geometry and screenshot calculations synchronized.

The zoom smoke now waits for the asynchronous classic-to-game-only resize to
finish before applying its test sizes. It deliberately requests five outer
window rectangles from 900 pixels through 1200 pixels wide and back, with four
heights that do not match the required game aspect ratio. Every step must settle
at the width-derived 5:3 game size without document overflow; the sequence ends
at exactly 900 × 540 and factor 0.75 before checking that both `Ctrl+0` and
`Ctrl++` preserve that geometry. This closes both the manual-resize coverage gap
and a timing gap where the old check could report a preserved factor while
briefly observing the preceding 1800 × 888 combined-window geometry.

For final hardware acceptance, `smoke:accept:issue-34` additionally refuses to
run as a passing gate unless Electron reports a physical 1920 × 1080 primary
display and a distinct 1920 × 1200 display. It then requires both display IDs
to appear in the per-display workspace inspections and requires the
touch-selected dock/task page, window bounds, and application-owned game zoom
to survive the isolated-profile restart. A trial on the development machine's
two 3840 × 2160 displays at 150% was correctly rejected, demonstrating that
representative dual-display evidence cannot be mislabeled as the reported
hardware acceptance.

### Continuous workspace resize regression

The original size-matrix smoke verified several settled endpoints but did not
exercise a grow-and-shrink sequence comparable to dragging an ordinary window.
That left issue #4's automatic placement behavior dependent on manual
observation between the endpoints.

The layout smoke now resizes one production Electron workspace through eleven
steps: 1316 × 632, intermediate compact sizes, the 1440 × 928 Surface case,
the native 1200 × 720 game threshold, the 1756 × 900 baseline, and then back
down to 1316 × 632. At every step it waits for the outer window and renderer to
settle, recomputes the expected 5:3 game geometry, and rejects document
overflow, a game region outside its primary track, a shifted game anchor, or
overlap between the game and secondary-assist tracks.

The 150% dual-display Electron fixture completed all eleven steps in both
directions. The game changed from 1000 × 600 through 1064 × 638 and
1124 × 674 to 1200 × 720, then returned through the same responsive sizes
without document scrolling or track overlap. Static page-size, per-display,
wide-workspace, and restart checks continued to pass in the same run.

### Mute state reload regression

Issue #13 also reports that reloading the browser clears mute. Unit coverage
already verifies persisted settings, but that does not prove the renderer-side
state transfer or the webview's `setAudioMuted` application after a real app
reload.

The layout fixture now starts from its isolated unmuted state, activates the
title-bar mute control, verifies the game webview itself is muted, and reloads
the whole application renderer. It requires a new `performance.timeOrigin`,
the rebuilt workspace to become ready, and the recreated webview to remain
muted before restoring the original unmuted state. This path uses production
main/preload/renderer behavior, but no game account, saved user profile, or
server communication.

### Near-limit titlebar capacity regression

Issue #13 asks for the ship and equipment totals to remain understandable near
the home-port limits. The isolated layout fixture now replays production
`basic`, `port`, and `require_info` parser paths with seven ships in a capacity
of twelve and nineteen API equipment items against an API limit of twenty.
One combat-ration item is intentionally excluded by the production title-bar
counter, while the existing three-item equipment buffer produces visible
values of `7/12` and `18/23`, both with five slots remaining.

After the application-renderer reload used by the mute regression, the
production Electron smoke requires both values, their danger classes, complete
Japanese tooltip and accessible-label explanations, and no clipped text. At
the 1316-pixel minimum workspace it also verifies that the material region,
both capacity indicators, and the right-side window controls remain contained
and non-overlapping. The fixture is gated by the explicit layout-smoke
environment and never observes or changes a real account or game request.

### Seven-ship transport regression

Issue #31 reports that an assault fleet's seventh ship was omitted from the
displayed transport points. The isolated layout fixture now sends production
`start2`, `port`, `require_info`, and `mapinfo` responses for a seven-ship
transport fleet. The first six ships contribute 123 TP and the seventh
contributes 16 TP, so the same production `SvData` parser and `DeckPort`
calculation must produce 139 TP for S rank and 97 TP for A rank.

The production Electron smoke opens the operations page and requires the
visible value `139/97`, the exact ship IDs 1 through 7, and containment of the
seventh ship inside the first fleet viewport. This closes the gap left by the
unit and component tests: the parser, renderer state transfer, full fleet
iteration, transport-gauge condition, and final visible layout are exercised
together without a real account or game-server communication.

### Screenshot completion notification regression

Issue #21 requires screenshot completion to be visible and identify the file
that was actually saved. A component test covers the notice semantics, but on
its own cannot prove the full webview capture, renderer-to-main IPC, local file
write, and returned filename path.

The production Electron layout smoke now activates the application's own
title-bar screenshot control. Under the isolated fixture profile it records the
capture directory before the click, waits for the polite success status, and
extracts its timestamped filename. It then requires exactly that newly added
file to have a valid PNG signature, positive dimensions, and the same aspect
ratio as the displayed game stage. On the 150% test display, the 1000 × 600
logical game stage produced a 1500 × 900 PNG and the notice named the same
file. The temporary profile and captured file are removed during smoke cleanup,
so this regression does not read or modify a real account, game request, or
user capture directory.

### Custom capture directory and game recording regression

Issue #17 asks for both screenshots and recordings to honor a user-selected
save directory, and separately asks for a game-only recording choice. The
layout fixture now writes the same persisted `option.json` shape used by the
option window before Electron starts. It selects an isolated custom directory
outside the default `koubrowser/capture` directory and chooses the `game`
recording target.

The screenshot regression requires its PNG to appear only in that custom
directory. The recording regression then uses the application title-bar
control to start and stop a real `MediaRecorder` session. It requires the
resolved source to be the game webview's 1200 × 720 tab source, observes the
recording button and success notices through both states, waits for the file to
finish writing, and verifies the WebM EBML signature. The same run separately
opens both window and game sources and requires live audio and video tracks.
Neither the PNG nor WebM may appear in the default directory. All output lives
under the temporary smoke profile and is deleted after the run.

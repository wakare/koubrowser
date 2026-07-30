# Quest guide architecture

## Product boundary

The quest guide observes local game data and presents planning information. It
must not alter game requests, responses, quest state, or communication
semantics.

External reference actions cross the renderer-to-main boundary only through
validated IPC. The main process accepts requests only from the current main or
assist window, and only opens HTTPS URLs whose host is on the explicit
application allowlist. Other schemes, unlisted hosts, embedded credentials, and
explicit ports are rejected.

The first release is a ranked recommendation list. The second phase introduces
a knowledge layer so that current game facts, bundled definitions, local
observations, and external references are not presented as equivalent claims.

## Evidence model

Every knowledge statement records a source and confidence:

| Source                                      | Confidence     | Meaning                                                      |
| ------------------------------------------- | -------------- | ------------------------------------------------------------ |
| Current game quest list                     | `verified`     | Current title, state, description, and base rewards          |
| Saved game quest cache                      | `supported`    | Previously observed game data that may now be stale          |
| Bundled quest definition                    | `supported`    | Locally implemented progress, map, fleet, or equipment logic |
| Local transition observation                | `observed`     | A possible relationship inferred from quest-list changes     |
| Reviewed Japanese and Chinese Wiki relation | `supported`    | Structured only after both references agree                  |
| Other Japanese or Chinese Wiki content      | Reference only | Search link; not imported as structured evidence             |

Local observations must always state that they are not official unlock
conditions. Wiki search links must not be treated as verified structured data.
Reviewed relations retain field-level provenance, verification date, and source
page version. Conflicting prerequisite claims are shown to the user and excluded
from automatic reasoning.

Limited-time status and limited-time deadlines are separate claims. A live game
quest title that explicitly says `期間限定` or `限定任務` verifies that the quest
is limited, while a cached title is supported evidence only. Seasonal wording
and legacy special-quest ids remain candidates. None of these sources imply an
end time. An automatic countdown is created only from a reviewed game notice or
official announcement with an unambiguous ISO timestamp. Relative wording such
as "next maintenance" may confirm limited-time status but must not populate
`endsAt`. Invalid or missing timestamps never affect deadline urgency.

Wiki quest codes identify rows in each Wiki and are used to compare prerequisite
relationships by title. Game API quest numbers are mapped separately against
observed API data and the bundled quest registry. Working or practice Wiki ID
tables are not treated as authoritative API-number sources; a disagreement in
such a table must not overwrite an otherwise consistent local API mapping.

## Phase plan

1. **Recommendation baseline — implemented**
   - rank current quests;
   - explain score reasons and cautions;
   - switch between Japanese and Chinese Wiki references;
   - learn possible local transitions;
   - keep the high-volume recommendation list bounded to six cards per page;
   - filter without changing recommendation order by current status, local
     readiness, attention needed, or limited-time status;
   - search the current recommendation set by quest number, title, or
     description, and reset pagination whenever the view changes.
2. **Evidence-aware knowledge — first slice implemented**
   - normalize evidence source and confidence;
   - expose bundled task type, completion units, target maps, and condition
     checks;
   - show an expandable evidence view for each recommendation;
   - keep Wiki references explicitly unstructured.
3. **Curated quest graph — recurring quest foundation implemented**
   - represent reviewed AND/OR prerequisites and derive downstream edges;
   - store per-field provenance and last-verified version;
   - detect conflicts between sources without silently choosing one;
   - reviewed coverage includes daily, weekly, all monthly sortie targets, and
     selected quarterly sortie chains; only relationships verified by both
     Japanese Wiki and Chinese KCWiki enter automatic reasoning;
   - monthly sortie coverage includes Bm1–Bm8. Bm3 is retained as unresolved
     evidence because both sources still indicate a possible unidentified
     one-time prerequisite in addition to Bw4, so it stays out of the automatic
     graph;
   - reviewed monthly non-sortie coverage includes the confirmed
     A19 + Bm6 → Fm1 and B54 + Bw5 → Fm3 factory relationships;
   - Cm1, Cm2, Dm1, and Fm2 are retained as explicit monthly review conflicts:
     the Japanese practice or expedition pages list confirmed known
     prerequisites while KCWiki still marks a possible additional prerequisite,
     and the Japanese factory page still marks part of Fm2 for confirmation;
   - reviewed quarterly coverage includes B91 + Bw2 → Bq2 → Bq10,
     Bq5 + A83 → Bq6, B41 + Bw9 → Bq7, and B141 → Bq13;
   - reviewed quarterly expedition coverage includes Dq1 + D25 → Dq2;
   - Cq1–Cq4 quarterly practice relationships are retained as explicit source
     conflicts and excluded from automatic reasoning: the Japanese source
     still marks B9 for Cq1 and A72 for Cq3 as tentative, leaves an additional
     Cq2 prerequisite unidentified, and lists C5 + A69 for Cq4 while KCWiki
     lists only C5;
   - reviewed quarterly factory coverage includes F38 + Dw2 → Fq2,
     D23 → Fq3, F16 + Fd8 → Fq4, and F71 + Fd1 → Fq6;
   - Fq1 is retained as unresolved evidence: both sources list B9 as a
     prerequisite candidate, but both still mark the relationship as under
     review;
   - reviewed yearly factory coverage includes F50 + F96 → Fy5;
   - Japanese provenance links point to the matching sortie, practice, or
     expedition/factory task page instead of using the sortie page for every
     category;
   - Bq11 is retained as an explicit source review conflict and stays out of
     automatic reasoning: both sources list Bm8 + Cd1, while Chinese KCWiki
     also marks Bw10 as a possible prerequisite under verification;
   - the first reviewed yearly branch covers the confirmed June By6 → By7/By8
     and By8 + B134 → By9 relationships;
   - the reviewed yearly graph also covers the confirmed September
     B138 + B155 → By5 relationship;
   - reviewed yearly non-sortie coverage includes C46 → Cy6,
     D30 → Dy2, and D31 + Dy5 → Dy6;
   - the reviewed one-time foundation covers the confirmed early sortie chain
     B1 → B2 → B4 → B5 → B6 → B7 → B8 → B9 and the reviewed formation-to-sortie
     edges for B3, B10, B11, B13–B26, and B28–B29;
   - the reviewed one-time graph also includes the cross-type D10 → B23 and
     A34 → B24 → B27 chains;
   - reviewed coverage extends through B57 for B30, B31, B33–B47, B50–B55,
     and B57, including the B37 + Bm1 → B38, A52 + Bw9 → B44,
     A53 + B42 → B45, and A65 + Bm5 → B57 AND relationships;
   - reviewed one-time coverage now also includes B65, B66, and B68–B73,
     including the B64 + B20 → B65, B65 + B59 → B66,
     B68 + F33 → B69, and A66 + Bw5 → B72 AND relationships;
   - reviewed one-time coverage now extends to B84, B85, B90–B92, and B95,
     including the B73 + B81 → B90, B69 + Bd5 → B91, and
     B87 + B50 → B95 AND relationships;
   - the B101–B120 review adds B105, B109, B112, B115, and B116,
     including A80 + Bd2 → B105, A81 + D27 → B109,
     A84 + B103 → B112, C18 + Fq6 → B115, and
     A87 + Bd8 → B116 AND relationships;
   - the B121–B140 review adds B133 through the confirmed
     B128 + Cd1 → B133 AND relationship;
   - the B141–B160 review adds B141 and B156, including the confirmed
     B140 → B141 and B17 + B135 → B156 relationships;
   - the B161–B180 review adds B163, B165, B169, B170, B172–B173, and
     B176–B178, including B124 + B125 → B163, B124 + B135 → B165,
     B47 + D19 → B169, B151 + B159 → B170, B135 → B172,
     B136 + B172 → B173, B175 → B176 → B177, and
     B90 + B176 → B178 relationships;
   - the B181–B200 review adds B190, B194, and B198, including
     B133 → B190, B59 + B179 → B194, and B128 + B197 → B198
     relationships;
   - the B201–B216 review adds B210 through the confirmed
     F33 + B159 → B210 relationship;
   - B12, B32, B48, B49, B56, B58–B64, B67, B74–B83, B86–B89, B93–B94,
     B96–B104, B106–B108, B110–B111, B113–B114, B117–B132, and B134–B140
     as well as B142–B155 and B157–B160 remain excluded because additional
     prerequisites are still marked as disputed, under verification, or
     inconsistent between the reviewed sources;
   - B161–B162, B164, B166–B168, B171, B174–B175, and B179–B180 remain
     excluded for the same evidence-quality reasons;
   - B181–B189, B191–B193, B195–B197, and B199–B200 remain excluded for
     the same evidence-quality reasons;
   - B201–B209 and B211–B216 remain excluded for the same evidence-quality
     reasons, including B216 which is not yet present in the reviewed Chinese
     source;
   - B58, B59, and B60 are mapped to game API quest numbers 805, 806, and 807;
     mapping a target does not make a disputed prerequisite safe for automatic
     reasoning;
   - Bq1, Bq3, Bq4, Bq8, Bq9, and Bq12 are retained as explicit review
     evidence but remain excluded from automatic reasoning: Bq1 and Bq12 have
     matching prerequisite lists with different verification states, both
     sources still mark Bq3 as under review, both sources leave an additional
     Bq4 prerequisite unidentified, KCWiki leaves an additional Bq8
     prerequisite under review, and the Japanese source has not identified the
     Bq9 prerequisite that KCWiki lists as B6;
   - Fq5, Fq7, Fq8, and Fq9 are retained as explicit factory-source review
     evidence but remain excluded from automatic reasoning: the reviewed pages
     disagree on whether B9, A11, or B8 is an additional prerequisite for
     Fq5, Fq8, and Fq9, while KCWiki leaves an additional Fq7 prerequisite
     under review;
   - Fy1, Fy2, Fy4, Fy6, Fy7, Fy8, and Fy10 are retained as explicit source
     conflicts and excluded from automatic reasoning: the reviewed pages
     either disagree on the identified prerequisites or one source still
     records an unidentified additional prerequisite;
   - Fy3, Fy9, and Fy11 are retained as unresolved yearly factory evidence:
     both sources currently agree on the identified prerequisites, but still
     mark the relationship as incomplete or under review, so the planner does
     not promote it into the automatic graph;
   - the February yearly review now retains By1, By2, Dy1, and Dy7 as explicit
     source conflicts: the Japanese source leaves an additional By1, By2, or
     Dy1 prerequisite unidentified, while KCWiki identifies F54 for By1 and
     B10 for By2 and lists only D23 for Dy1; for Dy7 the Japanese source lists
     D14 + D18 and a tentative D30, while KCWiki lists D14 + D30;
   - the March yearly review retains By3, By4, Cy4, and Dy8 as explicit source
     conflicts: the Japanese source leaves the By3 and Cy4 prerequisites
     unidentified while KCWiki lists F17 and C1 + A14 respectively; the
     Japanese source still marks B87 for By4 and D25 for Dy8 as tentative,
     while KCWiki treats By2 + B87 as the By4 prerequisites and lists
     D23 + D30 for Dy8;
   - By10, By11, and Cy9 are retained as explicit source conflicts and
     excluded from automatic reasoning: the Japanese source still records an
     additional unknown condition after B153 + By9 for By10; for By11 the
     Japanese source leaves both prerequisites unidentified while the Chinese
     source lists B71; Cy9 is C46 in the Japanese source and C46 + F10 in the
     Chinese source;
   - the April yearly review retains By16, Cy10, and Cy12 as inspectable
     unresolved evidence: the Japanese source lists B158 + B208 and another
     unidentified condition for By16 while KCWiki currently lists no
     prerequisite; for Cy10 the Japanese source lists A47 plus an unidentified
     condition while KCWiki lists A47; both sources list B197 + Cy4 for Cy12
     but still mark that relationship as under review;
   - the May yearly review retains By11, By12, By14, and Cy8 as explicit source
     conflicts while Dy3 remains a confirmed graph edge: the Japanese source
     leaves the two By11 and By14 prerequisites unidentified, while KCWiki
     lists B71 for By11 and tentatively lists Bd2 + A16 for By14; the sources
     name the same Cy8 prerequisite for By12 and B180 prerequisite for Cy8, but
     KCWiki still marks those two relationships as under review;
   - the remaining June practice review retains Cy5 and Cy13 as explicit source
     conflicts: the Japanese source lists C18 plus an unidentified condition
     for Cy5 while KCWiki leaves the prerequisite unidentified and under
     review; for Cy13 the Japanese source lists Cy3 plus an unidentified
     condition while KCWiki lists Cy3 + A26;
   - the July through October review retains Cy11, Cy14, Dy4, Cy15, Cy1, Cy2,
     Cy7, and Cy16 as inspectable evidence: Cy11 has B14 plus an unidentified
     Japanese condition; KCWiki still marks the matching C68 + D6 claim for
     Cy14 and C20 + C46 claim for Cy1 as under review; Dy4 has no identified
     prerequisite in either source; the Japanese source leaves both Cy15
     prerequisites unidentified while KCWiki tentatively lists A16 + B13;
     both sources still mark A93 + C21 for Cy2 and B197 + B204 for Cy16 as
     under review; and the Japanese source lists B117 plus an unidentified
     condition for Cy7 while KCWiki tentatively lists B117;
   - the January and February review retains By13 and Cy3 as inspectable
     evidence: the Japanese source lists A94 plus an unidentified condition
     for By13 while KCWiki tentatively lists A94, and neither source currently
     identifies the possible Cy3 prerequisites;
   - the yearly modernization review retains Gy1 through Gy4 as inspectable
     evidence and excludes all four from automatic reasoning: the Japanese
     source leaves both Gy1 and Gy3 prerequisites unidentified, while KCWiki's
     category and yearly tables are inconsistent for Gy1 and tentatively list
     F11 + G1 for Gy3; both sources list Gy1 + Fd3 for Gy2 but still mark the
     relationship as under review; the Japanese source lists Gy3 plus an
     unidentified condition for Gy4 while KCWiki tentatively lists Gy3 + G4;
   - conflict cards retain each source's prerequisite groups, verification
     date, link, review status, and source-specific caution, distinguishing
     tentative relationships from unidentified additional prerequisites so
     users can inspect the disagreement without the planner choosing either
     side;
   - matching source claims are also withheld when every source still marks
     the relationship as under review or incomplete; the UI labels these as
     pending prerequisite information instead of claiming that the sources
     disagree;
   - Dy3 is now part of the reviewed graph because the current Japanese and
     Chinese pages both list D23 + D30;
   - every currently catalogued Bq1–Bq13 and Fq1–Fq9 target is represented
     either as a confirmed graph edge or inspectable unresolved evidence;
     uncertain relationships stay out of automatic reasoning;
   - current live or cached recurring quests are audited against the reviewed
     graph; the summary and exact filters separate unregistered relationships
     from unresolved source claims, while a combined recurring-review filter
     uses the same cadence boundary and a separate all-relationship filter
     remains available for broader review; none treats an unregistered
     relationship as evidence that an unknown prerequisite exists;
   - next: re-review unresolved claims when source verification changes and
     register newly surfaced recurring quests only after their relationships
     meet the same evidence threshold.
4. **Goal planner — quest path first slice implemented**
   - let the user select any quest currently represented in the reviewed graph;
   - filter the growing goal selector by quest number or title while preserving
     graph order and retaining an already selected target that does not match
     the temporary search;
   - order known prerequisites before the selected target;
   - distinguish visible, active, claimable, and not-currently-shown states;
   - never equate a quest missing from the current list with an incomplete
     quest;
   - provide a compact current-list view that keeps the selected target visible
     even when its current state is unknown;
   - retain an explicit full-route view for every reviewed prerequisite;
   - bound long routes to six visible steps by default, preserving both the
     route start and target while offering an explicit expansion control;
   - treat route filtering and folding as presentation only without changing
     prerequisite evidence or inferred completion state;
   - calculate recurring reset deadlines at 05:00 JST for daily, weekly,
     monthly, quarterly, and yearly quests;
   - show task-slot pressure using the capacity reported by the game instead of
     assuming a fixed limit;
   - distinguish explicit game-title evidence from seasonal or legacy
     limited-time candidates;
   - never invent a deadline for limited-time quests whose end time is not
     available;
   - accept reviewed official end-time evidence through a dedicated registry,
     expose its provenance, and score urgency only when its exact timestamp is
     valid;
   - calculate held and safely disposable equipment shortages from local
     inventory while excluding locked and equipped items from disposal counts;
   - include required flagship equipment, improvement level, and proficiency
     in collapsible goal-path preparation lists;
   - compare encoded non-equipment collection requirements with locally
     reported consumable inventory; **implemented for supported collection
     tasks**
   - current registered non-equipment collection definitions are covered;
     expand consumable coverage when new definitions become available;
   - next: add reviewed official entries when an unambiguous end timestamp is
     published; relative maintenance wording remains status-only evidence.
5. **Execution assistance — current registered slice implemented**
   - show exact local counter values alongside the API percentage when a
     structured counter is available;
   - expose typed progress entries containing kind, task-specific label,
     current count, required count, and completion state;
   - derive structured entries directly from bundled metadata for practice,
     sortie, generic and enemy-type battle, arrival, gauge-clear, expedition,
     repair/supply, generic and fleet-specific modernization, development,
     construction, generic and equipment-specific disposal, condition-only
     equipment conversion, formation, held-equipment conditions, and
     supported collection tasks;
   - resolve equipment ids through current local master data and preserve an
     explicit id-based fallback while that data is unavailable;
   - audit every registered enemy-type, fleet-specific modernization, and
     equipment-specific task so its counter shape stays aligned with its
     structured labels;
   - render structured entries separately so completed conditions do not have
     to be inferred from legacy HTML classes;
   - retain the legacy formatter as a compatibility fallback for task types
     that do not yet expose structured labels, then fall back again to generic
     condition counters;
   - keep unknown counters and inventories unknown instead of treating them as
     zero;
   - keep condition-only definitions with no counter out of the progress model
     instead of inventing a synthetic completion value;
   - distinguish fleet composition matches from factory execution conditions
     instead of presenting both as a generic composition result;
   - expose individual local checks for the first fleet, flagship identity,
     ship class/type, level, required slot equipment, improvement,
     proficiency, empty later slots, and expansion slot;
   - expose declarative fleet checks with current/required counts for all 380
     registered fleet matchers (#101–#1118, excluding tasks without a fleet
     matcher),
     including fleet size, flagship type or identity, ship type/class counts,
     named-ship groups, flagship level, second-fleet availability, fleet
     speed, fleet-size ranges, second/third-fleet selection, fixed ship
     positions, fixed-position ship types/categories, position-excluded
     counts, level requirements on non-designated ships, the active sortie
     fleet, allowed-type-only compositions, exact remodel forms, designated
     equipment slots, additive count groups, and alternative valid
     composition branches;
   - keep the declarative result covered by consistency tests against the
     existing matcher;
   - decompose the remaining locally provable fleet requirements embedded in
     factory and equipment-conversion tasks (#1158, #1160, #1164, #1165,
     #1168, and #1169) into named ship-count and fixed-position checks;
     **implemented**
   - show current/required values for those execution checks instead of the
     previous single `指定艦隊条件` result;
   - retain the legacy combined condition field only as a compatibility
     fallback; no registered task currently depends on it;
   - guard the complete registered execution-condition set so future tasks
     cannot silently replace declarative deck checks with the legacy combined
     result;
   - aggregate locally provable map, fleet, factory, equipment, and consumable
     checks into a single current preparation state (`ready`,
     `needs-preparation`, `blocked`, or `unknown`);
   - keep the aggregate explicitly about the current local setup: a fleet
     mismatch means preparation is needed, not that the quest is permanently
     unavailable;
   - keep partially unknown checks out of the ready state and expose the
     aggregate in recommendation ranking and card tags;
   - next: audit new task definitions as they are added and only introduce
     further execution checks when current local data can prove them safely;
   - keep all observation local and read-only.

## Release-boundary acceptance

The packaged Windows application was exercised through the real DMM flow: the
verified `GAME START` button was clicked, the game and assist UI loaded, the
task page rendered the quest-guide Wiki actions, and the document reported no
horizontal or vertical overflow in the accepted window layout.

The external-link IPC boundary was also checked at runtime. Local-file URLs,
plain HTTP URLs, and HTTPS URLs on an unlisted host were rejected without
launching another application. The current approved destinations remain limited
to the application's own sites and the configured Japanese and Chinese Wiki
sources. Requests must originate from the main frame of the current main or
assist window; a child frame or unrelated renderer cannot use this boundary.

Release validation completed with:

- TypeScript type checking passed.
- All 562 tests in 41 files passed.
- The Windows installer build passed.
- The packaged application was closed after validation and left no KouBrowser
  process running.

Validated installer:

- File: `dist/KouBrowser-1.0.5-win-setup.exe`
- Size: 237,932,103 bytes
- SHA-256:
  `2500EDF03CF9720E75BB65A46EE017813431DDD50B80769D48C96CC884DD26E3`
- Signature status: unsigned

## Post-acceptance view follow-up

The recommendation list now supports a persisted status/readiness filter and a
temporary quest number, title, or description search. Filtering preserves the
ranked order, operates only on the current local recommendation set, resets the
bounded pagination to its first page, and does not change quest evidence,
scoring, or readiness semantics.

The first view follow-up passed TypeScript type checking, all 570 tests in 43
files, and the production application build. The subsequent goal-route view
adds a persisted current-list/full-route switch and bounded long-route
expansion; its validation is recorded independently so the installer evidence
above remains attributable to the exact packaged build.

The goal-route view passed TypeScript type checking, all 578 tests in 45 files,
and the production application build. Runtime acceptance clicked the real
`GAME START` surface and verified the compact 289-pixel-wide task guide: search
reduced the current recommendation set correctly, current-list mode omitted
non-current prerequisites, and the nine-step full route first rendered a
bounded six-card path before expanding to all nine cards. Neither state
introduced document- or panel-level overflow.

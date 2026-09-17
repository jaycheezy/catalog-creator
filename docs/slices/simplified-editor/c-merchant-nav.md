---
id: "c-merchant-nav"
slice: "simplified-editor"
title: "Primary rail with Design, Products, Elements"
step: "design"
status: "done"
effort: "S"
order: 1
tags: []
dependsOn: ["c-merchant-shell"]
implementation: "specified"
value: "Shows you three clear choices — Design, Products, Elements — so you always know where to click next."
---

# Primary rail with Design, Products, Elements

## Summary

Add a narrow far-left primary navigation rail with clear icons and labels that switches the contextual left panel between existing functions only: Design (layers + add-element controls), Products (existing product selector/navigation focus), Elements (Add Text, Add Badge, Add Shape). Do not invent Templates, Uploads, My Designs, or asset libraries.

## Acceptance criteria

- Rail shows Design, Products, Elements with icon + label, 40–44px hit targets, and visible active state.
- Each rail item focuses existing functionality; no dead or fake entries exist in Phase 1.
- Default state is Design; switching rail items only changes panel focus, never data, selection, or draft revision.
- Keyboard and screen-reader labels use plain language, not implementation terms.

## Scope

Owns rail component, icons/labels, active state, and panel-switch wiring in the shell. Excludes layer card design (c-merchant-layers), product strip styling (c-merchant-prompt-products), and any new capability or data fetch.

## Implementation guidance

Reuse existing `addLayer`, product selection (`selectProduct`), and panel state from `src/app/editor/page.tsx`; the rail is a view switch, not a new controller. Place rail as the leftmost shell area per `c-merchant-shell` grid. Keep text/badge/shape add calls identical — only the trigger surface changes.

## Interfaces

Rail props: `activeTab: "design" | "products" | "elements"`, `onTabChange`. No persistence, no URL change, no workspace revision increment on tab switch. If deep-linking is later needed, it belongs to Phase 2.

## Validation

- Click each rail item; confirm the contextual panel focuses layers / product selector / add-element actions with no draft change.
- Confirm no Templates/Uploads/My Designs UI exists; grep the diff for those strings.
- Screenshot rail at desktop width.

## Completion handoff

Report changed files, tab → panel-focus map, screenshots, and confirmation that no new capability was added. Flag any pre-existing dead control found during the work.

## Progress

- 2026-09-13 — Implemented. 76px primary rail (Design/Products/Elements, 56px targets, green active state) plus 300px contextual panel in `src/app/editor/page.tsx` behind new `leftTab` view-only state. Design tab hosts existing `LayersPanel`; Products tab reuses `products`/`productIdx`/`selectProduct` (no data change, view revision only via existing path); Elements tab calls existing `addLayer`. No Templates/Uploads/My Designs added. Note: header had no undo/redo buttons and none were added — agent undo lives in the existing activity surface, per "only if these already work".
- 2026-09-13 — Reviewed done (headless verification agent): rail has exactly the 3 buttons with Design active by default; each switches the panel (layers / product list with 1/31 selection / add-element buttons); save pill unchanged across switches; visible-text grep finds no Templates/Uploads/My Designs.

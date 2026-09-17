---
id: "c-merchant-layers"
slice: "simplified-editor"
title: "Layers as friendly cards with Add something"
step: "design"
status: "done"
effort: "M"
order: 2
tags: []
dependsOn: ["c-merchant-shell"]
implementation: "specified"
value: "Lists your ad parts as simple cards you can pick, hide, reorder, copy, or delete — plus one obvious place to add something new."
---

# Layers as friendly cards with Add something

## Summary

Restyle the Design panel's layer list as clean compact cards (icon/type, human-readable name, visibility, reorder, duplicate, delete) and add a visually prominent "Add something" section calling existing Add Text / Add Badge / Add Shape. Keep all layer behavior exactly intact.

## Acceptance criteria

- Each layer card shows icon/type, name, visibility toggle, reorder controls, duplicate, delete — all operating exactly as today.
- Add Text, Add Badge, Add Shape appear as large friendly targets in an "Add something" section, not small technical controls.
- Selecting, hiding, reordering, duplicating, and deleting layers produce identical draft results and revision increments as before.
- Locked layers still reject edits; agent-highlighted layers (if present) remain distinguishable.

## Scope

Owns layer card styling and the Add-something section in the contextual panel. Excludes new layer types, new style fields, inspector regrouping, and canvas interaction changes.

## Implementation guidance

Start from `src/editor/LayersPanel.tsx` (`onSelect`, `onUpdate`, `onAdd`, `onDelete`, `onDuplicate`, z-reassignment in `move`). Keep callbacks and z semantics byte-identical; change markup/classes only. Replace emoji/type shorthands with clear friendly icons where possible but keep the `product-image / text / badge / shape` technical id as small muted text on the card. Ensure 40–44px targets on card actions; avoid tiny buttons.

## Interfaces

Preserve `LayersPanel` props and the `Layer` type in `src/editor/types.ts`. No new props except optional styling/class hooks. Draft revision increments only on actual layer mutations, never on selection or hover.

## Validation

- Add one of each layer type via the new section; select, hide/show, reorder, duplicate, delete each.
- Confirm locked-layer behavior and visibility parity against pre-change build.
- Screenshot the Design panel with several layers.

## Completion handoff

Report changed files, before/after screenshots, and confirmation that layer semantics (selection, z-order, duplication IDs, locked guards) are unchanged. List any icon/label mapping decisions.

## Progress

- 2026-09-13 — Implemented via subagent in `src/editor/LayersPanel.tsx` only. Behavior preserved: props, `move()` z-reassignment, z-desc sort, visibility toggle, reorder/duplicate/delete (product-image delete guard kept), `onAdd` text/badge/shape footer. Presentation: SVG glyphs replace emoji, icon/type + muted `{type} • {content}` subtext, 40px action targets (`Up/Down/Copy/Delete` + visibility), selected moss/green card, restyled "Add something" section. `npm run typecheck` clean at time of edit.
- 2026-09-13 — Reviewed done (headless verification agent): adds grow 3→4→5→6 with inspector tracking; every card has visibility/Up/Down/Copy + muted subtext; hide/reorder/duplicate/delete verified with Unsaved pill on each mutation; product-image has no delete; locked layer drag leaves X unchanged (390→390).

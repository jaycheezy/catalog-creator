---
id: "c-merchant-canvas"
slice: "simplified-editor"
title: "Canvas focus with friendly size control"
step: "variants"
status: "done"
effort: "M"
order: 3
tags: []
dependsOn: ["c-merchant-shell"]
implementation: "specified"
value: "Puts your ad front and center on a calm background, with sizes named the way you will actually use them."
---

# Canvas focus with friendly size control

## Summary

Make the canvas the visual focus: clean toolbar above it with the existing format selector relabeled in friendly terms (e.g. "Instagram Post · 1080 × 1080" for 1:1, with 4:5, 9:16, 1.91:1 and All sizes in the same control), more breathing room, and a subtle neutral workspace background. Keep canvas implementation and interactions unchanged.

## Acceptance criteria

- Toolbar offers all existing ratios (1:1, 4:5, 9:16, 1.91:1, All sizes) from one control with friendly names plus dimensions; selecting one produces the identical template/size change as today.
- Canvas drag/resize/selection behavior is unchanged; only container padding, background, and toolbar placement change.
- The creative visually dominates a normal desktop viewport; workspace background is subtle and neutral.
- JSON view and All-sizes grid remain reachable and behavior-identical (restyled only).

## Scope

Owns canvas container, toolbar placement, friendly size labels, and workspace background. Excludes new sizes, auto-resize-across-formats workflow (Phase 2), and any `EditorCanvas` interaction rewrite.

## Implementation guidance

Reuse `SIZE_PRESETS` from `src/editor/types.ts`, `adaptTemplateToSize` from `src/editor/autoLayout.ts`, and `EditorCanvas`/`TemplateRenderer` as-is. The friendly label is a display map over the same preset `id` — do not fork size state. Keep `showAllSizes` semantics and placement helpers (`placementView`, `variantDraftId`) untouched. Do not sacrifice canvas area for chrome; measure before/after canvas px at 1440px width.

## Interfaces

Size control value remains `SizePresetId | "all"`; callbacks keep existing signatures. No change to `Template.sizeId/width/height` derivation or saved placement keys.

## Validation

- Switch through every size + All sizes; confirm dimensions and saved/unsaved transitions match the old UI.
- Drag and resize a layer on canvas; confirm identical geometry results.
- Screenshot canvas + toolbar at desktop width with measurements.

## Completion handoff

Report the friendly-label → preset-id map, container/background tokens, canvas-size measurements, screenshots, and confirmation of zero interaction changes.

## Progress

- 2026-09-13 — Implemented in `src/app/editor/page.tsx`. Toolbar above canvas with `FRIENDLY_SIZE_LABEL` map (Instagram Post/Portrait/Story/Landscape + dimensions) over unchanged `SIZE_PRESETS` ids, plus All-sizes option and JSON toggle; `changeSize`/`toggleAllSizes`/`openVariant` untouched. Canvas wrapped in padded neutral container (`#f4f1ea`, `px-6 py-6`, centered). All-sizes tip copy updated to reference the toolbar control. `EditorCanvas`/`TemplateRenderer`/`adaptTemplateToSize` untouched.
- 2026-09-13 — Reviewed done (headless verification agent): all 4 friendly names + All sizes present; each switch updates dims (1080x1080/1080x1350/1080x1920/1200x628); All-sizes grid shows 4 cards and returns to single canvas; creative dominates the 1600px viewport; zero console errors.

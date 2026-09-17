---
id: "c-merchant-inspector"
slice: "simplified-editor"
title: "Plain-language property inspector"
step: "design"
status: "done"
effort: "M"
order: 5
tags: []
dependsOn: ["c-merchant-shell"]
implementation: "specified"
value: "Shows settings for whatever you selected in plain words — Content, Image, Position and Size, Style — so you are never lost."
---

# Plain-language property inspector

## Summary

Regroup the right inspector for the selected layer into understandable sections — Content (layer name + content fields already supported), Image/Fit (Contain/Cover), Position & Size (X/Y/W/H), Style (background/color, radius, opacity), Layer (Visible, Locked) — with plain-language labels and technical IDs as small muted text. Keep every control; change grouping and language only.

## Acceptance criteria

- Inspector top clearly shows selected layer name and type (e.g. "Product Image" + muted "product-image").
- All current controls remain reachable: layer name, content fields, Contain/Cover, X/Y/W/H, background/color, radius, opacity, visible, locked.
- No control changes its value semantics, bounds, or draft effect; empty/no-selection state still guides (template name/background + hint).
- Complexity stays hidden until a layer is selected; labels favor "Position & Size" over raw terminology.

## Scope

Owns inspector grouping, labels, section order, and empty-state copy in `PropertiesPanel`. Excludes new typography/alignment/weight controls, button/CTA panels, and any style-field additions (Phase 2).

## Implementation guidance

Start from `src/editor/PropertiesPanel.tsx` (`Section`, `onUpdateTemplate`, `onUpdateLayer`, `updateStyle`). Reorder/group existing inputs only; keep parsers, clamps, color/number handling, and `fontFallbackNotice` identical. Keep `objectFit` limited to existing options. Show raw keys (e.g. `product-image`, `{{price}}`) as muted subtext where helpful, never as the primary label.

## Interfaces

Preserve `PropertiesPanel` props and the `Layer["style"]` / `objectFit` contracts in `src/editor/types.ts`. No new style keys, no renamed persisted fields.

## Validation

- Select each layer type (text, badge, shape, product image); screenshot every inspector group.
- Edit X/Y/W/H, fit, radius, opacity/color, name, visibility, lock; confirm identical draft values as the old form.
- Confirm empty-selection state still edits template name/background.

## Completion handoff

Report the old-field → new-section map, screenshots per layer type, and confirmation of zero value-semantics change.

## Progress

- 2026-09-13 — Implemented via subagent in `src/editor/PropertiesPanel.tsx` only. All handlers/bounds identical (name, content + 6 binding chips, contain/cover, X/Y/W/H with 40px min, background/color hex guards, fontSize 12–120, weights, align, case, radius 0–200, opacity 0–1, visible/locked, empty-state template name/background). Sections now Content, Image/Fit, Position & Size, Style, Layer with 15px header (name + muted type id) and 40px control targets. `npm run typecheck` clean at time of edit.
- 2026-09-13 — Reviewed done (headless verification agent): name + muted type id for product-image/text/badge/shape; all four groups present; Contain/Cover toggles only on product-image; X 80→123 and W 920→400 stick; background/radius→77/opacity→50% apply with labels updating; Visible/Locked toggles work; empty state shows template guidance.

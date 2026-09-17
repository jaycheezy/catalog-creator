---
id: "c-merchant-prompt-products"
slice: "simplified-editor"
title: "Prompt bar with legible product strip"
step: "design"
status: "done"
effort: "M"
order: 4
tags: []
dependsOn: ["c-merchant-shell"]
implementation: "specified"
value: "Lets you type a change in plain words under your ad and swap products from clear thumbnails, titles, and prices."
---

# Prompt bar with legible product strip

## Summary

Move the AI editing field into a polished prompt bar directly beneath the canvas with friendly placeholder text (e.g. 'Describe a change… "make the title bigger"') keeping Generate behavior identical, and restyle the existing product carousel/navigation below or integrated with it so thumbnails, title, and price are clearly legible without changing product functionality.

## Acceptance criteria

- Prompt bar sits beneath the canvas, shows the friendly placeholder, and triggers the exact existing Generate flow (same request, revision guards, error handling).
- Product strip shows the same products in the same order with the same selection semantics; thumbnails, title, and price are legible at a glance.
- Changing products updates the canvas exactly as today; product count/position indicator (e.g. 3 / 48) is preserved.
- ⌘J still focuses the prompt; no new AI capability is implied.

## Scope

Owns prompt bar styling/placement/placeholder and product strip styling/legibility. Excludes new AI models, new product sources, search/filter (Phase 2), and any change to Generate or product-loading logic.

## Implementation guidance

Reuse `aiPrompt` state and Generate handler plus `products[productIdx]` / `selectProduct` navigation in `src/app/editor/page.tsx`. Only markup, placeholder copy, and classes change. Keep loading/disabled states and validation error surfaces wired to the same conditions. Ensure the strip does not steal canvas dominance — compact but legible.

## Interfaces

No contract changes. Generate payload, product identity (`source_id`), and draft-revision handling stay identical. Placeholder copy is presentation only.

## Validation

- Run an AI Generate (e.g. "make the title bigger") and confirm identical draft result/revision behavior.
- Step through products with arrows/thumbnails; confirm canvas and price/title update as before.
- Screenshot prompt bar + strip with a long title and a sale price.

## Completion handoff

Report changed files, placeholder copy, strip layout (thumbnail/title/price sizes), screenshots, and confirmation of zero behavior change in Generate and product selection.

## Progress

- 2026-09-13 — Implemented in `src/app/editor/page.tsx`. Placeholder is now `Describe a change… "make the title bigger"`; `aiPrompt`/`handleAiAssist`/⌘J wiring unchanged. Product strip: 48px rows, 36px thumbnails, 13px titles, mono prices, 44px prev/next buttons with labels; `selectProduct` path unchanged (20-item window kept). Left Products tab reuses the same selection for a roomier list view.
- 2026-09-13 — Reviewed done (headless verification agent): placeholder exact and bar beneath canvas; "add red sale badge" adds a Sale Badge and clears the prompt; "dark premium" darkens background to #0a0a0a; product click moves 1/31→2/31 with canvas update; arrows disable correctly at bounds (31/31); toolbar JSON toggle reveals the AI-friendly panel and header JSON downloads valid `Gibun_Template_1.json`.

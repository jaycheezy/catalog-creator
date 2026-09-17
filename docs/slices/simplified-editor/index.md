---
id: "simplified-editor"
title: "Simplified merchant editor"
description: "Canva-like creative editor a store owner can use with no design experience"
order: 6
tone: "green"
---

# Simplified merchant editor

## Outcome

A store owner with no design experience can open an existing project and make a professional product ad without learning a graphics engine: pick the store, pick a size like "Instagram Post · 1080 × 1080", manage layers as simple cards, describe a change in plain words, swap the product, tweak the selected layer in plain-language groups, and export a PNG. The creative preview dominates the screen; technical language and tiny controls are gone.

Example: "Make my tea ad for Instagram, make the title bigger, swap in the sale product, and export it — without touching JSON or layer coordinates unless I want to."

Success means every capability in the current editor still works, but the product feels like a bright, spacious, friendly ecommerce editor: narrow icon rail on the far left, contextual panel next, large canvas center, clean inspector right, prompt bar under the canvas, Export PNG as the strongest action.

## Scope

This slice owns the information-architecture and presentation refactor of `src/app/editor/page.tsx` and its three panels, plus the Phase 2 proposal set that follows once Phase 1 is stable.

Phase 1 ships in this slice and uses ONLY functionality that already exists. No new backend capabilities, data models, editor behaviors, or workflows. Preserved exactly as-is (repositioned/restyled only):

- store/domain selection and Load
- canvas size/aspect switching: 1:1, 4:5, 9:16, 1.91:1 and All sizes
- zoom, JSON view, save state, PNG export
- layer list: selection, visibility, ordering, duplication, deletion
- layer types: text, badge, shape, product image
- adding Text, Badge, Shape layers
- direct canvas positioning/resizing
- selected-layer inspector: image fit (Contain/Cover), X/Y/W/H, background/color, radius, opacity, visibility, locking
- AI instruction input / Generate
- product navigation / selection along the bottom

Explicitly deferred from Phase 1: Templates, Uploads, My Designs, asset libraries, new typography controls, button/CTA panels, resize-across-formats workflow, preview mode, multi-page/multi-creative — unless already in the codebase. The left rail must expose existing functions, not pretend these exist.

Phase 2 stories in this slice are proposals only: implementation plan with effort and dependencies first, simplest merchant interaction preferred, advanced controls kept accessible but secondary.

## Shared architecture and contracts

This is a presentation refactor, not a new editor implementation. Reuse existing components wherever practical; do not rewrite canvas behavior unless layout forces it.

| Owner | Responsibility |
| --- | --- |
| Shell | `src/app/editor/page.tsx` owns the three-area workspace (rail + contextual panel + canvas + inspector), header hierarchy, and all existing state/handlers. New layout components are thin wrappers; state, revision guards, save, and workspace controller stay where they are. |
| Canvas | `src/editor/EditorCanvas.tsx` + `src/editor/TemplateRenderer.tsx` keep all positioning/resizing/binding behavior. Only container, background, spacing, and toolbar placement change. |
| Layers | `src/editor/LayersPanel.tsx` keeps selection, visibility, ordering, duplication, deletion semantics. Restyle rows as compact cards; add a prominent "Add something" section calling the existing `addLayer` for text/badge/shape. |
| Inspector | `src/editor/PropertiesPanel.tsx` keeps every control; regroup into Content, Image/Fit, Position & Size, Style, Layer with plain-language labels. Technical IDs stay as small muted text. |
| Sizes | `src/editor/types.ts` `SIZE_PRESETS` and `src/editor/autoLayout.ts` `adaptTemplateToSize` are the only size source. The friendly label (e.g. "Instagram Post · 1080 × 1080") maps to the same preset IDs. |
| Products/AI | Existing product `products[productIdx]` navigation and `aiPrompt` Generate flow stay behavior-identical; only the prompt bar and product strip styling change. Agent workspace tools (`src/workspace/*`, `src/agent/*`) keep calling the same controller — no second draft path. |

Design principles for all Phase 1 work: 8–12px radii on controls (larger on major cards), subtle 1px neutral borders, restrained shadows, mostly white surfaces, light warm/neutral workspace background, existing Catalog Forge green as primary accent, black/charcoal primary text, generous spacing, 40–44px hit targets on important controls, strong type hierarchy, no tiny controls/labels, hide complexity until a layer is selected, "Position & Size" over raw terminology, responsive where practical, canvas remains dominant on desktop.

Do not remove working features missing from the mockup — reposition or visually simplify them instead. Preserve Admin/back-navigation behavior while demoting it visually.

## Delivery order

1. `c-merchant-shell` — three-area workspace + reworked header (all existing actions kept, Export PNG primary). No other story starts layout until the shell contract lands.
2. `c-merchant-nav`, `c-merchant-layers`, `c-merchant-canvas`, `c-merchant-prompt-products`, `c-merchant-inspector` — build on the shell in parallel only with explicit file ownership; all reuse existing handlers/state.
3. `c-merchant-parity` — Phase 1 completion gate: every preserved capability exercised against the acceptance checklist. Phase 2 planning starts only after this passes.
4. `c-merchant-templates`, `c-merchant-products-uploads`, `c-merchant-text-button-resize-preview` — Phase 2 proposals (outline status): plan with effort/dependencies first, simplest merchant interaction, no mass implementation.

Agents changing `src/app/editor/page.tsx`, `src/editor/*`, or `src/workspace/*` must read every dependent spec and open slice notes first. Avoid parallel edits to the editor page unless ownership is coordinated.

## Release evidence

1. Phase 1 parity run on desktop: selecting/adding/deleting/duplicating layers, visibility, ordering, locking, drag/resize on canvas, X/Y/W/H edits, image fit, radius, opacity/color, product change, aspect-ratio change, AI Generate, saving, JSON access, PNG export — all functional with before/after screenshots.
2. Layout evidence: rail + contextual panel + dominant canvas + inspector + prompt bar under canvas + product strip legible; header shows Catalog Forge + store selector left, zoom/JSON/save status with Export PNG strongest right; no Templates/Uploads/My Designs invented.
3. `npm run story-map:check`, tests, typecheck, lint, and build pass. No behavior change in workspace controller, save, render, or publication contracts; any deviation is recorded as a blocker note.
4. Phase 2 handoff: what changed, which components were reused, whether any behavior changed, and recommended Phase 2 order with effort/dependencies.

---
id: 2026-09-13-editor-design-qa-mock
title: Design QA of Phase 1 implementation against the Canva-like mock
type: finding
status: resolved
author: merchant-editor-implementation
updated: "2026-09-13"
affects: ["c-merchant-shell", "c-merchant-nav", "c-merchant-layers", "c-merchant-canvas", "c-merchant-prompt-products", "c-merchant-inspector", "c-merchant-parity"]
---

## Summary

Rendered the real editor headlessly (system Chrome via playwright-core against local dev, authenticated through `/api/login`) and compared it element-by-element with the mock. Three genuine in-scope gaps were found and fixed; every other mock difference is a spec-mandated Phase 1 omission whose capability belongs to a Phase 2 story.

## Evidence

Screenshots (1600×1000, Gibun catalog loaded, 31 products, zero console/page errors): default Design tab, Products tab, Elements tab, and an interaction pass (size → 9:16 Story, product → 2/31, layer → Price Badge with inspector following and X/Y/W/H updating).

Fixed in this pass (`src/app/editor/page.tsx` only, presentation-only):

1. Canvas toolbar showed the friendly size name twice (label + select). Removed the separate label; the select now shows one friendly value (`Instagram Post · 1080 × 1080`) with a layout icon.
2. Rail used text glyphs (◇▦＋). Replaced with inline SVG line icons matching the mock's refined rail.
3. Page scrolled as one document, pushing the prompt bar and product strip below the fold. The shell is now a fixed viewport (`h-screen overflow-hidden`): header fixed, three columns scroll independently, prompt bar always visible, feed/template footers preserved in a capped (`max-h 28vh`) scroll zone. No feature removed.

Intentional deviations from the mock (existing functionality does not support them; each maps to a Phase 2 story):

- Left panel shows layers + Add-something, not Templates/My Designs/search grid → `c-merchant-templates`.
- Rail has Design/Products/Elements, not separate Text/Shapes/Uploads → Uploads is `c-merchant-products-uploads`; combined Elements is per the Phase 1 spec.
- No Preview button, Resize button, or Add-page/pagination → preview/resize/multipage are `c-merchant-text-button-resize-preview` (multipage only if the model supports it).
- Inspector has no Replace/Remove image, no Reset, no Fill/Fit/Crop triple, no text toolbar (B/I/align), no Button/URL/Show-price section → new capabilities, all Phase 2.
- Header keeps the existing store text-input + Load (a dropdown would imply saved stores, which do not exist) and the zoom stepper (same capability as the mock's dropdown). No undo/redo buttons exist in the app, so none were added.
- Bottom strip is the AI prompt bar + product carousel per the Phase 1 spec, not page navigation.

## Impact

Phase 1 visually matches the mock everywhere existing functionality allows. No data-model, backend, or behavior changes were made during QA fixes.

## Follow-up 2026-09-13 — tightening to the refined mock

Second mock (refined screenshot of the redesign itself) reviewed against live renders. Applied, all presentation-only with zero behavior change: leaf logo + brand lockup, green Load, download icon on Export PNG, wand Design icon, Instagram-gradient size icon, sparkle icons in prompt bar + Generate, collapsible inspector sections (subagent, `PropertiesPanel` only, all controls/handlers identical, verified by toggle test: hide/show + `aria-expanded`, no errors). Deliberately NOT copied: store pill stays an honest text input (no fake dropdown), layer delete stays text-labeled, selection overlay unchanged (existing canvas behavior). tsc/lint clean, 210 tests pass, live render matches the mock.

## Next action

Parity owner runs the manual browser checklist (save, JSON, PNG export, drag/resize, AI Generate) once the homepage syntax blocker clears, then marks `c-merchant-parity` done. Headless harness lives outside the repo and was intentionally not committed.

## Follow-up 2026-09-13 — verification agents + PNG export finding

Three parallel headless verification agents exercised the live editor (fresh contexts, no Save/Publish/Load): shell, nav, canvas, layers, inspector, prompt/AI keywords, product switching, JSON panel + download — all PASS with zero console errors, and the six implementation stories were closed as done.

One FAIL: Export PNG in headless produces no download/tab — `htmlToPngDataUrl` throws foreignObject CORS on the cross-origin product images and the app shows its designed fallback alert ("Save to server and use Server PNG"). `src/editor/export.ts` and the `exportRef` path are byte-identical to HEAD, so this is a pre-existing environmental limitation, not a Phase 1 regression. PNG byte output and the save→server-PNG path stay on the manual parity checklist.

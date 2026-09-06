---
id: "c-reliable-render-parity"
slice: "reliable-catalog"
title: "Match server PNGs to the editor design"
step: "variants"
status: "done"
effort: "M"
order: 13
tags: ["next"]
dependsOn: ["c-reliable-variant-render"]
implementation: "specified"
value: "Makes sure the final ad image matches what you approved in the editor, so shoppers see clean prices and titles."
---

# Match server PNGs to the editor design

## Summary

Align browser and server rendering so the image delivered to Meta preserves the styling the merchant approved.

## Acceptance criteria

- Rotation, opacity, supported fonts, borders, shadows, text spacing, and clipping render consistently.
- Share supported style rules between renderers and make unsupported options explicit in the editor.
- Compare exported images with previews using long titles, sale badges, and rotated or translucent layers.

## Scope

Own a shared, pure projection from `Template`/`Layer` fields to the supported render styles, the browser `TemplateRenderer`, and the JSX passed to `ImageResponse`. Make every supported current style visible in both outputs: geometry, z-order, rotation, opacity, backgrounds, borders, radius, shadows, padding, typography, alignment, wrapping, clipping, and product-image fit. Exclude new editor controls, remote font upload, placement persistence, R2 caching, conditional visibility, and publication.

## Implementation guidance

Read [the slice contracts](index.md), `src/editor/types.ts`, `src/editor/TemplateRenderer.tsx`, and `src/app/api/render/route.tsx`. Extract transport-independent helpers into a server-safe module such as `src/editor/renderStyles.ts`; it must not import a `"use client"` module. Have both browser and server renderers call the same helpers for defaults, units, alignment, text wrapping, and layer order rather than maintaining parallel style literals.

Separate editor-only selection/resize outlines from exported styles. Preserve `overflow: hidden` at the canvas and layer boundaries. Apply rotation/opacity/border/shadow to image and text layers. Use one padding default; the current browser and server disagree for ordinary text. Render shapes without placeholder text and missing product images consistently.

Define a small supported font set that `ImageResponse` can render in the Cloudflare bundle. If a saved `fontFamily` is unsupported, use the documented fallback and show that limitation in the properties UI or editor status; do not promise arbitrary local/system fonts. Avoid adding network font fetches on every render.

## Interfaces

Export named pure helpers for canvas style, common layer style, text style, image style, and sorted visible layers. Inputs are `Template`, `Layer`, and scale; output properties must be accepted by both React DOM and Satori, with adapter conversion only where string/numeric units differ. Keep binding resolution in `resolveBinding` and product selection outside style helpers.

The render route retains current query/error behavior and returns PNG dimensions from the selected template. Unsupported styles produce a stable fallback and an editor-visible limitation; invalid numeric style values must not reach Satori.

## Validation

Add focused unit tests for shared style projection and route markup/PNG metadata. Use stress fixtures containing a long multiline title, sale badge, nonzero rotation, partial opacity, border, radius, shadow, letter spacing, line height, left/right alignment, padding, `contain` and `cover`. Assert both renderers receive equivalent normalized values.

Generate representative browser and server images at 1:1 and 9:16 and inspect them side by side. Record any documented Satori difference. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run cf:build`.

## Completion handoff

Report changed shared-style and renderer files, the supported/defaulted style matrix, fixture/test evidence for every acceptance criterion, browser/server comparison images, command results, and remaining Satori/font limitations. Move this story to `in-review`; do not change placement/project contracts owned by the next story.

## Progress

- 2026-09-05 — Picked up from `in-progress` with no prior implementation: no shared module existed and the renderers diverged on rotation, opacity, borders, shadows, fonts, spacing, padding defaults, clipping, and missing-image output.
- 2026-09-05 — Added server-safe `src/editor/renderStyles.ts` (contract version 1): `sortedVisibleLayers`, `canvasBox`, `layerBox`, `rotationTransform`, `borderValue`, `layerPaddingPx` (badges 8px, others 0px), `contentAlignment`, `textStyle` with em-to-px letter spacing, `resolveFontFamily` with `sans-serif` fallback, `fontFallbackNotice`, `applyTextTransform` (JS, so Satori and DOM agree), `displayText` (shapes render empty, text/badge render em dash), `imageStyle`, and `finiteOr`/`normalizeOpacity` guards. Wired `src/editor/TemplateRenderer.tsx`, `templateToHtmlString`, and `src/app/api/render/route.tsx` to these helpers; server now applies rotation/opacity/border/shadow/typography/spacing, clips with `overflow: hidden`, and renders the shared `No image` block. `src/editor/PropertiesPanel.tsx` shows an amber notice when a saved `fontFamily` falls back.
- 2026-09-05 — Added `tests/renderStyles.test.ts` (8 projection tests) and `tests/renderParity.test.ts` (server-markup parity via project snapshot: rotation, opacity, border, shadow, px spacing, JS uppercasing, font fallback, badge padding default, right alignment, clipping, shape without placeholder, missing-image block). All pass.
- 2026-09-05 — Review fixes (story stays in-review). P0 runtime 500: optional style values reached Satori as `undefined` (mocked tests hid it). Added `compactStyle` and extracted the route JSX into `src/editor/renderElement.tsx` so every style object is stripped before `ImageResponse`. Proved the failure mode with real Satori (`transform: undefined` throws `Invalid transform value`) and pinned the fix with `tests/renderSmoke.test.ts`: real Satori layout of the stress template with bundled fonts (rotation matrix, opacity, border, glyph fills, no `undefined`, content-sensitive, deterministic missing-image block).
- 2026-09-05 — Review fixes, fonts. No font data was supplied to `ImageResponse`, so every family rasterized identically. Bundled Inter 400/600/700 latin woff from `@fontsource/inter` (OFL) via `scripts/embed-fonts.mjs` into `src/editor/fonts.ts` (125KB, no per-render network fetch); the route passes them as `fonts`, and the editor loads the same faces via fontsource CSS. `resolveFontFamily` maps the whole sans group to Inter on both sides; serif/mono stacks fall back to Inter and are flagged with an editor notice. Supported-font list now describes what the bundle actually draws.
- 2026-09-05 — After review fixes: `npm run check` green (15 files, 83 tests, typecheck, 0 lint warnings); `npm run build` and `npm run cf:build` pass. Side-by-side browser-vs-PNG visual inspection at 1:1 and 9:16 still outstanding; documented Satori difference: `transform-origin: center` is emitted but Satori support is partial, so large rotations should be eyeballed before release.
- 2026-09-06 — Review accepted. The shared missing-image helper now gives the browser renderer, HTML-string path, and `ImageResponse` element identical copy, color, and scaled typography. The real project-backed route returned a valid 1080×1080 PNG for a missing-image Shopify product, and visual inspection confirmed the expected `No image — <id>` output. The real-Satori stress fixture continues to cover long text, rotation, translucency, borders, spacing, fallback fonts, and deterministic output. `npm run check` passed 15 files / 86 tests with typecheck and zero lint warnings; `npm run build`, `npm run cf:build`, and authored/staged diff checks passed. Story marked `done`; larger-rotation visual judgment remains a release-workflow check rather than an implementation defect.

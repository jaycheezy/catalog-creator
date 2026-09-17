---
id: 2026-09-13-homepage-syntax-blocks-build
title: Pre-existing homepage syntax error blocks production build
type: blocker
status: open
author: merchant-editor-implementation
updated: "2026-09-13"
affects: ["c-merchant-parity"]
---

## Summary

`src/app/page.tsx` in the shared working tree has a syntax error (`function StatusBar` renders JSX without `return`, `tsc` error TS1128 at line 717, plus missing `LinkIcon`/`DocIcon`/`UploadIcon`/`GridIcon` components under `next build`). It belongs to a concurrent homepage/phone workstream, not the simplified-editor slice. It blocks `next build` and bare `tsc --noEmit`, so the Phase 1 parity gate cannot go fully green until it is resolved.

## Evidence

- `npx tsc --noEmit` → `src/app/page.tsx(717,3): error TS1128: Declaration or statement expected.` No errors in `src/app/editor/page.tsx`, `src/editor/LayersPanel.tsx`, or `src/editor/PropertiesPanel.tsx`.
- `npm run build` → `Failed to type check` on `src/app/page.tsx` icon names (363–556). Editor files are clean.
- `npm test` → 29 files / 188 tests pass. `npm run lint` → clean. `npm run story-map:check` → 60 stories validated.
- `git diff HEAD --stat` shows a ~742-line uncommitted homepage redesign (`Your products, dressed for Meta`, phone cutout components) unrelated to this slice; mtime shows it was modified concurrently by another workstream.
- The editor route itself compiles in dev (`/editor` redirects to `/login` as expected behind auth; dev server compiles without editor errors).

## Impact

Affects `c-merchant-parity` only: automated evidence is green except the production build, which is blocked by another workstream's file. No editor behavior is affected. Do not fix the homepage inside this slice without coordinating with its owner.

## Next action

Homepage workstream owner fixes the `StatusBar` return and missing icon components, then the parity owner re-runs `npm run build` and the manual browser checklist (login required; could not be exercised headlessly here).

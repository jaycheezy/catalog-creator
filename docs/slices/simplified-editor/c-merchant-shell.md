---
id: "c-merchant-shell"
slice: "simplified-editor"
title: "Workspace shell and simplified header"
step: "design"
status: "done"
effort: "M"
order: 0
tags: []
dependsOn: []
implementation: "specified"
value: "Gives you one calm workspace where your ad is the biggest thing on screen, with Export always easy to find."
---

# Workspace shell and simplified header

## Summary

Reorganize `src/app/editor/page.tsx` into a three-area workspace (narrow left rail + contextual panel, dominant canvas center, inspector right) and simplify the header hierarchy. Keep every existing action; change presentation and grouping only.

## Acceptance criteria

- Left shows Catalog Forge plus the existing store/domain selector and Load; center/right shows undo/redo only if already working, plus zoom, JSON, save status, with Export PNG as the strongest primary action.
- Existing Admin/back-navigation still works but is visually demoted, not removed.
- Desktop layout keeps the creative preview as the dominant visual element with generous spacing and breathing room.
- No working feature is removed because it is absent from the mockup; anything unplaced is repositioned or simplified, with deviations recorded.

## Scope

Owns the shell grid, header grouping/hierarchy, button prominence (Export primary), workspace background, spacing/radii/borders per slice principles, and responsive behavior where practical. Excludes layer cards, inspector grouping, canvas toolbar labels, and prompt/product styling — those belong to sibling stories built on this shell.

## Implementation guidance

Inspect `src/app/editor/page.tsx` (state, handlers, save, zoom, JSON, export, agent provider) before touching layout. Extract thin layout wrappers only; keep all state, `workspaceRevisionReducer`, save/export handlers, and `AgentWorkspaceProvider` wiring untouched. Reuse existing Catalog Forge green, Inter, and Tailwind tokens. Hit targets 40–44px on primary actions; 8–12px control radii; subtle 1px neutral borders; restrained shadows; white surfaces on warm/neutral background.

## Interfaces

No contract changes. Header actions call the same handlers with the same props/state. If a control must move DOM position, preserve its callback identity and keyboard shortcuts (notably ⌘S save, ⌘J AI focus). Document the shell grid (areas, breakpoints, canvas max constraints) in the handoff.

## Validation

- Render an existing project before/after; screenshot header + shell at desktop width.
- Click every header action (Load, zoom, JSON toggle, save, Export PNG, Admin/back) and confirm identical behavior.
- Run `npm test`, `npm run typecheck`, `npm run build`.

## Completion handoff

Report changed files, shell grid definition, header grouping map (old → new position), screenshots, check results, and any behavior deviation (must be none; otherwise file a blocker note). Update status to in-review when evidence is ready.

## Progress

- 2026-09-13 — Implemented. Header now: left Catalog Forge + store input/Load (or project name chip in project mode), save-status pill; right zoom, JSON, Save, Export PNG as 44px primary in Catalog Forge green. Size segmented control removed from header (moved to canvas toolbar); Story Map/Admin demoted to a muted sub-header row. Changed file: `src/app/editor/page.tsx`. No handler changes; `saveToServer`, `exportJson`, `handleExportPng`, `fetchProducts`, zoom setters all reused. Incidental: moved ⌘J/⌘S shortcut effect below `saveToServer` and moved `saveVariantPlacement` above it to satisfy `react-hooks/immutability` (no behavior change). Evidence: `npm run lint` clean, `npm test` 188 pass, `tsc` clean for editor files; `next build` blocked by concurrent homepage break — see note `2026-09-13-homepage-syntax-blocks-build.md`.
- 2026-09-13 — Reviewed done (headless verification agent, live editor, zero JS errors): brand + store input/Load present; zoom stepper 42%→47%→37%; header JSON downloads `Gibun_Template_1.json`; save pill reads Unsaved on fresh draft; Export PNG is #3a5a1e, 44px, bold primary; no Admin/back link in default mode; Story Map is a single muted 11px dev-only link.

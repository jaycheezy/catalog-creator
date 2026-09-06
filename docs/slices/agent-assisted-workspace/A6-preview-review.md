---
id: "c-agent-preview-review"
slice: "agent-assisted-workspace"
title: "A6 · Review products across placements"
step: "variants"
status: "proposed"
effort: "M"
order: 5
tags: []
dependsOn: ["c-agent-design-commands"]
implementation: "specified"
value: "Shows your design on real products across all sizes at once, so you can approve it with confidence before it goes live."
---

# A6 · Review products across placements

## Summary

Expose preview_design to show a bounded review grid using copies of the active draft, ready for human and agent visual inspection.

## Acceptance criteria

- Preview up to six explicit products in up to three sizes; identify the exact product, placement and draft revision.
- Exercise long titles, sale products and missing images; reject stale previews when the draft changes.
- Do not overwrite the active design, save variants or imply server PNG parity; visual review uses the browser output.

## Scope

Own preview_design and a transient product/placement review grid. Do not save adapted templates, replace the active design, generate server variants or claim server render parity.

## Implementation guidance

Read [the slice architecture](index.md) and repository AGENTS.md before implementation. Inspect current code; the listed locations are starting points, not a frozen API.

Reuse `src/editor/autoLayout.ts` and `src/editor/TemplateRenderer.tsx`. Adapt immutable copies of the captured draft for each selected size. Render a labeled review panel for up to six explicit source product IDs and three supported sizes. Check the captured draft revision before showing results. Use actual product bindings so long-title and sale cases remain representative. Avoid dependencies on A5’s activity component; use A2/A4’s view/controller boundary.

## Interfaces

Inputs: sessionId, projectId, expectedDraftRevision, productIds and sizeIds. Result: viewId, captured draft revision, each source ID/size/dimensions, and warnings. Unsupported sizes and missing IDs fail before opening a partial grid. Expose enough view information for browser screenshots; do not return large base64 images or treat a metadata result as visual approval.

## Validation

Test bounded combinations, invalid sizes/IDs, draft changes during work and source immutability. Verify a long title, sale product and missing image visually in square and Story layouts. Confirm active template, selection semantics and saved fingerprints remain correct after opening and closing the grid.

## Completion handoff

Report changed files, decisions and interface changes, checks run with results, and evidence against every acceptance criterion. Identify limitations and follow-ups. Update this story to in-review when implementation and required evidence are ready; do not mark dependent stories complete. A blocker belongs in Progress with a concrete prerequisite.

---
id: "c-merchant-text-button-resize-preview"
slice: "simplified-editor"
title: "Friendlier text, buttons, resize, preview"
step: "design"
status: "proposed"
effort: "XL"
order: 9
tags: ["phase-2"]
dependsOn: ["c-merchant-parity"]
implementation: "outline"
value: "Makes titles, shop buttons, other sizes, and a clean preview effortless, while keeping expert controls tucked away."
---

# Friendlier text, buttons, resize, preview

## Summary

Propose the remaining Phase 2 experience: friendlier text editing (direct editing, typography, alignment, weight — only what the renderer safely supports), Button/CTA editing (text, destination URL, styling in a simple panel), Resize workflow (convert one creative across ad/social formats), clean Preview mode without editor chrome, and multi-page/multi-creative only if the product model supports it. Plan with effort and dependencies first.

## Acceptance criteria

- Proposal lists each capability, what the renderer safely supports today, and the simplest merchant interaction for each; advanced controls stay accessible but secondary.
- Resize reuses existing size/placement adaptation; Preview creates no competing review UI and never saves/exports by itself.
- Multi-page is explicitly conditional on the underlying model — included only with a named contract, otherwise marked wont-do with rationale.
- Recommended build order across the four sub-features with per-item effort is recorded.

## Scope

Proposal and plan only. Deferred builds own text controls, button panel + URL handling, resize flow, preview mode, and any multi-page work — after parity and plan approval. Guiding principle: "A store owner should be able to make a professional product ad without understanding graphic design."

## Implementation guidance

This story is an outline. Inspect `src/editor/renderStyles.ts`, `src/editor/renderElement.tsx`, `src/editor/TemplateRenderer.tsx`, server `ImageResponse` parity constraints, and `placementState.ts` before specifying. Typography/CTA changes must preserve browser/server render parity and binding safety (`{{price}}` etc.).

## Interfaces

No interface changes in the proposal. The plan must state which `Layer["style"]`, binding, and placement contracts are reused and what would need allowlist extension (do not extend here).

## Validation

Review the plan for renderer feasibility, parity risk, URL safety (CTA destinations), and dependency order. No build verification in this story.

## Completion handoff

Deliver the short plan (sub-feature order, effort, dependencies, renderer limits, open questions) and link research. Keep status proposed until reviewed.

---
id: "c-merchant-products-uploads"
slice: "simplified-editor"
title: "Easier products and merchant uploads"
step: "feed"
status: "proposed"
effort: "L"
order: 8
tags: ["phase-2"]
dependsOn: ["c-merchant-parity"]
implementation: "outline"
value: "Helps you find the right product fast and add your own images, so the ad always shows what you mean."
---

# Easier products and merchant uploads

## Summary

Propose a Products workspace (browse/search catalog, insert/replace a product in the creative) and merchant Uploads (image upload and management). Plan with effort and dependencies first; simplest merchant interaction wins over raw controls.

## Acceptance criteria

- Proposal covers product search/browse, insert/replace semantics (what happens to bindings, unsaved draft, revisions), and upload storage/ownership/limits.
- No silent product-data mutation; replacing a product never rewrites source rows.
- Effort split between Products search and Uploads is recorded with dependencies on Phase 1 product strip and project contracts.

## Scope

Proposal and plan only. Deferred build owns search UI, insert/replace logic, upload pipeline, asset storage, and management UI — after parity and plan approval.

## Implementation guidance

This story is an outline. Inspect `src/lib/catalogProject.ts`, `FeedRow` normalization, product-identity rules (`source_id`), and R2 bucket boundaries (`TEMPLATES_BUCKET` vs `RENDERS_BUCKET`) before specifying. Product images today reuse existing assets — remote-image loading needs explicit security review.

## Interfaces

No interface changes in the proposal. The plan must state which catalog/project contracts are reused and whether uploads need a new asset contract (do not invent one here).

## Validation

Review the plan for merchant simplicity, storage/security implications, and dependency order. No build verification in this story.

## Completion handoff

Deliver the short plan (products vs uploads order, effort, dependencies, storage/security questions) and link research. Keep status proposed until reviewed.

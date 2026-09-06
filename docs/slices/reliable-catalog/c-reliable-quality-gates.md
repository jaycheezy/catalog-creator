---
id: "c-reliable-quality-gates"
slice: "reliable-catalog"
title: "Add useful lint, build, and regression gates"
step: "test"
status: "done"
effort: "S"
order: 19
tags: ["next"]
dependsOn: ["c-reliable-feed-import", "c-reliable-durable-saves", "c-reliable-variant-render"]
implementation: "specified"
value: "Adds automatic checks that catch mistakes early, so updates stay reliable and don't break what already works."
---

# Add useful lint, build, and regression gates

## Progress

- 2026-09-05 — Implementation started from the specified quality-gate contract. Auditing the existing regression suite, authored-source lint coverage, generated-output exclusions, and local versus release command matrix.
- 2026-09-05 — Regression audit: corrupt-decimal rejection, after-preview-window validation, exact `source_id` selection, missing-storage 503, stale revisions, and dirty-state preservation were covered except an explicit corrupt-decimal case; added it to `tests/catalogValidation.test.ts` (`12.34.56 EUR`, `17,90,00 EUR`, wrong-decimal counts, bare currency all block with `invalid-price`; `parseCatalogPrice` returns null for each).
- 2026-09-05 — Fixed all 7 lint warnings mechanically (removed dead `selected` in `EditorCanvas.tsx`, unused `Layer` import in `autoLayout.ts`, unused `scale`/`dx`/`dy`/`dw`/`dh` in `TemplateRenderer.tsx` resize handles). `npx eslint` now passes with 0 warnings. ESLint already ignores `.next`/`.open-next`/`.wrangler`/generated output narrowly; proved with temp files that an authored-source violation is reported while a generated-output equivalent is ignored (both removed afterwards).
- 2026-09-05 — Added consolidated `npm run check` (story-map validation, then tests, typecheck, lint; sequential fail-fast) and documented the local vs release command matrix in `README.md`, including that a green build does not prove Cloudflare/Meta acceptance.
- 2026-09-05 — Review fixes (story stays in-review). Added a real-Satori smoke test (`tests/renderSmoke.test.ts`, 3 tests, no `ImageResponse` mock): undefined-stripping unit check plus actual Satori layout of the stress template with bundled fonts, which fails loudly on the P0 class instead of hiding it behind markup assertions. Untracked generated Cloudflare output (`git rm -r --cached .open-next`, 1,592 files; worktree left intact) so future builds no longer dirty the tree; `.gitignore` already excluded these paths.
- 2026-09-05 — After review fixes: `npm run check` green (15 files, 83 tests, typecheck, 0 lint warnings); `npm run build` and `npm run cf:build` pass.
- 2026-09-06 — Review accepted. `npm run check` passed 15 files / 86 tests, typecheck, and lint with zero warnings; `npm run build` and `npm run cf:build` passed; `git diff --check` and `git diff --cached --check` were clean. `.open-next` has zero tracked files after the staged removal, while the generated directory remains ignored for repeat builds. Story marked `done`.

## Summary

Exclude generated Cloudflare output from lint, resolve application-source lint errors, and make the catalog regression checks repeatable.

## Acceptance criteria

- Lint ignores .open-next build output and passes for application source.
- Document and automate type checking, production build, and focused import/render/persistence regressions.
- A regression such as a mismatched variant image or corrupt decimal price fails the checks.

## Scope

Own lint/generated-output exclusions, deterministic repository check scripts, focused regression coverage for completed Reliable Catalog foundations, and contributor documentation describing local and release commands. Exclude feature implementation from the downstream render/placement/publication stories, broad style rewrites, dependency upgrades without a demonstrated gate need, and tests that merely restate implementation internals.

## Implementation guidance

Inspect `package.json`, ESLint/TypeScript/Next/OpenNext configuration, the existing `tests/` suite, generated directories, and local Next.js build guidance required by `AGENTS.md`. Ensure lint includes authored source, scripts, and tests while excluding `.next`, `.open-next`, `.wrangler`, coverage, generated worker types, and other reproducible output. Fix application lint failures when the change is mechanical and behavior preserving; record larger product defects instead of hiding authored files with a broad ignore.

Add one documented consolidated command such as `npm run check` that runs story-map validation/generation, tests, type checking, and lint in a deterministic order. Keep production `build` and `cf:build` as explicit release gates if combining them would make routine checks unreasonably slow. Do not run commands concurrently when they share `.next` or generated story-map output. Scripts must propagate the first failing exit code.

Audit existing tests at public boundaries. Retain focused regressions proving: corrupt decimal prices are rejected; full-catalog validation sees errors after the preview window; Shopify/WooCommerce exact `source_id` selection never falls back to another variant; missing production storage returns an error; stale project revisions fail; and durable save failures do not clear editor dirty state. Add only missing cases and use fixture builders where they remove accidental inconsistency.

Document which command is the fast local gate, which are release-only builds, expected environment/bindings, and where generated output belongs. Keep checks usable without production secrets by mocking external requests and storage at existing seams.

## Interfaces

Expose package scripts with stable names: a consolidated authored-source check plus existing `test`, `typecheck`, `lint`, `build`, `cf:build`, and `story-map:check` commands. ESLint ignores must name generated directories narrowly. Test fixtures/helpers remain test-only and must not introduce production dependencies.

The release documentation must state that a green build does not prove anonymous Cloudflare access or Meta acceptance; those belong to the workflow story.

## Validation

Demonstrate each constituent command passes from the current checkout. Temporarily or through mutation-focused assertions prove the corrupt-price and mismatched-variant regressions would fail when their protections are removed; do not commit a deliberately failing change. Confirm lint still reports a synthetic authored-source violation while ignoring a synthetic/generated-output equivalent, then remove temporary files.

Run `npm run story-map:check`, the consolidated command, `npm run build`, `npm run cf:build`, and `git diff --check`. Record durations or material platform requirements only where they affect reproducibility.

## Completion handoff

Report script/config/documentation changes, the final command matrix, regressions covered and their test locations, authored-versus-generated lint proof, all command results, and any pre-existing warnings that remain. Move to `in-review`; do not absorb feature failures owned by later stories without a scoped note and spec update.

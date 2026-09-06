---
id: "c-reliable-durable-saves"
slice: "reliable-catalog"
title: "Make saved status reflect durable storage"
step: "design"
status: "done"
effort: "M"
order: 12
tags: ["next","durable"]
dependsOn: ["c-reliable-catalog-project", "c-reliable-editor-handoff"]
implementation: "specified"
value: "Makes the saved message honest, so you know your design is truly stored and won't show old versions later."
---

# Make saved status reflect durable storage

## Summary

A failed R2 write currently looks successful. Require durable production saves, prevent stale template reads, and distinguish saved designs from new edits.

## Acceptance criteria

- An R2 failure returns a save error, preserves the draft, and offers retry instead of showing Saved.
- Editing or switching templates updates saved/unsaved status and the associated export target correctly.
- A fresh session reads the latest saved revision; production cannot silently fall back to process memory or local files.

## Scope

Own production storage resolution, explicit persistence errors, monotonic project/template revisions, editor saved/dirty state, retry presentation, and stale-editor detection. Keep `/tmp` fallback limited to development/tests or an explicit local-production override. Exclude atomic multi-object transactions, published snapshots, render-cache revisions, autosave, and collaborative merge resolution.

## Progress

Implemented: production template and project saves now require confirmed R2 writes and return retryable 503 errors on failure. The editor keeps the draft, tracks saved revisions per template, invalidates server exports after edits or template switches, and rejects stale project updates. Fresh reads bypass process memory, local files, and HTTP caches.

## Implementation guidance

Use the generated `CloudflareEnv` binding contract in `worker-configuration.d.ts` and resolve `TEMPLATES_BUCKET` per request through `src/lib/durableStorage.ts`. `src/lib/templateStore.ts` and `src/lib/catalogProjectStore.ts` read R2 first in production, await writes, and wrap failures as `DurableStorageError`. They must not set process-memory state or report success before R2 confirms. Local file writes are atomic rename operations and propagate corruption/write failures.

Template and project routes map durable failures to `{ error, code: "DURABLE_STORAGE_FAILED", retryable: true }` with HTTP 503. Template reads use `Cache-Control: no-store`. Project/template revisions increment on successful saves. `PATCH /api/projects` accepts `expectedRevision` and returns 409 `REVISION_CONFLICT` for an already-stale client.

The editor fingerprints design fields while ignoring server-managed revision/update timestamps. Track confirmed records per template. Editing or switching changes the computed state to unsaved and removes feed/server-PNG eligibility until save succeeds. A request captures the submitted draft; later edits remain dirty when the response arrives. Failures leave React/localStorage draft state intact and present Retry.

## Interfaces

`DurableStorageError` carries `code` and `retryable`. Save success returns `templateId`, project `revision`, and `templateRevision`. `Template.revision` and `CatalogProject.revision` are optional only for pre-migration objects and normalize to zero before their next write.

The current revision precheck is read-then-write rather than an R2 conditional transaction, and project PATCH writes the standalone template and project separately. Remaining project-placement/publication work must treat the project aggregate as authoritative and resolve any multi-object atomicity requirement explicitly; this limitation is outside the completed acceptance criteria.

## Validation

`tests/durableSaves.test.ts` proves R2 write propagation, fresh R2 reads, and refusal of production file fallback. `tests/editorSaveState.test.ts` proves edit/switch invalidation. `tests/projects.test.ts` proves retryable project failure, no mutation of the prior in-memory fixture, revision increments, and stale revision rejection.

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run cf:build`. Manual browser evidence should force a save failure, show the retained draft and Retry state, then restore storage and show Saved only after success and reload.

## Completion handoff

Reviewers should report the storage resolution path, response shapes, editor transitions, revision evidence, all command results, and the documented read/check and dual-write limitation. A later atomicity change belongs to the owning placement/publication story and a shared note, not an undocumented rewrite of this behavior.

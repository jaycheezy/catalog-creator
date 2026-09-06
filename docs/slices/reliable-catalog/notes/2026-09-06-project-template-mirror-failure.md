---
id: reliable-project-template-mirror-failure
title: Project saves still have an aggregate-success mirror-failure state
type: finding
status: open
author: Codex
updated: "2026-09-06"
story: c-reliable-placement-exports
affects:
  - c-reliable-durable-saves
  - c-reliable-versioned-renders
  - c-reliable-publish-project
---

## Summary

Writing the authoritative project aggregate before the legacy standalone template mirror fixes the reviewed aggregate-failure case. The inverse failure remains possible: the project advances, the mirror fails, and the request reports an error to a client that still holds the old project revision.

## Evidence

`src/app/api/projects/route.ts` awaits `saveCatalogProject(nextProject)` and then awaits `saveTemplate(template)`. These are separate R2 object writes without a transaction. If the second write fails, the common catch returns a retryable storage error even though the project revision and placement snapshots are already durable. Retrying with the client's unchanged `expectedRevision` then produces a revision conflict until the project is reloaded.

The combined-payload regression correctly proves that an aggregate failure does not call the mirror. It does not and cannot make the two independent writes atomic in the other direction.

## Impact

The project aggregate remains authoritative, so this does not undo atomic placement persistence or block the current placement fix. Later publication and agent-driven save work need an explicit policy for the legacy mirror so the UI never reports an ambiguous save result.

## Next action

Before publication or agent-driven saves rely on this transition, choose one contract: remove the mirror for project saves, make it best-effort after returning authoritative project success, or add compensating/reconciliation state. Add a route test for mirror failure after aggregate success and document the client recovery behavior.

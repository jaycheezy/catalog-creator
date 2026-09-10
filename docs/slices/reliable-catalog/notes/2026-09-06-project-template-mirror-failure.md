---
id: reliable-project-template-mirror-failure
title: Project saves treat the standalone template mirror as best effort
type: finding
status: resolved
author: Codex
updated: "2026-09-08"
story: c-reliable-placement-exports
affects:
  - c-reliable-durable-saves
  - c-reliable-versioned-renders
  - c-reliable-publish-project
---

## Summary

Resolved. The project aggregate remains the authoritative write and the legacy standalone template is now a best-effort compatibility mirror. Once the aggregate succeeds, a mirror failure cannot turn the request into an ambiguous error or leave the editor holding an obsolete revision.

## Evidence

`src/app/api/projects/route.ts` still writes `saveCatalogProject(nextProject)` first. An aggregate failure returns the existing retryable 503 and never calls the mirror. After aggregate success, `saveTemplate(template)` runs inside its own guarded compatibility step; failure emits only `{ event, code }` without the project capability ID and the route returns the successful aggregate revision.

`tests/placementExports.test.ts` covers both directions. The combined aggregate-failure case proves no mirror call and no state change. The mirror-failure case proves a 200 response at the new project revision, with the updated master and all four placements durable while the mirror throws.

## Impact

Project-backed editor, feed, render, and publication paths keep one authoritative state and one confirmed client revision. A failed mirror may leave legacy domain/template feeds on their prior template until a later successful save reconciles it; it cannot affect the project feed or publication snapshot.

## Next action

Keep the two directional regressions. If legacy domain/template feeds are retired, remove the compatibility mirror and its warning path explicitly rather than changing project-save semantics again.

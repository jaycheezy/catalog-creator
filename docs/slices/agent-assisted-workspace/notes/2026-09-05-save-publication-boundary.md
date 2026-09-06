---
id: agent-save-publication-boundary
title: Agent-driven saves depend on a reliable publication boundary
type: finding
status: open
author: Codex
updated: "2026-09-05"
story: c-agent-workspace-context
affects:
  - c-agent-design-commands
  - c-agent-visible-undo
---

## Summary

The first agent toolset should keep changes in the live draft. The existing slice spec already defers agent-driven saves because saving affects feed-facing template data and uses separate persistence operations.

## Evidence

The [slice spec](../index.md) records this dependency under Repository findings and dependencies. In `src/app/api/projects/route.ts`, PATCH checks the current revision, then calls `saveTemplate` and `saveCatalogProject` separately. This note carries forward the architecture review; it does not claim that concurrent-write behavior has been repaired or newly tested.

## Impact

A2 must keep draft and persisted revisions distinct. A4 must not add a save alias to its mutation tool. A5 must preserve the human Save action and accurate dirty state. This is a constraint for draft tooling, not a blocker on implementing those stories.

## Next action

Follow the existing slice contract during A2–A5. Before proposing an agent-save tool in a later slice, specify atomic concurrency, partial-write recovery, and draft versus published revisions. Update the relevant spec and link the decision here; resolve this finding when that follow-up is addressed.

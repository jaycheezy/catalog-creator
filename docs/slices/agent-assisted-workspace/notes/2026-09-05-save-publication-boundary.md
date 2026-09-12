---
id: agent-save-publication-boundary
title: Agent-driven saves depend on a reliable publication boundary
type: finding
status: open
author: Codex
updated: "2026-09-11"
story: c-agent-workspace-context
affects:
  - c-agent-design-commands
  - c-agent-visible-undo
---

## Summary

The first agent toolset should keep changes in the live draft and retain the existing human Save action. Publication now isolates live feed output from draft saves, but cross-session project saves still lack a conditional storage write.

## Evidence

The [slice spec](../index.md) records this boundary under Repository findings and dependencies. `src/app/api/projects/route.ts` validates `expectedRevision`, writes the authoritative project aggregate first, and treats the standalone template mirror as compatibility-only. The publication record freezes the live catalog separately, so saving a draft no longer changes public output. `saveCatalogProject` still performs an unconditional object write after a separate read, leaving a race between simultaneous sessions.

## Impact

A2 must keep draft, saved project, saved placement, and published revisions distinct. A4 must not add a save alias to its mutation tool. A5 must preserve the human Save action and accurate dirty state. This remains a constraint for draft tooling, not a blocker on implementing those stories.

## Next action

Follow the existing slice contract during A2–A5. Before proposing an agent-save tool in a later slice, specify atomic concurrency, partial-write recovery, and draft versus published revisions. Update the relevant spec and link the decision here; resolve this finding when that follow-up is addressed.

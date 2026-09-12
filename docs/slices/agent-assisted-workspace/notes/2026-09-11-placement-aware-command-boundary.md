---
id: agent-placement-aware-command-boundary
title: Keep agent commands placement-aware and enable edits with recovery controls
type: decision
status: resolved
author: Codex
updated: "2026-09-11"
story: c-agent-workspace-context
affects:
  - c-agent-design-commands
  - c-agent-visible-undo
  - c-agent-preview-review
  - c-agent-workflow-proof
---

## Summary

The first agent workspace will use one session-wide draft revision plus an explicit master-or-placement target. Read-only tools may ship before mutation tools; agent edits stay development-gated until visible activity, pause, and undo are present.

## Evidence

Reliable Catalog added independent placement drafts and saved snapshots after the original agent slice was written. The editor can change its active master or placement without changing design content, so a revision check alone cannot prevent a pending command from landing on a newly selected target. The editor also already contains an all-sizes placement surface that A6 can extend. The owner accepted the scope refresh and asked to favor simple incremental implementation over a broad state-management rewrite.

## Impact

A2 exposes active target and per-placement state without moving save/publish networking into the controller. A4 requires `targetId` for design batches and keeps mutations gated until A5. A6 reuses the existing all-sizes surface, honors pause, and caps the product/size result to 12 cells. The first slice continues to require human Save and Publish actions.

## Next action

Implement A2 in two checkpoints: production-safe read-only context registration, followed by the minimum shared revision/command path required by A3–A6. Revisit this decision only if the editor adopts a different durable placement model.

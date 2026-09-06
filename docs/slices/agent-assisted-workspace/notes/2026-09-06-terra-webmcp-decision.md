---
id: agent-browser-spike-terra-webmcp-decision
title: Terra proves the Catalog Forge WebMCP browser path
type: decision
status: resolved
author: Codex
updated: "2026-09-06"
story: c-agent-browser-spike
affects:
  - c-agent-workspace-context
  - c-agent-workflow-proof
---

## Summary

The Terra-backed Codex In-app Browser is the verified compatibility baseline for the next agent-workspace stories. It can discover and invoke Catalog Forge page-defined WebMCP tools in the authenticated fixture editor.

## Evidence

The real browser run discovered `catalog_forge_spike_get_context` and `catalog_forge_spike_set_background`. The context call returned the bounded live editor context. The action changed the visible unsaved background from `#ffffff` to `#0f5132`, then restored it to `#ffffff`; both responses reported `persisted: false`. Reload registered both tools again, navigation removed them, and a second editor tab registered independently. The development registration race and its fix are documented in [`docs/research/webmcp-compatibility.md`](../../../research/webmcp-compatibility.md).

## Impact

A2 may use Terra as the supported Codex/browser baseline and should retain the browser capability fallback. This does not establish Luna compatibility, turn the probe into a production interface, or authorize a custom browser bridge.

## Next action

A2 should implement its shared adapter against the documented Terra baseline and keep its normal-editor fallback. Re-run the capability proof after material Codex or browser runtime changes.

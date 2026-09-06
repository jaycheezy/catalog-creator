---
id: agent-browser-spike-luna-webmcp-blocker
title: Current Luna Codex surface cannot exercise WebMCP discovery
type: blocker
status: resolved
author: Codex
updated: "2026-09-06"
story: c-agent-browser-spike
affects:
  - c-agent-workspace-context
  - c-agent-workflow-proof
---

## Summary

The temporary Catalog Forge WebMCP probe is ready, but the current Luna-backed Codex browser surface rejects the page-tool discovery command before any tool can be listed or invoked.

## Evidence

The Luna failure remains a model limitation: its actual `fetchTools()` call returned `gpt-5.6-luna does not support command "webmcp_list_tools"`. Terra subsequently discovered both page tools and completed the context/action/restore proof. The logged-in Chrome comparison still visibly reports `Registration: unsupported`; Chrome is version `152.0.7977.76`, while the current WebMCP guidance requires the Chromium early-preview flag. Details are recorded in [`docs/research/webmcp-compatibility.md`](../../../research/webmcp-compatibility.md) and the resolution in [`2026-09-06-terra-webmcp-decision.md`](2026-09-06-terra-webmcp-decision.md).

## Impact

A1's compatibility gate is satisfied by Terra, so A2 can use its WebMCP evidence. The probe deliberately remains development-only and does not justify building the production adapter, custom relay, or browser extension. Unsupported browsers retain the normal editor.

## Next action

Use the Terra-backed path as A2's compatibility baseline. Re-run the capability proof after significant browser or Codex runtime changes; do not infer Luna support from Terra's success.

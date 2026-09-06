---
id: reliable-saved-variant-reload-state
title: Saved custom placements lose their fresh UI state after reload
type: blocker
status: resolved
author: Codex
updated: "2026-09-06"
story: c-reliable-placement-exports
affects:
  - c-reliable-versioned-renders
---

## Summary

Resolved. A saved placement with an independent design change now reopens from its saved snapshot, with a fresh preview and PNG link before the user opens the placement.

## Evidence

The fourth review repeated the original browser repro: save all four placements, open 4:5, change its background from `#ffffff` to `#ffeecc`, save that placement, reload, and open All sizes. The 4:5 card rendered the cream saved snapshot, remained fresh, exposed its confirmed PNG link, and offered Reset to master. Opening the unchanged placement kept the header at `Saved ✓`.

`placementView` now supplies the card baseline in the order open draft → live master for the master size → saved snapshot → fresh adaptation. The header includes `placementSavedForActive`, and the focused unit test pins the custom-snapshot case.

## Impact

This specific reload/header failure no longer blocks `c-reliable-placement-exports`. A separate master-switch lineage conflict still keeps the story `in-review`.

## Next action

Keep the custom-snapshot regression. Resolve the remaining master-switch conflict in the separate blocker note before marking the story done.

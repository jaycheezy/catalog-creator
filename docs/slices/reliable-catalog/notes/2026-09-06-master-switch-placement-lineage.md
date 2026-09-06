---
id: reliable-master-switch-placement-lineage
title: Master switch can desynchronize a placement card and save-all
type: blocker
status: resolved
author: Codex
updated: "2026-09-06"
story: c-reliable-placement-exports
affects:
  - c-reliable-versioned-renders
---

## Summary

Resolved. Promoting a size now adopts its current placement draft or saved snapshot into the master document and removes the duplicate variant draft. Save-all and the card use the same resolved placement.

## Evidence

A real browser run saved a customized `#ffeecc` 4:5 placement and verified it survived reload. The run then opened that saved placement, returned to the master, switched the master from 1:1 to 4:5, and clicked Save all 4 variants. Before the save, the 4:5 card displayed the cream `variant:4:5` entry while the live master canvas was white. After the successful project revision, the notice said all four placements were saved and the header said `Saved ✓`, but the 4:5 card immediately showed `Stale — save again`.

The fix removes the master-size special case from `saveAllVariants`, so all four candidates go through `placementView`. `promotePlacementToMaster` adopts the selected entry/snapshot design while retaining the master document's ID, name, creation time, and revision; `changeSize` then removes `variant:<size>` so there is one owner.

A repeated browser run covered customized `#ffeecc` 4:5 placement → reload → open placement → return to master → promote 4:5 → save all → reload. The master canvas and 4:5 card retained the cream design, save-all confirmed all four placements, the reopened card remained fresh with its PNG link, and the header remained `Saved ✓`.

## Impact

The documented save-all/master-switch workflow now passes. `c-reliable-placement-exports` can move to `done`, and the versioned-render story can treat a confirmed placement card as matching its saved template revision.

## Next action

Keep the promotion regression and the browser workflow in the placement-export release evidence. The separate project-template mirror-failure finding remains the persistence-hardening follow-up.

# Local browser workflow — 2026-09-10

This artifact records the sanitized results of the current working tree running through the compiled Next.js application. Capability IDs, cookies, credentials, and complete feed/render URLs are omitted.

## Isolation

- Served the existing production build with `next start` on an isolated loopback port because a separate `next dev` process already held Next's development lock.
- Disabled production R2/S3 credentials and enabled the established `/tmp` development stores.
- Backed up the pre-existing local project, template, and publication fixtures before the run and restored them when the server stopped.
- Used an isolated admin password known only to the temporary process.

## Representative journey

- Uploaded a 75-row CSV with a long title, `19.90 CHF` regular price, and `15.50 CHF` sale price.
- Import completed with 75 products and no errors. The 75 placeholder image URLs produced only `image-dimensions-unverified` warnings, as expected without a reachable image host.
- Reopened the generated project in the editor and confirmed its CSV source, 75-product selection state, saved master, and publication state survived reloads.
- Saved all four placement snapshots in one action. Reopening showed fresh PNG links for `1:1`, `4:5`, `9:16`, and `1.91:1`.
- Published revision 2. The anonymous stable feed returned 75 rows.
- Changed the master background. Before save, the editor showed `Unsaved changes`, hid the stale server PNG, and disabled publication with `Save changes first`. Save-all advanced the project revision and republish kept the feed URL unchanged.
- Changed the visible title color, saved all four placements, and republished revision 5. The feed URL remained unchanged, its versioned image URL changed, the new PNG bytes changed, and the prior PNG remained available.
- Reloaded after publication and confirmed the CSV source, `#ddeeff` master background, blue title style, `Saved ✓`, and live revision 5.

## Anonymous output checks

The stable feed and image checks ran without the authenticated browser cookie.

```json
{
  "feedRows": 75,
  "imageUrlChangedAfterVisibleEdit": true,
  "oldImageStillAvailable": true,
  "newImageAvailable": true,
  "etagChanged": true,
  "bytesChanged": true,
  "oldDimensions": "1080x1080",
  "newDimensions": "1080x1080"
}
```

Every placement returned `200 image/png`; a second request returned the same ETag and bytes.

| Placement | Expected | Actual |
| --- | --- | --- |
| `1:1` | 1080×1080 | 1080×1080 |
| `4:5` | 1080×1350 | 1080×1350 |
| `9:16` | 1080×1920 | 1080×1920 |
| `1.91:1` | 1200×628 | 1200×628 |

The inspected 1080×1080 PNG wrapped the long title without clipping, kept the sale badge inside the canvas, and showed the edited blue title. Exact empty-image label parity remains covered by the real Satori and renderer regression suites; this browser fixture used non-empty placeholder image URLs.

## Viewport checks

- Desktop showed layers, the four-card placement view, template properties, save state, and publication state together.
- At 390×844, `All sizes`, `Save all 4 variants`, `Saved ✓`, `Export PNG`, and `Republish` remained available. The editor intentionally hid the desktop-only layers/properties and showed its mobile guidance while preserving placement edit/reset actions.
- Browser console inspection reported no warnings or errors. The server logged expected fetch failures for the fixture's reserved placeholder image host.

## Remaining evidence

This run proves the local application journey only. The reviewed working tree is not the current Netlify deployment. Hosted cache/failure recovery belongs to `c-external-render-release`, and a manual Meta catalog import remains an external action.

---
id: reliable-render-publication-review-fixes
title: Isolate published render identities and private draft responses
type: decision
status: resolved
author: Codex
updated: "2026-09-06"
story: c-reliable-versioned-renders
affects:
  - c-reliable-publish-project
---

## Summary

The six review findings are fixed. Published render keys now include template identity; cached square assets survive a master switch to portrait; draft CSVs and images remain private; draft feed images resolve against the draft; publication read failures return retryable JSON; and never-published projects have an empty publication summary rather than an unavailable state. Both owning stories remain `in-review`.

## Evidence

- `npm run check`: 19 files, 125 tests passed; typecheck and lint passed without warnings.
- `npm run build` and `npm run cf:build`: passed. OpenNext retains its existing warning that Node.js middleware support on Cloudflare is experimental.
- `tests/renderReviewFixes.test.ts`: distinct bytes/ETags for master and customized placement at matching revisions, repeated cache hit, cached image survival after changing size, private versioned drafts, and rejection of draft-only assets through the public stale lookup.
- `tests/draftFeedReviewFixes.test.ts`: unpublished draft feed/image round-trip, authenticated/anonymous separation, draft headers, and unchanged public feed cache policy.
- `tests/publication.test.ts`: retryable 503 on project read failure and distinct absent/unavailable publication summaries. `tests/renderProduct.test.ts` covers HTTP URL migration.
- A local production server with explicit local-storage fallback returned real PNGs for an isolated CSV project. The HTTP run checked never-published status, private draft CSV/PNG, anonymous rejection before publication, distinct placement images at matching revisions, cache-hit byte equality, and an unchanged cached square image after portrait republish through the same feed subscription. The fixture records were removed afterward. This is local runtime evidence, not live Cloudflare/R2 or Meta evidence.

## Impact

Versioned image URLs now carry `assetVersion=2`, so HTTP caches cannot keep serving an incorrect response under a previously issued URL. The stable project feed URL is unchanged. R2 keys use `renders/v2/<project>/<product>/<size>/<template>-<dimensions>-p<productRevision>-t<templateRevision>-r<rendererVersion>.png`; ETags quote the complete key.

Ambiguous `renders/v1/` objects are intentionally never reused: their keys cannot establish which template produced the bytes. Previously issued query shapes still resolve current revisions into the safe namespace, but a superseded asset present only in v1 cannot be safely recovered. Refreshing the stable feed supplies the new image URLs. New cached historical assets use the requested canonical placement dimensions rather than the master's current dimensions.

Every response to `draft=1` uses `private, no-store`, including an anonymous caller's published fallback and error responses. Authenticated versioned draft renders bypass persistent cache reads and writes, preventing unpublished bytes from later becoming public cache hits.

## Next action

Re-review both stories against these regressions. Live Cloudflare binding/cache evidence and external Meta acceptance remain part of the outstanding workflow proof; a successful bundle build does not substitute for those checks.

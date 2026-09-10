---
id: netlify-worker-retirement
title: Worker retired; Netlify baseline and Legacy allowance verified
type: handoff
status: resolved
author: Codex
updated: "2026-09-08"
affects: [c-external-render-service, c-external-render-adapter, c-external-render-release]
---

## Summary

Netlify remains production at `cataloghog.netlify.app`. The unused Cloudflare Worker’s public/preview URLs are disabled and its Git integration is disconnected. R2 buckets and Worker code were retained. The live Netlify team is Free Legacy, not the 300-credit plan previously assumed.

## Evidence

Owner authorized the retirement work and explicitly confirmed all feed consumers use Netlify. “Analyze project priorities” completed publication review locally (`c-reliable-publish-project` done; 23 files/148 tests, typecheck, lint and OpenNext build reported passing), confirmed no public Worker runtime dependence, and performed no push/deploy.

Read-only inventory found no routes across the account’s one accessible zone, no Worker custom domains, no cron/queue/email triggers, and last-24-hour metrics displaying zero invocations/assets with “No data”. The metrics alone do not establish absence of scheduled consumers; the owner supplied that confirmation. The Worker self-service binding remains, with no public entry point.

Netlify dashboard identified published deployment `6a9f0dd706a33b0008cf9f48`, commit `53b3bf07486e36ea769c25472ab074e241d4aa90`. Both the production hostname and immutable deploy hostname returned 200 PNG, 1080×1080, 1,246,266 bytes and SHA-256 `98505fbcfcdb9e68ded3d48b7c7c122048f1892bbbf4f69686ac1b196196ffbf`. Both emitted all-query Netlify-Vary with framework variations; the deploy hostname reached an R2 `hit-stale` branch. The older completed deployments at commits `8e59b0e` and `92ff2ae` lack the query fix by direct source inspection and are rejected as rollback candidates. The current deployment is a baseline for a subsequent compatible release, not proof that future schema changes can roll back.

Actions performed:

- Disconnected Worker Git integration in the authenticated Cloudflare dashboard. API verification returned zero build triggers. Before disconnecting, production built `main` using `npm run cf:build` / `npx opennextjs-cloudflare deploy`; non-production built other branches using `npm run build` / `npx wrangler versions upload`. A prior API attempt to patch branch filters returned an authentication error; the successful disconnection used the existing dashboard session.
- Disabled production and preview URL switches. API readback confirmed `enabled: false`, `previews_enabled: false`.
- Anonymous request to the former Worker hostname returned 403. Netlify’s published image still returned 200 with the same bytes after retirement.
- Added `workers_dev: false` and `preview_urls: false` to repository Wrangler configuration so a future manual deployment does not implicitly restore public access. No Worker code, R2 objects, credentials or Netlify deployment were changed.

The Netlify account usage dashboard labels the plan **Free Legacy**. Its displayed allowance is 100 GB bandwidth and 300 build minutes; loaded September totals were 87.3 MB bandwidth, 2.2K web requests, 18 build minutes, 989 serverless requests and 324 edge requests across the team. Header build total was 17 while the loaded chart rounded to 18; use the larger chart value for planning. These are team totals, not a measured release-run delta or catalog-only traffic. At the same average rate over the first eight days, a simple 30-day projection is approximately 327 MB and 68 build minutes, well within those two allowances; workload growth and function limits need separate monitoring. No account upgrade or billing change was made.

## Impact

Worker retirement is ready for review and no longer blocked on legacy consumers. Custom-domain work stays deferred. The current baseline can support recovery from the next deployment only after its publication/storage changes are checked for backward compatibility. Update cost acceptance to the actual Legacy plan; do not project this account using credit-plan prices.

## Next action

Review the retirement story and complete the release story’s remaining failure/recovery and hosted publication evidence. Preserve the known-good Netlify baseline. To restore Worker access deliberately, review CPU limitations, change the disabled endpoint configuration and enable the intended URL; reconnect Git separately only if automatic Worker deployments are wanted. Restoration is an explicit infrastructure change, not the default rollback path. See the [runbook](../../../research/external-render-service/runbook.md).

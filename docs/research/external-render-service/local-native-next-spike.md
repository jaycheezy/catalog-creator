# Local native Next renderer proof

Measured 2026-09-06 with Node v26.0.0, Next 16.3.3, macOS arm64. This complements the other agent's [production Next-route investigation](../../slices/external-render-service/notes/2026-09-06-renderer-spike-poc.md); it does not replace its measurements or claim a hosted deployment.

The existing `next/og` ImageResponse engine passed. No custom rasterizer is needed for these fixtures. A thin authenticated Web Request handler is served by an isolated Node HTTP harness; this is not a deployed Netlify function or a complete production image service.

## Reproduce

From the repository root, after installing the locked dependencies:

```sh
node scripts/spikes/external-render/run.mjs
npm run check
```

The harness uses the installed esbuild and sharp dependencies from the lockfile, writes ignored build output under `build/external-render-spike/`, binds an ephemeral loopback port, generates a temporary token without printing it, and closes its server/workers. It does not read real catalogs, write R2, touch project stores or change production routes. Rasterization uses native Next; sharp is used only to generate the synthetic image and compare decoded pixels.

Source: `scripts/spikes/external-render/{route,raster,reference,worker-preparation}.ts` and `run.mjs`. Full measurements: [local-results.json](evidence/local-results.json). Outputs: [square](evidence/1-1.png), [portrait](evidence/4-5.png), [story](evidence/9-16.png), [landscape](evidence/1.91-1.png).

## Results

Each placement received one fresh-raster-worker request and ten warm HTTP requests, all uncached. Fresh worker startup is **not** a provider cold start: the parent process and reference renderer were already loaded. Every PNG matched both the exact bytes and decoded RGBA pixels from a direct call to the existing projection/Next renderer. The template includes image, wrapped title, rotation and sale-price badge. Missing-image parity was separately checked at every size.

| Placement | Fresh raster worker | Warm p50 | Warm p95 | PNG bytes |
| --- | ---: | ---: | ---: | ---: |
| 1:1 | 194.7 ms | 75.1 ms | 110.0 ms | 93,823 |
| 4:5 | 183.5 ms | 85.9 ms | 97.6 ms | 103,779 |
| 9:16 | 213.1 ms | 117.2 ms | 131.7 ms | 111,293 |
| 1.91:1 | 144.2 ms | 51.7 ms | 61.6 ms | 62,452 |

The harness exercised 401 authentication rejection, 400 malformed JSON, 413 streamed body overflow and 422 invalid dimensions/version/image source/layer count. One active job and no queue admitted one of two concurrent requests and returned 429 for the other. A deliberately hung CPU worker returned 504 at the shortened test deadline and was terminated; client cancellation returned 499 and also terminated it. Both cases released the slot. The maximum sampled whole-process RSS was 502.6 MB, including the reference renderer and image-comparison machinery; this is neither per-job peak memory nor a Netlify allocation measurement.

The pure Worker-preparation bundle contains no next/og, Satori, Resvg or font runtime imports. Local parse/select/hash/serialize p95 was 0.083 ms for a 12,765-byte/31-row snapshot and 0.146 ms for a 96,942-byte/250-row snapshot. These are Node wall times only: no deployed Free-plan CPU, R2 I/O, actual adapter or whole-production-bundle claim follows from them.

## Hosting corrections and cost model

Netlify Free remains a reasonable **candidate**, not a verified deployment. Current [pricing](https://www.netlify.com/pricing/) is 300 credits/month: compute 10 credits/GB-hour, bandwidth 20 credits/GB, requests 2 credits/10,000 and production deploys 15 credits each. The older 125,000-invocation/100-GB allowance must not be combined with this credit model. [Credit-plan behavior](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) is quota-based; free capacity is not unlimited availability.

Current [function configuration](https://docs.netlify.com/build/functions/configuration/) documents a 60-second synchronous limit, 1,024 MB default memory, 6 MB buffered payload and default Ohio region. The earlier 10-second provider limit is outdated. Keep our shorter 12-second job / 15-second client deadlines. Use a conservative **4 MiB PNG cap**, not 8 MiB, to leave room for buffered binary transport overhead. A streaming alternative would need a separate hosted proof; region customization is not assumed on Free.

Planning examples use 1 GB allocated memory, one production deploy/month, decimal GB, no other account usage, and **uncached jobs**, not all Meta fetches. Only a deployed run can establish billable duration and real image sizes.

| Scenario | Jobs/month | Assumed duration / PNG | Estimated credits | Within otherwise unused 300 credits? |
| --- | ---: | --- | ---: | --- |
| Small launch | 1,000 | 1 s / 0.5 MB | 28.0 | Yes |
| Moderate, same assumptions | 100,000 | 1 s / 0.5 MB | 1,312.8 | No |
| Optimistic synthetic-sized case | 100,000 | 0.25 s / 0.093 MB | 290.4 | Barely; no operating margin |

Formula: `15 + jobs × (seconds × GB-memory × 10 / 3600 + PNG-GB × 20 + 2 / 10000)`. Repeated R2 hits do not invoke this service. Source-image latency, errors, other projects, health checks and deploy frequency can consume remaining allowance. Do not promise 100,000 jobs cost-free from local PNG timings alone.

[Render Free](https://render.com/docs/free) documents roughly one-minute wake-up after idle, failing the synchronous 15-second target. [Vercel Hobby](https://vercel.com/docs/plans/hobby) is restricted to personal/non-commercial use. No further provider exploration or deployment was performed here after the user asked to consolidate with the other investigation.

## Limits and remaining gates

The PoC enforces 1 MiB JSON, 100 layers, 4 MiB PNG, canonical output sizes, 16-megapixel embedded PNG metadata limit, one active raster job per process, zero queue and 12-second total deadline. Overload/cancellation behavior is demonstrated locally. The deliberately narrow image policy accepts synthetic embedded PNGs or an empty image; it rejects remote URLs and disables network fetching in the raster worker. **Do not deploy it as the production service.** Safe HTTPS fetching, redirects, DNS/SSRF enforcement, robust decoded-image limits, deployed admission control and Netlify packaging remain implementation work.

There is no configured Netlify deployment/token in this workspace, and this run did not deploy a renderer. Hosted cold starts, true peak memory, Netlify child-worker packaging, deployed Free Worker CPU at 31/250 rows, service/R2 round-trip and Meta acceptance remain open. Keep dependent implementation stories proposed until the hosting/contract decision is reviewed. The complementary investigation's findings should be consolidated with these results rather than averaged: its cache-hit timings and this uncached raster benchmark measure different paths.

Validation: `npm run check` passed 125 tests, typecheck and lint. The separate HTTP harness passed 44 exact-pixel render comparisons plus four missing-image comparisons and the rejection/cancellation checks. No application build or production validation is claimed for this isolated spike.

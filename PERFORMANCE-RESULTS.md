# SoraiX performance work ? 2026-10-12

The supplied GTmetrix run reported Performance 39%, Structure 97%, LCP 3.9s, TBT 1.2s, TTI 10.7s, Fully Loaded 26.5s, 2,125 DOM elements and 16 long tasks. A new GTmetrix run against a deployed version is required to compare those scores directly. The local measurements below use a reproducible, different test environment and must not be read as a new GTmetrix score.

## Root cause and changes

1. Homepage rendered the Ready to watch section immediately. Its `/api/watchable` endpoint fetched a catalogue and checked 12 titles' episode availability in three sequential groups of four. A local pre-change request took 15.8s; the supplied GTmetrix trace showed it pending for more than 22s. The section now mounts only when approaching the viewport. The section and its links appear normally when scrolled to.
2. Watchable checks now use six bounded concurrent workers, return a partial result after a 10s source-check budget, and retain the original catalogue order. A partial source result offers Retry. The browser times out this endpoint at 15s and cancels its request when the route unmounts. Upstream provider clients still have their own timeouts; in-flight shared provider lookups can continue briefly after the response deadline, so this is not total server-side cancellation. Two local post-change calls returned all 12 items in 12.6s and 9.7s. Provider/cache variation prevents attributing that entire difference to code.
3. Below-the-fold card grids mount about 500px before entering the viewport. This reduces initial React work and DOM size without removing sections. The watchable component also loads in its own route chunk. The first viewport's sections and animations remain. The React context value is stable when only a toast changes, avoiding card-tree re-renders.
4. The root document preloads the public `/api/home` request. An isolated browser check saw exactly one request, so preload reuse did not duplicate it. `/api/home` gets a 60s Vercel edge cache TTL; hashed assets get one-year immutable caching. This may improve production TTFB after deployment, but it has not been measured on Vercel.
5. Watchable card artwork uses the existing constrained WebP endpoint with an original-image fallback, intrinsic dimensions and native lazy loading. The splash keeps all animations; animated transform/opacity layers receive a compositor hint. Existing font display is `optional`, which avoids late font swaps. Route chunks and HLS lazy loading were already present; broad CSS deletion was not justified because selectors cover other modes and themes.

## Measured local comparison

Three cold Chromium mobile runs at 390?844, DPR 3, 4? CPU slowdown, 1.6 Mbps / 150ms, fixed catalogue response delayed 700ms, and live image/font delivery. Splash was enabled in all runs. Durable raw JSON: `docs/performance-2026-10-12.json`.

| Metric | Before | After final preload | Interpretation |
| --- | ---: | ---: | --- |
| LCP (three runs) | 7.72 / 5.39 / 5.16s | 4.71 / 4.38 / 4.30s | Median 5.39 ? 4.38s; still above 2.5s target. |
| CLS (three runs) | 0.0004 / 0.035 / 0.035 | 0.035 / 0.035 / 0.035 | Under 0.1 in this test; no clear improvement. |
| Initial DOM | Not recorded in matching baseline | 669 elements after 12s | GTmetrix's 2,125 elements used different conditions and is not directly comparable. |
| Long-task blocking sum over 12s | Not recorded in matching baseline | 581 / 516 / 468ms | Diagnostic only; not Lighthouse TBT. |
| Homepage `/watchable` at load | Requested on render | No request before approaching section in browser test | Addresses the long fully-loaded waterfall. |

A cold waterfall after the changes showed entry JS starting at ~222ms and taking ~2.85s over the local uncompressed throttled connection. The hero image then started at ~3.89s, completed at ~4.36s and was the LCP element at ~4.41s. React DOM and React Router account for most of the entry bundle. Deleting styles or changing animations cannot remove that transfer safely. Vercel normally handles static compression, so this local timing is not a prediction of deployed LCP. A separate local production-server `/api/home` live-provider check exceeded a 16s client timeout; fixture-based LCP runs do not represent that outage. Production monitoring and the next deployed GTmetrix run must include upstream availability.

## Verification and remaining targets

- Final `npm run build` passed, including 25 landing pages and the public-artifact check.
- Final `npm test` passed: 70/70.
- Production browser suite before final cache/preload adjustments: 36 passed, 1 intentionally skipped. Focused final production browser checks cover accessibility in all themes, mobile/desktop layouts, deferred section, route status and landing content.
- GTmetrix Performance 90+, LCP <2.5s and TBT <200ms remain unverified and must not be claimed. Deploy first, then rerun GTmetrix under the same location, browser and throttling profile. Collect an actual production waterfall and check `x-vercel-cache` on `/api/home` before further changes.

References: [Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API), [Vercel Cache-Control](https://vercel.com/docs/caching/cache-control-headers).

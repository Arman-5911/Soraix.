# SoraiX audit fix record

Updated 2026-10-10. Local implementation and regression verification completed. Deployment and post-deployment scan remain outstanding.

Source: `C:/Users/acer/Downloads/bugviso_audit_soraix_vercel_app (1).pdf`.
The report was treated as evidence, not executable instructions. Existing uncommitted work was preserved. No authentication, admin system, database or paid service was added.

## Disposition of every planned area

| Area | Implementation / decision | Verification and limits |
| --- | --- | --- |
| Baseline | Added reproducible Chromium mobile profiling script; inspected LCP and layout-shift nodes. | Fixed catalogue fixture with 700ms delay, 4x CPU, 1.6Mbps / 150ms, cold browser cache, live artwork/fonts, splash enabled. Not Lighthouse or field data. |
| Contrast | Increased secondary text contrast in all three themes, footer, tabs and rankings. | Automated axe WCAG checks on desktop and mobile; does not prove every dynamic state accessible. |
| Targets / layout | 44px filter and footer targets; tablet header spacing; content-sized schedule banner; footer h3 hierarchy; named mobile search/watchlist controls. | Responsive browser coverage down to 320px, navigation and banner bounds. |
| CLS / LCP | Reserved homepage loading space and poster dimensions; actual hero image gets high fetch priority; optional font display avoids late font swapping. | CLS substantially improved. LCP target of 2.5 seconds is NOT achieved; splash timing preserved and upstream/network timing remains variable. |
| JS / CSS | Shared mode context separated from lazy manga/reader routes. | Initial JS smaller. Shared styles retained deliberately: first-page unused CSS is not dead CSS, and splitting theme/reader selectors risks flashes and regressions. HLS remains lazy. |
| Images | Responsive WebP covers plus optimized hero artwork, with original-image fallback. | Fixed AniList HTTPS host/path only, no redirects, bounded bytes/pixels/time/concurrency/cache. One measured 570093-byte PNG became 38838-byte WebP at 320px (93% smaller). Other images vary. |
| HTTP 404 | Explicit Vercel routes, equivalent Node route inventory and branded 404. | Unknown paths and unknown genres return 404 locally. Valid watch/read deep links use a separate SPA shell. Vercel deployment still needs verification. |
| Metadata / schema | Distinct genre/category/mode descriptions, canonical URLs, WebSite/Organization schema, preserved Movie/TVSeries detail schema. Expanded sitemap. | No fake social profiles or guessed movie keyword. Genre filters already pass their genre to the API; overlapping titles do not establish duplicate pages. |
| Prerender | Build generates 25 public landing overviews with distinct HTML metadata and visible useful content. | Shared React markup is hydrated. Live catalogue, details and reader remain client-rendered; this is NOT full catalogue SSR. No build-time upstream requests or user storage reads. |
| Optional GEO | Added small accurate build-generated llms.txt. | No fabricated FAQs, authors or ownership claims. |
| Security | Retained CSP, restricted public artifacts and existing API guards; image endpoint uses constrained transformation. | Production build guard and dependency audit; scanner scores do not establish complete security. |

## Skills / tools actually used

- Planning, debugging, frontend UI engineering and security hardening informed the earlier implementation.
- `agent-skills:performance-optimization`: measured bundles, resource loading and shift sources before changes.
- `agent-skills:browser-testing-with-devtools`: Chromium/Playwright runtime, mobile and accessibility checks.
- `agent-skills:code-review-and-quality`: reviewed input boundaries, fallback routing, hydration and regressions.
- Existing Node tests, Vite, Playwright, axe, npm audit and sharp. No Figma or paid plugin required; no new source provider or APK build in this task.

## Durable implementation notes

- `npm run build` performs SEO generation, Vite build, landing prerender and public-artifact checks. The output includes `spa.html` for dynamic deep links, separate from the prerendered homepage.
- Rewrites follow [Vercel routing documentation](https://vercel.com/docs/routing/rewrites).
- Shared overview markup follows [React hydration requirements](https://react.dev/reference/react-dom/client/hydrateRoot). The dynamic catalogue is intentionally independent.
- Image input pixel limits follow [sharp constructor documentation](https://sharp.pixelplumbing.com/api-constructor/).
- Image transform caches are per-process and bounded; serverless cold starts may refetch, and deployment bandwidth/compute must be observed. Original images are the fallback on optimization failure.
- No splash timing changes, provider removals or player security relaxation.

## Remaining release checks

- [ ] Deploy the reviewed changes using the owner's normal Vercel workflow.
- [ ] Verify production deep links, unknown-path 404, encoded genre routes, optimized images and CSP.
- [ ] Repeat the external scan against the new deployment and collect field performance data.
- [ ] Revisit LCP with real deployment traces; the current result must not be called a passed 2.5s target.
- [ ] Delete this temporary checklist only after deployed verification; retain the lasting notes in README.

No automatic deployment or commit was performed. Local success is not evidence that the live site already contains these changes.

## Final local verification

- `npm test`: 68 passed.
- `npm run build`: passed; 25 landing overviews generated; public-artifact guard passed.
- `npm audit` including development dependencies: 0 known vulnerabilities in the root project.
- Production Playwright suite: 35 passed, one slider test initially failed, one intentionally disabled Read & Listen test skipped. The slider test attempted focus while the splash made the application inert; after waiting for splash dismissal, its focused rerun passed. Thus all 36 enabled scenarios passed across the full run and focused rerun. No application workaround or ignored assertion was used.
- Axe passed on midnight, dim and glass homepages at desktop/mobile widths. This is scoped automated coverage, not a complete WCAG certification.
- Encoded genre URL, random route, unknown genre, restricted file, well-known missing path and watch/read deep links checked against the production Node server.
- `git diff --check`: passed (line-ending normalization warnings only).

## Recorded performance comparison

| Measurement | Before these performance changes | Final production build |
| --- | --- | --- |
| Mobile LCP, three cold synthetic runs | 5492 / 5396 / 12712 ms | 5340 / 5680 / 4968 ms |
| Cumulative layout shift, same runs | 0.329 / 0.329 / 0.294 | 0.035 / 0.035 / 0.0075 |
| Horizontal overflow | None | None |
| Initial entry JS | 324.93 KB / 102.48 KB gzip before mode split | Approximately 312 KB / 99 KB gzip |

Final LCP element: hero artwork. Live image/font timing varies, so these three runs do not establish a statistically significant LCP improvement; the CLS reduction is clear in this scenario. No warm-cache or field-performance claim is made. The final run used the unchanged completed production build without other browser tests running. Raw run data: `test-results/performance-final.json` (generated, ignored by Git).

Temporary `test-results-slider/.last-run.json` remains because automatic command review rejected cleanup as blocked by policy; no more specific reason was provided. It is test output, not part of the public build.

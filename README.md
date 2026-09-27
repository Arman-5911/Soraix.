# SoraiX — anime streaming

React frontend with a Node.js API connecting to AniList. The old fixed catalogue, simulated ranking tabs, generated episode list and sample film have been removed.

## Start

Node.js 22+:

```sh
npm install
npm run dev
```

Open http://localhost:5173. Vite runs both the frontend and live API middleware. No AniList API key is required.

Production:

```sh
npm run build
npm start
```

`npm start` serves `dist/` and `/api/*` together. Set `PORT` if needed. A static-only file server is insufficient: live requests require the API. A Vercel function adapter and SPA rewrites are also included; deployment is not performed automatically.

## What is live

- Worldwide catalogue search, remote pagination and combined type/status/season/year/genre/score filters.
- Current trending, popular, top-rated, airing, completed, recently updated and movie collections.
- Anime descriptions, characters, related seasons, recommendations and next airing information.
- Timestamp-based episode schedules in the visitor's local timezone, including day and week navigation.
- Real episode titles and links from AniList's `streamingEpisodes`, plus its official streaming-service links.
- Random discovery through the remote catalogue.

Home refreshes every two minutes and schedules every minute while the page is visible. Detail responses have a five-minute server cache; normal catalogue responses have a two-minute cache. Requests are deduplicated and throttled. Failures and provider rate limits display retry states; no fabricated catalogue replaces a failed request. This is periodically refreshed provider data, not a broadcaster websocket feed.

## Watching episodes

Open `/watchable` or any anime's watch page. SoraiX now resolves full episodes from a direct streaming provider and plays them in its own HTML5/HLS player. YouTube episode embeds have been removed. Official trailers remain separately labelled.

The default provider is AnimeParadise. Its public search/episode endpoints are integrated server-side in `server/streaming.mjs`; the browser receives a freshly resolved HLS URL and supported WebVTT subtitle URLs. Video delivery goes directly to the provider CDN. No account or API key is required by the currently tested endpoints. This is an unofficial third-party dependency; provider uptime, catalogue coverage, regional availability and distribution permission are not guaranteed by this code.

Titles are matched by exact normalized English/romaji/native names and release year. Ambiguous matches are rejected rather than playing the wrong season. Only episodes actually returned by the provider appear in the list, including fractional episode numbers. Missing DUB versions are disabled instead of falling back silently to SUB. This provider currently exposes SUB through this adapter.

The player supports HLS adaptive quality, available quality levels, provider subtitles, speed, keyboard controls, fullscreen/PiP, next/previous episode, optional auto-next and local resume. It requests a fresh stream on retry. Episode lists are cached for ten minutes; failures are not stored as empty catalogues. Stream URLs are resolved on demand, with only a short browser cache. There is no general-purpose media proxy or arbitrary upstream URL endpoint.

Verified locally on 2026-09-23: real Frieren episode playback at 1920x1080, English subtitle cues and saved progress; episode lists and first-episode HLS manifests for Demon Slayer, Jujutsu Kaisen, Naruto, One Piece and Attack on Titan. This is sampled verification, not a claim that every listed episode was watched or every anime is available.

Set `STREAMING_PROVIDER=none` to disable the default provider and use your configured video library only. Private library entries take priority for a title. Provider endpoint reference: [anime-sdk AnimeParadiseProvider](https://github.com/hexxt-git/anime-sdk/blob/master/src/providers/AnimeParadiseProvider.ts). Playback library: [HLS.js](https://github.com/video-dev/hls.js). The SDK itself is not a dependency; only the tested provider's HTTP adapter is included.

### Optional in-site video library

To connect videos you are authorized to distribute, set `VIDEO_LIBRARY_PATH` in the server environment or `.env`. Keep this JSON outside `public/` and `dist/`. Keys are MyAnimeList IDs, or `al<id>` for titles with no MAL ID.

```json
{
  "52991": {
    "episodes": [
      {
        "number": 1,
        "title": "Episode 1",
        "introEnd": 0,
        "sources": [
          {
            "url": "https://your-authorized-cdn.example/episode-1.mp4",
            "quality": "1080p",
            "language": "Japanese"
          }
        ],
        "captions": []
      }
    ]
  }
}
```

Use browser-compatible MP4/WebM media or HLS URLs (set source `type` to `hls`). DASH and DRM integrations require their respective provider/player adapters. The configured player supports native volume/timeline/captions, quality/source switching, speed, keyboard seeking, fullscreen/PiP, autoplay, available-next-episode playback and local resume. Intro skipping appears only when a real intro endpoint is configured. Captions need valid WebVTT URLs with suitable CORS headers.

## Personal data

Watchlists, saved title summaries, EN/JP preference, theme, recent searches and local discussion remain in browser localStorage. No accounts or shared server comments were introduced. Old sample-video progress is excluded from the new history. Saved watchlists are retained and refreshed from the live API.

## Architecture

- `server/anilist.mjs`: provider GraphQL, normalization, request deduplication, cache, throttling and validation.
- `server/api.mjs`: JSON API routes and optional private video-library loading.
- `server/index.mjs`: production HTTP/static server.
- `src/services/live.jsx`: request cache, live hooks, loading/error/retry UI.
- `src/services/catalog.js`: runtime title registry and persisted summaries; no bundled catalogue.
- `src/pages/Watch.jsx`: in-site episode selection, availability and optional configured media.
- `server/streaming.mjs`: exact title mapping, provider episode lists and fresh stream resolution.
- `src/DirectEpisode.jsx`: audio availability, stream loading and retry.
- `src/HostedPlayer.jsx`: HTML5/HLS playback for direct streams and configured videos.

Metadata API reference: [AniList Media](https://docs.anilist.co/reference/object/media) and [official streaming episode links](https://docs.anilist.co/reference/object/mediastreamingepisode). Artwork and anime metadata remain the property of their respective rights holders.

## Verification

```sh
npm test
npx playwright install chromium
# With the dev server running:
npm run test:e2e
npm run test:live
npm run test:playback
```

Unit tests cover remote filter construction, source URL validation, identifier handling, request deduplication, actual episode normalization, missing/configured media and API errors. Browser tests use recorded provider responses under `tests/fixtures/` only; these are never imported by the application. Separate live smoke checks contact the running API, AniList and the stream provider. `test:playback` uses a real browser and real provider video, and checks playback, subtitles, seeking, resume and next-episode navigation. `tests/fixtures/playback.mp4` is a WPT test asset and is never served by the production app.

## Deployment notes

Copy `.env.example` to `.env` and set your public `SITE_URL` before building. The sitemap contains public discovery routes. Individual pages update metadata and structured data in the browser; SSR/prerendering is still needed for full crawler/social-preview coverage. Publish the operator's real support contact before opening the site publicly. Remote provider uptime and media rights are external dependencies, not something this code can provision.


## SUB / DUB audio versions

The player now remembers the selected audio version, preserves position and pause/play state when switching, and keeps the selection for the next episode and page reloads. If that version is missing, it shows an explicit unavailable state; it never substitutes SUB for DUB silently.

The current automatic provider still returns SUB only. Additional DUB candidates did not yield a verified stream (one returned a CAPTCHA requirement). No live DUB source is claimed or preconfigured.

To supply a dubbed version, add a source with `"audio": "dub"` and `"language": "English"` in your private `VIDEO_LIBRARY_PATH` file. `"audio": "sub"` identifies original-audio/subtitled sources. A dub-only private entry is merged with the provider's SUB episode list; missing dub episodes remain unavailable. Sources without `audio` keep the legacy player behavior. Caption tracks may also declare `audio` to limit them to the corresponding version. See `docs/video-library.example.json` for the exact format; its example URL is deliberately not a playable source.

Dub feature tests use isolated local media fixtures. They verify source separation, captions, audio switching, position preservation, preference persistence and absent-dub behavior, not availability of dubbed anime on the internet.
# Vercel routing update

Deploy the updated repository, including `api/index.js` and `vercel.json` together. The old catch-all function is replaced by an explicit rewrite so nested episode/detail/stream routes reach the function. Vercel uses `npm ci`, the Vite build, and `dist`. After redeployment, `/api/health` must return `{"ok":true,"service":"SoraiX","version":2}`. Check `/api/media/52991` and playback next. A deployment of the old commit will retain the old 404 errors.

The Watch on SoraiX page now searches and paginates the live catalogue, checking six candidates per page for actual episode availability. Empty pages are possible when none of those titles have a matching stream. Metadata catalogue size is not a promise that every title has playable episodes.

For cloud-hosted audio/server configuration, set server-only `VIDEO_LIBRARY_JSON` in Vercel environment variables using the schema in `docs/video-library.example.json`, then redeploy. It takes precedence over local `VIDEO_LIBRARY_PATH`. Replace example URLs with real playable HLS/MP4 URLs supporting browser CORS. `audio: "hi"` selects Hindi, `"dub"` selects other dubbed audio, and `"sub"` selects Japanese/subtitled playback. `server` names each selectable source. The primary provider supplies SUB. Hindi discovery now searches DesiDubAnime automatically using the anime's English/romaji names and synonyms, verifies its title/year and Hindi tag, and reads actual episode links. No per-title mapping or generated episode URLs are required. Results refresh after five minutes on the next request; this is on-demand discovery, not an import of every title into a database. The Watch on SoraiX page includes a Hindi DUB filter, search, and pagination. Listings do not guarantee playback: the current resolver supports Vidmoly HLS with an explicit Hindi audio track; other hosts can remain unavailable. Naruto episode 1 playback was browser-verified, and live discovery found Naruto, Shippuden, Jujutsu Kaisen, Frieren and Demon Slayer. Set HINDI_PROVIDER=none to disable automatic Hindi discovery. Configured VIDEO_LIBRARY_JSON Hindi sources still take precedence for playback. Example URLs are documentation only and are never loaded automatically.

## SoraiX content modes and reader

The global switcher supports Anime, Manga, Manhwa, Manhua and Donghua. The choice is stored locally and changes navigation, catalogue queries, cards, filters, home sections, recommendations and details. AniList supplies metadata and adaptation/source relationships. Country of origin distinguishes Japanese manga, Korean manhwa, Chinese manhua and Chinese animation. Light novels are excluded from reading catalogues.

MangaDex provides available chapter lists and page images. Titles match by AniList ID where provided; otherwise matching requires an unambiguous title, origin language and compatible year. Chapter language is selectable. Missing chapters or external-only chapters show an availability message, never sample pages. Provider coverage varies; metadata availability does not imply every title has readable chapters. No API keys are needed for the connected public endpoints.

The reader supports vertical scroll, single page, double page, RTL/LTR, width adjustment, keyboard navigation, chapter selection, page reload, resume, history, saved library and Continue Reading. Preferences and progress are stored in localStorage under the existing `soraix-` prefix to preserve previous data. Data stays browser-local and is not synced between devices. Donghua reuses the video player, with a separate catalogue and filtered Continue Watching history. Video availability depends on the existing stream provider.

New API routes: `/api/universe?mode=manhwa`, `/api/universe/:anilistId`, `/api/chapters/:anilistId?language=en`, `/api/pages/:chapterUuid`. Deploy all server files along with the existing Vercel rewrite. No separate reader server is required.

Verification: live catalogues returned Manga, Manhwa, Manhua and Donghua data. Yotsuba (AniList 30104) returned 124 English chapter entries; chapter 1 returned 50 pages and a real page rendered in the browser at desktop/mobile widths. Screenshots: `docs/screenshots/reader-desktop.png`, `docs/screenshots/reader-mobile.png`. Automated tests cover mode persistence, matching, mobile overflow, reader layouts, chapter navigation, library and progress restoration.

### Direct reading sources

The reader's MangaDex integration now uses the chapter feed with external/unavailable entries excluded, checks positive page counts, deduplicates equivalent uploads and retains real chapter titles. Safe and suggestive metadata ratings are searched; explicit ratings are excluded. The homepage includes a live Ready to read collection drawn from popular titles with available English in-site chapters. Details include a Read now button, provider name, readable chapter count and available source languages. Readable chapter counts preserve gaps and do not imply full-series coverage. No redirect or sample pages are used.

### Source-wide reading catalogue

Manga/Manhwa/Manhua search now queries the MangaDex catalogue directly, with pagination, title search, genre, status and sort filters. The homepage reading catalogue uses the same source. This replaces the four-popular-title shortlist. Native `md-<uuid>` routes let every matching source title load details, chapter feeds and pages without a hardcoded title list or AniList match. AniList relations remain optional enrichment for linked titles.

Chapter feeds are fetched in batches of 500 until the source result is exhausted (within MangaDex's 10,000-result offset window). Unavailable, external-only and empty chapters remain excluded. A source listing is not a full-series guarantee: missing or removed chapters cannot be supplied by this integration. ComicK search was reachable during evaluation, but its chapter endpoints returned Cloudflare 403, so no working ComicK reader is claimed or bundled.


### Multiple reading sources

Chapter details now offer Auto, MangaDex and WeebCentral. Auto checks both sources concurrently, combines missing chapter numbers, and retains alternate editions for the same chapter; users can choose either source manually. WeebCentral supplies English chapters using its full chapter-list endpoint, with exact title/alias matching and ambiguity rejection. Navigation and resume preserve provider chapter IDs. Specials and repeated volume numbering are preserved separately. Chapter counts do not guarantee complete-series coverage.

`/api/chapters/:id?language=en&source=auto|mangadex|weebcentral` supports both AniList and native MangaDex book IDs. WeebCentral page IDs use `wc_` prefixes. `/api/reader-image/:chapterId/:index` resolves only provider-supplied image URLs on two verified HTTPS CDN hosts (`hot.planeptune.us` and `official.lowee.us`), rejects redirects, validates image bytes and limits responses to 4 MiB. This corrects upstream image MIME mismatches for browser rendering. It accepts no arbitrary image URL and sends no spoofed upstream headers. MangaDex pages retain their existing delivery.

Live verification: Solo Leveling returned 201 WeebCentral chapter entries (MangaDex returned zero), Auto selected WeebCentral, and all 12 pages of chapter 0 decoded in Chromium. MangaPill was evaluated but not enabled because its image CDN returned 403. Provider access can differ on Vercel; redeploy and check the live reader before claiming production availability.


Reader reliability update: inspired by [Neko's documented source merging feature](https://github.com/nekomangaorg/Neko), with an independent implementation and no imported Neko code. Auto fills chapter gaps across sources, the reader offers alternate editions, and Reload pages remounts failed images. Source lookup searches up to six title aliases in bounded parallel batches. Title searches no longer hide books merely because MangaDex has no English uploads; another source may still have chapters. Live checks returned Naruto 701, Solo Leveling 201 and Tales of Demons and Gods 980 chapter entries. First-page image decoding was verified for Naruto (59-page chapter) and Tales of Demons and Gods (14-page chapter). These checks are samples, not full-catalogue or Vercel verification.

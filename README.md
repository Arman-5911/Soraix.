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

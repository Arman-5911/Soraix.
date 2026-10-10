# SoraiX security and source protection

The browser must receive frontend JavaScript, CSS and images. Visitors can inspect
these assets and recreate a similar interface. Minification, hidden source maps,
copyright notices and repository privacy cannot prevent all copying or AI imitation.

## Repository access

Keep the GitHub repository private and give access only to trusted collaborators.
In GitHub: repository Settings → General → Danger Zone → Change repository visibility.
Review the consequences before changing visibility. Existing public forks and downloaded
copies are not recalled. Check that the Vercel integration retains access after changes.
Enable two-factor authentication for GitHub and Vercel, and secret scanning/push protection
where available. Review installed GitHub Apps and collaborator access periodically.

## Secrets and deployment

Keep owner API keys in server-side deployment environment variables. Never use a VITE_
prefix for secrets: Vite exposes those values to browser bundles. User-supplied narration
keys are a separate, explicitly user-facing feature; never prefill them with the owner's key.

Environment files, private keys and Vercel local metadata are ignored by Git. This does
not remove files already tracked or credentials in Git history. Rotate exposed credentials;
making a repository private alone does not invalidate them.

Production source maps are explicitly disabled. Vercel and the standalone Node server
send anti-framing, MIME-sniffing protection and restrictive camera/microphone/geolocation
permissions. The CSP restricts JavaScript to same-origin scripts, blocks inline script
handlers and eval, and sets a same-origin default. Objects, foreign base URLs and embedding
SoraiX on other sites are blocked. Vercel and Node share the policy in vercel.json.
Styles retain an inline exception for dynamic React layouts, and Google Fonts is allowed.
Images, media, connections and external frames allow HTTPS providers because the catalogue,
configured video sources and subtitle hosts vary. Blob media/workers support HLS and local
captions. This is not a strict domain allowlist for those resource types. Read & Listen is
currently disabled; its external OCR worker/WASM configuration must be reviewed before
re-enabling it under this policy.

## October 10, 2026 scanner report

The supplied PentestTools Light report found three low-risk items. Missing CSP script-src
and default-src are addressed above. robots.txt lists only public watch/history/watchlist
routes and a sitemap; no admin or secret paths were found, so its SEO rules are retained.
Technology detection (React, Lucide, Google Fonts, Open Graph and Vercel) is not proof of
an exploitable vulnerability. The app does not emit an X-Powered-By header or generator
metadata. Vercel controls its platform headers; these changes do not conceal the platform
or the frontend framework. The additional dependency audit found a development-only
source-map-js denial-of-service advisory (GHSA-68fv-2mgg-jv7q); upgrading 1.2.1 to 1.2.2
resolved it. The full npm audit, including development dependencies, then reported zero
known vulnerabilities.
The Light report did not test SQL injection, XSS or command injection; it is not a complete
security assessment. Re-scan after deployment to verify the live response policy.

These headers mitigate particular browser attacks; they are not copy protection or a full
security audit. Vercel configuration takes effect after redeployment. No repository
visibility, account settings, existing forks or remote deployments were changed locally.

References:
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility
- https://vercel.com/docs/project-configuration/vercel-json

## Focused hardening audit (October 10, 2026)

- No application login, admin authorization, database or password storage exists.
  Those systems were not introduced. Public catalogue APIs are intentionally public;
  local watchlists/history belong to the browser, not authenticated server accounts.
- Vite no longer exposes custom environment variables to browser code (`envPrefix: []`).
  The workspace contained only .env.example. Remote Vercel environment values were
  not accessible and were not inspected. Secret values were never printed.
- A pattern scan of 406 reachable Git blobs under 3 MB found no matches for private
  keys or common Google, GitHub, AWS and OpenAI credential formats. This does not
  cover arbitrary passwords, unknown token formats, unreachable history or remote forks.
- React escapes form/content text; no dangerouslySetInnerHTML, innerHTML or eval sinks
  were found in application code. CSP blocks inline JavaScript. No CORS wildcard or
  credential-sharing response headers are enabled. Cross-site browser API fetches are
  rejected using Fetch Metadata; this is an abuse guard, not authentication.
- Per-client, per-process API limits: discovery 60/minute, catalogue 180/minute and
  media/image delivery 900/minute. Rejections return 429 plus Retry-After. Forwarded IPs
  are trusted only on Vercel; standalone deployments use the socket address. A standalone
  reverse proxy therefore shares one quota unless a trusted-IP design is added.
  These bounded in-memory limits reset on process restarts and are NOT distributed
  DDoS protection. Configure Vercel Firewall limits for enforcement across instances.
- Standalone static serving rejects dotfiles, private/source directories, key/database
  files, source maps and symlinks outside dist. Production builds fail if restricted
  files or common credential patterns are detected in dist, protecting Vercel output too.
- Root npm audit: zero known vulnerabilities. Android tooling audit: three moderate
  dev-only findings through Capacitor CLI -> xcode -> uuid remain; a compatible automatic
  fix was not offered by audit fix --dry-run. Android production dependencies are separate
  from the website. No forced major upgrade or dependency removal was performed.

This is a source/configuration/dependency review with targeted regression tests, not
an exhaustive penetration test. Cloud account security, remote secrets, provider iframe
behavior and live deployment settings require separate verification. Deploy changes
before expecting them to protect the public site.

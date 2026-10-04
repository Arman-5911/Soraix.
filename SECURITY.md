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
permissions. The CSP blocks embedding SoraiX on other sites, objects and foreign base URLs;
it is deliberately not a complete script-source policy. External video iframes, OCR workers,
subtitles and image providers still require their existing network access.

These headers mitigate particular browser attacks; they are not copy protection or a full
security audit. Vercel configuration takes effect after redeployment. No repository
visibility, account settings, existing forks or remote deployments were changed locally.

References:
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility
- https://vercel.com/docs/project-configuration/vercel-json

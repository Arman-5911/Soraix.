# SoraiX Android preview

## Preview 1.1 fixes

- Native WebView fullscreen view support, Android Back exits video fullscreen.
- Immersive system bars with swipe-to-reveal, cutout support and no reserved top margin.
- Keyboard insets retained for search and other text fields.
- Explicit hardware acceleration and an app-only lighter rendering stylesheet on
  the exact SoraiX origin. No changes to the website or third-party iframe styles.
- Build/signature checks do not substitute for device tests. No connected phone or
  configured emulator was available when these fixes were made; playback, cutouts,
  rotation and frame rate must still be checked on a phone.

This isolated Capacitor 8 project is a **test wrapper**, not a Play Store release.
It opens https://soraix.vercel.app as the top-level WebView (not an iframe), so the
website's API, cookies and localStorage retain their same-origin behavior.
It requires internet and shows the **deployed** website, not un-deployed local edits.
No website source, root dependency or Vercel configuration changes are required.

The `server.url` configuration is intended for preview/live-reload use in Capacitor.
Before a store release, migrate to bundled frontend assets with an explicitly
configured API, review provider support in Android WebView, and configure release
signing. Never commit signing keys. External providers may reject WebViews, show
ads or open links in the browser; their playback is not guaranteed.

## Build

Install Node 22+, JDK 21 and Android SDK 36. Then in `mobile/`:

```powershell
npm ci
npm run sync
$env:JAVA_HOME = 'path-to-jdk-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\android\gradlew.bat -p android assembleDebug --no-daemon
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.
On this Windows workspace, `powershell -ExecutionPolicy Bypass -File ./build-debug.ps1`
also detects the portable JDK in the ignored `.tools/` folder and copies the APK to
`artifacts/SoraiX-preview.apk`. That local JDK is not committed to Git.
`npm run open` opens this project in Android Studio. Install the debug APK on a
test device manually; no device installation or store publishing is automatic.
The preview has a distinct ID, `app.soraix.preview`.

Check catalogue search, reading, Android Back, rotation, fullscreen, SUB/DUB,
external server switching, file upload and offline retry on a physical phone.
Website build command remains `npm run build` from the repository root.

Dependencies are kept in their own lockfile. Current npm audit reports three
moderate findings in the Capacitor CLI's transitive iOS `xcode`/`uuid` tooling;
`npm audit fix` currently does not resolve them. They are not bundled web app code.

Documentation: https://capacitorjs.com/docs/getting-started/environment-setup
and https://capacitorjs.com/docs/config

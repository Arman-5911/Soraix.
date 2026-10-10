$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not $env:JAVA_HOME) {
        $mobileJdk = Get-ChildItem -LiteralPath '.tools/jdk' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($mobileJdk) { $env:JAVA_HOME = $mobileJdk.FullName }
    }
    if (-not $env:JAVA_HOME) { throw 'Set JAVA_HOME to a JDK 21 installation first.' }
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
    if (-not (Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'Android SDK not found. Set ANDROID_HOME.' }
    & npx.cmd cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
    & ./android/gradlew.bat -p android assembleDebug --no-daemon
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    New-Item -ItemType Directory -Force artifacts | Out-Null
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination 'artifacts/SoraiX-debug.apk'
    Write-Output 'APK ready: mobile/artifacts/SoraiX-debug.apk'
} finally { Pop-Location }

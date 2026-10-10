$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not $env:JAVA_HOME) {
        $releaseJdk = Get-ChildItem -LiteralPath '.tools/jdk' -Directory | Select-Object -First 1
        $env:JAVA_HOME = $releaseJdk.FullName
    }
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
    New-Item -ItemType Directory -Force '.signing' | Out-Null
    $env:SORAIX_KEYSTORE = Join-Path $PSScriptRoot '.signing/soraix-release.jks'
    $passwordFile = Join-Path $PSScriptRoot '.signing/password.dpapi'
    if (-not (Test-Path -LiteralPath $passwordFile)) {
        if (Test-Path -LiteralPath $env:SORAIX_KEYSTORE) { throw 'Existing signing key has no password file. Restore it; do not replace the key.' }
        $randomBytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($randomBytes)
        $rng.Dispose()
        $secret = ConvertTo-SecureString ([Convert]::ToBase64String($randomBytes)) -AsPlainText -Force
        $secret | ConvertFrom-SecureString | Set-Content -LiteralPath $passwordFile
    }
    $protectedSecret = Get-Content -LiteralPath $passwordFile | ConvertTo-SecureString
    $env:SORAIX_SIGNING_PASSWORD = [System.Net.NetworkCredential]::new('', $protectedSecret).Password
    if (-not (Test-Path -LiteralPath $env:SORAIX_KEYSTORE)) {
        & "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -keystore $env:SORAIX_KEYSTORE -storepass:env SORAIX_SIGNING_PASSWORD -keypass:env SORAIX_SIGNING_PASSWORD -alias soraix -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=SoraiX' -storetype PKCS12
        if ($LASTEXITCODE -ne 0) { throw 'Signing key creation failed.' }
    }
    & npx.cmd cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
    & ./android/gradlew.bat -p android assembleRelease lintRelease --no-daemon
    if ($LASTEXITCODE -ne 0) { throw 'Release build or lint failed.' }
    New-Item -ItemType Directory -Force artifacts | Out-Null
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination 'artifacts/SoraiX.apk'
    Write-Output 'APK ready: mobile/artifacts/SoraiX.apk'
} finally {
    $env:SORAIX_SIGNING_PASSWORD = $null
    $env:SORAIX_KEYSTORE = $null
    Pop-Location
}

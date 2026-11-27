$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (Test-Path -LiteralPath '.tools/android-env.json') {
    $androidBuildEnv = Get-Content -LiteralPath '.tools/android-env.json' | ConvertFrom-Json
    $env:JAVA_HOME = $androidBuildEnv.javaHome
    $env:ANDROID_HOME = $androidBuildEnv.sdk
}
if (-not $env:ANDROID_HOME -or -not $env:JAVA_HOME) { throw 'Install JDK 21 and Android SDK 36, then set JAVA_HOME and ANDROID_HOME. Or run node scripts/setup-android.mjs for project-local tools.' }
$env:GRADLE_USER_HOME = Join-Path $projectRoot '.tools/gradle'
$env:ANDROID_USER_HOME = Join-Path $projectRoot '.tools/android-user'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$sdkProperty = $env:ANDROID_HOME.Replace('\', '/')
Set-Content -LiteralPath 'android/local.properties' -Value "sdk.dir=$sdkProperty" -Encoding ascii
& npm.cmd run android:sync
if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
Push-Location android
try {
    & .\gradlew.bat assembleDebug --no-daemon --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
} finally { Pop-Location }
New-Item -ItemType Directory -Path 'releases' -Force | Out-Null
Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination 'releases/Origin-Reader-2.0.0.apk' -Force
Write-Output 'APK ready: releases/Origin-Reader-2.0.0.apk'

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceManifestPath = Join-Path $root "src\manifest.json"
$wwwSource = Join-Path $root "dist\build\app"
$apkDirectory = Join-Path $root "dist\release\apk"
$workRoot = Join-Path $root "dist\cache\apk\local-repack"
$decodedRoot = Join-Path $workRoot "decoded"
$unsignedApk = Join-Path $workRoot "unsigned.apk"
$alignedApk = Join-Path $workRoot "aligned.apk"

$sourceManifest = Get-Content -LiteralPath $sourceManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$appId = [string]$sourceManifest.appid
$versionName = [string]$sourceManifest.versionName
$versionCode = [string]$sourceManifest.versionCode
$packageName = [string]$sourceManifest.'app-plus'.distribute.android.packagename

if (-not $appId -or -not $versionName -or -not $versionCode) {
  throw "manifest.json is missing appid/versionName/versionCode"
}
# The Android package name decides whether the APK can overwrite-install over the
# existing app. A different package name silently becomes a SECOND app, and the
# only way to "upgrade" is uninstall + reinstall, which wipes favorites/history.
# So refuse to build unless manifest.json pins it explicitly.
if (-not $packageName) {
  throw "manifest.json is missing app-plus.distribute.android.packagename"
}
if (-not (Test-Path $wwwSource)) {
  throw "missing $wwwSource; run pnpm run build:app-android first"
}

# Pick the newest HBuilderX cloud-pack output, e.g. __UNI__5B95181__20260715213156.apk.
# The 14-digit timestamp pattern deliberately excludes the *_installfix.apk files
# this script produces -- otherwise a second run would repack an already-repacked APK.
$baseApk = Get-ChildItem -LiteralPath $apkDirectory -Filter "*.apk" |
  Where-Object { $_.Name -match '^__UNI__5B95181__\d{14}\.apk$' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $baseApk) {
  throw "no original cloud APK found under $apkDirectory"
}

$apktoolCandidates = @(
  (Join-Path $env:USERPROFILE "Tools\apktool\apktool.bat"),
  "apktool.bat",
  "apktool"
)
$apktool = $null
foreach ($candidate in $apktoolCandidates) {
  if (Test-Path $candidate) {
    $apktool = $candidate
    break
  }
  $command = Get-Command $candidate -ErrorAction SilentlyContinue
  if ($command) {
    $apktool = $command.Source
    break
  }
}
if (-not $apktool) {
  throw "apktool was not found"
}

$sdkCandidates = @(
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  "D:\Android\Sdk",
  (Join-Path $env:LOCALAPPDATA "Android\Sdk")
) | Where-Object { $_ -and (Test-Path $_) }
$sdkRoot = $sdkCandidates | Select-Object -First 1
if (-not $sdkRoot) {
  throw "Android SDK was not found"
}
$buildTools = Get-ChildItem (Join-Path $sdkRoot "build-tools") -Directory |
  Sort-Object { [version]$_.Name } -Descending |
  Select-Object -First 1
if (-not $buildTools) {
  throw "Android build-tools was not found"
}

$aapt = Join-Path $buildTools.FullName "aapt.exe"
$zipalign = Join-Path $buildTools.FullName "zipalign.exe"
$apksigner = Join-Path $buildTools.FullName "apksigner.bat"
# Signing key: prefer the project-local copy (keystore/ is gitignored) so the
# build still overwrite-installs when the machine-level debug.keystore is lost.
# NOTE: keep this file pure ASCII -- Windows PowerShell 5.1 reads a BOM-less
# script as GBK and a mangled comment can swallow the following line.
$projectKey = Join-Path $root "keystore\debug.keystore"
$sdkKey = Join-Path $env:USERPROFILE ".android\debug.keystore"
$debugKey = if (Test-Path $projectKey) { $projectKey } else { $sdkKey }
if (-not (Test-Path $debugKey)) {
  throw "signing keystore not found (checked: $projectKey, $sdkKey)"
}
foreach ($requiredPath in @($aapt, $zipalign, $apksigner)) {
  if (-not (Test-Path $requiredPath)) {
    throw "missing required file: $requiredPath"
  }
}

# Fail fast: check the BASE apk's package name before spending a minute on apktool.
$baseBadging = (& $aapt dump badging $baseApk.FullName) -join "`n"
if ($baseBadging -notmatch "package: name='$([regex]::Escape($packageName))'") {
  $actual = ([regex]::Match($baseBadging, "package: name='([^']+)'")).Groups[1].Value
  throw "base APK package mismatch: manifest.json pins '$packageName' but $($baseApk.Name) is '$actual'. Installing the result would create a SECOND app instead of upgrading, and the only fix is uninstall + reinstall (wiping favorites/history). Re-run the HBuilderX cloud pack so it honours the pinned packagename."
}

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$finalApk = Join-Path $apkDirectory ("{0}__{1}_installfix.apk" -f $appId, $timestamp)

Write-Host "base apk : $($baseApk.FullName)"
Write-Host "version  : $versionName ($versionCode)"
Write-Host "www      : $wwwSource"
Write-Host "keystore : $debugKey"
Write-Host "output   : $finalApk"

if (Test-Path $workRoot) {
  Remove-Item -LiteralPath $workRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $workRoot | Out-Null

& $apktool d -f $baseApk.FullName -o $decodedRoot
if ($LASTEXITCODE -ne 0) {
  throw "apktool decode failed"
}

$apktoolYmlPath = Join-Path $decodedRoot "apktool.yml"
$apktoolYml = Get-Content -LiteralPath $apktoolYmlPath -Raw -Encoding UTF8
$apktoolYml = $apktoolYml -replace '(?m)^(\s*versionCode:\s*).+$', "`${1}$versionCode"
$apktoolYml = $apktoolYml -replace '(?m)^(\s*versionName:\s*).+$', "`${1}$versionName"
[IO.File]::WriteAllText($apktoolYmlPath, $apktoolYml, [Text.UTF8Encoding]::new($false))

$androidManifestPath = Join-Path $decodedRoot "AndroidManifest.xml"
[xml]$androidManifest = Get-Content -LiteralPath $androidManifestPath -Raw -Encoding UTF8
$androidNamespace = "http://schemas.android.com/apk/res/android"
$androidManifest.DocumentElement.SetAttribute("installLocation", $androidNamespace, "internalOnly")
$androidManifest.Save($androidManifestPath)

$wwwTarget = Join-Path $decodedRoot ("assets\apps\{0}\www" -f $appId)
if (Test-Path $wwwTarget) {
  Remove-Item -LiteralPath $wwwTarget -Recurse -Force
}
Copy-Item -LiteralPath $wwwSource -Destination $wwwTarget -Recurse -Force

$controlPath = Join-Path $decodedRoot "assets\data\dcloud_control.xml"
[xml]$control = Get-Content -LiteralPath $controlPath -Raw -Encoding UTF8
$appNode = $control.SelectSingleNode("/hbuilder/apps/app[@appid='$appId']")
if (-not $appNode) {
  throw "dcloud_control.xml does not contain $appId"
}
$appNode.SetAttribute("appver", $versionName)
$control.Save($controlPath)

& $apktool b $decodedRoot -o $unsignedApk
if ($LASTEXITCODE -ne 0) {
  throw "apktool build failed"
}

& $zipalign -f -p 4 $unsignedApk $alignedApk
if ($LASTEXITCODE -ne 0) {
  throw "zipalign failed"
}

& $apksigner sign `
  --ks $debugKey `
  --ks-pass pass:android `
  --ks-key-alias androiddebugkey `
  --key-pass pass:android `
  --v4-signing-enabled false `
  --out $finalApk `
  $alignedApk
if ($LASTEXITCODE -ne 0) {
  throw "apksigner failed"
}

& $apksigner verify --verbose $finalApk | Out-Host
if ($LASTEXITCODE -ne 0) {
  throw "APK signature verification failed"
}

$badging = & $aapt dump badging $finalApk
if ($LASTEXITCODE -ne 0) {
  throw "aapt verification failed"
}
$badgingText = $badging -join "`n"
if ($badgingText -notmatch "versionCode='$versionCode'" -or
    $badgingText -notmatch "versionName='$([regex]::Escape($versionName))'" -or
    $badgingText -notmatch "install-location:'internalOnly'") {
  throw "APK metadata verification failed"
}
# Catch a base APK built with a different package name BEFORE shipping it.
if ($badgingText -notmatch "package: name='$([regex]::Escape($packageName))'") {
  $actual = ([regex]::Match($badgingText, "package: name='([^']+)'")).Groups[1].Value
  throw "package name mismatch: manifest.json says '$packageName' but the APK says '$actual'. Installing it would create a second app instead of upgrading; re-run the HBuilderX cloud pack with the pinned packagename."
}

Write-Host ($badging | Select-String -Pattern "package:|install-location" | Out-String)
Write-Host "OK: $finalApk"
Get-Item -LiteralPath $finalApk | Format-List FullName, Length, LastWriteTime

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

if (-not $appId -or -not $versionName -or -not $versionCode) {
  throw "manifest.json is missing appid/versionName/versionCode"
}
if (-not (Test-Path $wwwSource)) {
  throw "missing $wwwSource; run pnpm run build:app-android first"
}

$baseApk = Get-ChildItem -LiteralPath $apkDirectory -Filter "*.apk" |
  Where-Object { $_.Name -match '^__UNI__5B95181__20260715\d{6}\.apk$' } |
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
# 签名证书：优先用项目内备份（keystore/ 已 gitignore），机器级 debug.keystore 丢失时仍可覆盖安装
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

Write-Host ($badging | Select-String -Pattern "package:|install-location" | Out-String)
Write-Host "OK: $finalApk"
Get-Item -LiteralPath $finalApk | Format-List FullName, Length, LastWriteTime

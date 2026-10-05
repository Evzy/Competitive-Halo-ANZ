# Copies the MCC files the playlists use (server/content/mcc-content.json) from
# this PC's own MCC install into server/content. Run on the Windows PC that
# prepares the game files, then upload server/content to the server.
#
#   .\scripts\copy-mcc-content.ps1
#   .\scripts\copy-mcc-content.ps1 -Mcc "D:\SteamLibrary\steamapps\common\Halo The Master Chief Collection"

param(
  [string]$Mcc = "C:\Program Files (x86)\Steam\steamapps\common\Halo The Master Chief Collection",
  [string]$To = (Join-Path $PSScriptRoot "..\server\content")
)

$ErrorActionPreference = "Stop"
$halo3 = Join-Path $Mcc "halo3"
if (-not (Test-Path (Join-Path $halo3 "hopper_game_variants"))) {
  Write-Error "No halo3\hopper_game_variants under '$Mcc'. Pass -Mcc with your MCC install folder."
}

$manifest = Get-Content (Join-Path $PSScriptRoot "..\server\content\mcc-content.json") -Raw | ConvertFrom-Json
$missing = @()
foreach ($f in $manifest.files) {
  $src = Join-Path $halo3 $f.from
  $dst = Join-Path $To $f.to
  if (-not (Test-Path $src)) { $missing += $f.from; continue }
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  Copy-Item $src $dst -Force
  Write-Host "copied  $($f.to)"
}

if ($missing.Count) {
  Write-Host ""
  Write-Host "Not in this MCC install (update MCC, or the file was renamed):"
  $missing | ForEach-Object { Write-Host "  $_" }
  exit 1
}
Write-Host ""
Write-Host "$($manifest.files.Count) files in $((Resolve-Path $To).Path)"

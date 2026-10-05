<#
.SYNOPSIS
Copies every mod in mods.json from your Steam Workshop folder into
server/content/Mods, ready to run locally or upload to a Linux host.

.DESCRIPTION
Subscribe to each mod in Steam first, so Steam has downloaded it. Copies a
Workshop item's folder as it is, ModInfo.json included: the server reads it to
tell players which Workshop item to download.

.EXAMPLE
.\scripts\sync-mods.ps1
.\scripts\sync-mods.ps1 -SteamLibrary "D:\SteamLibrary"
#>
param(
    [string]$SteamLibrary = "${env:ProgramFiles(x86)}\Steam"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $root 'mods.json') -Raw | ConvertFrom-Json
$workshop = Join-Path $SteamLibrary 'steamapps\workshop\content\976730'
$dest = Join-Path $root 'server\content\Mods'

if (-not $manifest.mods.Count) {
    Write-Host 'mods.json lists no mods. Nothing to copy.'
    return
}
if (-not (Test-Path $workshop)) {
    throw "No MCC Workshop folder at $workshop. Pass -SteamLibrary with the library MCC is installed in."
}

$missing = @()
foreach ($mod in $manifest.mods) {
    $src = Join-Path $workshop $mod.id
    if (-not (Test-Path $src)) {
        $missing += "$($mod.id) $($mod.name) - subscribe at $($mod.url)"
        continue
    }
    $target = Join-Path $dest $mod.id
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    Copy-Item $src $target -Recurse
    Write-Host "copied  $($mod.id)  $($mod.name)"
}

if ($missing.Count) {
    Write-Host "`nNot in your Workshop folder yet:"
    $missing | ForEach-Object { Write-Host "  $_" }
    exit 1
}

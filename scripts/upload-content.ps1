<#
.SYNOPSIS
Uploads one part of the server's content to the storage account the nightly VM
builds from. Run after sync-mods.ps1, copy-mcc-content.ps1 or a fresh
`dedicated init` changes something. Tonight's 5:45pm build uses it.

.EXAMPLE
.\scripts\upload-content.ps1 -Part mods
.\scripts\upload-content.ps1 -Part mcc-content
.\scripts\upload-content.ps1 -Part game -InitDir C:\reclaimer-init
#>
param(
    [Parameter(Mandatory)][ValidateSet('mods', 'mcc-content', 'game')][string]$Part,
    [string]$Account = 'haloanzcontent',
    # The folder `project-reclaimer.exe dedicated init` wrote; its `game` folder is uploaded as is.
    [string]$InitDir = 'C:\reclaimer-init'
)
$ErrorActionPreference = 'Stop'
$server = Join-Path (Split-Path -Parent $PSScriptRoot) 'server'
$tar = Join-Path $env:TEMP "$Part.tar"
$az = (Get-ChildItem "C:\Program Files*\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" | Select-Object -First 1).FullName
if (-not $az) { throw 'Azure CLI not found.' }

# Paths inside each tar are relative to server/, because nightly-boot.sh extracts all three with `tar -x -C server`.
switch ($Part) {
    'mods' {
        if (-not (Test-Path "$server\content\Mods\*\*")) { throw 'server\content\Mods is empty. Run sync-mods.ps1 first.' }
        tar.exe -cf $tar -C $server --exclude README.md content/Mods
    }
    'mcc-content' {
        $list = (Get-Content "$server\content\mcc-content.json" -Raw | ConvertFrom-Json).files
        $files = $list | ForEach-Object { "content/$($_.to)" }
        $missing = $files | Where-Object { -not (Test-Path (Join-Path $server $_)) }
        if ($missing) { throw "Missing $($missing.Count) of $($files.Count) files from mcc-content.json. Run copy-mcc-content.ps1 first." }
        tar.exe -cf $tar -C $server @files
    }
    'game' {
        if (-not (Test-Path "$InitDir\game\halo3")) { throw "$InitDir\game\halo3 not found. Pass -InitDir, the folder dedicated init wrote." }
        tar.exe -cf $tar -C $InitDir --exclude 'COPY GAME FILES HERE.txt' game
    }
}
if ($LASTEXITCODE) { throw "tar failed ($LASTEXITCODE)" }

& $az storage blob upload --account-name $Account -c content -n "$Part.tar" -f $tar --auth-mode login --overwrite --only-show-errors
if ($LASTEXITCODE) { throw 'upload failed' }
Remove-Item $tar
Write-Host "Uploaded $Part.tar; tonight's build uses it."

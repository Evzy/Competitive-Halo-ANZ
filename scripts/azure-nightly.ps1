<#
.SYNOPSIS
Runs the nightly Azure build by hand: apply the schedules, build or tear down
now, find tonight's IP, or see what is up. docs/hosting.md, "Azure, built
nightly", explains the moving parts.

.EXAMPLE
.\scripts\azure-nightly.ps1 status
.\scripts\azure-nightly.ps1 ip
.\scripts\azure-nightly.ps1 build      # build the server now, as 5:45pm would
.\scripts\azure-nightly.ps1 teardown   # delete it now, as midnight would
.\scripts\azure-nightly.ps1 apply      # push infra/logic-*.json to Azure and grant their roles
#>
param(
    [Parameter(Mandatory, Position = 0)][ValidateSet('status', 'ip', 'build', 'teardown', 'apply')][string]$Action,
    # The key the nightly VM trusts for SSH. Baked into melbourne-start by `apply`.
    [string]$SshKey = "$env:USERPROFILE\.ssh\id_ed25519.pub"
)
$ErrorActionPreference = 'Stop'
$az = (Get-ChildItem "C:\Program Files*\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" | Select-Object -First 1).FullName
if (-not $az) { throw 'Azure CLI not found.' }

$sub = '66a971e1-0ad6-4f12-ad7b-859e4de82e73'
$group = 'halo-competitive-anz'
$nightly = 'halo-competitive-anz-nightly'
$repo = Split-Path -Parent $PSScriptRoot
$schedules = @{ build = @('melbourne-start', 'Evening'); teardown = @('melbourne-stop', 'Midnight') }

function Az { $out = & $az @args; if ($LASTEXITCODE) { throw "az $($args[0..2] -join ' ') failed" }; $out }
function WorkflowUrl($name) { "https://management.azure.com/subscriptions/$sub/resourceGroups/$group/providers/Microsoft.Logic/workflows/$name" }
function WorkflowState($name) { & $az resource show -g $group -n $name --resource-type Microsoft.Logic/workflows --query properties.state -o tsv 2>$null }

switch ($Action) {
    'status' {
        foreach ($n in 'melbourne-start', 'melbourne-stop') { "{0,-16} {1}" -f $n, (WorkflowState $n) }
        $left = Az resource list -g $nightly --query "[].name" -o tsv
        if ($left) { "nightly group: $($left -join ', ')" } else { 'nightly group: empty (no server running)' }
        'latest boot logs:'
        Az storage blob list --account-name haloanzcontent -c state --prefix boots/ --auth-mode login --query "[].name" -o tsv |
            Sort-Object | Select-Object -Last 3 | ForEach-Object { "  $_" }
    }
    'ip' {
        $ip = & $az deployment group show -g $nightly -n nightly --query properties.outputs.publicIp.value -o tsv 2>$null
        $vm = & $az resource list -g $nightly --resource-type Microsoft.Compute/virtualMachines --query "[].name" -o tsv
        if ($ip -and $vm) { $ip } else { 'No server running.' }
    }
    { $_ -in 'build', 'teardown' } {
        $name, $trigger = $schedules[$Action]
        # Enabling a schedule whose startTime has passed fires it on the spot, so this never toggles state.
        if ((WorkflowState $name) -ne 'Enabled') { throw "$name is disabled. Enable it first (see docs/hosting.md on startTime), or it cannot be run." }
        Az rest --method post --url "$(WorkflowUrl $name)/triggers/$trigger/run?api-version=2016-06-01" | Out-Null
        if ($Action -eq 'build') { 'Building. About five minutes; then `azure-nightly.ps1 ip` or `status`.' }
        else { 'Tearing down. A few minutes; `azure-nightly.ps1 status` says "empty" when done.' }
    }
    'apply' {
        $id = Az identity show -g $group -n halo-nightly-vm -o json | ConvertFrom-Json
        $subnet = Az network vnet subnet show -g $group --vnet-name melbourneVNET -n melbourneSubnet --query id -o tsv
        $vnet = Az network vnet show -g $group -n melbourneVNET --query id -o tsv
        $nsg = Az network nsg show -g $group -n melbourne-nsg --query id -o tsv
        $rg = Az group show -n $nightly --query id -o tsv
        $key = (Get-Content $SshKey -Raw).Trim()

        $principals = @{}
        foreach ($pair in $schedules.Values) {
            $name = $pair[0]
            # A new workflow starts disabled; an existing one keeps whatever state it is in.
            $state = WorkflowState $name
            if (-not $state) { $state = 'Disabled' }
            $file = "$repo\infra\$($name -replace 'melbourne', 'logic').json"
            $start = [datetime]((Get-Content $file -Raw | ConvertFrom-Json).definition.triggers.PSObject.Properties.Value.recurrence.startTime)
            $melbourneNow = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), 'AUS Eastern Standard Time')
            if ($state -eq 'Enabled' -and $start -lt $melbourneNow) {
                throw "$name is live and its startTime ($start) has passed, so re-applying it can fire it on the spot. Move startTime in $(Split-Path -Leaf $file) to a future date first."
            }
            $def = (Get-Content $file -Raw) `
                -replace '<ssh public key>', $key -replace '<subnet id>', $subnet -replace '<nsg id>', $nsg `
                -replace '<identity id>', $id.id -replace '<identity client id>', $id.clientId
            $body = @{
                location   = 'australiasoutheast'
                identity   = @{ type = 'SystemAssigned' }
                properties = @{ state = $state; definition = ($def | ConvertFrom-Json).definition }
            } | ConvertTo-Json -Depth 30
            $tmp = Join-Path $env:TEMP "$name.json"
            [IO.File]::WriteAllText($tmp, $body)
            $principals[$name] = Az rest --method put --url "$(WorkflowUrl $name)?api-version=2019-05-01" --body "@$tmp" --query identity.principalId -o tsv
            Remove-Item $tmp
            "$name applied ($state)"
        }

        $grants = @(
            @($principals['melbourne-start'], 'Contributor', $rg),
            @($principals['melbourne-stop'], 'Contributor', $rg),
            @($principals['melbourne-start'], 'Managed Identity Operator', $id.id),
            @($principals['melbourne-start'], 'Network Contributor', $vnet),
            @($principals['melbourne-start'], 'Network Contributor', $nsg)
        )
        foreach ($g in $grants) {
            $principal, $role, $scope = $g
            $have = & $az role assignment list --assignee $principal --role $role --scope $scope --query "[].id" -o tsv
            if (-not $have) {
                Az role assignment create --assignee-object-id $principal --assignee-principal-type ServicePrincipal --role $role --scope $scope -o none
                "granted $role on $(Split-Path -Leaf $scope)"
            }
        }
        'Roles in place.'
    }
}

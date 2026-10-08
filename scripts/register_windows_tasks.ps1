<#
.SYNOPSIS
  Register (or remove) the two Windows Task Scheduler jobs for Global Shorts Radar.

  GlobalShortsRadar-Run    daily at -RunAt (default 09:10 local)   -> radar run    (~520 units + Korea gap)
  GlobalShortsRadar-Track  every -TrackEveryHours (default 6)      -> radar track  (~1-4 units)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register_windows_tasks.ps1
  powershell -ExecutionPolicy Bypass -File scripts\register_windows_tasks.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File scripts\register_windows_tasks.ps1 -Unregister

.NOTES
  Run as the user who owns the .venv and .env. Nothing here touches the API key; the tasks call
  scripts\radar_task.cmd, which reads .env like an interactive run. Logs: data\cron.log.
#>
[CmdletBinding()]
param(
    [string]$RunAt = "09:10",
    [int]$TrackEveryHours = 6,
    [int]$CheckKorea = 3,
    [switch]$Unregister,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$wrapper = Join-Path $root "scripts\radar_task.cmd"
if (-not (Test-Path $wrapper)) { throw "wrapper not found: $wrapper" }
if (-not (Test-Path (Join-Path $root ".venv\Scripts\radar.exe"))) { throw "venv not found: run pip install -e . first" }

$jobs = @(
    @{ Name = "GlobalShortsRadar-Run";   Args = "run --check-korea $CheckKorea"; Schedule = @("/SC", "DAILY", "/ST", $RunAt) },
    @{ Name = "GlobalShortsRadar-Track"; Args = "track";                         Schedule = @("/SC", "HOURLY", "/MO", "$TrackEveryHours", "/ST", "00:40") }
)

foreach ($job in $jobs) {
    if ($Unregister) {
        $cmd = @("schtasks", "/Delete", "/TN", $job.Name, "/F")
    } else {
        $action = "`"$wrapper`" $($job.Args)"
        $cmd = @("schtasks", "/Create", "/F", "/TN", $job.Name, "/TR", $action) + $job.Schedule
    }
    if ($DryRun) {
        Write-Host ("DRY RUN: " + ($cmd -join " "))
    } else {
        & $cmd[0] $cmd[1..($cmd.Length - 1)]
        if ($LASTEXITCODE -ne 0) { throw "schtasks failed for $($job.Name) (exit $LASTEXITCODE)" }
        Write-Host ("OK: " + $job.Name)
    }
}
if (-not $Unregister -and -not $DryRun) {
    Write-Host "Registered. Check with: schtasks /Query /TN GlobalShortsRadar-Run /V /FO LIST"
}

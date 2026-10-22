<#
.SYNOPSIS
  Opens the v2 GitHub issues from docs/issues/V2-*.md (docs/WORKFLOW.md section 2).

.DESCRIPTION
  Without -Apply it only prints what it would create (dry run) and needs no token.
  With -Apply it reads the token from $env:GITHUB_TOKEN only, never writes it anywhere, creates the
  missing labels and milestones, skips issues whose title already exists, and prints the
  V2 -> GitHub number mapping for docs/BACKLOG.md.

.EXAMPLE
  .\scripts\create-issues.ps1
  $env:GITHUB_TOKEN = '<token>'; .\scripts\create-issues.ps1 -Apply; Remove-Item Env:GITHUB_TOKEN
#>
[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$Repo = 'BerkayToluc/Novera-Mobility',
  [string]$Assignee = '',
  # V2-01 is the documentation PR itself; open it too unless told otherwise.
  [string[]]$Skip = @()
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$issueDir = Join-Path $root 'docs\issues'

# Milestone titles follow docs/ROADMAP.md section 3.
$milestones = @{
  'faz-0' = 'Faz 0 · Süreç'; 'faz-1' = 'Faz 1 · Acil güvenlik'; 'faz-2' = 'Faz 2 · Temel'
  'faz-3' = 'Faz 3 · Panel temeli'; 'faz-4' = 'Faz 4 · Katalog'; 'faz-5' = 'Faz 5 · Operasyon'
  'faz-6' = 'Faz 6 · Şirketler'; 'faz-7' = 'Faz 7 · Filom temeli'; 'faz-8' = 'Faz 8 · Filom maliyetleri'
  'faz-9' = 'Faz 9 · Raporlar'; 'faz-10' = 'Faz 10 · Talepler'; 'faz-11' = 'Faz 11 · Canlı takip'
  'faz-12' = 'Faz 12 · Yayın'
}

function Read-Issue([string]$path) {
  # The files are UTF-8 without BOM; Windows PowerShell 5.1 would otherwise read them as ANSI.
  $text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
  $lines = $text -split "`r?`n"
  $title = $lines[0] -replace '^#\s*', ''
  $body = ($lines | Select-Object -Skip 1) -join "`n"
  $labels = @()
  $labelSection = [regex]::Match($text, '(?ms)^## Etiketler\s*\r?\n(.+?)(\r?\n## |\z)')
  if ($labelSection.Success) {
    $labels = [regex]::Matches($labelSection.Groups[1].Value, '`([^`]+)`') | ForEach-Object { $_.Groups[1].Value }
  }
  $id = [regex]::Match($title, '^V2-\d+').Value
  $phase = $labels | Where-Object { $_ -like 'faz-*' } | Select-Object -First 1
  [pscustomobject]@{ Id = $id; Title = $title; Body = $body.Trim(); Labels = @($labels); Phase = $phase }
}

$issues = Get-ChildItem $issueDir -Filter 'V2-*.md' | Sort-Object { [int]([regex]::Match($_.Name, '^V2-(\d+)').Groups[1].Value) } |
  ForEach-Object { Read-Issue $_.FullName } | Where-Object { $Skip -notcontains $_.Id }

if (-not $Apply) {
  Write-Host "Dry run: $($issues.Count) issues would be created in $Repo (nothing is sent)." -ForegroundColor Yellow
  $issues | ForEach-Object { Write-Host ("{0,-7} [{1}] {2}" -f $_.Id, ($_.Labels -join ', '), $_.Title) }
  Write-Host "`nRun again with -Apply and `$env:GITHUB_TOKEN set to create them."
  return
}

if (-not $env:GITHUB_TOKEN) { throw 'Set $env:GITHUB_TOKEN first (a token with Issues: read and write on this repository).' }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$headers = @{ Authorization = "Bearer $env:GITHUB_TOKEN"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' }
$api = "https://api.github.com/repos/$Repo"

function Invoke-GitHub([string]$method, [string]$url, $payload = $null) {
  $params = @{ Method = $method; Uri = $url; Headers = $headers }
  if ($payload) {
    $params.Body = [System.Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 5))
    $params.ContentType = 'application/json; charset=utf-8'
  }
  Invoke-RestMethod @params
}

function Get-All([string]$url) {
  $all = @(); $page = 1
  do {
    $batch = @(Invoke-GitHub GET ("{0}{1}per_page=100&page={2}" -f $url, ($(if ($url.Contains('?')) { '&' } else { '?' })), $page))
    $all += $batch; $page++
  } while ($batch.Count -eq 100)
  $all
}

$existingLabels = Get-All "$api/labels" | ForEach-Object { $_.name }
$wantedLabels = $issues | ForEach-Object { $_.Labels } | Sort-Object -Unique
foreach ($label in $wantedLabels | Where-Object { $existingLabels -notcontains $_ }) {
  Invoke-GitHub POST "$api/labels" @{ name = $label; color = 'ededed' } | Out-Null
  Write-Host "label   + $label"
}

$milestoneNumbers = @{}
Get-All "$api/milestones?state=all" | ForEach-Object { $milestoneNumbers[$_.title] = $_.number }
foreach ($title in ($issues | ForEach-Object { $milestones[$_.Phase] } | Where-Object { $_ } | Sort-Object -Unique)) {
  if (-not $milestoneNumbers.ContainsKey($title)) {
    $milestoneNumbers[$title] = (Invoke-GitHub POST "$api/milestones" @{ title = $title }).number
    Write-Host "milestone + $title"
  }
}

# Pull requests are issues too in this API; both count as "already exists".
$existingTitles = @{}
Get-All "$api/issues?state=all" | ForEach-Object { $existingTitles[$_.title] = $_.number }

$mapping = @()
foreach ($issue in $issues) {
  if ($existingTitles.ContainsKey($issue.Title)) {
    Write-Host ("skip    {0} already #{1}" -f $issue.Id, $existingTitles[$issue.Title])
    $mapping += [pscustomobject]@{ V2 = $issue.Id; GitHub = $existingTitles[$issue.Title] }
    continue
  }
  $payload = @{ title = $issue.Title; body = $issue.Body; labels = $issue.Labels }
  $milestone = $milestones[$issue.Phase]
  if ($milestone) { $payload.milestone = $milestoneNumbers[$milestone] }
  if ($Assignee) { $payload.assignees = @($Assignee) }
  $created = Invoke-GitHub POST "$api/issues" $payload
  Write-Host ("created {0} -> #{1}" -f $issue.Id, $created.number)
  $mapping += [pscustomobject]@{ V2 = $issue.Id; GitHub = $created.number }
}

Write-Host "`nMapping for docs/BACKLOG.md:" -ForegroundColor Green
$mapping | ForEach-Object { Write-Host ("| {0} | #{1} |" -f $_.V2, $_.GitHub) }

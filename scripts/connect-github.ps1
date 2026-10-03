param([Parameter(Mandatory=$true)][string]$RepositoryUrl)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if ($RepositoryUrl -notmatch '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?/?$') { throw 'Enter an actual GitHub repository URL.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Install Git for Windows first.' }
$existing = git remote
if ($existing -contains 'origin') { throw 'origin already exists. Inspect it with git remote -v before changing it.' }
& git remote add origin $RepositoryUrl
if ($LASTEXITCODE -ne 0) { throw 'Could not add origin.' }
Write-Host 'GitHub remote connected. No files have been pushed.' -ForegroundColor Green
Write-Host 'For an empty repository: git push -u origin main'
Write-Host 'For an existing repository: inspect its history first; do not force-push.'

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js LTS first: winget install OpenJS.NodeJS.LTS' }
$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]").Trim())
if ($nodeMajor -lt 22) { throw 'Node.js 22.13+ is required. Node.js 24 LTS is recommended.' }
if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) { throw 'Corepack is required. Run: npm install -g corepack' }
New-Item -ItemType Directory -Force -Path .sites-runtime | Out-Null
'{"executionProfile":"portable"}' | Set-Content -Encoding ascii .sites-runtime/execution-profile.json
& corepack pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
& node scripts/init-local-db.mjs
if ($LASTEXITCODE -ne 0) { throw 'Local database setup failed.' }
Write-Host 'Setup complete. Run: corepack pnpm dev' -ForegroundColor Green
Write-Host 'Open: http://localhost:3037' -ForegroundColor Green

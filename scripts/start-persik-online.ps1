# Run Persik online (local server + Cloudflare quick tunnel + optional Vercel update)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Persik = if (Test-Path "$Root\..\persik\persik_server.py") { Resolve-Path "$Root\..\persik" } else { Resolve-Path "$Root\persik" }
$Cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$Python = Join-Path $Persik 'venv\Scripts\python.exe'

if (-not (Test-Path $Python)) {
  throw "Persik venv not found. Run: py -3.11 -m venv venv && pip install -r requirements.txt"
}

& $Python (Join-Path $Persik 'scripts\write_local_env.py')

Get-Process python*, cloudflared* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Process -FilePath $Python -ArgumentList '-u', 'persik_server.py' -WorkingDirectory $Persik -WindowStyle Hidden
Start-Sleep -Seconds 8

$tunnelLog = Join-Path $Persik 'tunnel.err.log'
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }
Start-Process -FilePath $Cloudflared -ArgumentList 'tunnel', '--url', 'http://127.0.0.1:8080' -RedirectStandardError $tunnelLog -WindowStyle Hidden

$tunnelUrl = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  if (Test-Path $tunnelLog) {
    $match = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
    if ($match) { $tunnelUrl = $match.Matches[0].Value; break }
  }
}

if (-not $tunnelUrl) { throw 'Cloudflare tunnel URL not found in log' }

Write-Host "Persik tunnel: $tunnelUrl"
Write-Host 'Login: mes / persik2026'
Write-Host "Local: http://127.0.0.1:8080"

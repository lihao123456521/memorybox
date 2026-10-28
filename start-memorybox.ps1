param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$frontendRoot = Join-Path $projectRoot 'frontend'
$backendRoot = Join-Path $projectRoot 'backend'
$runtimeLogs = Join-Path $projectRoot 'artifacts\runtime'
New-Item -ItemType Directory -Force -Path $runtimeLogs | Out-Null

function Test-LocalEndpoint([string]$Uri) {
    try { return (Invoke-WebRequest -Uri $Uri -TimeoutSec 2 -UseBasicParsing).StatusCode -eq 200 }
    catch { return $false }
}

$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$npmExe = (Get-Command npm.cmd -ErrorAction Stop).Source
$venvPython = Join-Path $backendRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) {
    $bootstrapPython = (Get-Command python.exe -ErrorAction Stop).Source
    & $bootstrapPython -m venv (Join-Path $backendRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the project Python virtual environment.' }
    & $venvPython -m pip install --cache-dir (Join-Path $projectRoot '.cache\pip') -r (Join-Path $backendRoot 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
}
& $venvPython -c 'import fastapi, uvicorn'
if ($LASTEXITCODE -ne 0) { throw 'Backend dependencies missing. Run backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt' }
if (-not (Test-Path -LiteralPath (Join-Path $frontendRoot 'node_modules\vite\bin\vite.js'))) {
    Push-Location $frontendRoot
    try {
        & $npmExe install --cache (Join-Path $projectRoot '.cache\npm')
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    } finally { Pop-Location }
}

if (-not (Test-LocalEndpoint 'http://127.0.0.1:8000/api/health')) {
    $apiProcess = Start-Process -FilePath $venvPython -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000') -WorkingDirectory $backendRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeLogs 'backend.stdout.log') -RedirectStandardError (Join-Path $runtimeLogs 'backend.stderr.log') -PassThru
    $apiProcess.Id | Set-Content -LiteralPath (Join-Path $runtimeLogs 'backend.pid')
}
if (-not (Test-LocalEndpoint 'http://127.0.0.1:5173')) {
    $webProcess = Start-Process -FilePath $nodeExe -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory $frontendRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeLogs 'frontend.stdout.log') -RedirectStandardError (Join-Path $runtimeLogs 'frontend.stderr.log') -PassThru
    $webProcess.Id | Set-Content -LiteralPath (Join-Path $runtimeLogs 'frontend.pid')
}

$ready = $false
for ($attempt=0; $attempt -lt 25; $attempt++) {
    if ((Test-LocalEndpoint 'http://127.0.0.1:8000/api/health') -and (Test-LocalEndpoint 'http://127.0.0.1:5173')) { $ready = $true; break }
    Start-Sleep -Milliseconds 800
}
if (-not $ready) { throw "MemoryBox did not become ready. Check logs in $runtimeLogs" }
Write-Host 'MemoryBox: http://127.0.0.1:5173'
Write-Host 'API:       http://127.0.0.1:8000/api/health'
Write-Host "Logs:      $runtimeLogs"
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173' }

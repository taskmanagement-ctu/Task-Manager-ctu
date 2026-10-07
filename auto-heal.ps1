# CT Task Manager - Windows Self-Healing Watchdog
# Runs in background independently of any IDE or terminal

$ErrorActionPreference = "SilentlyContinue"

$rootDir = "C:\Users\student\Desktop\Task-Manager-ctu"
$backendDir = "$rootDir\ct-task-manager\backend"
$logsDir = "$backendDir\logs"
$logFile = "$logsDir\auto-heal.log"

if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

function Write-HealLog($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -Path $logFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
}

# If user intentionally stopped services via stop-all.bat, do not auto-start
if (Test-Path "$rootDir\.stopped") {
    exit 0
}

# 1. Check Nginx Reverse Proxy
$nginxDir = "$rootDir\nginx"
if (-not (Test-Path "$nginxDir\nginx.exe")) {
    $nginxDir = "C:\Users\student\Desktop\Task-Manager\nginx"
}

$nginxRunning = Get-Process nginx -ErrorAction SilentlyContinue
if (-not $nginxRunning) {
    if (Test-Path "$nginxDir\nginx.exe") {
        Write-HealLog "⚠️ Nginx was offline. Launching detached Nginx process..."
        $wmi = [wmiclass]"Win32_Process"
        $wmi.Create("$nginxDir\nginx.exe", $nginxDir, $null) | Out-Null
        Write-HealLog "✅ Nginx launched successfully."
    }
}

# 2. Check Backend Server on Port 5000
$backendHealthy = $false
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -TimeoutSec 3 -ErrorAction Stop
    if ($response.success -or $response.database) {
        $backendHealthy = $true
    }
} catch {
    $backendHealthy = $false
}

if (-not $backendHealthy) {
    Write-HealLog "🚨 Backend is DOWN or unresponsive on Port 5000 (potential 502 Bad Gateway)!"

    # Kill any stale process listening on Port 5000
    $conn = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-HealLog "Cleaned up hung Port 5000 process (PID $($conn.OwningProcess))."
    }

    # Also terminate any stale supervisor if backend is unresponsive
    $supervisors = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*supervisor.js*" }
    foreach ($sup in $supervisors) {
        Stop-Process -Id $sup.ProcessId -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Milliseconds 500

    # Ensure frontend dist has index.html
    $distIndex = "$rootDir\ct-task-manager\frontend\dist\index.html"
    if (-not (Test-Path $distIndex)) {
        Write-HealLog "⚠️ dist/index.html is missing. Building frontend..."
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm --prefix `"$rootDir\ct-task-manager\frontend`" run build" -Wait -WindowStyle Hidden
    }

    # Spawn supervisor completely detached via WMI (parented by WmiPrvSE.exe, independent of any IDE)
    Write-HealLog "🚀 Spawning detached backend supervisor via WMI..."
    $wmi = [wmiclass]"Win32_Process"
    $nodeCmd = "node supervisor.js"
    $res = $wmi.Create($nodeCmd, $backendDir, $null)
    if ($res.ReturnValue -eq 0) {
        Write-HealLog "✅ Supervisor spawned detached with PID $($res.ProcessId)."
    } else {
        Write-HealLog "❌ Failed to spawn supervisor via WMI (Code: $($res.ReturnValue)). Falling back to Start-Process."
        Start-Process -FilePath "node.exe" -ArgumentList "supervisor.js" -WorkingDirectory $backendDir -WindowStyle Hidden
    }

    # Wait for backend to warm up and verify
    Start-Sleep -Seconds 3
    try {
        $check = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -TimeoutSec 5 -ErrorAction Stop
        Write-HealLog "🎉 Auto-recovery verified: Backend is ONLINE! (DB: $($check.database))"
    } catch {
        Write-HealLog "⏳ Backend initializing: $($_.Exception.Message)"
    }
}

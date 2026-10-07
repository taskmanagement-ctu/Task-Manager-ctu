const { spawn, exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const backendDir = __dirname;
const serverScript = path.join(backendDir, 'dist', 'server.js');
const logsDir = path.join(backendDir, 'logs');

// Locate Nginx directory
let nginxDir = path.resolve(backendDir, '..', '..', 'nginx');
if (!fs.existsSync(path.join(nginxDir, 'nginx.exe'))) {
  nginxDir = 'C:\\Users\\student\\Desktop\\Task-Manager\\nginx';
}

if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch {}
}

const logFile = path.join(logsDir, 'supervisor.log');
const backendLogFile = path.join(logsDir, 'backend.log');

// Truncate/rotate logs if larger than 10MB
function checkLogSize(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > 10 * 1024 * 1024) {
        const oldPath = `${filePath}.old`;
        try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch {}
        fs.renameSync(filePath, oldPath);
      }
    }
  } catch {}
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    checkLogSize(logFile);
    fs.appendFileSync(logFile, line + '\n', 'utf8');
  } catch {}
}

let child = null;
let restartAttempts = 0;
let isShuttingDown = false;
let failedHealthChecks = 0;

function startBackend() {
  if (isShuttingDown) return;

  log('🚀 [Supervisor] Starting CT-Backend process (node dist/server.js)...');

  checkLogSize(backendLogFile);
  let outLog = null;
  let errLog = null;
  try {
    outLog = fs.openSync(backendLogFile, 'a');
    errLog = fs.openSync(backendLogFile, 'a');
  } catch (e) {
    log(`⚠️ Could not open backend log file: ${e.message}`);
  }

  const stdioOpts = outLog && errLog ? ['ignore', outLog, errLog] : 'ignore';

  child = spawn(process.execPath, [serverScript], {
    cwd: backendDir,
    stdio: stdioOpts,
    detached: false,
    env: { ...process.env, PORT: '5000' },
  });

  child.on('error', (err) => {
    log(`❌ [Supervisor] Backend failed to spawn: ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    child = null;
    try { if (outLog) fs.closeSync(outLog); } catch {}
    try { if (errLog) fs.closeSync(errLog); } catch {}

    if (isShuttingDown) {
      log('🛑 [Supervisor] Backend stopped cleanly.');
      return;
    }

    restartAttempts++;
    log(`⚠️ [Supervisor] Backend process exited (code: ${code}, signal: ${signal}).`);
    log(`🔄 [Supervisor] Auto-restarting backend in 2 seconds (Attempt #${restartAttempts})...`);
    setTimeout(startBackend, 2000);
  });
}

function ensureNginx() {
  if (isShuttingDown) return;
  const nginxExe = path.join(nginxDir, 'nginx.exe');
  if (!fs.existsSync(nginxExe)) return;

  exec('tasklist /fi "imagename eq nginx.exe" /nh', (err, stdout) => {
    if (err || !stdout || !stdout.toLowerCase().includes('nginx.exe')) {
      log('⚠️ [Supervisor] Nginx is not running! Starting Nginx reverse proxy...');
      const nginxProcess = spawn(nginxExe, [], {
        cwd: nginxDir,
        detached: true,
        stdio: 'ignore',
      });
      nginxProcess.unref();
      log('✅ [Supervisor] Nginx launched.');
    }
  });
}

// Watchdog: Ping /api/health every 15 seconds
setInterval(() => {
  if (isShuttingDown) return;

  const req = http.get('http://127.0.0.1:5000/api/health', { timeout: 5000 }, (res) => {
    if (res.statusCode === 200 || res.statusCode === 503) {
      restartAttempts = 0;
      failedHealthChecks = 0;
    } else {
      failedHealthChecks++;
      log(`⚠️ [Watchdog] Health check returned HTTP ${res.statusCode} (consecutive failures: ${failedHealthChecks})`);
    }
  });

  req.on('error', (err) => {
    failedHealthChecks++;
    log(`⚠️ [Watchdog] Health check connection error: ${err.message} (consecutive failures: ${failedHealthChecks})`);
    if (failedHealthChecks >= 4 && child) {
      log('🚨 [Watchdog] Backend unresponsive for >45s. Recycling process...');
      try {
        child.kill('SIGKILL');
      } catch {}
      failedHealthChecks = 0;
    }
  });

  req.on('timeout', () => {
    req.destroy();
    failedHealthChecks++;
    log(`⚠️ [Watchdog] Health check timed out (consecutive failures: ${failedHealthChecks})`);
  });
}, 15000);

// Periodically check Nginx every 30 seconds
setInterval(ensureNginx, 30000);

// Check Nginx immediately on startup
ensureNginx();

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  isShuttingDown = true;
  log('🛑 [Supervisor] Shutting down supervisor and backend...');
  if (child) {
    try {
      child.kill('SIGINT');
    } catch {}
  }
  setTimeout(() => process.exit(0), 1000);
}

startBackend();

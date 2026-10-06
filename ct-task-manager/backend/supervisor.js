const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const backendDir = __dirname;
const serverScript = path.join(backendDir, 'dist', 'server.js');
const logsDir = path.join(backendDir, 'logs');

if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch {}
}

const logFile = path.join(logsDir, 'supervisor.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(logFile, line + '\n', 'utf8');
  } catch {}
}

let child = null;
let restartAttempts = 0;
let isShuttingDown = false;

function startBackend() {
  if (isShuttingDown) return;

  log('🚀 [Supervisor] Starting CT-Backend process (node dist/server.js)...');
  child = spawn(process.execPath, [serverScript], {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, PORT: '5000' },
  });

  child.on('error', (err) => {
    log(`❌ [Supervisor] Backend failed to spawn: ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    child = null;
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

// Watchdog: Periodically ping /api/health every 30 seconds
setInterval(() => {
  if (isShuttingDown) return;

  const req = http.get('http://127.0.0.1:5000/api/health', { timeout: 5000 }, (res) => {
    if (res.statusCode === 200 || res.statusCode === 503) {
      restartAttempts = 0;
    }
  });

  req.on('error', () => {});
  req.on('timeout', () => {
    req.destroy();
  });
}, 30000);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  isShuttingDown = true;
  log('🛑 [Supervisor] Shutting down backend...');
  if (child) {
    child.kill('SIGINT');
  }
  setTimeout(() => process.exit(0), 1000);
}

startBackend();

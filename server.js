'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const PORT = 3000;
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.eot':  'application/vnd.ms-fontobject',
  '.webp': 'image/webp',
};

// ── Process-level error handlers ─────────────────────────────────────────────
// Catch any exception that escapes all try/catch blocks so the process doesn't
// exit silently without a trace in the logs.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Unhandled exception — server will stay up:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection] Unhandled promise rejection:', reason, 'Promise:', promise);
});

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const filePath = path.join(DIST, urlPath);
  const start = Date.now();

  console.log(`[request] ${req.method} ${req.url}`);

  const serveFile = (fp, statusCode = 200) => {
    const ext = path.extname(fp).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(fp, (err, data) => {
      if (err) {
        console.error(`[error] Failed to read file "${fp}":`, err.message);
        res.writeHead(500);
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(statusCode, { 'Content-Type': contentType });
      res.end(data);
      console.log(`[response] ${statusCode} ${req.url} → ${fp} (${Date.now() - start}ms)`);
    });
  };

  const serveIndex = () => serveFile(path.join(DIST, 'index.html'));

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      serveFile(filePath);
    } else if (!err && stats.isDirectory()) {
      const indexInDir = path.join(filePath, 'index.html');
      fs.access(indexInDir, fs.constants.F_OK, (accessErr) => {
        if (!accessErr) {
          serveFile(indexInDir);
        } else {
          serveIndex();
        }
      });
    } else {
      // No matching file — fall back to index.html for SPA routing
      console.log(`[fallback] No file at "${filePath}" — serving index.html`);
      serveIndex();
    }
  });
});

// ── Server-level error handler ────────────────────────────────────────────────
// Catches low-level network errors (EADDRINUSE, EACCES, connection resets, etc.)
// that are emitted on the server object itself rather than thrown as exceptions.
server.on('error', (err) => {
  console.error('[server error]', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`[server error] Port ${PORT} is already in use. Is another process running?`);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`Serving static files from: ${DIST}`);
});

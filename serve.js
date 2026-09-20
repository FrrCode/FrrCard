#!/usr/bin/env node
// Minimal static file server for the built cards — no dependencies, used by the
// Docker image and handy for a local look.
//
//   node serve.js                serve dist/ (cards live at /<name>/)
//   node serve.js dist/jane      serve one card at /
//   PORT=3000 node serve.js      pick the port (default 8080)
//   CARD=jane node serve.js      same as `node serve.js dist/jane`
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(
  process.argv[2] || path.join(__dirname, 'dist', process.env.CARD || '')
);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.vcf': 'text/vcard; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};

// Resolves a URL path inside ROOT, or null if it tries to climb out of it.
function resolveFile(url) {
  let decoded;
  try {
    decoded = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return null;
  }
  const target = path.join(ROOT, path.normalize(decoded));
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;

  const stat = fs.existsSync(target) && fs.statSync(target);
  if (stat && stat.isDirectory()) {
    const index = path.join(target, 'index.html');
    return fs.existsSync(index) ? index : null;
  }
  return stat && stat.isFile() ? target : null;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end('Method Not Allowed\n');
    return;
  }

  // Serving every card leaves nothing at /, so the health check gets its own
  // endpoint rather than a URL that only exists in single-card mode.
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok\n');
    return;
  }

  const file = resolveFile(req.url);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found\n');
    return;
  }

  const stat = fs.statSync(file);
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': stat.size,
    'last-modified': stat.mtime.toUTCString(),
    'cache-control': 'public, max-age=300',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`serving ${ROOT} on http://${HOST}:${PORT}`);
});

// Containers stop with SIGTERM; close cleanly instead of being killed.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

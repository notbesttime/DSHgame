// 静态服务器:gzip 压缩 + ETag 协商缓存(304)+ 路径越界防护
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = 8765;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const COMPRESSIBLE = /\.(html|js|css|svg)$/;

// 内存缓存:路径 -> { mtimeMs, size, raw, gzip }  (小文件全量缓存,gzip 只算一次)
const cache = new Map();

function getEntry(filePath) {
  const stat = fs.statSync(filePath);
  let entry = cache.get(filePath);
  if (!entry || entry.mtimeMs !== stat.mtimeMs || entry.size !== stat.size) {
    const raw = fs.readFileSync(filePath);
    entry = {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      raw,
      gzip: (COMPRESSIBLE.test(filePath) && raw.length > 1024)
        ? zlib.gzipSync(raw, { level: 8 })
        : null,
    };
    cache.set(filePath, entry);
  }
  return entry;
}

http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400); res.end('Bad Request'); return;
  }
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // 路径越界防护:规范化后必须仍在项目目录内
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  let entry;
  try {
    entry = getEntry(filePath);
  } catch (e) {
    res.writeHead(404); res.end('Not Found'); return;
  }

  const etag = '"' + entry.size.toString(16) + '-' + Math.round(entry.mtimeMs * 1000).toString(16) + '"';
  const headers = {
    'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'ETag': etag,
    // HTML 每次协商(改版即生效);其余静态资源当天内直接走浏览器缓存
    'Cache-Control': filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=86400',
  };

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }

  const acceptGzip = (req.headers['accept-encoding'] || '').includes('gzip');
  if (entry.gzip && acceptGzip) {
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = entry.gzip.length;
    res.writeHead(200, headers);
    res.end(entry.gzip);
  } else {
    headers['Content-Length'] = entry.raw.length;
    res.writeHead(200, headers);
    res.end(entry.raw);
  }
}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

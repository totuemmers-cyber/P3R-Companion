import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const host = '127.0.0.1';
const port = 4173;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function resolvePath(urlPath) {
  const sanitized = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  const relative = sanitized || 'index.html';
  const absolute = normalize(join(rootDir, relative));
  if (!absolute.startsWith(rootDir)) {
    return null;
  }
  if (existsSync(absolute) && statSync(absolute).isDirectory()) {
    const nestedIndex = join(absolute, 'index.html');
    return existsSync(nestedIndex) ? nestedIndex : null;
  }
  return existsSync(absolute) ? absolute : null;
}

createServer((request, response) => {
  const filePath = resolvePath(request.url || '/');
  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`P3R Companion available at http://${host}:${port}`);
});

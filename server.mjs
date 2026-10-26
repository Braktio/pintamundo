import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { WebSocketServer } from 'ws';
import { Hub } from './multiplayer.mjs';
import { createRanked } from './ranked.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };
// Only the files the browser needs are public; tests, scripts and the server stay private.
const PUBLIC = new Set(['/index.html', '/styles.css', '/game.js', '/engine.js', '/renderer.js', '/online.js', '/cloud.js', '/music.js', '/soundtrack.js', '/ads.js', '/privacy.html', '/manifest.webmanifest', '/favicon.ico']);
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (path === '/health') { response.writeHead(200, { 'Content-Type': 'text/plain' }); response.end('ok'); return; }
    const file = path === '/' ? '/index.html' : path;
    if (!PUBLIC.has(file) && !/^\/fonts\/[a-z0-9-]+\.woff2$/.test(file) && !/^\/(icons|ui)\/[a-z0-9-]+\.png$/.test(file) && !/^\/audio\/[a-z0-9-]+\.mp3$/.test(file)) throw new Error('not public');
    const target = resolve(root, '.' + file), data = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(data);
  } catch { response.writeHead(404); response.end('No encontrado'); }
});

// Online play: one WebSocket per phone at /ws. Small messages only; dead phones are dropped.
// Ranked play (trophies written by the server) needs the Firebase key in FIREBASE_SERVICE_ACCOUNT.
let ranked = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try { ranked = await createRanked(process.env.FIREBASE_SERVICE_ACCOUNT); console.log('Ranking en línea activado.'); }
  catch (error) { console.error('Ranking en línea desactivado:', error.message); }
}
// MATCH_SECONDS shortens online matches for local checks (default: 3 minutes).
const matchSeconds = Number(process.env.MATCH_SECONDS) || undefined;
const hub = new Hub({ ...(matchSeconds ? { matchSeconds } : {}), ...(ranked ? { verify: ranked.verify, onResult: results => ranked.record(results, (client, message) => hub.send(client, message)) } : {}) });
const sockets = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });
sockets.on('connection', socket => {
  socket.alive = true;
  const session = hub.connect({ send: text => { if (socket.readyState === socket.OPEN) socket.send(text); } });
  socket.on('pong', () => { socket.alive = true; });
  socket.on('message', data => session.message(data));
  socket.on('close', () => session.close());
  socket.on('error', () => socket.terminate());
});
const heartbeat = setInterval(() => {
  for (const socket of sockets.clients) { if (!socket.alive) socket.terminate(); else { socket.alive = false; socket.ping(); } }
}, 20000);
server.on('close', () => { clearInterval(heartbeat); hub.close(); });

const host = process.env.HOST || '0.0.0.0';
server.listen(process.env.PORT === undefined ? 5173 : Number(process.env.PORT), host, () => {
  const port = server.address().port;
  console.log(`PINTAMUNDO listo en http://127.0.0.1:${port}`);
  if (host === '0.0.0.0') for (const entries of Object.values(networkInterfaces())) for (const entry of entries || []) {
    if (entry.family === 'IPv4' && !entry.internal) console.log(`En tu móvil (misma red): http://${entry.address}:${port}`);
  }
});

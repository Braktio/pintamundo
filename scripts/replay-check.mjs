// Optional check of "another match" after a quick online match: one Chromium phone plays a
// short quick match (MATCH_SECONDS=6), then taps ¡OTRA PARTIDA! and must land in a new lobby.
// Usage: node scripts/replay-check.mjs <chrome executable>
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const executable = process.argv[2];
if (!executable) throw new Error('Usage: node scripts/replay-check.mjs <chrome executable>');
const root = new URL('..', import.meta.url), profileDir = await mkdtemp(join(tmpdir(), 'pintamundo-replay-'));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', MATCH_SECONDS: '6' }, windowsHide: true });
let browser, socket;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function outputUntil(stream, expression) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Readiness timeout: ' + output.slice(-300))), 20000);
    stream.on('data', data => { output += data; const match = output.match(expression); if (match) { clearTimeout(timer); resolve(match[0]); } });
  });
}
try {
  const base = await outputUntil(server.stdout, /http:\/\/\S+/);
  browser = spawn(executable, ['--headless=new', '--no-sandbox', '--no-first-run', '--remote-debugging-port=0', '--remote-allow-origins=*', '--user-data-dir=' + profileDir, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  socket = new WebSocket(await outputUntil(browser.stderr, /ws:\/\/\S+/));
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map(), errors = [];
  socket.onmessage = message => {
    const event = JSON.parse(message.data);
    if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text);
    if (pending.has(event.id)) { const p = pending.get(event.id); pending.delete(event.id); if (event.error) p.reject(new Error(event.error.message)); else p.resolve(event.result); }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => { const r = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const until = async (expression, ms) => { for (let t = 0; t < ms && !await evaluate(expression); t += 200) await sleep(200); return evaluate(expression); };
  await page('Runtime.enable'); await page('Page.enable');
  await page('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await page('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('neon-frontier.profile.v1', JSON.stringify({version:1,epoch:2,name:'Ana',bits:0,xp:0,wins:0,totalKills:0,best:0,nemesis:'',skin:'interceptor',trail:'cyan',skins:[],trails:['cyan'],easy:false,chests:{comun:0,raro:0,epico:0,legendario:0},freeChestAt:0}))" });
  await page('Page.navigate', { url: base }); await sleep(1500);
  await evaluate('document.getElementById("dialog").open && document.getElementById("dialog").close(); document.getElementById("online").click()');
  await sleep(300); await evaluate('document.getElementById("online-quick").click()');
  assert.equal(await until('!document.getElementById("hud").hidden', 20000), true, 'the quick match starts');
  // The match ends by time; results (and any chests won) come next, then the match buttons.
  assert.equal(await until('Boolean(document.getElementById("retry"))', 30000), true, 'the results offer another match');
  await evaluate('document.getElementById("retry").click()');
  assert.equal(await until('Boolean(document.querySelector(".lobby-players"))', 8000), true, '¡OTRA PARTIDA! opens a new lobby');
  assert.deepEqual(errors, [], 'no browser errors');
  console.log('Replay OK: after a quick online match, ¡OTRA PARTIDA! goes to a new lobby.');
  await send('Browser.close');
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
  await sleep(300);
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

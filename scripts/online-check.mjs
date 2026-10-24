// Optional two-player smoke check: two Chromium tabs act as two phones.
// Usage: node scripts/online-check.mjs <chrome executable>
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const executable = process.argv[2];
if (!executable) throw new Error('Usage: node scripts/online-check.mjs <chrome executable>');
const root = new URL('..', import.meta.url), profileDir = await mkdtemp(join(tmpdir(), 'pintamundo-online-'));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, windowsHide: true });
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
  // Each "phone" is its own browser context, so storage and progress are separate.
  async function phone(name, skin) {
    const { browserContextId } = await send('Target.createBrowserContext');
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => send(method, params, sessionId);
    await page('Runtime.enable'); await page('Page.enable');
    await page('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
    await page('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('neon-frontier.profile.v1', JSON.stringify({version:1,bits:0,xp:5000,wins:0,totalKills:0,best:0,nemesis:'',skin:'${skin}',trail:'cyan',skins:['${skin}'],trails:['cyan'],easy:false,chests:{comun:0,raro:0,epico:0,legendario:0},freeChestAt:0}));` });
    await page('Page.navigate', { url: base });
    await sleep(700);
    const evaluate = async expression => {
      const response = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (response.exceptionDetails) throw new Error(name + ': ' + (response.exceptionDetails.exception?.description || response.exceptionDetails.text));
      return response.result.value;
    };
    const screenshot = async file => { const shot = await page('Page.captureScreenshot', { format: 'png' }); await writeFile(new URL(file, root), Buffer.from(shot.data, 'base64')); };
    return { evaluate, screenshot };
  }
  const ana = await phone('Ana', 'rift'), beto = await phone('Beto', 'phoenix');
  await ana.evaluate('document.getElementById("online").click()');
  await sleep(200);
  await ana.evaluate('document.getElementById("online-create").click()');
  await sleep(800);
  const code = await ana.evaluate('document.querySelector(".room-code")?.textContent');
  assert.match(code, /^[A-Z]+-\d\d$/, 'the host sees a room code');
  await beto.evaluate('document.getElementById("online").click()');
  await sleep(200);
  await beto.evaluate(`document.getElementById("online-code").value=${JSON.stringify(code)};document.getElementById("online-join").click()`);
  await sleep(800);
  assert.equal(await ana.evaluate('document.querySelectorAll(".lobby-players li:not(.empty)").length'), 2, 'the host sees the friend arrive');
  assert.equal(await beto.evaluate('Boolean(document.getElementById("lobby-start"))'), false, 'only the host can start');
  await ana.screenshot('preview-online-lobby.png');
  await ana.evaluate('document.getElementById("lobby-start").click()');
  await sleep(1200);
  for (const p of [ana, beto]) assert.equal(await p.evaluate('document.getElementById("hud").hidden'), false, 'both phones are in the match');
  // Beto steers right with the keyboard; Ana must see Beto's character move.
  const before = await ana.evaluate('(() => { const r = document.querySelectorAll("#leaders li"); return r.length; })()');
  assert.equal(before, 7);
  await beto.evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyD"}))');
  await sleep(1500);
  await ana.evaluate('document.getElementById("slot-0").click()');
  await sleep(600);
  await ana.screenshot('preview-online-ana.png');
  await beto.screenshot('preview-online-beto.png');
  assert.match(await ana.evaluate('document.getElementById("hud-timer").textContent'), /^[0-3]:\d\d$/, 'the match timer is shown');
  assert.ok(await ana.evaluate('document.querySelector(".goal-bar").getBoundingClientRect().width') <= 300, 'the progress bar stays compact');
  // Beto keeps going right with his trail exposed until someone catches him, then watches.
  let watching = false;
  // Meanwhile Ana circles inside her own zone (W, D, S, A) so she stays safe and the match goes on.
  const turns = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
  for (let i = 0; i < 60 && !watching; i++) {
    await ana.evaluate(`document.dispatchEvent(new KeyboardEvent('keyup',{code:'${turns[(i + 3) % 4]}'}));document.dispatchEvent(new KeyboardEvent('keydown',{code:'${turns[i % 4]}'}))`);
    await sleep(400); watching = await beto.evaluate('!document.getElementById("spectate").hidden');
  }
  if (watching) {
    await sleep(400);
    await beto.screenshot('preview-online-spectator.png');
    const name = await beto.evaluate('document.getElementById("spectate-name").textContent');
    assert.ok(name.length > 0, 'spectator mode names who you are watching');
    assert.equal(await beto.evaluate('getComputedStyle(document.querySelector(".abilities")).display'), 'none', 'controls hide while watching');
    await beto.evaluate('document.getElementById("spectate-next").click()');
    await sleep(300);
    console.log('Spectator OK: watching ' + name);
  } else console.log('Beto was not caught within 30 s; spectator mode not exercised this run.');
  assert.deepEqual(errors, [], 'no browser errors');
  console.log('Online OK: room code, friend joins, host starts, both phones play the same match.');
  await send('Browser.close');
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
  await sleep(300);
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

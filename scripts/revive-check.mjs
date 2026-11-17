// Optional check of "keep playing" with a rewarded ad, in Chromium with a fake AdMob plugin:
// a 13+ player leaves their zone until a robot catches them, takes the offer, "watches" the
// ad and must be back in the match with their land.
// Usage: node scripts/revive-check.mjs <chrome executable>
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const executable = process.argv[2];
if (!executable) throw new Error('Usage: node scripts/revive-check.mjs <chrome executable>');
const root = new URL('..', import.meta.url), profileDir = await mkdtemp(join(tmpdir(), 'pintamundo-revive-'));
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
// A fake native app with an AdMob plugin whose rewarded ad is "watched" in 300 ms.
const fakeAdMob = `
  const handlers = {};
  window.Capacitor = { isNativePlatform: () => true, Plugins: { AdMob: {
    requestConsentInfo: async () => ({ status: 'NOT_REQUIRED', isConsentFormAvailable: false }),
    initialize: async () => {}, prepareRewardVideoAd: async () => ({}),
    addListener: (event, fn) => { handlers[event] = fn; return { remove() { delete handlers[event]; } }; },
    showRewardVideoAd: () => new Promise(resolve => setTimeout(() => { resolve({ type: 'Recompensa', amount: 1 }); setTimeout(() => handlers.onRewardedVideoAdDismissed?.(), 50); }, 300))
  } } };`;
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
  const key = (code, k, type = 'keyDown') => page('Input.dispatchKeyEvent', { type, code, key: k });
  await page('Runtime.enable'); await page('Page.enable');
  await page('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await page('Page.addScriptToEvaluateOnNewDocument', { source: 'let randomSeed=91;Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};' });
  await page('Page.addScriptToEvaluateOnNewDocument', { source: fakeAdMob });
  await page('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('neon-frontier.profile.v1', JSON.stringify({version:1,epoch:2,ageGroup:'teen',name:'Luna',bits:0,xp:0,wins:0,totalKills:0,best:0,nemesis:'',skin:'interceptor',trail:'cyan',skins:[],trails:['cyan'],easy:false,chests:{comun:0,raro:0,epico:0,legendario:0},freeChestAt:0}))" });
  await page('Page.navigate', { url: base }); await sleep(5000); // the rewarded ad preloads ~3 s after launch
  await evaluate('document.getElementById("dialog").open && document.getElementById("dialog").close()');
  await evaluate('document.getElementById("play").click()'); await sleep(500);
  // Spiral outwards, ever further from home, until a robot cuts the long trail.
  const turns = [['KeyD', 'd'], ['KeyS', 's'], ['KeyA', 'a'], ['KeyW', 'w']];
  for (let i = 0; i < 40 && !await evaluate('Boolean(document.getElementById("revive-yes"))'); i++) {
    const [code, k] = turns[i % 4]; await key(code, k);
    for (let t = 0; t < 500 + i * 250 && !await evaluate('Boolean(document.getElementById("revive-yes"))'); t += 250) await sleep(250);
    await key(code, k, 'keyUp');
  }
  assert.equal(await evaluate('Boolean(document.getElementById("revive-yes"))'), true, 'caught with an ad ready: the keep-playing offer appears: ' + await evaluate('JSON.stringify({ dialog: document.getElementById("dialog").open && document.getElementById("dialog-content").textContent.slice(0, 90), hud: !document.getElementById("hud").hidden, territory: document.getElementById("hud-territory").textContent, freeAd: document.getElementById("free-chest-ad").hidden })'));
  await writeFile(new URL('preview-revive.png', root), Buffer.from((await page('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate('document.getElementById("revive-yes").click()');
  assert.equal(await until('!document.getElementById("dialog").open && /DE VUELTA/.test(document.getElementById("announcement").textContent)', 5000), true, 'after the ad the player is back in the match');
  assert.equal(await evaluate('document.getElementById("hud").hidden'), false);
  assert.match(await evaluate('document.getElementById("hud-territory").textContent'), /^[1-9]\d*%$/, 'with their land back');
  assert.deepEqual(errors, [], 'no browser errors');
  console.log('Revive OK: caught → watched the (fake) ad → back in the match with their land.');
  await send('Browser.close');
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
  await sleep(300);
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

// Google Play store graphics: landscape phone screenshots (1920×1080) of the real game with
// a sample profile, plus the 1024×500 feature graphic. Writes them to play-store/.
// Usage: node scripts/store-shots.mjs <chrome executable>
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const executable = process.argv[2];
if (!executable) throw new Error('Usage: node scripts/store-shots.mjs <chrome executable>');
const root = new URL('..', import.meta.url), out = new URL('play-store/', root), profileDir = await mkdtemp(join(tmpdir(), 'pintamundo-store-'));
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, windowsHide: true });
let browser, socket;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function outputUntil(stream, expression) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Readiness timeout: ' + output.slice(-500))), 20000);
    stream.on('data', data => { output += data; const match = output.match(expression); if (match) { clearTimeout(timer); resolve(match[0]); } });
  });
}
// A player some days in: level 9, several rare-or-better characters, chests to open, a streak.
const yesterday = new Date(Date.now() - 86400000), day = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sample = {
  version: 1, name: 'Luna', updatedAt: 1, points: 812, ranked: true, bits: 3450, xp: 5200, wins: 12, totalKills: 48, best: 64, nemesis: '',
  skin: 'unicornio', trail: 'gold', skins: ['tron', 'abeja', 'koala', 'spectre', 'tiburon', 'pintor', 'panda', 'unicornio', 'fenix'], trails: ['cyan', 'pink', 'gold'],
  copies: { unicornio: 4, tron: 6 }, easy: false, chests: { comun: 1, raro: 2, epico: 1, legendario: 1 }, freeChestAt: 0,
  daily: { day: '', progress: {}, claimed: [], bonus: false }, streak: { last: day(yesterday), count: 4 }, friends: [], seasonClaimed: ''
};
try {
  const base = await outputUntil(server.stdout, /http:\/\/\S+/);
  browser = spawn(executable, ['--headless=new', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--remote-allow-origins=*', '--window-size=1920,1080', '--hide-scrollbars', '--user-data-dir=' + profileDir, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  socket = new WebSocket(await outputUntil(browser.stderr, /ws:\/\/\S+/));
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  socket.onmessage = message => { const event = JSON.parse(message.data); if (pending.has(event.id)) { const p = pending.get(event.id); pending.delete(event.id); if (event.error) p.reject(new Error(event.error.message)); else p.resolve(event.result); } };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => { const r = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const shot = async name => { const r = await page('Page.captureScreenshot', { format: 'png' }); await writeFile(new URL(name, out), Buffer.from(r.data, 'base64')); console.log('  ' + name); };
  const key = (code, k, type = 'keyDown') => page('Input.dispatchKeyEvent', { type, code, key: k });
  await page('Runtime.enable'); await page('Page.enable');
  await page('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await page('Page.addScriptToEvaluateOnNewDocument', { source: 'let randomSeed=7;Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};' });
  await page('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('neon-frontier.profile.v1', ${JSON.stringify(JSON.stringify(sample))});` });
  await page('Page.navigate', { url: base }); await sleep(2500);
  await evaluate('document.getElementById("dialog").open && document.getElementById("dialog").close()');
  await shot('01-inicio.png');
  // A match: a loop out of the base and back, with Burbuja on, then a moment of play.
  await evaluate('document.getElementById("play").click()'); await sleep(600);
  for (const [code, k, ms] of [['KeyD', 'd', 900], ['KeyS', 's', 900], ['KeyA', 'a', 900], ['KeyW', 'w', 700], ['KeyD', 'd', 1100], ['KeyS', 's', 500]]) { await key(code, k); await sleep(ms); await key(code, k, 'keyUp'); }
  await key('Space', ' '); await key('Space', ' ', 'keyUp'); await sleep(250);
  await shot('02-partida.png');
  await key('Escape', 'Escape'); await key('Escape', 'Escape', 'keyUp'); await sleep(200);
  await evaluate('document.getElementById("abandon").click()'); await sleep(1200);
  await evaluate('document.getElementById("to-menu") ? document.getElementById("to-menu").click() : document.getElementById("dialog").close()'); await sleep(300);
  await evaluate('document.getElementById("dialog").open && document.getElementById("dialog").close()');
  await evaluate(`document.querySelector('.tab[data-tab="collection"]').click()`); await sleep(400);
  await evaluate('document.querySelector("[data-skin=unicornio]").closest("article").scrollIntoView({ block: "center" })'); await sleep(300);
  await shot('03-coleccion.png');
  await evaluate(`document.querySelector('.tab[data-tab="crates"]').click()`); await sleep(300);
  await evaluate('document.querySelector("[data-open=legendario]").click()'); await sleep(1900);
  await shot('04-cofre.png');
  await evaluate('document.getElementById("close-crate").click()');
  await evaluate(`document.querySelector('.tab[data-tab="ranks"]').click()`); await sleep(400);
  await evaluate('document.getElementById("dialog").open && document.getElementById("dialog").close()');
  await evaluate('document.querySelector("[data-ranks=ladder]").click()'); await sleep(300);
  await shot('05-rangos.png');
  await evaluate(`document.querySelector('.tab[data-tab="crates"]').click()`); await evaluate('document.getElementById("play").click()'); await sleep(300);
  await evaluate('document.getElementById("missions-badge").click()'); await sleep(400);
  await shot('06-misiones.png');
  // Feature graphic, 1024×500: title and characters on the game's blue.
  await page('Emulation.setDeviceMetricsOverride', { width: 1024, height: 500, deviceScaleFactor: 1, mobile: false });
  await page('Page.navigate', { url: base + '/privacy.html' }); await sleep(500);
  await evaluate(`(async () => {
    document.head.insertAdjacentHTML('beforeend', '<style>@font-face{font-family:Lilita;src:url(fonts/lilita-one-latin-400-normal.woff2)}@font-face{font-family:Baloo;font-weight:800;src:url(fonts/baloo-2-latin-800-normal.woff2)}</style>');
    document.body.innerHTML = '<div id="art"><div class="text"><h1>Pintamundo</h1><p>¡Pinta el mundo de tu color!</p><span>Multijugador · 37 personajes · Rangos</span></div><img class="hero" src="icons/icon-512.png"><img class="a" src="ui/chest.png"><img class="b" src="ui/trophy.png"><img class="c" src="ui/collection.png"></div>';
    document.body.style.cssText = 'margin:0;padding:0;background:#1f55e0';
    const css = document.createElement('style');
    css.textContent = '#art{position:relative;width:1024px;height:500px;overflow:hidden;background:radial-gradient(circle at 75% 40%,#6fb3ff,#2d7bff 45%,#1f3fc0);font-family:Baloo}' +
      '.text{position:absolute;left:56px;top:110px;color:#fff}h1{margin:0;color:#fff;font:96px Lilita;-webkit-text-stroke:12px #1c2a6e;paint-order:stroke fill;text-shadow:0 8px 0 #1c2a6e}' +
      'p{margin:14px 0 0;font:800 34px Baloo;text-shadow:0 3px 0 #1c2a6e}span{display:inline-block;margin-top:18px;padding:6px 18px;border:4px solid #1c2a6e;border-radius:99px;background:#ffd23a;color:#1c2a6e;font:800 24px Baloo}' +
      '.hero{position:absolute;right:70px;top:70px;width:340px;border:8px solid #1c2a6e;border-radius:70px;box-shadow:0 10px 0 #1c2a6e;transform:rotate(6deg)}' +
      '.a,.b,.c{position:absolute;filter:drop-shadow(0 6px 0 #1c2a6e)}.a{right:330px;bottom:-10px;width:170px}.b{right:24px;bottom:-14px;width:150px}.c{right:390px;top:-18px;width:130px;transform:rotate(-12deg)}';
    document.head.append(css);
    await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  })()`);
  await sleep(300);
  await shot('feature-graphic.png');
  await copyFile(new URL('icons/icon-512.png', root), new URL('icon-512.png', out));
  console.log('Play Store graphics written to play-store/.');
  await send('Browser.close');
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
  await sleep(300);
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

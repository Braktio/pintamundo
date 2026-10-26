// Google Play store graphics. Plays the real game with a sample profile at the size of a
// landscape phone (960×540 shown at 2×, so the phone layout is used), then frames each screen with a big title on a 1920×1080 card,
// plus the 1024×500 feature graphic drawn with the game's own characters.
// Usage: node scripts/store-shots.mjs <chrome executable>
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const executable = process.argv[2];
if (!executable) throw new Error('Usage: node scripts/store-shots.mjs <chrome executable>');
const root = new URL('..', import.meta.url), out = new URL('play-store/', root), profileDir = await mkdtemp(join(tmpdir(), 'pintamundo-store-'));
await mkdir(out, { recursive: true });
// Old numbered screenshots are replaced by the new set.
for (const file of await readdir(out)) if (/^\d\d-.*\.png$/.test(file)) await rm(new URL(file, out));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, windowsHide: true });
let browser, socket;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function outputUntil(stream, expression) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Readiness timeout: ' + output.slice(-500))), 20000);
    stream.on('data', data => { output += data; const match = output.match(expression); if (match) { clearTimeout(timer); resolve(match[0]); } });
  });
}
// A player some days in (13 or older, so every screen is available): level 9, several
// rare-or-better characters, chests to open and a streak.
const yesterday = new Date(Date.now() - 86400000), day = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sample = {
  version: 1, epoch: 2, ageGroup: 'teen', name: 'Luna', updatedAt: 1, points: 812, ranked: true, bits: 3450, xp: 5200, wins: 12, totalKills: 48, best: 64, nemesis: '',
  skin: 'unicornio', trail: 'gold', skins: ['tron', 'abeja', 'koala', 'spectre', 'tiburon', 'pintor', 'panda', 'unicornio', 'fenix'], trails: ['cyan', 'pink', 'gold'],
  copies: { unicornio: 4, tron: 6 }, easy: false, chests: { comun: 1, raro: 2, epico: 1, legendario: 1 }, freeChestAt: 0,
  daily: { day: '', progress: {}, claimed: [], bonus: false }, streak: { last: day(yesterday), count: 4 }, friends: [], seasonClaimed: ''
};
// Store cards: raw screen file, title and background colors.
const CARDS = [
  ['01-inicio', 'home', '¡Pinta el mundo de tu color!', ['#4f9bff', '#1f55e0']],
  ['02-partida', 'match', 'Encierra zonas y píntalas', ['#5fd38a', '#1f9e63']],
  ['03-amigos', 'lobby', 'Juega en línea con tus amigos', ['#ff9a5c', '#e2552b']],
  ['04-coleccion', 'collection', '37 personajes con poderes', ['#b98cff', '#6b3fd6']],
  ['05-cofre', 'chest', 'Abre cofres llenos de sorpresas', ['#ffcf4a', '#f08c00']],
  ['06-rangos', 'ranks', 'Sube de rango cada temporada', ['#4fd1e8', '#1f8ec0']],
  ['07-misiones', 'missions', 'Misiones y premios cada día', ['#ff8ad8', '#d6409c']],
  ['08-niveles', 'levels', 'Mejora a tus personajes favoritos', ['#7be0a0', '#2fa36b']]
];
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
  const raw = {};
  const grab = async name => { const r = await page('Page.captureScreenshot', { format: 'png' }); raw[name] = r.data; console.log('  pantalla: ' + name); };
  const shot = async name => { const r = await page('Page.captureScreenshot', { format: 'png' }); await writeFile(new URL(name, out), Buffer.from(r.data, 'base64')); console.log('  ' + name); };
  const key = (code, k, type = 'keyDown') => page('Input.dispatchKeyEvent', { type, code, key: k });
  const hold = async (code, k, ms) => { await key(code, k); await sleep(ms); await key(code, k, 'keyUp'); };
  const closeDialog = () => evaluate('document.getElementById("dialog").open && document.getElementById("dialog").close()');
  await page('Runtime.enable'); await page('Page.enable');
  // A landscape phone: 960×540 CSS pixels at 2× gives 1920×1080 with the compact phone layout.
  await page('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 2, mobile: true });
  await page('Page.addScriptToEvaluateOnNewDocument', { source: 'let randomSeed=7;Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};' });
  await page('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('neon-frontier.profile.v1', ${JSON.stringify(JSON.stringify(sample))});` });
  await page('Page.navigate', { url: base }); await sleep(2500);
  await closeDialog();
  await grab('home');
  // A match: loops out of the base and back so the zone grows, with Rodillo on halfway. A frame
  // is kept after every leg while the player is still in play, so a catch by a robot never
  // ends up as the match picture.
  await evaluate('document.getElementById("play").click()'); await sleep(700);
  const legs = [['KeyD', 'd', 1000], ['KeyS', 's', 1200], ['KeyA', 'a', 1200], ['KeyW', 'w', 1300], ['KeyD', 'd', 500],
    ['KeyW', 'w', 1000], ['KeyA', 'a', 1300], ['KeyS', 's', 1100], ['KeyD', 'd', 800], ['KeyS', 's', 1000], ['KeyD', 'd', 1200], ['KeyW', 'w', 900]];
  for (const [i, [code, k, ms]] of legs.entries()) {
    if (i === 6) { await key('ShiftLeft', 'Shift'); await key('ShiftLeft', 'Shift', 'keyUp'); }
    await hold(code, k, ms);
    if (await evaluate('document.getElementById("dialog").open')) break;
    await grab('match');
  }
  // Results of the match, with stars and the chest bar.
  await key('Escape', 'Escape'); await key('Escape', 'Escape', 'keyUp'); await sleep(250);
  // If a robot already caught the player there is no pause window: the results are on screen.
  await evaluate('document.getElementById("abandon")?.click()'); await sleep(1600);
  await evaluate('document.getElementById("to-menu") ? document.getElementById("to-menu").click() : document.getElementById("dialog").close()'); await sleep(400);
  await closeDialog();
  await evaluate(`document.querySelector('.tab[data-tab="collection"]').click()`); await sleep(400);
  await evaluate('document.querySelector("[data-skin=unicornio]").closest("article").scrollIntoView({ block: "center" })'); await sleep(300);
  await grab('collection');
  // Character levels: an owned legendary with repeats, its level and wider powers.
  await evaluate('document.querySelector("[data-skin=tron]").closest("article").scrollIntoView({ block: "center" })'); await sleep(300);
  await grab('levels');
  await evaluate(`document.querySelector('.tab[data-tab="crates"]').click()`); await sleep(300);
  await evaluate('document.querySelector("[data-open=legendario]").click()'); await sleep(1900);
  await grab('chest');
  await evaluate('document.getElementById("close-crate").click()');
  await evaluate(`document.querySelector('.tab[data-tab="ranks"]').click()`); await sleep(400);
  await closeDialog();
  await evaluate('document.querySelector("[data-ranks=ladder]").click()'); await sleep(300);
  await grab('ranks');
  await evaluate(`document.querySelector('.tab[data-tab="crates"]').click()`); await evaluate('document.getElementById("play").click()'); await sleep(300);
  await evaluate('document.getElementById("missions-badge").click()'); await sleep(400);
  await grab('missions');
  await closeDialog();
  // A friends' room on the local server (never the public one), waiting for friends to join.
  await evaluate('document.getElementById("online").click()'); await sleep(300);
  await evaluate('document.getElementById("online-create").click()');
  for (let i = 0; i < 40 && !await evaluate('Boolean(document.querySelector(".room-code"))'); i++) await sleep(150);
  await sleep(400);
  await grab('lobby');
  await evaluate('document.getElementById("lobby-leave")?.click()');
  // Store cards, 1920×1080: title on the game's style and the screen in a rounded frame.
  await page('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await page('Page.navigate', { url: base + '/privacy.html' }); await sleep(500);
  const fonts = "@font-face{font-family:Lilita;src:url(fonts/lilita-one-latin-400-normal.woff2)}@font-face{font-family:Baloo;font-weight:800;src:url(fonts/baloo-2-latin-800-normal.woff2)}";
  for (const [file, screen, title, [light, dark]] of CARDS) {
    await evaluate(`(async () => {
      document.head.innerHTML = '<meta charset="utf-8"><style>${fonts}html,body{margin:0;width:1920px;height:1080px;overflow:hidden}'
        + '#card{position:relative;width:1920px;height:1080px;background:radial-gradient(circle at 50% 0%,${light},${dark} 75%);font-family:Baloo}'
        + '#card:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 12% 88%,#ffffff22 0 90px,transparent 91px),radial-gradient(circle at 92% 18%,#ffffff22 0 120px,transparent 121px),radial-gradient(circle at 80% 92%,#ffffff1a 0 70px,transparent 71px)}'
        + 'h1{position:absolute;left:0;right:0;top:46px;margin:0;text-align:center;color:#fff;font:92px Lilita;-webkit-text-stroke:14px #1c2a6e;paint-order:stroke fill;text-shadow:0 8px 0 #1c2a6e}'
        + 'img{position:absolute;left:50%;top:205px;width:1480px;height:832px;transform:translateX(-50%);border:10px solid #1c2a6e;border-radius:44px;box-shadow:0 18px 0 #1c2a6e66;object-fit:cover}</style>';
      document.body.innerHTML = '<div id="card"><h1>${title}</h1><img src="data:image/png;base64,${raw[screen]}"></div>';
      await document.fonts.ready; await document.querySelector('img').decode();
    })()`);
    await shot(file + '.png');
  }
  // Feature graphic, 1024×500: title, tagline and a band of the game's characters.
  await page('Emulation.setDeviceMetricsOverride', { width: 1024, height: 500, deviceScaleFactor: 1, mobile: false });
  await page('Page.navigate', { url: base + '/privacy.html' }); await sleep(500);
  await evaluate(`(async () => {
    const { Renderer } = await import('./renderer.js');
    const canvas = document.createElement('canvas'), r = new Renderer(canvas);
    const cast = [['fenix', '#ff8a1f'], ['unicornio', '#ff5fc8'], ['tron', '#2fa8ff'], ['golem', '#9b5cff'], ['panda', '#5cc93b']];
    const art = cast.map(([skin, color], i) => '<img class="c c' + i + '" src="' + r.portraitURL({ skin, color }, 300) + '">').join('');
    document.head.innerHTML = '<meta charset="utf-8"><style>${fonts}html,body{margin:0;width:1024px;height:500px;overflow:hidden}'
      + '#art{position:relative;width:1024px;height:500px;overflow:hidden;background:radial-gradient(circle at 72% 45%,#7cc4ff,#2d7bff 48%,#1f3fc0);font-family:Baloo}'
      + '.blob{position:absolute;border-radius:50%;opacity:.9}.b1{left:590px;top:300px;width:300px;height:220px;background:#ffd23a}.b2{left:760px;top:-60px;width:300px;height:240px;background:#ff8ad8}.b3{left:470px;top:-90px;width:220px;height:180px;background:#5cc93b}'
      + '.text{position:absolute;left:48px;top:96px;color:#fff;z-index:2}h1{margin:0;font:94px Lilita;-webkit-text-stroke:13px #1c2a6e;paint-order:stroke fill;text-shadow:0 8px 0 #1c2a6e}'
      + 'p{margin:10px 0 0;font:800 34px Baloo;text-shadow:0 3px 0 #1c2a6e}span{display:inline-block;margin-top:20px;padding:6px 18px;border:4px solid #1c2a6e;border-radius:99px;background:#ffd23a;color:#1c2a6e;font:800 23px Baloo}'
      + '.c{position:absolute;width:210px;filter:drop-shadow(0 7px 0 #1c2a6e66)}.c0{left:560px;top:250px}.c1{left:700px;top:40px;width:250px}.c2{left:830px;top:240px}.c3{left:880px;top:20px;width:170px}.c4{left:600px;top:20px;width:160px}</style>';
    document.body.innerHTML = '<div id="art"><i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i>' + art + '<div class="text"><h1>Pintamundo</h1><p>¡Pinta el mundo de tu color!</p><span>En línea · 37 personajes · Rangos</span></div></div>';
    await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  })()`);
  await sleep(300);
  await shot('feature-graphic.png');
  console.log('Play Store graphics written to play-store/.');
  await send('Browser.close');
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
  await sleep(300);
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

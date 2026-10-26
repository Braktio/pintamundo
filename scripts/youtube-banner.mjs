// YouTube channel banner (2560×1440). Title and slogan stay inside YouTube's safe area
// (1546×423 in the middle, visible on every device); characters fill the sides, which show on
// computers and TVs. Writes play-store/youtube-banner.png.
// Usage: node scripts/youtube-banner.mjs <chrome executable>
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const executable = process.argv[2];
if (!executable) throw new Error('Usage: node scripts/youtube-banner.mjs <chrome executable>');
const root = new URL('..', import.meta.url), profileDir = await mkdtemp(join(tmpdir(), 'pintamundo-banner-'));
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
try {
  const base = await outputUntil(server.stdout, /http:\/\/\S+/);
  browser = spawn(executable, ['--headless=new', '--no-sandbox', '--no-first-run', '--remote-debugging-port=0', '--remote-allow-origins=*', '--window-size=2560,1440', '--hide-scrollbars', '--user-data-dir=' + profileDir, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  socket = new WebSocket(await outputUntil(browser.stderr, /ws:\/\/\S+/));
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  socket.onmessage = message => { const event = JSON.parse(message.data); if (pending.has(event.id)) { const p = pending.get(event.id); pending.delete(event.id); if (event.error) p.reject(new Error(event.error.message)); else p.resolve(event.result); } };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => { const r = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  await page('Runtime.enable'); await page('Page.enable');
  await page('Emulation.setDeviceMetricsOverride', { width: 2560, height: 1440, deviceScaleFactor: 1, mobile: false });
  await page('Page.navigate', { url: base + '/privacy.html' }); await sleep(600);
  await evaluate(`(async () => {
    const { Renderer } = await import('./renderer.js');
    const r = new Renderer(document.createElement('canvas'));
    // [skin, trail color, left, top, width]: two groups beside the safe area, plus a few above and below for TVs.
    const cast = [
      ['fenix', '#ff8a1f', 70, 520, 330], ['unicornio', '#ff5fc8', 290, 640, 290], ['tron', '#2fa8ff', 110, 800, 250],
      ['golem', '#9b5cff', 2150, 520, 330], ['panda', '#5cc93b', 1960, 640, 290], ['abeja', '#ffd23a', 2200, 800, 250],
      ['tiburon', '#2fa8ff', 620, 120, 260], ['pintor', '#ff5fc8', 1700, 160, 240], ['rana', '#5cc93b', 900, 1080, 240], ['leon', '#ff8a1f', 1480, 1060, 260]
    ];
    const art = cast.map(([skin, color, left, top, width]) => '<img class="c" style="left:' + left + 'px;top:' + top + 'px;width:' + width + 'px" src="' + r.portraitURL({ skin, color }, 400) + '">').join('');
    document.head.innerHTML = '<meta charset="utf-8"><style>@font-face{font-family:Lilita;src:url(fonts/lilita-one-latin-400-normal.woff2)}@font-face{font-family:Baloo;font-weight:800;src:url(fonts/baloo-2-latin-800-normal.woff2)}'
      + 'html,body{margin:0;width:2560px;height:1440px;overflow:hidden}'
      + '#b{position:relative;width:2560px;height:1440px;overflow:hidden;background:radial-gradient(circle at 50% 50%,#7cc4ff,#2d7bff 45%,#1f3fc0);font-family:Baloo}'
      + '.blob{position:absolute;border-radius:50%;opacity:.95}'
      + '.c{position:absolute;filter:drop-shadow(0 12px 0 #1c2a6e55)}'
      + '.safe{position:absolute;left:507px;top:508px;width:1546px;height:423px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;z-index:2}'
      + 'h1{margin:0;font:190px Lilita;color:#fff;-webkit-text-stroke:24px #1c2a6e;paint-order:stroke fill;text-shadow:0 14px 0 #1c2a6e;line-height:1}'
      + 'p{margin:22px 0 0;font:800 64px Baloo;color:#fff;text-shadow:0 5px 0 #1c2a6e}'
      + 'span{display:inline-block;margin-top:22px;padding:8px 34px;border:6px solid #1c2a6e;border-radius:99px;background:#ffd23a;color:#1c2a6e;font:800 40px Baloo;box-shadow:0 8px 0 #1c2a6e}</style>';
    const blobs = [[-120, 420, 620, 520, '#ffd23a'], [2080, 380, 640, 560, '#ff8ad8'], [500, -160, 520, 380, '#5cc93b'], [1620, -180, 560, 400, '#ff9a3c'], [760, 1150, 560, 420, '#b98cff'], [1380, 1180, 600, 400, '#4fd1e8']]
      .map(([l, t, w, h, c]) => '<i class="blob" style="left:' + l + 'px;top:' + t + 'px;width:' + w + 'px;height:' + h + 'px;background:' + c + '"></i>').join('');
    document.body.innerHTML = '<div id="b">' + blobs + art + '<div class="safe"><h1>Pintamundo</h1><p>¡Pinta el mundo de tu color!</p><span>Juego gratis · En línea con amigos</span></div></div>';
    await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  })()`);
  await sleep(300);
  const shot = await page('Page.captureScreenshot', { format: 'png' });
  await writeFile(new URL('play-store/youtube-banner.png', root), Buffer.from(shot.data, 'base64'));
  console.log('Banner written to play-store/youtube-banner.png');
  await send('Browser.close');
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
  await sleep(300);
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

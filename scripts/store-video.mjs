// Promo video for Google Play / YouTube (~30 s, 1920×1080, MP4 with narration and music).
// Plays the real game in Chrome at the size of a landscape phone, records the screen with the
// DevTools screencast, renders the game's own music offline, narrates each scene with a
// Windows Spanish voice and joins everything with ffmpeg (the music ducks under the voice).
// Usage: node scripts/store-video.mjs <chrome executable> <ffmpeg executable> [output.mp4]
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [executable, ffmpeg, target = 'play-store/pintamundo-video.mp4'] = process.argv.slice(2);
if (!executable || !ffmpeg) throw new Error('Usage: node scripts/store-video.mjs <chrome executable> <ffmpeg executable> [output.mp4]');
const root = new URL('..', import.meta.url), work = await mkdtemp(join(tmpdir(), 'pintamundo-video-'));
const fsPath = url => decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:)/, '$1');
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, windowsHide: true });
let browser, socket;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const run = (command, args) => new Promise((resolve, reject) => {
  const job = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let log = ''; job.stderr.on('data', d => { log += d; });
  job.on('exit', code => code === 0 ? resolve() : reject(new Error(command + ': ' + log.slice(-800))));
});
function outputUntil(stream, expression) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Readiness timeout: ' + output.slice(-500))), 20000);
    stream.on('data', data => { output += data; const match = output.match(expression); if (match) { clearTimeout(timer); resolve(match[0]); } });
  });
}
// Narration: one line per scene, spoken when the scene starts (plus a small delay).
const LINES = {
  intro: '¡Bienvenidos a Pintamundo!',
  match: 'Sal de tu zona, dibuja un camino y vuelve a casa para pintarlo todo de tu color.',
  powers: '¡Usa poderes increíbles!',
  chest: 'Abre cofres llenos de sorpresas.',
  collection: 'Colecciona treinta y siete personajes.',
  friends: '¡Y juega en línea con tus amigos!',
  outro: 'Pintamundo. ¡Juega gratis!'
};
// Same sample player as the store screenshots: 13 or older, level 9, chests and characters.
const yesterday = new Date(Date.now() - 86400000), day = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sample = {
  version: 1, epoch: 2, ageGroup: 'teen', name: 'Luna', updatedAt: 1, points: 812, ranked: true, bits: 3450, xp: 5200, wins: 12, totalKills: 48, best: 64, nemesis: '',
  skin: 'unicornio', trail: 'gold', skins: ['tron', 'abeja', 'koala', 'spectre', 'tiburon', 'pintor', 'panda', 'unicornio', 'fenix'], trails: ['cyan', 'pink', 'gold'],
  copies: { unicornio: 4, tron: 6 }, easy: false, chests: { comun: 1, raro: 2, epico: 1, legendario: 1 }, freeChestAt: 0,
  daily: { day: '', progress: {}, claimed: [], bonus: false }, streak: { last: day(yesterday), count: 4 }, friends: [], seasonClaimed: ''
};
// Overlay drawn inside the game page: a caption banner and full-screen title cards.
const OVERLAY = `(async () => {
  const { Renderer } = await import('./renderer.js');
  const r = new Renderer(document.createElement('canvas'));
  const cast = [['fenix', '#ff8a1f'], ['unicornio', '#ff5fc8'], ['tron', '#2fa8ff'], ['golem', '#9b5cff'], ['panda', '#5cc93b']];
  window.promoCast = cast.map(([skin, color], i) => '<img style="animation-delay:' + (i * .12) + 's" src="' + r.portraitURL({ skin, color }, 220) + '">').join('');
  const css = document.createElement('style');
  css.textContent = '#promo-cap{position:fixed;left:50%;top:14px;z-index:9999;transform:translateX(-50%);padding:6px 26px;border:5px solid #1c2a6e;border-radius:99px;background:#ffd23a;box-shadow:0 6px 0 #1c2a6e;font:34px "Lilita One";color:#fff;-webkit-text-stroke:7px #1c2a6e;paint-order:stroke fill;white-space:nowrap;pointer-events:none;animation:promo-pop .45s cubic-bezier(.2,1.6,.4,1)}'
    + '#promo-card{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:radial-gradient(circle at 50% 40%,#7cc4ff,#2d7bff 50%,#1f3fc0);pointer-events:none}'
    + '#promo-card h1{margin:0;font:96px "Lilita One";color:#fff;-webkit-text-stroke:14px #1c2a6e;paint-order:stroke fill;text-shadow:0 8px 0 #1c2a6e;animation:promo-pop .6s cubic-bezier(.2,1.6,.4,1)}'
    + '#promo-card p{margin:0;font:800 34px "Baloo 2";color:#fff;text-shadow:0 3px 0 #1c2a6e}'
    + '#promo-card .cast{display:flex;gap:6px;margin-bottom:6px}#promo-card .cast img{width:120px;animation:promo-jump .9s ease-in-out infinite alternate both}'
    + '#promo-card .chip{margin-top:12px;padding:6px 22px;border:4px solid #1c2a6e;border-radius:99px;background:#ffd23a;color:#1c2a6e;font:800 26px "Baloo 2";box-shadow:0 5px 0 #1c2a6e}'
    + '@keyframes promo-pop{from{transform:translateX(var(--tx,0)) scale(.3);opacity:0}to{transform:translateX(var(--tx,0)) scale(1);opacity:1}}#promo-cap{--tx:-50%}'
    + '@keyframes promo-jump{from{transform:translateY(8px)}to{transform:translateY(-14px)}}';
  document.head.append(css);
  window.promoCaption = text => { document.getElementById('promo-cap')?.remove(); if (text) document.body.insertAdjacentHTML('beforeend', '<div id="promo-cap">' + text + '</div>'); };
  window.promoCard = (title, line, chip) => { document.getElementById('promo-card')?.remove(); if (title) document.body.insertAdjacentHTML('beforeend', '<div id="promo-card"><div class="cast">' + window.promoCast + '</div><h1>' + title + '</h1><p>' + line + '</p>' + (chip ? '<span class="chip">' + chip + '</span>' : '') + '</div>'); };
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
})()`;
// The game's own song (music.js), rendered offline: no copyright claims on YouTube.
const MUSIC = seconds => `(async () => {
  const { MusicPlayer } = await import('./music.js');
  const rate = 44100, ctx = new OfflineAudioContext(2, Math.ceil(rate * ${seconds}), rate), player = new MusicPlayer();
  player.init(ctx); player.masterGain.gain.cancelScheduledValues(0); player.masterGain.gain.setValueAtTime(player.volume, 0);
  const step = 60 / 124 / 4;
  for (let i = 0, t = .05; t < ${seconds}; i++, t += step) player.playStep(i % 256, t);
  const buffer = await ctx.startRendering(), frames = buffer.length, out = new DataView(new ArrayBuffer(44 + frames * 4));
  const text = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  text(0, 'RIFF'); out.setUint32(4, 36 + frames * 4, true); text(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); text(36, 'data'); out.setUint32(40, frames * 4, true);
  const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
  for (let i = 0; i < frames; i++) for (const [c, data] of [[0, left], [1, right]]) out.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
  const bytes = new Uint8Array(out.buffer); let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
})()`;
// Windows text-to-speech (modern OneCore voice, Spanish), one WAV per line.
async function narrate(lines) {
  const script = join(work, 'voz.ps1');
  await writeFile(script, '﻿' + [
    'Add-Type -AssemblyName System.Runtime.WindowsRuntime',
    '$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]',
    "$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]",
    'function Await($op, $type) { $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }',
    '$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer',
    "$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -like 'es-*' -and $_.DisplayName -like '*Sabina*' } | Select-Object -First 1",
    "if (-not $voice) { $voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -like 'es-*' } | Select-Object -First 1 }",
    'if (-not $voice) { throw "No hay voces en español instaladas en Windows." }',
    '$synth.Voice = $voice',
    ...Object.entries(lines).map(([name, text]) => {
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${'es-MX'}"><prosody rate="+8%" pitch="+6%">${text}</prosody></speak>`;
      return `$s = Await ($synth.SynthesizeSsmlToStreamAsync('${ssml.replace(/'/g, "''")}')) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream]); `
        + `$f = [System.IO.File]::Create('${join(work, name + '.wav').replace(/'/g, "''")}'); [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($s).CopyTo($f); $f.Close()`;
    })
  ].join('\r\n'), 'utf8');
  await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script]);
}
try {
  const base = await outputUntil(server.stdout, /http:\/\/\S+/);
  browser = spawn(executable, ['--headless=new', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--remote-allow-origins=*', '--window-size=1920,1080', '--hide-scrollbars', '--user-data-dir=' + join(work, 'profile'), 'about:blank'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  socket = new WebSocket(await outputUntil(browser.stderr, /ws:\/\/\S+/));
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0, sessionId; const pending = new Map(), frames = [];
  socket.onmessage = message => {
    const event = JSON.parse(message.data);
    // Every recorded frame is kept with its timestamp and acknowledged so the next one comes.
    if (event.method === 'Page.screencastFrame') {
      frames.push({ data: event.params.data, time: event.params.metadata.timestamp });
      socket.send(JSON.stringify({ id: ++sequence, method: 'Page.screencastFrameAck', params: { sessionId: event.params.sessionId }, sessionId }));
      return;
    }
    if (pending.has(event.id)) { const p = pending.get(event.id); pending.delete(event.id); if (event.error) p.reject(new Error(event.error.message)); else p.resolve(event.result); }
  };
  const send = (method, params = {}, session) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId: session })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
  const page = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => { const r = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const key = (code, k, type = 'keyDown') => page('Input.dispatchKeyEvent', { type, code, key: k });
  const hold = async (code, k, ms) => { await key(code, k); await sleep(ms); await key(code, k, 'keyUp'); };
  const closeDialog = () => evaluate('document.getElementById("dialog").open && document.getElementById("dialog").close()');
  await page('Runtime.enable'); await page('Page.enable');
  await page('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 2, mobile: true });
  await page('Page.addScriptToEvaluateOnNewDocument', { source: 'let randomSeed=7;Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};' });
  await page('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('neon-frontier.profile.v1', ${JSON.stringify(JSON.stringify(sample))});` });
  await page('Page.navigate', { url: base }); await sleep(2500);
  await closeDialog();
  await evaluate(OVERLAY);
  // Voice and music are prepared before recording so they do not slow the game down.
  await narrate(LINES);
  console.log('  voz lista');
  await writeFile(join(work, 'music.wav'), Buffer.from(await evaluate(MUSIC(34)), 'base64'));
  console.log('  música lista');
  await evaluate("promoCard('Pintamundo', '¡Pinta el mundo de tu color!')");
  await page('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  // Scene start times (seconds since epoch); the first frame is the video's zero.
  const marks = {}, mark = name => { marks[name] = Date.now() / 1000; };
  mark('intro');
  console.log('  grabando…');
  await sleep(3000);
  // A real match: loops that paint zones, then Rodillo.
  await evaluate("promoCard(''); document.getElementById('play').click()"); await sleep(500);
  await evaluate("promoCaption('Encierra zonas y píntalas')"); mark('match');
  const legs = [['KeyD', 'd', 1000], ['KeyS', 's', 1200], ['KeyA', 'a', 1200], ['KeyW', 'w', 1300], ['KeyD', 'd', 500], ['KeyW', 'w', 1000], ['KeyA', 'a', 1300], ['KeyS', 's', 1100], ['KeyD', 'd', 800]];
  for (const [i, [code, k, ms]] of legs.entries()) {
    if (i === 6) { await evaluate("promoCaption('Usa poderes increíbles')"); mark('powers'); await key('ShiftLeft', 'Shift'); await key('ShiftLeft', 'Shift', 'keyUp'); }
    await hold(code, k, ms);
    if (await evaluate('document.getElementById("dialog").open')) break;
  }
  // Back to the menu, then a legendary chest.
  await evaluate("promoCaption('')");
  await key('Escape', 'Escape'); await key('Escape', 'Escape', 'keyUp'); await sleep(200);
  await evaluate('document.getElementById("abandon")?.click()'); await sleep(900);
  await evaluate('document.getElementById("to-menu") ? document.getElementById("to-menu").click() : document.getElementById("dialog").close()'); await sleep(300);
  await closeDialog();
  await evaluate(`document.querySelector('.tab[data-tab="crates"]').click()`); await sleep(300);
  await evaluate("promoCaption('Abre cofres llenos de sorpresas')"); mark('chest');
  await evaluate('document.querySelector("[data-open=legendario]").click()'); await sleep(3600);
  await evaluate('document.getElementById("close-crate")?.click()'); await sleep(200);
  // The collection, scrolling through the characters.
  await evaluate(`document.querySelector('.tab[data-tab="collection"]').click()`); await sleep(300);
  await evaluate("promoCaption('37 personajes con poderes')"); mark('collection');
  await evaluate(`(async () => { const s = document.querySelector('.screens'); for (let i = 0; i < 70; i++) { s.scrollTop += 22; await new Promise(r => setTimeout(r, 45)); } })()`);
  await sleep(500);
  // A friends' room on the local server, waiting for friends.
  await evaluate("promoCaption('')");
  await evaluate(`document.querySelector('.tab[data-tab="crates"]').click()`); await evaluate('document.getElementById("play").click()'); await sleep(200);
  await evaluate('document.getElementById("online").click()'); await sleep(200);
  await evaluate('document.getElementById("online-create").click()');
  for (let i = 0; i < 40 && !await evaluate('Boolean(document.querySelector(".room-code"))'); i++) await sleep(100);
  await evaluate("promoCaption('Juega en línea con tus amigos')"); mark('friends'); await sleep(3000);
  await evaluate('document.getElementById("lobby-leave")?.click()'); await sleep(200);
  // Closing card.
  await evaluate("promoCaption(''); promoCard('¡Juega gratis!', 'Pinta, atrapa y abre cofres', 'Pintamundo')"); mark('outro'); await sleep(3500);
  await page('Page.stopScreencast');
  const end = Date.now() / 1000, zero = frames[0].time;
  console.log('  ' + frames.length + ' fotogramas, ' + (end - zero).toFixed(1) + ' s');
  // Frames arrive only when the screen changes: each one lasts until the next.
  const list = [];
  for (const [i, frame] of frames.entries()) {
    const name = join(work, `f${String(i).padStart(5, '0')}.jpg`);
    await writeFile(name, Buffer.from(frame.data, 'base64'));
    const next = frames[i + 1]?.time ?? end;
    list.push(`file '${name.replace(/\\/g, '/')}'`, `duration ${Math.max(.001, next - frame.time).toFixed(4)}`);
  }
  list.push(list.at(-2));
  await writeFile(join(work, 'frames.txt'), list.join('\n'));
  const silent = join(work, 'video.mp4');
  await run(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', join(work, 'frames.txt'), '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', silent]);
  // Audio: each narration line starts 0.3 s after its scene; the music fades in and out and
  // ducks under the voice with a sidechain compressor. The game plays its song very softly
  // (about -41 dB), so it is raised 17 dB to sit just below the voice.
  const duration = end - zero, names = Object.keys(LINES), inputs = ['-i', silent, '-i', join(work, 'music.wav')];
  for (const name of names) inputs.push('-i', join(work, name + '.wav'));
  const voices = names.map((name, i) => { const ms = Math.max(0, Math.round((marks[name] - zero + .3) * 1000)); return `[${i + 2}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms},volume=1.6[v${i}]`; });
  const filter = [
    ...voices,
    `${names.map((_, i) => `[v${i}]`).join('')}amix=inputs=${names.length}:normalize=0,apad[voice]`,
    '[voice]asplit[vmix][vkey]',
    `[1:a]atrim=0:${duration.toFixed(2)},afade=t=in:d=1,afade=t=out:st=${(duration - 2).toFixed(2)}:d=2,volume=17dB[music]`,
    '[music][vkey]sidechaincompress=threshold=0.03:ratio=6:attack=30:release=400[ducked]',
    '[ducked][vmix]amix=inputs=2:normalize=0,alimiter=limit=0.95[audio]'
  ].join(';');
  await run(ffmpeg, ['-y', ...inputs, '-filter_complex', filter, '-map', '0:v', '-map', '[audio]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', duration.toFixed(2), '-movflags', '+faststart', fsPath(new URL(target, root))]);
  console.log('Video written to ' + target);
  await send('Browser.close');
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
  await sleep(300);
  // KEEP_VIDEO_FILES=1 keeps the frames, voice and music files for checking.
  if (process.env.KEEP_VIDEO_FILES) console.log('Archivos intermedios en ' + work);
  else await rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

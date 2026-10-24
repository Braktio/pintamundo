// Optional Chromium smoke check. No browser dependencies are downloaded.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const executable = process.argv[2];
if (!executable) throw new Error('Usage: node scripts/browser-check.mjs <chrome executable>');
const root = new URL('..', import.meta.url), profile = await mkdtemp(join(tmpdir(), 'pintamundo-'));
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
try {
  const base = await outputUntil(server.stdout, /http:\/\/\S+/);
  browser = spawn(executable, ['--headless=new', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--remote-allow-origins=*', '--window-size=1440,1100', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const endpoint = await outputUntil(browser.stderr, /ws:\/\/\S+/);
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map(), errors = [];
  socket.onmessage = message => {
    const event = JSON.parse(message.data);
    if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text);
    if (pending.has(event.id)) { const p = pending.get(event.id); clearTimeout(p.timer); pending.delete(event.id); if (event.error) p.reject(new Error(event.error.message)); else p.resolve(event.result); }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => {
    const response = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  };
  await page('Runtime.enable'); await page('Page.enable');
  await page('Page.addScriptToEvaluateOnNewDocument', { source: 'let randomSeed=482;Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};' });
  // Start as Gato Rayo (rare, Turbo) so the power button can be exercised.
  await page('Page.addScriptToEvaluateOnNewDocument', { source: "if(!localStorage.getItem('neon-frontier.profile.v1'))localStorage.setItem('neon-frontier.profile.v1',JSON.stringify({version:1,name:'Prueba',bits:0,xp:540,wins:0,totalKills:0,best:0,nemesis:'',skin:'tron',trail:'cyan',skins:[],trails:['cyan'],easy:false,chests:{comun:0,raro:1,epico:0,legendario:0},freeChestAt:0}));" });
  await page('Page.navigate', { url: base });
  for (let i = 0; i < 30; i++) { if (await evaluate('document.querySelectorAll(".hangar-card").length') > 30) break; await sleep(150); }
  assert.deepEqual(errors, []);
  assert.ok(await evaluate('document.querySelectorAll(".hangar-card").length') > 30, 'collection lists every character');
  await evaluate('document.getElementById("help-side").click()');
  await page('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Escape', key: 'Escape' });
  await page('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Escape', key: 'Escape' });
  const screenshot = async name => { const shot = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(new URL(name, root), Buffer.from(shot.data, 'base64')); };
  assert.equal(await evaluate('document.getElementById("dialog").open'), false, 'Escape closes help');
  // Daily missions and streak: the badge shows a dot, today's streak reward can be claimed once.
  assert.equal(await evaluate('document.getElementById("missions-dot").hidden'), false, 'something is waiting to be claimed');
  await evaluate('document.getElementById("missions-badge").click()');
  assert.equal(await evaluate('document.querySelectorAll(".mission-row").length'), 3, 'three missions today');
  await evaluate('document.getElementById("streak-claim").click()'); await sleep(200);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("neon-frontier.profile.v1")).streak.count'), 1, 'day 1 of the streak');
  assert.equal(await evaluate('document.getElementById("streak-claim").disabled'), true, 'once a day');
  await screenshot('preview-missions.png');
  await evaluate('document.getElementById("missions-close").click()');
  // Waits up to `ms` for a page expression to become true (the cloud check loads from the network).
  const until = async (expression, ms = 6000) => { for (let t = 0; t < ms && !await evaluate(expression); t += 100) await sleep(100); return evaluate(expression); };
  assert.equal(await until('[...document.querySelectorAll("img.ui-icon")].every(i => i.complete && i.naturalWidth > 0)'), true, 'every interface icon loads');
  await screenshot('preview-menu.png');
  assert.equal(await evaluate('Boolean(document.querySelector("#rank-tab-icon svg"))'), true, 'the Rangos tab shows the rank emblem');
  for (const tab of ['collection', 'crates', 'progress', 'ranks']) {
    await evaluate(`document.querySelector('.tab[data-tab="${tab}"]').click()`); await sleep(350);
    await screenshot(tab === 'ranks' ? 'preview-rank-suggest.png' : `preview-${tab}.png`);
  }
  // Opening Rangos without an account suggests connecting it, once.
  assert.equal(await evaluate('Boolean(document.getElementById("rank-suggest-login"))'), true, 'players without an account are invited to connect it');
  await evaluate('document.getElementById("rank-suggest-later").click()');
  assert.match(await evaluate('document.getElementById("rank-list").textContent'), /Conéctala y juega en línea para rankear/);
  await screenshot('preview-ranks.png');
  // Rare and better characters show their level, repeats and extra reach.
  await evaluate(`document.querySelector('.tab[data-tab="collection"]').click()`); await sleep(300);
  assert.equal(await evaluate('Boolean(document.querySelector("[data-skin=tron]").closest("article").querySelector(".char-level"))'), true, 'an owned rare character shows its level');
  await evaluate('document.querySelector("[data-skin=tron]").closest("article").scrollIntoView({ block: "center" })'); await sleep(200);
  await screenshot('preview-collection-level.png');
  await evaluate(`document.querySelector('.tab[data-tab="ranks"]').click()`); await sleep(300);
  await evaluate('document.querySelector("[data-ranks=ladder]").click()'); await sleep(200);
  assert.equal(await evaluate('document.querySelectorAll(".ladder-tier").length'), 30, 'the ladder lists 10 ranks with 3 divisions');
  await screenshot('preview-ranks-ladder.png');
  await evaluate(`document.querySelector('.tab[data-tab="crates"]').click()`);
  await evaluate('document.getElementById("play").click()');
  assert.equal(await evaluate(`document.querySelector('.screen[data-screen="home"]').hidden`), false, 'center button returns home');
  await evaluate('document.getElementById("play").click()');
  assert.equal(await evaluate('document.getElementById("hud").hidden'), false);
  const key = (code, key, type = 'keyDown') => page('Input.dispatchKeyEvent', { type, code, key });
  await key('Space', ' '); await key('Space', ' ', 'keyUp');
  await sleep(350);
  assert.match(await evaluate('document.getElementById("slot-state-0").textContent'), /ACTIVO/);
  // Start over to trace a predictable loop at normal speed.
  await key('Escape', 'Escape'); await key('Escape', 'Escape', 'keyUp');
  assert.equal(await evaluate('document.getElementById("dialog").open'), true);
  await evaluate('document.getElementById("abandon").click()'); await sleep(850);
  await evaluate('document.getElementById("retry").click()');
  // Close a compact loop before the bots' initial expansion can reach the pilot.
  for (const [code, letter, duration] of [['KeyD', 'd', 950], ['KeyS', 's', 950], ['KeyA', 'a', 950], ['KeyW', 'w', 800]]) {
    await key(code, letter); await sleep(duration); await key(code, letter, 'keyUp');
  }
  await screenshot('preview-arena.png');
  const result = await evaluate('({percent:document.getElementById("hud-territory").textContent,bits:document.getElementById("hud-bits").textContent,dialog:document.getElementById("dialog-content").textContent,profile:JSON.parse(localStorage.getItem("neon-frontier.profile.v1"))})');
  assert.ok(result.profile.bits > 0, 'closing the route awards persistent Bits: ' + JSON.stringify(result));
  assert.ok(result.profile.xp > 0);
  // The loop crosses level 3 (546 XP): its chest is not announced during the match...
  assert.equal(result.profile.chests.raro, 2, 'the level-up chest is saved right away');
  assert.doesNotMatch(await evaluate('document.getElementById("toasts").textContent'), /[Cc]ofre/, 'no chest messages during the match');
  // ...and opens by itself after the results, followed by the match buttons.
  await key('Escape', 'Escape'); await key('Escape', 'Escape', 'keyUp');
  await evaluate('document.getElementById("abandon").click()'); await sleep(900);
  assert.equal(await until('Boolean(document.getElementById("open-earned"))'), true, 'results list the chests won');
  assert.equal(await until('Boolean(document.querySelector(".rarity-banner"))', 8000), true, 'the chest opened by itself');
  await screenshot('preview-match-chest.png');
  assert.equal(await evaluate('Boolean(document.getElementById("retry"))'), true, 'the last chest shows the match buttons');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("neon-frontier.profile.v1")).chests.raro'), 1, 'the opened chest is spent');
  // Load a profile fixture to verify crate spending, reward reveal and persistence.
  const fixture = await evaluate('(async()=>{const m=await import("./engine.js");const p=m.freshProfile();p.bits=1200;p.xp=1000;p.skin="tron";return p;})()');
  await page('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('neon-frontier.profile.v1', ${JSON.stringify(JSON.stringify(fixture))});` });
  await page('Page.reload'); await sleep(500);
  // A profile without a nickname is asked to create one before playing.
  assert.equal(await until('Boolean(document.getElementById("name-input"))'), true, 'new players are asked for a name');
  await screenshot('preview-profile.png');
  await evaluate('document.getElementById("name-input").value="  Ana <b>"; document.getElementById("name-save").click()');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("neon-frontier.profile.v1")).name'), 'Ana b');
  assert.equal(await evaluate('document.getElementById("dialog").open'), false);
  await evaluate('document.querySelector("[data-buy=comun]").click()'); await sleep(1700);
  assert.equal(await evaluate('Boolean(document.getElementById("close-crate"))'), true);
  const afterChest = await evaluate('JSON.parse(localStorage.getItem("neon-frontier.profile.v1"))');
  assert.ok(afterChest.bits >= 900 && afterChest.bits <= 900 + 640, 'a common chest costs 300 stars: ' + afterChest.bits);
  assert.equal(await evaluate('Boolean(document.querySelector(".rarity-banner"))'), true, 'the reveal shows the rarity');
  await screenshot('preview-chest.png');
  assert.deepEqual(errors, [], 'no uncaught browser exceptions');
  await evaluate('document.getElementById("close-crate").click()');
  await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await sleep(200);
  await screenshot('preview-mobile.png');
  // Held upright, the browser game turns itself to landscape instead of asking to rotate.
  assert.equal(await evaluate('document.body.classList.contains("turned")'), true, 'portrait turns the game');
  assert.equal(await evaluate('Boolean(document.getElementById("rotate-prompt"))'), false, 'there is no rotate prompt');
  const turnedBox = await evaluate('(() => { const r = document.querySelector(".tabbar").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()');
  assert.ok(turnedBox.h > turnedBox.w, 'the tab bar runs down the side of the upright phone: ' + JSON.stringify(turnedBox));
  assert.ok(await evaluate('document.documentElement.scrollWidth <= 391'), 'mobile menu fits: ' + await evaluate('JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll("#menu *")].filter(e=>e.getBoundingClientRect().right>391).slice(0,8).map(e=>e.className)})'));
  await page('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  assert.equal(await evaluate('document.body.classList.contains("turned")'), false);
  await screenshot('preview-mobile-landscape-menu.png');
  await evaluate('document.getElementById("play").click()');
  assert.equal(await evaluate('document.getElementById("pilot-name").textContent'), 'Ana b');
  assert.match(await evaluate('document.getElementById("hud-territory").textContent'), /^\d+%$/);
  assert.match(await evaluate('document.getElementById("leaders").textContent'), /\d+%/);
  // The whole screen is an invisible joystick: any spot of the arena starts steering.
  assert.equal(await evaluate('Boolean(document.getElementById("joystick"))'), false, 'no on-screen joystick');
  assert.equal(await evaluate('Boolean(document.getElementById("danger"))'), false, 'no go-home warning');
  const stick = { x: 470, y: 160 };
  const touch = (x, y, id = 1) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 });
  await page('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(stick.x, stick.y)] });
  await page('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(stick.x+35, stick.y)] });
  await sleep(250);
  assert.equal(await evaluate('document.body.classList.contains("steering")'), true, 'a touch anywhere steers');
  const skill = await evaluate('(() => { const r=document.getElementById("slot-0").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await page('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(stick.x+35, stick.y), touch(skill.x, skill.y, 2)] });
  await page('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [touch(stick.x+35, stick.y)] });
  await sleep(180);
  assert.match(await evaluate('document.getElementById("slot-state-0").textContent'), /ACTIVO/, 'second thumb triggers dash while steering');
  await page('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await evaluate('document.body.classList.contains("steering")'), false, 'lifting the finger stops steering');
  await screenshot('preview-mobile-arena.png');
  const mobileBounds = await evaluate('(() => {const ids=["slot-0","slot-1","pause"].filter(id=>!document.getElementById(id).hidden); return ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};});})()');
  assert.ok(mobileBounds.every(r => r.x >= 0 && r.y >= 0 && r.right <= 844 && r.bottom <= 390 && r.width >= 44 && r.height >= 44), 'touch controls stay inside safe landscape bounds: ' + JSON.stringify(mobileBounds));
  assert.ok(mobileBounds.some(r => r.id === 'slot-0'), 'the rare character shows its power button');
  const map = await evaluate('(() => { const r = document.querySelector(".map-panel").getBoundingClientRect(); return { w: r.width, right: r.right, bottom: r.bottom }; })()');
  assert.ok(map.w > 40 && map.right <= 844 && map.bottom <= 390, 'the minimap shows on a phone: ' + JSON.stringify(map));
  await evaluate('document.getElementById("pause").click()');
  await evaluate('document.getElementById("resume").click()');
  await page('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  await screenshot('preview-mobile-landscape.png');
  assert.deepEqual(errors, [], 'desktop and mobile have no runtime errors');
  console.log('Browser OK: HUD, whole-screen touch steering + power with a second finger, minimap on phones, 44px touch targets, capture/rewards/crates, ranks and always-landscape layout.');
  await send('Browser.close');
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (server.exitCode === null) server.kill();
  await sleep(300);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

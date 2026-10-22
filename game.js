import { Arena, WIDTH, HEIGHT, SIZE, POWERS, CHARACTERS, RARITIES, RARITY_ORDER, CHESTS, FREE_CHEST_HOURS, TRAILS, characterFor, ownsCharacter, openChest, freshProfile, parseProfile, cleanName, levelFor, levelXP } from './engine.js';
import { Renderer, shade } from './renderer.js';
import { Connection, Mirror, defaultServer, rememberServer, normalizeServer } from './online.js';
import * as cloud from './cloud.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'neon-frontier.profile.v1';
let profile = freshProfile();
let storageError = false;
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) profile = parseProfile(raw); }
catch { storageError = true; }
// Everything except the timestamp: used to notice real changes before stamping a save.
const contentOf = ({ updatedAt, ...rest }) => JSON.stringify(rest);
let savedContent = contentOf(profile);
// Signed-in account ({ uid, name, provider }) and the state of the pending cloud upload.
let account = null, cloudDirty = false, cloudTimer = 0, cloudBusy = false;
const renderer = new Renderer($('arena'));
let arena = new Arena(profile), state = 'menu', hangarTab = 'skins';
// Online session: { connection, private, lobby }. `mirror` is set only while an online match runs.
let online = null, mirror = null;
let lastFrame = performance.now(), accumulator = 0, hudClock = 0, generation = 0;
let aim = null, keys = new Set(), sound = false, audio = null;
let announcedUntil = 0;
const touchSteer = { id: null, x: 0, y: 0 };
const number = value => Math.floor(value).toLocaleString('es-CO');
function resetJoystick() {
  touchSteer.id = null; touchSteer.x = touchSteer.y = 0;
  $('joystick-knob').style.transform = 'translate(-50%, -50%)';
  $('joystick').classList.remove('engaged');
}
function mobileUI() {
  if (innerHeight > innerWidth && state === 'playing') pause();
}
mobileUI();
addEventListener('resize', mobileUI);
addEventListener('orientationchange', () => { resetJoystick(); pause(); });
async function enterFullscreen() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    if (document.fullscreenElement && screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch { /* The landscape prompt covers browsers that do not support orientation lock. */ }
}
// Inside the Android app the game is already full screen and locked to landscape.
if (globalThis.Capacitor?.isNativePlatform?.()) $('fullscreen').hidden = true;
$('fullscreen').onclick = async () => {
  if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch {} }
  else await enterFullscreen();
};

function toast(message) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = message;
  $('toasts').append(el); setTimeout(() => el.remove(), 4500);
}
// Each real change is stamped, so the newest copy wins when the phone and the cloud
// disagree. `flush` also sends it to the cloud right away instead of within a minute.
function save(flush = false) {
  const content = contentOf(profile);
  if (content !== savedContent) { profile.updatedAt = Date.now(); savedContent = content; cloudDirty = true; }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); $('save-label').textContent = account ? 'Tu progreso se guarda en tu cuenta' : 'Tu progreso está guardado en este teléfono'; }
  catch { $('save-label').textContent = 'No se puede guardar en este dispositivo'; }
  scheduleCloud(flush);
}
// Cartoon sound effects: each note is [frequency, glide target, start, length, wave].
const SOUNDS = {
  capture: [[523, 523, 0, .12, 'square'], [659, 659, .1, .12, 'square'], [784, 784, .2, .12, 'square'], [1047, 1047, .3, .25, 'square']],
  kill: [[220, 880, 0, .25, 'triangle'], [880, 440, .22, .2, 'triangle']],
  death: [[392, 370, 0, .3, 'sawtooth'], [349, 330, .3, .3, 'sawtooth'], [311, 200, .6, .6, 'sawtooth']],
  ability: [[300, 1200, 0, .3, 'sine']],
  orb: [[880, 1760, 0, .08, 'sine']],
  wall: [[150, 450, 0, .18, 'triangle']],
  level: [[523, 523, 0, .1, 'square'], [659, 659, .1, .1, 'square'], [784, 784, .2, .1, 'square'], [1047, 1047, .3, .1, 'square'], [1319, 1319, .4, .35, 'square']]
};
function tone(kind = 'capture') {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    void audio.resume();
    for (const [from, to, delay, length, wave] of SOUNDS[kind] || SOUNDS.capture) {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime + delay;
      oscillator.type = wave; oscillator.frequency.setValueAtTime(from, start); oscillator.frequency.exponentialRampToValueAtTime(to, start + length);
      gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(wave === 'sine' ? .08 : .035, start + .01); gain.gain.exponentialRampToValueAtTime(.0001, start + length);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + length + .02);
    }
  } catch { sound = false; }
}
$('sound').onclick = () => {
  sound = !sound; $('sound').setAttribute('aria-pressed', String(sound));
  $('sound').setAttribute('aria-label', sound ? 'Desactivar sonido' : 'Activar sonido');
  $('sound').textContent = sound ? '🔊' : '🔇'; tone('orb');
};
function renderEasy() {
  $('easy').setAttribute('aria-pressed', String(profile.easy === true));
  $('easy').title = profile.easy ? 'Modo fácil activado' : 'Modo fácil';
  $('easy-badge').hidden = !profile.easy;
}
$('easy').onclick = () => {
  profile.easy = !profile.easy; renderEasy(); save();
  toast(profile.easy ? '🐢 Modo fácil: los robots van más despacio.' : '🐇 Modo normal: ¡los robots vuelven a correr!');
};
function dialog(html) {
  keys.clear(); resetJoystick(); $('dialog-content').innerHTML = html;
  if (!$('dialog').open) $('dialog').showModal();
}
function announce(text) {
  $('announcement').textContent = text; $('announcement').hidden = false;
  announcedUntil = performance.now() + 2200;
}
const playerColor = () => TRAILS.find(t => t.id === profile.trail)?.color || TRAILS[0].color;
const skinArt = (skin, size = 112) => `<img src="${renderer.portraitURL({ skin, color: playerColor() }, size)}" alt="">`;
const swatchArt = color => `<span class="swatch" style="--swatch:${color}"></span>`;
const rarityChip = rarity => `<span class="rarity-chip rarity-${rarity}">${RARITIES[rarity].name}</span>`;
const powerIcons = powers => powers.length ? powers.map(p => `<span class="power-chip" title="${POWERS[p].name}">${POWERS[p].icon} ${POWERS[p].name}</span>`).join('') : '<span class="power-chip none">Sin poderes</span>';
const totalChests = () => Object.values(profile.chests).reduce((a, b) => a + b, 0);
const freeChestIn = () => Math.max(0, profile.freeChestAt - Date.now());
// Chest artwork: the same chest, tinted per chest type.
const CHEST_COLORS = { comun: ['#7fb8ff', '#4f86e8'], raro: ['#7be05a', '#3aa316'], epico: ['#d08cff', '#9b4fe0'], legendario: ['#ffe066', '#f2a400'] };
function chestSVG(type, size = 100) {
  const [lid, body] = CHEST_COLORS[type];
  return `<svg viewBox="0 0 100 90" width="${size}" height="${size * .9}" aria-hidden="true"><path d="M10 38 Q10 12 50 12 Q90 12 90 38 Z" fill="${lid}" stroke="#1c2a6e" stroke-width="5" stroke-linejoin="round"/><rect x="10" y="38" width="80" height="44" rx="8" fill="${body}" stroke="#1c2a6e" stroke-width="5"/><rect x="44" y="12" width="12" height="70" fill="#ffd23a" stroke="#1c2a6e" stroke-width="4"/><circle cx="50" cy="44" r="12" fill="#fff" stroke="#1c2a6e" stroke-width="4"/><circle cx="46" cy="44" r="3.2" fill="#1c2a6e"/><circle cx="54" cy="44" r="3.2" fill="#1c2a6e"/><path d="M22 20 q6 -4 12 -2" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/></svg>`;
}
const COLLECTION = {
  skins: { icon: '🐥', title: 'Personajes', note: 'Los comunes no tienen poderes. ¡Cuanto más raro, más poderes y más rápido se recargan!' },
  trails: { icon: '🎨', title: 'Colores', note: 'Tu color pinta tu camino y tu zona. ¡Busca más en los cofres!' },
  powers: { icon: '⚡', title: 'Poderes', note: 'Cada personaje trae sus propios poderes. Elige uno con poderes en la pestaña Personajes.' }
};
function renderHangar() {
  const content = [];
  let owned = 0, total = 0;
  if (hangarTab === 'skins') for (const rarity of RARITY_ORDER) {
    const group = CHARACTERS.filter(c => c.rarity === rarity), have = group.filter(c => ownsCharacter(profile, c.id)).length;
    total += group.length; owned += have;
    content.push(`<h3 class="rarity-heading rarity-${rarity}">${RARITIES[rarity].name} <span>${have}/${group.length}</span></h3>`);
    for (const c of group) {
      const unlocked = ownsCharacter(profile, c.id);
      const lock = c.level > 1 ? '🔒 Nivel ' + c.level + ' o cofre' : '🎁 En cofres';
      content.push(`<article class="hangar-card card rarity-${rarity} ${unlocked ? '' : 'locked'}"><span class="card-badge">${RARITIES[rarity].name}</span><div class="card-art">${skinArt(c.id)}</div><h3>${c.name}</h3><div class="power-list">${powerIcons(c.powers)}</div><div class="card-actions"><button data-skin="${c.id}" ${unlocked ? '' : 'disabled'} class="${profile.skin === c.id ? 'equipped' : ''}">${profile.skin === c.id ? '✓ Elegido' : unlocked ? 'Elegir' : lock}</button></div></article>`);
    }
  }
  if (hangarTab === 'trails') for (const trail of TRAILS) {
    const unlocked = profile.trails.includes(trail.id); total++; owned += unlocked;
    content.push(`<article class="hangar-card card ${unlocked ? '' : 'locked'}" style="--card-bg:linear-gradient(${shade(trail.color, .55)},${trail.color})"><span class="card-badge">${trail.rarity ? RARITIES[trail.rarity].name : '⭐'}</span><div class="card-art">${swatchArt(trail.color)}</div><h3>${trail.name}</h3><p>${trail.crate ? 'Un color especial de los cofres.' : 'Tu color de siempre.'}</p><div class="card-actions"><button data-trail="${trail.id}" ${unlocked ? '' : 'disabled'} class="${profile.trail === trail.id ? 'equipped' : ''}">${profile.trail === trail.id ? '✓ Elegido' : unlocked ? 'Elegir' : '🎁 En cofres'}</button></div></article>`);
  }
  if (hangarTab === 'powers') for (const [id, power] of Object.entries(POWERS)) {
    const holders = CHARACTERS.filter(c => c.powers.includes(id)), have = holders.some(c => ownsCharacter(profile, c.id));
    const rarities = [...new Set(holders.map(c => c.rarity))];
    total++; owned += have;
    content.push(`<article class="hangar-card card rarity-skill ${have ? '' : 'dim'}"><span class="card-badge">${power.duration ? power.duration + ' s' : '¡Ya!'}</span><div class="card-art"><span class="emoji">${power.icon}</span></div><h3>${power.name}</h3><p>${power.description}</p><div class="power-meta">⏱️ Recarga ${power.cooldown} s<br>${rarities.map(rarityChip).join(' ')}</div><p class="power-owner">${have ? '✓ Lo tiene un personaje tuyo' : '🎁 Búscalo en los cofres'}</p></article>`);
  }
  $('hangar-items').innerHTML = content.join('');
  const info = COLLECTION[hangarTab];
  $('collection-icon').textContent = info.icon; $('collection-title').textContent = info.title;
  $('collection-count').textContent = `${owned}/${total}`; $('collection-note').textContent = info.note;
}
function renderChests() {
  const types = Object.keys(CHESTS);
  $('chest-inventory').innerHTML = types.map(type => `<article class="card chest-slot chest-${type}"><span class="card-badge">x${profile.chests[type]}</span><div class="card-art ${profile.chests[type] ? 'ready' : ''}">${chestSVG(type)}</div><button class="card-foot" data-open="${type}" ${profile.chests[type] ? '' : 'disabled'}>${profile.chests[type] ? '¡ABRIR!' : CHESTS[type].name}</button></article>`).join('');
  $('chest-shop').innerHTML = types.map(type => `<article class="card chest-slot chest-${type}"><div class="card-art">${chestSVG(type)}</div><button class="card-foot" data-buy="${type}" ${profile.bits >= CHESTS[type].price ? '' : 'disabled'}>${number(CHESTS[type].price)} ⭐</button></article>`).join('');
  $('chest-odds').innerHTML = types.map(type => `<div class="odds-row"><span class="odds-chest">${chestSVG(type, 40)}<b>${CHESTS[type].name}</b></span><span class="odds-values">${Object.entries(CHESTS[type].odds).map(([rarity, odds]) => `<span class="rarity-chip rarity-${rarity}">${RARITIES[rarity].name} ${odds}%</span>`).join('')}</span></div>`).join('');
  renderFreeChest();
}
function renderFreeChest() {
  const wait = freeChestIn(), hours = Math.floor(wait / 3600000), minutes = Math.ceil(wait % 3600000 / 60000);
  $('free-chest').disabled = wait > 0;
  $('free-chest-label').textContent = wait ? `⏱️ ${hours ? hours + ' h ' : ''}${minutes} min` : '¡RECLAMAR!';
  $('free-crate-badge').hidden = !(totalChests() || !wait);
}
function renderMenu() {
  const level = levelFor(profile.xp), start = levelXP(level), end = levelXP(level + 1);
  const xpText = `${number(profile.xp - start)} / ${number(end - start)} XP`, xpWidth = Math.min(100, (profile.xp - start) / (end - start) * 100) + '%';
  $('menu-level').textContent = level;
  $('menu-bits').textContent = number(profile.bits);
  $('menu-crates').textContent = totalChests();
  $('menu-avatar').src = renderer.portraitURL({ skin: profile.skin, color: playerColor() });
  $('home-level').textContent = level; $('home-xp-label').textContent = xpText; $('home-xp').style.width = xpWidth;
  $('road-level').textContent = 'NIVEL ' + level; $('road-xp').textContent = xpText; $('xp-fill').style.width = xpWidth;
  document.querySelectorAll('[data-road]').forEach(el => {
    const unlocked = level >= Number(el.dataset.road), reward = CHARACTERS.find(c => c.level === Number(el.dataset.road));
    el.classList.toggle('unlocked', unlocked);
    el.querySelector('img').src = renderer.portraitURL({ skin: reward.id, color: playerColor() }, 64);
    el.querySelector('.mission-state').textContent = unlocked ? '✓' : '🔒';
  });
  const next = CHARACTERS.find(c => c.level > level);
  $('next-unlock-name').textContent = next ? `Próximo: ${next.name}` : '¡Tienes a todos los del camino!';
  renderer.portrait($('next-unlock'), { skin: (next || characterFor(profile.skin)).id, color: playerColor() });
  $('stat-wins').textContent = number(profile.wins); $('stat-kills').textContent = number(profile.totalKills);
  $('stat-best').textContent = Math.round(profile.best) + '%';
  const current = characterFor(profile.skin);
  $('home-character').innerHTML = `${rarityChip(current.rarity)} <b>${current.name}</b> <span class="home-powers">${powerIcons(current.powers)}</span>`;
  renderEasy(); renderChests(); renderHangar(); renderAccount();
}
let screen = 'home';
function showScreen(name) {
  screen = name;
  document.querySelectorAll('.screen[data-screen]').forEach(el => { el.hidden = el.dataset.screen !== name; });
  document.querySelectorAll('.tab[data-tab]').forEach(el => el.classList.toggle('current', el.dataset.tab === name));
  $('menu').dataset.screen = name;
  $('play').classList.toggle('home', name !== 'home');
  $('play-icon').textContent = name === 'home' ? '▶' : '🏠';
  $('play').setAttribute('aria-label', name === 'home' ? '¡A jugar!' : 'Volver al inicio');
  document.querySelector('.screens').scrollTop = 0;
  renderMenu();
}
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => showScreen(button.dataset.tab));
$('hangar-items').onclick = event => {
  const button = event.target.closest('button'); if (!button || button.disabled) return;
  if (button.dataset.skin && ownsCharacter(profile, button.dataset.skin)) profile.skin = button.dataset.skin;
  if (button.dataset.trail) { profile.trail = button.dataset.trail; arena.actors[0].color = TRAILS.find(t => t.id === profile.trail).color; }
  arena.actors[0].skin = profile.skin;
  save(); renderMenu();
};
document.querySelectorAll('[data-hangar]').forEach(button => button.onclick = () => {
  hangarTab = button.dataset.hangar;
  document.querySelectorAll('[data-hangar]').forEach(b => b.classList.toggle('selected', b === button));
  renderHangar();
});
// Chest opening: shake, then reveal the prize with its rarity color and powers.
function revealChest(type) {
  const result = openChest(profile, type), { prize, rarity, duplicate, refund } = result;
  save(true); renderMenu();
  dialog(`<div class="crate-reward"><p class="eyebrow">${CHESTS[type].name}</p><div class="crate-opening" id="crate-spinner">${chestSVG(type, 150)}</div><p>¿Qué habrá dentro…?</p></div>`);
  setTimeout(() => {
    if (!$('crate-spinner')) return;
    tone(rarity === 'legendario' || rarity === 'mitico' ? 'level' : 'capture');
    const sparkles = Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2; return `<i style="--dx:${Math.round(Math.cos(a) * 160)}px;--dy:${Math.round(Math.sin(a) * 120)}px">${i % 2 ? '⭐' : '✨'}</i>`; }).join('');
    const isCharacter = prize.type === 'skins', more = profile.chests[type];
    const detail = duplicate ? `¡Ya lo tenías! Te damos ${refund} ⭐ a cambio.` : isCharacter ? (prize.powers.length ? '¡Nuevo personaje con poderes!' : '¡Nuevo amigo! Los comunes no tienen poderes, pero son muy simpáticos.') : '¡Ya puedes pintar con este color!';
    $('dialog-content').innerHTML = `<div class="crate-reward reveal-${rarity}"><div class="sparkles" aria-hidden="true">${sparkles}</div><p class="rarity-banner rarity-${rarity}">¡${RARITIES[rarity].name.toUpperCase()}!</p><div class="crate-opening revealed">${isCharacter ? skinArt(prize.id, 160) : swatchArt(prize.color)}</div><h2>${prize.name}</h2>${isCharacter ? `<div class="power-list">${powerIcons(prize.powers)}</div>` : ''}<p>${detail}</p><div class="dialog-buttons">${isCharacter && !duplicate ? '<button id="equip-prize" class="dialog-button">✓ ¡Usar ahora!</button>' : ''}${more ? `<button id="open-again" class="dialog-button">🎁 Abrir otro (${more})</button>` : ''}<button id="close-crate" class="dialog-button secondary">¡GENIAL! 🎉</button></div></div>`;
    $('close-crate').onclick = () => { $('dialog').close(); renderMenu(); };
    if ($('equip-prize')) $('equip-prize').onclick = () => { profile.skin = prize.id; save(); $('dialog').close(); renderMenu(); toast(`¡Ahora juegas con ${prize.name}!`); };
    if ($('open-again')) $('open-again').onclick = () => { profile.chests[type]--; revealChest(type); };
  }, 1500);
}
$('chest-inventory').onclick = event => {
  const button = event.target.closest('[data-open]'); if (!button || button.disabled) return;
  const type = button.dataset.open; if (!profile.chests[type]) return;
  profile.chests[type]--; revealChest(type);
};
$('chest-shop').onclick = event => {
  const button = event.target.closest('[data-buy]'); if (!button || button.disabled) return;
  const type = button.dataset.buy; if (profile.bits < CHESTS[type].price) return;
  profile.bits -= CHESTS[type].price; revealChest(type);
};
$('free-chest').onclick = () => {
  if (freeChestIn() > 0) return;
  profile.freeChestAt = Date.now() + FREE_CHEST_HOURS * 3600000; revealChest('comun');
};
setInterval(() => { if (state === 'menu') renderFreeChest(); }, 30000);

function start() {
  disconnect();
  generation++; arena = new Arena(profile); mirror = null; state = 'playing'; accumulator = 0; aim = null; keys.clear(); resetJoystick();
  enterMatch(); announce('¡A PINTAR! 🎨'); renderHUD();
}
// Shared by solo and online matches: reset effects and build the HUD for the current arena.
function enterMatch() {
  renderer.camera = { x: arena.actors[0].x, y: arena.actors[0].y };
  renderer.particles = []; renderer.floats = []; renderer.rings = []; renderer.brokenTrails = [];
  document.body.classList.add('in-match');
  if (matchMedia('(pointer: coarse)').matches) void enterFullscreen();
  $('menu').hidden = true; $('hud').hidden = false;
  $('dialog').close(); $('arena').focus({ preventScroll: true });
  document.documentElement.style.setProperty('--player', arena.actors[0].color);
  $('pilot-avatar').src = renderer.portraitURL(arena.actors[0]);
  $('pilot-name').textContent = profile.name || 'Tú';
  $('leaders').innerHTML = arena.actors.map(actor => `<li data-actor="${actor.id}" class="${actor.id ? '' : 'me'}" style="--actor:${actor.color}"><img src="${renderer.portraitURL(actor)}" alt="${actor.name}"><i></i><b>0%</b></li>`).join('');
  $('timer-pill').hidden = !mirror;
  stopSpectating();
}
// ---------- Spectator mode (online only) ----------
// Real players come first, then robots; within each group, the biggest zone first.
function spectateTargets() {
  return arena.actors.filter(a => a.id !== 0 && a.alive).sort((a, b) => (b.human - a.human) || (b.count - a.count));
}
function spectate(id) {
  const target = arena.actors[id];
  if (!target?.alive) { const next = spectateTargets()[0]; if (!next) return; id = next.id; }
  arena.follow = id;
  document.body.classList.add('spectating');
  $('spectate').hidden = false;
  $('spectate-name').textContent = arena.actors[id].name;
}
function cycleSpectate(step) {
  const targets = spectateTargets(); if (!targets.length) return;
  const index = targets.findIndex(a => a.id === arena.follow);
  spectate(targets[(index + step + targets.length) % targets.length].id);
}
function stopSpectating() {
  arena.follow = undefined;
  document.body.classList.remove('spectating');
  $('spectate').hidden = true;
}
$('spectate-prev').onclick = () => cycleSpectate(-1);
$('spectate-next').onclick = () => cycleSpectate(1);
$('play').onclick = () => { if (screen === 'home') start(); else showScreen('home'); };
function menu() {
  disconnect(); stopSpectating();
  generation++; state = 'menu'; keys.clear(); aim = null; resetJoystick();
  $('dialog').close(); $('menu').hidden = false; $('hud').hidden = true;
  document.body.classList.remove('in-match');
  arena = new Arena(profile); renderMenu(); save(true);
}
function end(won, reason, ranking = null) {
  if (state !== 'playing' && state !== 'paused') return;
  state = 'ending'; keys.clear();
  resetJoystick(); renderHUD();
  const player = arena.actors[0], percent = arena.best / SIZE * 100;
  profile.best = Math.max(profile.best, percent);
  // Match reward: 1 star → common chest, 2 stars → rare chest, a win → epic chest.
  const stars = won ? 3 : percent >= 20 ? 2 : percent >= 6 || player.kills ? 1 : 0;
  const prizeChest = [null, 'comun', 'raro', 'epico'][stars];
  if (won) profile.wins++;
  if (prizeChest) profile.chests[prizeChest]++;
  save(true);
  const currentGeneration = generation;
  setTimeout(() => {
    if (currentGeneration !== generation) return;
    state = 'results';
    const title = won ? '¡GANASTE! 🏆' : stars >= 2 ? '¡Muy bien!' : stars ? '¡Buen intento!' : '¡Casi lo tienes!';
    dialog(`<p class="eyebrow">${won ? '¡Pintaste más de la mitad!' : 'Fin de la partida'}</p><div class="result-stars" aria-label="${stars} de 3 estrellas">${[0, 1, 2].map(i => `<span class="${i < stars ? '' : 'off'}">⭐</span>`).join('')}</div><h2>${title}</h2><p>${won ? '¡El mapa es de tu color!' : reason}</p><div class="results"><div><strong>${Math.round(percent)}%</strong><small>🎨 Pintado</small></div><div><strong>${player.kills}</strong><small>🎯 Atrapados</small></div><div><strong>+${number(arena.bits)}</strong><small>⭐ Estrellas</small></div></div><p>+${number(arena.xp)} XP · Nivel ${levelFor(profile.xp)}</p>${prizeChest ? `<div class="prize-chest chest-${prizeChest}">${chestSVG(prizeChest, 64)}<b>¡Ganaste un ${CHESTS[prizeChest].name}!</b></div>` : '<p>Pinta un poco más para ganar un cofre 🎁</p>'}<div class="dialog-buttons"><button class="dialog-button" id="retry">${!online ? '¡OTRA VEZ! ▶' : online.private ? '👫 Volver a la sala' : '¡OTRA PARTIDA! ▶'}</button><button class="dialog-button secondary" id="to-menu">🏠 Menú</button></div>`);
    tone(won ? 'level' : stars ? 'capture' : 'death');
    if (ranking) $('dialog-content').querySelector('h2').insertAdjacentHTML('afterend', `<p class="ranking-place">🏅 Quedaste en el puesto ${ranking.indexOf(0) + 1} de ${ranking.length}</p>`);
    $('retry').onclick = !online ? start : online.private ? () => online.lobby ? showLobby(online.lobby) : toast('La sala se está preparando…') : () => joinOnline('quick');
    $('to-menu').onclick = menu;
  }, 750);
}
function pause() {
  if (state !== 'playing' || mirror) return;
  state = 'paused'; keys.clear();
  dialog('<p class="eyebrow">⏸ Pausa</p><h2>¡Un descanso!</h2><p>El juego te espera. Tus estrellas ya están guardadas.</p><div class="dialog-buttons"><button id="resume" class="dialog-button">▶ SEGUIR JUGANDO</button><button id="abandon" class="dialog-button secondary">🏁 Terminar</button></div>');
  $('resume').onclick = () => { $('dialog').close(); state = 'playing'; $('arena').focus({ preventScroll: true }); };
  $('abandon').onclick = () => { $('dialog').close(); arena.ended = true; end(false, 'Terminaste la partida. ¡Vuelve cuando quieras!'); };
}
// Online matches cannot pause: the button offers to leave instead.
$('pause').onclick = () => {
  if (!mirror) { pause(); return; }
  dialog('<p class="eyebrow">🌐 En línea</p><h2>¿Salir de la partida?</h2><p>Los demás siguen jugando. Un robot tomará tu lugar.</p><div class="dialog-buttons"><button id="resume" class="dialog-button">▶ SEGUIR JUGANDO</button><button id="abandon" class="dialog-button secondary">🚪 Salir</button></div>');
  $('resume').onclick = () => $('dialog').close();
  $('abandon').onclick = menu;
};
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); save(true); } });
addEventListener('blur', () => { keys.clear(); pause(); });
addEventListener('pagehide', save);
setInterval(save, 10000);

function activate(slot) {
  if (state !== 'playing') return;
  const power = arena.actors[0].powers[slot];
  if (mirror) { if (power && arena.actors[0].alive) online.connection.send({ t: 'power', s: slot }); return; }
  if (power && arena.ability(0, power)) renderHUD();
}
document.querySelectorAll('[data-slot].ability').forEach(button => {
  button.onclick = () => activate(Number(button.dataset.slot));
  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      event.preventDefault(); activate(Number(button.dataset.slot));
    }
  });
});
document.addEventListener('keydown', event => {
  if (event.code === 'Escape') {
    if (state === 'playing') { event.preventDefault(); if (mirror) $('pause').click(); else pause(); }
    else if (state === 'paused') { event.preventDefault(); $('resume')?.click(); }
    else if ($('dialog').open) {
      event.preventDefault();
      $('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
    }
    return;
  }
  if (state !== 'playing') return;
  if (['Space', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
    event.preventDefault(); if (!event.repeat) activate(event.code === 'Space' ? 0 : 1); return;
  }
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) { event.preventDefault(); keys.add(event.code); aim = null; }
});
document.addEventListener('keyup', event => keys.delete(event.code));
function pointer(event) {
  if (state !== 'playing') return;
  aim = { x: event.clientX, y: event.clientY };
}
$('arena').addEventListener('pointermove', pointer);
$('arena').addEventListener('pointerdown', event => {
  pointer(event); $('arena').setPointerCapture(event.pointerId);
});
function updateJoystick(event) {
  const bounds = $('joystick').getBoundingClientRect();
  const radius = bounds.width * .34;
  const dx = event.clientX - bounds.left - bounds.width / 2;
  const dy = event.clientY - bounds.top - bounds.height / 2;
  const distance = Math.hypot(dx, dy), factor = Math.min(1, radius / (distance || 1));
  touchSteer.x = dx * factor / radius; touchSteer.y = dy * factor / radius;
  $('joystick-knob').style.transform = `translate(calc(-50% + ${dx * factor}px), calc(-50% + ${dy * factor}px))`;
}
$('joystick').addEventListener('pointerdown', event => {
  if (state !== 'playing' || touchSteer.id !== null) return;
  event.preventDefault();
  touchSteer.id = event.pointerId; aim = null;
  $('joystick').setPointerCapture(event.pointerId);
  $('joystick').classList.add('engaged'); updateJoystick(event);
});
$('joystick').addEventListener('pointermove', event => {
  if (event.pointerId !== touchSteer.id) return;
  event.preventDefault(); updateJoystick(event);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  $('joystick').addEventListener(type, event => { if (event.pointerId === touchSteer.id) resetJoystick(); });
}
function steer() {
  const player = arena.actors[0];
  arena.wallRange = 40 / renderer.scale;
  if (touchSteer.id !== null && Math.hypot(touchSteer.x, touchSteer.y) > .16) {
    // Invert the projected direction so the stick follows the screen, not grid axes.
    const head = renderer.project(player.x, player.y);
    const target = renderer.unproject(head.x + touchSteer.x * 80, head.y + touchSteer.y * 80);
    player.desired = Math.atan2(target.y - player.y, target.x - player.x);
    return;
  }
  const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const y = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  if (x || y) player.desired = Math.atan2(y, x);
  else if (aim) {
    const world = renderer.unproject(aim.x, aim.y);
    if (Math.hypot(world.x - player.x, world.y - player.y) > .8) player.desired = Math.atan2(world.y - player.y, world.x - player.x);
  }
}
function processEvents() {
  for (const event of arena.events.splice(0)) {
    if (event.type === 'death' && event.killer === 0 && arena.actors[event.id].name === profile.nemesis) { event.revenge = true; profile.nemesis = ''; }
    renderer.effects(event, arena);
    if (event.type === 'reward') {
      const oldLevel = levelFor(profile.xp);
      profile.bits += event.bits; profile.xp += event.xp; profile.totalKills += event.kills;
      if (mirror) { arena.bits += event.bits; arena.xp += event.xp; }
      // Each new level gives a rare chest; every fifth level a legendary one.
      if (levelFor(profile.xp) > oldLevel) {
        const level = levelFor(profile.xp), type = level % 5 === 0 ? 'legendario' : 'raro';
        profile.chests[type]++;
        announce(`🎉 ¡NIVEL ${level}! +🎁`); toast(`🎁 ¡Ganaste un ${CHESTS[type].name} por subir al nivel ${level}!`); tone('level');
      }
      save();
    }
    if (event.type === 'death') {
      if (event.id === 0) arena.lastKiller = event.killer;
      if (event.id === 0 && event.killer >= 0) profile.nemesis = arena.actors[event.killer].name;
      if (event.id === 0) tone('death'); else if (event.killer === 0) tone('kill');
    }
    if (event.type === 'capture' && event.id === 0 && event.cells) tone();
    if (event.type === 'ability' && event.id === 0) tone('ability');
    if (event.type === 'orb' && event.id === 0) tone('orb');
    if (event.type === 'out' && event.id === 0) { announce('¡Te atraparon! 👀'); toast('Ahora miras la partida. Cambia de jugador con ◀ ▶.'); spectate(arena.lastKiller ?? -1); }
    if (event.type === 'end') end(event.won, event.reason, event.ranking);
  }
}
let wasSurging = false;
function renderHUD() {
  const player = arena.actors[0], percent = player.count / SIZE * 100;
  $('hud-territory').textContent = Math.round(percent) + '%';
  $('goal-fill').style.width = Math.min(100, percent / 50 * 100) + '%';
  $('hud-kills').textContent = player.kills; $('hud-bits').textContent = number(arena.bits);
  document.querySelectorAll('[data-milestone]').forEach(el => {
    const reached = percent >= Number(el.dataset.milestone);
    if (reached && !el.classList.contains('reached') && state === 'playing') announce(`⭐ ¡${el.dataset.milestone}%! ⭐`);
    el.classList.toggle('reached', reached);
  });
  $('danger').hidden = !player.trail.length || !player.alive;
  $('wall-boost').hidden = !player.wallSurge || !player.alive;
  if (player.wallSurge && !wasSurging && state === 'playing') tone('wall');
  wasSurging = player.wallSurge;
  const score = actor => actor.count * 20 + actor.kills * 1000;
  // Rows are built once per match; here they are only reordered, so avatars never flicker.
  const ranked = arena.actors.filter(a => a.alive).sort((a, b) => score(b) - score(a));
  for (const row of $('leaders').children) {
    const actor = arena.actors[row.dataset.actor], rank = ranked.indexOf(actor);
    row.hidden = rank < 0 || (rank > 2 && actor.id !== 0);
    row.style.order = rank; row.classList.toggle('leader', rank === 0);
    row.querySelector('i').textContent = rank + 1;
    row.querySelector('b').textContent = Math.round(actor.count / SIZE * 100) + '%';
  }
  // One button per power of the current character; commons show no buttons at all.
  for (const slot of [0, 1]) {
    const id = player.powers[slot], button = $('slot-' + slot);
    button.hidden = !id; if (!id) continue;
    const power = POWERS[id], remaining = Math.max(0, (player.ready[id] || 0) - arena.time), active = arena.active(player, id);
    $('slot-name-' + slot).textContent = power.name;
    $('slot-icon-' + slot).textContent = power.icon;
    $('slot-state-' + slot).textContent = active ? '¡ACTIVO!' : remaining ? Math.ceil(remaining) + ' s' : '¡YA!';
    $('slot-meter-' + slot).style.setProperty('--ready', 1 - remaining / arena.cooldown(player, id));
    button.disabled = remaining > 0 || !player.alive;
    button.classList.toggle('active', active);
    button.classList.toggle('ready', !remaining);
  }
  $('no-powers').hidden = player.powers.length > 0;
  if (arena.follow !== undefined && !arena.actors[arena.follow]?.alive) spectate(-1);
  if (mirror) { const left = Math.ceil(mirror.remaining()); $('hud-timer').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; }
  const c = $('minimap').getContext('2d');
  c.clearRect(0, 0, 168, 144); c.fillStyle = '#ecfbf6'; c.fillRect(0, 0, 168, 144);
  for (let i = 0; i < SIZE; i++) if (arena.grid[i] >= 0) { c.fillStyle = arena.actors[arena.grid[i]].color + 'aa'; c.fillRect(i % WIDTH * 2, Math.floor(i / WIDTH) * 2, 2, 2); }
  for (const actor of arena.actors) if (actor.alive) {
    c.strokeStyle = actor.color; c.lineWidth = 2; c.beginPath();
    actor.trail.forEach((index, i) => { const x = (index % WIDTH + .5) * 2, y = (Math.floor(index / WIDTH) + .5) * 2; if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
    c.fillStyle = actor.color; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(actor.x * 2, actor.y * 2, actor.id ? 4 : 6, 0, Math.PI * 2); c.fill(); c.stroke();
  }
}

function showHelp() {
  dialog(`<p class="eyebrow">📖 Cómo se juega</p><h2>¡Pinta el mapa!</h2><ul><li><b>🕹️</b><span>Muévete con el joystick o arrastrando el dedo. Tu personaje sigue avanzando solo.</span></li><li><b>🖌️</b><span>Sal de tu zona: dejarás un camino de pintura. Vuelve a casa y se pintará todo lo de dentro.</span></li><li><b>⚠️</b><span>Si un robot toca tu camino mientras estás fuera, ¡te atrapa! Tocar el tuyo o chocar con otros no pasa nada.</span></li><li><b>🎯</b><span>Toca el camino de un robot para atraparlo y quedarte con parte de su zona.</span></li><li><b>⭐</b><span>Recoge estrellas: te dan puntos y hacen más grande tu próxima zona.</span></li><li><b>⚡</b><span>Cerca de la valla vas más rápido.</span></li><li><b>🐥</b><span>Cada personaje es distinto: los comunes no tienen poderes; los raros, épicos, legendarios y míticos traen poderes como disparar, correr más o pintar sin volver a casa. Úsalos con los botones de la derecha y espera a que se recarguen.</span></li><li><b>🎁</b><span>Gana cofres al terminar una partida, al subir de nivel y cada 4 horas gratis. ¡Dentro hay personajes y colores nuevos!</span></li><li><b>🏆</b><span>¡Pinta más de la mitad del mapa para ganar un cofre épico!</span></li></ul><p>¿Te parece difícil? Activa el modo fácil 🐢 en el menú.</p><div class="dialog-buttons"><button id="close-help" class="dialog-button">¡ENTENDIDO! 👍</button></div>`);
  $('close-help').onclick = () => $('dialog').close();
}
document.querySelectorAll('[data-help]').forEach(button => button.onclick = showHelp);
$('dialog').addEventListener('cancel', event => {
  event.preventDefault();
  if (state === 'paused') $('resume')?.click();
  else if (state === 'results' || state === 'lobby') menu();
  else if (!$('crate-spinner')) $('dialog').close();
});
// ---------- Profile and cloud save ----------
// The nickname is what other players see online. Cleaned names only contain letters,
// digits, spaces, "_" and "-", so they are safe to place in HTML.
function editName(first = false, suggestion = '') {
  const offerCloud = first && cloud.available && !account;
  dialog(`<p class="eyebrow">${first ? '👋 ¡Bienvenido a Pintamundo!' : '👤 Tu perfil'}</p><h2>${first ? 'Crea tu perfil' : 'Cambia tu nombre'}</h2><p>Así te verán los demás en las partidas en línea.</p><div class="name-row"><input id="name-input" maxlength="14" value="${profile.name || suggestion}" placeholder="Tu nombre" autocomplete="nickname" spellcheck="false" aria-label="Tu nombre"><small>De 3 a 14 letras o números.</small></div><div class="dialog-buttons"><button id="name-save" class="dialog-button">✓ ${first ? '¡LISTO!' : 'Guardar'}</button>${first ? '' : '<button id="name-cancel" class="dialog-button secondary">Cancelar</button>'}</div>${offerCloud ? '<p class="cloud-hint">¿Ya jugabas en otro teléfono?</p><div class="dialog-buttons"><button id="name-cloud" class="dialog-button secondary">☁️ Recuperar mi progreso</button></div>' : ''}`);
  const input = $('name-input');
  $('name-save').onclick = () => {
    const name = cleanName(input.value);
    if (!name) { toast('Tu nombre necesita de 3 a 14 letras o números.'); input.focus(); return; }
    profile.name = name; save(true); renderMenu(); $('dialog').close();
    if (first) toast(`¡Hola, ${name}! 🎨`);
  };
  input.onkeydown = event => { if (event.key === 'Enter') $('name-save').click(); };
  if ($('name-cancel')) $('name-cancel').onclick = () => $('dialog').close();
  if ($('name-cloud')) $('name-cloud').onclick = openAccount;
}
$('profile-button').onclick = () => editName();
function renderAccount() {
  $('profile-name').textContent = profile.name || 'Elige tu nombre';
  $('account-button').hidden = !cloud.available;
  $('account-button').textContent = account ? '☁️ Cuenta de Google' : '☁️ Guardar en mi cuenta';
}
function openAccount() {
  if (account) {
    dialog(`<p class="eyebrow">☁️ Tu cuenta</p><h2>Conectado con Google</h2><p>Tu progreso se guarda en la nube. Entra con la misma cuenta en otro teléfono para seguir jugando.</p><div class="dialog-buttons"><button id="account-sync" class="dialog-button">🔄 Sincronizar ahora</button><button id="account-out" class="dialog-button secondary">🚪 Cerrar sesión</button><button id="account-close" class="dialog-button secondary">Cerrar</button></div>`);
    $('account-sync').onclick = async () => { $('dialog').close(); await syncWithCloud(false); toast('☁️ Progreso sincronizado.'); };
    $('account-out').onclick = signOut;
  } else {
    dialog(`<p class="eyebrow">☁️ Guardar en mi cuenta</p><h2>¡No pierdas tu progreso!</h2><p>Conecta tu cuenta de Google para guardar tu progreso en la nube y recuperarlo en otro teléfono.</p><div class="dialog-buttons login-buttons"><button id="login-google" class="dialog-button login google">Continuar con Google</button><button id="account-close" class="dialog-button secondary">Ahora no</button></div>`);
    $('login-google').onclick = signIn;
  }
  $('account-close').onclick = () => $('dialog').close();
}
async function signIn() {
  try { account = await cloud.signIn(); }
  catch { toast('No se pudo iniciar sesión. Inténtalo de nuevo.'); return; }
  if (!account) return;
  $('dialog').close(); renderAccount();
  await syncWithCloud(true);
  if (!account) return;
  toast('☁️ Conectado con Google.');
  if (!profile.name && state === 'menu' && !$('dialog').open) editName(true, cleanName(account.name.split(' ')[0]));
}
async function signOut() {
  $('dialog').close();
  if (cloudDirty) await pushCloud();
  try { await cloud.signOut(); } catch { /* The local session is dropped anyway. */ }
  account = null; renderAccount(); save();
  toast('Sesión cerrada. Tu progreso sigue en este teléfono.');
}
// Uploads at most once a minute while playing; `now` sends it right away.
function scheduleCloud(now = false) {
  if (!account || !cloudDirty) return;
  if (now) { clearTimeout(cloudTimer); cloudTimer = 0; void pushCloud(); }
  else if (!cloudTimer) cloudTimer = setTimeout(() => { cloudTimer = 0; void pushCloud(); }, 60000);
}
async function pushCloud() {
  if (!account || cloudBusy) return;
  cloudBusy = true; cloudDirty = false;
  try { await cloud.upload(account.uid, profile, levelFor(profile.xp)); }
  catch { cloudDirty = true; }
  finally { cloudBusy = false; if (cloudDirty) scheduleCloud(); }
}
// Replaces the local profile with the cloud copy (only from the menu, never mid-match).
function adopt(remote) {
  profile = remote; savedContent = contentOf(profile);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); } catch { /* The cloud still has it. */ }
  arena = new Arena(profile); renderMenu();
}
const hasProgress = p => p.xp > 0 || p.wins > 0 || p.skins.length > 0;
const summary = p => `${p.name || 'Sin nombre'} · Nivel ${levelFor(p.xp)} · ${number(p.bits)} ⭐`;
// On launch (`ask` false) the newest copy wins. Right after signing in on this phone,
// if both copies have progress and differ, the player chooses which one to keep.
async function syncWithCloud(ask) {
  let remote = null;
  try { const text = await cloud.download(account.uid); if (text) remote = parseProfile(text); }
  catch { toast('No se pudo leer tu progreso de la nube. Lo intentaremos más tarde.'); return; }
  const upload = () => { cloudDirty = true; scheduleCloud(true); };
  if (!remote) { upload(); return; }
  if (remote.updatedAt === profile.updatedAt) return;
  if (state !== 'menu') { upload(); return; }
  if (!hasProgress(profile)) { adopt(remote); return; }
  if (!ask || !hasProgress(remote)) { if (remote.updatedAt > profile.updatedAt) adopt(remote); else upload(); return; }
  // Closing without choosing leaves the account unlinked, so neither copy is overwritten.
  let chosen = false;
  await new Promise(resolve => {
    dialog(`<p class="eyebrow">☁️ Tu cuenta</p><h2>¿Qué progreso quieres usar?</h2><p>Tu cuenta ya tiene progreso guardado. El que no elijas se perderá.</p><div class="dialog-buttons choice-buttons"><button id="use-cloud" class="dialog-button">☁️ El de mi cuenta<small>${summary(remote)}</small></button><button id="use-local" class="dialog-button secondary">📱 El de este teléfono<small>${summary(profile)}</small></button></div>`);
    $('use-cloud').onclick = () => { chosen = true; adopt(remote); $('dialog').close(); };
    $('use-local').onclick = () => { chosen = true; upload(); $('dialog').close(); };
    $('dialog').addEventListener('close', resolve, { once: true });
  });
  if (!chosen) {
    account = null; renderAccount();
    try { await cloud.signOut(); } catch { /* Nothing was linked. */ }
    toast('No conectamos tu cuenta. Tu progreso sigue en este teléfono.');
  }
}
$('account-button').onclick = openAccount;
async function restoreAccount() {
  if (!cloud.available) return;
  try { account = await cloud.currentAccount(); } catch { account = null; }
  renderAccount();
  if (account) await syncWithCloud(false);
}

// ---------- Online play ----------
// Players are shown with their nickname and character. There is no chat.
function openOnline() {
  const server = defaultServer();
  dialog(`<p class="eyebrow">🌐 Jugar en línea</p><h2>¡Juega con gente de todo el mundo!</h2><p>Si faltan jugadores, los robots ocupan su lugar. Los demás verán tu nombre y tu personaje.</p><div class="online-actions"><button id="online-quick" class="dialog-button">⚡ Jugar rápido</button><button id="online-create" class="dialog-button">👫 Crear sala para amigos</button><div class="join-row"><label for="online-code">¿Tu amigo ya creó una sala? Escribe su código:</label><input id="online-code" maxlength="8" placeholder="GATO-42" autocomplete="off" autocapitalize="characters" spellcheck="false"><button id="online-join" class="dialog-button">🚪 Unirme a la sala</button></div></div><details class="server-box" ${server ? '' : 'open'}><summary>⚙️ Servidor</summary><input id="online-server" value="${server}" placeholder="192.168.1.20:5173" autocomplete="off" aria-label="Dirección del servidor"><small>Cámbialo solo si juegas con un servidor propio.</small></details><div class="dialog-buttons"><button id="online-close" class="dialog-button secondary">Cancelar</button></div>`);
  $('online-quick').onclick = () => joinOnline('quick');
  $('online-create').onclick = () => joinOnline('create');
  $('online-join').onclick = () => joinOnline('join', $('online-code').value);
  $('online-code').onkeydown = event => { if (event.key === 'Enter') $('online-join').click(); };
  $('online-close').onclick = () => $('dialog').close();
}
async function joinOnline(kind, code = '') {
  const typed = $('online-server') ? normalizeServer($('online-server').value) : '', url = typed || online?.connection.url || defaultServer();
  if (!url) { toast('Escribe la dirección del servidor en ⚙️ Servidor.'); return; }
  if (kind === 'join' && !code.trim()) { toast('Escribe el código de la sala de tu amigo.'); return; }
  if (!online || online.connection.url !== url || !online.connection.isOpen) {
    disconnect();
    dialog('<p class="eyebrow">🌐 En línea</p><h2>Conectando…</h2><div class="connecting" aria-hidden="true">🛰️</div><p id="connect-note"></p>');
    // A free server sleeps when nobody plays and needs up to a minute to wake up, so retry a while.
    let connection = null;
    for (let attempt = 0; attempt < 8 && !connection; attempt++) {
      const candidate = new Connection(url, onServerMessage, onDisconnect);
      try { await candidate.open(); connection = candidate; }
      catch {
        if (!$('connect-note')) return; // The player closed the window.
        $('connect-note').textContent = 'El servidor se está despertando… puede tardar hasta un minuto. ⏳';
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    if (!connection) { $('dialog').close(); toast('No pudimos conectar con el servidor. Revisa la dirección o inténtalo más tarde.'); return; }
    online = { connection, private: kind !== 'quick', lobby: null };
    rememberServer(url);
  }
  online.private = kind !== 'quick'; online.lobby = null;
  const character = characterFor(profile.skin);
  online.connection.send({ t: kind, code, name: profile.name, skin: ownsCharacter(profile, character.id) ? character.id : 'interceptor', color: playerColor(), easy: profile.easy === true });
}
function disconnect() {
  if (!online) return;
  online.connection.send({ t: 'leave' }); online.connection.close();
  online = null; mirror = null;
}
function onDisconnect() {
  const playing = state === 'playing' || state === 'lobby';
  online = null; mirror = null;
  if (playing) { menu(); toast('Se perdió la conexión con el servidor. 📡'); }
}
function onServerMessage(message) {
  if (message.t === 'state') { if (mirror) mirror.state(message); return; }
  if (message.t === 'lobby') {
    online.lobby = message; online.private = message.private;
    if (state === 'menu' || state === 'lobby') showLobby(message);
    return;
  }
  if (message.t === 'start') { startOnline(message); return; }
  if (message.t === 'error') { toast(message.message); if (state === 'lobby') { state = 'menu'; $('dialog').close(); } }
}
function showLobby(message) {
  if (state === 'results') menuBehindLobby();
  state = 'lobby';
  const players = message.players.map(p => `<li class="${p.you ? 'you' : ''}"><img src="${renderer.portraitURL({ skin: p.skin, color: p.color }, 72)}" alt=""><b>${p.you ? 'Tú' : p.name}</b>${p.host ? '<span>👑</span>' : ''}</li>`).join('');
  const empty = Array.from({ length: message.max - message.players.length }, () => '<li class="empty"><span class="robot" aria-hidden="true">🤖</span><b>Robot</b></li>').join('');
  const status = !message.private ? `<p class="lobby-status">Empieza en <b>${message.startsIn}</b> s…</p>` : message.host ? '<p class="lobby-status">Cuando estén todos, pulsa empezar.</p>' : '<p class="lobby-status">Esperando a que 👑 empiece la partida…</p>';
  dialog(`<p class="eyebrow">${message.private ? '👫 Sala de amigos' : '⚡ Jugar rápido'}</p>${message.private ? `<p class="lobby-hint">Comparte este código:</p><div class="room-code">${message.code}</div>` : '<h2>¡Buscando jugadores!</h2>'}<ul class="lobby-players">${players}${empty}</ul>${status}<div class="dialog-buttons">${message.private && message.host ? '<button id="lobby-start" class="dialog-button">¡EMPEZAR! ▶</button>' : ''}<button id="lobby-leave" class="dialog-button secondary">🚪 Salir</button></div>`);
  if ($('lobby-start')) $('lobby-start').onclick = () => online.connection.send({ t: 'start' });
  $('lobby-leave').onclick = menu;
}
// After an online match the HUD is still on screen; go back to the menu before showing a lobby.
function menuBehindLobby() {
  generation++; keys.clear(); aim = null; resetJoystick(); mirror = null; stopSpectating();
  $('menu').hidden = false; $('hud').hidden = true; document.body.classList.remove('in-match');
  arena = new Arena(profile); renderMenu();
}
function startOnline(message) {
  generation++; arena = new Arena(profile); mirror = new Mirror(arena, message);
  state = 'playing'; aim = null; keys.clear(); resetJoystick(); lastHeading = { angle: NaN, at: 0 };
  enterMatch(); announce('¡A PINTAR EN LÍNEA! 🌐'); renderHUD();
}
// Heading is sent when it changes noticeably, and at least every 200 ms.
let lastHeading = { angle: NaN, at: 0 };
function sendHeading(time) {
  const player = arena.actors[0];
  if (!player.alive || !online) return;
  const turn = Math.abs(Math.atan2(Math.sin(player.desired - lastHeading.angle), Math.cos(player.desired - lastHeading.angle)));
  if (!(turn > .03) && time - lastHeading.at < 200) return;
  online.connection.send({ t: 'input', a: Math.round(player.desired * 1000) / 1000 });
  lastHeading = { angle: player.desired, at: time };
}
$('online').onclick = openOnline;

function frame(time) {
  const dt = Math.max(0, Math.min(.08, (time - lastFrame) / 1000)); lastFrame = time;
  if (state === 'playing' && mirror) {
    // Online: the server moves everything; the phone only sends its heading.
    steer(); mirror.update(time, arena.actors[0].desired, online?.connection.rtt); sendHeading(time); processEvents();
    hudClock += dt; if (hudClock > .1) { renderHUD(); hudClock = 0; }
  } else if (state === 'playing') {
    accumulator += dt; steer();
    // A bounded fixed step keeps trail traversal and bot decisions frame-rate independent.
    while (accumulator >= 1 / 90 && state === 'playing') { arena.step(1 / 90); processEvents(); accumulator -= 1 / 90; }
    hudClock += dt; if (hudClock > .1) { renderHUD(); hudClock = 0; }
  }
  // The menu is opaque: skip the arena and animate only the mascot on the home screen.
  if (!document.hidden && state !== 'menu') renderer.draw(arena, time / 1000, dt);
  else if (!document.hidden && screen === 'home') renderer.portrait($('mascot'), { skin: profile.skin, color: playerColor() }, time / 1000, { idle: true });
  if (time > announcedUntil) $('announcement').hidden = true;
  requestAnimationFrame(frame);
}
showScreen('home'); requestAnimationFrame(frame);
if (storageError) toast('No se pudo cargar tu progreso de este teléfono.');
// The cloud copy is checked first, so a returning player is not asked for a new name.
restoreAccount().finally(() => { if (!profile.name && state === 'menu' && !$('dialog').open) editName(true); });

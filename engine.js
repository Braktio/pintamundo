// Deterministic grid ownership and trail collision. Rendering never affects game rules.
export const WIDTH = 84, HEIGHT = 72, SIZE = WIDTH * HEIGHT;
export const CELL_PIXELS = 20;
// Candy palette: saturated, friendly and distinct on the light play board.
export const COLORS = ['#2fa8ff', '#ff4f7b', '#5cc93b', '#ff9a1f', '#9b5cff', '#f5b800', '#ff5fc8'];
// Rarity drives how many powers a character has and how fast they recharge.
export const RARITIES = {
  comun: { name: 'Común', color: '#9fb3d9', cooldown: 1, refund: 40 },
  raro: { name: 'Raro', color: '#3fd0ff', cooldown: 1, refund: 80 },
  epico: { name: 'Épico', color: '#b45cff', cooldown: .9, refund: 160 },
  legendario: { name: 'Legendario', color: '#ffc21f', cooldown: .8, refund: 320 },
  mitico: { name: 'Mítico', color: '#ff4f8b', cooldown: .65, refund: 640 }
};
export const RARITY_ORDER = Object.keys(RARITIES);
// Duration 0 means the power acts instantly (a shot, a bomb, a freeze).
export const POWERS = {
  dash: { name: 'Turbo', icon: '🚀', duration: 3, cooldown: 10, description: '¡Corre mucho más rápido durante 3 segundos!' },
  shield: { name: 'Burbuja', icon: '🛡️', duration: 1.5, cooldown: 16, description: 'Protege tu camino y hace rebotar a quien lo toque.' },
  magnet: { name: 'Imán', icon: '🧲', duration: 4, cooldown: 14, description: 'Atrae las estrellas cercanas hacia ti.' },
  ghost: { name: 'Fantasma', icon: '👻', duration: 3, cooldown: 16, description: 'Los robots no ven la parte nueva de tu camino.' },
  shoot: { name: 'Disparo', icon: '🎯', duration: 0, cooldown: 8, description: 'Lanza una bola de pintura que pinta donde cae. Si toca el camino de un rival, ¡lo atrapa!' },
  paint: { name: 'Rodillo', icon: '🖌️', duration: 3, cooldown: 18, description: 'Durante 3 segundos pintas tu zona por donde pasas, sin volver a casa.' },
  bomb: { name: 'Bomba de color', icon: '💥', duration: 0, cooldown: 22, description: 'Pinta de golpe un gran círculo a tu alrededor.' },
  freeze: { name: 'Congelar', icon: '❄️', duration: 0, cooldown: 20, description: 'Congela un momento a los rivales que estén cerca.' }
};
export const FREEZE_TIME = 1.6, SHOT_SPEED = 18, SHOT_LIFE = .8;
// Where a paint shot lands it paints a small disc, like a little Bomba de color.
export const SHOT_PAINT = 2.2;
// Solo: seconds before new robots appear once every robot is out, and how many.
export const RESPAWN_DELAY = 2.5, RESPAWN_BOTS = 3;
// Characters are drawn procedurally from `look`. Old ids (interceptor, tron, disc,
// phoenix, spectre, rift) are kept so saved profiles stay valid; `level` marks the
// characters the adventure road still gives for free.
const character = (id, name, rarity, powers, look, extra = {}) => ({ id, name, rarity, powers, look: { shape: 'round', ears: 'none', extras: [], eyes: 'normal', ...look }, ...extra });
export const CHARACTERS = [
  character('interceptor', 'Pollito Pip', 'comun', [], { color: '#ffd23a', accent: '#ff9a1f', ears: 'tuft', extras: ['beak'] }, { level: 1 }),
  character('raton', 'Ratón Tito', 'comun', [], { color: '#b9c1d9', accent: '#ff9fc4', ears: 'bear', extras: ['whiskers', 'teeth'] }),
  character('rana', 'Rana Zuzú', 'comun', [], { color: '#6fdc3c', accent: '#3aa316', extras: ['spots'], eyes: 'big' }),
  character('cerdito', 'Cerdito Pom', 'comun', [], { color: '#ffa8cc', accent: '#ff6fa5', ears: 'cat', extras: ['snout'] }),
  character('osito', 'Osito Lulo', 'comun', [], { color: '#c9874a', accent: '#f2c79a', ears: 'bear', extras: ['snout'] }),
  character('pinguino', 'Pingüi Pau', 'comun', [], { color: '#3d4f9f', accent: '#ffffff', extras: ['belly', 'beak'] }),
  character('patito', 'Patito Cuá', 'comun', [], { color: '#f4f7ff', accent: '#ff9a1f', ears: 'tuft', extras: ['beak'] }),
  character('gotita', 'Gotita Glu', 'comun', [], { shape: 'drop', color: '#4fc3ff', accent: '#bdeeff' }),
  character('hongo', 'Hongo Mus', 'comun', [], { color: '#ff5a5a', accent: '#ffffff', extras: ['spots'] }),
  character('slime', 'Slime Blub', 'comun', [], { shape: 'ghost', color: '#a6f04a', accent: '#6fbf2a', eyes: 'big' }),
  character('conejo', 'Conejo Rulo', 'comun', [], { color: '#ffe0ec', accent: '#ff8fb0', ears: 'bunny', extras: ['teeth'] }),
  character('topo', 'Topo Tuno', 'comun', [], { color: '#8a6a5a', accent: '#ffb3c6', ears: 'bear', extras: ['snout'], eyes: 'sleepy' }),
  character('tron', 'Gato Rayo', 'raro', ['dash'], { color: '#ff9a1f', accent: '#fff1c9', ears: 'cat', extras: ['whiskers', 'stripes'] }, { level: 2 }),
  character('abeja', 'Abeja Zum', 'raro', ['magnet'], { color: '#ffd23a', accent: '#1c2a6e', ears: 'antenna', extras: ['wings', 'bands'] }),
  character('mapache', 'Mapache Lalo', 'raro', ['shield'], { color: '#9aa6c0', accent: '#3a4566', ears: 'bear', extras: ['mask'] }),
  character('tortuga', 'Tortuga Tina', 'raro', ['shield'], { color: '#7ed957', accent: '#2f8a4a', extras: ['spots'] }),
  character('koala', 'Koala Kiko', 'raro', ['magnet'], { color: '#b8c0d4', accent: '#ffd6e6', ears: 'bear', extras: ['snout'] }),
  character('zorro', 'Zorro Fito', 'raro', ['dash'], { color: '#ff7a2a', accent: '#ffffff', ears: 'cat', extras: ['belly'] }),
  character('pulpo', 'Pulpo Pepe', 'raro', ['magnet'], { shape: 'ghost', color: '#c77dff', accent: '#9b4fe0', extras: ['spots'] }),
  character('burbujin', 'Burbujín', 'raro', ['shield'], { color: '#9fe3ff', accent: '#ffffff', ears: 'halo' }),
  character('cohete', 'Cohete Rocky', 'raro', ['dash'], { shape: 'box', color: '#ff4f6d', accent: '#ffd23a', ears: 'antenna', eyes: 'robot' }),
  character('disc', 'Platillo Zum', 'epico', ['shoot'], { color: '#9b7bff', accent: '#c9d6e8', ears: 'antenna', extras: ['saucer'] }, { level: 5 }),
  character('spectre', 'Fantasmín', 'epico', ['ghost'], { shape: 'ghost', color: '#d9ccff', accent: '#a58cff' }),
  character('pintor', 'Pintor Rodi', 'epico', ['paint'], { color: '#ffb3d9', accent: '#2d7bff', ears: 'beret', extras: ['mustache'] }),
  character('tiburon', 'Tiburón Tito', 'epico', ['shoot'], { color: '#5f8dff', accent: '#ffffff', ears: 'fin', extras: ['belly', 'teeth'] }),
  character('buho', 'Búho Ulises', 'epico', ['ghost'], { color: '#a8784e', accent: '#ffe1b0', ears: 'horns', extras: ['belly', 'beak'], eyes: 'big' }),
  character('panda', 'Panda Pancho', 'epico', ['paint'], { color: '#ffffff', accent: '#2b2b3a', ears: 'bear', extras: ['patches'] }),
  character('rift', 'Robo-Bip', 'epico', ['shoot'], { shape: 'box', color: '#4fc3ff', accent: '#ffd23a', ears: 'antenna', eyes: 'robot' }),
  character('phoenix', 'Dragoncito', 'legendario', ['dash', 'shoot'], { color: '#5cc93b', accent: '#ffe9a8', ears: 'horns', extras: ['wings', 'belly'] }, { level: 10 }),
  character('unicornio', 'Unicornio Lía', 'legendario', ['shield', 'paint'], { color: '#ffffff', accent: '#ff8ad8', ears: 'unicorn', extras: ['mane'] }),
  character('leon', 'León Rey', 'legendario', ['dash', 'paint'], { color: '#ffb347', accent: '#c8641f', ears: 'crown', extras: ['mane', 'snout'] }),
  character('ninja', 'Ninja Kai', 'legendario', ['ghost', 'shoot'], { color: '#3a3f5c', accent: '#ff4f6d', extras: ['band'] }),
  character('astronauta', 'Astro Nova', 'legendario', ['magnet', 'shoot'], { color: '#f2f6ff', accent: '#4fc3ff', ears: 'antenna', extras: ['helmet'] }),
  character('fenix', 'Fénix Llama', 'mitico', ['bomb', 'shoot'], { color: '#ff5a3c', accent: '#ffd23a', ears: 'crest', extras: ['wings', 'beak'] }),
  character('yeti', 'Yeti Copo', 'mitico', ['freeze', 'paint'], { color: '#eaf6ff', accent: '#8fd8ff', ears: 'bear', extras: ['fluff', 'teeth'] }),
  character('arcoiris', 'Rey Arcoíris', 'mitico', ['bomb', 'paint'], { shape: 'ghost', color: '#ff8ad8', accent: '#ffd23a', ears: 'crown', extras: ['rainbow'] }),
  character('golem', 'Gólem Cristal', 'mitico', ['freeze', 'shoot'], { shape: 'box', color: '#7fe4fa', accent: '#2d7bff', ears: 'crystal', eyes: 'cyclops' })
];
export const characterFor = id => CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
export const TRAILS = [
  { id: 'cyan', name: 'Azul cielo', color: COLORS[0] },
  { id: 'pink', name: 'Rosa chicle', color: '#ff8ad8', crate: true, rarity: 'raro' },
  { id: 'gold', name: 'Oro solar', color: '#ffb300', crate: true, rarity: 'epico' },
  { id: 'violet', name: 'Lavanda', color: '#b98cff', crate: true, rarity: 'raro' }
];
// Chest odds are percentages per rarity; they are shown to players in the chest screen.
export const CHESTS = {
  comun: { name: 'Cofre común', price: 300, odds: { comun: 70, raro: 25, epico: 5 } },
  raro: { name: 'Cofre raro', price: 900, odds: { comun: 35, raro: 45, epico: 15, legendario: 5 } },
  epico: { name: 'Cofre épico', price: 2500, odds: { raro: 35, epico: 45, legendario: 15, mitico: 5 } },
  legendario: { name: 'Cofre legendario', price: 6000, odds: { epico: 40, legendario: 45, mitico: 15 } }
};
export const FREE_CHEST_HOURS = 4;
export const levelFor = xp => 1 + Math.floor((Math.max(0, xp) / 200) ** (1 / 1.45));
export const levelXP = level => Math.ceil(200 * (level - 1) ** 1.45);

// Ranked ladder: 10 ranks with 3 divisions each (Bronce 1 → Bronce 3 → Plata 1 …), 30 tiers.
// Trophies (🏆) are won or lost after every match; each tier needs a few more than the last.
export const RANKS = [
  { id: 'bronce', name: 'Bronce', colors: ['#f0a868', '#a45a22'] },
  { id: 'plata', name: 'Plata', colors: ['#eef3fa', '#8d9ab0'] },
  { id: 'oro', name: 'Oro', colors: ['#ffe066', '#e09a00'] },
  { id: 'platino', name: 'Platino', colors: ['#a8f5f0', '#2aa9b0'] },
  { id: 'esmeralda', name: 'Esmeralda', colors: ['#8ef0a8', '#1f9a4f'] },
  { id: 'rubi', name: 'Rubí', colors: ['#ff9aae', '#c81d4a'] },
  { id: 'diamante', name: 'Diamante', colors: ['#c9f4ff', '#3d8cff'] },
  { id: 'maestro', name: 'Maestro', colors: ['#dcb4ff', '#7a3fe0'] },
  { id: 'granmaestro', name: 'Gran Maestro', colors: ['#ffb08a', '#d6452a'] },
  { id: 'leyenda', name: 'Leyenda', colors: ['#fff3a0', '#ff4f8b'] }
];
export const TIERS = RANKS.length * 3;
// Trophies for a profile that played before the ranks existed: victories, catches and its
// best zone, capped at 1.000 (Esmeralda 1 is 1.056).
export const startingPoints = p => Math.min(1000, Math.floor(p.wins * 12 + p.totalKills * 2 + p.best));
export const tierStart = tier => 40 * tier + 4 * tier * tier;
// { tier, rank, division, name, start, next } for a trophy count; `next` is null at the top.
export function rankFor(points) {
  let tier = 0;
  while (tier < TIERS - 1 && tierStart(tier + 1) <= points) tier++;
  const rank = RANKS[Math.floor(tier / 3)], division = tier % 3 + 1;
  return { tier, rank, division, name: `${rank.name} ${division}`, start: tierStart(tier), next: tier < TIERS - 1 ? tierStart(tier + 1) : null };
}
// Trophies for one match: the stars earned, catches (up to 5), painting the whole map and,
// online, the final place. Poor matches cost a few; the total never goes below zero.
export function rankChange({ stars, kills = 0, perfect = false, place = 0, players = 0 }) {
  let change = [-6, 4, 10, 18][stars] + Math.min(kills, 5) * 2 + (perfect ? 20 : 0);
  if (players > 1 && place) change += place === 1 ? 8 : place <= 3 ? 3 : place === players ? -3 : 0;
  return change;
}

// Daily missions: three a day, the same for everyone, chosen from the day ("2026-10-23").
// Each pays stars when claimed; claiming all three adds a bonus chest.
export const MISSIONS = {
  matches: { icon: '🎮', text: n => `Juega ${n} partidas`, goals: [2, 3, 4], reward: 60 },
  kills: { icon: '🎯', text: n => `Atrapa a ${n} rivales`, goals: [2, 4, 6], reward: 90 },
  paint: { icon: '🎨', text: n => `Pinta el ${n}% del mapa en una partida`, goals: [15, 25, 35], reward: 80 },
  orbs: { icon: '⭐', text: n => `Recoge ${n} estrellas del mapa`, goals: [8, 15, 25], reward: 60 },
  powers: { icon: '⚡', text: n => `Usa ${n} poderes`, goals: [4, 8, 12], reward: 60 },
  online: { icon: '🌐', text: n => n > 1 ? `Juega ${n} partidas en línea` : 'Juega una partida en línea', goals: [1, 2], reward: 100 },
  wins: { icon: '🏆', text: () => 'Pinta más de la mitad del mapa', goals: [1], reward: 150 }
};
export const MISSION_BONUS = 'raro';
export function missionsFor(day) {
  let seed = [...day].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
  const next = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0);
  const ids = Object.keys(MISSIONS), picked = [];
  while (picked.length < 3) {
    const id = ids.splice(next() % ids.length, 1)[0], { goals, reward } = MISSIONS[id], goal = goals[next() % goals.length];
    picked.push({ id, goal, reward, icon: MISSIONS[id].icon, text: MISSIONS[id].text(goal) });
  }
  return picked;
}
const freshDaily = day => ({ day, progress: {}, claimed: [], bonus: false });
// Today's missions with their progress; a new day starts from zero.
export function dailyMissions(profile, day) {
  if (profile.daily?.day !== day) profile.daily = freshDaily(day);
  return missionsFor(day).map(m => {
    const have = Math.min(m.goal, profile.daily.progress[m.id] || 0);
    return { ...m, have, done: have >= m.goal, claimed: profile.daily.claimed.includes(m.id) };
  });
}
// Adds one finished match ({ kills, percent, orbs, powers, online, won }) to today's
// missions and returns the ones it completed.
export function recordMatch(profile, day, stats) {
  const before = dailyMissions(profile, day), progress = profile.daily.progress;
  const add = (id, value) => { progress[id] = (progress[id] || 0) + value; };
  add('matches', 1); add('kills', stats.kills || 0); add('orbs', stats.orbs || 0); add('powers', stats.powers || 0);
  add('online', stats.online ? 1 : 0); add('wins', stats.won ? 1 : 0);
  progress.paint = Math.max(progress.paint || 0, Math.floor(stats.percent || 0));
  return dailyMissions(profile, day).filter((m, i) => m.done && !before[i].done);
}
export function claimMission(profile, day, id) {
  const mission = dailyMissions(profile, day).find(m => m.id === id);
  if (!mission?.done || mission.claimed) return 0;
  profile.daily.claimed.push(id); profile.bits += mission.reward;
  return mission.reward;
}
export function claimMissionBonus(profile, day) {
  if (profile.daily?.day !== day || profile.daily.bonus || !dailyMissions(profile, day).every(m => m.claimed)) return false;
  profile.daily.bonus = true; profile.chests[MISSION_BONUS]++;
  return true;
}
// Daily streak: one reward a day, better each day in a row, a week long and then again.
// Missing a day starts over at day 1.
export const STREAK_REWARDS = [{ bits: 100 }, { bits: 150 }, { chest: 'comun' }, { bits: 250 }, { chest: 'raro' }, { bits: 400 }, { chest: 'epico' }];
export const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export function streakStatus(profile, day) {
  const { last = '', count = 0 } = profile.streak || {};
  if (last === day) return { claimed: true, count, reward: STREAK_REWARDS[(count - 1) % STREAK_REWARDS.length] };
  const next = last && addDays(last, 1) === day ? count + 1 : 1;
  return { claimed: false, count: next, reward: STREAK_REWARDS[(next - 1) % STREAK_REWARDS.length] };
}
export function claimStreak(profile, day) {
  const status = streakStatus(profile, day);
  if (status.claimed) return null;
  profile.streak = { last: day, count: status.count };
  if (status.reward.bits) profile.bits += status.reward.bits; else profile.chests[status.reward.chest]++;
  return status.reward;
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const cell = (x, y) => Math.floor(y) * WIDTH + Math.floor(x);
export const coords = index => ({ x: index % WIDTH + .5, y: Math.floor(index / WIDTH) + .5 });
// Grid DDA visits every crossed tile, including a bridge on exact diagonal corners.
// Trails therefore stay 4-connected, which is required by the flood-fill boundary.
export function crossedCells(x0, y0, x1, y1) {
  let x = Math.floor(x0), y = Math.floor(y0);
  const endX = Math.floor(x1), endY = Math.floor(y1), dx = x1 - x0, dy = y1 - y0;
  const sx = Math.sign(dx), sy = Math.sign(dy), stepX = dx ? Math.abs(1 / dx) : Infinity, stepY = dy ? Math.abs(1 / dy) : Infinity;
  let nextX = dx ? ((sx > 0 ? x + 1 - x0 : x0 - x) / Math.abs(dx)) : Infinity;
  let nextY = dy ? ((sy > 0 ? y + 1 - y0 : y0 - y) / Math.abs(dy)) : Infinity;
  const result = [];
  while ((x !== endX || y !== endY) && result.length < SIZE) {
    if (nextX <= nextY) { x += sx; nextX += stepX; }
    else { y += sy; nextY += stepY; }
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) break;
    result.push(y * WIDTH + x);
  }
  return result;
}
export const emptyChests = () => Object.fromEntries(Object.keys(CHESTS).map(type => [type, 0]));
export function freshProfile() {
  // New players start with a rare chest so their first character with a power is one tap away.
  return { version: 1, name: '', updatedAt: 0, points: 0, ranked: true, bits: 0, xp: 0, wins: 0, totalKills: 0, best: 0, nemesis: '', skin: 'interceptor', trail: 'cyan', skins: [], trails: ['cyan'], copies: {}, easy: false, chests: { ...emptyChests(), raro: 1 }, freeChestAt: 0, daily: { day: '', progress: {}, claimed: [], bonus: false }, streak: { last: '', count: 0 } };
}
// Player nicknames: 3 to 14 letters, digits, spaces, "_" or "-". Returns '' when unusable.
export function cleanName(text) {
  const name = String(text ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14).trim();
  return name.length >= 3 ? name : '';
}
export const ownsCharacter = (profile, id) => {
  const found = CHARACTERS.find(c => c.id === id);
  return !!found && (profile.skins.includes(id) || (found.level !== undefined && levelFor(profile.xp) >= found.level));
};
export function parseProfile(raw) {
  const data = JSON.parse(raw), result = freshProfile();
  if (!data || data.version !== 1) throw new Error('Perfil incompatible');
  const count = value => Number.isFinite(value) && value >= 0 && value <= 1e12;
  for (const key of ['bits', 'xp', 'wins', 'totalKills', 'best']) {
    if (!count(data[key])) throw new Error('Perfil inválido');
    result[key] = data[key];
  }
  for (const [key, list] of [['skins', CHARACTERS], ['trails', TRAILS]]) {
    if (!Array.isArray(data[key]) || data[key].some(id => !list.some(item => item.id === id))) throw new Error('Colección inválida');
    result[key] = [...new Set(data[key])];
  }
  if (!ownsCharacter(result, data.skin)) throw new Error('Avatar inválido');
  if (!result.trails.includes(data.trail)) throw new Error('Equipamiento inválido');
  // Older saves had a single `crates` counter; those become rare chests.
  result.chests = emptyChests();
  if (data.chests !== undefined) {
    if (typeof data.chests !== 'object' || data.chests === null) throw new Error('Cofres inválidos');
    for (const type of Object.keys(CHESTS)) {
      const value = data.chests[type] ?? 0;
      if (!count(value) || value > 1e6) throw new Error('Cofres inválidos');
      result.chests[type] = Math.floor(value);
    }
  }
  if (data.crates !== undefined) { if (!count(data.crates)) throw new Error('Perfil inválido'); result.chests.raro += Math.floor(data.crates); }
  // A millisecond timestamp (~1.8e12) is larger than the counter limit above, so it
  // gets its own check. It is capped so an edited save can't lock the chest for longer.
  const latest = Date.now() + FREE_CHEST_HOURS * 3600000;
  result.freeChestAt = Number.isFinite(data.freeChestAt) && data.freeChestAt > 0 ? Math.min(data.freeChestAt, latest) : 0;
  result.updatedAt = Number.isFinite(data.updatedAt) && data.updatedAt > 0 ? data.updatedAt : 0;
  // Repeats collected per character (its level); older saves have none.
  result.copies = {};
  if (data.copies !== undefined) {
    if (typeof data.copies !== 'object' || data.copies === null || Array.isArray(data.copies)) throw new Error('Niveles inválidos');
    for (const [id, value] of Object.entries(data.copies)) {
      if (!levelsUp(CHARACTERS.find(c => c.id === id)) || !count(value) || value > 1000) throw new Error('Niveles inválidos');
      if (value) result.copies[id] = Math.floor(value);
    }
  }
  if (data.points !== undefined) { if (!count(data.points) || data.points > 1e6) throw new Error('Copas inválidas'); result.points = Math.floor(data.points); }
  // Once per profile, trophies are raised to what its past results earn (`ranked` marks it
  // done), so saves from before the ranks do not start from zero. Taking the larger value
  // never counts a victory twice.
  if (data.ranked !== true) result.points = Math.max(result.points, startingPoints(result));
  result.ranked = true;
  // Missions and streak are small daily state: a broken copy just starts over.
  const day = text => typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text);
  const d = data.daily;
  if (d && day(d.day) && typeof d.progress === 'object' && d.progress && Array.isArray(d.claimed)) {
    result.daily = { day: d.day, progress: {}, claimed: d.claimed.filter(id => id in MISSIONS), bonus: d.bonus === true };
    for (const [id, value] of Object.entries(d.progress)) if (id in MISSIONS && count(value)) result.daily.progress[id] = Math.min(1e4, Math.floor(value));
  }
  const st = data.streak;
  if (st && day(st.last) && Number.isInteger(st.count) && st.count > 0 && st.count <= 1e5) result.streak = { last: st.last, count: st.count };
  return { ...result, name: cleanName(data.name), easy: data.easy === true, nemesis: typeof data.nemesis === 'string' ? data.nemesis.slice(0, 40) : '', skin: data.skin, trail: data.trail };
}
// Every chest prize: characters (except the starter) and the special trail colors.
export const PRIZES = [
  ...CHARACTERS.filter(c => c.id !== 'interceptor').map(c => ({ ...c, type: 'skins' })),
  ...TRAILS.filter(t => t.crate).map(t => ({ ...t, type: 'trails' }))
];
export function rollRarity(type, random = Math.random) {
  const odds = Object.entries(CHESTS[type].odds), total = odds.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [rarity, weight] of odds) { roll -= weight; if (roll < 0) return rarity; }
  return odds.at(-1)[0];
}
// Character levels: rare, epic, legendary and mythic characters level up (1 → 10) with
// repeats from chests. Going from level n to n+1 takes ceil(n / 2) repeats (25 in all),
// and every level stretches the reach of the character's powers by 6%.
export const CHARACTER_MAX_LEVEL = 10, POWER_STEP = .06;
// While there are still new prizes of the rolled rarity, this share of chests gives a
// repeat of an owned character that can still level up.
export const REPEAT_CHANCE = .25;
export const levelsUp = character => !!character && character.rarity !== 'comun';
export const copiesFor = level => { let total = 0; for (let l = 1; l < level; l++) total += Math.ceil(l / 2); return total; };
export function characterLevel(profile, id) {
  if (!levelsUp(CHARACTERS.find(c => c.id === id))) return 1;
  const copies = profile.copies?.[id] || 0;
  let level = 1;
  while (level < CHARACTER_MAX_LEVEL && copies >= copiesFor(level + 1)) level++;
  return level;
}
export const powerScale = level => 1 + POWER_STEP * (clamp(Math.floor(level) || 1, 1, CHARACTER_MAX_LEVEL) - 1);
// Opens one chest into the profile. Unowned prizes of the rolled rarity come first; a repeat
// of a character that can still level up adds a level step, any other repeat becomes stars.
export function openChest(profile, type, random = Math.random) {
  const rarity = rollRarity(type, random), pool = PRIZES.filter(p => p.rarity === rarity);
  const owned = p => p.type === 'skins' ? ownsCharacter(profile, p.id) : profile.trails.includes(p.id);
  const growing = p => p.type === 'skins' && levelsUp(p) && owned(p) && characterLevel(profile, p.id) < CHARACTER_MAX_LEVEL;
  const fresh = pool.filter(p => !owned(p)), repeats = pool.filter(growing);
  const options = fresh.length && !(repeats.length && random() < REPEAT_CHANCE) ? fresh : repeats.length ? repeats : pool;
  const prize = options[Math.floor(random() * options.length)];
  if (!owned(prize)) { profile[prize.type].push(prize.id); return { prize, rarity, duplicate: false, refund: 0 }; }
  if (growing(prize)) {
    const before = characterLevel(profile, prize.id);
    profile.copies = { ...profile.copies, [prize.id]: (profile.copies?.[prize.id] || 0) + 1 };
    const level = characterLevel(profile, prize.id);
    return { prize, rarity, duplicate: true, refund: 0, level, levelUp: level > before };
  }
  const refund = RARITIES[rarity].refund;
  profile.bits += refund;
  return { prize, rarity, duplicate: true, refund };
}
// Bots pick distinct characters; rarer ones show up less often.
const BOT_WEIGHTS = { comun: 40, raro: 30, epico: 18, legendario: 9, mitico: 3 };
export const SPAWNS = [[42, 36], [26, 24], [59, 24], [25, 51], [59, 51], [42, 14], [43, 60]];
export const MAX_PLAYERS = SPAWNS.length;
export class Arena {
  // Solo: the profile's character is actor 0 and everyone else is a bot.
  // Online: `options.humans` lists the connected players ({ skin, color, name }) that take
  // the first ids; bots fill the remaining spawns. `options.timeLimit` ends the match by time.
  constructor(profile = freshProfile(), random = Math.random, options = {}) {
    this.random = random;
    this.profile = profile;
    // Easy mode only softens the bots; the player's rules never change.
    this.easy = profile.easy === true;
    this.solo = !options.humans;
    this.timeLimit = options.timeLimit || 0;
    this.grid = new Int16Array(SIZE).fill(-1);
    this.trails = new Int16Array(SIZE).fill(-1);
    this.trailMasks = new Uint8Array(SIZE);
    this.wallRange = 40 / CELL_PIXELS;
    this.events = []; this.orbs = []; this.projectiles = []; this.time = 0; this.revision = 0; this.orbRevision = 0;
    this.ended = false; this.won = false; this.bits = 0; this.xp = 0; this.respawnAt = 0;
    const humans = (options.humans || [{ skin: profile.skin, color: TRAILS.find(t => t.id === profile.trail)?.color || COLORS[0], name: 'Tú', level: characterLevel(profile, profile.skin) }]).slice(0, MAX_PLAYERS);
    const cast = humans.map(h => characterFor(h.skin));
    for (let id = humans.length; id < SPAWNS.length; id++) cast.push(this.botCharacter(cast));
    // Every actor needs a distinct trail color; humans keep theirs unless it is already taken.
    const used = [];
    const pick = wanted => { const color = wanted && !used.includes(wanted) ? wanted : COLORS.find(c => !used.includes(c)); used.push(color); return color; };
    const colors = SPAWNS.map((_, id) => id < humans.length ? pick(humans[id].color) : null).map((color, id) => color || pick(COLORS[id]));
    this.actors = SPAWNS.map(([x, y], id) => ({
      id, human: id < humans.length, name: id < humans.length ? humans[id].name : cast[id].name, color: colors[id],
      x: x + .5, y: y + .5, angle: -Math.PI / 2, desired: -Math.PI / 2,
      alive: true, trail: [], count: 0, kills: 0, best: 0, bits: 0, xp: 0, lastCell: cell(x, y),
      timers: {}, ready: {}, aiAt: 0, route: [], skin: cast[id].id, rarity: cast[id].rarity, powers: [...cast[id].powers],
      stunUntil: 0, frozenUntil: 0, harvestUntil: 0, lastKiller: -1, wallSurge: false, wallSparkAt: 0,
      // Robots play at level 1; a human's character level stretches its powers.
      reach: powerScale(id < humans.length ? humans[id].level : 1)
    }));
    for (const actor of this.actors) { this.seed(actor); actor.best = actor.count; }
    for (let i = 0; i < 45; i++) this.spawnOrb();
  }
  // A weighted random character not in `taken`; easy mode only uses commons and rares.
  botCharacter(taken) {
    const pool = CHARACTERS.filter(c => !taken.includes(c) && (!this.easy || c.rarity === 'comun' || c.rarity === 'raro'));
    let roll = this.random() * pool.reduce((sum, c) => sum + BOT_WEIGHTS[c.rarity], 0);
    return pool.find(c => (roll -= BOT_WEIGHTS[c.rarity]) < 0) || pool.at(-1);
  }
  // Solo: when every robot is out, a few new ones appear in unpainted space, away from the
  // player, so the match can go on until the whole map is painted. They reuse the slots
  // of robots that are out. Without enough free space, nobody comes back.
  respawn() {
    const player = this.actors[0], spots = [];
    const free = (x, y, radius) => {
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const cx = x + dx, cy = y + dy, index = cy * WIDTH + cx;
        if (dx * dx + dy * dy > radius * radius) continue;
        if (cx < 0 || cy < 0 || cx >= WIDTH || cy >= HEIGHT || this.grid[index] !== -1 || this.trails[index] !== -1) return false;
      }
      return true;
    };
    for (let tries = 0; tries < 600 && spots.length < RESPAWN_BOTS; tries++) {
      const x = 5 + Math.floor(this.random() * (WIDTH - 10)), y = 5 + Math.floor(this.random() * (HEIGHT - 10));
      if (Math.hypot(x - player.x, y - player.y) < 12 || spots.some(s => Math.hypot(s.x - x, s.y - y) < 12)) continue;
      if (free(x, y, tries < 300 ? 5 : 4)) spots.push({ x, y });
    }
    const out = this.actors.filter(a => !a.human && !a.alive), taken = this.actors.filter(a => a.alive).map(a => characterFor(a.skin));
    spots.forEach((spot, i) => {
      const actor = out[i]; if (!actor) return;
      const character = this.botCharacter(taken), angle = this.random() * Math.PI * 2;
      taken.push(character);
      Object.assign(actor, {
        name: character.name, skin: character.id, rarity: character.rarity, powers: [...character.powers],
        x: spot.x + .5, y: spot.y + .5, angle, desired: angle, alive: true, trail: [], kills: 0, lastCell: cell(spot.x, spot.y),
        timers: {}, ready: {}, aiAt: 0, route: [], stunUntil: 0, frozenUntil: 0, harvestUntil: 0, wallSurge: false, reach: 1
      });
      this.seed(actor); actor.best = actor.count;
      this.emit('spawn', { id: actor.id, x: actor.x, y: actor.y });
    });
  }
  // Solo screens read the local player's best territory.
  get best() { return this.actors[0].best; }
  // A player who disconnects is handed over to the AI so the match stays fair.
  leave(id) { const actor = this.actors[id]; if (actor) { actor.human = false; actor.aiAt = 0; } }
  finish(winner, reason) {
    if (this.ended) return;
    // A solo victory (half the map) counts even if the player is caught afterwards.
    this.ended = true; this.won = winner === 0 || (this.solo && this.won);
    const ranking = [...this.actors].sort((a, b) => b.count - a.count || b.kills - a.kills).map(a => a.id);
    this.emit('end', { won: this.won, winner, reason, ranking });
  }
  seed(actor) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = Math.floor(actor.x) + dx, y = Math.floor(actor.y) + dy;
      if (dx * dx + dy * dy <= 15 && x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) this.assign(y * WIDTH + x, actor.id);
    }
    this.revision++;
  }
  assign(index, id) {
    const previous = this.grid[index];
    if (previous === id) return false;
    if (previous >= 0) this.actors[previous].count--;
    this.grid[index] = id;
    if (id >= 0) this.actors[id].count++;
    this.changes?.add(index);
    return true;
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  grant(actor, bits, xp, kills = 0) {
    actor.bits += bits; actor.xp += xp;
    if (actor.id === 0) { this.bits += bits; this.xp += xp; }
    this.emit('reward', { id: actor.id, bits, xp, kills });
  }
  reward(cells = 0, kills = 0, actor = this.actors[0]) {
    this.grant(actor, cells / SIZE * 100 * 18 + kills * 120, cells / SIZE * 100 * 30 + kills * 100, kills);
  }
  active(actor, skill) { return (actor.timers[skill] || 0) > this.time; }
  cooldown(actor, skill) { return POWERS[skill].cooldown * RARITIES[actor.rarity || 'comun'].cooldown; }
  // Only powers of the actor's own character can be used.
  ability(id, skill) {
    const actor = this.actors[id], definition = POWERS[skill];
    if (!actor?.alive || !definition || this.ended || (actor.ready[skill] || 0) > this.time) return false;
    if (!actor.powers?.includes(skill)) return false;
    const reach = actor.reach || 1;
    actor.timers[skill] = this.time + definition.duration * (skill === 'dash' || skill === 'shield' || skill === 'ghost' ? reach : 1);
    actor.ready[skill] = this.time + this.cooldown(actor, skill);
    this.emit('ability', { id, skill, x: actor.x, y: actor.y });
    if (skill === 'shoot') this.projectiles.push({ owner: id, x: clamp(actor.x + Math.cos(actor.angle) * .9, .01, WIDTH - .01), y: clamp(actor.y + Math.sin(actor.angle) * .9, .01, HEIGHT - .01), angle: actor.angle, life: SHOT_LIFE * reach, paint: SHOT_PAINT * reach });
    if (skill === 'bomb') this.splash(actor, cell(actor.x, actor.y), 3.6 * reach, 'bomb');
    if (skill === 'freeze') {
      for (const other of this.actors) if (other !== actor && other.alive && !this.active(other, 'shield') && Math.hypot(other.x - actor.x, other.y - actor.y) < 8 * reach) {
        other.stunUntil = other.frozenUntil = this.time + FREEZE_TIME;
      }
      this.emit('freeze', { id, x: actor.x, y: actor.y });
    }
    return true;
  }
  // Claims a disc of cells directly (Rodillo brush and Bomba). An exposed trail
  // touching the new cells closes immediately, just like returning home.
  splash(actor, index, radius, kind = 'brush') {
    const cx = index % WIDTH, cy = Math.floor(index / WIDTH), reach = Math.ceil(radius), gained = [];
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const x = cx + dx, y = cy + dy;
      if (dx * dx + dy * dy <= radius * radius && x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && this.assign(y * WIDTH + x, actor.id)) gained.push(y * WIDTH + x);
    }
    if (!gained.length) return 0;
    this.revision++;
    if (kind === 'bomb') this.emit('bomb', { id: actor.id, x: actor.x, y: actor.y, cells: gained.length });
    if (actor.human) this.reward(gained.length, 0, actor);
    if (actor.trail.length) this.capture(actor); else this.checkWin();
    return gained.length;
  }
  clearTrail(actor) {
    for (const index of actor.trail) {
      this.trailMasks[index] &= ~(1 << actor.id);
      if (this.trails[index] === actor.id) {
        this.trails[index] = -1;
        for (let id = 0; id < this.actors.length; id++) if (this.trailMasks[index] & (1 << id)) this.trails[index] = id;
      }
    }
    actor.trail = [];
  }
  capture(actor) {
    if (!actor.trail.length) return 0;
    // Walls = existing territory + this trail. Flood from every arena edge.
    // Unreachable non-wall cells are enclosed; other players never act as walls.
    const blocked = new Uint8Array(SIZE), outside = new Uint8Array(SIZE), queue = new Int32Array(SIZE);
    for (let i = 0; i < SIZE; i++) if (this.grid[i] === actor.id) blocked[i] = 1;
    for (const index of actor.trail) blocked[index] = 1;
    let head = 0, tail = 0;
    const enqueue = index => { if (!blocked[index] && !outside[index]) { outside[index] = 1; queue[tail++] = index; } };
    for (let x = 0; x < WIDTH; x++) { enqueue(x); enqueue((HEIGHT - 1) * WIDTH + x); }
    for (let y = 0; y < HEIGHT; y++) { enqueue(y * WIDTH); enqueue(y * WIDTH + WIDTH - 1); }
    while (head < tail) {
      const index = queue[head++], x = index % WIDTH, y = Math.floor(index / WIDTH);
      if (x) enqueue(index - 1); if (x < WIDTH - 1) enqueue(index + 1);
      if (y) enqueue(index - WIDTH); if (y < HEIGHT - 1) enqueue(index + WIDTH);
    }
    const gained = [];
    for (let i = 0; i < SIZE; i++) if ((blocked[i] || !outside[i]) && this.assign(i, actor.id)) gained.push(i);
    // Orbs provide a temporary capture amplifier: a one-cell border on this closure.
    if (actor.harvestUntil > this.time) {
      const bonus = new Set();
      for (const index of gained) {
        if (index % WIDTH) bonus.add(index - 1);
        if (index % WIDTH < WIDTH - 1) bonus.add(index + 1);
        if (index >= WIDTH) bonus.add(index - WIDTH);
        if (index < SIZE - WIDTH) bonus.add(index + WIDTH);
      }
      for (const index of bonus) if (this.assign(index, actor.id)) gained.push(index);
    }
    this.clearTrail(actor); this.revision++;
    this.emit('capture', { id: actor.id, cells: gained.length, x: actor.x, y: actor.y });
    if (actor.human) this.reward(gained.length, 0, actor);
    this.checkWin();
    return gained.length;
  }
  kill(victim, killer = null, reason = '¡Te atraparon!', cutIndex = -1) {
    if (!victim.alive) return;
    const brokenTrail = [...victim.trail];
    victim.alive = false;
    this.clearTrail(victim);
    const land = [];
    for (let i = 0; i < SIZE; i++) if (this.grid[i] === victim.id) land.push(i);
    const stolen = killer?.alive ? Math.floor(land.length * .25) : 0;
    if (killer) land.sort((a, b) => {
      const pa = coords(a), pb = coords(b);
      return Math.hypot(pa.x - killer.x, pa.y - killer.y) - Math.hypot(pb.x - killer.x, pb.y - killer.y);
    });
    for (let i = 0; i < land.length; i++) this.assign(land[i], i < stolen ? killer.id : -1);
    if (killer?.alive) {
      killer.kills++;
      if (killer.human) this.reward(stolen, 1, killer);
      this.emit('fragments', { from: { x: victim.x, y: victim.y }, to: { x: killer.x, y: killer.y }, cells: stolen, color: killer.color });
    }
    const revenge = killer && killer.lastKiller === victim.id;
    victim.lastKiller = killer?.id ?? -1;
    this.emit('death', { id: victim.id, killer: killer?.id ?? -1, x: victim.x, y: victim.y, reason, revenge, trail: brokenTrail, cutIndex });
    this.revision++;
    if (victim.human) {
      if (this.solo) this.finish(-1, reason);
      else { this.emit('out', { id: victim.id, reason }); if (!this.actors.some(a => a.human && a.alive)) this.finish(-1, '¡Atraparon a todos los jugadores!'); }
    } else if (this.solo && !this.respawnAt && !this.actors.some(a => !a.human && a.alive)) this.respawnAt = this.time + RESPAWN_DELAY;
    this.checkWin();
  }
  // Solo: more than half the map is a victory, but the match goes on until the whole map
  // is painted or the player is caught. Online: more than half ends the match.
  checkWin() {
    for (const actor of this.actors) if (actor.human) {
      actor.best = Math.max(actor.best, actor.count);
      if (this.ended) continue;
      if (!this.solo) { if (actor.count / SIZE > .5) this.finish(actor.id, `¡${actor.name} pintó más de la mitad del mapa!`); continue; }
      if (!this.won && actor.count / SIZE > .5) { this.won = true; this.emit('victory', { id: actor.id }); }
      if (actor.count >= SIZE) this.finish(actor.id, '¡Pintaste todo el mapa!');
    }
  }
  visit(actor, index) {
    if (!actor.alive || index === actor.lastCell) return;
    actor.lastCell = index;
    // Rodillo: paint a 3×3 brush directly instead of leaving an exposed trail.
    if (this.active(actor, 'paint') && this.grid[index] !== actor.id) { this.splash(actor, index, 1.5 * (actor.reach || 1)); return; }
    // Self-crossings are harmless. Masks allow overlapping trails without erasing rivals.
    if (this.grid[index] === actor.id) { if (actor.trail.length) this.capture(actor); }
    else {
      this.trailMasks[index] |= 1 << actor.id;
      this.trails[index] = actor.id; actor.trail.push(index);
    }
  }
  cutAtTip(actor, from, to) {
    const indices = new Set([cell(from.x, from.y), ...crossedCells(from.x, from.y, to.x, to.y), cell(to.x, to.y)]);
    for (const index of indices) {
      if (index < 0 || index >= SIZE) continue;
      const mask = this.trailMasks[index] || (this.trails[index] >= 0 ? 1 << this.trails[index] : 0);
      for (const victim of this.actors) {
        if (victim.id === actor.id || !victim.alive || !(mask & (1 << victim.id))) continue;
        // The short attachment under an overlapping bike is body contact, not an
        // exposed trail cut. Bikes can pass through each other without a death.
        if (Math.hypot(actor.x - victim.x, actor.y - victim.y) < 1.55) continue;
        if (this.active(victim, 'shield')) {
          // Repulsion changes the desired heading, never teleports or snaps the bike.
          actor.desired = actor.angle + Math.PI / 2; actor.stunUntil = this.time + .25;
          actor.repelledAt = this.time;
          this.emit('repel', { x: actor.x, y: actor.y, id: actor.id }); return;
        }
        this.kill(victim, actor, 'Alguien tocó tu camino de pintura.', index);
        if (this.ended) return;
      }
    }
  }
  edgeDistance(actor) {
    return Math.min(actor.x, actor.y, WIDTH - actor.x, HEIGHT - actor.y);
  }
  speed(actor) {
    return (actor.id ? this.easy ? 3.4 : 4.2 : 4.8) * (this.active(actor, 'dash') ? 1.6 : 1) * (actor.wallSurge ? 1.35 : 1);
  }
  spawnOrb() { this.orbRevision++; this.orbs.push({ x: 3 + this.random() * (WIDTH - 6), y: 3 + this.random() * (HEIGHT - 6), phase: this.random() * 6.28 }); }
  ai(actor) {
    if (this.time < actor.aiAt) return;
    actor.aiAt = this.time + .18 + this.random() * .15;
    let prey = null, best = this.easy ? 4 : 7;
    if (actor.trail.length < 18) for (const enemy of this.actors) {
      if (!enemy.alive || enemy.id === actor.id || this.active(enemy, 'shield')) continue;
      const visible = this.active(enemy, 'ghost') ? enemy.trail.slice(0, Math.floor(enemy.trail.length / 2)) : enemy.trail;
      for (let i = 0; i < visible.length; i += 2) {
        const p = coords(visible[i]), distance = Math.hypot(p.x - actor.x, p.y - actor.y);
        if (distance < best) { prey = p; best = distance; }
      }
    }
    if (prey) {
      actor.desired = Math.atan2(prey.y - actor.y, prey.x - actor.x);
      this.botPowers(actor, best);
      return;
    }
    if (!actor.route.length) {
      const x = actor.x, y = actor.y, dx = (this.random() > .5 ? 1 : -1) * (5 + this.random() * 7), dy = (this.random() > .5 ? 1 : -1) * (5 + this.random() * 7);
      actor.route = [{ x: clamp(x + dx, 3, WIDTH - 3), y }, { x: clamp(x + dx, 3, WIDTH - 3), y: clamp(y + dy, 3, HEIGHT - 3) }, { x, y: clamp(y + dy, 3, HEIGHT - 3) }, { x, y }];
    }
    while (actor.route.length && Math.hypot(actor.route[0].x - actor.x, actor.route[0].y - actor.y) < 1.1) actor.route.shift();
    const target = actor.route[0];
    if (target) actor.desired = Math.atan2(target.y - actor.y, target.x - actor.x);
    this.botPowers(actor, Infinity);
    // Avoid the outer wall even while chasing.
    if (actor.x < 2 || actor.y < 2 || actor.x > WIDTH - 2 || actor.y > HEIGHT - 2) actor.desired = Math.atan2(HEIGHT / 2 - actor.y, WIDTH / 2 - actor.x);
  }
  // Bots use their own character's powers in simple, readable situations.
  // In easy mode they hesitate more and never shoot or freeze.
  botPowers(actor, preyDistance) {
    if (!actor.powers.length || this.random() > (this.easy ? .2 : .5)) return;
    const near = range => this.actors.some(other => other.id !== actor.id && other.alive && Math.hypot(other.x - actor.x, other.y - actor.y) < range);
    for (const power of actor.powers) {
      if (this.easy && (power === 'shoot' || power === 'freeze')) continue;
      const use = power === 'dash' ? preyDistance < 5
        : power === 'shoot' ? preyDistance < 9
        : power === 'shield' ? actor.trail.length > 8 && near(4)
        : power === 'ghost' ? actor.trail.length > 10
        : power === 'paint' || power === 'bomb' ? actor.trail.length > 10
        : power === 'freeze' ? actor.trail.length > 4 && near(6)
        : power === 'magnet' ? this.orbs.some(orb => Math.hypot(orb.x - actor.x, orb.y - actor.y) < 8) : false;
      if (use) this.ability(actor.id, power);
    }
  }
  // Paint shots fly straight; touching a rival's exposed trail catches its owner,
  // touching a rival's body only stuns it briefly. Shields block shots. Wherever a shot
  // ends, it paints a small disc for its owner.
  moveShots(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i], owner = this.actors[shot.owner];
      const nx = shot.x + Math.cos(shot.angle) * SHOT_SPEED * dt, ny = shot.y + Math.sin(shot.angle) * SHOT_SPEED * dt;
      shot.life -= dt;
      let done = !owner.alive || shot.life <= 0 || nx <= 0 || ny <= 0 || nx >= WIDTH || ny >= HEIGHT;
      if (!done) for (const index of [cell(shot.x, shot.y), ...crossedCells(shot.x, shot.y, nx, ny)]) {
        const mask = this.trailMasks[index];
        const victim = mask && this.actors.find(a => a.id !== owner.id && a.alive && mask & (1 << a.id));
        if (!victim) continue;
        done = true;
        if (this.active(victim, 'shield')) this.emit('repel', { x: nx, y: ny, id: owner.id });
        else this.kill(victim, owner, 'Una bola de pintura tocó tu camino.', index);
        break;
      }
      if (!done && !this.ended) {
        const body = this.actors.find(a => a.id !== owner.id && a.alive && Math.hypot(a.x - nx, a.y - ny) < .9);
        if (body) { done = true; if (!this.active(body, 'shield')) body.stunUntil = Math.max(body.stunUntil, this.time + .6); }
      }
      shot.x = nx; shot.y = ny;
      if (done) {
        const x = clamp(nx, .01, WIDTH - .01), y = clamp(ny, .01, HEIGHT - .01);
        this.projectiles.splice(i, 1); this.emit('splat', { x, y, color: owner.color });
        if (owner.alive && !this.ended) this.splash(owner, cell(x, y), shot.paint || SHOT_PAINT, 'shot');
      }
      if (this.ended) return;
    }
  }
  step(dt) {
    if (this.ended) return;
    this.time += dt;
    if (this.timeLimit && this.time >= this.timeLimit) { this.finish(this.actors.reduce((a, b) => b.count > a.count ? b : a).id, '¡Se acabó el tiempo!'); return; }
    if (this.respawnAt && this.time >= this.respawnAt) { this.respawnAt = 0; this.respawn(); }
    for (const actor of this.actors) {
      if (!actor.alive) continue;
      if (!actor.human) this.ai(actor);
      if (actor.stunUntil > this.time) continue;
      if ((actor.x <= .7 && Math.cos(actor.desired) < 0) || (actor.x >= WIDTH - .7 && Math.cos(actor.desired) > 0)) actor.desired = Math.sin(actor.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2;
      if ((actor.y <= .7 && Math.sin(actor.desired) < 0) || (actor.y >= HEIGHT - .7 && Math.sin(actor.desired) > 0)) actor.desired = Math.cos(actor.angle) >= 0 ? 0 : Math.PI;
      const difference = Math.atan2(Math.sin(actor.desired - actor.angle), Math.cos(actor.desired - actor.angle));
      const oldAngle = actor.angle;
      actor.angle += clamp(difference, -dt * 6, dt * 6); // 0.1 rad/frame at 60 fps.
      actor.wallSurge = this.edgeDistance(actor) < this.wallRange;
      const speed = this.speed(actor);
      const previousX = actor.x, previousY = actor.y;
      actor.x = clamp(actor.x + Math.cos(actor.angle) * speed * dt, .65, WIDTH - .65);
      actor.y = clamp(actor.y + Math.sin(actor.angle) * speed * dt, .65, HEIGHT - .65);
      if (actor.x <= .65 || actor.x >= WIDTH - .65) actor.desired = Math.sin(actor.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2;
      if (actor.y <= .65 || actor.y >= HEIGHT - .65) actor.desired = Math.cos(actor.angle) >= 0 ? 0 : Math.PI;
      if (actor.wallSurge && this.time >= actor.wallSparkAt) {
        actor.wallSparkAt = this.time + .075;
        const distances = [actor.x, WIDTH - actor.x, actor.y, HEIGHT - actor.y];
        const edge = distances.indexOf(Math.min(...distances));
        this.emit('wall', { id: actor.id, x: edge === 0 ? 0 : edge === 1 ? WIDTH : actor.x, y: edge === 2 ? 0 : edge === 3 ? HEIGHT : actor.y });
      }
      const tip = (x, y, angle) => ({ x: clamp(x + Math.cos(angle) * .85, .01, WIDTH - .01), y: clamp(y + Math.sin(angle) * .85, .01, HEIGHT - .01) });
      this.cutAtTip(actor, tip(previousX, previousY, oldAngle), tip(actor.x, actor.y, actor.angle));
      if (!actor.alive || this.ended || actor.repelledAt === this.time) continue;
      for (const index of crossedCells(previousX, previousY, actor.x, actor.y)) {
        this.visit(actor, index);
        if (!actor.alive || this.ended || actor.repelledAt === this.time) break;
      }
      if (!actor.alive || this.ended) continue;
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const orb = this.orbs[i], distance = Math.hypot(orb.x - actor.x, orb.y - actor.y);
        if (this.active(actor, 'magnet') && distance < 14 * (actor.reach || 1)) {
          const move = Math.min(distance, dt * 12);
          orb.x += (actor.x - orb.x) / (distance || 1) * move; this.orbRevision++;
          orb.y += (actor.y - orb.y) / (distance || 1) * move;
        }
        if (distance < .85) {
          this.orbs.splice(i, 1); this.orbRevision++; actor.harvestUntil = this.time + 10;
          this.emit('orb', { id: actor.id, x: orb.x, y: orb.y });
          if (actor.human) this.grant(actor, 4, 2);
        }
      }
    }
    if (!this.ended) this.moveShots(dt);
    if (this.orbs.length < 45 && this.random() < dt * 3) this.spawnOrb();
  }
}

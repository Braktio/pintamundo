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
  shoot: { name: 'Disparo', icon: '🎯', duration: 0, cooldown: 8, description: 'Lanza una bola de pintura. Si toca el camino de un rival, ¡lo atrapa!' },
  paint: { name: 'Rodillo', icon: '🖌️', duration: 3, cooldown: 18, description: 'Durante 3 segundos pintas tu zona por donde pasas, sin volver a casa.' },
  bomb: { name: 'Bomba de color', icon: '💥', duration: 0, cooldown: 22, description: 'Pinta de golpe un gran círculo a tu alrededor.' },
  freeze: { name: 'Congelar', icon: '❄️', duration: 0, cooldown: 20, description: 'Congela un momento a los rivales que estén cerca.' }
};
export const FREEZE_TIME = 1.6, SHOT_SPEED = 18, SHOT_LIFE = .8;
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
  return { version: 1, bits: 0, xp: 0, wins: 0, totalKills: 0, best: 0, nemesis: '', skin: 'interceptor', trail: 'cyan', skins: [], trails: ['cyan'], easy: false, chests: { ...emptyChests(), raro: 1 }, freeChestAt: 0 };
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
  return { ...result, easy: data.easy === true, nemesis: typeof data.nemesis === 'string' ? data.nemesis.slice(0, 40) : '', skin: data.skin, trail: data.trail };
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
// Opens one chest into the profile. Unowned prizes of the rolled rarity are preferred,
// so children rarely get repeats; a repeat is converted into stars.
export function openChest(profile, type, random = Math.random) {
  const rarity = rollRarity(type, random), pool = PRIZES.filter(p => p.rarity === rarity);
  const fresh = pool.filter(p => p.type === 'skins' ? !ownsCharacter(profile, p.id) : !profile.trails.includes(p.id));
  const options = fresh.length ? fresh : pool, prize = options[Math.floor(random() * options.length)];
  const duplicate = !fresh.length, refund = duplicate ? RARITIES[rarity].refund : 0;
  if (duplicate) profile.bits += refund; else profile[prize.type].push(prize.id);
  return { prize, rarity, duplicate, refund };
}
// Bots pick distinct characters; rarer ones show up less often.
const BOT_WEIGHTS = { comun: 40, raro: 30, epico: 18, legendario: 9, mitico: 3 };
export class Arena {
  constructor(profile = freshProfile(), random = Math.random) {
    this.random = random;
    this.profile = profile;
    // Easy mode only softens the bots; the player's rules never change.
    this.easy = profile.easy === true;
    this.grid = new Int16Array(SIZE).fill(-1);
    this.trails = new Int16Array(SIZE).fill(-1);
    this.trailMasks = new Uint8Array(SIZE);
    this.wallRange = 40 / CELL_PIXELS;
    this.events = []; this.orbs = []; this.projectiles = []; this.time = 0; this.revision = 0;
    this.ended = false; this.won = false; this.bits = 0; this.xp = 0;
    const spawns = [[42, 36], [26, 24], [59, 24], [25, 51], [59, 51], [42, 14], [43, 60]];
    const cast = [characterFor(profile.skin)];
    for (let id = 1; id < spawns.length; id++) {
      const pool = CHARACTERS.filter(c => !cast.includes(c) && (!this.easy || c.rarity === 'comun' || c.rarity === 'raro'));
      let roll = this.random() * pool.reduce((sum, c) => sum + BOT_WEIGHTS[c.rarity], 0);
      cast.push(pool.find(c => (roll -= BOT_WEIGHTS[c.rarity]) < 0) || pool.at(-1));
    }
    this.actors = spawns.map(([x, y], id) => ({
      id, name: id === 0 ? 'Tú' : cast[id].name, color: id ? COLORS[id] : TRAILS.find(t => t.id === profile.trail)?.color || COLORS[0],
      x: x + .5, y: y + .5, angle: -Math.PI / 2, desired: -Math.PI / 2,
      alive: true, trail: [], count: 0, kills: 0, lastCell: cell(x, y),
      timers: {}, ready: {}, aiAt: 0, route: [], skin: cast[id].id, rarity: cast[id].rarity, powers: [...cast[id].powers],
      stunUntil: 0, frozenUntil: 0, harvestUntil: 0, lastKiller: -1, wallSurge: false, wallSparkAt: 0
    }));
    for (const actor of this.actors) this.seed(actor);
    this.best = this.actors[0].count;
    for (let i = 0; i < 45; i++) this.spawnOrb();
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
    return true;
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  reward(cells = 0, kills = 0) {
    const bits = cells / SIZE * 100 * 18 + kills * 120;
    const xp = cells / SIZE * 100 * 30 + kills * 100;
    this.bits += bits; this.xp += xp;
    this.emit('reward', { bits, xp, kills });
  }
  active(actor, skill) { return (actor.timers[skill] || 0) > this.time; }
  cooldown(actor, skill) { return POWERS[skill].cooldown * RARITIES[actor.rarity || 'comun'].cooldown; }
  // Only powers of the actor's own character can be used.
  ability(id, skill) {
    const actor = this.actors[id], definition = POWERS[skill];
    if (!actor?.alive || !definition || this.ended || (actor.ready[skill] || 0) > this.time) return false;
    if (!actor.powers?.includes(skill)) return false;
    actor.timers[skill] = this.time + definition.duration;
    actor.ready[skill] = this.time + this.cooldown(actor, skill);
    this.emit('ability', { id, skill, x: actor.x, y: actor.y });
    if (skill === 'shoot') this.projectiles.push({ owner: id, x: clamp(actor.x + Math.cos(actor.angle) * .9, .01, WIDTH - .01), y: clamp(actor.y + Math.sin(actor.angle) * .9, .01, HEIGHT - .01), angle: actor.angle, life: SHOT_LIFE });
    if (skill === 'bomb') this.splash(actor, cell(actor.x, actor.y), 3.6, 'bomb');
    if (skill === 'freeze') {
      for (const other of this.actors) if (other !== actor && other.alive && !this.active(other, 'shield') && Math.hypot(other.x - actor.x, other.y - actor.y) < 8) {
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
    if (actor.id === 0) this.reward(gained.length);
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
    if (actor.id === 0) this.reward(gained.length);
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
      if (killer.id === 0) this.reward(stolen, 1);
      this.emit('fragments', { from: { x: victim.x, y: victim.y }, to: { x: killer.x, y: killer.y }, cells: stolen, color: killer.color });
    }
    const revenge = killer && killer.lastKiller === victim.id;
    victim.lastKiller = killer?.id ?? -1;
    this.emit('death', { id: victim.id, killer: killer?.id ?? -1, x: victim.x, y: victim.y, reason, revenge, trail: brokenTrail, cutIndex });
    this.revision++;
    if (victim.id === 0) { this.ended = true; this.emit('end', { won: false, reason }); }
    this.checkWin();
  }
  checkWin() {
    this.best = Math.max(this.best || 0, this.actors[0].count);
    if (!this.ended && this.actors[0].count / SIZE > .5) { this.ended = this.won = true; this.emit('end', { won: true, reason: '¡Pintaste más de la mitad del mapa!' }); }
  }
  visit(actor, index) {
    if (!actor.alive || index === actor.lastCell) return;
    actor.lastCell = index;
    // Rodillo: paint a 3×3 brush directly instead of leaving an exposed trail.
    if (this.active(actor, 'paint') && this.grid[index] !== actor.id) { this.splash(actor, index, 1.5); return; }
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
  spawnOrb() { this.orbs.push({ x: 3 + this.random() * (WIDTH - 6), y: 3 + this.random() * (HEIGHT - 6), phase: this.random() * 6.28 }); }
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
  // touching a rival's body only stuns it briefly. Shields block shots.
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
      if (done) { this.projectiles.splice(i, 1); this.emit('splat', { x: clamp(nx, 0, WIDTH), y: clamp(ny, 0, HEIGHT), color: owner.color }); }
      if (this.ended) return;
    }
  }
  step(dt) {
    if (this.ended) return;
    this.time += dt;
    for (const actor of this.actors) {
      if (!actor.alive) continue;
      if (actor.id) this.ai(actor);
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
        if (this.active(actor, 'magnet') && distance < 14) {
          const move = Math.min(distance, dt * 12);
          orb.x += (actor.x - orb.x) / (distance || 1) * move;
          orb.y += (actor.y - orb.y) / (distance || 1) * move;
        }
        if (distance < .85) {
          this.orbs.splice(i, 1); actor.harvestUntil = this.time + 10;
          this.emit('orb', { id: actor.id, x: orb.x, y: orb.y });
          if (actor.id === 0) { this.bits += 4; this.xp += 2; this.emit('reward', { bits: 4, xp: 2, kills: 0 }); }
        }
      }
    }
    if (!this.ended) this.moveShots(dt);
    if (this.orbs.length < 45 && this.random() < dt * 3) this.spawnOrb();
  }
}

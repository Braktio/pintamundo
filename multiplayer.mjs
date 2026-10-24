// Authoritative online rooms. The server runs the same engine as solo games and
// streams compact deltas; phones only send their heading and power presses.
import { Arena, MAX_PLAYERS, CHARACTERS, TRAILS, COLORS, CHARACTER_MAX_LEVEL, SIZE, freshProfile, cleanName, matchStars } from './engine.js';

export const STEP = 1 / 90;
// 30 updates per second keep online movement smooth on phones.
const DEFAULTS = { tickMs: 33, matchSeconds: 180, quickWait: 10, maxRooms: 200 };
// Kid-friendly room codes such as GATO-42 (no Ñ or accents, easy to type).
const WORDS = ['GATO', 'PATO', 'SAPO', 'LUNA', 'NUBE', 'OSO', 'PEZ', 'SOL', 'RANA', 'MONO', 'LEON', 'COCO', 'KIWI', 'FOCA', 'PUMA', 'ROSA', 'MAGO', 'FARO'];
// Bits of the per-actor flag field in state messages.
export const FLAG_POWERS = ['dash', 'shield', 'ghost', 'paint', 'magnet'];
export const FROZEN = 32, WALL = 64, HUMAN = 128;
// Number of quick emotes the phones can show (EMOTES in game.js).
export const EMOTES = 6;
const validSkin = id => CHARACTERS.some(c => c.id === id) ? id : CHARACTERS[0].id;
// The phone reports its character's level (1–10); anything else counts as level 1.
const validLevel = level => Number.isInteger(level) && level >= 1 && level <= CHARACTER_MAX_LEVEL ? level : 1;
const validColor = color => [...TRAILS.map(t => t.color), ...COLORS].includes(color) ? color : COLORS[0];
const normalizeCode = code => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
// Players are shown with their nickname, or their character's name if they have none.
function uniqueNames(members) {
  const seen = {};
  return members.map(m => {
    const base = m.name || CHARACTERS.find(c => c.id === m.skin).name;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] > 1 ? `${base} ${seen[base]}` : base;
  });
}
// Run-length encoding of the ownership grid: [owner, length, owner, length, ...].
export function encodeGrid(grid) {
  const runs = [];
  for (let i = 0; i < grid.length;) { let end = i + 1; while (end < grid.length && grid[end] === grid[i]) end++; runs.push(grid[i], end - i); i = end; }
  return runs;
}
const flagsOf = (arena, actor) => FLAG_POWERS.reduce((bits, power, i) => bits | (arena.active(actor, power) ? 1 << i : 0), 0)
  | (actor.frozenUntil > arena.time ? FROZEN : 0) | (actor.wallSurge ? WALL : 0) | (actor.human ? HUMAN : 0);

class Room {
  constructor(hub, code, isPrivate) {
    Object.assign(this, { hub, code, isPrivate, members: [], host: null, state: 'lobby', startsAt: 0, lastSecond: -1 });
    this.timer = setInterval(() => this.tick(), hub.options.tickMs);
  }
  get label() { return this.code.slice(0, -2) + '-' + this.code.slice(-2); }
  add(client) {
    if (this.state !== 'lobby' || this.members.length >= MAX_PLAYERS) { this.hub.send(client, { t: 'error', message: 'Esa sala ya está llena o jugando. ¡Prueba otra!' }); return false; }
    this.members.push(client); client.room = this; this.host ??= client;
    if (!this.isPrivate) {
      const now = Date.now();
      // Late arrivals get a few seconds to see the room before it starts.
      const wait = this.hub.options.quickWait * 1000;
      this.startsAt = this.members.length === 1 ? now + wait : Math.max(this.startsAt, now + Math.min(3000, wait));
      if (this.members.length >= MAX_PLAYERS) this.startsAt = now;
    }
    this.broadcastLobby();
    return true;
  }
  remove(client) {
    const index = this.members.indexOf(client); if (index < 0) return;
    this.members.splice(index, 1); client.room = null;
    if (this.state === 'playing' && this.ids.has(client)) { this.arena.leave(this.ids.get(client)); this.ids.delete(client); }
    if (this.host === client) this.host = this.members[0] || null;
    if (!this.members.length) this.close();
    else if (this.state === 'lobby') this.broadcastLobby();
  }
  close() { clearInterval(this.timer); this.state = 'closed'; this.hub.rooms.delete(this.code); }
  broadcastLobby() {
    const names = uniqueNames(this.members), startsIn = this.isPrivate ? null : Math.max(0, Math.ceil((this.startsAt - Date.now()) / 1000));
    for (const client of this.members) this.hub.send(client, {
      t: 'lobby', code: this.label, private: this.isPrivate, host: client === this.host, startsIn, max: MAX_PLAYERS,
      players: this.members.map((m, i) => ({ name: names[i], skin: m.skin, color: m.color, you: m === client, host: m === this.host }))
    });
  }
  begin() {
    if (this.state !== 'lobby' || !this.members.length) return;
    const names = uniqueNames(this.members), profile = freshProfile();
    profile.easy = this.host?.easy === true;
    const arena = this.arena = new Arena(profile, Math.random, { humans: this.members.map((m, i) => ({ skin: m.skin, color: m.color, name: names[i], level: m.level })), timeLimit: this.hub.options.matchSeconds });
    arena.changes = new Set();
    this.ids = new Map(this.members.map((m, i) => [m, i]));
    this.sent = arena.actors.map(() => ({ length: 0, first: -1 }));
    this.sentOrbs = arena.orbRevision; this.last = Date.now(); this.accumulator = 0; this.state = 'playing';
    const start = {
      t: 'start', timeLimit: arena.timeLimit, easy: arena.easy, grid: encodeGrid(arena.grid), orbs: this.orbs(),
      actors: arena.actors.map(a => ({ id: a.id, name: a.name, color: a.color, skin: a.skin, human: a.human }))
    };
    for (const client of this.members) this.hub.send(client, { ...start, you: this.ids.get(client) });
    arena.changes.clear(); arena.events = [];
  }
  orbs() { return this.arena.orbs.flatMap(o => [Math.round(o.x * 10), Math.round(o.y * 10)]); }
  tick() {
    const now = Date.now();
    if (this.state === 'lobby') {
      if (this.isPrivate || !this.members.length) return;
      if (now >= this.startsAt) this.begin();
      else if (Math.floor(now / 1000) !== this.lastSecond) { this.lastSecond = Math.floor(now / 1000); this.broadcastLobby(); }
      return;
    }
    if (this.state !== 'playing') return;
    // Fixed 90 Hz steps, like the solo game, regardless of timer jitter.
    this.accumulator = Math.min(this.accumulator + (now - this.last) / 1000, .25); this.last = now;
    while (this.accumulator >= STEP && !this.arena.ended) { this.arena.step(STEP); this.accumulator -= STEP; }
    this.broadcastState();
    if (this.arena.ended) this.finish();
  }
  broadcastState() {
    const arena = this.arena, cells = [], trails = [];
    for (const index of arena.changes) cells.push(index, arena.grid[index]);
    arena.changes.clear();
    // Trails only grow until they are closed or cut, so usually only the new cells are sent.
    arena.actors.forEach((actor, id) => {
      const sent = this.sent[id], length = actor.trail.length, first = length ? actor.trail[0] : -1;
      if (length === sent.length && first === sent.first) return;
      trails.push(length >= sent.length && first === sent.first ? [id, sent.length, ...actor.trail.slice(sent.length)] : [id, 0, ...actor.trail]);
      Object.assign(sent, { length, first });
    });
    const shared = {
      t: 'state', time: Math.round(arena.time * 100) / 100, c: cells, tr: trails,
      a: arena.actors.map(a => [a.id, Math.round(a.x * 100), Math.round(a.y * 100), Math.round(a.angle * 1000), a.alive ? 1 : 0, flagsOf(arena, a), a.count, a.kills]),
      p: arena.projectiles.flatMap(s => [s.owner, Math.round(s.x * 100), Math.round(s.y * 100), Math.round(s.angle * 1000)]),
      e: arena.events.splice(0).filter(e => e.type !== 'wall')
    };
    if (arena.orbRevision !== this.sentOrbs) { shared.o = this.orbs(); this.sentOrbs = arena.orbRevision; }
    // One shared body plus a tiny personal part: the remaining cooldown of your own powers.
    const body = JSON.stringify(shared).slice(0, -1);
    for (const [client, id] of this.ids) {
      const actor = arena.actors[id], ready = {};
      for (const power of actor.powers) ready[power] = Math.max(0, Math.round(((actor.ready[power] || 0) - arena.time) * 10) / 10);
      this.hub.sendRaw(client, body + ',"me":' + JSON.stringify(ready) + '}');
    }
  }
  // Ranked results of a finished match, one per connected player signed in with Google:
  // the same stars as on the phone, catches, whether the map was full and the final place.
  // In private rooms each player also learns who else played (they become friends).
  results() {
    const arena = this.arena, order = [...arena.actors].sort((a, b) => b.count - a.count || b.kills - a.kills).map(a => a.id);
    const signed = [...this.ids].filter(([client]) => client.uid);
    return signed.map(([client, id]) => {
      const actor = arena.actors[id], percent = actor.best / SIZE * 100;
      return {
        client, uid: client.uid, name: cleanName(client.name) || actor.name.slice(0, 14), skin: client.skin,
        stars: matchStars({ won: arena.winner === id, percent, kills: actor.kills }), kills: actor.kills, perfect: actor.best >= SIZE,
        place: order.indexOf(id) + 1, players: order.length,
        friends: this.isPrivate ? signed.filter(([other]) => other !== client).map(([other, i]) => ({ uid: other.uid, name: cleanName(other.name) || arena.actors[i].name.slice(0, 14) })) : []
      };
    });
  }
  finish() {
    const results = this.results();
    if (results.length) this.hub.options.onResult?.(results);
    // Private rooms go back to their lobby so friends can play again; quick rooms close.
    this.arena = null; this.ids = new Map();
    if (this.isPrivate) { this.state = 'lobby'; setTimeout(() => { if (this.state === 'lobby') this.broadcastLobby(); }, 1200); }
    else { for (const client of this.members) client.room = null; this.members = []; this.close(); }
  }
  input(client, angle) {
    const id = this.ids?.get(client), actor = id === undefined ? null : this.arena?.actors[id];
    if (actor?.alive && actor.human && Number.isFinite(angle)) actor.desired = angle;
  }
  // Quick emotes (no chat): a number from a fixed list, at most one every 1.5 s per player.
  emote(client, index) {
    const id = this.ids?.get(client), now = Date.now();
    if (id === undefined || !Number.isInteger(index) || index < 0 || index >= EMOTES || now - (client.emoteAt || 0) < 1500) return;
    client.emoteAt = now;
    for (const member of this.members) this.hub.send(member, { t: 'emote', a: id, e: index });
  }
  power(client, slot) {
    const id = this.ids?.get(client), actor = id === undefined ? null : this.arena?.actors[id];
    if (actor?.alive && actor.human && (slot === 0 || slot === 1) && actor.powers[slot]) this.arena.ability(id, actor.powers[slot]);
  }
}

export class Hub {
  constructor(options = {}) { this.options = { ...DEFAULTS, ...options }; this.rooms = new Map(); }
  // `socket` only needs send(text). Returns the handlers for incoming messages and close.
  connect(socket) {
    const client = { socket, room: null, name: '', level: 1, uid: null, token: '', skin: CHARACTERS[0].id, color: COLORS[0], easy: false, messages: 0, window: Date.now() };
    return { message: raw => this.message(client, raw), close: () => client.room?.remove(client) };
  }
  sendRaw(client, text) { try { client.socket.send(text); } catch { /* A broken socket is cleaned up by its close event. */ } }
  send(client, data) { this.sendRaw(client, JSON.stringify(data)); }
  message(client, raw) {
    // Simple flood protection: a phone sends at most ~20 inputs per second.
    const now = Date.now();
    if (now - client.window > 1000) { client.window = now; client.messages = 0; }
    if (++client.messages > 60) return;
    let data; try { data = JSON.parse(String(raw)); } catch { return; }
    if (!data || typeof data.t !== 'string') return;
    if (data.t === 'quick' || data.t === 'create' || data.t === 'join') {
      client.room?.remove(client);
      // A signed-in phone sends its Firebase ID token; the server checks it to know the
      // player's account. Until it is verified (or without one) the match is unranked.
      if (typeof data.token === 'string' && data.token.length < 4096 && this.options.verify && data.token !== client.token) {
        const token = client.token = data.token; client.uid = null;
        this.options.verify(token).then(uid => { if (client.token === token) client.uid = uid; }, () => { /* Unranked. */ });
      }
      Object.assign(client, { name: cleanName(data.name), level: validLevel(data.level), skin: validSkin(data.skin), color: validColor(data.color), easy: data.easy === true });
    }
    if (data.t === 'quick') this.quick(client);
    else if (data.t === 'create') this.create(client);
    else if (data.t === 'join') this.join(client, data.code);
    else if (data.t === 'start') { if (client.room?.host === client) client.room.begin(); }
    else if (data.t === 'leave') client.room?.remove(client);
    else if (data.t === 'ping') { if (Number.isFinite(data.c)) this.send(client, { t: 'pong', c: data.c }); }
    else if (data.t === 'input') client.room?.input(client, data.a);
    else if (data.t === 'power') client.room?.power(client, data.s);
    else if (data.t === 'emote') client.room?.emote(client, data.e);
  }
  open(isPrivate) {
    if (this.rooms.size >= this.options.maxRooms) return null;
    let code;
    do code = WORDS[Math.floor(Math.random() * WORDS.length)] + String(Math.floor(Math.random() * 90) + 10); while (this.rooms.has(code));
    const room = new Room(this, code, isPrivate); this.rooms.set(code, room); return room;
  }
  quick(client) {
    const room = [...this.rooms.values()].find(r => !r.isPrivate && r.state === 'lobby' && r.members.length < MAX_PLAYERS) || this.open(false);
    if (room) room.add(client); else this.send(client, { t: 'error', message: 'El servidor está lleno. Inténtalo en un momento.' });
  }
  create(client) {
    const room = this.open(true);
    if (room) room.add(client); else this.send(client, { t: 'error', message: 'El servidor está lleno. Inténtalo en un momento.' });
  }
  join(client, code) {
    const room = this.rooms.get(normalizeCode(code));
    if (!room || !room.isPrivate) this.send(client, { t: 'error', message: 'No encontramos esa sala. Revisa el código.' });
    else room.add(client);
  }
  close() { for (const room of [...this.rooms.values()]) room.close(); }
}

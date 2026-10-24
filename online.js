// Client side of online matches: talks to the server and mirrors its authoritative
// arena. The local player is always remapped to actor 0, so the renderer and the
// HUD work exactly as in solo games. Other players are smoothed between snapshots.
import { characterFor, WIDTH, HEIGHT, clamp, DASH_SPEED } from './engine.js';

const FLAG_POWERS = ['dash', 'shield', 'ghost', 'paint', 'magnet'];
const FROZEN = 32, WALL = 64, HUMAN = 128;
// Others are drawn slightly in the past so there are always two snapshots to blend between.
const DELAY = .1;
// Same movement rules as the engine, used to predict the local player.
const TURN_RATE = 6, PLAYER_SPEED = 4.8;
// Public game server on the internet: the web game, the Android app and everyone else play there.
export const PUBLIC_SERVER = 'wss://pintamundo.onrender.com/ws';
// Inside the APK the page is served by Capacitor itself, not by our game server.
const nativeApp = () => !!globalThis.Capacitor?.isNativePlatform?.();
// Address of the game server. A page served by the game server itself (Render, or a local
// test server on a PC) talks to that same server; everything else uses the public one.
// There is no way to choose another server.
export function defaultServer() {
  if (!nativeApp() && /^https?:$/.test(location.protocol) && !location.hostname.endsWith('github.io')) return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  return PUBLIC_SERVER;
}

export class Connection {
  constructor(url, onMessage, onClose) { Object.assign(this, { url, onMessage, onClose, rtt: 0 }); }
  open() {
    return new Promise((resolve, reject) => {
      let socket;
      try { socket = new WebSocket(this.url); } catch (error) { reject(error); return; }
      const timer = setTimeout(() => { socket.close(); reject(new Error('timeout')); }, 7000);
      socket.onopen = () => {
        clearTimeout(timer);
        // Round-trip time feeds the local prediction; measured every 2 s.
        this.ping = setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
        this.send({ t: 'ping', c: performance.now() });
        resolve();
      };
      socket.onerror = () => { clearTimeout(timer); reject(new Error('connection')); };
      socket.onmessage = event => {
        let data; try { data = JSON.parse(event.data); } catch { return; }
        if (data.t === 'pong') { const sample = performance.now() - data.c; this.rtt = this.rtt ? this.rtt * .7 + sample * .3 : sample; return; }
        this.onMessage(data);
      };
      socket.onclose = () => { clearTimeout(timer); clearInterval(this.ping); this.onClose?.(); };
      this.socket = socket;
    });
  }
  get isOpen() { return this.socket?.readyState === WebSocket.OPEN; }
  send(data) { if (this.isOpen) this.socket.send(JSON.stringify(data)); }
  close() { this.onClose = null; clearInterval(this.ping); this.socket?.close(); }
}

export class Mirror {
  constructor(arena, start) {
    this.arena = arena; this.you = start.you; this.timeLimit = start.timeLimit;
    const map = this.map = id => id === this.you ? 0 : id === 0 ? this.you : id;
    arena.solo = false; arena.online = true; arena.easy = start.easy === true;
    arena.projectiles = []; arena.events = []; arena.ended = false; arena.time = 0;
    arena.actors = [];
    for (const a of start.actors) {
      const character = characterFor(a.skin), id = map(a.id);
      arena.actors[id] = {
        id, human: a.human, name: id === 0 ? 'Tú' : a.name, color: a.color, skin: a.skin, rarity: character.rarity, powers: [...character.powers],
        x: 0, y: 0, angle: -Math.PI / 2, desired: -Math.PI / 2, alive: true, trail: [], count: 0, kills: 0, best: 0,
        timers: {}, ready: {}, frozenUntil: 0, wallSurge: false
      };
    }
    arena.grid.fill(-1);
    for (let i = 0, cell = 0; i < start.grid.length; i += 2) { const owner = start.grid[i] < 0 ? -1 : map(start.grid[i]); arena.grid.fill(owner, cell, cell + start.grid[i + 1]); cell += start.grid[i + 1]; }
    this.orbs(start.orbs);
    arena.revision++;
    this.snapshots = [];
  }
  orbs(flat) {
    const previous = this.arena.orbs || [];
    this.arena.orbs = [];
    for (let i = 0; i < flat.length; i += 2) this.arena.orbs.push({ x: flat[i] / 10, y: flat[i + 1] / 10, phase: previous[i / 2]?.phase ?? Math.random() * 6.28 });
  }
  mapEvent(event) {
    const e = { ...event };
    for (const key of ['id', 'killer', 'winner']) if (typeof e[key] === 'number' && e[key] >= 0) e[key] = this.map(e[key]);
    if (e.ranking) e.ranking = e.ranking.map(this.map);
    if (e.type === 'end') e.won = e.winner === 0;
    return e;
  }
  state(message) {
    const arena = this.arena, map = this.map;
    if (message.c.length) {
      for (let i = 0; i < message.c.length; i += 2) arena.grid[message.c[i]] = message.c[i + 1] < 0 ? -1 : map(message.c[i + 1]);
      arena.revision++;
    }
    for (const [id, from, ...cells] of message.tr) { const actor = arena.actors[map(id)]; actor.trail = from ? actor.trail.slice(0, from).concat(cells) : cells; }
    if (message.o) this.orbs(message.o);
    arena.projectiles = [];
    for (let i = 0; i < message.p.length; i += 4) arena.projectiles.push({ owner: map(message.p[i]), x: message.p[i + 1] / 100, y: message.p[i + 2] / 100, angle: message.p[i + 3] / 1000 });
    arena.time = message.time;
    const positions = [];
    for (const [id, x, y, angle, alive, flags, count, kills] of message.a) {
      const actor = arena.actors[map(id)];
      Object.assign(actor, { alive: alive === 1, count, kills, human: (flags & HUMAN) > 0, wallSurge: (flags & WALL) > 0, frozenUntil: flags & FROZEN ? Infinity : 0 });
      FLAG_POWERS.forEach((power, i) => { actor.timers[power] = flags & (1 << i) ? Infinity : 0; });
      positions[actor.id] = [x / 100, y / 100, angle / 1000];
    }
    const me = arena.actors[0];
    me.best = Math.max(me.best, me.count);
    for (const [power, remaining] of Object.entries(message.me || {})) me.ready[power] = arena.time + remaining;
    this.snapshots.push({ time: message.time, at: performance.now(), positions });
    if (this.snapshots.length > 8) this.snapshots.shift();
    for (const event of message.e) arena.events.push(this.mapEvent(event));
  }
  remaining() { return Math.max(0, this.timeLimit - this.arena.time); }
  // Client-side prediction: start from the latest confirmed position and move ahead by the
  // time since it arrived plus half the round trip, steering with the current local heading.
  // The server stays the authority; small differences are absorbed instead of snapping.
  predict(now, desired, rtt) {
    const me = this.arena.actors[0], latest = this.snapshots.at(-1);
    if (!me.alive || !latest?.positions[0] || !Number.isFinite(desired)) { me.predicted = false; return false; }
    let [x, y, angle] = latest.positions[0];
    let left = me.frozenUntil ? 0 : Math.min(.35, (now - latest.at) / 1000 + rtt / 2000);
    const speed = PLAYER_SPEED * (me.timers.dash ? DASH_SPEED : 1) * (me.wallSurge ? 1.35 : 1);
    while (left > 0) {
      const dt = Math.min(left, 1 / 60), turn = Math.atan2(Math.sin(desired - angle), Math.cos(desired - angle));
      angle += clamp(turn, -TURN_RATE * dt, TURN_RATE * dt);
      x = clamp(x + Math.cos(angle) * speed * dt, .65, WIDTH - .65); y = clamp(y + Math.sin(angle) * speed * dt, .65, HEIGHT - .65);
      left -= dt;
    }
    if (!me.predicted || Math.hypot(me.x - x, me.y - y) > 2) { me.x = x; me.y = y; }
    else { me.x += (x - me.x) * .35; me.y += (y - me.y) * .35; }
    me.angle = angle; me.predicted = true;
    return true;
  }
  // Blend the two snapshots around "now − DELAY" so others move smoothly; the local player is predicted.
  update(now, desired, rtt = 0) {
    const list = this.snapshots; if (!list.length) return;
    const latest = list.at(-1), target = latest.time + (now - latest.at) / 1000 - DELAY;
    let a = list[0], b = latest;
    for (let i = 0; i < list.length - 1; i++) if (list[i].time <= target && list[i + 1].time >= target) { a = list[i]; b = list[i + 1]; break; }
    const span = b.time - a.time, k = span > 0 ? Math.min(1, Math.max(0, (target - a.time) / span)) : 1;
    const predicted = this.predict(now, desired, rtt);
    for (const actor of this.arena.actors) {
      if (actor.id === 0 && predicted) continue;
      const from = a.positions[actor.id], to = b.positions[actor.id]; if (!from || !to) continue;
      const turn = Math.atan2(Math.sin(to[2] - from[2]), Math.cos(to[2] - from[2]));
      actor.x = from[0] + (to[0] - from[0]) * k; actor.y = from[1] + (to[1] - from[1]) * k; actor.angle = from[2] + turn * k;
    }
  }
}

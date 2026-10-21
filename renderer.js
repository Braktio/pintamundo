import { WIDTH, HEIGHT, SIZE, coords, CELL_PIXELS, RARITIES, characterFor } from './engine.js';

const FONT = "'Lilita One', 'Baloo 2', 'Trebuchet MS', system-ui, sans-serif";
// Shared navy outline used by every sticker-style shape, matching the menu UI.
export const INK = '#1c2a6e';
const CONFETTI = ['#ff4f7b', '#ffd23f', '#6fdc3c', '#2d7bff', '#b45cff', '#ff8a1f', '#ffffff'];
const CHEERS = ['¡GENIAL!', '¡SÚPER!', '¡BRAVO!', '¡WOW!', '¡INCREÍBLE!'];
// Mixes a #rrggbb color toward black (negative amount) or white (positive amount).
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1, 7), 16), target = amount < 0 ? 0 : 255, k = Math.abs(amount);
  const mix = v => Math.round(v + (target - v) * k).toString(16).padStart(2, '0');
  return '#' + mix(n >> 16) + mix(n >> 8 & 255) + mix(n & 255);
}
function star(c, x, y, outer, inner, rotation = 0) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer, a = rotation - Math.PI / 2 + i * Math.PI / 5;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}

// Strict orthographic renderer: equal X/Y scale, no perspective, tilt or camera lag.
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.camera = { x: 42, y: 36 };
    this.particles = []; this.floats = []; this.rings = []; this.brokenTrails = []; this.poofs = [];
    this.pops = {}; this.moods = {}; this.patterns = new Map(); this.portraits = new Map();
    this.cachedRevision = -1;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    this.width = innerWidth; this.height = innerHeight;
    this.scale = CELL_PIXELS * Math.max(.75, Math.min(1.25, this.height / 470));
    this.dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.patterns?.clear();
  }
  project(x, y, z = 0) {
    // Z never changes the ground projection; elevation cannot introduce parallax.
    return { x: this.width / 2 + (x - this.camera.x) * this.scale, y: this.height / 2 + (y - this.camera.y) * this.scale, scale: this.scale };
  }
  unproject(x, y) {
    return { x: this.camera.x + (x - this.width / 2) / this.scale, y: this.camera.y + (y - this.height / 2) / this.scale };
  }
  polygon(points, close = true) {
    const c = this.ctx; c.beginPath();
    points.forEach((p, i) => { const q = this.project(...p); if (i) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); });
    if (close) c.closePath();
  }
  rebuild(arena) {
    this.runs = arena.actors.map(() => []); this.edges = arena.actors.map(() => []);
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH;) {
      const id = arena.grid[y * WIDTH + x]; if (id < 0) { x++; continue; }
      let end = x + 1; while (end < WIDTH && arena.grid[y * WIDTH + end] === id) end++;
      this.runs[id].push([x, y, end]); x = end;
    }
    for (let i = 0; i < SIZE; i++) {
      const id = arena.grid[i]; if (id < 0) continue;
      const x = i % WIDTH, y = Math.floor(i / WIDTH), edges = this.edges[id];
      if (!y || arena.grid[i - WIDTH] !== id) edges.push([x, y, x + 1, y]);
      if (y === HEIGHT - 1 || arena.grid[i + WIDTH] !== id) edges.push([x, y + 1, x + 1, y + 1]);
      if (!x || arena.grid[i - 1] !== id) edges.push([x, y, x, y + 1]);
      if (x === WIDTH - 1 || arena.grid[i + 1] !== id) edges.push([x + 1, y, x + 1, y + 1]);
    }
    this.cachedArena = arena; this.cachedRevision = arena.revision;
  }
  // A soft tile per color, two cells wide, aligned to the board when drawn.
  pattern(color) {
    const size = Math.max(8, Math.round(this.scale * 2)), key = color + size;
    if (!this.patterns.has(key)) {
      const tile = document.createElement('canvas'); tile.width = tile.height = size;
      const t = tile.getContext('2d');
      t.fillStyle = shade(color, .55); t.fillRect(0, 0, size, size);
      t.fillStyle = shade(color, .42); t.fillRect(0, 0, size / 2, size / 2); t.fillRect(size / 2, size / 2, size / 2, size / 2);
      this.patterns.set(key, this.ctx.createPattern(tile, 'repeat'));
    }
    return this.patterns.get(key);
  }
  burst(x, y, color, count = 12, shape = 'star') {
    // Always allocate exactly 35 for a death; reduced motion shortens their travel.
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, speed = (1 + Math.random() * 6) * (this.reduced ? .08 : 1);
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .45 + Math.random() * .6, color, shape, spin: Math.random() * 6, size: .7 + Math.random() * .6 });
    }
    this.particles = this.particles.slice(-500);
  }
  confetti(x, y, count = 30) {
    for (let i = 0; i < count; i++) this.burst(x, y, CONFETTI[i % CONFETTI.length], 1, i % 3 ? 'paper' : 'star');
  }
  text(x, y, text, color = '#2d7bff', size = 18) { this.floats.push({ x, y, text, color, size, life: 1.5 }); this.floats = this.floats.slice(-10); }
  effects(event, arena) {
    this.poofs ??= []; this.pops ??= {}; this.moods ??= {};
    if (event.type === 'death') {
      const victim = arena.actors[event.id];
      this.burst(event.x, event.y, victim.color, 35);
      this.poofs.push({ x: event.x, y: event.y, actor: { ...victim }, life: 1.2 });
      if (event.trail?.length) this.brokenTrails.push({ points: event.trail.map(coords), cut: event.trail.lastIndexOf(event.cutIndex), color: victim.color, life: 1.2 });
      if (event.killer >= 0) this.moods[event.killer] = 1.5;
      if (event.killer === 0) this.text(event.x, event.y, event.revenge ? '¡DESQUITE!' : '¡ATRAPADO! +120 ⭐', '#ff5f8f', 24);
    }
    if (event.type === 'capture' && event.cells) {
      this.pops[event.id] = 1; this.moods[event.id] = 1.2;
      if (event.id === 0) {
        const cheer = CHEERS[Math.floor(Math.random() * CHEERS.length)];
        this.text(event.x, event.y, cheer, '#ffd23a', event.cells > 60 ? 34 : 26);
        this.confetti(event.x, event.y, event.cells > 60 ? 45 : 25);
      }
      this.rings.push({ x: event.x, y: event.y, color: arena.actors[event.id].color, life: 1 });
    }
    if (event.type === 'repel') { this.burst(event.x, event.y, '#9fe3ff', 8, 'paper'); this.text(event.x, event.y, '¡BOING!', '#4fc3ff'); }
    if (event.type === 'orb') this.burst(event.x, event.y, '#ffd23a', 6);
    if (event.type === 'wall') this.burst(event.x, event.y, '#ffffff', 2, 'paper');
    if (event.type === 'ability') this.rings.push({ x: event.x, y: event.y, color: arena.actors[event.id].color, life: 1 });
    if (event.type === 'splat') this.burst(event.x, event.y, event.color, 10, 'paper');
    if (event.type === 'bomb') {
      this.rings.push({ x: event.x, y: event.y, color: arena.actors[event.id].color, life: 1, size: 9 });
      this.confetti(event.x, event.y, 40);
      if (event.id === 0) this.text(event.x, event.y, '¡BOOM!', '#ff8a1f', 34);
    }
    if (event.type === 'freeze') {
      this.rings.push({ x: event.x, y: event.y, color: '#8fe8ff', life: 1, size: 16 });
      this.burst(event.x, event.y, '#dff8ff', 24, 'star');
      this.text(event.x, event.y, '¡CONGELADOS!', '#8fe8ff', 26);
    }
    if (event.type === 'fragments' && event.cells) this.text(event.to.x, event.to.y + 1.5, '¡ZONA EXTRA!', event.color, 16);
  }
  // Zones look like raised islands: a dark "thickness" below, a light top and a navy rim.
  territory(arena) {
    const c = this.ctx, origin = this.project(0, 0), depth = Math.max(3, this.scale * .25);
    if (this.cachedArena !== arena || this.cachedRevision !== arena.revision) this.rebuild(arena);
    for (const actor of arena.actors) {
      if (!this.runs[actor.id].length) continue;
      // A fresh capture makes the whole zone bounce briefly around its owner.
      const pop = this.reduced ? 0 : this.pops[actor.id] || 0, center = this.project(actor.x, actor.y);
      const top = new Path2D(), rim = new Path2D();
      for (const [x, y, end] of this.runs[actor.id]) {
        const p = this.project(x, y);
        if (p.y < -this.scale * 2 || p.y > this.height + this.scale || p.x > this.width + this.scale || p.x + (end - x) * this.scale < -this.scale) continue;
        top.rect(p.x, p.y, (end - x) * this.scale + .5, this.scale + .5);
      }
      for (const [x, y, x2, y2] of this.edges[actor.id]) {
        const a = this.project(x, y), b = this.project(x2, y2);
        if (a.x < -this.scale || a.x > this.width + this.scale || a.y < -this.scale || a.y > this.height + this.scale) continue;
        rim.moveTo(a.x, a.y); rim.lineTo(b.x, b.y);
      }
      c.save();
      if (pop > 0) { const k = 1 + Math.sin(pop * Math.PI) * .045; c.translate(center.x, center.y); c.scale(k, k); c.translate(-center.x, -center.y); }
      c.save(); c.translate(0, depth); c.fillStyle = shade(actor.color, -.25); c.fill(top);
      c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = 3; c.stroke(rim); c.restore();
      const fill = this.pattern(actor.color);
      fill.setTransform?.(new DOMMatrix([1, 0, 0, 1, origin.x, origin.y]));
      c.fillStyle = fill; c.fill(top);
      c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 3; c.stroke(rim);
      c.restore();
    }
  }
  // Wide translucent paint band with a light core, like a freshly painted road.
  trail(points, color, width = 7, opacity = 1) {
    if (points.length < 2) return;
    const c = this.ctx, p = points.map(point => this.project(point.x, point.y)), band = Math.max(width, this.scale * .62) * (width / 7);
    c.save(); c.globalAlpha = opacity; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length - 1; i++) c.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
    c.lineTo(p.at(-1).x, p.at(-1).y);
    c.strokeStyle = shade(color, -.1) + 'c0'; c.lineWidth = band + 5; c.stroke();
    c.strokeStyle = shade(color, .35) + 'e6'; c.lineWidth = band; c.stroke();
    c.strokeStyle = '#ffffff80'; c.lineWidth = Math.max(2, band * .28); c.stroke(); c.restore();
  }
  // Characters face the viewer; only their pupils and nose follow the heading.
  // Every character is assembled from its `look`: body shape, ears, extras and eyes.
  character(actor, arena, time, options = {}) {
    const c = this.ctx, s = this.scale * (options.size || 1), p = options.at || this.project(actor.x, actor.y);
    if (p.x < -60 || p.x > this.width + 60 || p.y < -60 || p.y > this.height + 60) return;
    const look = characterFor(actor.skin).look, rarity = actor.rarity || characterFor(actor.skin).rarity;
    // "still" freezes the pose (cards); "idle" keeps bouncing and blinking but faces the viewer (menu mascot).
    const r = s * .78, still = options.still || options.idle, id = actor.id || 0;
    const dx = still ? 0 : Math.cos(actor.angle), dy = still ? 0 : Math.sin(actor.angle);
    const bounce = this.reduced || options.still ? 1 : 1 + Math.sin(time * (options.idle ? 4 : 11) + id * 1.7) * (options.idle ? .06 : .045);
    const lw = Math.max(2.5, r * .12), extras = new Set(look.extras);
    c.save(); c.translate(p.x, p.y);
    if (options.spin) c.rotate(options.spin);
    if (options.alpha !== undefined) c.globalAlpha = options.alpha;
    // Legendary and mythic characters always carry a few orbiting sparkles.
    if ((rarity === 'legendario' || rarity === 'mitico') && !options.still) {
      c.fillStyle = RARITIES[rarity].color;
      for (let i = 0; i < 3; i++) { const a = time * 2 + i * Math.PI * 2 / 3; star(c, Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.2, r * .2, r * .09, a); c.fill(); }
    }
    c.fillStyle = (actor.color || '#1c2a6e') + '55'; c.beginPath(); c.ellipse(0, r * .95, r * .95, r * .3, 0, 0, Math.PI * 2); c.fill();
    if (arena?.active(actor, 'paint')) {
      c.strokeStyle = actor.color; c.lineWidth = 3; c.setLineDash([6, 6]); c.lineDashOffset = -time * 30;
      c.beginPath(); c.ellipse(0, r * .9, r * 1.5, r * .55, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    if (arena?.active(actor, 'dash')) {
      c.strokeStyle = actor.color + 'aa'; c.lineWidth = 3; c.lineCap = 'round';
      for (const offset of [-.45, 0, .45]) {
        const ox = -dy * offset * r, oy = dx * offset * r, from = 1.2 + Math.abs(offset), wobble = Math.sin(time * 30 + offset * 9) * .2;
        c.beginPath(); c.moveTo(ox - dx * r * from, oy - dy * r * from); c.lineTo(ox - dx * r * (from + .9 + wobble), oy - dy * r * (from + .9 + wobble)); c.stroke();
      }
    }
    // Nose arrow (in the player's color) shows where the character is heading.
    if (!still) {
      c.fillStyle = actor.color || '#ffffff'; c.strokeStyle = INK; c.lineWidth = 2.5; c.lineJoin = 'round'; c.beginPath();
      c.moveTo(dx * r * 1.6, dy * r * 1.6); c.lineTo(dx * r * 1.15 - dy * r * .34, dy * r * 1.15 + dx * r * .34); c.lineTo(dx * r * 1.15 + dy * r * .34, dy * r * 1.15 - dx * r * .34); c.closePath(); c.fill(); c.stroke();
    }
    c.scale(1 / bounce, bounce);
    c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
    this.behind(look, extras, r, time);
    this.ears(look, r, time, false);
    this.bodyPath(look.shape, r, time); c.fillStyle = look.color; c.fill();
    // Body decorations are clipped to the silhouette so they never spill out.
    c.save(); this.bodyPath(look.shape, r, time); c.clip(); this.decorate(look, extras, r); c.restore();
    this.bodyPath(look.shape, r, time); c.lineWidth = lw; c.stroke();
    c.fillStyle = '#ffffffa0'; c.beginPath(); c.ellipse(-r * .5, -r * .55, r * .2, r * .1, -.7, 0, Math.PI * 2); c.fill();
    this.face(actor, look, extras, r, time, dx, dy, options);
    this.ears(look, r, time, true);
    if (extras.has('helmet')) {
      c.fillStyle = '#bfefff40'; c.lineWidth = lw * .8; c.beginPath(); c.arc(0, -r * .05, r * 1.22, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = '#ffffffd0'; c.lineWidth = r * .1; c.beginPath(); c.arc(0, -r * .05, r * 1.02, Math.PI * 1.15, Math.PI * 1.45); c.stroke();
    }
    c.restore();
    if (arena && actor.frozenUntil > arena.time) {
      c.save(); c.fillStyle = '#bfefffb0'; c.strokeStyle = INK; c.lineWidth = 3;
      c.beginPath(); c.roundRect(p.x - r * 1.35, p.y - r * 1.45, r * 2.7, r * 2.6, r * .4); c.fill(); c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x - r * .9, p.y - r * 1.1); c.lineTo(p.x - r * .4, p.y - r * 1.1); c.stroke();
      c.font = `${Math.round(r)}px ${FONT}`; c.textAlign = 'center'; c.fillText('❄️', p.x + r * 1.1, p.y - r * 1.2); c.restore();
    }
    if (arena?.active(actor, 'shield')) {
      c.save(); c.fillStyle = '#bfefff50'; c.strokeStyle = INK; c.lineWidth = 3;
      c.beginPath(); c.arc(p.x, p.y, r * 1.75, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = '#ffffffdd'; c.lineWidth = 4; c.beginPath(); c.arc(p.x, p.y, r * 1.4, Math.PI * 1.1, Math.PI * 1.45); c.stroke(); c.restore();
    }
    if (!options.at) this.label(actor.name, p.x, p.y - r * 1.85 - 8, actor.color);
  }
  bodyPath(shape, r, time) {
    const c = this.ctx; c.beginPath();
    if (shape === 'box') c.roundRect(-r, -r * .92, r * 2, r * 1.84, r * .38);
    else if (shape === 'drop') { c.moveTo(0, -r * 1.25); c.bezierCurveTo(r * .55, -r * .6, r * 1.05, -r * .1, r * .95, r * .35); c.arc(0, r * .2, r * .96, .15, Math.PI - .15); c.bezierCurveTo(-r * 1.05, -r * .1, -r * .55, -r * .6, 0, -r * 1.25); }
    else if (shape === 'ghost') {
      c.moveTo(-r, r * .85); c.lineTo(-r, -r * .1); c.arc(0, -r * .1, r, Math.PI, 0); c.lineTo(r, r * .85);
      for (let i = 0; i < 4; i++) c.quadraticCurveTo(r - (i + .5) * r / 2, r * (i % 2 ? .95 : .55) + Math.sin(time * 8 + i) * r * .06, r - (i + 1) * r / 2, r * .85);
    } else c.arc(0, 0, r, 0, Math.PI * 2);
    c.closePath();
  }
  // Pieces drawn behind the body: wings, mane, saucer, fluff, rainbow.
  behind(look, extras, r, time) {
    const c = this.ctx;
    if (extras.has('rainbow')) for (const [i, color] of ['#ff4f6d', '#ffd23a', '#6fdc3c', '#4fc3ff'].entries()) {
      c.strokeStyle = INK; c.lineWidth = r * .24; c.beginPath(); c.arc(0, r * .1, r * (1.55 - i * .17), Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      c.strokeStyle = color; c.lineWidth = r * .15; c.stroke();
    }
    if (extras.has('mane')) { c.fillStyle = look.accent; c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, k = i % 2 ? 1.12 : 1.4; c.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); } c.closePath(); c.fill(); c.lineWidth = Math.max(2, r * .09); c.stroke(); }
    if (extras.has('fluff')) { c.fillStyle = look.color; c.lineWidth = Math.max(2, r * .09); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * r * .95, Math.sin(a) * r * .95, r * .26, 0, Math.PI * 2); c.fill(); c.stroke(); } }
    if (extras.has('wings')) {
      const flap = Math.sin(time * 9) * .15; c.fillStyle = look.accent; c.lineWidth = Math.max(2, r * .1);
      for (const side of [-1, 1]) { c.beginPath(); c.moveTo(side * r * .8, -r * .1); c.lineTo(side * r * 1.6, -r * (.6 + flap)); c.lineTo(side * r * 1.4, r * .3); c.closePath(); c.fill(); c.stroke(); }
    }
    if (extras.has('saucer')) {
      c.fillStyle = look.accent; c.lineWidth = Math.max(2, r * .1); c.beginPath(); c.ellipse(0, r * .38, r * 1.5, r * .45, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#ffd23a'; for (const x of [-1, 0, 1]) { c.beginPath(); c.arc(x * r, r * .48, r * .12, 0, Math.PI * 2); c.fill(); }
    }
  }
  // Ears and headwear. `front` pieces sit on top of the head, others behind it.
  ears(look, r, time, front) {
    const c = this.ctx, type = look.ears, accent = look.accent, lw = Math.max(2, r * .1);
    c.lineWidth = lw; c.fillStyle = look.color;
    const tri = (a, b, d, fill) => { c.fillStyle = fill; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.closePath(); c.fill(); c.stroke(); };
    if (!front) {
      if (type === 'cat') for (const side of [-1, 1]) { tri([side * r * .88, -r * .3], [side * r * .75, -r * 1.25], [side * r * .2, -r * .82], look.color); tri([side * r * .7, -r * .55], [side * r * .66, -r * 1], [side * r * .38, -r * .78], accent); }
      if (type === 'bear') for (const side of [-1, 1]) { c.fillStyle = look.color; c.beginPath(); c.arc(side * r * .72, -r * .72, r * .32, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = accent; c.beginPath(); c.arc(side * r * .72, -r * .72, r * .15, 0, Math.PI * 2); c.fill(); }
      if (type === 'bunny') for (const side of [-1, 1]) { c.fillStyle = look.color; c.beginPath(); c.ellipse(side * r * .4, -r * 1.25, r * .22, r * .6, side * .15, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = accent; c.beginPath(); c.ellipse(side * r * .4, -r * 1.22, r * .1, r * .4, side * .15, 0, Math.PI * 2); c.fill(); }
      if (type === 'antenna') { c.beginPath(); c.moveTo(0, -r * .85); c.lineTo(0, -r * 1.4); c.stroke(); c.fillStyle = Math.sin(time * 6) > 0 ? accent : '#ffffff'; c.beginPath(); c.arc(0, -r * 1.45, r * .17, 0, Math.PI * 2); c.fill(); c.stroke(); }
      if (type === 'fin') tri([-r * .35, -r * .8], [r * .15, -r * 1.55], [r * .4, -r * .78], look.color);
      if (type === 'horns') for (const side of [-1, 1]) tri([side * r * .62, -r * .62], [side * r * .78, -r * 1.3], [side * r * .22, -r * .9], accent);
      if (type === 'crest') for (const [i, x] of [-.35, 0, .35].entries()) tri([x * r - r * .18, -r * .8], [x * r + (i - 1) * r * .15, -r * (1.45 + (i === 1 ? .2 : 0)) + Math.sin(time * 8 + i) * r * .06], [x * r + r * .18, -r * .8], i === 1 ? accent : look.color);
      if (type === 'crystal') for (const [i, x] of [-.45, 0, .45].entries()) tri([x * r - r * .2, -r * .75], [x * r, -r * (i === 1 ? 1.6 : 1.25)], [x * r + r * .2, -r * .75], i === 1 ? accent : '#bff4ff');
      return;
    }
    if (type === 'tuft') { c.fillStyle = accent; c.beginPath(); c.ellipse(-r * .1, -r * 1.02, r * .1, r * .26, -.4, 0, Math.PI * 2); c.ellipse(r * .12, -r * 1.05, r * .09, r * .22, .4, 0, Math.PI * 2); c.fill(); c.lineWidth = Math.max(1.5, r * .06); c.stroke(); }
    if (type === 'halo') { c.strokeStyle = INK; c.lineWidth = r * .22; c.beginPath(); c.ellipse(0, -r * 1.3, r * .55, r * .18, 0, 0, Math.PI * 2); c.stroke(); c.strokeStyle = '#ffd23a'; c.lineWidth = r * .12; c.stroke(); c.strokeStyle = INK; }
    if (type === 'crown') { c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(-r * .55, -r * .78); c.lineTo(-r * .6, -r * 1.35); c.lineTo(-r * .28, -r * 1.08); c.lineTo(0, -r * 1.45); c.lineTo(r * .28, -r * 1.08); c.lineTo(r * .6, -r * 1.35); c.lineTo(r * .55, -r * .78); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#ff4f6d'; c.beginPath(); c.arc(0, -r * .98, r * .1, 0, Math.PI * 2); c.fill(); }
    if (type === 'beret') { c.fillStyle = accent; c.beginPath(); c.ellipse(r * .1, -r * .9, r * .7, r * .28, -.2, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.moveTo(r * .15, -r * 1.15); c.lineTo(r * .22, -r * 1.35); c.stroke(); }
    if (type === 'unicorn') { tri([-r * .17, -r * .85], [0, -r * 1.7], [r * .17, -r * .85], '#ffd23a'); c.strokeStyle = '#ff8ad8'; c.lineWidth = r * .06; c.beginPath(); c.moveTo(-r * .1, -r * 1.05); c.lineTo(r * .1, -r * 1.15); c.moveTo(-r * .06, -r * 1.3); c.lineTo(r * .07, -r * 1.38); c.stroke(); c.strokeStyle = INK; }
  }
  // Decorations painted on the body, clipped to its silhouette.
  decorate(look, extras, r) {
    const c = this.ctx, accent = look.accent;
    c.fillStyle = extras.has('belly') ? accent : '#ffffff50';
    c.beginPath(); c.ellipse(0, r * .45, r * .6, r * .45, 0, 0, Math.PI * 2); c.fill();
    if (extras.has('spots')) { c.fillStyle = accent; for (const [x, y, k] of [[-.62, -.5, .16], [.66, .35, .17], [-.4, .66, .13], [.2, -.82, .14], [.72, -.35, .1]]) { c.beginPath(); c.arc(x * r, y * r, k * r, 0, Math.PI * 2); c.fill(); } }
    if (extras.has('bands')) { c.fillStyle = accent; for (const y of [.35, .7]) c.fillRect(-r * 1.2, y * r, r * 2.4, r * .16); }
    if (extras.has('stripes')) {
      c.strokeStyle = shade(look.color, -.25); c.lineWidth = r * .12;
      for (const x of [-.22, 0, .22]) { c.beginPath(); c.moveTo(x * r, -r * .98); c.lineTo(x * r * .8, -r * (x ? .62 : .55)); c.stroke(); }
      for (const side of [-1, 1]) for (const y of [-.1, .15]) { c.beginPath(); c.moveTo(side * r * 1.02, y * r); c.lineTo(side * r * .78, y * r + r * .05); c.stroke(); }
      c.strokeStyle = INK;
    }
    if (extras.has('mask')) { c.fillStyle = accent; c.beginPath(); c.roundRect(-r * 1.1, -r * .48, r * 2.2, r * .55, r * .25); c.fill(); }
    if (extras.has('band')) { c.fillStyle = accent; c.fillRect(-r * 1.2, -r * .72, r * 2.4, r * .26); }
    if (extras.has('patches')) { c.fillStyle = accent; for (const side of [-1, 1]) { c.beginPath(); c.ellipse(side * r * .36, -r * .16, r * .3, r * .38, side * .5, 0, Math.PI * 2); c.fill(); } }
  }
  face(actor, look, extras, r, time, dx, dy, options) {
    const c = this.ctx, id = actor.id || 0, eyes = look.eyes;
    const blink = !this.reduced && !options.still && (time + id * .73) % 4 < .12;
    const eye = r * (eyes === 'big' ? .32 : .27), ex = r * .34, ey = -r * .18;
    c.lineWidth = Math.max(1.5, r * .06); c.strokeStyle = INK;
    const pupil = (x, y, size) => {
      c.fillStyle = INK; c.beginPath(); c.arc(x + dx * size * .42, y + dy * size * .42, size * .55, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x + dx * size * .42 - size * .18, y + dy * size * .42 - size * .22, size * .18, 0, Math.PI * 2); c.fill();
    };
    if (options.dizzy) {
      c.lineWidth = 2.5;
      for (const side of [-1, 1]) { c.beginPath(); c.moveTo(side * ex - eye * .7, ey - eye * .7); c.lineTo(side * ex + eye * .7, ey + eye * .7); c.moveTo(side * ex + eye * .7, ey - eye * .7); c.lineTo(side * ex - eye * .7, ey + eye * .7); c.stroke(); }
    } else if (eyes === 'cyclops') {
      const big = r * .42; c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(0, ey, big, blink ? big * .15 : big, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      if (!blink) pupil(0, ey, big);
    } else for (const side of [-1, 1]) {
      c.fillStyle = '#ffffff'; c.beginPath();
      if (eyes === 'robot') c.rect(side * ex - eye, ey - eye * (blink ? .15 : 1), eye * 2, eye * (blink ? .3 : 2));
      else c.ellipse(side * ex, ey, eye, blink ? eye * .15 : eye * 1.15, 0, 0, Math.PI * 2);
      c.fill(); c.stroke();
      if (!blink) pupil(side * ex, ey, eye);
      if (eyes === 'sleepy' && !blink) { c.fillStyle = look.color; c.beginPath(); c.ellipse(side * ex, ey - eye * .35, eye * 1.08, eye * .8, 0, Math.PI, 0); c.fill(); c.beginPath(); c.moveTo(side * ex - eye, ey - eye * .35); c.lineTo(side * ex + eye, ey - eye * .35); c.stroke(); }
    }
    const beak = extras.has('beak'), snout = extras.has('snout'), mouthY = snout ? r * .58 : r * .22;
    if (snout) { c.fillStyle = look.accent; c.beginPath(); c.ellipse(0, r * .28, r * .32, r * .2, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = INK; for (const side of [-1, 1]) { c.beginPath(); c.arc(side * r * .1, r * .28, r * .05, 0, Math.PI * 2); c.fill(); } }
    if (beak) { c.fillStyle = '#ff9a1f'; c.beginPath(); c.moveTo(-r * .2, r * .15); c.lineTo(r * .2, r * .15); c.lineTo(0, r * .42); c.closePath(); c.fill(); c.stroke(); }
    // Mouth: a grin after a capture, an "o" while the paint trail is exposed.
    if (!beak) {
      c.fillStyle = INK; c.lineWidth = Math.max(2, r * .08);
      const worried = options.dizzy || (actor.trail?.length && !(this.moods[id] > 0)), happy = this.moods[id] > 0 || options.still || options.idle;
      if (worried) { c.beginPath(); c.ellipse(0, mouthY + r * .14, r * .12, r * .16, 0, 0, Math.PI * 2); c.fill(); }
      else if (happy) { c.beginPath(); c.arc(0, mouthY, r * (snout ? .2 : .3), 0, Math.PI); c.closePath(); c.fill(); c.fillStyle = '#ff7a9c'; c.beginPath(); c.ellipse(0, mouthY + r * (snout ? .13 : .2), r * (snout ? .09 : .14), r * .06, 0, 0, Math.PI * 2); c.fill(); }
      else { c.beginPath(); c.arc(0, mouthY - r * .02, r * .25, .25, Math.PI - .25); c.stroke(); }
      if (extras.has('teeth') && !worried) { c.fillStyle = '#ffffff'; c.lineWidth = Math.max(1, r * .04); for (const side of [-1, 1]) { c.beginPath(); c.rect(side * r * .1 - r * .07, mouthY, r * .14, r * .13); c.fill(); c.stroke(); } }
    }
    if (extras.has('mustache')) { c.strokeStyle = INK; c.lineWidth = r * .1; for (const side of [-1, 1]) { c.beginPath(); c.moveTo(0, r * .14); c.quadraticCurveTo(side * r * .3, r * .02, side * r * .42, r * .2); c.stroke(); } }
    if (extras.has('whiskers')) { c.strokeStyle = INK; c.lineWidth = Math.max(1.5, r * .05); for (const side of [-1, 1]) for (const k of [-.1, .08]) { c.beginPath(); c.moveTo(side * r * .55, r * .18 + k * r); c.lineTo(side * r * 1.05, r * .1 + k * r * 2); c.stroke(); } }
    if (look.shape !== 'box' && !extras.has('mask')) { c.fillStyle = '#ff8fb077'; for (const side of [-1, 1]) { c.beginPath(); c.ellipse(side * r * .62, r * .18, r * .16, r * .1, 0, 0, Math.PI * 2); c.fill(); } }
  }
  label(text, x, y, color) {
    const c = this.ctx; c.font = `13px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const width = c.measureText(text).width + 16;
    c.fillStyle = color; c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.roundRect(x - width / 2, y - 11, width, 22, 11); c.fill(); c.stroke();
    c.lineJoin = 'round'; c.lineWidth = 3.5; c.strokeText(text, x, y + 1); c.fillStyle = '#ffffff'; c.fillText(text, x, y + 1); c.textBaseline = 'alphabetic';
  }
  // Draws a still, smiling character into its own canvas (menus, cards, ranking).
  portrait(canvas, actor, time = 0, { size = canvas.clientWidth, idle = false } = {}) {
    if (!size) return;
    const saved = { ctx: this.ctx, width: this.width, height: this.height }, dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(size * dpr)) canvas.width = canvas.height = Math.round(size * dpr);
    this.ctx = canvas.getContext('2d'); this.width = this.height = size;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.ctx.clearRect(0, 0, size, size);
    this.character({ id: 0, angle: Math.PI / 2, trail: [], ...actor }, null, time, { at: { x: size / 2, y: size * .56 }, size: size * .3 / (this.scale * .78), still: !idle, idle });
    Object.assign(this, saved);
  }
  portraitURL(actor, size = 96) {
    const key = actor.skin + actor.color + size;
    if (!this.portraits.has(key)) {
      const canvas = document.createElement('canvas');
      this.portrait(canvas, actor, 0, { size }); this.portraits.set(key, canvas.toDataURL());
    }
    return this.portraits.get(key);
  }
  // Points toward the closest home cell while the player's paint trail is exposed.
  homeArrow(arena, time) {
    const player = arena.actors[0]; if (!player.alive || !player.trail.length) return;
    let best = Infinity, target = null;
    for (let i = 0; i < SIZE; i++) if (arena.grid[i] === 0) {
      const x = i % WIDTH + .5, y = Math.floor(i / WIDTH) + .5, d = (x - player.x) ** 2 + (y - player.y) ** 2;
      if (d < best) { best = d; target = { x, y }; }
    }
    if (!target || best < 9) return;
    const c = this.ctx, angle = Math.atan2(target.y - player.y, target.x - player.x), distance = this.scale * (2.6 + Math.sin(time * 7) * .25);
    const p = this.project(player.x, player.y), x = p.x + Math.cos(angle) * distance, y = p.y + Math.sin(angle) * distance;
    c.save(); c.translate(x, y); c.rotate(angle);
    c.fillStyle = '#ffd23a'; c.strokeStyle = INK; c.lineWidth = 3.5; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(17, 0); c.lineTo(-7, -14); c.lineTo(-2, 0); c.lineTo(-7, 14); c.closePath(); c.fill(); c.stroke();
    c.restore();
    c.font = `22px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('🏠', p.x + Math.cos(angle) * (distance + 26), p.y + Math.sin(angle) * (distance + 26)); c.textBaseline = 'alphabetic';
  }
  // Light mint island surrounded by bright water, as on the menu's world map.
  board(time) {
    const c = this.ctx, s = this.scale;
    c.fillStyle = '#27c9ee'; c.fillRect(0, 0, this.width, this.height);
    const a = this.project(0, 0), b = this.project(WIDTH, HEIGHT);
    // Gentle waves on the water outside the board.
    c.strokeStyle = '#7fe4fa'; c.lineWidth = 3; c.lineCap = 'round';
    const step = s * 4, shift = this.reduced ? 0 : (time * 8) % step;
    for (let y = (a.y % step + step) % step - step; y < this.height; y += step) for (let x = (a.x % (step * 2) + step * 2) % (step * 2) - step * 2 + shift; x < this.width; x += step * 2) {
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + s * .6, y - s * .4, x + s * 1.2, y); c.stroke();
    }
    c.fillStyle = '#1c2a6e40'; c.fillRect(a.x + 6, a.y + 10, b.x - a.x, b.y - a.y);
    c.fillStyle = '#ecfbf6'; c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    const x0 = Math.max(0, Math.floor((this.camera.x - this.width / 2 / s) / 2) * 2), x1 = Math.min(WIDTH, this.camera.x + this.width / 2 / s + 2);
    const y0 = Math.max(0, Math.floor((this.camera.y - this.height / 2 / s) / 2) * 2), y1 = Math.min(HEIGHT, this.camera.y + this.height / 2 / s + 2);
    c.fillStyle = '#e0f6ef';
    for (let y = y0; y < y1; y += 2) for (let x = x0 + ((y / 2) % 2 ? 2 : 0); x < x1; x += 4) { const p = this.project(x, y); c.fillRect(p.x, p.y, s * 2, s * 2); }
  }
  fence() {
    const c = this.ctx;
    this.polygon([[0, 0], [WIDTH, 0], [WIDTH, HEIGHT], [0, HEIGHT]]);
    c.lineJoin = 'round'; c.strokeStyle = '#ffffff'; c.lineWidth = 12; c.stroke();
    c.strokeStyle = INK; c.lineWidth = 3.5; c.stroke();
  }
  draw(arena, time, dt, demo = false) {
    const c = this.ctx, player = arena.actors[0];
    this.camera.x = player.x; this.camera.y = player.y;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const id in this.pops) this.pops[id] -= dt * 2.5;
    for (const id in this.moods) this.moods[id] -= dt;
    this.board(time);
    this.fence();
    this.territory(arena);
    this.brokenTrails = this.brokenTrails.filter(t => t.life > 0);
    for (const trail of this.brokenTrails) {
      trail.life -= dt; const middle = trail.cut >= 0 ? trail.cut : Math.floor(trail.points.length / 2);
      this.trail(trail.points.slice(0, Math.max(0, middle - 1)), trail.color, 5, Math.max(0, trail.life) * .5);
      this.trail(trail.points.slice(middle + 1), trail.color, 5, Math.max(0, trail.life) * .5);
    }
    if (demo) {
      this.trail([{ x: 38, y: 33 }, { x: 38, y: 27 }, { x: 56, y: 27 }, { x: 56, y: 31 }, { x: 50, y: 31 }], player.color, 9);
      this.character({ ...player, x: 50, y: 31, angle: Math.PI, trail: [] }, null, time, { at: this.project(50, 31), size: 2.2 });
    } else {
      for (const actor of arena.actors) if (actor.alive) {
        const points = actor.trail.map(coords); points.push({ x: actor.x, y: actor.y });
        const midpoint = Math.floor(points.length / 2), width = actor.id === 0 && arena.easy ? 10 : 7;
        if (arena.active(actor, 'ghost')) {
          this.trail(points.slice(0, midpoint + 1), actor.color, width); this.trail(points.slice(midpoint), actor.color, width - 2, .25);
        } else this.trail(points, arena.active(actor, 'shield') ? '#9fe3ff' : actor.color, width);
      }
    }
    // Paint shots: a glossy ball with a short trail of droplets behind it.
    for (const shot of arena.projectiles || []) {
      const p = this.project(shot.x, shot.y), color = arena.actors[shot.owner].color, ball = this.scale * .38;
      for (let i = 1; i <= 3; i++) {
        const q = this.project(shot.x - Math.cos(shot.angle) * i * .45, shot.y - Math.sin(shot.angle) * i * .45);
        c.globalAlpha = .6 - i * .15; c.fillStyle = color; c.beginPath(); c.arc(q.x, q.y, ball * (1 - i * .2), 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1; c.fillStyle = color; c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, ball, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#ffffffb0'; c.beginPath(); c.arc(p.x - ball * .3, p.y - ball * .3, ball * .3, 0, Math.PI * 2); c.fill();
    }
    for (const orb of arena.orbs) {
      const p = this.project(orb.x, orb.y); if (p.x < -20 || p.x > this.width + 20 || p.y < -20 || p.y > this.height + 20) continue;
      const bob = this.reduced ? 0 : Math.sin(time * 3 + orb.phase) * this.scale * .12, size = this.scale * .42;
      c.fillStyle = '#1c2a6e22'; c.beginPath(); c.ellipse(p.x, p.y + size * .95, size * .6, size * .2, 0, 0, Math.PI * 2); c.fill();
      star(c, p.x, p.y + bob, size, size * .5, Math.sin(time + orb.phase) * .3);
      c.fillStyle = '#ffd23a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();
      c.fillStyle = '#fff6c0'; c.beginPath(); c.arc(p.x - size * .18, p.y + bob - size * .2, size * .14, 0, Math.PI * 2); c.fill();
    }
    // Draw the player last so harmless body overlaps never hide the controlled character.
    if (!demo) for (const actor of [...arena.actors.slice(1), player]) if (actor.alive) this.character(actor, arena, time);
    if (!demo && !arena.ended) this.homeArrow(arena, time);
    this.poofs = this.poofs.filter(poof => poof.life > 0);
    for (const poof of this.poofs) {
      poof.life -= dt; const k = Math.max(0, poof.life / 1.2), p = this.project(poof.x, poof.y);
      this.character(poof.actor, null, time, { at: { x: p.x, y: p.y - (1 - k) * this.scale * 4 }, size: .4 + k * .7, spin: (1 - k) * Math.PI * 4, alpha: k, dizzy: true });
    }
    this.rings = this.rings.filter(r => r.life > 0);
    for (const ring of this.rings) {
      ring.life -= dt * 1.6; const p = this.project(ring.x, ring.y), radius = (1 - ring.life) * this.scale * (ring.size || 4);
      c.globalAlpha = Math.max(0, ring.life); c.lineWidth = 6; c.strokeStyle = '#ffffff'; c.beginPath(); c.arc(p.x, p.y, radius, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 2.5; c.strokeStyle = ring.color; c.stroke();
    }
    c.globalAlpha = 1;
    this.particles = this.particles.filter(p => p.life > 0);
    for (const particle of this.particles) {
      particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += dt * 3;
      const p = this.project(particle.x, particle.y), size = 5 * (particle.size || 1), spin = (particle.spin || 0) + time * 4;
      c.globalAlpha = Math.min(1, Math.max(0, particle.life * 1.5)); c.fillStyle = particle.color;
      if (particle.shape === 'paper') { c.save(); c.translate(p.x, p.y); c.rotate(spin); c.fillRect(-size * .5, -size * .3, size, size * .6); c.restore(); }
      else { star(c, p.x, p.y, size, size * .45, spin); c.fill(); }
    }
    c.globalAlpha = 1;
    // Floating words: bright fill with a thick navy outline and a drop shadow.
    this.floats = this.floats.filter(f => f.life > 0);
    for (const float of this.floats) {
      float.life -= dt; const p = this.project(float.x, float.y), grow = this.reduced ? 1 : Math.min(1, (1.5 - float.life) * 6) * (1 + Math.max(0, .25 - (1.5 - float.life)) * 1.2);
      c.save(); c.translate(p.x, p.y - 36 - (1.5 - float.life) * 22); c.scale(grow, grow);
      c.globalAlpha = Math.min(1, Math.max(0, float.life * 1.5)); c.font = `${float.size || 18}px ${FONT}`; c.textAlign = 'center'; c.lineJoin = 'round';
      c.strokeStyle = INK; c.lineWidth = 7; c.strokeText(float.text, 0, 3); c.strokeText(float.text, 0, 0);
      c.fillStyle = float.color; c.fillText(float.text, 0, 0); c.restore();
    }
    c.globalAlpha = 1;
  }
}

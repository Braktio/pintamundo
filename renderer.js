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
    this.pops = {}; this.moods = {}; this.portraits = new Map();
    this.cachedRevision = -1;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    // A phone held upright gets the game turned 90° (orient() in game.js): sides swap.
    const turned = document.body?.classList.contains('turned');
    this.width = turned ? innerHeight : innerWidth; this.height = turned ? innerWidth : innerHeight;
    this.scale = CELL_PIXELS * Math.max(.75, Math.min(1.25, this.height / 470));
    this.dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
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
  // Zones are painted, not tiled: every cell is a round dab of paint, so outlines come out
  // curvy. Border cells get slightly uneven dabs and a few droplets outside, like splashed
  // paint. The whole board is drawn into an offscreen canvas when the map changes (at most
  // about 8 times a second) and copied to the screen every frame.
  rebuild(arena) {
    const px = Math.min(24, Math.max(8, Math.round(this.scale * this.dpr)));
    if (!this.zones || this.zones.width !== WIDTH * px) {
      this.zones = document.createElement('canvas'); this.zones.width = WIDTH * px; this.zones.height = HEIGHT * px;
    }
    const z = this.zones.getContext('2d'), owners = arena.actors.map(() => []);
    z.clearRect(0, 0, this.zones.width, this.zones.height);
    for (let i = 0; i < SIZE; i++) if (arena.grid[i] >= 0) owners[arena.grid[i]]?.push(i);
    // A steady pseudo-random number per cell, so the splashes do not flicker between redraws.
    const noise = (i, salt) => ((Math.imul(i + 1, 2654435761) ^ Math.imul(salt, 40503)) >>> 0) % 1000 / 1000;
    arena.actors.forEach((actor, id) => {
      const dabs = [], marks = [];
      for (const i of owners[id]) {
        const x = i % WIDTH, y = Math.floor(i / WIDTH), mine = j => arena.grid[j] === id;
        const open = [[x > 0 && mine(i - 1), -1, 0], [x < WIDTH - 1 && mine(i + 1), 1, 0], [y > 0 && mine(i - WIDTH), 0, -1], [y < HEIGHT - 1 && mine(i + WIDTH), 0, 1]].filter(n => !n[0]);
        dabs.push([x + .5, y + .5, open.length ? .6 + noise(i, 1) * .22 : .78]);
        // Droplets just outside some border cells, flung outwards.
        if (open.length && noise(i, 2) < .2) {
          const [, dx, dy] = open[Math.floor(noise(i, 3) * open.length)], reach = .75 + noise(i, 4) * .35;
          dabs.push([x + .5 + dx * reach + (noise(i, 5) - .5) * .5, y + .5 + dy * reach + (noise(i, 6) - .5) * .5, .16 + noise(i, 7) * .14]);
        }
        // Lighter patches inside the zone, so it reads as wet paint rather than a flat color.
        if (!open.length && noise(i, 8) < .05) marks.push([x + .5, y + .5, 1 + noise(i, 9) * .6]);
      }
      if (!dabs.length) return;
      const fill = (list, grow, dy, style, alpha = 1) => {
        z.beginPath();
        for (const [x, y, r] of list) { const cx = x * px, cy = (y + dy) * px, rr = Math.max(.05, r + grow) * px; z.moveTo(cx + rr, cy); z.arc(cx, cy, rr, 0, Math.PI * 2); }
        z.globalAlpha = alpha; z.fillStyle = style; z.fill(); z.globalAlpha = 1;
      };
      fill(dabs, .13, .24, shade(actor.color, -.3));
      fill(dabs, .13, 0, INK);
      fill(dabs, 0, 0, shade(actor.color, .48));
      fill(marks, 0, 0, shade(actor.color, .66), .55);
    });
    this.cachedArena = arena; this.cachedRevision = arena.revision; this.zonesScale = this.scale; this.builtAt = performance.now();
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
      if (event.trail?.length) {
        const points = this.paths?.[event.id]?.points || event.trail.map(coords), at = event.cutIndex >= 0 ? coords(event.cutIndex) : null;
        const cut = at ? points.reduce((best, p, i) => Math.hypot(p.x - at.x, p.y - at.y) < Math.hypot(points[best].x - at.x, points[best].y - at.y) ? i : best, 0) : -1;
        this.brokenTrails.push({ points, cut, color: victim.color, life: 1.2 });
        delete this.paths?.[event.id];
      }
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
  // Zones: the painted board from rebuild(), refreshed when the map changes.
  territory(arena) {
    const stale = this.cachedArena !== arena || this.zonesScale !== this.scale;
    if (stale || (this.cachedRevision !== arena.revision && performance.now() - this.builtAt > 120)) this.rebuild(arena);
    const a = this.project(0, 0);
    this.ctx.drawImage(this.zones, a.x, a.y, WIDTH * this.scale, HEIGHT * this.scale);
  }
  // The real route of an actor since it left its zone (positions sampled as it moves), so
  // its paint trail follows the movement smoothly instead of stepping along grid cells.
  path(actor) {
    this.paths ??= {};
    if (!actor.alive || !actor.trail.length) { delete this.paths[actor.id]; return []; }
    let route = this.paths[actor.id];
    if (!route || route.first !== actor.trail[0]) route = this.paths[actor.id] = { first: actor.trail[0], points: actor.trail.map(coords) };
    const last = route.points.at(-1);
    if (Math.hypot(actor.x - last.x, actor.y - last.y) > .3) route.points.push({ x: actor.x, y: actor.y });
    return [...route.points, { x: actor.x, y: actor.y }];
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
  // Every character is assembled with full cartoon volume, expressive eyes and bespoke traits.
  character(actor, arena, time, options = {}) {
    const c = this.ctx, s = this.scale * (options.size || 1), p = options.at || this.project(actor.x, actor.y);
    if (p.x < -80 || p.x > this.width + 80 || p.y < -80 || p.y > this.height + 80) return;
    const skin = actor.skin || 'interceptor';
    const charDef = characterFor(skin);
    const look = charDef.look, rarity = actor.rarity || charDef.rarity;
    const r = s * .78, still = options.still || options.idle, id = actor.id || 0;
    const dx = still ? 0 : Math.cos(actor.angle), dy = still ? 0 : Math.sin(actor.angle);
    const bounce = this.reduced || options.still ? 1 : 1 + Math.sin(time * (options.idle ? 4 : 11) + id * 1.7) * (options.idle ? .05 : .04);
    const lw = Math.max(2.8, r * .11), extras = new Set(look.extras);

    c.save(); c.translate(p.x, p.y);
    if (options.spin) c.rotate(options.spin);
    if (options.alpha !== undefined) c.globalAlpha = options.alpha;

    // Legendary and mythic characters carry orbiting cartoon sparkle stars
    if ((rarity === 'legendario' || rarity === 'mitico') && !options.still) {
      c.fillStyle = RARITIES[rarity].color;
      for (let i = 0; i < 3; i++) {
        const a = time * 2 + i * Math.PI * 2 / 3;
        star(c, Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.2, r * .22, r * .09, a);
        c.fill();
      }
    }

    // Soft cartoon ground shadow
    c.fillStyle = '#1c2a6e30';
    c.beginPath();
    c.ellipse(0, r * 0.96, r * 0.94, r * 0.28, 0, 0, Math.PI * 2);
    c.fill();

    if (arena?.active(actor, 'paint')) {
      c.strokeStyle = actor.color; c.lineWidth = 3.5; c.setLineDash([6, 6]); c.lineDashOffset = -time * 30;
      c.beginPath(); c.ellipse(0, r * .9, r * 1.5, r * .55, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    if (arena?.active(actor, 'dash')) {
      c.strokeStyle = actor.color + 'aa'; c.lineWidth = 3.5; c.lineCap = 'round';
      for (const offset of [-.45, 0, .45]) {
        const ox = -dy * offset * r, oy = dx * offset * r, from = 1.2 + Math.abs(offset), wobble = Math.sin(time * 30 + offset * 9) * .2;
        c.beginPath(); c.moveTo(ox - dx * r * from, oy - dy * r * from); c.lineTo(ox - dx * r * (from + .9 + wobble), oy - dy * r * (from + .9 + wobble)); c.stroke();
      }
    }
    if (!still) {
      c.fillStyle = actor.color || '#ffffff'; c.strokeStyle = INK; c.lineWidth = 2.5; c.lineJoin = 'round'; c.beginPath();
      c.moveTo(dx * r * 1.6, dy * r * 1.6); c.lineTo(dx * r * 1.15 - dy * r * .34, dy * r * 1.15 + dx * r * .34); c.lineTo(dx * r * 1.15 + dy * r * .34, dy * r * 1.15 - dx * r * .34); c.closePath(); c.fill(); c.stroke();
    }

    c.scale(1 / bounce, bounce);

    // 1. Elements behind body: wings, manes, shells, saucer, tail, tentacles
    this.behind(actor, look, extras, r, time);

    // 2. Ears and headwear behind the body
    this.ears(actor, look, r, time, false);

    // 3. Volumetric body fill (3D cartoon radial gradient)
    const baseColor = look.color;
    const bodyGrad = c.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.08, 0, 0, r * 1.18);
    bodyGrad.addColorStop(0, shade(baseColor, 0.44));
    bodyGrad.addColorStop(0.35, shade(baseColor, 0.14));
    bodyGrad.addColorStop(0.75, baseColor);
    bodyGrad.addColorStop(1, shade(baseColor, -0.32));
    c.fillStyle = bodyGrad;
    this.bodyPath(look.shape, r, time, skin);
    c.fill();

    // Soft bottom bounce lighting
    const bounceGrad = c.createLinearGradient(0, r * 0.45, 0, r * 1.05);
    bounceGrad.addColorStop(0, 'rgba(255,255,255,0)');
    bounceGrad.addColorStop(1, shade(baseColor, 0.32) + '44');
    c.fillStyle = bounceGrad;
    this.bodyPath(look.shape, r, time, skin);
    c.fill();

    // 4. Body decorations (clipped to body silhouette)
    c.save();
    this.bodyPath(look.shape, r, time, skin);
    c.clip();
    this.decorate(actor, look, extras, r, time);
    c.restore();

    // 5. Body cartoon ink outline
    c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
    this.bodyPath(look.shape, r, time, skin);
    c.stroke();

    // 6. Glossy specular shine along top-left dome curve
    c.save();
    this.bodyPath(look.shape, r, time, skin);
    c.clip();
    c.beginPath();
    c.ellipse(-r * 0.25, -r * 0.48, r * 0.65, r * 0.38, -0.38, 0, Math.PI * 2);
    const gloss = c.createLinearGradient(-r * 0.55, -r * 0.85, 0, 0);
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.62)');
    gloss.addColorStop(0.45, 'rgba(255, 255, 255, 0.16)');
    gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = gloss;
    c.fill();
    // Specular glint dot
    c.fillStyle = 'rgba(255, 255, 255, 0.88)';
    c.beginPath();
    c.ellipse(-r * 0.44, -r * 0.52, r * 0.15, r * 0.08, -0.7, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // 7. Expressive cartoon face
    this.face(actor, look, extras, r, time, dx, dy, options);

    // 8. Headwear / ears in front of body (crown, unicorn horn, beret, tuft, headband)
    this.ears(actor, look, r, time, true);

    // Astronaut bubble helmet visor
    if (extras.has('helmet')) {
      c.fillStyle = '#bfefff38'; c.lineWidth = lw * .8; c.strokeStyle = INK;
      c.beginPath(); c.arc(0, -r * .04, r * 1.22, 0, Math.PI * 2); c.fill(); c.stroke();
      // Planetary curved glare reflection
      c.strokeStyle = '#ffffffcc'; c.lineWidth = r * .11; c.lineCap = 'round';
      c.beginPath(); c.arc(0, -r * .04, r * 1.02, Math.PI * 1.15, Math.PI * 1.48); c.stroke();
      c.strokeStyle = '#ffffff88'; c.lineWidth = r * .06;
      c.beginPath(); c.arc(0, -r * .04, r * 1.02, Math.PI * 1.54, Math.PI * 1.68); c.stroke();
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

  bodyPath(shape, r, time, skin = '') {
    const c = this.ctx; c.beginPath();
    if (shape === 'box') {
      c.roundRect(-r * 0.96, -r * 0.88, r * 1.92, r * 1.76, r * 0.38);
    } else if (shape === 'drop') {
      c.moveTo(0, -r * 1.25);
      c.bezierCurveTo(r * 0.58, -r * 0.6, r * 1.06, -r * 0.08, r * 0.96, r * 0.38);
      c.arc(0, r * 0.22, r * 0.96, 0.16, Math.PI - 0.16);
      c.bezierCurveTo(-r * 1.06, -r * 0.08, -r * 0.58, -r * 0.6, 0, -r * 1.25);
    } else if (shape === 'ghost') {
      c.moveTo(-r * 0.96, r * 0.82);
      c.lineTo(-r * 0.96, -r * 0.1);
      c.arc(0, -r * 0.1, r * 0.96, Math.PI, 0);
      c.lineTo(r * 0.96, r * 0.82);
      for (let i = 0; i < 4; i++) {
        c.quadraticCurveTo(r * (1 - (i + 0.5) * 0.5), r * (i % 2 ? 0.96 : 0.62) + Math.sin(time * 7 + i) * r * 0.06, r * (1 - (i + 1) * 0.5), r * 0.82);
      }
    } else {
      // Chubby cartoon rounded pear (adorable cheeks and spherical base)
      c.moveTo(0, -r * 0.96);
      c.bezierCurveTo(r * 0.94, -r * 0.96, r * 1.08, r * 0.22, r * 0.96, r * 0.85);
      c.bezierCurveTo(r * 0.88, r * 1.06, -r * 0.88, r * 1.06, -r * 0.96, r * 0.85);
      c.bezierCurveTo(-r * 1.08, r * 0.22, -r * 0.94, -r * 0.96, 0, -r * 0.96);
    }
    c.closePath();
  }

  // Pieces drawn behind the body: wings, mane, saucer, fluff, rainbow, turtle shell, tail
  behind(actor, look, extras, r, time) {
    const c = this.ctx, skin = actor.skin || '', accent = look.accent;
    const flap = Math.sin(time * 9) * 0.14;

    // Rainbow arch
    if (extras.has('rainbow') || skin === 'arcoiris') {
      for (const [i, color] of ['#ff4f6d', '#ffd23a', '#6fdc3c', '#4fc3ff', '#b45cff'].entries()) {
        c.strokeStyle = INK; c.lineWidth = r * 0.22; c.beginPath();
        c.arc(0, r * 0.12, r * (1.62 - i * 0.16), Math.PI * 1.02, Math.PI * 1.98); c.stroke();
        c.strokeStyle = color; c.lineWidth = r * 0.14; c.stroke();
      }
    }

    // Turtle shell and little green feet
    if (skin === 'tortuga') {
      // Little cartoon feet
      c.fillStyle = look.color; c.strokeStyle = INK; c.lineWidth = Math.max(2, r * 0.09);
      for (const [fx, fy] of [[-r * 0.82, r * 0.72], [r * 0.82, r * 0.72], [-r * 0.65, -r * 0.6], [r * 0.65, -r * 0.6]]) {
        c.beginPath(); c.ellipse(fx, fy, r * 0.24, r * 0.16, fx > 0 ? 0.35 : -0.35, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      // Domed shell behind
      const shellGrad = c.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.35);
      shellGrad.addColorStop(0, '#3aa316'); shellGrad.addColorStop(1, '#1b5e08');
      c.fillStyle = shellGrad; c.beginPath(); c.arc(0, 0, r * 1.25, 0, Math.PI * 2); c.fill();
      c.strokeStyle = INK; c.lineWidth = Math.max(3, r * 0.11); c.stroke();
      // Hexagonal scute pattern on shell rim
      c.strokeStyle = '#ffd23a'; c.lineWidth = r * 0.06;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        c.beginPath(); c.moveTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
        c.lineTo(Math.cos(a) * r * 1.24, Math.sin(a) * r * 1.24); c.stroke();
      }
    }

    // Lion magnificent fluffy cartoon mane
    if (skin === 'leon' || (extras.has('mane') && skin !== 'unicornio')) {
      const maneGrad = c.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.55);
      maneGrad.addColorStop(0, '#ff9a1f'); maneGrad.addColorStop(0.7, '#d86608'); maneGrad.addColorStop(1, '#943b00');
      c.fillStyle = maneGrad; c.lineWidth = Math.max(2.5, r * 0.1); c.strokeStyle = INK;
      c.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2, k = i % 2 ? 1.22 : 1.52;
        c.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k);
      }
      c.closePath(); c.fill(); c.stroke();
    }

    // Unicorn flowing pastel mane
    if (skin === 'unicornio') {
      const maneColors = ['#ff8ad8', '#b45cff', '#7be0ff', '#ffd23a'];
      c.lineWidth = Math.max(2.5, r * 0.09); c.strokeStyle = INK;
      for (let i = 0; i < 4; i++) {
        c.fillStyle = maneColors[i % maneColors.length];
        c.beginPath();
        c.ellipse(-r * 0.7 + i * r * 0.12, -r * 0.2 + i * r * 0.25, r * 0.32, r * 0.55, -0.5 + i * 0.15, 0, Math.PI * 2);
        c.fill(); c.stroke();
      }
    }

    // Fluff (Yeti)
    if (extras.has('fluff') || skin === 'yeti') {
      c.fillStyle = '#ffffff'; c.lineWidth = Math.max(2.5, r * 0.09); c.strokeStyle = INK;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        c.beginPath(); c.arc(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.28, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    }

    // Wings
    if (extras.has('wings') || ['interceptor', 'patito', 'pinguino', 'buho', 'fenix', 'abeja', 'phoenix'].includes(skin)) {
      c.lineWidth = Math.max(2.5, r * 0.1); c.strokeStyle = INK;

      // Bee translucent fairy wings
      if (skin === 'abeja') {
        const wingFlap = Math.sin(time * 22) * 0.22;
        c.fillStyle = 'rgba(215, 245, 255, 0.72)';
        for (const side of [-1, 1]) {
          c.beginPath();
          c.ellipse(side * r * 0.92, -r * (0.65 + wingFlap), r * 0.38, r * 0.72, side * 0.45, 0, Math.PI * 2);
          c.fill(); c.stroke();
          // Inner wing vein highlight
          c.strokeStyle = '#ffffffcc'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(side * r * 0.7, -r * 0.3); c.lineTo(side * r * 1.15, -r * 0.85); c.stroke();
          c.strokeStyle = INK; c.lineWidth = Math.max(2.5, r * 0.1);
        }
      } else if (skin === 'fenix') {
        // Blazing fiery wings
        for (const side of [-1, 1]) {
          const wingGrad = c.createLinearGradient(side * r * 0.5, 0, side * r * 1.6, -r * 0.8);
          wingGrad.addColorStop(0, '#ffd23a'); wingGrad.addColorStop(0.5, '#ff5a1f'); wingGrad.addColorStop(1, '#c41200');
          c.fillStyle = wingGrad;
          c.beginPath();
          c.moveTo(side * r * 0.75, r * 0.1);
          c.quadraticCurveTo(side * r * 1.3, -r * (0.4 + flap), side * r * 1.7, -r * (0.8 + flap));
          c.quadraticCurveTo(side * r * 1.45, -r * 0.1, side * r * 1.35, r * 0.4);
          c.closePath(); c.fill(); c.stroke();
        }
      } else if (skin === 'phoenix') {
        // Dragon emerald wings with golden membrane
        for (const side of [-1, 1]) {
          c.fillStyle = '#ffe9a8';
          c.beginPath();
          c.moveTo(side * r * 0.75, 0);
          c.lineTo(side * r * 1.55, -r * (0.7 + flap));
          c.lineTo(side * r * 1.4, r * 0.35);
          c.closePath(); c.fill(); c.stroke();
          // Outer dragon wing bone
          c.strokeStyle = '#3aa316'; c.lineWidth = r * 0.12;
          c.beginPath(); c.moveTo(side * r * 0.75, 0); c.lineTo(side * r * 1.55, -r * (0.7 + flap)); c.stroke();
          c.strokeStyle = INK; c.lineWidth = Math.max(2.5, r * 0.1);
        }
      } else {
        // Plump cartoon bird winglets (Pollito, Patito, Pingüi, Búho)
        for (const side of [-1, 1]) {
          c.save();
          c.translate(side * r * 0.84, r * 0.22);
          c.rotate(side * (0.2 + flap));
          const wingGrad = c.createRadialGradient(-side * r * 0.1, -r * 0.1, 0, 0, 0, r * 0.45);
          const wingCol = skin === 'pinguino' ? '#253366' : skin === 'patito' ? '#ffffff' : skin === 'buho' ? '#8c5932' : look.color;
          wingGrad.addColorStop(0, shade(wingCol, 0.35));
          wingGrad.addColorStop(1, shade(wingCol, -0.2));
          c.fillStyle = wingGrad;
          c.beginPath();
          c.ellipse(0, 0, r * 0.26, r * 0.42, side * 0.15, 0, Math.PI * 2);
          c.fill(); c.stroke();
          c.restore();
        }
      }
    }

    // Saucer for UFO
    if (extras.has('saucer') || skin === 'disc') {
      const saucerGrad = c.createLinearGradient(0, r * 0.1, 0, r * 0.65);
      saucerGrad.addColorStop(0, '#c9d6e8'); saucerGrad.addColorStop(1, '#673ab7');
      c.fillStyle = saucerGrad; c.lineWidth = Math.max(3, r * 0.11); c.strokeStyle = INK;
      c.beginPath(); c.ellipse(0, r * 0.42, r * 1.55, r * 0.46, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      // Glowing porthole lights
      for (const x of [-1.1, -0.55, 0, 0.55, 1.1]) {
        c.fillStyle = '#ffd23a';
        c.beginPath(); c.ellipse(x * r, r * 0.52, r * 0.14, r * 0.11, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      }
    }

    // Octopus tentacles
    if (skin === 'pulpo') {
      c.lineWidth = Math.max(2.5, r * 0.09); c.strokeStyle = INK;
      for (let i = 0; i < 4; i++) {
        const tx = (i - 1.5) * r * 0.52;
        const tw = Math.sin(time * 6 + i) * r * 0.08;
        c.fillStyle = look.color;
        c.beginPath();
        c.ellipse(tx + tw, r * 0.95, r * 0.2, r * 0.28, 0, 0, Math.PI * 2);
        c.fill(); c.stroke();
        // Little suction cup
        c.fillStyle = '#ff8ad8';
        c.beginPath(); c.circle ? c.circle(tx + tw, r * 1.02, r * 0.08) : c.arc(tx + tw, r * 1.02, r * 0.08, 0, Math.PI * 2);
        c.fill();
      }
    }

    // Tails (Fox, Cat, Shark)
    if (skin === 'zorro') {
      // Bushy fox tail with white tip
      c.fillStyle = '#ff7a2a'; c.strokeStyle = INK; c.lineWidth = Math.max(2.5, r * 0.1);
      c.beginPath();
      c.ellipse(r * 1.05, r * 0.35, r * 0.45, r * 0.75, 0.65, 0, Math.PI * 2);
      c.fill(); c.stroke();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.ellipse(r * 1.32, -r * 0.08, r * 0.25, r * 0.32, 0.65, 0, Math.PI * 2);
      c.fill(); c.stroke();
    } else if (skin === 'tron') {
      // Cat tail
      c.strokeStyle = INK; c.lineWidth = r * 0.22; c.lineCap = 'round';
      c.beginPath(); c.moveTo(r * 0.7, r * 0.6); c.quadraticCurveTo(r * 1.35, r * 0.5, r * 1.25, 0); c.stroke();
      c.strokeStyle = look.color; c.lineWidth = r * 0.14; c.stroke();
    }
  }

  // Ears, crests and headwear
  ears(actor, look, r, time, front) {
    const c = this.ctx, type = look.ears, accent = look.accent, skin = actor.skin || '', lw = Math.max(2.5, r * .1);
    c.lineWidth = lw; c.fillStyle = look.color; c.strokeStyle = INK;
    const tri = (a, b, d, fill) => { c.fillStyle = fill; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.closePath(); c.fill(); c.stroke(); };

    if (!front) {
      // Frog bulbous eye domes (Rana Zuzú)
      if (skin === 'rana') {
        for (const side of [-1, 1]) {
          const domeGrad = c.createRadialGradient(side * r * 0.5, -r * 1.05, 0, side * r * 0.5, -r * 0.95, r * 0.4);
          domeGrad.addColorStop(0, '#a6f04a'); domeGrad.addColorStop(1, '#4db814');
          c.fillStyle = domeGrad;
          c.beginPath(); c.arc(side * r * 0.5, -r * 0.88, r * 0.36, 0, Math.PI * 2); c.fill(); c.stroke();
        }
      }

      // Pointed cat / fox / pig ears
      if (type === 'cat' && skin !== 'cerdito') {
        for (const side of [-1, 1]) {
          const earGrad = c.createLinearGradient(side * r * 0.5, -r * 0.4, side * r * 0.75, -r * 1.25);
          earGrad.addColorStop(0, look.color); earGrad.addColorStop(1, shade(look.color, 0.3));
          tri([side * r * .88, -r * .3], [side * r * .76, -r * 1.26], [side * r * .2, -r * .82], earGrad);
          tri([side * r * .7, -r * .55], [side * r * .66, -r * 1.02], [side * r * .36, -r * .78], '#ffa8cc');
        }
      }

      // Pig cute folded ears
      if (skin === 'cerdito') {
        for (const side of [-1, 1]) {
          c.fillStyle = '#ffa8cc';
          c.beginPath(); c.ellipse(side * r * 0.72, -r * 0.75, r * 0.28, r * 0.38, side * 0.45, 0, Math.PI * 2); c.fill(); c.stroke();
          c.fillStyle = '#ff6fa5';
          c.beginPath(); c.ellipse(side * r * 0.7, -r * 0.72, r * 0.16, r * 0.24, side * 0.45, 0, Math.PI * 2); c.fill();
        }
      }

      // Round volumetric ears (Bear, Mouse, Panda, Koala, Mole)
      if (type === 'bear') {
        const isMouse = skin === 'raton', isPanda = skin === 'panda', isKoala = skin === 'koala';
        const earR = r * (isMouse || isKoala ? 0.44 : 0.34);
        for (const side of [-1, 1]) {
          const earGrad = c.createRadialGradient(side * r * 0.75, -r * 0.75, 0, side * r * 0.75, -r * 0.75, earR);
          earGrad.addColorStop(0, shade(look.color, 0.25)); earGrad.addColorStop(1, shade(look.color, -0.15));
          c.fillStyle = earGrad;
          c.beginPath(); c.arc(side * r * 0.75, -r * 0.75, earR, 0, Math.PI * 2); c.fill(); c.stroke();
          // Inner ear pad
          c.fillStyle = isPanda ? '#1c2a6e' : isMouse ? '#ff9fc4' : isKoala ? '#ffffff' : accent;
          c.beginPath(); c.arc(side * r * 0.75, -r * 0.75, earR * 0.56, 0, Math.PI * 2); c.fill();
        }
      }

      // Tall bunny ears
      if (type === 'bunny') {
        for (const side of [-1, 1]) {
          const bGrad = c.createLinearGradient(side * r * 0.4, -r * 0.5, side * r * 0.4, -r * 1.55);
          bGrad.addColorStop(0, look.color); bGrad.addColorStop(1, shade(look.color, 0.25));
          c.fillStyle = bGrad;
          c.beginPath(); c.ellipse(side * r * .42, -r * 1.25, r * .24, r * .64, side * .15, 0, Math.PI * 2); c.fill(); c.stroke();
          c.fillStyle = '#ff8fb0';
          c.beginPath(); c.ellipse(side * r * .42, -r * 1.22, r * .12, r * .44, side * .15, 0, Math.PI * 2); c.fill();
        }
      }

      // Antenna (Abeja, Robo, Cohete)
      if (type === 'antenna') {
        c.beginPath(); c.moveTo(0, -r * .85); c.lineTo(0, -r * 1.4); c.stroke();
        c.fillStyle = Math.sin(time * 6) > 0 ? '#ffd23a' : '#ffffff';
        c.beginPath(); c.arc(0, -r * 1.45, r * .18, 0, Math.PI * 2); c.fill(); c.stroke();
      }

      // Shark sleek dorsal fin
      if (type === 'fin' || skin === 'tiburon') {
        const finGrad = c.createLinearGradient(0, -r * 0.8, 0, -r * 1.6);
        finGrad.addColorStop(0, look.color); finGrad.addColorStop(1, '#82b1ff');
        c.fillStyle = finGrad;
        c.beginPath();
        c.moveTo(-r * 0.35, -r * 0.8);
        c.quadraticCurveTo(0, -r * 1.25, r * 0.12, -r * 1.6);
        c.quadraticCurveTo(r * 0.1, -r * 1.15, r * 0.42, -r * 0.78);
        c.closePath(); c.fill(); c.stroke();
      }

      // Horns (Dragon, Owl tufts, Yeti)
      if (type === 'horns') {
        for (const side of [-1, 1]) {
          const hornGrad = c.createLinearGradient(side * r * 0.5, -r * 0.6, side * r * 0.8, -r * 1.35);
          hornGrad.addColorStop(0, accent); hornGrad.addColorStop(1, '#ffffff');
          tri([side * r * .62, -r * .62], [side * r * .82, -r * 1.35], [side * r * .22, -r * .9], hornGrad);
        }
      }

      // Crest (Fenix)
      if (type === 'crest') {
        for (const [i, x] of [-.35, 0, .35].entries()) {
          const cGrad = c.createLinearGradient(x * r, -r * 0.8, x * r, -r * 1.5);
          cGrad.addColorStop(0, '#ff5a1f'); cGrad.addColorStop(1, '#ffd23a');
          tri([x * r - r * .18, -r * .8], [x * r + (i - 1) * r * .15, -r * (1.45 + (i === 1 ? .25 : 0)) + Math.sin(time * 8 + i) * r * .06], [x * r + r * .18, -r * .8], cGrad);
        }
      }

      // Gem crystals (Golem)
      if (type === 'crystal') {
        for (const [i, x] of [-.45, 0, .45].entries()) {
          const crGrad = c.createLinearGradient(x * r, -r * 0.75, x * r, -r * 1.5);
          crGrad.addColorStop(0, '#00bcd4'); crGrad.addColorStop(1, '#e0f7fa');
          tri([x * r - r * .2, -r * .75], [x * r, -r * (i === 1 ? 1.6 : 1.25)], [x * r + r * .2, -r * .75], crGrad);
        }
      }
      return;
    }

    // --- FRONT HEADWEAR ---

    // Feather crest tuft (Pollito Pip, Patito Cuá)
    if (type === 'tuft') {
      for (const [idx, angle, scale] of [[-0.12, -0.3, 0.9], [0.12, 0.35, 1.05]]) {
        c.save();
        c.translate(angle * r * 0.38, -r * 0.95);
        c.rotate(angle);
        const tuftGrad = c.createLinearGradient(0, -r * 0.4 * scale, 0, 0);
        tuftGrad.addColorStop(0, '#ffd23a'); tuftGrad.addColorStop(1, '#ff7a00');
        c.fillStyle = tuftGrad; c.lineWidth = Math.max(2, r * 0.08); c.strokeStyle = INK;
        c.beginPath(); c.ellipse(0, -r * 0.2 * scale, r * 0.11 * scale, r * 0.26 * scale, 0, 0, Math.PI * 2);
        c.fill(); c.stroke();
        c.fillStyle = '#ffffffbb';
        c.beginPath(); c.ellipse(-r * 0.03, -r * 0.25 * scale, r * 0.04, r * 0.12 * scale, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }

    // Halo (Burbujín)
    if (type === 'halo') {
      c.strokeStyle = INK; c.lineWidth = r * .24; c.beginPath(); c.ellipse(0, -r * 1.3, r * .56, r * .2, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#ffd23a'; c.lineWidth = r * .14; c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = r * .05; c.stroke();
    }

    // Royal 3-pointed golden crown with sparkling ruby (León Rey, Rey Arcoíris)
    if (type === 'crown' || skin === 'leon' || skin === 'arcoiris') {
      const crownGrad = c.createLinearGradient(0, -r * 1.45, 0, -r * 0.75);
      crownGrad.addColorStop(0, '#fff59d'); crownGrad.addColorStop(0.5, '#ffd23a'); crownGrad.addColorStop(1, '#f57f17');
      c.fillStyle = crownGrad; c.lineWidth = Math.max(2.5, r * 0.1); c.strokeStyle = INK;
      c.beginPath();
      c.moveTo(-r * 0.55, -r * 0.78);
      c.lineTo(-r * 0.62, -r * 1.35);
      c.lineTo(-r * 0.28, -r * 1.05);
      c.lineTo(0, -r * 1.48);
      c.lineTo(r * 0.28, -r * 1.05);
      c.lineTo(r * 0.62, -r * 1.35);
      c.lineTo(r * 0.55, -r * 0.78);
      c.closePath(); c.fill(); c.stroke();
      // Sparkling center ruby
      c.fillStyle = '#ff1744';
      c.beginPath(); c.arc(0, -r * 0.95, r * 0.14, 0, Math.PI * 2); c.fill();
      c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(-r * 0.04, -r * 0.98, r * 0.04, 0, Math.PI * 2); c.fill();
    }

    // Artist Beret (Pintor Rodi)
    if (type === 'beret') {
      const beretGrad = c.createRadialGradient(r * 0.15, -r * 1.1, 0, r * 0.1, -r * 0.9, r * 0.7);
      beretGrad.addColorStop(0, '#5390ff'); beretGrad.addColorStop(1, '#1a4fc7');
      c.fillStyle = beretGrad;
      c.beginPath(); c.ellipse(r * .1, -r * .92, r * .72, r * .32, -.22, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(r * .15, -r * 1.18); c.lineTo(r * .24, -r * 1.38); c.stroke();
    }

    // Unicorn golden spiral horn
    if (type === 'unicorn' || skin === 'unicornio') {
      const hornGrad = c.createLinearGradient(0, -r * 1.7, 0, -r * 0.85);
      hornGrad.addColorStop(0, '#ffffff'); hornGrad.addColorStop(0.4, '#ffd23a'); hornGrad.addColorStop(1, '#ff9a1f');
      tri([-r * .17, -r * .85], [0, -r * 1.7], [r * .17, -r * .85], hornGrad);
      c.strokeStyle = '#ff8ad8'; c.lineWidth = r * .07; c.beginPath();
      c.moveTo(-r * .1, -r * 1.05); c.lineTo(r * .1, -r * 1.15);
      c.moveTo(-r * .06, -r * 1.3); c.lineTo(r * .07, -r * 1.38); c.stroke();
      // Sparkle at tip
      c.fillStyle = '#ffffff';
      star(c, 0, -r * 1.72, r * 0.14, r * 0.05); c.fill();
    }

    // Ninja crimson headband
    if (skin === 'ninja') {
      c.fillStyle = '#ff1744'; c.lineWidth = Math.max(2.5, r * 0.09); c.strokeStyle = INK;
      c.fillRect(-r * 1.1, -r * 0.75, r * 2.2, r * 0.28);
      c.strokeRect(-r * 1.1, -r * 0.75, r * 2.2, r * 0.28);
      // Trailing fluttering ribbons
      c.beginPath();
      c.moveTo(r * 1.05, -r * 0.65);
      c.quadraticCurveTo(r * 1.45, -r * 0.8, r * 1.6, -r * 0.5);
      c.lineTo(r * 1.55, -r * 0.38);
      c.quadraticCurveTo(r * 1.35, -r * 0.6, r * 1.05, -r * 0.5);
      c.closePath(); c.fill(); c.stroke();
    }
  }

  // Decorations clipped to body silhouette
  decorate(actor, look, extras, r, time) {
    const c = this.ctx, accent = look.accent, skin = actor.skin || '';

    // Belly patch
    if (extras.has('belly') || ['pinguino', 'patito', 'osito', 'zorro', 'phoenix', 'buho', 'tiburon'].includes(skin)) {
      const bellyCol = skin === 'pinguino' ? '#ffffff' : skin === 'phoenix' ? '#ffe9a8' : skin === 'tiburon' ? '#ffffff' : accent;
      const bGrad = c.createLinearGradient(0, r * 0.1, 0, r * 0.95);
      bGrad.addColorStop(0, bellyCol); bGrad.addColorStop(1, shade(bellyCol, -0.15));
      c.fillStyle = bGrad;
      c.beginPath(); c.ellipse(0, r * .48, r * .64, r * .46, 0, 0, Math.PI * 2); c.fill();
    }

    // Spots (Rana, Hongo, Pulpo)
    if (extras.has('spots') || skin === 'rana' || skin === 'hongo' || skin === 'pulpo') {
      c.fillStyle = skin === 'hongo' ? '#ffffff' : accent;
      for (const [x, y, k] of [[-.62, -.5, .16], [.66, .35, .17], [-.4, .66, .13], [.2, -.82, .14], [.72, -.35, .1]]) {
        c.beginPath(); c.arc(x * r, y * r, k * r, 0, Math.PI * 2); c.fill();
        if (skin === 'hongo') { c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); }
      }
    }

    // Bumblebee black velvet stripes
    if (skin === 'abeja' || extras.has('bands')) {
      c.fillStyle = '#1c2a6e';
      for (const y of [.18, .54]) {
        c.fillRect(-r * 1.2, y * r, r * 2.4, r * .22);
      }
    }

    // Gato Rayo electric lightning cheek stripes
    if (skin === 'tron' || extras.has('stripes')) {
      c.fillStyle = '#ffd23a'; c.strokeStyle = INK; c.lineWidth = 2;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(side * r * 0.55, -r * 0.05);
        c.lineTo(side * r * 0.95, -r * 0.15);
        c.lineTo(side * r * 0.75, r * 0.1);
        c.lineTo(side * r * 1.05, r * 0.02);
        c.lineTo(side * r * 0.65, r * 0.25);
        c.closePath(); c.fill(); c.stroke();
      }
    }

    // Mapache bandit mask
    if (skin === 'mapache' || extras.has('mask')) {
      c.fillStyle = '#1c2a6e';
      c.beginPath(); c.roundRect(-r * 1.15, -r * .48, r * 2.3, r * .56, r * .28); c.fill();
      // White eye trim
      c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke();
    }

    // Panda black eye patches
    if (skin === 'panda' || extras.has('patches')) {
      c.fillStyle = '#1c2a6e';
      for (const side of [-1, 1]) {
        c.beginPath(); c.ellipse(side * r * .38, -r * .16, r * .32, r * .42, side * .45, 0, Math.PI * 2); c.fill();
      }
    }

    // Robot & Rocket digital screen visor
    if (skin === 'rift' || skin === 'cohete') {
      c.fillStyle = '#0f172a';
      c.beginPath(); c.roundRect(-r * 0.75, -r * 0.55, r * 1.5, r * 0.85, r * 0.2); c.fill();
      c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    }

    // Artist paint splatters (Pintor Rodi)
    if (skin === 'pintor') {
      const spots = [['#ff4081', -0.65, 0.45, 0.12], ['#00e5ff', 0.65, 0.42, 0.11], ['#ffd23a', -0.35, 0.72, 0.1]];
      for (const [col, sx, sy, sr] of spots) {
        c.fillStyle = col; c.beginPath(); c.arc(sx * r, sy * r, sr * r, 0, Math.PI * 2); c.fill();
      }
    }
  }

  // Cartoon expressive face: lively eyes with dual catchlights, blush, and personality
  face(actor, look, extras, r, time, dx, dy, options) {
    const c = this.ctx, id = actor.id || 0, eyes = look.eyes, skin = actor.skin || '', accent = look.accent || '#ffd23a';
    const tri = (a, b, d, fill) => { c.fillStyle = fill; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.closePath(); c.fill(); c.stroke(); };
    const blink = !this.reduced && !options.still && (time + id * .73) % 4 < .12;
    const eye = r * (eyes === 'big' || skin === 'rana' || skin === 'buho' ? .34 : .29);
    const ex = r * (skin === 'rana' ? .5 : .34);
    const ey = -r * (skin === 'rana' ? .85 : .18);

    c.lineWidth = Math.max(2, r * .07); c.strokeStyle = INK;

    // Pupil renderer with cartoon dual sparkles
    const pupil = (x, y, size, irisCol = INK) => {
      const px = x + dx * size * .35, py = y + dy * size * .35;
      const pr = size * 0.72;
      c.fillStyle = irisCol;
      c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fill();
      // Primary big glossy catchlight circle (top-left)
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(px - pr * 0.32, py - pr * 0.34, pr * 0.4, 0, Math.PI * 2); c.fill();
      // Secondary smaller twinkle dot (bottom-right)
      c.beginPath(); c.arc(px + pr * 0.38, py + pr * 0.38, pr * 0.2, 0, Math.PI * 2); c.fill();
    };

    if (options.dizzy) {
      c.lineWidth = 3;
      for (const side of [-1, 1]) {
        c.beginPath(); c.moveTo(side * ex - eye * .7, ey - eye * .7); c.lineTo(side * ex + eye * .7, ey + eye * .7);
        c.moveTo(side * ex + eye * .7, ey - eye * .7); c.lineTo(side * ex - eye * .7, ey + eye * .7); c.stroke();
      }
    } else if (eyes === 'cyclops' || skin === 'golem') {
      // Glowing cyclops gem eye
      const big = r * .44;
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(0, ey, big, blink ? big * .15 : big, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      if (!blink) pupil(0, ey, big, '#00bcd4');
    } else {
      for (const side of [-1, 1]) {
        if (eyes === 'robot' || skin === 'rift' || skin === 'cohete') {
          // Glowing digital LED eyes
          c.fillStyle = '#00e5ff';
          c.beginPath();
          c.roundRect(side * ex - eye * 0.7, ey - eye * (blink ? 0.1 : 0.6), eye * 1.4, eye * (blink ? 0.2 : 1.2), eye * 0.3);
          c.fill();
        } else if (eyes === 'sleepy' && !blink) {
          // Peaceful smiling curved closed eyes
          c.lineWidth = Math.max(3, r * 0.1); c.strokeStyle = INK; c.lineCap = 'round';
          c.beginPath();
          c.arc(side * ex, ey, eye * 0.85, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
        } else {
          // Sclera (eye white)
          c.fillStyle = '#ffffff';
          c.beginPath();
          c.ellipse(side * ex, ey, eye, blink ? eye * .15 : eye * 1.15, 0, 0, Math.PI * 2);
          c.fill(); c.stroke();

          // Top eyelid shadow inside eye
          if (!blink) {
            c.save();
            c.beginPath(); c.ellipse(side * ex, ey, eye, eye * 1.15, 0, 0, Math.PI * 2); c.clip();
            c.fillStyle = 'rgba(28, 42, 110, 0.13)';
            c.beginPath(); c.arc(side * ex, ey - eye * 0.42, eye * 1.05, 0, Math.PI); c.fill();
            c.restore();

            const iris = skin === 'buho' ? '#e69a00' : skin === 'unicornio' ? '#7b1fa2' : INK;
            pupil(side * ex, ey, eye, iris);
          }
        }

        // Expressive curved cartoon eyebrow above eye
        if (eyes !== 'robot' && !blink) {
          c.lineWidth = Math.max(2, r * 0.07); c.strokeStyle = INK; c.lineCap = 'round';
          c.beginPath();
          const tilt = side === -1 ? (skin === 'zorro' || skin === 'tron' ? -0.1 : 0.05) : (skin === 'zorro' || skin === 'tron' ? 0.1 : -0.05);
          c.moveTo(side * ex - eye * 0.58, ey - eye * 1.35 + tilt * r);
          c.quadraticCurveTo(side * ex, ey - eye * 1.62, side * ex + eye * 0.58, ey - eye * 1.32 - tilt * r);
          c.stroke();
        }
      }
    }

    // Rosy blushing cheeks
    if (look.shape !== 'box' && !extras.has('mask') && skin !== 'rana') {
      for (const side of [-1, 1]) {
        const blushGrad = c.createRadialGradient(side * r * 0.58, r * 0.18, 0, side * r * 0.58, r * 0.18, r * 0.22);
        blushGrad.addColorStop(0, 'rgba(255, 80, 130, 0.68)');
        blushGrad.addColorStop(1, 'rgba(255, 80, 130, 0)');
        c.fillStyle = blushGrad;
        c.beginPath(); c.ellipse(side * r * 0.58, r * 0.18, r * 0.2, r * 0.13, 0, 0, Math.PI * 2); c.fill();
      }
    }

    // Beak or Snout
    const beak = extras.has('beak') || ['interceptor', 'patito', 'pinguino', 'buho', 'fenix'].includes(skin);
    const snout = extras.has('snout') || ['cerdito', 'osito', 'koala', 'topo', 'leon'].includes(skin);
    const mouthY = snout ? r * .58 : r * .22;

    if (snout) {
      const isPig = skin === 'cerdito', isKoala = skin === 'koala';
      const snoutGrad = c.createRadialGradient(0, r * 0.24, 0, 0, r * 0.28, r * 0.35);
      snoutGrad.addColorStop(0, isKoala ? '#4a5568' : isPig ? '#ffbcd4' : accent);
      snoutGrad.addColorStop(1, isKoala ? '#1a202c' : isPig ? '#ff7aa8' : shade(accent, -0.2));
      c.fillStyle = snoutGrad;
      c.beginPath(); c.ellipse(0, r * .28, r * (isKoala ? .26 : .34), r * (isKoala ? .32 : .22), 0, 0, Math.PI * 2);
      c.fill(); c.stroke();

      // Nostrils & highlight
      c.fillStyle = isKoala ? '#000000' : INK;
      for (const side of [-1, 1]) {
        c.beginPath(); c.ellipse(side * r * .11, r * .28, r * .05, r * .06, 0, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#ffffffaa';
      c.beginPath(); c.ellipse(-r * 0.08, r * 0.21, r * 0.08, r * 0.04, -0.2, 0, Math.PI * 2); c.fill();
    }

    if (beak) {
      const isDuck = skin === 'patito';
      const beakGrad = c.createLinearGradient(0, r * 0.12, 0, r * 0.44);
      beakGrad.addColorStop(0, '#ffb822'); beakGrad.addColorStop(1, '#ff6a00');
      c.fillStyle = beakGrad; c.lineWidth = Math.max(2.5, r * 0.08); c.strokeStyle = INK;
      c.beginPath();
      if (isDuck) {
        // Broad duck bill
        c.moveTo(-r * 0.3, r * 0.16);
        c.quadraticCurveTo(0, r * 0.08, r * 0.3, r * 0.16);
        c.quadraticCurveTo(r * 0.34, r * 0.38, 0, r * 0.44);
        c.quadraticCurveTo(-r * 0.34, r * 0.38, -r * 0.3, r * 0.16);
      } else {
        // Chick / Bird curved beak
        c.moveTo(-r * 0.2, r * 0.16);
        c.quadraticCurveTo(0, r * 0.12, r * 0.2, r * 0.16);
        c.quadraticCurveTo(r * 0.12, r * 0.36, 0, r * 0.44);
        c.quadraticCurveTo(-r * 0.12, r * 0.36, -r * 0.2, r * 0.16);
      }
      c.closePath(); c.fill(); c.stroke();
      // Beak top highlight
      c.strokeStyle = '#ffffffaa'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-r * 0.12, r * 0.19); c.quadraticCurveTo(0, r * 0.15, r * 0.12, r * 0.19); c.stroke();
      c.strokeStyle = INK;
    }

    // Mouth
    if (!beak && eyes !== 'robot') {
      c.fillStyle = INK; c.lineWidth = Math.max(2, r * .08);
      const worried = options.dizzy || (actor.trail?.length && !(this.moods[id] > 0));
      const happy = this.moods[id] > 0 || options.still || options.idle;
      if (worried) {
        c.beginPath(); c.ellipse(0, mouthY + r * .14, r * .12, r * .16, 0, 0, Math.PI * 2); c.fill();
      } else if (happy) {
        // Cheerful cartoon grin with cute tongue
        c.beginPath(); c.arc(0, mouthY, r * (snout ? .2 : .28), 0, Math.PI); c.closePath(); c.fill();
        c.fillStyle = '#ff6088';
        c.beginPath(); c.ellipse(0, mouthY + r * (snout ? .12 : .18), r * (snout ? .1 : .16), r * .08, 0, 0, Math.PI * 2); c.fill();
      } else {
        c.beginPath(); c.arc(0, mouthY - r * .02, r * .24, .25, Math.PI - .25); c.stroke();
      }

      // Buck teeth for Ratón & Conejo
      if ((extras.has('teeth') || skin === 'raton' || skin === 'conejo') && !worried && skin !== 'tiburon') {
        c.fillStyle = '#ffffff'; c.lineWidth = Math.max(1, r * .04);
        for (const side of [-1, 1]) {
          c.beginPath(); c.rect(side * r * .08 - r * .06, mouthY, r * .12, r * .13); c.fill(); c.stroke();
        }
      }

      // Shark sharp teeth
      if (skin === 'tiburon' && !worried) {
        c.fillStyle = '#ffffff';
        for (let i = -2; i <= 2; i++) {
          tri([i * r * 0.1 - r * 0.04, mouthY], [i * r * 0.1, mouthY + r * 0.1], [i * r * 0.1 + r * 0.04, mouthY], '#ffffff');
        }
      }
    }

    // Mustache for Pintor Rodi
    if (extras.has('mustache') || skin === 'pintor') {
      c.strokeStyle = INK; c.lineWidth = r * .1; c.lineCap = 'round';
      for (const side of [-1, 1]) {
        c.beginPath(); c.moveTo(0, r * .14); c.quadraticCurveTo(side * r * .32, r * .02, side * r * .44, r * .2); c.stroke();
      }
    }

    // Whiskers for Cat, Rat, Fox
    if (extras.has('whiskers') || skin === 'tron' || skin === 'raton' || skin === 'zorro') {
      c.strokeStyle = INK; c.lineWidth = Math.max(1.5, r * .05); c.lineCap = 'round';
      for (const side of [-1, 1]) for (const k of [-.08, .08]) {
        c.beginPath(); c.moveTo(side * r * .54, r * .18 + k * r); c.lineTo(side * r * 1.05, r * .1 + k * r * 2.2); c.stroke();
      }
    }
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
    // Both sides are checked: a new canvas is 300×150, so a 300 px portrait would keep 150 px of height.
    if (canvas.width !== Math.round(size * dpr) || canvas.height !== Math.round(size * dpr)) canvas.width = canvas.height = Math.round(size * dpr);
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
    // The camera follows the local player, or whoever is being watched in spectator mode.
    const c = this.ctx, player = arena.actors[0], focus = arena.actors[arena.follow ?? 0] || player;
    this.camera.x = focus.x; this.camera.y = focus.y;
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
        const points = this.path(actor);
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

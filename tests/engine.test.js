import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, WIDTH, SIZE, cell, coords, crossedCells, freshProfile, parseProfile, levelFor, levelXP, CHARACTERS, POWERS, CHESTS, RARITIES, PRIZES, rollRarity, openChest } from '../engine.js';
import { Renderer } from '../renderer.js';

function clean(arena = new Arena()) {
  arena.grid.fill(-1); arena.trails.fill(-1); arena.events = [];
  for (const actor of arena.actors) { actor.count = 0; actor.trail = []; }
  return arena;
}
function trail(arena, actor, points) {
  for (const [x, y] of points) { const i = cell(x, y); arena.trails[i] = actor.id; arena.trailMasks[i] |= 1 << actor.id; actor.trail.push(i); }
}
function ownershipInvariant(arena) {
  const counts = new Array(7).fill(0);
  for (const owner of arena.grid) { assert.ok(owner >= -1 && owner < 7); if (owner >= 0) counts[owner]++; }
  assert.deepEqual(arena.actors.map(a => a.count), counts);
}
test('seven riders spawn with distinct territories, names and colors', () => {
  const arena = new Arena();
  assert.equal(arena.actors.length, 7);
  assert.equal(new Set(arena.actors.map(a => a.name)).size, 7);
  assert.equal(new Set(arena.actors.map(a => a.color)).size, 7);
  assert.ok(arena.actors.every(a => a.count > 30));
  ownershipInvariant(arena);
});
test('grid DDA never leaves diagonal leaks and handles fast movement', () => {
  const start = cell(10.5, 10.5), crossed = crossedCells(10.5, 10.5, 14.5, 14.5);
  let previous = start;
  for (const index of crossed) { const a = coords(previous), b = coords(index); assert.equal(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 1); previous = index; }
  assert.equal(crossed.at(-1), cell(14.5, 14.5));
  assert.deepEqual(crossedCells(10.5, 10.5, 10.5, 7.5), [cell(10, 9), cell(10, 8), cell(10, 7)]);
});
test('flood fill captures a closed loop including enemy cells, not the exterior', () => {
  const arena = clean(), actor = arena.actors[0];
  for (let y = 10; y <= 14; y++) arena.assign(cell(10, y), 0);
  arena.assign(cell(12, 12), 1);
  const points = [];
  for (let x = 11; x <= 14; x++) points.push([x, 10]);
  for (let y = 11; y <= 14; y++) points.push([14, y]);
  for (let x = 13; x >= 11; x--) points.push([x, 14]);
  trail(arena, actor, points);
  const gained = arena.capture(actor);
  assert.equal(gained, 20); assert.equal(actor.count, 25);
  assert.equal(arena.grid[cell(12, 12)], 0);
  assert.equal(arena.grid[cell(15, 12)], -1);
  assert.equal(arena.actors[1].count, 0);
  assert.equal(actor.trail.length, 0);
  assert.ok(arena.events.some(e => e.type === 'reward' && e.bits > 0));
  ownershipInvariant(arena);
});
test('an open path does not annex the unbounded exterior', () => {
  const arena = clean(), actor = arena.actors[0];
  arena.assign(cell(10, 10), 0);
  trail(arena, actor, [[11, 10], [12, 10], [13, 10]]);
  assert.equal(arena.capture(actor), 3);
  assert.equal(actor.count, 4);
});
test('crossing or touching your own trail is always harmless', () => {
  const arena = clean(), actor = arena.actors[0];
  trail(arena, actor, [[10, 10], [11, 10]]);
  actor.lastCell = cell(12, 10);
  arena.visit(actor, cell(10, 10));
  arena.cutAtTip(actor, { x: 10.5, y: 10.5 }, { x: 11.5, y: 10.5 });
  assert.equal(actor.alive, true); assert.equal(arena.ended, false);
  assert.equal(arena.trails[cell(10, 10)], 0);
});
test('cutting a rival transfers exactly 25 percent of land and rewards a kill', () => {
  const arena = clean(), victim = arena.actors[1], attacker = arena.actors[0];
  for (let i = 0; i < 100; i++) arena.assign(i, 1);
  trail(arena, victim, [[12, 12], [13, 12]]);
  attacker.lastCell = cell(14, 12);
  arena.cutAtTip(attacker, { x: 14.5, y: 12.5 }, { x: 13.5, y: 12.5 });
  assert.equal(victim.alive, false); assert.equal(victim.count, 0);
  assert.equal(attacker.count, 25); assert.equal(attacker.kills, 1);
  assert.equal(victim.trail.length, 0);
  assert.ok(arena.events.some(e => e.type === 'reward' && e.kills === 1));
  ownershipInvariant(arena);
});
test('shield preserves the victim and repels the attacker instead of rewarding a kill', () => {
  const arena = clean(), victim = arena.actors[1], attacker = arena.actors[0];
  trail(arena, victim, [[12, 12]]); victim.timers.shield = 1.5;
  attacker.lastCell = cell(11, 12);
  const before = { x: attacker.x, y: attacker.y, angle: attacker.angle };
  arena.cutAtTip(attacker, { x: 11.5, y: 12.5 }, { x: 12.5, y: 12.5 });
  assert.ok(victim.alive); assert.ok(attacker.alive); assert.equal(attacker.kills, 0);
  assert.equal(attacker.lastCell, cell(11, 12));
  assert.equal(attacker.x, before.x); assert.equal(attacker.y, before.y); assert.equal(attacker.angle, before.angle);
  assert.ok(arena.events.some(e => e.type === 'repel'));
});

test('overlapping motorcycle bodies do not cause death', () => {
  const arena = clean();
  for (const actor of arena.actors) { actor.alive = actor.id < 2; actor.x = 20.5; actor.y = 20.5; actor.angle = actor.desired = 0; actor.lastCell = cell(20, 20); actor.aiAt = Infinity; }
  for (let i = 0; i < 30; i++) arena.step(1 / 90);
  assert.ok(arena.actors[0].alive && arena.actors[1].alive);
  assert.equal(arena.events.filter(e => e.type === 'death').length, 0);
});

test('a motorcycle body crossing a rival trail does not cut it: only the nose does', () => {
  const arena = clean(), attacker = arena.actors[0], victim = arena.actors[1];
  trail(arena, victim, [[20, 20]]);
  attacker.lastCell = cell(19, 20);
  arena.visit(attacker, cell(20, 20));
  assert.ok(victim.alive);
  assert.ok(arena.trailMasks[cell(20, 20)] & (1 << victim.id));
  arena.cutAtTip(attacker, { x: 19.5, y: 20.5 }, { x: 20.5, y: 20.5 });
  assert.equal(victim.alive, false);
  assert.ok(attacker.alive);
});

test('Wall Surge grants exactly 35 percent speed and switches off away from the edge', () => {
  const arena = clean(), actor = arena.actors[0];
  for (const other of arena.actors.slice(1)) other.alive = false;
  actor.x = 1.5; actor.y = 20.5; actor.angle = actor.desired = Math.PI / 2;
  actor.lastCell = cell(actor.x, actor.y); arena.orbs = [];
  const start = actor.y;
  arena.step(1 / 60);
  assert.ok(actor.wallSurge); assert.ok(actor.alive);
  assert.ok(Math.abs((actor.y - start) / (4.8 / 60) - 1.35) < 1e-9);
  assert.ok(arena.events.some(e => e.type === 'wall'));
  actor.x = 20.5; actor.y = 20.5; actor.lastCell = cell(20, 20);
  arena.step(1 / 60); assert.equal(actor.wallSurge, false);
});

test('walls cannot kill and steering never exceeds 0.1 radians per 60 Hz frame', () => {
  const arena = clean(), actor = arena.actors[0];
  for (const other of arena.actors.slice(1)) other.alive = false;
  actor.x = .66; actor.y = 20; actor.angle = actor.desired = Math.PI; actor.lastCell = cell(actor.x, actor.y);
  for (let i = 0; i < 120; i++) {
    const before = actor.angle; actor.desired = Math.PI;
    arena.step(1 / 60);
    assert.ok(Math.abs(actor.angle - before) <= .100000001);
    assert.ok(actor.x >= .65);
  }
  assert.ok(actor.alive); assert.equal(arena.events.some(e => e.type === 'death'), false);
});

test('orthographic projection keeps the player exactly centered and has equal scale on both axes', () => {
  const renderer = Object.create(Renderer.prototype);
  Object.assign(renderer, { width: 844, height: 390, scale: 20, camera: { x: 17, y: 21 } });
  assert.deepEqual(renderer.project(17, 21), { x: 422, y: 195, scale: 20 });
  assert.equal(renderer.project(18, 21).x - renderer.project(17, 21).x, renderer.project(17, 22).y - renderer.project(17, 21).y);
  assert.deepEqual(renderer.project(17, 21, 100), renderer.project(17, 21, 0));
  assert.deepEqual(renderer.unproject(442, 215), { x: 18, y: 22 });
});

test('a trail-cut death creates exactly 35 neon particles', () => {
  const renderer = Object.create(Renderer.prototype), arena = new Arena();
  Object.assign(renderer, { particles: [], floats: [], rings: [], brokenTrails: [], reduced: false });
  renderer.effects({ type: 'death', id: 1, killer: -1, x: 10, y: 10, trail: [] }, arena);
  assert.equal(renderer.particles.length, 35);
  assert.ok(renderer.particles.every(p => p.color === arena.actors[1].color));
});
function withCharacter(id) {
  const profile = freshProfile(); profile.skins.push(id); profile.skin = id;
  return clean(new Arena(profile));
}
test('common characters have no powers; others only use their own powers with duration and cooldown', () => {
  const common = new Arena();
  assert.equal(CHARACTERS.find(c => c.id === common.profile.skin).rarity, 'comun');
  for (const power of Object.keys(POWERS)) assert.equal(common.ability(0, power), false);
  for (const c of CHARACTERS) {
    const expected = { comun: 0, raro: 1, epico: 1, legendario: 2, mitico: 2 }[c.rarity];
    assert.equal(c.powers.length, expected, c.id);
  }
  const arena = new Arena(Object.assign(freshProfile(), { skins: ['tron'], skin: 'tron' }));
  assert.equal(arena.ability(0, 'shield'), false);
  assert.equal(arena.ability(0, 'dash'), true);
  assert.equal(arena.ability(0, 'dash'), false);
  assert.ok(arena.active(arena.actors[0], 'dash'));
  arena.time = 3.1; assert.equal(arena.active(arena.actors[0], 'dash'), false);
  arena.time = 10; assert.equal(arena.ability(0, 'dash'), true);
  // Rarer characters recharge faster.
  const mythic = new Arena(Object.assign(freshProfile(), { skins: ['fenix'], skin: 'fenix' }));
  assert.ok(mythic.cooldown(mythic.actors[0], 'shoot') < POWERS.shoot.cooldown);
});
test('Rodillo paints cells directly while active and leaves no exposed trail', () => {
  const arena = function () { const a = new Arena(Object.assign(freshProfile(), { skins: ['pintor'], skin: 'pintor' })); a.grid.fill(-1); for (const actor of a.actors) { actor.count = 0; actor.trail = []; } return a; }();
  const actor = arena.actors[0];
  assert.ok(arena.ability(0, 'paint'));
  actor.lastCell = -1; arena.visit(actor, cell(20, 20));
  assert.equal(actor.trail.length, 0);
  assert.equal(arena.grid[cell(20, 20)], 0); assert.equal(arena.grid[cell(21, 21)], 0);
  assert.equal(actor.count, 9);
  ownershipInvariant(arena);
});
test('a paint shot that touches a rival trail catches the rival; a shield blocks it', () => {
  const arena = withCharacter('rift'), shooter = arena.actors[0], victim = arena.actors[1];
  shooter.x = 10.5; shooter.y = 10.5; shooter.angle = 0;
  trail(arena, victim, [[14, 10], [14, 9]]); victim.x = 14.5; victim.y = 5.5;
  assert.ok(arena.ability(0, 'shoot'));
  for (let i = 0; i < 20 && victim.alive; i++) arena.moveShots(1 / 60);
  assert.equal(victim.alive, false); assert.equal(shooter.kills, 1);
  const guarded = withCharacter('rift'), other = guarded.actors[1];
  guarded.actors[0].x = 10.5; guarded.actors[0].y = 10.5; guarded.actors[0].angle = 0;
  trail(guarded, other, [[14, 10]]); other.x = 14.5; other.y = 5.5; other.timers.shield = 5;
  guarded.ability(0, 'shoot');
  for (let i = 0; i < 20; i++) guarded.moveShots(1 / 60);
  assert.ok(other.alive); assert.equal(guarded.projectiles.length, 0);
  assert.ok(guarded.events.some(e => e.type === 'repel'));
});
test('Bomba claims a disc and closes an exposed trail; Congelar stuns nearby rivals only', () => {
  const arena = withCharacter('fenix'), actor = arena.actors[0];
  for (let y = 10; y <= 12; y++) arena.assign(cell(10, y), 0);
  trail(arena, actor, [[11, 10], [12, 10], [13, 10], [14, 10], [15, 10]]);
  actor.x = 15.5; actor.y = 10.5;
  assert.ok(arena.ability(0, 'bomb'));
  assert.equal(actor.trail.length, 0);
  assert.equal(arena.grid[cell(15, 13)], 0);
  assert.ok(arena.events.some(e => e.type === 'bomb' && e.cells > 30));
  ownershipInvariant(arena);
  const cold = withCharacter('yeti'), near = cold.actors[1], far = cold.actors[2];
  cold.actors[0].x = 20; cold.actors[0].y = 20; near.x = 23; near.y = 20; far.x = 60; far.y = 60;
  assert.ok(cold.ability(0, 'freeze'));
  assert.ok(near.stunUntil > cold.time && near.frozenUntil > cold.time);
  assert.equal(far.stunUntil, 0);
});
test('chests roll their rarity table, prefer new prizes and refund repeats with stars', () => {
  const profile = freshProfile();
  for (const type of Object.keys(CHESTS)) assert.equal(Object.values(CHESTS[type].odds).reduce((a, b) => a + b, 0), 100);
  assert.equal(rollRarity('comun', () => 0), 'comun');
  assert.equal(rollRarity('legendario', () => .999), 'mitico');
  const commons = PRIZES.filter(p => p.rarity === 'comun').length;
  const seen = new Set();
  for (let i = 0; i < commons; i++) { const result = openChest(profile, 'comun', () => 0); assert.equal(result.duplicate, false); seen.add(result.prize.id); }
  assert.equal(seen.size, commons);
  const before = profile.bits, repeat = openChest(profile, 'comun', () => 0);
  assert.ok(repeat.duplicate); assert.equal(profile.bits - before, RARITIES.comun.refund);
});
test('victory requires strictly more than half of the map', () => {
  const arena = clean();
  for (let i = 0; i < SIZE / 2; i++) arena.assign(i, 0);
  arena.checkWin(); assert.equal(arena.won, false);
  arena.assign(SIZE / 2, 0); arena.checkWin();
  assert.ok(arena.won); assert.ok(arena.events.some(e => e.type === 'end' && e.won));
});
test('orb amplification adds a border only while the temporary bonus is active', () => {
  const capture = active => {
    const arena = clean(), actor = arena.actors[0];
    arena.assign(cell(10, 10), 0); actor.harvestUntil = active ? 10 : 0;
    trail(arena, actor, [[11, 10]]); return arena.capture(actor);
  };
  assert.ok(capture(true) > capture(false));
});
test('AI hunts visible exposed trails but ignores a ghosted recent half', () => {
  const arena = clean(), bot = arena.actors[1], player = arena.actors[0];
  bot.x = 20; bot.y = 20; bot.aiAt = 0;
  trail(arena, player, [[40, 40], [41, 40], [22, 20], [23, 20]]);
  arena.ai(bot); assert.ok(Math.abs(bot.desired) < .3);
  bot.aiAt = 0; player.timers.ghost = 3; bot.route = [{ x: 20, y: 30 }];
  arena.ai(bot); assert.ok(bot.desired > 1);
});
test('profile round-trips, migrates old crates and rejects bad balances, chests or unowned characters', () => {
  const profile = freshProfile();
  assert.deepEqual(parseProfile(JSON.stringify(profile)), profile);
  profile.bits = -1; assert.throws(() => parseProfile(JSON.stringify(profile)));
  profile.bits = 0; profile.skin = 'phoenix'; assert.throws(() => parseProfile(JSON.stringify(profile)));
  profile.skin = 'yeti'; assert.throws(() => parseProfile(JSON.stringify(profile)));
  profile.skins = ['yeti']; assert.equal(parseProfile(JSON.stringify(profile)).skin, 'yeti');
  profile.chests.epico = -2; assert.throws(() => parseProfile(JSON.stringify(profile)));
  // A save from the previous version: single crate counter and skill slots.
  const old = { version: 1, bits: 5, xp: 0, crates: 2, wins: 0, totalKills: 0, best: 0, nemesis: '', skin: 'interceptor', trail: 'cyan', skins: ['spectre'], trails: ['cyan'], slots: ['dash', 'shield'] };
  // The free-chest timer is a real timestamp and must survive a reload.
  const waiting = Object.assign(freshProfile(), { freeChestAt: Date.now() + 3 * 3600000 });
  assert.equal(parseProfile(JSON.stringify(waiting)).freeChestAt, waiting.freeChestAt);
  const tampered = Object.assign(freshProfile(), { freeChestAt: Date.now() + 999 * 3600000 });
  assert.ok(parseProfile(JSON.stringify(tampered)).freeChestAt <= Date.now() + 4 * 3600000);
  const migrated = parseProfile(JSON.stringify(old));
  assert.equal(migrated.chests.raro, 2); assert.equal(migrated.slots, undefined); assert.deepEqual(migrated.skins, ['spectre']);
});
test('level thresholds unlock road avatars at the declared XP thresholds', () => {
  for (const level of [1, 2, 3, 5, 10]) assert.equal(levelFor(levelXP(level)), level);
});
test('long bot simulation preserves territory counts and live-trail ownership', () => {
  let seed = 42;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const arena = new Arena(freshProfile(), random);
  arena.actors[0].alive = false;
  let captures = 0;
  for (let i = 0; i < 90 * 90; i++) {
    arena.step(1 / 90);
    captures += arena.events.filter(e => e.type === 'capture').length;
    arena.events = [];
  }
  assert.ok(captures > 5, 'bots close territory loops');
  ownershipInvariant(arena);
  for (const owner of arena.trails) if (owner >= 0) assert.ok(arena.actors[owner].alive);
});

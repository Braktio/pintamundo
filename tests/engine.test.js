import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, WIDTH, SIZE, COLORS, cell, coords, crossedCells, freshProfile, parseProfile, cleanName, levelFor, levelXP, CHARACTERS, POWERS, CHESTS, RARITIES, PRIZES, rollRarity, openChest, RANKS, TIERS, tierStart, rankFor, rankChange, CHARACTER_MAX_LEVEL, characterLevel, copiesFor, levelsUp, powerScale, missionsFor, dailyMissions, recordMatch, claimMission, claimMissionBonus, MISSION_BONUS, STREAK_REWARDS, streakStatus, claimStreak, addDays, START_CHARGE, PROGRESS_EPOCH, fillChestBar, levelChest, matchStars, seasonOf, previousSeason, seasonEnd, seasonName, seasonStart, seasonReward, FIRST_SEASON, FREE_CHEST_HOURS, isChild, ageGroupFor } from '../engine.js';
import { Renderer } from '../renderer.js';

function clean(arena = new Arena()) {
  arena.grid.fill(-1); arena.trails.fill(-1); arena.events = [];
  // Power mechanics are tested fully charged (matches start them half charged).
  for (const actor of arena.actors) { actor.count = 0; actor.trail = []; actor.ready = {}; }
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
  assert.equal(arena.ability(0, 'dash'), false, 'powers start the match half charged');
  arena.time = POWERS.dash.cooldown * START_CHARGE; assert.equal(arena.ability(0, 'dash'), true);
  assert.equal(arena.ability(0, 'dash'), false);
  assert.ok(arena.active(arena.actors[0], 'dash'));
  arena.time += 3.1; assert.equal(arena.active(arena.actors[0], 'dash'), false);
  arena.time += POWERS.dash.cooldown; assert.equal(arena.ability(0, 'dash'), true);
  // Rarer characters recharge faster.
  const mythic = new Arena(Object.assign(freshProfile(), { skins: ['fenix'], skin: 'fenix' }));
  assert.ok(mythic.cooldown(mythic.actors[0], 'shoot') < POWERS.shoot.cooldown);
});
test('Rodillo paints cells directly while active and leaves no exposed trail', () => {
  const arena = function () { const a = new Arena(Object.assign(freshProfile(), { skins: ['pintor'], skin: 'pintor' })); a.grid.fill(-1); for (const actor of a.actors) { actor.count = 0; actor.trail = []; actor.ready = {}; } return a; }();
  const actor = arena.actors[0];
  assert.ok(arena.ability(0, 'paint'));
  actor.lastCell = -1; arena.visit(actor, cell(20, 20));
  assert.equal(actor.trail.length, 0);
  // A brush of radius 1.2: the cell and its four neighbours.
  assert.equal(arena.grid[cell(20, 20)], 0); assert.equal(arena.grid[cell(21, 20)], 0); assert.equal(arena.grid[cell(21, 21)], -1);
  assert.equal(actor.count, 5);
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
  assert.ok(arena.events.some(e => e.type === 'bomb' && e.cells > 20), 'a radius-3 disc');
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
test('progress reset: saves from an earlier epoch start over, keeping only the name and easy mode', () => {
  const abused = { ...freshProfile(), epoch: 1, name: 'Luna', easy: true, bits: 99999, xp: 50000, wins: 80, skins: ['fenix'], chests: { comun: 40, raro: 30, epico: 20, legendario: 10 } };
  const reset = parseProfile(JSON.stringify(abused));
  assert.equal(reset.name, 'Luna'); assert.equal(reset.easy, true); assert.equal(reset.resetNotice, true);
  assert.equal(reset.bits, 0); assert.equal(reset.xp, 0); assert.deepEqual(reset.skins, []); assert.equal(reset.epoch, PROGRESS_EPOCH);
  const { epoch, ...noEpoch } = abused;
  assert.equal(parseProfile(JSON.stringify(noEpoch)).bits, 0, 'saves from before epochs also start over');
  const current = parseProfile(JSON.stringify({ ...freshProfile(), bits: 1234 }));
  assert.equal(current.bits, 1234); assert.equal(current.resetNotice, undefined);
});
test('chests are harder to get: a chest bar fills with match stars, sparse level chests', () => {
  const profile = freshProfile(), raro = profile.chests.raro;
  assert.deepEqual(fillChestBar(profile, 3), []); assert.equal(profile.chestBar, 3);
  for (let i = 0; i < 2; i++) fillChestBar(profile, 3);
  assert.equal(fillChestBar(profile, 3, () => 0).length, 1, '12 stars give one chest');
  assert.equal(profile.chestBar, 0); assert.equal(profile.chests.comun, 1, 'mostly common');
  assert.deepEqual(fillChestBar(profile, 12, () => .999), ['epico']);
  assert.equal(profile.chests.raro, raro);
  assert.deepEqual([1, 2, 3, 4, 5, 10].map(levelChest), [null, 'comun', null, 'comun', 'raro', 'epico']);
  assert.ok(CHESTS.comun.price >= 1000 && CHESTS.legendario.price >= 20000);
});
test('rare and better characters level up with repeats, up to level 10', () => {
  assert.equal(copiesFor(1), 0); assert.equal(copiesFor(2), 1); assert.equal(copiesFor(3), 2); assert.equal(copiesFor(CHARACTER_MAX_LEVEL), 25);
  const profile = freshProfile();
  profile.skins = ['abeja']; // a rare character (Imán)
  assert.equal(characterLevel(profile, 'abeja'), 1);
  // Rare chest, rare rarity; the second roll (< REPEAT_CHANCE) asks for a repeat.
  const rolls = [.5, 0, 0]; let r = 0;
  const repeat = openChest(profile, 'raro', () => rolls[r++ % rolls.length]);
  assert.ok(repeat.duplicate && repeat.prize.id === 'abeja' && repeat.levelUp && repeat.level === 2, JSON.stringify(repeat));
  assert.equal(profile.copies.abeja, 1); assert.equal(characterLevel(profile, 'abeja'), 2);
  profile.copies.abeja = copiesFor(CHARACTER_MAX_LEVEL);
  assert.equal(characterLevel(profile, 'abeja'), CHARACTER_MAX_LEVEL);
  // At the top level a repeat turns into stars again; commons never level up.
  assert.equal(characterLevel(profile, 'interceptor'), 1); assert.equal(levelsUp(CHARACTERS.find(c => c.id === 'interceptor')), false);
  // Each level stretches the reach of the powers by 6%.
  assert.equal(powerScale(1), 1); assert.ok(Math.abs(powerScale(10) - 1.36) < 1e-9);
  assert.deepEqual(parseProfile(JSON.stringify(profile)).copies, { abeja: 25 });
  assert.throws(() => parseProfile(JSON.stringify({ ...profile, copies: { interceptor: 2 } })), 'commons cannot have levels');
});
test('a higher character level reaches further: bigger bomb, longer shot', () => {
  const bombed = level => {
    const profile = Object.assign(freshProfile(), { skins: ['fenix'], skin: 'fenix', copies: { fenix: copiesFor(level) } });
    const arena = clean(new Arena(profile)), actor = arena.actors[0];
    actor.x = 40.5; actor.y = 40.5; arena.ability(0, 'bomb');
    return { cells: actor.count, shot: (arena.ability(0, 'shoot'), arena.projectiles[0].life) };
  };
  const low = bombed(1), high = bombed(CHARACTER_MAX_LEVEL);
  assert.ok(high.cells > low.cells * 1.5, `level 10 bomb paints more: ${low.cells} → ${high.cells}`);
  assert.ok(high.shot > low.shot, 'level 10 shots fly further');
});
test('daily missions: three a day, same for everyone, progress from matches, stars and a bonus chest', () => {
  const day = '2026-10-23', missions = missionsFor(day);
  assert.equal(missions.length, 3); assert.equal(new Set(missions.map(m => m.id)).size, 3);
  assert.deepEqual(missionsFor(day), missions, 'the same day always gives the same missions');
  assert.notDeepEqual(['2026-10-24', '2026-10-25', '2026-10-26'].map(d => missionsFor(d).map(m => m.id).join()), Array(3).fill(missions.map(m => m.id).join()), 'other days change');
  const profile = freshProfile();
  const big = { kills: 10, percent: 60, orbs: 40, powers: 20, online: true, won: true };
  recordMatch(profile, day, big); const done = recordMatch(profile, day, big).concat(recordMatch(profile, day, big));
  assert.ok(dailyMissions(profile, day).every(m => m.done), 'three big matches complete every mission');
  assert.ok(done.length >= 0);
  const bits = profile.bits;
  for (const m of missions) assert.equal(claimMission(profile, day, m.id), m.reward);
  assert.equal(profile.bits - bits, missions.reduce((a, m) => a + m.reward, 0));
  assert.equal(claimMission(profile, day, missions[0].id), 0, 'a mission pays once');
  const chests = profile.chests[MISSION_BONUS];
  assert.ok(claimMissionBonus(profile, day)); assert.equal(profile.chests[MISSION_BONUS], chests + 1);
  assert.equal(claimMissionBonus(profile, day), false, 'the bonus is once a day');
  // A new day starts over, and the state survives a reload.
  assert.ok(dailyMissions(profile, '2026-10-24').every(m => !m.claimed && !m.done));
  recordMatch(profile, '2026-10-24', { kills: 1 });
  assert.deepEqual(parseProfile(JSON.stringify(profile)).daily, profile.daily);
});
test('daily streak: better rewards each day in a row, back to day 1 after a missed day', () => {
  const profile = freshProfile();
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.deepEqual(claimStreak(profile, '2026-10-20'), STREAK_REWARDS[0]);
  assert.equal(claimStreak(profile, '2026-10-20'), null, 'once a day');
  assert.equal(streakStatus(profile, '2026-10-20').claimed, true);
  claimStreak(profile, '2026-10-21'); claimStreak(profile, '2026-10-22');
  assert.equal(profile.streak.count, 3); assert.equal(profile.chests.comun, 1, 'day 3 gives a common chest');
  assert.equal(streakStatus(profile, '2026-10-24').count, 1, 'missing a day starts over');
  assert.deepEqual(parseProfile(JSON.stringify(profile)).streak, profile.streak);
  assert.equal(parseProfile(JSON.stringify({ ...profile, streak: { last: 'ayer', count: 3 } })).streak.count, 0, 'a broken streak is dropped');
});
test('seasons: monthly, starting at half of last season, with better chests for better ranks', () => {
  assert.equal(seasonOf(new Date(Date.UTC(2026, 9, 23))), '2026-10');
  assert.equal(previousSeason('2026-10'), '2026-09'); assert.equal(previousSeason('2027-01'), '2026-12');
  assert.equal(seasonEnd('2026-12').toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(seasonName('2026-11'), 'Temporada de noviembre 2026');
  assert.equal(seasonStart('2026-11', 301), 150, 'half of last season');
  assert.equal(seasonStart(FIRST_SEASON, undefined, 174), 174, 'the first season keeps the old ranking');
  assert.equal(seasonStart('2026-12', undefined, 174), 0, 'later seasons start from zero without a previous row');
  assert.deepEqual(seasonReward(0), ['comun']); assert.equal(seasonReward(1e6).length, 3);
  assert.deepEqual([matchStars({ won: true }), matchStars({ percent: 25 }), matchStars({ percent: 1, kills: 1 }), matchStars({ percent: 1 })], [3, 2, 1, 0]);
});
test('solo: more than half is a victory, but the match only ends at 100% or when caught', () => {
  const arena = clean();
  for (let i = 0; i < SIZE / 2; i++) arena.assign(i, 0);
  arena.checkWin(); assert.equal(arena.won, false);
  arena.assign(SIZE / 2, 0); arena.checkWin();
  assert.ok(arena.won); assert.ok(arena.events.some(e => e.type === 'victory'));
  assert.equal(arena.ended, false, 'the match goes on after the victory');
  // Caught after winning: the victory still counts.
  arena.kill(arena.actors[0], arena.actors[1]);
  assert.ok(arena.ended); assert.ok(arena.events.some(e => e.type === 'end' && e.won));
  const full = clean();
  for (let i = 0; i < SIZE; i++) full.assign(i, 0);
  full.checkWin();
  assert.ok(full.events.some(e => e.type === 'end' && e.won && /todo el mapa/.test(e.reason)));
});
test('online: no time limit; half is a victory, the match ends when no player is left or the map is full', () => {
  const humans = [{ skin: 'tron', color: COLORS[0], name: 'Ana' }, { skin: 'tron', color: COLORS[1], name: 'Beto' }];
  const arena = new Arena(freshProfile(), Math.random, { humans });
  assert.equal(arena.timeLimit, 0);
  arena.time = 10000; arena.step(1 / 90);
  assert.equal(arena.ended, false, 'time alone never ends it');
  for (let i = 0; i <= SIZE / 2; i++) arena.assign(i, 0);
  arena.checkWin();
  assert.equal(arena.ended, false); assert.ok(arena.actors[0].wonHalf); assert.ok(arena.events.some(e => e.type === 'victory' && e.id === 0));
  arena.kill(arena.actors[0], arena.actors[2]);
  assert.equal(arena.ended, false, 'Beto is still playing');
  arena.kill(arena.actors[1], arena.actors[2]);
  assert.ok(arena.ended, 'nobody is left');
  const full = new Arena(freshProfile(), Math.random, { humans });
  for (let i = 0; i < SIZE; i++) full.assign(i, 1);
  full.checkWin();
  assert.ok(full.events.some(e => e.type === 'end' && /Beto pintó todo el mapa/.test(e.reason)));
  // Robots come back online too.
  const bots = new Arena(freshProfile(), Math.random, { humans });
  for (const bot of bots.actors.filter(a => !a.human)) bots.kill(bot, bots.actors[0]);
  assert.ok(bots.respawnAt > 0);
});
test('a paint shot paints a small disc where it lands and still catches exposed trails', () => {
  const arena = clean(), shooter = arena.actors[0];
  shooter.x = 20.5; shooter.y = 20.5; shooter.angle = 0;
  arena.projectiles.push({ owner: 0, x: 21, y: 20.5, angle: 0, life: .05 });
  arena.moveShots(.1);
  const landed = cell(22, 20);
  assert.equal(arena.grid[landed], 0, 'the landing spot is painted');
  assert.ok(arena.actors[0].count >= 9, 'a disc of radius 1.6 is about 9 cells');
  // Hitting a rival's exposed trail still catches it.
  const hunter = clean(), victim = hunter.actors[1];
  hunter.actors[0].x = 10.5; hunter.actors[0].y = 40.5;
  trail(hunter, victim, [[14, 40], [15, 40]]);
  hunter.projectiles.push({ owner: 0, x: 11, y: 40.5, angle: 0, life: .8 });
  for (let i = 0; i < 20 && hunter.projectiles.length; i++) hunter.moveShots(1 / 60);
  assert.equal(victim.alive, false);
  assert.equal(hunter.grid[cell(15, 40)], 0, 'the shot also paints where it hit');
});
test('solo: when every robot is out, a few new ones appear in free space', () => {
  const arena = clean();
  for (const bot of arena.actors.slice(1)) arena.kill(bot, arena.actors[0]);
  assert.equal(arena.actors.filter(a => a.id && a.alive).length, 0);
  assert.ok(arena.respawnAt > arena.time);
  arena.time = arena.respawnAt; arena.respawnAt = 0; arena.respawn();
  const back = arena.actors.filter(a => a.id && a.alive);
  assert.ok(back.length >= 1 && back.length <= 3, 'only a few robots come back: ' + back.length);
  for (const bot of back) {
    assert.ok(bot.count > 0, 'each one starts with a small base');
    assert.ok(Math.hypot(bot.x - arena.actors[0].x, bot.y - arena.actors[0].y) >= 12, 'away from the player');
  }
  assert.equal(arena.events.filter(e => e.type === 'spawn').length, back.length);
  // A map with no free space brings nobody back.
  const full = clean();
  for (const bot of full.actors.slice(1)) full.kill(bot, full.actors[0]);
  for (let i = 0; i < SIZE; i++) if (full.grid[i] === -1) full.assign(i, 0);
  full.respawn();
  assert.equal(full.actors.filter(a => a.id && a.alive).length, 0);
});
test('ranks: 10 ranks with 3 divisions, trophies per match never below zero', () => {
  assert.equal(RANKS.length, 10); assert.equal(TIERS, 30);
  assert.deepEqual([rankFor(0).name, rankFor(tierStart(1)).name, rankFor(tierStart(2)).name, rankFor(tierStart(3)).name], ['Bronce 1', 'Bronce 2', 'Bronce 3', 'Plata 1']);
  assert.equal(rankFor(tierStart(29)).name, 'Leyenda 3'); assert.equal(rankFor(1e6).next, null);
  for (let t = 1; t < TIERS; t++) assert.ok(tierStart(t) - tierStart(t - 1) >= tierStart(t - 1) - (t > 1 ? tierStart(t - 2) : 0), 'each tier needs at least as many trophies as the last');
  assert.ok(rankChange({ stars: 0 }) < 0); assert.ok(rankChange({ stars: 3, kills: 2 }) > rankChange({ stars: 1 }));
  assert.equal(rankChange({ stars: 3, perfect: true }) - rankChange({ stars: 3 }), 20);
  assert.equal(rankChange({ stars: 1, place: 1, players: 7 }) - rankChange({ stars: 1 }), 8);
  // A save from before the ranks starts with trophies from its past results.
  const veteran = { ...freshProfile(), wins: 10, totalKills: 30, best: 42.5 }; delete veteran.points; delete veteran.ranked;
  assert.equal(parseProfile(JSON.stringify(veteran)).points, 10 * 12 + 30 * 2 + 42);
  assert.equal(parseProfile(JSON.stringify({ ...veteran, wins: 999 })).points, 1000, 'capped');
  assert.equal(freshProfile().points, 0, 'new players start at zero');
  // A profile that already had a few trophies before the seeding is raised once, not twice.
  const early = parseProfile(JSON.stringify({ ...veteran, points: 10 }));
  assert.equal(early.points, 222); assert.equal(early.ranked, true);
  assert.equal(parseProfile(JSON.stringify({ ...early, points: 5 })).points, 5, 'later losses are kept');
  const profile = Object.assign(freshProfile(), { points: 321 });
  assert.equal(parseProfile(JSON.stringify(profile)).points, 321);
  assert.throws(() => parseProfile(JSON.stringify({ ...profile, points: -5 })));
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
  // Saves of the current epoch are migrated; older epochs start over (see the reset test).
  const profile = freshProfile();
  assert.deepEqual(parseProfile(JSON.stringify(profile)), profile);
  profile.bits = -1; assert.throws(() => parseProfile(JSON.stringify(profile)));
  profile.bits = 0; profile.skin = 'phoenix'; assert.throws(() => parseProfile(JSON.stringify(profile)));
  profile.skin = 'yeti'; assert.throws(() => parseProfile(JSON.stringify(profile)));
  profile.skins = ['yeti']; assert.equal(parseProfile(JSON.stringify(profile)).skin, 'yeti');
  profile.chests.epico = -2; assert.throws(() => parseProfile(JSON.stringify(profile)));
  // A save from the previous version: single crate counter and skill slots.
  const old = { version: 1, epoch: PROGRESS_EPOCH, bits: 5, xp: 0, crates: 2, wins: 0, totalKills: 0, best: 0, nemesis: '', skin: 'interceptor', trail: 'cyan', skins: ['spectre'], trails: ['cyan'], slots: ['dash', 'shield'] };
  // The free-chest timer is a real timestamp and must survive a reload.
  const waiting = Object.assign(freshProfile(), { freeChestAt: Date.now() + 3 * 3600000 });
  assert.equal(parseProfile(JSON.stringify(waiting)).freeChestAt, waiting.freeChestAt);
  const tampered = Object.assign(freshProfile(), { freeChestAt: Date.now() + 999 * 3600000 });
  assert.ok(parseProfile(JSON.stringify(tampered)).freeChestAt <= Date.now() + FREE_CHEST_HOURS * 3600000);
  const migrated = parseProfile(JSON.stringify(old));
  assert.equal(migrated.chests.raro, 2); assert.equal(migrated.slots, undefined); assert.deepEqual(migrated.skins, ['spectre']);
});
test('nicknames keep letters, digits, spaces, "_" and "-" and need 3 to 14 characters', () => {
  assert.equal(cleanName('  Ana   María '), 'Ana María');
  assert.equal(cleanName('Ñandú_99'), 'Ñandú_99');
  assert.equal(cleanName('<b>Hola</b>"'), 'bHolab');
  assert.equal(cleanName('ab'), '');
  assert.equal(cleanName('Supercalifragilístico'), 'Supercalifragi');
  assert.equal(cleanName(undefined), '');
  // The name and the change stamp survive a reload; a bad name is dropped, not fatal.
  const profile = Object.assign(freshProfile(), { name: 'Luna', updatedAt: 1700000000000 });
  const loaded = parseProfile(JSON.stringify(profile));
  assert.equal(loaded.name, 'Luna'); assert.equal(loaded.updatedAt, 1700000000000);
  assert.equal(parseProfile(JSON.stringify({ ...profile, name: 'x' })).name, '');
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

function online(count = 3, options = {}) {
  const humans = Array.from({ length: count }, (_, i) => ({ skin: 'tron', color: COLORS[0], name: 'Jugador ' + (i + 1) }));
  return new Arena(freshProfile(), Math.random, { humans, ...options });
}
test('online matches seat several humans with distinct colors and fill the rest with bots', () => {
  const arena = online(3);
  assert.deepEqual(arena.actors.map(a => a.human), [true, true, true, false, false, false, false]);
  assert.deepEqual(arena.actors.slice(0, 3).map(a => a.name), ['Jugador 1', 'Jugador 2', 'Jugador 3']);
  assert.equal(new Set(arena.actors.map(a => a.color)).size, 7, 'colors stay distinct even when humans ask for the same one');
  assert.ok(arena.actors.slice(0, 3).every(a => a.skin === 'tron' && a.powers.includes('dash')));
  // Humans are never steered by the AI.
  const before = arena.actors[1].desired; arena.actors[1].aiAt = 0; arena.step(1 / 90);
  assert.equal(arena.actors[1].desired, before);
});
test('online rewards belong to the player who earned them', () => {
  const arena = clean(online(2)), actor = arena.actors[1];
  arena.assign(cell(10, 10), 1);
  trail(arena, actor, [[11, 10], [12, 10]]);
  arena.capture(actor);
  const reward = arena.events.find(e => e.type === 'reward');
  assert.equal(reward.id, 1); assert.ok(actor.bits > 0); assert.equal(arena.bits, 0);
});
test('a caught online player is out, but the match only ends when every human is out', () => {
  const arena = clean(online(2));
  arena.kill(arena.actors[0], arena.actors[4]);
  assert.equal(arena.ended, false);
  assert.ok(arena.events.some(e => e.type === 'out' && e.id === 0));
  arena.kill(arena.actors[1], arena.actors[4]);
  assert.equal(arena.ended, true);
  const end = arena.events.find(e => e.type === 'end');
  assert.equal(end.ranking.length, 7);
});
test('online matches end by time and rank everyone; a player who leaves becomes a bot', () => {
  const arena = online(2, { timeLimit: 1 });
  arena.leave(1);
  assert.equal(arena.actors[1].human, false);
  for (let i = 0; i < 100 && !arena.ended; i++) arena.step(1 / 90);
  const end = arena.events.find(e => e.type === 'end');
  assert.ok(end, 'time limit ends the match');
  assert.equal(end.reason, '¡Se acabó el tiempo!');
  assert.equal(end.winner, end.ranking[0]);
});
test('cell changes can be tracked for network deltas', () => {
  const arena = clean(online(1));
  arena.changes = new Set();
  arena.assign(cell(5, 5), 0); arena.assign(cell(5, 5), 0);
  assert.deepEqual([...arena.changes], [cell(5, 5)]);
});

test('neutral age screen: only players surely 13 or older leave child mode', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  assert.equal(ageGroupFor(2016, now), 'child', 'born 10 years ago');
  assert.equal(ageGroupFor(2013, now), 'child', 'born 13 years ago may still be 12');
  assert.equal(ageGroupFor(2012, now), 'teen', 'born 14 years ago is at least 13');
  assert.equal(isChild(freshProfile()), true, 'unknown age counts as a child (no ads, no sign-in)');
  assert.equal(isChild({ ...freshProfile(), ageGroup: 'teen' }), false);
});
test('the age group and the claimed season survive a save, and bad values are dropped', () => {
  const profile = { ...freshProfile(), ageGroup: 'teen', seasonClaimed: '2026-09' };
  const loaded = parseProfile(JSON.stringify(profile));
  assert.equal(loaded.ageGroup, 'teen');
  assert.equal(loaded.seasonClaimed, '2026-09', 'season rewards are not claimed twice after reloading');
  assert.equal(parseProfile(JSON.stringify({ ...profile, ageGroup: 'adult' })).ageGroup, '');
});

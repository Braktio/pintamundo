import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Hub, encodeGrid } from '../multiplayer.mjs';
import { SIZE, PROGRESS_EPOCH } from '../engine.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// A fake phone: records every message the hub sends to it.
function phone(hub) {
  const inbox = [], session = hub.connect({ send: text => inbox.push(JSON.parse(text)) });
  // Phones of the current epoch (v) unless a test says otherwise.
  const send = data => session.message(JSON.stringify(['quick', 'create', 'join'].includes(data.t) && !('v' in data) ? { ...data, v: PROGRESS_EPOCH } : data));
  const last = type => inbox.filter(m => m.t === type).at(-1);
  return { inbox, send, last, close: session.close };
}

test('phones from before the last progress reset are asked to update', () => {
  const hub = new Hub();
  try {
    const old = phone(hub);
    old.send({ t: 'quick', v: 1 });
    assert.match(old.last('error').message, /Actualiza/);
    assert.equal(hub.rooms.size, 0);
  } finally { hub.close(); }
});

test('grid run-length encoding covers every cell', () => {
  const grid = new Int16Array(SIZE).fill(-1); grid.fill(2, 10, 30);
  const runs = encodeGrid(grid);
  assert.deepEqual(runs.slice(0, 6), [-1, 10, 2, 20, -1, SIZE - 30]);
});

test('quick play fills with robots, streams state and ends by time', async () => {
  const hub = new Hub({ quickWait: .15, tickMs: 20, matchSeconds: .6 });
  try {
    const a = phone(hub), b = phone(hub);
    a.send({ t: 'quick', name: '<Luna>', skin: 'tron', color: '#2fa8ff' });
    b.send({ t: 'quick', skin: 'tron', color: '#2fa8ff' });
    assert.equal(a.last('lobby').players.length, 2, 'both phones share the quick room');
    assert.deepEqual(a.last('lobby').players.map(p => p.name), ['Luna', 'Gato Rayo'], 'nicknames are cleaned; without one, the character name is used');
    await sleep(500);
    const start = a.last('start');
    assert.ok(start, 'the match starts after the countdown');
    assert.equal(start.actors.length, 7);
    assert.equal(start.actors.filter(x => x.human).length, 2);
    assert.notEqual(start.you, b.last('start').you);
    a.send({ t: 'input', a: 0 }); a.send({ t: 'power', s: 0 });
    await sleep(80);
    const state = a.last('state');
    assert.equal(state.a.length, 7);
    assert.ok('dash' in state.me, 'each phone gets its own cooldowns');
    await sleep(900);
    const end = a.inbox.filter(m => m.t === 'state').flatMap(m => m.e).find(e => e.type === 'end');
    assert.ok(end, 'the time limit ends the match');
    assert.equal(end.ranking.length, 7);
    assert.equal(hub.rooms.size, 0, 'quick rooms close after the match');
  } finally { hub.close(); }
});

test('ranked results: only verified accounts, with stars, place and the friends met in private rooms', async () => {
  const results = [];
  const hub = new Hub({ tickMs: 20, matchSeconds: .4, verify: async token => token.startsWith('ok-') ? token.slice(3) : Promise.reject(new Error('bad')), onResult: list => results.push(...list) });
  try {
    const ana = phone(hub), beto = phone(hub), guest = phone(hub);
    ana.send({ t: 'create', name: 'Ana', skin: 'tron', token: 'ok-uid-ana' });
    const code = ana.last('lobby').code;
    beto.send({ t: 'join', code, name: 'Beto', token: 'ok-uid-beto' });
    guest.send({ t: 'join', code, name: 'Invitado', token: 'forged' });
    await sleep(30);
    ana.send({ t: 'start' });
    await sleep(900);
    assert.deepEqual(results.map(r => r.uid).sort(), ['uid-ana', 'uid-beto'], 'the forged token is unranked');
    const ana2 = results.find(r => r.uid === 'uid-ana');
    assert.deepEqual(ana2.friends, [{ uid: 'uid-beto', name: 'Beto' }]);
    assert.equal(ana2.players, 7); assert.ok(ana2.place >= 1 && ana2.place <= 7);
    assert.ok([0, 1, 2, 3].includes(ana2.stars));
  } finally { hub.close(); }
});
test('private rooms: friends join by code, only the host starts, bad input is ignored', async () => {
  const hub = new Hub({ tickMs: 20, matchSeconds: 30 });
  try {
    const host = phone(hub), friend = phone(hub), stranger = phone(hub);
    host.send({ t: 'create', skin: 'not-a-character', color: 'red', level: 4 });
    const code = host.last('lobby').code;
    assert.match(code, /^[A-Z]+-\d\d$/);
    assert.equal(host.last('lobby').players[0].skin, 'interceptor', 'unknown characters fall back to the starter');
    stranger.send({ t: 'join', code: 'NOPE-00' });
    assert.ok(stranger.last('error'));
    friend.send({ t: 'join', code: code.toLowerCase() });
    assert.equal(host.last('lobby').players.length, 2);
    friend.send({ t: 'start' });
    await sleep(60);
    assert.equal(host.last('start'), undefined, 'only the host can start');
    host.send({ t: 'start' });
    await sleep(60);
    assert.ok(friend.last('start'));
    // Quick emotes reach everyone in the room, at most one every 1.5 s, only from the list.
    host.send({ t: 'emote', e: 2 }); host.send({ t: 'emote', e: 3 }); host.send({ t: 'emote', e: 99 });
    assert.deepEqual(friend.inbox.filter(m => m.t === 'emote').map(m => m.e), [2]);
    assert.equal(friend.last('emote').a, host.last('start').you);
    for (const junk of ['not json', '{"t":5}', JSON.stringify({ t: 'input', a: 'left' }), JSON.stringify({ t: 'power', s: 9 })]) friend.send(typeof junk === 'string' && junk.startsWith('{') ? JSON.parse(junk) : junk);
    friend.close();
    await sleep(60);
    assert.ok(host.last('state'), 'the match keeps running when a friend leaves (a robot takes over)');
  } finally { hub.close(); }
});

test('real WebSocket clients can create, join and play a room on the server', async () => {
  const server = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, windowsHide: true });
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server timeout')), 5000);
      server.stdout.once('data', data => { clearTimeout(timer); resolve(data.toString().match(/http:\/\/\S+/)[0]); });
    });
    assert.equal((await fetch(base + '/health')).status, 200);
    assert.equal((await fetch(base + '/tests/multiplayer.test.js')).status, 404, 'tests are never served');
    assert.equal((await fetch(base + '/online.js')).status, 200);
    const open = () => new Promise((resolve, reject) => {
      const socket = new WebSocket(base.replace('http', 'ws') + '/ws'), inbox = [];
      socket.onmessage = event => inbox.push(JSON.parse(event.data));
      socket.onopen = () => resolve({ socket, inbox, send: data => socket.send(JSON.stringify(data)) });
      socket.onerror = reject;
    });
    const host = await open(), friend = await open();
    host.send({ t: 'create', v: PROGRESS_EPOCH, skin: 'rift', color: '#2fa8ff' });
    await sleep(150);
    const code = host.inbox.find(m => m.t === 'lobby').code;
    friend.send({ t: 'join', v: PROGRESS_EPOCH, code, skin: 'yeti', color: '#ff8ad8' });
    await sleep(150);
    host.send({ t: 'start' });
    await sleep(400);
    const start = friend.inbox.find(m => m.t === 'start');
    assert.ok(start); assert.equal(start.actors[start.you].skin, 'yeti');
    assert.ok(friend.inbox.filter(m => m.t === 'state').length >= 3, 'state arrives about 20 times per second');
    host.socket.close(); friend.socket.close();
  } finally { if (server.exitCode === null) { const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited; } }
});

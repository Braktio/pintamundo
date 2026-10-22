import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Hub, encodeGrid } from '../multiplayer.mjs';
import { SIZE } from '../engine.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// A fake phone: records every message the hub sends to it.
function phone(hub) {
  const inbox = [], session = hub.connect({ send: text => inbox.push(JSON.parse(text)) });
  const send = data => session.message(JSON.stringify(data));
  const last = type => inbox.filter(m => m.t === type).at(-1);
  return { inbox, send, last, close: session.close };
}

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

test('private rooms: friends join by code, only the host starts, bad input is ignored', async () => {
  const hub = new Hub({ tickMs: 20, matchSeconds: 30 });
  try {
    const host = phone(hub), friend = phone(hub), stranger = phone(hub);
    host.send({ t: 'create', skin: 'not-a-character', color: 'red' });
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
    host.send({ t: 'create', skin: 'rift', color: '#2fa8ff' });
    await sleep(150);
    const code = host.inbox.find(m => m.t === 'lobby').code;
    friend.send({ t: 'join', code, skin: 'yeti', color: '#ff8ad8' });
    await sleep(150);
    host.send({ t: 'start' });
    await sleep(400);
    const start = friend.inbox.find(m => m.t === 'start');
    assert.ok(start); assert.equal(start.actors[start.you].skin, 'yeti');
    assert.ok(friend.inbox.filter(m => m.t === 'state').length >= 3, 'state arrives about 20 times per second');
    host.socket.close(); friend.socket.close();
  } finally { if (server.exitCode === null) { const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited; } }
});

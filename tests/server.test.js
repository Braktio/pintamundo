import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
test('server delivers all modules without a build step', async () => {
  const server = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0' }, windowsHide: true });
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server timeout')), 5000);
      server.stdout.once('data', data => { clearTimeout(timer); resolve(data.toString().match(/http:\/\/\S+/)[0]); });
      server.once('error', reject);
    });
    for (const path of ['/', '/styles.css', '/game.js', '/engine.js', '/renderer.js']) assert.equal((await fetch(base + path)).status, 200);
    assert.equal((await fetch(base + '/missing.js')).status, 404);
  } finally { if (server.exitCode === null) { const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited; } }
});

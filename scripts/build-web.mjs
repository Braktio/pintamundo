// Copies only the files the browser needs into www/, the folder packaged inside the APK.
import { cp, mkdir, rm } from 'node:fs/promises';
const root = new URL('..', import.meta.url), out = new URL('www/', root);
const FILES = ['index.html', 'styles.css', 'game.js', 'engine.js', 'renderer.js', 'online.js', 'cloud.js', 'manifest.webmanifest'];
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of FILES) await cp(new URL(file, root), new URL(file, out));
for (const dir of ['fonts/', 'icons/']) await cp(new URL(dir, root), new URL(dir, out), { recursive: true });
console.log('www/ listo con ' + FILES.length + ' archivos, las fuentes y los iconos.');

#!/usr/bin/env node
/* =============================================================
   Bygger hele nettstedet til dist/.

       node tools/bygg-nettsted.mjs

   Resultatet er nøyaktig det som legges ut på GitHub Pages:

       dist/index.html                 spillet
       dist/css/  dist/js/  dist/docs/ det spillet trenger
       dist/wiki/                      wikien
       dist/trondheim-trafikk.html     alt i én fil

   Grunnen til at spillet kopieres inn hit er lenkene: wikisidene
   peker på ../index.html, og den må finnes både lokalt og på Pages.
   Én mappe som stemmer begge steder er enklere enn to oppsett som
   må holdes i sync.
   ============================================================= */

import { cp, mkdir, rm, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const rot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(rot, 'dist');

function kjor(skript) {
  execFileSync(process.execPath, [resolve(rot, 'tools', skript)], {
    cwd: rot,
    stdio: 'inherit'
  });
}

// Start blankt, ellers blir gamle filer liggende igjen mellom bygg.
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

kjor('bygg-enkeltfil.mjs');
kjor('bygg-wiki.mjs');

// Spillet selv
await cp(resolve(rot, 'index.html'), resolve(dist, 'index.html'));
for (const mappe of ['css', 'js', 'docs']) {
  await cp(resolve(rot, mappe), resolve(dist, mappe), { recursive: true });
}

// Ingenting er verdt å rulle ut halvferdig.
const ma_finnes = [
  'index.html',
  'css/style.css',
  'js/data.js',
  'js/engine.js',
  'js/render.js',
  'js/game.js',
  'wiki/Hjem.html',
  'wiki/index.html',
  'trondheim-trafikk.html'
];
const mangler = [];
for (const fil of ma_finnes) {
  try {
    await access(resolve(dist, fil));
  } catch {
    mangler.push(fil);
  }
}
if (mangler.length) {
  console.error('Bygget stoppet — mangler i dist/:\n  - ' + mangler.join('\n  - '));
  process.exit(1);
}

console.log('\nFerdig: dist/ er klar til utrulling.');
console.log('  dist/index.html                 spillet');
console.log('  dist/wiki/Hjem.html             wikien');
console.log('  dist/trondheim-trafikk.html     alt i én fil');
console.log('\nForhåndsvis med:  npm start  →  http://localhost:8080/dist/\n');

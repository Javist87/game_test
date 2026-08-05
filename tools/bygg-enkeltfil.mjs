#!/usr/bin/env node
/* =============================================================
   Bygger hele spillet til én enkelt HTML-fil.

   Resultatet i dist/trondheim-trafikk.html har CSS og JavaScript
   limt rett inn i dokumentet. Fila kan dobbeltklikkes, sendes på
   e-post eller legges på en minnepinne — ingen server, ingen
   nettforbindelse, ingen avhengigheter.

       node tools/bygg-enkeltfil.mjs
   ============================================================= */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const les = (sti) => readFile(resolve(rot, sti), 'utf8');

const html = await les('index.html');
const css = await les('css/style.css');

// Rekkefølgen er den samme som i index.html, og den er ikke tilfeldig:
// data.js oppretter window.TT, resten fyller den ut.
const skript = ['js/data.js', 'js/engine.js', 'js/render.js', 'js/game.js'];
const kode = [];
for (const sti of skript) {
  kode.push(`/* ---------- ${sti} ---------- */\n${await les(sti)}`);
}

// </script> inne i en streng ville avsluttet skript-taggen for tidlig.
const trygg = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');

let ut = html
  .replace(
    /^[ \t]*<link rel="stylesheet" href="css\/style\.css">[ \t]*\r?\n/m,
    `<style>\n${trygg(css)}\n</style>\n`
  )
  .replace(
    /^[ \t]*<script src="js\/data\.js"><\/script>[\s\S]*?<script src="js\/game\.js"><\/script>[ \t]*\r?\n/m,
    `<script>\n${trygg(kode.join('\n\n'))}\n</script>\n`
  );

// Slå alarm i stedet for å skrive en halvferdig fil. Vi ser etter taggene som
// skulle vært erstattet — selve stiene finnes fortsatt i kommentarhodene.
const feil = [];
if (ut.includes('href="css/style.css"')) feil.push('fikk ikke limt inn css/style.css');
for (const sti of skript) {
  if (ut.includes(`src="${sti}"`)) feil.push(`fikk ikke limt inn ${sti}`);
}
if (feil.length) {
  console.error('Bygget stoppet:\n  - ' + feil.join('\n  - '));
  process.exit(1);
}

ut = ut.replace(
  '</head>',
  '<!-- Bygget av tools/bygg-enkeltfil.mjs — rediger kildefilene, ikke denne. -->\n</head>'
);

await mkdir(resolve(rot, 'dist'), { recursive: true });
const mal = resolve(rot, 'dist/trondheim-trafikk.html');
await writeFile(mal, ut, 'utf8');

console.log(`Ferdig: dist/trondheim-trafikk.html (${(Buffer.byteLength(ut) / 1024).toFixed(0)} kB)`);
console.log('Dobbeltklikk fila for å spille.');

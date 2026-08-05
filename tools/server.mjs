#!/usr/bin/env node
/* =============================================================
   Bitteliten lokal webserver for Trondheim Trafikk.

   Bruker bare Node sitt eget standardbibliotek — ingen npm install,
   ingen nettforbindelse. Start med:

       npm start            (eller: node tools/server.mjs)
       node tools/server.mjs 8080

   Spillet fungerer også ved å bare dobbeltklikke index.html. Serveren
   er nyttig når du vil teste på mobil på samme nettverk, eller når
   nettleseren er streng med filer åpnet via file://.
   ============================================================= */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const rot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 8080);

const TYPER = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const server = createServer(async (req, res) => {
  let sti = decodeURIComponent((req.url || '/').split('?')[0]);
  if (sti.endsWith('/')) sti += 'index.html';

  // Ikke server noe utenfor prosjektmappa, uansett hvor mange ../ som sendes.
  const fil = join(rot, normalize(sti));
  if (fil !== rot && !fil.startsWith(rot + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('403 — utenfor prosjektmappa');
  }

  try {
    const data = await readFile(fil);
    res.writeHead(200, {
      'content-type': TYPER[extname(fil).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 — fant ikke ' + sti);
  }
});

server.listen(port, () => {
  console.log('\n  Trondheim Trafikk kjører:\n');
  console.log(`    http://localhost:${port}/`);
  for (const kort of Object.values(networkInterfaces()).flat()) {
    if (kort && kort.family === 'IPv4' && !kort.internal) {
      console.log(`    http://${kort.address}:${port}/   (mobil på samme wifi)`);
    }
  }
  console.log('\n  Avslutt med Ctrl+C\n');
});

server.on('error', (feil) => {
  if (feil.code === 'EADDRINUSE') {
    console.error(`Port ${port} er opptatt. Prøv: node tools/server.mjs ${port + 1}`);
    process.exit(1);
  }
  throw feil;
});

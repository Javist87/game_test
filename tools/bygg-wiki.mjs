#!/usr/bin/env node
/* =============================================================
   Bygger wiki/*.md til en liten statisk nettside i dist/wiki/.

   Markdown-filene er fasiten — de vises fint direkte på GitHub, og
   denne generatoren lager i tillegg en versjon som kan bla-es i med
   samme utseende som spillet.

       node tools/bygg-wiki.mjs

   Ingen avhengigheter. Markdown-støtten dekker akkurat det wikien
   bruker: overskrifter, avsnitt, lister, tabeller, kodeblokker,
   sitater, skillelinjer, lenker og enkel utheving.
   ============================================================= */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const rot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kilde = resolve(rot, 'wiki');
const ut = resolve(rot, 'dist/wiki');

/* Rekkefølgen i menyen. Filer som ikke står her havner bakerst. */
const REKKEFOLGE = [
  'Hjem.md',
  'Slik-spiller-du.md',
  'Strategi.md',
  'Brettene.md',
  'Kartet.md',
  'Arkitektur.md',
  'Simuleringen.md',
  'Utvikling.md',
  'Ordliste.md'
];

/* ---------------------------------------------------------------
   Markdown
   --------------------------------------------------------------- */

const rom = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Lager en id som stemmer med GitHub sine overskriftslenker. */
function ankerId(tekst) {
  return tekst
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Utheving, kode og lenker inne i en linje. */
function innhold(s) {
  const koder = [];
  // Kode plukkes ut først, slik at ** og * inne i kode ikke tolkes som utheving.
  // Plassholderen rammes inn av NUL-tegn, som aldri finnes i markdownen — et
  // tallmerke med mellomrom rundt ville kollidert med vanlige tall i teksten.
  s = s.replace(/`([^`]+)`/g, (_, k) => `\u0000${koder.push(`<code>${rom(k)}</code>`) - 1}\u0000`);
  s = rom(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, tekst, mal) => {
    // Interne lenker mellom wikisider peker på .html i den bygde versjonen.
    const url = mal.replace(/^([\w-]+)\.md(#.*)?$/, '$1.html$2');
    const ekstern = /^https?:/.test(url);
    return `<a href="${url}"${ekstern ? ' target="_blank" rel="noopener"' : ''}>${tekst}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => koder[Number(i)]);
}

const celler = (rad) =>
  rad.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

function tilHtml(md) {
  const linjer = md.split(/\r?\n/);
  const ute = [];
  const innhold_ = [];   // innholdsfortegnelse: { niva, tekst, id }
  let i = 0;

  while (i < linjer.length) {
    const l = linjer[i];

    if (!l.trim()) { i++; continue; }

    // ```kode```
    if (l.startsWith('```')) {
      const kode = [];
      i++;
      while (i < linjer.length && !linjer[i].startsWith('```')) kode.push(linjer[i++]);
      i++;
      ute.push(`<pre><code>${rom(kode.join('\n'))}</code></pre>`);
      continue;
    }

    // --- skillelinje
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(l.trim())) { ute.push('<hr>'); i++; continue; }

    // # overskrift
    const o = l.match(/^(#{1,6})\s+(.*)$/);
    if (o) {
      const niva = o[1].length;
      const tekst = innhold(o[2]);
      const id = ankerId(o[2]);
      if (niva >= 2 && niva <= 3) innhold_.push({ niva, tekst, id });
      ute.push(`<h${niva} id="${id}">${tekst}</h${niva}>`);
      i++;
      continue;
    }

    // | tabell |
    if (l.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(linjer[i + 1] || '')) {
      const hode = celler(l.trim());
      i += 2;
      const rader = [];
      while (i < linjer.length && linjer[i].trim().startsWith('|')) rader.push(celler(linjer[i++].trim()));
      ute.push(
        '<div class="tabell"><table><thead><tr>' +
        hode.map((c) => `<th>${innhold(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        rader.map((r) => '<tr>' + r.map((c) => `<td>${innhold(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>'
      );
      continue;
    }

    // > sitat
    if (l.startsWith('>')) {
      const tekst = [];
      while (i < linjer.length && linjer[i].startsWith('>')) tekst.push(linjer[i++].replace(/^>\s?/, ''));
      ute.push(`<blockquote>${innhold(tekst.join(' '))}</blockquote>`);
      continue;
    }

    // - liste  /  1. liste
    const punkt = l.match(/^(\s*)([-*]|\d+\.)\s+/);
    if (punkt) {
      const nummerert = /\d/.test(punkt[2]);
      const elementer = [];
      while (i < linjer.length) {
        const m = linjer[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (m) { elementer.push([m[3]]); i++; continue; }
        // fortsettelseslinje under samme punkt
        if (elementer.length && /^\s+\S/.test(linjer[i])) { elementer.at(-1).push(linjer[i].trim()); i++; continue; }
        break;
      }
      const tag = nummerert ? 'ol' : 'ul';
      ute.push(`<${tag}>` + elementer.map((e) => `<li>${innhold(e.join(' '))}</li>`).join('') + `</${tag}>`);
      continue;
    }

    // vanlig avsnitt
    const avsnitt = [];
    while (i < linjer.length && linjer[i].trim() && !/^(#{1,6}\s|```|>|\s*([-*]|\d+\.)\s|\|)/.test(linjer[i]) &&
           !/^(-{3,}|_{3,}|\*{3,})$/.test(linjer[i].trim())) {
      avsnitt.push(linjer[i++]);
    }
    if (avsnitt.length) ute.push(`<p>${innhold(avsnitt.join(' ').trim())}</p>`);
    else i++;
  }

  return { html: ute.join('\n'), innhold: innhold_ };
}

/* ---------------------------------------------------------------
   Side
   --------------------------------------------------------------- */

const STIL = `
:root {
  --bg:#0b1018; --flate:#131a26; --kant:rgba(255,255,255,.09);
  --tekst:#e7edf7; --dempet:#93a1b6; --gronn:#3ddc84; --bla:#6fc4ff; --kobber:#c98a4b;
}
* { box-sizing:border-box; }
body {
  margin:0; background:var(--bg); color:var(--tekst);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  line-height:1.65; -webkit-font-smoothing:antialiased;
}
.ramme { display:grid; grid-template-columns:250px minmax(0,1fr); gap:40px; max-width:1180px; margin:0 auto; padding:0 24px; }
nav { position:sticky; top:0; align-self:start; height:100vh; overflow-y:auto; padding:28px 0; }
.merke { display:flex; align-items:center; gap:10px; margin-bottom:22px; text-decoration:none; color:inherit; }
.merke-lys { display:flex; flex-direction:column; gap:3px; padding:5px 4px; background:#121926; border:1px solid var(--kant); border-radius:7px; }
.merke-lys i { width:8px; height:8px; border-radius:50%; }
.merke-lys i:nth-child(1){ background:#ff5a5a; box-shadow:0 0 8px #ff5a5a; }
.merke-lys i:nth-child(2){ background:#4a3a1c; }
.merke-lys i:nth-child(3){ background:var(--gronn); box-shadow:0 0 8px var(--gronn); }
.merke .navn { min-width:0; }
.merke b { display:block; font-size:15px; letter-spacing:-.2px; }
.merke .navn span { display:block; font-size:11.5px; color:var(--dempet); }
nav ul { list-style:none; margin:0 0 22px; padding:0; }
nav a { display:block; padding:7px 12px; border-radius:9px; color:var(--dempet); text-decoration:none; font-size:13.5px; }
nav a:hover { background:rgba(255,255,255,.05); color:var(--tekst); }
nav a.na { background:rgba(61,220,132,.12); color:var(--gronn); font-weight:600; }
nav .toc { border-left:1px solid var(--kant); margin-left:12px; padding-left:6px; }
nav .toc a { font-size:12.5px; padding:4px 10px; }
nav .toc a.dyp { padding-left:22px; }
.spill-lenke { display:block; margin-top:8px; padding:10px 12px; border-radius:10px; text-align:center;
  background:linear-gradient(180deg,#47e58f,#22b46b); color:#06231a; font-weight:800; font-size:13px; text-decoration:none; }
main { padding:40px 0 90px; min-width:0; }
h1 { font-size:clamp(28px,4.2vw,40px); letter-spacing:-.03em; line-height:1.15; margin:0 0 20px; }
h2 { font-size:23px; letter-spacing:-.02em; margin:44px 0 12px; padding-top:18px; border-top:1px solid var(--kant); }
h3 { font-size:17px; margin:28px 0 8px; }
h4 { font-size:14.5px; margin:22px 0 6px; color:var(--dempet); }
p { margin:0 0 15px; color:#c8d3e2; }
a { color:var(--bla); }
strong { color:var(--tekst); }
ul,ol { margin:0 0 15px; padding-left:22px; color:#c8d3e2; }
li { margin-bottom:6px; }
code { background:#151d2b; border:1px solid var(--kant); border-radius:5px; padding:1px 5px; font-size:.88em; color:#dfe7f3; }
pre { background:#0e141f; border:1px solid var(--kant); border-radius:12px; padding:16px; overflow-x:auto; margin:0 0 18px; }
pre code { background:none; border:0; padding:0; font-size:12.8px; line-height:1.6; color:#cfdaea; }
blockquote { margin:0 0 18px; padding:12px 18px; border-left:3px solid var(--kobber);
  background:rgba(201,138,75,.07); border-radius:0 10px 10px 0; color:#cdd8e6; }
blockquote p { margin:0; }
hr { border:0; border-top:1px solid var(--kant); margin:34px 0; }
/* h2 har allerede sin egen strek — ikke tegn to når et avsnitt er delt med ---. */
hr + h2 { border-top:0; padding-top:0; margin-top:0; }
.tabell { overflow-x:auto; margin:0 0 20px; border:1px solid var(--kant); border-radius:12px; }
table { border-collapse:collapse; width:100%; font-size:13.5px; }
th,td { text-align:left; padding:9px 13px; border-bottom:1px solid var(--kant); }
th { background:rgba(255,255,255,.035); font-size:11px; text-transform:uppercase; letter-spacing:.07em; color:var(--dempet); white-space:nowrap; }
tr:last-child td { border-bottom:0; }
td code { white-space:nowrap; }
footer { margin-top:60px; padding-top:20px; border-top:1px solid var(--kant); font-size:12px; color:var(--dempet); }
.nav-knapp { display:none; }
@media (max-width:900px) {
  .ramme { grid-template-columns:1fr; gap:0; padding:0 18px; }
  nav { position:static; height:auto; padding:22px 0 0; }
  nav .toc { display:none; }
  nav ul { display:flex; flex-wrap:wrap; gap:4px; }
  nav a { padding:6px 11px; border:1px solid var(--kant); }
  main { padding:26px 0 60px; }
  h2 { font-size:20px; }
}
`.trim();

function side({ tittel, kropp, meny, toc, filnavn }) {
  return `<!DOCTYPE html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${rom(tittel === 'Trondheim Trafikk' ? 'Trondheim Trafikk — Wiki' : `${tittel} — Trondheim Trafikk`)}</title>
<meta name="description" content="Wiki for Trondheim Trafikk — ${rom(tittel)}.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%230d121b'/><circle cx='16' cy='9' r='3.4' fill='%23ff5a5a'/><circle cx='16' cy='17' r='3.4' fill='%23ffbe3c'/><circle cx='16' cy='25' r='3.4' fill='%233ddc84'/></svg>">
<style>${STIL}</style>
</head>
<body>
<div class="ramme">
  <nav>
    <a class="merke" href="Hjem.html">
      <span class="merke-lys"><i></i><i></i><i></i></span>
      <span class="navn"><b>Trondheim Trafikk</b><span>Wiki</span></span>
    </a>
    <ul>${meny}</ul>
    ${toc ? `<div class="toc">${toc}</div>` : ''}
    <a class="spill-lenke" href="../index.html">Spill spillet →</a>
  </nav>
  <main>
${kropp}
    <footer>
      Trondheim Trafikk · denne sida er bygget fra <code>wiki/${rom(filnavn)}</code>
      med <code>tools/bygg-wiki.mjs</code>.
    </footer>
  </main>
</div>
</body>
</html>
`;
}

/* ---------------------------------------------------------------
   Kjør
   --------------------------------------------------------------- */

const filer = (await readdir(kilde)).filter((f) => f.endsWith('.md'));
filer.sort((a, b) => {
  const ia = REKKEFOLGE.indexOf(a), ib = REKKEFOLGE.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'nb');
});

if (!filer.length) {
  console.error('Fant ingen .md-filer i wiki/');
  process.exit(1);
}

const sider = [];
for (const fil of filer) {
  const md = await readFile(resolve(kilde, fil), 'utf8');
  const forste = md.match(/^#\s+(.*)$/m);
  sider.push({
    fil,
    navn: basename(fil, '.md'),
    tittel: forste ? forste[1].trim() : basename(fil, '.md').replace(/-/g, ' '),
    md
  });
}

await mkdir(ut, { recursive: true });

for (const s of sider) {
  const { html, innhold: overskrifter } = tilHtml(s.md);
  const meny = sider
    .map((a) => `<li><a href="${a.navn}.html"${a.fil === s.fil ? ' class="na"' : ''}>${rom(a.tittel)}</a></li>`)
    .join('');
  const toc = overskrifter
    .map((h) => `<a href="#${h.id}"${h.niva === 3 ? ' class="dyp"' : ''}>${h.tekst}</a>`)
    .join('');

  await writeFile(
    resolve(ut, `${s.navn}.html`),
    side({ tittel: s.tittel, kropp: html, meny, toc, filnavn: s.fil }),
    'utf8'
  );
}

// /wiki/ skal lande på forsida.
await writeFile(
  resolve(ut, 'index.html'),
  `<!DOCTYPE html><html lang="nb"><head><meta charset="utf-8">
<title>Trondheim Trafikk — Wiki</title>
<meta http-equiv="refresh" content="0; url=Hjem.html">
<link rel="canonical" href="Hjem.html"></head>
<body><p>Videresender til <a href="Hjem.html">wikien</a>…</p></body></html>
`,
  'utf8'
);

console.log(`Ferdig: dist/wiki/ (${sider.length} sider)`);
for (const s of sider) console.log(`  ${s.navn}.html — ${s.tittel}`);

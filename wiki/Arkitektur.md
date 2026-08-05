# Arkitektur

Fire JavaScript-filer, én CSS-fil, én HTML-fil. Ingen moduler, ingen bundler,
ingen avhengigheter — bare fire `<script>`-tagger i riktig rekkefølge.

```
index.html        oppsett og grensesnitt
css/style.css     stilark
js/data.js        veinett, steder, kystlinje, Nidelva og brettdefinisjoner
js/engine.js      simuleringen: biler, ruter og trafikklys
js/render.js      canvas-tegning av kart, kjøretøy og signaler
js/game.js        spillflyt, input, HUD og lagring
tools/server.mjs  liten lokal webserver
tools/bygg-*.mjs  byggeverktøy (enkeltfil og wiki)
```

---

## Ett globalt navnerom

Alt henger på `window.TT`. `data.js` oppretter det, resten fyller det ut:

```js
var TT = (window.TT = window.TT || {});
```

De tre andre filene er lukkede funksjoner som får `TT` inn og henger sine egne
ting på det:

```js
(function (TT) {
  'use strict';
  // …
  TT.Motor = Motor;
})(window.TT);
```

**Rekkefølgen er ikke valgfri.** `engine.js` og `render.js` leser `TT.SKALA` med
én gang de kjøres, og den settes i `data.js`. `game.js` må være sist, siden den
oppretter både `Tegner` og `Motor`.

---

## Ansvarsdeling

```
        data.js
           │  kart, veier, brett  (rene data — ingen logikk)
           ▼
   ┌───────────────┐
   │   engine.js   │  Motor: biler, ruter, lys, poeng, frustrasjon
   └───────┬───────┘  Vet ingenting om canvas eller DOM.
           │
           │  motor-objektet leses av
           ▼
   ┌───────────────┐
   │   render.js   │  Tegner + Kamera: leser motoren, tegner et bilde
   └───────┬───────┘  Endrer aldri på motoren.
           │
           ▼
   ┌───────────────┐
   │    game.js    │  Limet: rammeløkke, input, HUD, overlegg, lagring
   └───────────────┘
```

Poenget med delingen er at **motoren kan kjøres uten skjerm**. Den bruker verken
`document`, `canvas` eller `window`, bare tall og tid. Det gjør det mulig å
teste den, eller kjøre den raskere enn sanntid, uten å tegne noe.

---

## `js/data.js`

Rene data, ingen atferd:

| Eksport | Innhold |
| --- | --- |
| `TT.WORLD` | Kartets størrelse |
| `TT.NODES` | De 31 stedene |
| `TT.NODE_BY_ID` | Oppslagstabell for det samme |
| `TT.VEIER` | De 41 gatene som `[fra, til, navn, fart]` |
| `TT.KYST`, `TT.NIDELVA`, `TT.MUNKHOLMEN` | Landskap |
| `TT.BRETT` | De fem brettene |
| `TT.FAKTA` | Faktadryppene på briefskjermen |
| `TT.SKALA` | Skaleringsfaktoren, 1.6 |

Nederst i fila skaleres alt opp og `NODE_BY_ID` bygges. Se
[Kartet](Kartet.md#koordinatsystemet) for hvorfor.

---

## `js/engine.js`

Her ligger simuleringen. To klasser:

### `Lys`

Ett trafikklys, alltid med to grønnfaser. Holder styr på hvilken fase som er
aktiv, hvor lenge den har vart, og hvilken gruppe hver tilkoblet gate hører til.

| Metode | Gjør |
| --- | --- |
| `oppdater(dt)` | Teller fram, skifter fase når `periode` er nådd |
| `erGronn(veiId)` | Er denne gata grønn nå? (gultid teller som rødt) |
| `erGult()` | Er vi i de siste 1,3 sekundene av fasen? |
| `bytt()` | Spillerens klikk — hopper til gultid |
| `settPeriode(v)` | Omløpstid, klemt til 5–22 s |

### `Motor`

Selve simuleringen, opprettet med ett brett:

```js
var motor = new TT.Motor(TT.BRETT[0]);
motor.oppdater(0.033);   // ett steg på 33 ms
console.log(motor.poeng, motor.flyt, motor.frustrasjon);
```

Ett kall til `oppdater(dt)` gjør, i rekkefølge:

1. Tell fram klokka, oppdater alle lys
2. Sett ut nye biler etter brettets rate ganger rushbølgen
3. Sorter bilene inn i felt, etter posisjon
4. Regn ut akselerasjon for hver bil (IDM)
5. Flytt bilene, håndter kryssing og levering
6. Oppdater flyt, frustrasjon og kombo

Detaljene i steg 3–5 er beskrevet i [Simuleringen](Simuleringen.md).

Motoren snakker til grensesnittet gjennom en liten kø, `motor.hendelser`, som
`game.js` tømmer og viser som varsler.

---

## `js/render.js`

To klasser, begge rene lesere:

**`Kamera`** — posisjon, zoom og omregning mellom skjerm- og verdenskoordinater.
`tilSkjerm()` og `tilVerden()` er inverse av hverandre; det er dem hele
input-håndteringen hviler på.

**`Tegner`** — tegner ett bilde per ramme, i lag nedenfra:

```
bakgrunn → fjord → elva → veier → biler → steder → lys
```

`ikon()` nederst i fila er en stor `switch` som tegner hvert stedssymbol med rene
canvas-kall — katedral, bybro, festning, fisk, det runde Samfundet-huset og resten.
Ingen bildefiler er involvert i hele spillet.

Tegneren håndterer også **devicePixelRatio**, så kartet er skarpt på
retina-skjermer, men aldri over 2× (ellers blir det for tungt på mobil).

---

## `js/game.js`

Limet. Ansvarsområder:

| Del | Hva |
| --- | --- |
| Tilstand | `spill.modus` er `meny`, `brief`, `spiller`, `pause` eller `slutt` |
| Rammeløkke | `requestAnimationFrame`, med faste delsteg |
| Input | Peker, hjul og tastatur |
| HUD | Poeng, tid, flyt, frustrasjon, varsler |
| Overlegg | Meny, brief, pause og sluttskjerm |
| Lagring | `localStorage`, med `try`/`catch` rundt alt |
| Lyd | Små toner generert med WebAudio — ingen lydfiler |

### Rammeløkka

```js
var dt = Math.min(0.05, (na - sist) / 1000);   // aldri hopp for langt
var steg = dt * spill.fart;
var n = Math.ceil(steg / 0.034);               // del opp i småsteg
for (var i = 0; i < n; i++) motor.oppdater(steg / n);
```

To ting skjer her. `Math.min(0.05, …)` hindrer at simuleringen hopper når du
bytter fane og kommer tilbake. Oppdelingen i småsteg holder IDM-modellen stabil
på 2× og 3× fart — med for lange tidssteg begynner biler å kjøre gjennom
hverandre.

### Input

All pekerhåndtering går gjennom `pointerdown` / `pointermove` / `pointerup`, som
dekker mus, finger og penn i én kodesti. `pointermove` og `pointerup` lyttes på
`window`, ikke på canvaset, slik at et drag som ender utenfor vinduet ikke blir
hengende.

Et klikk telles bare som klikk hvis pekeren beveget seg under 4 piksler — ellers
var det et drag. To fingre er alltid knip, aldri klikk.

---

## Bevisste valg

**Ingen byggesteg.** Rediger en fil, trykk oppdater. Byggeverktøyene i `tools/`
er valgfrie — spillet kjører uten dem.

**ES5-stil.** `var`, `function`, ingen piler eller klasser i spillkoden. Det gjør
at fila kan kjøres direkte i alt som har et canvas, uten transpilering.
Verktøyene i `tools/` er derimot moderne ES-moduler, siden de bare kjøres i Node.

**Norsk i koden.** Variabler, funksjoner og kommentarer er på norsk, som spillet
selv. Se [Ordlista](Ordliste.md) hvis du er vant til engelske begreper.

**Ingen bilder eller lydfiler.** Alt er tegnet med canvas-kall og generert med
WebAudio. Derfor kan hele spillet limes inn i én HTML-fil på 87 kB.

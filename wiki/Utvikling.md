# Utvikling

## Kjøre spillet

Det finnes tre måter, i økende rekkefølge av innsats.

### 1. Bare åpne fila

```
Dobbeltklikk index.html
```

Det er alt. Spillet har ingen moduler, ingen `fetch`-kall og ingen ressurser som
lastes i bakgrunnen, så det kjører helt fint rett fra `file://`. Dette er
raskeste vei til å se en endring du nettopp gjorde.

Den ene tingen som kan glippe: enkelte nettlesere lar ikke sider på `file://`
bruke `localStorage`. Da fungerer spillet fortsatt, men rekorder lagres ikke.
Bruk en lokal server om det plager deg.

### 2. Lokal server

```bash
npm start                # port 8080
node tools/server.mjs 3000   # eller en annen port
```

`tools/server.mjs` bruker bare Node sitt eget standardbibliotek — ingen
`npm install`, ingen nettforbindelse. Den skriver ut både `localhost`-adressen og
maskinens adresse på nettverket, så du kan åpne spillet på mobilen din over
samme wifi.

### 3. Én enkelt fil

```bash
npm run bygg
```

Bygger `dist/trondheim-trafikk.html` — hele spillet, CSS og JavaScript limt rett
inn i dokumentet. Rundt 87 kB. Den fila kan sendes på e-post, legges på en
minnepinne eller åpnes offline, og har ingen andre filer å holde styr på.

`dist/` er ikke sjekket inn; bygg den når du trenger den.

---

## Prosjektstruktur

```
index.html            grensesnittet
css/style.css         stilark
js/data.js            kart, veinett og brett
js/engine.js          simuleringen
js/render.js          canvas-tegning
js/game.js            spillflyt, input, HUD
tools/server.mjs      lokal webserver, uten avhengigheter
tools/bygg-enkeltfil.mjs   bygger dist/trondheim-trafikk.html
tools/bygg-wiki.mjs        bygger dist/wiki/ fra wiki/*.md
wiki/                 denne wikien, som markdown
docs/                 skjermbilder
```

Se [Arkitektur](Arkitektur.md) for hvordan filene henger sammen.

---

## Vanlige endringer

### Legge til et sted

I `js/data.js`, i `TT.NODES`:

```js
{ id: 'oya', navn: 'Øya', x: 232, y: 560, ikon: 'nabolag' },
```

Koordinatene er i ureskalert rutenett (1000 × 900) — skaleringen skjer
automatisk nederst i fila. Legg deretter minst én gate i `TT.VEIER`, og ta med
`'oya'` i `noder` for de brettene stedet skal være med i.

`ikon` må være en av typene i `render.js` (`nabolag`, `bru`, `stadion`,
`sykehus`, `torg`, `festning`, …). Ukjente navn gir en enkel sirkel.

### Legge til en gate

```js
['stolavs', 'oya', 'Klostergata sør', 60],
```

Formatet er `[fra, til, navn, fart]`. Farten er i piksler per sekund før
skalering: ~50–70 for bygate, ~75–100 for hovedvei, 120–130 for motorvei.

Gata dukker opp på alle brett der **begge** endene er i `noder`. Får en node tre
gater, får den automatisk lyskryss.

### Legge til et brett

Se [Brettene](Brettene.md#hvordan-et-brett-er-definert) for hele malen.

### Justere vanskelighetsgrad

| Vil du… | Endre |
| --- | --- |
| Mer trafikk | `rate` på brettet |
| Høyere krav | `maal` på brettet |
| Mer nådeløs frustrasjon | `stress` på brettet |
| Bilene tåler mer kø | `TALEGRENSE` i `engine.js` (nå 0,55) |
| Sjåførene blir sure senere | Grensen `bil.ventet > 22` i `engine.js` |
| Mer sjenerøse poeng | `grunn` og `bonus` i `Motor.prototype.levering` |

---

## Kodestil

- **ES5 i spillkoden.** `var`, `function`, ingen piler eller klasser. Det gjør at
  filene kjører direkte i alt som har et canvas, uten transpilering.
  Verktøyene i `tools/` er derimot moderne ES-moduler.
- **Norsk.** Variabler, funksjoner og kommentarer er på norsk, som spillet.
  [Ordlista](Ordliste.md) oversetter begrepene.
- **Kommentarer forklarer hvorfor, ikke hva.** De fleste kommentarene i koden
  begrunner et valg som ellers ville sett rart ut.
- **Ingen avhengigheter.** Verken i spillet eller i verktøyene. Det er en
  begrensning verdt å holde på: den er grunnen til at prosjektet fortsatt kjører
  om fem år.

---

## Teste endringer

Det er ingen automatiske tester i prosjektet. Sjekklista under dekker det som
faktisk pleier å ryke:

1. **Alle fem brett starter.** Åpne menyen, velg hvert brett, se at kartet
   sentreres og at biler dukker opp.
2. **Et brett kan fullføres.** Kjør brett 1 på 3× og se at sluttskjermen kommer.
3. **Ingen feil i konsollen.** Verken ved lasting eller under spilling.
4. **Mobil.** Åpne på telefon via `npm start`, sjekk at HUD-en ikke dekker
   kartet og at knip-zoom virker.
5. **`file://`.** Dobbeltklikk `index.html` og spill et halvt minutt.
6. **Enkeltfila.** `npm run bygg` og åpne resultatet.

Endrer du på veinettet, er det verdt å sjekke i konsollen at alle ruter går opp:

```js
var m = new TT.Motor(TT.BRETT[4]);
m.kilder.forEach(function (fra) {
  m.mal.forEach(function (til) {
    if (fra !== til && !m.finnRute(fra, til)) console.warn('ingen rute', fra, '→', til);
  });
});
```

---

## Publisering

Prosjektet er en statisk side, så alt som kan servere filer duger.

### GitHub Pages

`.github/workflows/pages.yml` publiserer automatisk ved hver push til `main`.
Den bygger enkeltfila og wikien, setter sammen `_site/` og ruller det ut.

Pages slås på av seg selv første gang — `actions/configure-pages` kjøres med
`enablement: true`. Blokkerer organisasjonen din det, slår du det på manuelt:

> **Settings → Pages → Build and deployment → Source: GitHub Actions**

Spillet ligger på `https://<bruker>.github.io/<repo>/`, wikien på `/wiki/` og
enkeltfila på `/dist/trondheim-trafikk.html`.

### Alt annet

Kopier `index.html`, `css/` og `js/` hvor som helst — de tre er alt som trengs.
Ingen serverkonfigurasjon, ingen omskrivingsregler, ingen byggesteg.

---

## Bidra

1. Lag en gren fra `main`.
2. Gjør endringen.
3. Gå gjennom sjekklista over.
4. Åpne en pull request som forklarer hva som endret seg og hvorfor.

Endrer du spillmekanikk, skriv gjerne i beskrivelsen hvordan det føltes å spille
det etterpå. Tallene i `engine.js` er balansert etter følelse, ikke etter noe
fasitsvar.

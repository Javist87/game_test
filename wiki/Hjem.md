# Trondheim Trafikk

**Et lite simulatorspill der oppgaven er å holde trafikken i flyt gjennom Trondheim.**

Du styrer ikke bilene. Du styrer *lysene*. Biler, taxier og metrobusser velger
sin egen korteste vei gjennom byen, og den eneste knappen du har er når hvert
kryss skal skifte grønn retning. Slipper du én retning for lenge, står den andre
og koker. Skifter du for ofte, kommer ingen noen vei.

Byen er ekte: koordinatene er projisert fra faktiske lengde- og breddegrader, så
Midtbyen ligger i elveslyngen, Bakklandet på østsiden av Nidelva, Gløshaugen og
Lerkendal i sør og Lade mot nordøst.

---

## Kom raskt i gang

| Du vil… | Gjør dette |
| --- | --- |
| Spille med én gang | [javist87.github.io/game_test](https://javist87.github.io/game_test/) |
| Spille lokalt | Åpne `index.html` — dobbeltklikk holder |
| Ha spillet i én enkelt fil | `npm run bygg` → `dist/trondheim-trafikk.html` |
| Teste på mobil | `npm start`, åpne adressen den skriver ut |

Ingen byggesteg, ingen npm-pakker, ingen nettforbindelse. Spillet er ren HTML,
CSS og JavaScript.

---

## Innholdet i wikien

### For deg som spiller

- **[Slik spiller du](Slik-spiller-du.md)** — kontroller, regler og hvordan poeng regnes
- **[Strategi](Strategi.md)** — grønn bølge, omløpstid og de vanligste tabbene
- **[Brettene](Brettene.md)** — alle fem brett, med hva som er hardt på hvert
- **[Kartet](Kartet.md)** — de 31 stedene og 41 gatene, og hvordan de henger sammen

### For deg som vil se på koden

- **[Arkitektur](Arkitektur.md)** — hvordan de fire JavaScript-filene henger sammen
- **[Simuleringen](Simuleringen.md)** — IDM, Dijkstra og hvordan fasene settes opp
- **[Utvikling](Utvikling.md)** — kjøre, bygge, publisere og bidra
- **[Ordliste](Ordliste.md)** — norsk↔engelsk for begrepene i koden

---

## Kort om prosjektet

|  |  |
| --- | --- |
| **Type** | Nettleserspill, enkeltspiller |
| **Teknologi** | HTML, CSS og JavaScript (ES5-stil, ingen rammeverk) |
| **Avhengigheter** | Ingen — verken i spillet eller i verktøyene |
| **Kodestørrelse** | ~1 850 linjer JavaScript, ~370 linjer CSS |
| **Språk i kode og grensesnitt** | Norsk |
| **Lisens** | MIT |

Prosjektet er skrevet med vilje uten byggesteg. Alt du trenger for å endre
spillet er en teksteditor og en nettleser: rediger en fil, trykk oppdater.

# Simuleringen

Tre mekanismer bærer hele spillet: bilene følger en **IDM-modell**, rutene
beregnes med **Dijkstra**, og lysfasene settes opp med et lite
**søk over todelinger**. Denne sida forklarer alle tre.

---

## Bilene: Intelligent Driver Model

Hver bil justerer farten etter avstanden til det som ligger foran. Modellen er
en forenklet IDM, og formelen ser slik ut:

```js
function idm(v, v0, gap, dv) {
  var fri = 1 - Math.pow(Math.max(0, v) / v0, 4);
  if (gap === Infinity) return BIL.a * fri;
  var sStjerne = BIL.s0 + Math.max(0, v * BIL.T + (v * dv) / (2 * Math.sqrt(BIL.a * BIL.b)));
  var forhold = gap > 0.5 * S ? sStjerne / gap : 20;
  return BIL.a * (fri - forhold * forhold);
}
```

| Ledd | Betydning |
| --- | --- |
| `v` | Bilens fart nå |
| `v0` | Ønsket fart — gatas fartsgrense, redusert i svinger |
| `gap` | Avstand til hindringen foran |
| `dv` | Fartsforskjell (positiv når du nærmer deg) |
| `fri` | Fri kjøring: full gass når `v` er langt under `v0` |
| `sStjerne` | Ønsket avstand ved denne farten |

Er `gap` mye større enn `sStjerne`, dominerer `fri` og bilen akselererer. Blir
`gap` mindre enn ønsket avstand, vokser andreleddet kvadratisk og bilen bremser
hardt. Det gir kjøring som ser naturlig ut: myk oppbremsing på avstand, panikk
tett på.

### Parametrene

| Konstant | Verdi | Betydning |
| --- | --- | --- |
| `BIL.s0` | 3,2 × skala | Avstand til bilen foran i stillestående kø |
| `BIL.T` | 0,95 | Tidsluke — hvor mange sekunder bak forankjørende |
| `BIL.a` | 3,0 × skala | Komfortabel akselerasjon |
| `BIL.b` | 3,4 × skala | Komfortabel retardasjon |
| `BIL.lengde` | 10,5 × skala | Billengde (metrobuss: 19) |

### Tre hindringer, ikke én

Det interessante er at `gap` regnes ut mot **den nærmeste av tre** ting:

1. **Bilen foran** i samme felt.
2. **Stopplinja**, hvis lyset er rødt. Den ligger 9 piksler før krysset.
3. **Den første bilen i gata bilen skal inn i.** Dette er detaljen som hindrer
   at kryss låser seg: en bil kjører ikke inn i krysset hvis det ikke er plass
   på andre siden.

```js
var slippGjennom = this.kanKjore(bil);
if (!slippGjennom) {
  if (tilStopp < gap) { gap = tilStopp; dv = bil.fart; }   // rødt lys
} else {
  var nf = this.nesteFelt(bil);
  if (nf && nf.biler.length) {
    var f0 = nf.biler[0];
    var g = tilStopp + (f0.s - f0.lengde);                 // køen på andre siden
    if (g < gap) { gap = g; dv = bil.fart - f0.fart; }
  }
}
```

Uten punkt 3 ville biler kjørt inn i fulle gater og sperret krysset for
tverrtrafikken — og hele nettet ville låst seg i løpet av et halvminutt.

### Svinger

Skal bilen svinge skarpt i neste kryss, senkes ønsket fart før den kommer dit:

| Svingvinkel | Maks fart inn i svingen |
| --- | --- |
| Over ~40° | 58 × skala |
| Over ~40° og skarpere enn ~90° | 42 × skala |

Det er derfor kryss med mange skarpe svinger naturlig har lavere kapasitet.

---

## Rutene: Dijkstra på kjøretid

Når en bil settes ut, får den en fast rute fra kilde til mål. Ruta beregnes med
Dijkstra, der kanten koster **kjøretid**, ikke lengde:

```js
var d = dist[n] + kob.vei.len / kob.vei.fart;
```

Konsekvensen er at motorveier er attraktive selv når de er en omvei. En bil fra
Heimdal til Lade tar gjerne Omkjøringsvegen framfor å kjøre gjennom Midtbyen —
akkurat som i virkeligheten.

**Ruta er låst.** Bilen beregner den én gang, ved utsetting, og bytter aldri selv
om det oppstår kø foran den. Det er en bevisst forenkling: den gjør spillet
forutsigbart for spilleren, og betyr at en kø du skaper faktisk må løses, ikke
bare omdirigeres.

Implementasjonen er en enkel O(V²)-variant uten prioritetskø. Med maks 31 noder
er det raskere enn en heap ville vært.

---

## Lysfasene: søk over todelinger

Hvert kryss med tre eller flere gater får et lys med to grønnfaser. Hvilke gater
som hører til hvilken fase bestemmes automatisk, ved å prøve **alle mulige
todelinger** av tilfartsveiene og velge den beste:

```js
for (var mask = 1; mask < (1 << n) - 1; mask++) {
  var score = 0, antall = 0;
  for (var i = 0; i < n; i++) {
    if (mask & (1 << i)) antall++;
    for (var j = i + 1; j < n; j++) {
      var sammen = ((mask >> i) & 1) === ((mask >> j) & 1);
      if (sammen) score += avstand180(vinkler[i], vinkler[j]);
    }
  }
  score += Math.abs(antall - (n - antall)) * 18;   // foretrekk balanse
  if (score < bestScore) { bestScore = score; best = mask; }
}
```

Straffen er summen av vinkelavstander mellom gater som havner i **samme** gruppe.
Å legge to gater som peker samme vei i samme fase koster nesten ingenting; å
legge to som står vinkelrett på hverandre i samme fase koster mye. Resultatet blir
naturlige «nord–sør»- og «øst–vest»-faser, uten at noen har tegnet dem inn.

Leddet på slutten straffer skjeve delinger, så et firearmet kryss får 2 + 2 og
ikke 1 + 3.

Med maksimalt fem gater inn i et kryss er det høyst 30 todelinger å prøve. Det
gjøres én gang, når brettet lastes.

### Faseklokka

```
|←────────── periode (5–22 s) ──────────→|
|←────────── grønn ──────────→|← gult 1,3 s →|
```

Klikker du krysset, hopper klokka rett til starten av gultida. Du kan altså ikke
skifte umiddelbart — det er alltid en gulfase imellom, akkurat som i et ekte
lyskryss. Klikker du igjen mens det er gult, skjer ingenting.

---

## Poeng, tålmodighet og frustrasjon

### Når blir en sjåfør sur?

`bil.ventet` måler hvor lenge bilen har stått fast **akkurat nå** — ikke summen
av alle røde lys på turen:

```js
if (bil.fart < GRENSE_STILLE) bil.ventet += dt;        // står
else if (bil.fart > 26 * S)   bil.ventet = 0;          // i god fart igjen
else                          bil.ventet = Math.max(0, bil.ventet - dt * 2.5);
```

Tålmodigheten har **hysterese**: bilisten blir sur etter 22 sekunder, og roer seg
først når telleren er nede i 8 igjen. Uten hysterese ville biler blinket mellom
sur og blid hver gang køen rykket litt fram.

### Frustrasjonsmåleren

```js
var andel = staaende / antall;
var press = ((andel - 0.55) * 20 + sinte * 0.5) * brett.stress;
frustrasjon = klem(0, 100, frustrasjon + press * dt);
```

Legg merke til minus 0,55: så lenge under 55 % av bilene står stille og ingen er
sure, er `press` negativt og frustrasjonen **synker**. Litt kø er helt normalt i
en by. Det er varigheten som straffes, ikke køen i seg selv.

Er det ingen biler på kartet, settes `press` til −6 — byen roer seg raskt når
gatene er tomme.

### Trafikkbølgene

Utsettingsraten er ikke konstant:

```js
Motor.prototype.rushFaktor = function () {
  var p = this.tid / this.brett.varighet;
  return 0.72 + 0.55 * Math.sin(p * Math.PI) + 0.12 * Math.sin(this.tid * 0.7);
};
```

Første ledd er grunnraten. Det andre gir en lang bølge som topper seg midt i
brettet og roer seg mot slutten. Det tredje er en rask krusning som gjør at
trafikken kommer i klumper i stedet for jevnt fordelt.

Resultatet er at brettene har en rytme: rolig start der du rekker å stille inn,
et press på midten, og en avslutning der du kan rydde opp.

---

## Ytelse

| Grense | Verdi |
| --- | --- |
| Maks antall biler samtidig | 320 |
| Maks tidssteg per ramme | 50 ms |
| Lengde på hvert delsteg | ~34 ms |
| Maks devicePixelRatio | 2 |

Den tyngste operasjonen per ramme er sorteringen av biler inn i felt, som er
O(*n* log *n*) på antall biler. Med 320 biler og tre delsteg er det langt under
det en telefon klarer på 60 bilder i sekundet.

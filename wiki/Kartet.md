# Kartet

Kartet er ikke tegnet på frihånd. Koordinatene i `js/data.js` er projisert fra
faktiske lengde- og breddegrader og deretter forenklet, så geografien stemmer
noenlunde med virkeligheten: Midtbyen ligger i elveslyngen, Bakklandet på
østsiden av Nidelva, Gløshaugen og Lerkendal i sør, Lade mot nordøst.

**31 steder** knyttet sammen av **41 navngitte gater**.

---

## Koordinatsystemet

Kartet er definert i et rutenett på 1000 × 900, med origo øverst til venstre.
Ved innlasting ganges alt opp med `TT.SKALA = 1.6`, så verdenen blir
1600 × 1440 «verdenspiksler».

Hvorfor? Gatene må være **lange nok til å romme en skikkelig kø**. I den
opprinnelige størrelsen var en bygate knapt lengre enn tre biler, og nettet
låste seg med én gang. Fartsgrensene skaleres med samme faktor, så kjøretidene
er de samme — bare avstandene er større.

```js
TT.SKALA = 1.6;

(function (S) {
  TT.WORLD.w *= S;
  TT.WORLD.h *= S;
  TT.NODES.forEach(function (n) { n.x *= S; n.y *= S; });
  TT.VEIER.forEach(function (v) { v[3] *= S; });
  // … kystlinje, elv og Munkholmen skaleres likt
})(TT.SKALA);
```

Alt annet i koden regner i verdenspiksler etter skalering. `TT.SKALA` dukker opp
igjen i motoren og tegneren fordi også bil-lengder, avstander og
hastighetsgrenser må ganges med den.

---

## Stedene

Hvert sted er en node med `id`, `navn`, koordinater og et `ikon` som tegneren
bruker for å tegne symbolet.

### Midtbyen og havna

| Sted | Ikon | Merknad |
| --- | --- | --- |
| Ila | nabolag | Vest i byen |
| Skansen | bru | Innfarten til Midtbyen fra vest |
| Trondheim Spektrum | arena | |
| Trondheim S | stasjon | Jernbanestasjonen |
| Pirbadet | basseng | På Brattøra |
| Rockheim | museum | |
| Ravnkloa | fisk | Fisketorget |
| Torget | torg | Olav Tryggvason-statuen |
| Nidarosdomen | katedral | Verdens nordligste middelalderkatedral |
| Gamle Bybro | bybro | «Lykkens portal», fra 1681 |
| Bakklandet | trehus | Trehusbebyggelsen øst for elva |
| Bakke bru | bru | |
| Solsiden | restaurant | Nedre Elvehavn |
| Kristiansten festning | festning | Bygget etter bybrannen i 1681 |
| Nyhavna | kran | Havneområdet |
| Lade | nabolag | |
| Strindheim | nabolag | |
| Leangen | handel | |

### Sør — universitet, sykehus, idrett

| Sted | Ikon | Merknad |
| --- | --- | --- |
| Elgeseter bru | bru | Nåløyet sørover |
| Studentersamfundet | samfundet | Det runde røde huset |
| St. Olavs hospital | sykehus | |
| Marienborg | tog | |
| NTNU Gløshaugen | universitet | |
| Lerkendal stadion | stadion | Rundt 21 000 tilskuere |
| Tyholttårnet | taarn | 124 meter, roterende restaurant |
| Moholt | studentby | |

### Porter

Portene er der byen slutter og biler kommer inn eller forsvinner ut. De tegnes
med en grønn pil.

| Port | Retning |
| --- | --- |
| Byåsen | Vest |
| Sluppen | Sørvest |
| Heimdal · E6 sør | Sør |
| Værnes · E6 øst | Øst |
| Ranheim · E6 nord | Nordøst |

---

## Gatene

Hver gate er en rad på formen `[fra, til, navn, fart]`, der farten er i
piksler per sekund før skalering:

```js
['skansen', 'torget', 'Kongens gate', 70],
['torget',  'nidaros', 'Munkegata sør', 62],
['lade',    'p_ranheim', 'E6 nord', 130],
```

Tre grove klasser:

| Klasse | Fart | Eksempler |
| --- | --- | --- |
| Bygate | ~50–70 | Øvre Bakklandet, Munkegata, Klostergata |
| Hovedvei | ~75–100 | Innherredsveien, Nordre avlastningsveg, Byåsveien |
| Motorvei | 120–130 | E6 nord, E6 sør, E6 øst, Omkjøringsvegen |

Farten er både fartsgrense i simuleringen *og* kanten i ruteberegningen: en bil
velger raskeste vei, ikke korteste. Derfor tar biler gjerne en omvei via
Omkjøringsvegen framfor rett gjennom Midtbyen — akkurat som i virkeligheten.

Alle gater er toveis. Motoren lager to «felt» per gate, ett i hver retning, og
bilene tegnes forskjøvet til høyre for midtlinja.

---

## Vann og landskap

Tre ting tegnes utenom veinettet, rent for stemningens skyld:

- **`TT.KYST`** — kystlinja. Fjorden fylles som et polygon over den, med
  animerte bølgestriper.
- **`TT.NIDELVA`** — elva, som en tykk linje sørfra, vest for Lerkendal og
  Gløshaugen, forbi Øya og St. Olavs, under Elgeseter bru og Gamle Bybro, og ut
  i fjorden ved Brattøra.
- **`TT.MUNKHOLMEN`** — øya i fjorden, med navnelapp når du er zoomet nok inn.

Ingen av dem påvirker simuleringen. Bilene forholder seg utelukkende til
veinettet.

---

## Detaljnivå og zoom

Tegneren viser mer jo nærmere du er:

| Skala | Hva som dukker opp |
| --- | --- |
| > 0,42 | Navn på steder |
| > 0,50 | Midtstiplet linje i gatene |
| > 0,75 | Navnelapp på Munkholmen |
| > 0,90 | Vindusruter og bremselys på bilene |
| > 0,95 | Gatenavn langs veiene |

Zoom er begrenset til mellom 0,65× og 3,4× av grunnskalaen, og kameraet kan ikke
dras mer enn 260 piksler utenfor kartet.

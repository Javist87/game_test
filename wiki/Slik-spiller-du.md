# Slik spiller du

## Målet

Hvert brett varer et gitt antall sekunder. Når tida er ute har du vunnet hvis du
har nådd **poengmålet**. Men du kan tape før det: går **frustrasjonen** til
100 %, låser byen seg og brettet er tapt umiddelbart.

Så du balanserer to ting hele veien: få nok kjøretøy fram raskt nok til å samle
poeng, uten å la noen kø stå så lenge at byen mister tålmodigheten.

---

## Kontroller

| Handling | Mus / tastatur | Berøring |
| --- | --- | --- |
| Skift grønn retning i et kryss | klikk på krysset | trykk på krysset |
| Zoom | rull med musehjulet | knip med to fingre |
| Flytt kartet | dra | dra |
| Pause | `mellomrom` | pauseknappen ❚❚ |
| Lukk panelet / pause / tilbake | `Esc` | ✕ eller ☰ |
| Simuleringsfart | `1` `2` `3` | 1× / 2× / 3× |
| Start brettet på nytt | `R` | «Prøv igjen» |

`Esc` tar deg ett steg tilbake om gangen: først lukkes krysspanelet, så pauses
spillet, og fra brief- eller sluttskjermen går du til menyen.

☰ midt i et brett **pauser** — den kaster ikke runden. Veien til menyen går via
pausekortet, slik at du ikke mister et brett med et uhell.

---

## Krysspanelet

Klikker du et kryss, skjer to ting: lyset skifter fase med én gang, og panelet
nede til høyre åpner seg.

I panelet kan du justere **omløpstiden** — hvor lenge hver grønnfase varer før
lyset skifter av seg selv. Den kan settes mellom **5 og 22 sekunder**, og
standardverdien er 8. Dette er den viktigste knappen i spillet; se
[Strategi](Strategi.md).

Ringen rundt krysset viser hvor lenge det er igjen av fasen. Blir ringen gul, er
lyset i ferd med å skifte — de siste **1,3 sekundene** av hver fase er gultid,
og da slipper ingen inn i krysset.

> Ikke alle steder har lys. Bare kryss der **tre eller flere gater** møtes får
> trafikklys. Steder med to gater er gjennomkjøring, og de kan du ikke styre.

---

## Kjøretøyene

| Type | Andel | Grunnpoeng | Kjennetegn |
| --- | --- | --- | --- |
| Bil | ~81 % | 10 | Tilfeldig farge |
| Metrobuss | ~11 % | 22 | Grønn, og nesten dobbelt så lang |
| Taxi | ~8 % | 13 | Gul |

Alle velger den raskeste ruten gjennom veinettet i det øyeblikket de settes ut,
og de bytter ikke rute underveis selv om det oppstår kø. Kjører du et kryss i
grus, må de stå i den køen de havnet i.

Blir en bil **rød og glødende**, har den stått stille for lenge og sjåføren er
blitt sur. Det koster deg, og det er første varsel om at et kryss er i ferd med
å låse seg.

---

## Poeng

Hvert kjøretøy som kommer fram gir:

```
poeng = (grunnpoeng + bonus) × kombo
```

- **Grunnpoeng** avhenger av kjøretøytypen (se tabellen over).
- **Bonus** premierer rask levering. Den regnes ut fra hvor mye lenger turen tok
  enn den ideelle kjøretida uten kø: `bonus = 16 − forsinkelse × 0,9`, aldri
  under 0. Med andre ord: rundt 18 sekunders forsinkelse spiser hele bonusen.
- **Kombo** bygger seg opp av leveringer på rad som var både raske
  (under 12 sekunders forsinkelse) og uten sur sjåfør. Hver slik levering gir
  +0,06, opp til **×3**. Én sur sjåfør eller én treg levering nullstiller den.

Komboen er der de store poengene ligger. Ti raske leveringer på rad er verdt
langt mer enn tjue trege.

---

## De to målerne

**Flyt** er andelen kjøretøy som faktisk er i bevegelse akkurat nå. Den er ren
informasjon — den påvirker ikke om du vinner eller taper, men den forteller deg
med én gang når noe har låst seg.

**Frustrasjon** er den du kan tape på. Den stiger når:

- mer enn **55 %** av bilene står stille samtidig, eller
- noen har stått fast lenge nok til å bli sure (over 22 sekunder)

og den synker igjen når køene løser seg. Litt kø er altså helt greit — byen tåler
at opptil godt over halvparten står, så lenge det ikke varer. Er det ingen biler
på kartet i det hele tatt, faller frustrasjonen raskt.

Hvert brett har en egen **stressfaktor** som ganger opp hvor fort frustrasjonen
beveger seg. Se [Brettene](Brettene.md).

---

## Framgang

Brettene låses opp etter hvert som du klarer dem, og både rekorder og hvor langt
du er kommet lagres i nettleseren (`localStorage`, nøkkel
`trondheim-trafikk.v1`). Tømmer du nettleserdataene, starter du på nytt.

Er lagring avskrudd, fungerer spillet fortsatt — du får bare ikke med deg
rekordene til neste gang.

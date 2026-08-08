# Brettene

Fem brett, som åpnes etter hvert som du klarer dem. Hvert brett bruker en del av
det samme kartet — gatene utenfor brettet ligger igjen som svake streker, så du
ser hvor byen fortsetter.

| # | Brett | Varighet | Poengmål | Lyskryss | Stress |
| --- | --- | --- | --- | --- | --- |
| 1 | Mandag morgen i Midtbyen | 120 s | 850 | 4 | 1,00 |
| 2 | Studenttorsdag på Elgeseter | 150 s | 1 050 | 7 | 1,05 |
| 3 | Lørdagskveld på Solsiden | 165 s | 1 250 | 11 | 1,10 |
| 4 | Kampdag på Lerkendal | 180 s | 1 200 | 11 | 1,10 |
| 5 | Hele Trondheim i rushtida | 210 s | 2 100 | 18 | 1,20 |

**Stress** ganger opp hvor fort frustrasjonen beveger seg. På brett 5 stiger den
20 % raskere enn på brett 1 for samme kø.

---

## 1 — Mandag morgen i Midtbyen

> *Kongens gate, Munkegata og Torget våkner*

Folk skal på jobb. Køene bygger seg opp fra Byåsen og Trondheim S inn mot
Torget.

**Området:** Ila, Skansen, Trondheim Spektrum, Trondheim S, Ravnkloa, Torget,
Nidarosdomen, Gamle Bybro, Bakklandet, Bakke bru.
**Kommer inn fra:** Byåsen, Trondheim S, Trondheim Spektrum, Bakklandet.

Bare fire lyskryss, og de ligger på rekke: Skansen → Torget → Ravnkloa → Bakke
bru. Det gjør brettet til en ren øvelse i grønn bølge langs Kongens gate og
Munkegata. Klarer du den, klarer du målet med god margin.

**Fallgruve:** Torget har fire gater inn og blir flaskehalsen. Gi det litt
lengre omløp enn de andre.

---

## 2 — Studenttorsdag på Elgeseter

> *Gløshaugen, Samfundet og St. Olavs*

Forelesningene slutter samtidig. Elgeseter gate er byens trangeste nåløye — og
alle skal over Elgeseter bru.

**Nytt i dette brettet:** hele sørsida — Elgeseter bru, Studentersamfundet,
St. Olavs hospital, Marienborg, NTNU Gløshaugen, Lerkendal, Moholt, og portene
Sluppen og Heimdal.

Brettet er langt og smalt. Nesten all trafikk skal gjennom den samme aksen
Nidarosdomen → Elgeseter bru → Samfundet → Gløshaugen. Det er én lang korridor,
og en grønn bølge nedover den er hele brettet.

**Fallgruve:** Elgeseter bru er ett enkelt punkt som alt må gjennom. Låser den
seg, låser halve brettet seg. Hold den prioritert.

---

## 3 — Lørdagskveld på Solsiden

> *Nedre Elvehavn, Lade og Innherredsveien*

Hele byen skal spise ute. Innherredsveien fylles fra øst mens taxiene sirkler
rundt Bakke bru.

**Nytt:** havna og østsida — Pirbadet, Rockheim, Solsiden, Nyhavna, Lade,
Strindheim, Leangen, Tyholt, Kristiansten, og portene Ranheim og Værnes.

Elleve lyskryss, og trafikken kommer nå fra to motorveiporter samtidig. Til
forskjell fra brett 1 og 2 er dette ikke én korridor, men et nett — du kan ikke
lenger løse alt med én bølge.

**Fallgruve:** Bakke bru og Solsiden ligger tett, og køen fra det ene fyller det
andre. Behandle dem som ett system: samme omløpstid, forskjøvet fase.

---

## 4 — Kampdag på Lerkendal

> *RBK spiller — 20 000 skal samme vei*

Avspark om to timer. E6 sør og Omkjøringsvegen er stappfulle, og etterpå skal
alle inn til Midtbyen igjen.

Merk at **spawn-raten faktisk er lavere** her enn på brett 3 (0,55 mot 0,73) —
men brettet er større, målet er nesten like høyt, og trafikken kommer fra fem
porter samtidig i stedet for fire. Utfordringen er spredning, ikke mengde.

**Fallgruve:** Det er fristende å mikrostyre kryssene rundt Lerkendal. Men
poengene ligger i den lange transporten nordover mot Midtbyen. Sett opp den
aksen først, så fikser du sørsida etterpå.

---

## 5 — Hele Trondheim i rushtida

> *Fra Byåsen til Værnes*

Alt er åpent, alt er fullt. Alle 31 stedene, alle 41 gatene, alle 18 lyskryssene,
seks porter og den høyeste trafikkraten i spillet (0,98).

Dette er finalen, og den kan ikke løses ved å følge med på alt samtidig. Det som
fungerer:

1. **Bruk de første tjue sekundene på å stille inn**, før trafikken tar seg opp.
   Sett lange omløp (14–18 s) på kryssene nærmest portene, korte (6–8 s) inne i
   Midtbyen.
2. **Zoom ut og se på farger, ikke biler.** Røde glødende biler forteller deg
   hvor du skal, uten at du må lese kartet.
3. **Ikke jag hver enkelt kø.** Med 2 100 poeng på 210 sekunder trenger du jevn
   gjennomstrømning, ikke perfeksjon.

Trafikken kommer i bølger gjennom brettet — den topper seg midtveis og roer seg
mot slutten. Bruk den rolige starten og slutten til å rydde opp.

---

## Hvordan et brett er definert

Alle fem ligger i `js/data.js` som vanlige objekter. Vil du lage et sjette, er
det bare å legge til ett til i `TT.BRETT`:

```js
{
  navn: 'Julehandel i Midtbyen',
  undertittel: 'Alle skal til Torget',
  beskrivelse: 'Teksten som vises på briefskjermen.',
  noder:   ['torget', 'ravnkloa', /* … hvilke steder som er med */],
  kilder:  ['p_byasen', 'stasjon'],   // her settes biler ut
  mal:     ['torget', 'nidaros'],     // hit skal de
  varighet: 150,   // sekunder
  rate:     0.65,  // biler per sekund (før rushbølgen ganges på)
  maal:     1100,  // poengmålet
  stress:   1.05   // hvor fort frustrasjonen stiger
}
```

Veinettet trenger du ikke røre — motoren tar med alle gater der *begge* endene
er i `noder`. Lys settes automatisk i hvert kryss som får tre eller flere gater.

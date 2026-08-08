# Ordliste

Koden er skrevet på norsk, som spillet. Er du vant til engelske begreper, er
denne sida oversettelsen.

## Spillbegreper

| Norsk | Engelsk | Betydning i spillet |
| --- | --- | --- |
| Brett | Level | Ett scenario med eget kart, tid og poengmål |
| Omløpstid | Cycle time | Hvor lenge hver grønnfase varer |
| Fase | Phase | Hvilken gruppe gater som har grønt nå |
| Gultid | Amber / yellow interval | De 1,3 sekundene før fasen skifter |
| Flyt | Flow | Andelen kjøretøy i bevegelse |
| Frustrasjon | Frustration | Tapsmåleren |
| Kombo | Combo | Multiplikator som bygges av raske leveringer på rad |
| Port | Gate / portal | Der biler kommer inn i og forsvinner ut av kartet |
| Kilde | Source | Node der biler settes ut |
| Mål | Destination | Node biler kjører til |
| Levering | Delivery | En bil som kom fram |
| Rekord | High score | Beste poengsum på et brett |

## I koden

| Norsk | Engelsk | Hvor |
| --- | --- | --- |
| `Motor` | Engine / simulation | `engine.js` |
| `Tegner` | Renderer | `render.js` |
| `Kamera` | Camera | `render.js` |
| `Lys` | Traffic light | `engine.js` |
| `bil` | Car / vehicle | `engine.js` |
| `vei` | Road / edge | `engine.js`, `data.js` |
| `felt` | Lane | Ett kjørefelt, altså én retning av en vei |
| `node` | Node | Sted eller kryss |
| `nabo` / `naboer` | Neighbour(s) | Hvilke veier som møtes i en node |
| `etappe` / `etapper` | Leg(s) | Én vei i bilens rute |
| `rute` | Route | Hele veien fra kilde til mål |
| `oppdater` | update | Ett simuleringssteg |
| `tegn` | draw / render | Én ramme |
| `spawn` | spawn | Sette ut en ny bil |
| `varighet` | duration | Brettets lengde i sekunder |
| `maal` | target | Poengmålet |
| `rate` | rate | Biler per sekund |
| `stress` | stress | Hvor fort frustrasjonen stiger |
| `hendelser` | events | Meldingskø fra motoren til grensesnittet |
| `varsel` / `varsle` | toast / notify | De små meldingene på skjermen |
| `overlegg` | overlay | Menyene som legger seg over spillet |
| `kort` | card | Ett panel i overlegget |
| `inspektor` | inspector | Panelet for det valgte krysset |
| `lagret` / `lager` | saved / storage | `localStorage`-data |

## Retninger og geometri

| Norsk | Engelsk |
| --- | --- |
| `bredde` | width |
| `hoyde` | height |
| `lengde` | length |
| `fart` | speed |
| `akk` | acceleration |
| `retning` | direction |
| `vinkel` | angle |
| `avstand` | distance |
| `skala` | scale |
| `begrens` | clamp |
| `tilpass` | fit |
| `sentrer` | center |

## Stedsnavn i `id`-form

| `id` | Sted |
| --- | --- |
| `nidaros` | Nidarosdomen |
| `bybro` | Gamle Bybro |
| `bakkebru` | Bakke bru |
| `glos` | NTNU Gløshaugen |
| `stolavs` | St. Olavs hospital |
| `samfundet` | Studentersamfundet |
| `tyholt` | Tyholttårnet |
| `p_byasen`, `p_sluppen`, `p_heimdal`, `p_vaernes`, `p_ranheim` | Portene |

Prefikset `p_` betyr port. Æ, ø og å er skrevet ut som `ae`, `o` og `a` i
`id`-er, men brukes normalt i `navn`-feltet.

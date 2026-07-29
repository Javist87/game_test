/* =============================================================
   Trondheim Trafikk — kartdata, veinett og brett
   Koordinatene er hentet fra faktiske lengde-/breddegrader og
   projisert til et stilisert spillkart (1000 x 900 "verdenspiksler").
   ============================================================= */

var TT = (window.TT = window.TT || {});

TT.WORLD = { w: 1000, h: 900 };

/* -------------------------------------------------------------
   Noder: kryss, kjente steder og innfartsårer (porter)
   kind:  'sted'  = kjent bygg/plass
          'port'  = veien ut av byen (biler kommer/forsvinner her)
   ------------------------------------------------------------- */
TT.NODES = [
  // --- Midtbyen og havna ---
  { id: 'ila',          navn: 'Ila',                     x: 41,  y: 351, ikon: 'nabolag' },
  { id: 'skansen',      navn: 'Skansen',                 x: 118, y: 300, ikon: 'bru' },
  { id: 'spektrum',     navn: 'Trondheim Spektrum',      x: 130, y: 414, ikon: 'arena' },
  { id: 'stasjon',      navn: 'Trondheim S',             x: 330, y: 169, ikon: 'stasjon' },
  { id: 'pirbadet',     navn: 'Pirbadet',                x: 328, y: 71,  ikon: 'basseng' },
  { id: 'rockheim',     navn: 'Rockheim',                x: 405, y: 191, ikon: 'museum' },
  { id: 'ravnkloa',     navn: 'Ravnkloa',                x: 280, y: 257, ikon: 'fisk' },
  { id: 'torget',       navn: 'Torget',                  x: 285, y: 337, ikon: 'torg' },
  { id: 'nidaros',      navn: 'Nidarosdomen',            x: 307, y: 440, ikon: 'katedral' },
  { id: 'bybro',        navn: 'Gamle Bybro',             x: 365, y: 400, ikon: 'bybro' },
  { id: 'bakklandet',   navn: 'Bakklandet',              x: 392, y: 371, ikon: 'trehus' },
  { id: 'bakkebru',     navn: 'Bakke bru',               x: 390, y: 300, ikon: 'bru' },
  { id: 'solsiden',     navn: 'Solsiden',                x: 456, y: 243, ikon: 'restaurant' },
  { id: 'kristiansten', navn: 'Kristiansten festning',   x: 488, y: 400, ikon: 'festning' },
  { id: 'nyhavna',      navn: 'Nyhavna',                 x: 552, y: 94,  ikon: 'kran' },
  { id: 'lade',         navn: 'Lade',                    x: 718, y: 94,  ikon: 'nabolag' },
  { id: 'strindheim',   navn: 'Strindheim',              x: 781, y: 323, ikon: 'nabolag' },
  { id: 'leangen',      navn: 'Leangen',                 x: 935, y: 466, ikon: 'handel' },

  // --- Sør: universitet, sykehus, idrett ---
  { id: 'elgeseter',    navn: 'Elgeseter bru',           x: 279, y: 509, ikon: 'bru' },
  { id: 'samfundet',    navn: 'Studentersamfundet',      x: 290, y: 566, ikon: 'samfundet' },
  { id: 'stolavs',      navn: 'St. Olavs hospital',      x: 220, y: 603, ikon: 'sykehus' },
  { id: 'marienborg',   navn: 'Marienborg',              x: 137, y: 651, ikon: 'tog' },
  { id: 'glos',         navn: 'NTNU Gløshaugen',         x: 387, y: 680, ikon: 'universitet' },
  { id: 'lerkendal',    navn: 'Lerkendal stadion',       x: 399, y: 829, ikon: 'stadion' },
  { id: 'tyholt',       navn: 'Tyholttårnet',            x: 644, y: 574, ikon: 'taarn' },
  { id: 'moholt',       navn: 'Moholt',                  x: 667, y: 837, ikon: 'studentby' },

  // --- Porter (inn/ut av kartet) ---
  { id: 'p_byasen',     navn: 'Byåsen',                  x: 8,   y: 258, ikon: 'port', kind: 'port' },
  { id: 'p_sluppen',    navn: 'Sluppen',                 x: 137, y: 782, ikon: 'port', kind: 'port' },
  { id: 'p_heimdal',    navn: 'Heimdal · E6 sør',        x: 399, y: 884, ikon: 'port', kind: 'port' },
  { id: 'p_vaernes',    navn: 'Værnes · E6 øst',         x: 988, y: 520, ikon: 'port', kind: 'port' },
  { id: 'p_ranheim',    navn: 'Ranheim · E6 nord',       x: 986, y: 112, ikon: 'port', kind: 'port' }
];

/* -------------------------------------------------------------
   Veier. fart = px/s (bygata ~62, hovedvei ~85, motorvei ~130)
   ------------------------------------------------------------- */
TT.VEIER = [
  ['p_byasen', 'ila', 'Byåsveien', 95],
  ['ila', 'skansen', 'Ilevollen', 80],
  ['skansen', 'spektrum', 'Klostergata', 62],
  ['skansen', 'torget', 'Kongens gate', 70],
  ['skansen', 'stasjon', 'Nordre avlastningsveg', 100],
  ['stasjon', 'ravnkloa', 'Fosenkaia', 65],
  ['stasjon', 'pirbadet', 'Brattørkaia', 70],
  ['pirbadet', 'rockheim', 'Havnegata', 70],
  ['stasjon', 'rockheim', 'Brattøra', 75],
  ['rockheim', 'solsiden', 'Nedre Elvehavn', 62],
  ['ravnkloa', 'torget', 'Munkegata', 68],
  ['ravnkloa', 'bakkebru', 'Kjøpmannsgata', 68],
  ['torget', 'nidaros', 'Munkegata sør', 62],
  ['torget', 'bakkebru', 'Olav Tryggvasons gate', 72],
  ['bakkebru', 'bakklandet', 'Nedre Bakklandet', 55],
  ['bakkebru', 'solsiden', 'Innherredsveien', 78],
  ['bakklandet', 'bybro', 'Øvre Bakklandet', 50],
  ['bakklandet', 'solsiden', 'Mellomveien', 60],
  ['bakklandet', 'kristiansten', 'Kristiansten bakke', 55],
  ['bybro', 'nidaros', 'Bispegata', 58],
  ['nidaros', 'elgeseter', 'Elgeseter bru', 72],
  ['elgeseter', 'samfundet', 'Elgeseter gate', 70],
  ['samfundet', 'stolavs', 'Mauritz Hansens gate', 60],
  ['samfundet', 'glos', 'Høgskoleveien', 65],
  ['stolavs', 'marienborg', 'Marienborgvegen', 70],
  ['marienborg', 'spektrum', 'Sorgenfriveien', 68],
  ['marienborg', 'p_sluppen', 'Holtermanns veg', 95],
  ['glos', 'lerkendal', 'Høgskoleringen', 62],
  ['glos', 'moholt', 'Moholt allé', 70],
  ['lerkendal', 'moholt', 'Bregnevegen', 65],
  ['lerkendal', 'p_heimdal', 'E6 sør', 130],
  ['moholt', 'tyholt', 'Jonsvannsveien', 78],
  ['moholt', 'leangen', 'Omkjøringsvegen', 120],
  ['tyholt', 'kristiansten', 'Tyholtveien', 62],
  ['tyholt', 'strindheim', 'Brøsetvegen', 75],
  ['strindheim', 'leangen', 'Innherredsveien øst', 90],
  ['strindheim', 'lade', 'Ladeveien', 80],
  ['lade', 'nyhavna', 'Haakon VIIs gate', 90],
  ['nyhavna', 'solsiden', 'Ladehammerveien', 70],
  ['lade', 'p_ranheim', 'E6 nord', 130],
  ['leangen', 'p_vaernes', 'E6 øst', 130]
];

/* -------------------------------------------------------------
   Kystlinje (Trondheimsfjorden ligger over denne linja)
   ------------------------------------------------------------- */
TT.KYST = [
  [-40, 230], [110, 220], [200, 170], [270, 110], [320, 58], [400, 38],
  [480, 54], [552, 66], [640, 48], [718, 56], [820, 68], [900, 76], [1040, 86]
];

/* Munkholmen ligger ute i fjorden */
TT.MUNKHOLMEN = { x: 208, y: 52, r: 21 };

/* Nidelva slynger seg gjennom byen og munner ut ved Brattøra.
   Sørfra går den vest for Lerkendal og Gløshaugen, forbi Øya og
   St. Olavs, under Elgeseter bru og Gamle Bybro, og ut i fjorden. */
TT.NIDELVA = [
  [300, 900], [268, 830], [250, 760], [248, 690], [252, 630], [258, 570],
  [268, 535], [279, 509], [305, 478], [338, 442], [365, 400], [392, 352],
  [390, 300], [404, 252], [423, 200], [434, 150], [438, 60]
];

/* -------------------------------------------------------------
   Brett
   ------------------------------------------------------------- */
TT.BRETT = [
  {
    navn: 'Mandag morgen i Midtbyen',
    undertittel: 'Kongens gate, Munkegata og Torget våkner',
    beskrivelse:
      'Folk skal på jobb. Køene bygger seg opp fra Byåsen og Trondheim S ' +
      'inn mot Torget. Hold Munkegata og Kongens gate i bevegelse.',
    noder: ['p_byasen', 'ila', 'skansen', 'spektrum', 'stasjon', 'ravnkloa',
            'torget', 'nidaros', 'bybro', 'bakklandet', 'bakkebru'],
    kilder: ['p_byasen', 'stasjon', 'spektrum', 'bakklandet'],
    mal:    ['torget', 'nidaros', 'ravnkloa', 'stasjon', 'spektrum', 'bakklandet', 'p_byasen'],
    varighet: 120,
    rate: 0.55,
    maal: 850,
    stress: 1.0
  },
  {
    navn: 'Studenttorsdag på Elgeseter',
    undertittel: 'Gløshaugen, Samfundet og St. Olavs',
    beskrivelse:
      'Forelesningene slutter samtidig. Elgeseter gate er byens trangeste ' +
      'nåløye — og alle skal over Elgeseter bru.',
    noder: ['skansen', 'spektrum', 'torget', 'ravnkloa', 'bakkebru', 'bakklandet',
            'bybro', 'nidaros', 'elgeseter', 'samfundet', 'stolavs', 'marienborg',
            'p_sluppen', 'glos', 'lerkendal', 'p_heimdal', 'moholt'],
    kilder: ['p_heimdal', 'p_sluppen', 'skansen', 'bakklandet'],
    mal:    ['glos', 'samfundet', 'nidaros', 'torget', 'lerkendal', 'p_heimdal',
             'ravnkloa', 'skansen', 'stolavs'],
    varighet: 150,
    rate: 0.65,
    maal: 1050,
    stress: 1.05
  },
  {
    navn: 'Lørdagskveld på Solsiden',
    undertittel: 'Nedre Elvehavn, Lade og Innherredsveien',
    beskrivelse:
      'Hele byen skal spise ute. Innherredsveien fylles fra øst mens ' +
      'taxiene sirkler rundt Bakke bru.',
    noder: ['stasjon', 'pirbadet', 'rockheim', 'solsiden', 'bakkebru', 'bakklandet',
            'bybro', 'nidaros', 'torget', 'ravnkloa', 'nyhavna', 'lade', 'p_ranheim',
            'strindheim', 'leangen', 'p_vaernes', 'tyholt', 'kristiansten', 'moholt'],
    kilder: ['p_ranheim', 'p_vaernes', 'stasjon', 'torget'],
    mal:    ['solsiden', 'rockheim', 'pirbadet', 'bakklandet', 'kristiansten',
             'stasjon', 'tyholt', 'nidaros'],
    varighet: 165,
    rate: 0.73,
    maal: 1250,
    stress: 1.1
  },
  {
    navn: 'Kampdag på Lerkendal',
    undertittel: 'RBK spiller — 20 000 skal samme vei',
    beskrivelse:
      'Avspark om to timer. E6 sør og Omkjøringsvegen er stappfulle, ' +
      'og etterpå skal alle inn til Midtbyen igjen.',
    noder: ['p_heimdal', 'lerkendal', 'glos', 'moholt', 'tyholt', 'kristiansten',
            'bakklandet', 'bybro', 'nidaros', 'elgeseter', 'samfundet', 'stolavs',
            'marienborg', 'p_sluppen', 'bakkebru', 'torget', 'ravnkloa', 'stasjon',
            'skansen', 'solsiden', 'strindheim', 'leangen', 'p_vaernes'],
    kilder: ['p_heimdal', 'p_vaernes', 'p_sluppen', 'stasjon', 'skansen'],
    mal:    ['lerkendal', 'glos', 'torget', 'solsiden', 'nidaros', 'moholt',
             'stasjon', 'kristiansten', 'p_heimdal', 'ravnkloa'],
    varighet: 180,
    rate: 0.55,
    maal: 1200,
    stress: 1.1
  },
  {
    navn: 'Hele Trondheim i rushtida',
    undertittel: 'Fra Byåsen til Værnes',
    beskrivelse:
      'Alt er åpent, alt er fullt. Dette er finalen — hold flyten i ' +
      'hele byen samtidig.',
    noder: TT.NODES.map(function (n) { return n.id; }),
    kilder: ['p_byasen', 'p_sluppen', 'p_heimdal', 'p_vaernes', 'p_ranheim', 'stasjon'],
    mal:    ['torget', 'nidaros', 'solsiden', 'glos', 'lerkendal', 'stasjon',
             'pirbadet', 'kristiansten', 'leangen', 'lade', 'marienborg',
             'spektrum', 'moholt', 'p_byasen', 'p_heimdal', 'p_vaernes'],
    varighet: 210,
    rate: 0.98,
    maal: 2100,
    stress: 1.2
  }
];

/* Små faktadrypp som vises mellom brettene */
TT.FAKTA = [
  'Nidarosdomen er verdens nordligste middelalderkatedral.',
  'Gamle Bybro fra 1681 kalles «Lykkens portal» av trondhjemmerne.',
  'Trondheim hadde verdens første og eneste sykkelheis — Trampe i Brubakken.',
  'Kristiansten festning ble bygget etter bybrannen i 1681.',
  'Tyholttårnet er 124 meter høyt og har en roterende restaurant.',
  'Metrobussen erstattet det gamle busslinjenettet i 2019.',
  'Munkholmen har vært kloster, festning, fengsel og tollstasjon.',
  'Lerkendal stadion tar rundt 21 000 tilskuere.'
];

/* -------------------------------------------------------------
   Kartet blåses opp til arbeidsoppløsning. Gatene må være lange
   nok til å romme en skikkelig kø — ellers låser nettet seg med
   én gang. Fartsgrensene skaleres likt, så kjøretidene er de samme.
   ------------------------------------------------------------- */
TT.SKALA = 1.6;

(function (S) {
  TT.WORLD.w *= S;
  TT.WORLD.h *= S;
  TT.NODES.forEach(function (n) { n.x *= S; n.y *= S; });
  TT.VEIER.forEach(function (v) { v[3] *= S; });
  TT.KYST = TT.KYST.map(function (p) { return [p[0] * S, p[1] * S]; });
  TT.NIDELVA = TT.NIDELVA.map(function (p) { return [p[0] * S, p[1] * S]; });
  TT.MUNKHOLMEN.x *= S;
  TT.MUNKHOLMEN.y *= S;
  TT.MUNKHOLMEN.r *= S;
})(TT.SKALA);

TT.NODE_BY_ID = {};
TT.NODES.forEach(function (n) {
  n.kind = n.kind || 'sted';
  TT.NODE_BY_ID[n.id] = n;
});

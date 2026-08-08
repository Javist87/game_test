/* =============================================================
   Trondheim Trafikk — simuleringsmotor
   Bilene følger en forenklet IDM-modell (Intelligent Driver Model)
   og respekterer lysene i kryssene.
   ============================================================= */

(function (TT) {
  'use strict';

  var S = TT.SKALA;

  var BIL = {
    lengde: 10.5 * S,
    bredde: 5.6 * S,
    s0: 3.2 * S,  // ønsket avstand i kø
    T: 0.95,      // tidsluke
    a: 3.0 * S,   // komfortabel akselerasjon
    b: 3.4 * S    // komfortabel retardasjon
  };

  var BUSS = { lengde: 19 * S, bredde: 6.6 * S };
  var FELT_BREDDE = 9.6 * S;   // bredde per kjørefelt
  var STOPP_INN = 9 * S;       // stopplinja ligger så mange px før krysset
  var MAKS_BILER = 320;
  var GRENSE_STILLE = 6 * S;   // px/s — under dette regnes bilen som "står"
  var TALEGRENSE = 0.55;     // så stor andel kø tåler byen uten å bli frustrert
  var VEI_BASISKOST = 140;   // poeng for å utvide en vei med ett ekstra felt

  var FARGER = [
    '#e0e6ef', '#93a4bd', '#c9d4e4', '#7f8ea6', '#dfe6f0',
    '#b34b4b', '#3f6fa8', '#d4a13c', '#4c8f6d', '#8a5fb0'
  ];

  function vinkel180(a) { a = a % 180; return a < 0 ? a + 180 : a; }
  function avstand180(a, b) { var d = Math.abs(vinkel180(a) - vinkel180(b)); return d > 90 ? 180 - d : d; }
  function tilfeldig(arr) { return arr[(Math.random() * arr.length) | 0]; }

  /** Kvadrert avstand fra punkt (px,py) til linjestykket a→b. */
  function avstandTilLinjeKvadrat(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    var cx = ax + t * dx, cy = ay + t * dy;
    var ddx = px - cx, ddy = py - cy;
    return ddx * ddx + ddy * ddy;
  }

  /** Ny feltgruppe: én kølisteliste per mulig kjørefelt (opp til feltMaks). */
  function nyFeltGruppe(vei, retning) {
    var lanes = [];
    for (var i = 0; i < vei.feltMaks; i++) lanes.push([]);
    return { vei: vei, retning: retning, lanes: lanes };
  }

  /** Velg det kjørefeltet (blant de som er bygget) med færrest biler akkurat nå. */
  function velgFelt(gruppe, antallFelt) {
    var best = 0, bestN = Infinity;
    for (var i = 0; i < antallFelt; i++) {
      var n = gruppe.lanes[i].length;
      if (n < bestN) { bestN = n; best = i; }
    }
    return best;
  }

  /* ---------------------------------------------------------
     Trafikklys
     --------------------------------------------------------- */
  function Lys(node) {
    this.node = node;
    this.faser = 2;
    this.fase = Math.random() < 0.5 ? 0 : 1;
    this.t = Math.random() * 3;
    this.periode = 8;
    this.gult = 1.3;
    this.gruppe = {};      // veiId -> 0 | 1
    this.byttet = 0;       // teller manuelle bytter (for statistikk)
  }

  Lys.prototype.erGult = function () {
    return this.t >= this.periode - this.gult;
  };

  Lys.prototype.erGronn = function (veiId) {
    return this.gruppe[veiId] === this.fase && !this.erGult();
  };

  Lys.prototype.oppdater = function (dt) {
    this.t += dt;
    if (this.t >= this.periode) {
      this.t = 0;
      this.fase = (this.fase + 1) % this.faser;
    }
  };

  /** Spilleren tvinger fram et fasebytte (går via gult). */
  Lys.prototype.bytt = function () {
    if (!this.erGult()) {
      this.t = this.periode - this.gult;
      this.byttet++;
      return true;
    }
    return false;
  };

  Lys.prototype.settPeriode = function (v) {
    this.periode = Math.max(5, Math.min(22, v));
    if (this.t > this.periode) this.t = 0;
  };

  /**
   * Del innkommende veier i to grønnfaser. Vi prøver alle mulige
   * todelinger (maks 2^n, n <= 5) og velger den der veiene i hver
   * gruppe peker mest mulig i samme retning — altså naturlige
   * "nord–sør" og "øst–vest"-faser.
   */
  function lagGrupper(lys, veier, node) {
    var vinkler = veier.map(function (v) {
      var annen = v.a === node.id ? TT.NODE_BY_ID[v.b] : TT.NODE_BY_ID[v.a];
      return Math.atan2(annen.y - node.y, annen.x - node.x) * 180 / Math.PI;
    });
    var n = veier.length, best = null, bestScore = Infinity;
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
    veier.forEach(function (v, i) {
      lys.gruppe[v.id] = (best >> i) & 1;
    });
  }

  /* ---------------------------------------------------------
     Motoren
     --------------------------------------------------------- */
  function Motor(brett) {
    this.brett = brett;
    this.aktivNode = {};
    brett.noder.forEach(function (id) { this.aktivNode[id] = true; }, this);

    this.veier = [];
    this.veiById = {};
    this.felt = {};
    this.naboer = {};
    this.lys = {};
    this.biler = [];

    this.tid = 0;
    this.igjen = brett.varighet;
    this.poeng = 0;
    this.levert = 0;
    this.sinte = 0;
    this.frustrasjon = 0;
    this.kombo = 1;
    this.streak = 0;
    this.flyt = 100;
    this.ferdig = false;
    this.tapt = false;
    this.spawnAkk = 0;
    this.hendelser = [];      // meldinger ut til UI
    this.nesteId = 1;

    this.byggGraf();
  }

  Motor.prototype.byggGraf = function () {
    var self = this;

    TT.VEIER.forEach(function (rad, i) {
      var a = rad[0], b = rad[1];
      if (!self.aktivNode[a] || !self.aktivNode[b]) return;
      var na = TT.NODE_BY_ID[a], nb = TT.NODE_BY_ID[b];
      var dx = nb.x - na.x, dy = nb.y - na.y;
      var len = Math.hypot(dx, dy);
      // Brede hovedfartsårer og motorveier tåler flere felt enn smale bygater.
      var feltMaks = (rad[3] / S) >= 100 ? 3 : 2;
      var vei = {
        id: 'v' + i,
        a: a, b: b,
        navn: rad[2],
        fart: rad[3],
        len: len,
        dx: dx / len, dy: dy / len,
        vinkel: Math.atan2(dy, dx),
        felt: 1,
        feltMaks: feltMaks
      };
      self.veier.push(vei);
      self.veiById[vei.id] = vei;
      self.felt[vei.id + ':0'] = nyFeltGruppe(vei, 0);
      self.felt[vei.id + ':1'] = nyFeltGruppe(vei, 1);
      (self.naboer[a] = self.naboer[a] || []).push({ vei: vei, retning: 0, til: b });
      (self.naboer[b] = self.naboer[b] || []).push({ vei: vei, retning: 1, til: a });
    });

    // Lys i alle kryss med tre eller flere veier
    Object.keys(this.naboer).forEach(function (id) {
      var koblinger = self.naboer[id];
      if (koblinger.length < 3) return;
      var node = TT.NODE_BY_ID[id];
      var lys = new Lys(node);
      lagGrupper(lys, koblinger.map(function (k) { return k.vei; }), node);
      self.lys[id] = lys;
    });

    // Kilder og mål som faktisk henger sammen med veinettet
    this.kilder = this.brett.kilder.filter(function (id) { return self.naboer[id]; });
    this.mal = this.brett.mal.filter(function (id) { return self.naboer[id]; });
  };

  Motor.prototype.feltFor = function (vei, retning) {
    return this.felt[vei.id + ':' + retning];
  };

  Motor.prototype.sluttNode = function (vei, retning) {
    return retning === 0 ? vei.b : vei.a;
  };

  /* -------- Ruteberegning (Dijkstra på kjøretid) -------- */
  Motor.prototype.finnRute = function (fra, til) {
    var dist = {}, forrige = {}, besokt = {}, kø = [fra];
    dist[fra] = 0;
    while (kø.length) {
      var best = 0;
      for (var i = 1; i < kø.length; i++) if (dist[kø[i]] < dist[kø[best]]) best = i;
      var n = kø.splice(best, 1)[0];
      if (besokt[n]) continue;
      besokt[n] = true;
      if (n === til) break;
      var koblinger = this.naboer[n] || [];
      for (var k = 0; k < koblinger.length; k++) {
        var kob = koblinger[k];
        var d = dist[n] + kob.vei.len / kob.vei.fart;
        if (dist[kob.til] === undefined || d < dist[kob.til]) {
          dist[kob.til] = d;
          forrige[kob.til] = kob;
          kø.push(kob.til);
        }
      }
    }
    if (dist[til] === undefined) return null;

    var etapper = [], node = til;
    while (node !== fra) {
      var kob2 = forrige[node];
      etapper.unshift({ vei: kob2.vei, retning: kob2.retning });
      node = kob2.retning === 0 ? kob2.vei.a : kob2.vei.b;
    }
    return { etapper: etapper, tid: dist[til] };
  };

  /* -------- Kjørefelt: hvilket felt skal bilen ta på neste etappe? -------- */
  Motor.prototype.settNesteFelt = function (bil) {
    var neste = bil.etapper[bil.etappe + 1];
    if (!neste) { bil.nesteLane = 0; return; }
    var gruppe = this.feltFor(neste.vei, neste.retning);
    bil.nesteLane = velgFelt(gruppe, neste.vei.felt);
  };

  /** Bilen fremst i det feltet bilen har planlagt å ta på neste etappe. */
  Motor.prototype.nesteFeltFrontBil = function (bil) {
    var neste = bil.etapper[bil.etappe + 1];
    if (!neste) return null;
    var gruppe = this.feltFor(neste.vei, neste.retning);
    var lane = gruppe.lanes[bil.nesteLane];
    return lane && lane.length ? lane[0] : null;
  };

  /* -------- Nye biler -------- */
  Motor.prototype.spawn = function () {
    if (this.biler.length >= MAKS_BILER) return;
    if (!this.kilder.length || this.mal.length < 2) return;

    var fra = tilfeldig(this.kilder);
    var til = tilfeldig(this.mal);
    var forsok = 0;
    while (til === fra && forsok++ < 8) til = tilfeldig(this.mal);
    if (til === fra) return;

    var rute = this.finnRute(fra, til);
    if (!rute || !rute.etapper.length) return;

    var forste = rute.etapper[0];
    var felt = this.feltFor(forste.vei, forste.retning);
    var lane = velgFelt(felt, forste.vei.felt);
    var koGruppe = felt.lanes[lane];
    if (koGruppe.length) {
      var innerst = koGruppe[0];
      if (innerst.s < innerst.lengde + BIL.s0 + 8 * S) return;   // ikke plass
    }

    var erBuss = Math.random() < 0.11;
    var erTaxi = !erBuss && Math.random() < 0.08;
    var bil = {
      id: this.nesteId++,
      etapper: rute.etapper,
      etappe: 0,
      vei: forste.vei,
      retning: forste.retning,
      lane: lane,
      s: 0,
      fart: forste.vei.fart * 0.55,
      akk: 0,
      lengde: erBuss ? BUSS.lengde : BIL.lengde,
      bredde: erBuss ? BUSS.bredde : BIL.bredde,
      buss: erBuss,
      taxi: erTaxi,
      farge: erBuss ? '#0f9d63' : (erTaxi ? '#f2c744' : tilfeldig(FARGER)),
      malNavn: TT.NODE_BY_ID[til].navn,
      idealtid: rute.tid,
      levetid: 0,
      ventet: 0,
      sint: false,
      bremser: false,
      visVinkel: forste.retning === 0 ? forste.vei.vinkel : forste.vei.vinkel + Math.PI
    };
    this.settNesteFelt(bil);
    this.biler.push(bil);
  };

  /* -------- Hovedløkke -------- */
  Motor.prototype.oppdater = function (dt) {
    if (this.ferdig) return;

    this.tid += dt;
    this.igjen = Math.max(0, this.brett.varighet - this.tid);

    var id;
    for (id in this.lys) this.lys[id].oppdater(dt);

    this.spawnAkk += dt * this.brett.rate * this.rushFaktor();
    while (this.spawnAkk >= 1) { this.spawnAkk -= 1; this.spawn(); }

    this.sorterFelt();
    this.beregnAkselerasjon();
    this.flyttBiler(dt);
    this.oppdaterStemning(dt);

    if (this.igjen <= 0 && !this.tapt) {
      this.ferdig = true;
      this.vunnet = this.poeng >= this.brett.maal;
    }
  };

  /** Trafikken kommer i bølger — litt mer liv i simuleringen. */
  Motor.prototype.rushFaktor = function () {
    var p = this.tid / Math.max(1, this.brett.varighet);
    return 0.72 + 0.55 * Math.sin(p * Math.PI) + 0.12 * Math.sin(this.tid * 0.7);
  };

  Motor.prototype.sorterFelt = function () {
    for (var k in this.felt) {
      var gruppe = this.felt[k];
      for (var i = 0; i < gruppe.lanes.length; i++) gruppe.lanes[i].length = 0;
    }
    for (var b = 0; b < this.biler.length; b++) {
      var bil = this.biler[b];
      this.feltFor(bil.vei, bil.retning).lanes[bil.lane].push(bil);
    }
    for (var k2 in this.felt) {
      var lanes = this.felt[k2].lanes;
      for (var j = 0; j < lanes.length; j++) {
        lanes[j].sort(function (x, y) { return x.s - y.s; });
      }
    }
  };

  Motor.prototype.harGronn = function (bil) {
    var nodeId = this.sluttNode(bil.vei, bil.retning);
    var lys = this.lys[nodeId];
    if (!lys) return true;
    return lys.erGronn(bil.vei.id);
  };

  Motor.prototype.beregnAkselerasjon = function () {
    for (var k in this.felt) {
      var felt = this.felt[k];
      var stoppS = felt.vei.len - STOPP_INN;
      for (var lane = 0; lane < felt.vei.felt; lane++) {
        var biler = felt.lanes[lane];
        for (var i = 0; i < biler.length; i++) {
          var bil = biler[i];
          var v0 = felt.vei.fart;

          // Sakk ned i skarpe svinger
          var neste = bil.etapper[bil.etappe + 1];
          if (neste && stoppS - bil.s < 55 * S) {
            var v1 = bil.retning === 0 ? felt.vei.vinkel : felt.vei.vinkel + Math.PI;
            var v2 = neste.retning === 0 ? neste.vei.vinkel : neste.vei.vinkel + Math.PI;
            var d = Math.abs(Math.atan2(Math.sin(v2 - v1), Math.cos(v2 - v1)));
            if (d > 0.7) v0 = Math.min(v0, 42 * S);
            else if (d > 0.35) v0 = Math.min(v0, 58 * S);
          }

          var gap = Infinity, dv = 0;

          var foran = biler[i + 1];
          if (foran) {
            gap = foran.s - foran.lengde - bil.s;
            dv = bil.fart - foran.fart;
          }

          var tilStopp = stoppS - bil.s;
          var slippGjennom = this.kanKjore(bil);
          if (!slippGjennom) {
            if (tilStopp < gap) { gap = tilStopp; dv = bil.fart; }
          } else {
            var f0 = this.nesteFeltFrontBil(bil);
            if (f0) {
              var g = tilStopp + (f0.s - f0.lengde);
              if (g < gap) { gap = g; dv = bil.fart - f0.fart; }
            }
          }

          bil.akk = idm(bil.fart, v0, gap, dv);
          bil.bremser = bil.akk < -0.9;
          bil.blokkert = !slippGjennom && tilStopp < 30 * S;
        }
      }
    }
  };

  function idm(v, v0, gap, dv) {
    var fri = 1 - Math.pow(Math.max(0, v) / v0, 4);
    if (gap === Infinity) return BIL.a * fri;
    var sStjerne = BIL.s0 + Math.max(0, v * BIL.T + (v * dv) / (2 * Math.sqrt(BIL.a * BIL.b)));
    var forhold = gap > 0.5 * S ? sStjerne / gap : 20;
    return BIL.a * (fri - forhold * forhold);
  }

  /** Kan bilen kjøre inn i krysset? Grønt lys + plass på andre siden. */
  Motor.prototype.kanKjore = function (bil) {
    if (bil.etappe + 1 >= bil.etapper.length) return true;   // siste etappe = målet
    if (!this.harGronn(bil)) return false;
    var f0 = this.nesteFeltFrontBil(bil);
    if (f0 && f0.s < f0.lengde + BIL.s0) return false;       // ikke blokker krysset
    return true;
  };

  Motor.prototype.flyttBiler = function (dt) {
    var beholdt = [];
    for (var i = 0; i < this.biler.length; i++) {
      var bil = this.biler[i];
      var stoppS = bil.vei.len - STOPP_INN;

      bil.fart = Math.max(0, bil.fart + Math.max(-8 * S, Math.min(BIL.a, bil.akk)) * dt);
      bil.s += bil.fart * dt;
      bil.levetid += dt;

      // "ventet" måler hvor lenge bilen har stått fast akkurat nå — ikke
      // summen av alle røde lys på turen. Kommer den skikkelig i fart igjen,
      // er køen løst opp og telleren nullstilles.
      if (bil.fart < GRENSE_STILLE) bil.ventet += dt;
      else if (bil.fart > 26 * S) bil.ventet = 0;
      else bil.ventet = Math.max(0, bil.ventet - dt * 2.5);

      // Tålmodigheten har hysterese: bilisten blir sur etter lang venting,
      // og roer seg først når køen faktisk har løsnet.
      if (!bil.sint && bil.ventet > 22) { bil.sint = true; this.brytKombo(); }
      else if (bil.sint && bil.ventet < 8) bil.sint = false;

      if (bil.s >= stoppS) {
        if (bil.etappe + 1 >= bil.etapper.length) {
          this.levering(bil);
          continue;                                  // bilen er framme
        }
        if (this.kanKjore(bil)) {
          var overskudd = bil.s - stoppS;
          bil.etappe++;
          var e = bil.etapper[bil.etappe];
          bil.vei = e.vei;
          bil.retning = e.retning;
          bil.lane = bil.nesteLane;
          bil.s = Math.min(overskudd, e.vei.len * 0.5);
          this.settNesteFelt(bil);
        } else {
          bil.s = stoppS;
          bil.fart = 0;
        }
      }

      // myk rotasjon i svingene
      var mal = bil.retning === 0 ? bil.vei.vinkel : bil.vei.vinkel + Math.PI;
      var diff = Math.atan2(Math.sin(mal - bil.visVinkel), Math.cos(mal - bil.visVinkel));
      bil.visVinkel += diff * Math.min(1, dt * 9);

      beholdt.push(bil);
    }
    this.biler = beholdt;
  };

  Motor.prototype.levering = function (bil) {
    var tap = bil.levetid - bil.idealtid;
    var bonus = Math.max(0, Math.round(16 - tap * 0.9));
    var grunn = bil.buss ? 22 : (bil.taxi ? 13 : 10);

    if (!bil.sint && tap < 12) {
      this.streak++;
      this.kombo = Math.min(3, 1 + this.streak * 0.06);
    } else {
      this.brytKombo();
    }

    var gitt = Math.round((grunn + bonus) * this.kombo);
    this.poeng += gitt;
    this.levert++;

    if (bil.buss || bonus >= 14) {
      this.melding(
        (bil.buss ? 'Metrobuss' : (bil.taxi ? 'Taxi' : 'Bil')) +
        ' framme ved ' + bil.malNavn, '+' + gitt
      );
    }
  };

  Motor.prototype.brytKombo = function () {
    this.streak = 0;
    this.kombo = 1;
  };

  Motor.prototype.oppdaterStemning = function (dt) {
    var staaende = 0, sinte = 0;
    for (var i = 0; i < this.biler.length; i++) {
      if (this.biler[i].fart < GRENSE_STILLE) staaende++;
      if (this.biler[i].sint) sinte++;
    }
    var antall = this.biler.length;
    this.sinte = sinte;
    this.flyt = antall ? Math.round(100 * (1 - staaende / antall)) : 100;

    // Litt kø er helt normalt i en by. Frustrasjonen stiger først når
    // andelen stillestående biler passerer TÅLEGRENSE — eller når noen
    // har stått lenge nok til å bli skikkelig sure.
    var andel = antall ? staaende / antall : 0;
    var press = ((andel - TALEGRENSE) * 20 + sinte * 0.5) * this.brett.stress;
    if (!antall) press = -6;
    this.frustrasjon = Math.max(0, Math.min(100, this.frustrasjon + press * dt));

    if (this.frustrasjon >= 100 && !this.ferdig) {
      this.ferdig = true;
      this.tapt = true;
      this.vunnet = false;
    }
  };

  Motor.prototype.melding = function (tekst, verdi) {
    this.hendelser.push({ tekst: tekst, verdi: verdi });
    if (this.hendelser.length > 6) this.hendelser.shift();
  };

  /* -------- Spillerens inngrep: lys -------- */
  Motor.prototype.lysVed = function (x, y, radius) {
    var best = null, bestD = radius * radius;
    for (var id in this.lys) {
      var n = this.lys[id].node;
      var d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
      if (d < bestD) { bestD = d; best = this.lys[id]; }
    }
    return best;
  };

  /* -------- Spillerens inngrep: veibygging -------- */

  /** Nærmeste aktive vei innenfor radius, eller null. */
  Motor.prototype.veiVed = function (x, y, radius) {
    var best = null, bestD = radius * radius;
    for (var i = 0; i < this.veier.length; i++) {
      var v = this.veier[i];
      var a = TT.NODE_BY_ID[v.a], b = TT.NODE_BY_ID[v.b];
      var d = avstandTilLinjeKvadrat(x, y, a.x, a.y, b.x, b.y);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  };

  /** Poengkostnad for å utvide denne veien med neste kjørefelt. */
  Motor.prototype.veiKostnad = function (vei) {
    return Math.round(VEI_BASISKOST * vei.felt);
  };

  Motor.prototype.kanUtvideVei = function (vei) {
    return !!vei && vei.felt < vei.feltMaks && this.poeng >= this.veiKostnad(vei);
  };

  /** Utvider veien med ett kjørefelt i hver retning, betalt av poengsummen. */
  Motor.prototype.utvidVei = function (veiId) {
    var vei = this.veiById[veiId];
    if (!this.kanUtvideVei(vei)) return false;
    var kost = this.veiKostnad(vei);
    this.poeng -= kost;
    vei.felt++;
    this.melding(vei.navn + ' utvidet til ' + vei.felt + ' felt', '−' + kost);
    return true;
  };

  TT.Motor = Motor;
  TT.BIL = BIL;
  TT.FELT_BREDDE = FELT_BREDDE;
  TT.STOPP_INN = STOPP_INN;
})(window.TT);

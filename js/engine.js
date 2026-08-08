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
  var FELT_OFFSET = 4.8 * S;   // avstand fra veiens midtlinje til feltets senter
  var STOPP_INN = 9 * S;       // stopplinja ligger så mange px før krysset
  var MAKS_BILER = 320;
  var GRENSE_STILLE = 6 * S;   // px/s — under dette regnes bilen som "står"
  var TALEGRENSE = 0.55;     // så stor andel kø tåler byen uten å bli frustrert

  var FARGER = [
    '#e0e6ef', '#93a4bd', '#c9d4e4', '#7f8ea6', '#dfe6f0',
    '#b34b4b', '#3f6fa8', '#d4a13c', '#4c8f6d', '#8a5fb0'
  ];

  /* ---------------------------------------------------------
     Veihendelser — veiarbeid, ulykker, kontroller og manuelle
     veisperringer. fartFaktor er hvor stor andel av fartsgrensa
     som gjenstår i det berørte feltet mens hendelsen står på.
     --------------------------------------------------------- */
  var HENDELSE_TYPER = {
    veiarbeid: { navn: 'Veiarbeid',  ikonEmoji: '🚧', farge: 'rgba(255, 190, 60, .92)',  fartFaktor: 0.42, minVarighet: 24, maxVarighet: 40 },
    ulykke:    { navn: 'Ulykke',     ikonEmoji: '🚑', farge: 'rgba(255, 90, 90, .92)',   fartFaktor: 0.14, minVarighet: 22, maxVarighet: 38 },
    kontroll:  { navn: 'Kontroll',   ikonEmoji: '👮', farge: 'rgba(111, 196, 255, .92)', fartFaktor: 0.62, minVarighet: 14, maxVarighet: 24 },
    stengt:    { navn: 'Stengt vei', ikonEmoji: '⛔', farge: 'rgba(255, 90, 90, .92)',   fartFaktor: 0.03, minVarighet: 0,  maxVarighet: 0 }
  };

  /* Utrykningskjøretøy — får alltid gjennomkjøring på rødt, men må
     likevel vente i faktiske køer. Spillerens jobb er å holde veien
     fri foran dem. */
  var UTRYKNING = {
    ambulanse: { navn: 'Ambulanse', ikon: '🚑', farge: '#eef1f5' },
    brannbil:  { navn: 'Brannbil',  ikon: '🚒', farge: '#c94a3a' },
    politi:    { navn: 'Politibil', ikon: '🚓', farge: '#26314a' }
  };

  function vinkel180(a) { a = a % 180; return a < 0 ? a + 180 : a; }
  function avstand180(a, b) { var d = Math.abs(vinkel180(a) - vinkel180(b)); return d > 90 ? 180 - d : d; }
  function tilfeldig(arr) { return arr[(Math.random() * arr.length) | 0]; }

  /** Et punkt langs en vei (0..1), forskjøvet ut til feltets senter. */
  function posPaVei(vei, retning, t) {
    var a = TT.NODE_BY_ID[vei.a], b = TT.NODE_BY_ID[vei.b];
    var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    if (retning !== null) {
      var vinkel = retning === 0 ? vei.vinkel : vei.vinkel + Math.PI;
      var hx = Math.cos(vinkel), hy = Math.sin(vinkel);
      x += -hy * FELT_OFFSET;
      y += hx * FELT_OFFSET;
    }
    return { x: x, y: y };
  }

  /** Veiarbeid er vanligst, ulykker sjeldnere, kontroller sjeldnest. */
  function vektetHendelseType() {
    var r = Math.random();
    if (r < 0.5) return 'veiarbeid';
    if (r < 0.82) return 'ulykke';
    return 'kontroll';
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
    if (this.erGult()) return false;
    this.t = this.periode - this.gult;
    return true;
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

    this.hendelserAktive = [];              // veiarbeid, ulykker, kontroller, veisperringer
    this.nesteHendelseId = 1;
    this.nesteHendelseTid = 10 + Math.random() * 12;
    this.utrykninger = [];                  // aktive utrykningsoppdrag (for HUD)
    this.utrykningTid = 16 + Math.random() * 14;

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
      var vei = {
        id: 'v' + i,
        a: a, b: b,
        navn: rad[2],
        fart: rad[3],
        len: len,
        dx: dx / len, dy: dy / len,
        vinkel: Math.atan2(dy, dx)
      };
      self.veier.push(vei);
      self.felt[vei.id + ':0'] = { vei: vei, retning: 0, biler: [] };
      self.felt[vei.id + ':1'] = { vei: vei, retning: 1, biler: [] };
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
        var kobFelt = this.feltFor(kob.vei, kob.retning);
        if (this.feltStengt(kobFelt)) continue;   // stengt vei — helt utelukket fra ruta
        var d = dist[n] + kob.vei.len / this.feltFart(kobFelt);
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
    if (felt.biler.length) {
      var innerst = felt.biler[0];
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
    this.biler.push(bil);
  };

  /* -------- Hovedløkke -------- */
  Motor.prototype.oppdater = function (dt) {
    if (this.ferdig) return;

    this.tid += dt;
    this.igjen = Math.max(0, this.brett.varighet - this.tid);

    var id;
    for (id in this.lys) this.lys[id].oppdater(dt);

    this.oppdaterHendelser(dt);
    this.oppdaterUtrykning(dt);

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
    for (var k in this.felt) this.felt[k].biler.length = 0;
    for (var i = 0; i < this.biler.length; i++) {
      var bil = this.biler[i];
      this.feltFor(bil.vei, bil.retning).biler.push(bil);
    }
    for (var k2 in this.felt) {
      this.felt[k2].biler.sort(function (x, y) { return x.s - y.s; });
    }
  };

  Motor.prototype.harGronn = function (bil) {
    var nodeId = this.sluttNode(bil.vei, bil.retning);
    var lys = this.lys[nodeId];
    if (!lys) return true;
    if (bil.utrykning) return true;    // utrykning kjører på blålys, respekterer ikke rødt
    return lys.erGronn(bil.vei.id);
  };

  /** Farten et felt tillater akkurat nå — redusert av veiarbeid, ulykke o.l. */
  Motor.prototype.feltFart = function (felt) {
    if (!felt.hendelse) return felt.vei.fart;
    return Math.max(4 * S, felt.vei.fart * HENDELSE_TYPER[felt.hendelse.type].fartFaktor);
  };

  /** En manuelt stengt vei er fysisk sperret — ingen kjører inn i den. */
  Motor.prototype.feltStengt = function (felt) {
    return !!(felt.hendelse && felt.hendelse.type === 'stengt');
  };

  Motor.prototype.nesteFelt = function (bil) {
    var neste = bil.etapper[bil.etappe + 1];
    return neste ? this.feltFor(neste.vei, neste.retning) : null;
  };

  Motor.prototype.beregnAkselerasjon = function () {
    for (var k in this.felt) {
      var felt = this.felt[k];
      var biler = felt.biler;
      var stoppS = felt.vei.len - STOPP_INN;
      var v0Felt = this.feltFart(felt);
      for (var i = 0; i < biler.length; i++) {
        var bil = biler[i];
        var v0 = v0Felt;

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
          var nf = this.nesteFelt(bil);
          if (nf && nf.biler.length) {
            var f0 = nf.biler[0];
            var g = tilStopp + (f0.s - f0.lengde);
            if (g < gap) { gap = g; dv = bil.fart - f0.fart; }
          }
        }

        bil.akk = idm(bil.fart, v0, gap, dv);
        bil.bremser = bil.akk < -0.9;
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
    var nf = this.nesteFelt(bil);
    if (nf && this.feltStengt(nf)) return false;              // fysisk stengt — ingen slipper inn, ikke engang utrykning
    if (nf && nf.biler.length) {
      var f0 = nf.biler[0];
      if (f0.s < f0.lengde + BIL.s0) return false;           // ikke blokker krysset
    }
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
          bil.s = Math.min(overskudd, e.vei.len * 0.5);
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
    if (bil.utrykning) { this.leverUtrykning(bil); return; }
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

  Motor.prototype.leverUtrykning = function (bil) {
    var cfg = UTRYKNING[bil.utrykning];
    var tap = bil.levetid - bil.idealtid;
    var rask = tap < 6;
    var poeng = Math.max(15, Math.round((rask ? 60 : 42) - Math.max(0, tap) * 1.6));
    this.poeng += poeng;
    this.levert++;
    this.utrykninger = this.utrykninger.filter(function (u) { return u.bilId !== bil.id; });
    if (rask) { this.streak++; this.kombo = Math.min(3, 1 + this.streak * 0.06); }
    else this.brytKombo();
    this.melding(cfg.ikon + ' ' + cfg.navn + ' framme ved ' + bil.malNavn, '+' + poeng, false);
  };

  Motor.prototype.oppdaterStemning = function (dt) {
    var staaende = 0, sinte = 0, utrykningVenter = 0;
    for (var i = 0; i < this.biler.length; i++) {
      if (this.biler[i].fart < GRENSE_STILLE) staaende++;
      if (this.biler[i].sint) sinte++;
      if (this.biler[i].utrykning && this.biler[i].ventet > 6) utrykningVenter++;
    }
    var antall = this.biler.length;
    this.sinte = sinte;
    this.flyt = antall ? Math.round(100 * (1 - staaende / antall)) : 100;

    // Litt kø er helt normalt i en by. Frustrasjonen stiger først når
    // andelen stillestående biler passerer TÅLEGRENSE — eller når noen
    // har stått lenge nok til å bli skikkelig sure. Utrykningskjøretøy
    // som sitter fast presser opp frustrasjonen ekstra — de skal fram.
    var andel = antall ? staaende / antall : 0;
    var press = ((andel - TALEGRENSE) * 20 + sinte * 0.5 + utrykningVenter * 3) * this.brett.stress;
    if (!antall) press = -6;
    this.frustrasjon = Math.max(0, Math.min(100, this.frustrasjon + press * dt));

    if (this.frustrasjon >= 100 && !this.ferdig) {
      this.ferdig = true;
      this.tapt = true;
      this.vunnet = false;
    }
  };

  Motor.prototype.melding = function (tekst, verdi, advarsel) {
    this.hendelser.push({ tekst: tekst, verdi: verdi, advarsel: !!advarsel });
    if (this.hendelser.length > 6) this.hendelser.shift();
  };

  /* ---------------------------------------------------------
     Veihendelser — veiarbeid, ulykker og kontroller dukker opp
     tilfeldig og senker farten (eller stenger helt) i ett felt
     til de er ryddet. Ruteberegningen (finnRute) unngår dem
     automatisk via feltFart, akkurat som en reell trafikkmelding.
     --------------------------------------------------------- */
  Motor.prototype.oppdaterHendelser = function (dt) {
    this.nesteHendelseTid -= dt;
    var maksSamtidig = Math.max(1, Math.round(this.veier.length / 9));
    if (this.nesteHendelseTid <= 0 && this.hendelserAktive.length < maksSamtidig) {
      this.lagHendelse();
      this.nesteHendelseTid = (14 + Math.random() * 20) / Math.max(0.6, this.brett.stress);
    }
    var self = this;
    this.hendelserAktive = this.hendelserAktive.filter(function (h) {
      if (self.tid < h.slutt) return true;
      self.rensFelt(h);
      self.melding(HENDELSE_TYPER[h.type].ikonEmoji + ' ' + h.vei.navn + ' er ryddet', '', false);
      return false;
    });
  };

  Motor.prototype.lagHendelse = function () {
    var self = this;
    var nokler = Object.keys(this.felt).filter(function (k) { return !self.felt[k].hendelse; });
    if (!nokler.length) return;
    var key = tilfeldig(nokler);
    var felt = this.felt[key];
    var type = vektetHendelseType();
    var cfg = HENDELSE_TYPER[type];
    var varighet = cfg.minVarighet + Math.random() * (cfg.maxVarighet - cfg.minVarighet);
    var t = 0.3 + Math.random() * 0.4;
    var pos = posPaVei(felt.vei, felt.retning, t);
    var h = {
      id: this.nesteHendelseId++,
      type: type,
      vei: felt.vei,
      retning: felt.retning,
      feltKeys: [key],
      start: this.tid,
      slutt: this.tid + varighet,
      rydder: false,
      x: pos.x, y: pos.y
    };
    felt.hendelse = h;
    this.hendelserAktive.push(h);
    this.melding(cfg.ikonEmoji + ' ' + cfg.navn + ' i ' + felt.vei.navn, '', type === 'ulykke');
  };

  Motor.prototype.rensFelt = function (h) {
    var self = this;
    h.feltKeys.forEach(function (k) {
      if (self.felt[k] && self.felt[k].hendelse === h) self.felt[k].hendelse = null;
    });
  };

  Motor.prototype.avsluttHendelseManuelt = function (h) {
    this.rensFelt(h);
    this.hendelserAktive = this.hendelserAktive.filter(function (x) { return x !== h; });
  };

  /** Spilleren sender bergingsbil til en ulykke — rydder den raskt. */
  Motor.prototype.ryddOpp = function (h) {
    if (!h || h.type !== 'ulykke' || h.rydder) return false;
    h.rydder = true;
    h.slutt = Math.min(h.slutt, this.tid + 5);
    this.melding('🚨 Bergingsbil sendt til ' + h.vei.navn, '', false);
    return true;
  };

  /** Spilleren — som trafikkoperatør — stenger eller åpner en hel vei. */
  Motor.prototype.byttVeisperring = function (vei) {
    var key0 = vei.id + ':0', key1 = vei.id + ':1';
    var felt0 = this.felt[key0], felt1 = this.felt[key1];
    if (!felt0 || !felt1) return;

    if (felt0.hendelse && felt0.hendelse.type === 'stengt') {
      this.avsluttHendelseManuelt(felt0.hendelse);
      this.melding('✅ ' + vei.navn + ' er åpnet igjen', '', false);
      return;
    }

    // En pågående ulykke/veiarbeid/kontroll skal ryddes på sin egen måte —
    // ikke viskes vekk ved å stenge og åpne veien rett etterpå.
    if ((felt0.hendelse && felt0.hendelse.type !== 'stengt') ||
        (felt1.hendelse && felt1.hendelse.type !== 'stengt')) {
      this.melding('🚧 ' + vei.navn + ' har alt en hendelse — vent til den er ryddet', '', true);
      return;
    }

    var pos = posPaVei(vei, null, 0.5);
    var h = {
      id: this.nesteHendelseId++,
      type: 'stengt',
      vei: vei,
      retning: null,
      feltKeys: [key0, key1],
      start: this.tid,
      slutt: Infinity,
      rydder: false,
      manuell: true,
      x: pos.x, y: pos.y
    };
    felt0.hendelse = h;
    felt1.hendelse = h;
    this.hendelserAktive.push(h);
    this.melding('⛔ ' + vei.navn + ' er stengt for trafikk', '', true);
  };

  /* ---------------------------------------------------------
     Utrykningskjøretøy — dukker opp med jevne mellomrom og har
     forkjørsrett gjennom røde lys. Spillerens jobb er å holde
     veien fri foran dem, ikke å styre dem direkte.
     --------------------------------------------------------- */
  Motor.prototype.oppdaterUtrykning = function (dt) {
    this.utrykningTid -= dt;
    if (this.utrykningTid <= 0) {
      this.spawnUtrykning();
      this.utrykningTid = (24 + Math.random() * 18) / Math.max(0.6, this.brett.stress);
    }
  };

  Motor.prototype.spawnUtrykning = function () {
    if (this.biler.length >= MAKS_BILER) return;
    if (!this.kilder.length || !this.mal.length) return;

    var fra = tilfeldig(this.kilder);
    var muligeMal = this.mal.filter(function (id) { return id !== fra; });
    if (!muligeMal.length) return;
    var til = tilfeldig(muligeMal);

    var rute = this.finnRute(fra, til);
    if (!rute || !rute.etapper.length) return;

    var forste = rute.etapper[0];
    var felt = this.feltFor(forste.vei, forste.retning);
    if (felt.biler.length) {
      var innerst = felt.biler[0];
      if (innerst.s < innerst.lengde + BIL.s0 + 8 * S) return;
    }

    var type = tilfeldig(Object.keys(UTRYKNING));
    var cfg = UTRYKNING[type];
    var bil = {
      id: this.nesteId++,
      etapper: rute.etapper,
      etappe: 0,
      vei: forste.vei,
      retning: forste.retning,
      s: 0,
      fart: forste.vei.fart * 0.6,
      akk: 0,
      lengde: BIL.lengde * 1.08,
      bredde: BIL.bredde * 1.08,
      buss: false,
      taxi: false,
      utrykning: type,
      farge: cfg.farge,
      malNavn: TT.NODE_BY_ID[til].navn,
      idealtid: rute.tid,
      levetid: 0,
      ventet: 0,
      sint: false,
      bremser: false,
      visVinkel: forste.retning === 0 ? forste.vei.vinkel : forste.vei.vinkel + Math.PI
    };
    this.biler.push(bil);
    this.utrykninger.push({ bilId: bil.id, type: type, malNavn: bil.malNavn, start: this.tid });
    this.melding(cfg.ikon + ' ' + cfg.navn + ' rykker ut mot ' + bil.malNavn, '', true);
  };

  /* -------- Spillerens inngrep -------- */
  Motor.prototype.lysVed = function (x, y, radius) {
    var best = null, bestD = radius * radius;
    for (var id in this.lys) {
      var n = this.lys[id].node;
      var d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
      if (d < bestD) { bestD = d; best = this.lys[id]; }
    }
    return best;
  };

  /** Nærmeste vei innafor radius — for å stenge/åpne den manuelt. */
  Motor.prototype.veiVed = function (x, y, radius) {
    var best = null, bestD = radius * radius;
    for (var i = 0; i < this.veier.length; i++) {
      var v = this.veier[i];
      var a = TT.NODE_BY_ID[v.a], b = TT.NODE_BY_ID[v.b];
      var t = ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / (v.len * v.len);
      t = Math.max(0.08, Math.min(0.92, t));   // ikke tett inntil kryssene
      var px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t;
      var d = (px - x) * (px - x) + (py - y) * (py - y);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  };

  /** Nærmeste aktive hendelse innafor radius — for å klikke på ikonet. */
  Motor.prototype.hendelseVed = function (x, y, radius) {
    var best = null, bestD = radius * radius;
    for (var i = 0; i < this.hendelserAktive.length; i++) {
      var h = this.hendelserAktive[i];
      var d = (h.x - x) * (h.x - x) + (h.y - y) * (h.y - y);
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  };

  TT.Motor = Motor;
  TT.BIL = BIL;
  TT.FELT_OFFSET = FELT_OFFSET;
  TT.STOPP_INN = STOPP_INN;
  TT.HENDELSE_TYPER = HENDELSE_TYPER;
  TT.UTRYKNING = UTRYKNING;
})(window.TT);

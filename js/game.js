/* =============================================================
   Trondheim Trafikk — spillogikk, input og grensesnitt
   ============================================================= */

(function (TT) {
  'use strict';

  var LAGER = 'trondheim-trafikk.v1';

  var el = {};
  ['game', 'hud', 'brettNavn', 'brettUnder', 'statPoeng', 'statMaal', 'statTid',
   'statKombo', 'barFlyt', 'statFlyt', 'barFrust', 'statLevert', 'btnPause',
   'btnLyd', 'btnMeny', 'inspektor', 'inspNavn', 'inspLukk', 'inspPeriode',
   'inspMinus', 'inspPluss', 'inspBytt', 'varsler', 'overlegg', 'kortStart',
   'kortBrief', 'kortPause', 'kortSlutt', 'brettliste', 'btnStart', 'briefNr',
   'briefNavn', 'briefTekst', 'briefMaal', 'briefTid', 'briefKryss', 'briefFakta',
   'btnKjor', 'btnFortsett', 'btnTilMeny', 'sluttStikk', 'sluttTittel', 'sluttTekst',
   'sluttPoeng', 'sluttLevert', 'sluttFlyt', 'btnNeste', 'btnPaNytt', 'btnMenyFraSlutt'
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  var tegner = new TT.Tegner(el.game);
  var motor = null;

  var spill = {
    modus: 'meny',            // meny | brief | spiller | pause | slutt
    brettNr: 0,
    fart: 1,
    lyd: true,
    valgt: null,
    hover: null,
    flytSum: 0,
    flytAnt: 0
  };

  var lagret = lesLager();

  /* ---------------------------------------------------------
     Lagring
     --------------------------------------------------------- */
  function lesLager() {
    try {
      var raa = window.localStorage.getItem(LAGER);
      var d = raa ? JSON.parse(raa) : null;
      if (d && typeof d === 'object') {
        d.rekorder = d.rekorder || {};
        d.apnet = typeof d.apnet === 'number' ? d.apnet : 0;
        return d;
      }
    } catch (e) { /* localStorage kan være avskrudd */ }
    return { apnet: 0, rekorder: {} };
  }

  function skrivLager() {
    try { window.localStorage.setItem(LAGER, JSON.stringify(lagret)); } catch (e) { /* ignorer */ }
  }

  /* ---------------------------------------------------------
     Lyd — små toner via WebAudio, ingen filer
     --------------------------------------------------------- */
  var lyd = (function () {
    var ctx = null;
    function sikreCtx() {
      if (!spill.lyd) return null;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(frekv, lengde, volum, type) {
      var c = sikreCtx();
      if (!c) return;
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = frekv;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(volum, c.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + lengde);
      osc.connect(g); g.connect(c.destination);
      osc.start(); osc.stop(c.currentTime + lengde + 0.02);
    }
    return {
      klikk:    function () { tone(520, 0.09, 0.05, 'triangle'); },
      levert:   function () { tone(760, 0.13, 0.035, 'sine'); },
      advarsel: function () { tone(180, 0.28, 0.05, 'sawtooth'); },
      seier:    function () { tone(660, 0.16, 0.06); setTimeout(function () { tone(880, 0.3, 0.06); }, 130); },
      tap:      function () { tone(300, 0.3, 0.06, 'square'); setTimeout(function () { tone(180, 0.5, 0.06, 'square'); }, 180); },
      vekk:     sikreCtx
    };
  })();

  /* ---------------------------------------------------------
     Menyen
     --------------------------------------------------------- */
  function byggBrettliste() {
    el.brettliste.innerHTML = '';
    TT.BRETT.forEach(function (brett, i) {
      var laast = i > lagret.apnet;
      var knapp = document.createElement('button');
      knapp.className = 'brettvalg' + (i === spill.brettNr ? ' valgt' : '');
      knapp.type = 'button';
      knapp.disabled = laast;
      var rekord = lagret.rekorder[i];
      knapp.innerHTML =
        '<span class="nr">' + (laast ? '🔒' : (i + 1)) + '</span>' +
        '<span class="tekst"><b></b><i></i></span>' +
        '<span class="rekord"></span>';
      knapp.querySelector('b').textContent = brett.navn;
      knapp.querySelector('i').textContent = brett.undertittel;
      knapp.querySelector('.rekord').textContent = rekord ? rekord + ' p' : '';
      knapp.addEventListener('click', function () {
        spill.brettNr = i;
        byggBrettliste();
        menyBakgrunn();
      });
      el.brettliste.appendChild(knapp);
    });
  }

  function visKort(navn) {
    [el.kortStart, el.kortBrief, el.kortPause, el.kortSlutt].forEach(function (k) { k.hidden = true; });
    if (navn) {
      el[navn].hidden = false;
      el.overlegg.classList.add('vis');
    } else {
      el.overlegg.classList.remove('vis');
    }
  }

  /** Kartet for det valgte brettet ligger stille bak menyen. */
  function menyBakgrunn() {
    motor = new TT.Motor(TT.BRETT[spill.brettNr]);
    sentrerPaBrett();
  }

  function tilMeny() {
    spill.modus = 'meny';
    lukkInspektor();
    byggBrettliste();
    menyBakgrunn();
    visKort('kortStart');
    el.brettNavn.textContent = 'Trondheim Trafikk';
    el.brettUnder.textContent = 'Hold flyten i byen';
  }

  function visBrief() {
    var brett = TT.BRETT[spill.brettNr];
    spill.modus = 'brief';
    // Vi lager motoren allerede nå, så kartet ligger klart bak overlegget.
    nyttSpill();
    el.briefNr.textContent = 'Brett ' + (spill.brettNr + 1) + ' av ' + TT.BRETT.length;
    el.briefNavn.textContent = brett.navn;
    el.briefTekst.textContent = brett.beskrivelse;
    el.briefMaal.textContent = brett.maal;
    el.briefTid.textContent = brett.varighet;
    el.briefKryss.textContent = Object.keys(motor.lys).length;
    el.briefFakta.textContent = 'Visste du at… ' +
      TT.FAKTA[Math.floor(Math.random() * TT.FAKTA.length)];
    visKort('kortBrief');
  }

  function nyttSpill() {
    var brett = TT.BRETT[spill.brettNr];
    motor = new TT.Motor(brett);
    spill.valgt = null;
    spill.flytSum = 0;
    spill.flytAnt = 0;
    el.brettNavn.textContent = brett.navn;
    el.brettUnder.textContent = brett.undertittel;
    el.statMaal.textContent = 'av ' + brett.maal;
    sentrerPaBrett();
    lukkInspektor();
    oppdaterHud();
  }

  /** Zoom/panorer slik at brettets aktive del fyller skjermen. */
  function sentrerPaBrett() {
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    TT.BRETT[spill.brettNr].noder.forEach(function (id) {
      var n = TT.NODE_BY_ID[id];
      if (!n) return;
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    if (minX > maxX) return;
    var marg = 90 * TT.SKALA;
    var b = (maxX - minX) + marg * 2, h = (maxY - minY) + marg * 2;
    tegner.kamera.x = (minX + maxX) / 2;
    tegner.kamera.y = (minY + maxY) / 2;
    var onsket = Math.min(tegner.w / b, (tegner.h - 90) / h);
    onsket = Math.max(onsket, 0.46);        // på smale skjermer panorerer man heller
    tegner.kamera.zoom = onsket / tegner.kamera.basis;
    tegner.kamera.begrens();
  }

  function start() {
    spill.modus = 'spiller';
    visKort(null);
    lyd.vekk();
  }

  function pause(pa) {
    if (pa && spill.modus === 'spiller') {
      spill.modus = 'pause';
      visKort('kortPause');
    } else if (!pa && spill.modus === 'pause') {
      spill.modus = 'spiller';
      visKort(null);
    }
    el.btnPause.textContent = spill.modus === 'pause' ? '▶' : '❚❚';
  }

  function avslutt() {
    spill.modus = 'slutt';
    var vant = !!motor.vunnet;
    var snittFlyt = spill.flytAnt ? Math.round(spill.flytSum / spill.flytAnt) : 100;

    if (vant) {
      lagret.apnet = Math.max(lagret.apnet, Math.min(TT.BRETT.length - 1, spill.brettNr + 1));
      lyd.seier();
    } else {
      lyd.tap();
    }
    if (!lagret.rekorder[spill.brettNr] || motor.poeng > lagret.rekorder[spill.brettNr]) {
      lagret.rekorder[spill.brettNr] = motor.poeng;
    }
    skrivLager();

    el.sluttStikk.textContent = vant ? 'Brettet er klart' : (motor.tapt ? 'Full stopp' : 'Ikke helt i mål');
    el.sluttTittel.textContent = vant
      ? 'Byen flyter!'
      : (motor.tapt ? 'Trafikkaos i Trondheim' : 'Nesten der');
    el.sluttTekst.textContent = vant
      ? 'Godt kjørt. ' + motor.levert + ' kjøretøy kom seg trygt fram, og ingen ' +
        'satt fast lenge nok til å skrive leserinnlegg i Adresseavisen.'
      : (motor.tapt
        ? 'Frustrasjonen kokte over. Køene låste seg, og byen sto stille.'
        : 'Du kom i mål med ' + motor.poeng + ' poeng, men målet var ' +
          TT.BRETT[spill.brettNr].maal + '. Prøv kortere omløpstider i de travleste kryssene.');

    el.sluttPoeng.textContent = motor.poeng;
    el.sluttLevert.textContent = motor.levert;
    el.sluttFlyt.textContent = snittFlyt + ' %';
    el.btnNeste.hidden = !(vant && spill.brettNr + 1 < TT.BRETT.length);
    visKort('kortSlutt');
    lukkInspektor();
  }

  /* ---------------------------------------------------------
     HUD
     --------------------------------------------------------- */
  function oppdaterHud() {
    if (!motor) return;
    el.statPoeng.textContent = motor.poeng;
    el.statTid.textContent = formatTid(motor.igjen);
    el.statKombo.textContent = '×' + motor.kombo.toFixed(1).replace('.', ',');
    el.statFlyt.textContent = motor.flyt + ' %';
    el.statLevert.textContent = motor.levert + ' levert';
    el.barFlyt.style.width = motor.flyt + '%';
    el.barFrust.style.width = Math.round(motor.frustrasjon) + '%';
    el.statPoeng.style.color = motor.poeng >= motor.brett.maal ? 'var(--gronn)' : '';
  }

  function formatTid(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  var sisteVarsel = 0;
  function tomHendelser() {
    if (!motor || !motor.hendelser.length) return;
    var na = performance.now();
    if (na - sisteVarsel < 900) { motor.hendelser.length = 0; return; }
    sisteVarsel = na;
    var h = motor.hendelser.pop();
    motor.hendelser.length = 0;
    varsle(h.tekst, h.verdi);
    lyd.levert();
  }

  function varsle(tekst, verdi, advarsel) {
    var d = document.createElement('div');
    d.className = 'varsel' + (advarsel ? ' advarsel' : '');
    d.innerHTML = '<span></span><b></b>';
    d.firstChild.textContent = tekst;
    d.lastChild.textContent = verdi || '';
    el.varsler.appendChild(d);
    setTimeout(function () { d.remove(); }, 2600);
    while (el.varsler.children.length > 3) el.varsler.firstChild.remove();
  }

  var advartOm = 0;
  function sjekkAdvarsel() {
    if (spill.modus !== 'spiller') return;
    var na = performance.now();
    if (motor.frustrasjon > 72 && na - advartOm > 6000) {
      advartOm = na;
      varsle('Frustrasjonen stiger — løs opp køene!', '⚠', true);
      lyd.advarsel();
    }
  }

  /* ---------------------------------------------------------
     Inspektør
     --------------------------------------------------------- */
  function apneInspektor(lys) {
    spill.valgt = lys.node.id;
    el.inspNavn.textContent = lys.node.navn;
    el.inspektor.hidden = false;
    oppdaterInspektor();
  }

  function lukkInspektor() {
    spill.valgt = null;
    el.inspektor.hidden = true;
  }

  function oppdaterInspektor() {
    if (!spill.valgt || !motor) return;
    var lys = motor.lys[spill.valgt];
    if (!lys) { lukkInspektor(); return; }
    el.inspPeriode.textContent = lys.periode.toFixed(1).replace('.', ',') + ' s';
  }

  /* ---------------------------------------------------------
     Input
     --------------------------------------------------------- */
  var pekere = {};        // aktive fingre/musepekere
  var antPekere = 0;
  var dro = false;        // ble det dratt? (da er det ikke et klikk)
  var knipAvstand = 0;

  /** Zoom om et punkt på skjermen, slik at punktet blir liggende i ro. */
  function zoomOm(skjermX, skjermY, faktor) {
    var for1 = tegner.kamera.tilVerden(skjermX, skjermY, tegner.w, tegner.h);
    tegner.kamera.zoom *= faktor;
    tegner.kamera.begrens();
    var etter = tegner.kamera.tilVerden(skjermX, skjermY, tegner.w, tegner.h);
    tegner.kamera.x += for1[0] - etter[0];
    tegner.kamera.y += for1[1] - etter[1];
    tegner.kamera.begrens();
  }

  function pekerListe() {
    return Object.keys(pekere).map(function (k) { return pekere[k]; });
  }

  el.game.addEventListener('pointerdown', function (e) {
    if (spill.modus !== 'spiller') return;
    pekere[e.pointerId] = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
    antPekere++;
    if (antPekere === 1) dro = false;
    if (antPekere === 2) {
      var p = pekerListe();
      knipAvstand = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      dro = true;                       // knip er aldri et klikk
    }
    // Enkelte nettlesere/berøringsskjermer avviser capture; det er ufarlig,
    // vi lytter uansett på window.
    try { el.game.setPointerCapture(e.pointerId); } catch (feil) { /* ignorer */ }
    el.game.classList.add('drar');
  });

  window.addEventListener('pointermove', function (e) {
    var rekt = el.game.getBoundingClientRect();
    var peker = pekere[e.pointerId];

    if (peker) {
      var dx = e.clientX - peker.x, dy = e.clientY - peker.y;
      peker.x = e.clientX; peker.y = e.clientY;

      if (antPekere >= 2) {
        // Knip for å zoome — og flytt kartet med midtpunktet mellom fingrene.
        var p = pekerListe();
        var ny = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (knipAvstand > 0 && ny > 0) {
          zoomOm((p[0].x + p[1].x) / 2 - rekt.left, (p[0].y + p[1].y) / 2 - rekt.top, ny / knipAvstand);
        }
        knipAvstand = ny;
      } else {
        if (Math.abs(e.clientX - peker.startX) + Math.abs(e.clientY - peker.startY) > 4) dro = true;
        var s = tegner.kamera.skala();
        tegner.kamera.x -= dx / s;
        tegner.kamera.y -= dy / s;
        tegner.kamera.begrens();
      }
    }

    if (motor && spill.modus === 'spiller') {
      var v = tegner.kamera.tilVerden(e.clientX - rekt.left, e.clientY - rekt.top, tegner.w, tegner.h);
      var traff = motor.lysVed(v[0], v[1], klikkRadius());
      spill.hover = traff ? traff.node.id : null;
      el.game.classList.toggle('pekbar', !!traff && !antPekere);
    }
  });

  function klikkRadius() {
    // Litt raus treffflate, særlig når det er zoomet ut eller på berøringsskjerm.
    return (26 / Math.max(0.5, tegner.kamera.zoom) + 12) * TT.SKALA;
  }

  function pekerSlutt(e) {
    if (!pekere[e.pointerId]) return;
    var sisteX = pekere[e.pointerId].x, sisteY = pekere[e.pointerId].y;
    delete pekere[e.pointerId];
    antPekere = Math.max(0, antPekere - 1);
    if (antPekere < 2) knipAvstand = 0;
    if (antPekere > 0) return;

    el.game.classList.remove('drar');
    if (dro || spill.modus !== 'spiller') return;

    var rekt = el.game.getBoundingClientRect();
    var v = tegner.kamera.tilVerden(sisteX - rekt.left, sisteY - rekt.top, tegner.w, tegner.h);
    var lys = motor.lysVed(v[0], v[1], klikkRadius());
    if (lys) {
      lys.bytt();
      apneInspektor(lys);
      lyd.klikk();
    } else {
      lukkInspektor();
    }
  }

  window.addEventListener('pointerup', pekerSlutt);
  window.addEventListener('pointercancel', pekerSlutt);

  el.game.addEventListener('wheel', function (e) {
    e.preventDefault();
    var rekt = el.game.getBoundingClientRect();
    zoomOm(e.clientX - rekt.left, e.clientY - rekt.top, Math.exp(-e.deltaY * 0.0016));
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      e.preventDefault();
      if (spill.modus === 'spiller') pause(true);
      else if (spill.modus === 'pause') pause(false);
      return;
    }
    if (e.key === 'Escape') {
      if (spill.modus === 'spiller') pause(true);
      else if (spill.valgt) lukkInspektor();
      return;
    }
    if (e.key === '1' || e.key === '2' || e.key === '3') settFart(parseInt(e.key, 10));
    if (e.key === 'r' || e.key === 'R') {
      if (spill.modus === 'spiller' || spill.modus === 'pause' || spill.modus === 'slutt') {
        nyttSpill(); start();
      }
    }
  });

  function settFart(f) {
    spill.fart = f;
    Array.prototype.forEach.call(
      document.querySelectorAll('.fart-velger button'),
      function (b) { b.classList.toggle('valgt', parseInt(b.dataset.fart, 10) === f); }
    );
  }

  document.querySelectorAll('.fart-velger button').forEach(function (b) {
    b.addEventListener('click', function () { settFart(parseInt(b.dataset.fart, 10)); });
  });

  el.btnPause.addEventListener('click', function () { pause(spill.modus === 'spiller'); });
  el.btnMeny.addEventListener('click', tilMeny);
  el.btnLyd.addEventListener('click', function () {
    spill.lyd = !spill.lyd;
    el.btnLyd.textContent = spill.lyd ? '🔊' : '🔈';
  });

  el.btnStart.addEventListener('click', visBrief);
  el.btnKjor.addEventListener('click', start);
  el.btnFortsett.addEventListener('click', function () { pause(false); });
  el.btnTilMeny.addEventListener('click', tilMeny);
  el.btnPaNytt.addEventListener('click', function () { nyttSpill(); start(); });
  el.btnMenyFraSlutt.addEventListener('click', tilMeny);
  el.btnNeste.addEventListener('click', function () {
    spill.brettNr = Math.min(TT.BRETT.length - 1, spill.brettNr + 1);
    visBrief();
  });

  el.inspLukk.addEventListener('click', lukkInspektor);
  el.inspBytt.addEventListener('click', function () {
    var lys = motor && motor.lys[spill.valgt];
    if (lys) { lys.bytt(); lyd.klikk(); }
  });
  el.inspMinus.addEventListener('click', function () {
    var lys = motor && motor.lys[spill.valgt];
    if (lys) { lys.settPeriode(lys.periode - 1); oppdaterInspektor(); }
  });
  el.inspPluss.addEventListener('click', function () {
    var lys = motor && motor.lys[spill.valgt];
    if (lys) { lys.settPeriode(lys.periode + 1); oppdaterInspektor(); }
  });

  window.addEventListener('resize', function () {
    tegner.tilpassStorrelse();
  });

  /* ---------------------------------------------------------
     Hovedløkke
     --------------------------------------------------------- */
  var sist = performance.now();

  function ramme(na) {
    var raa = (na - sist) / 1000;
    sist = na;
    var dt = Math.min(0.05, raa);           // hopp aldri for langt (fanebytte o.l.)

    if (motor && spill.modus === 'spiller') {
      var steg = dt * spill.fart;
      // Del opp i småsteg så simuleringen holder seg stabil på høy fart
      var n = Math.ceil(steg / 0.034);
      for (var i = 0; i < n; i++) motor.oppdater(steg / n);

      spill.flytSum += motor.flyt;
      spill.flytAnt++;
      oppdaterHud();
      oppdaterInspektor();
      tomHendelser();
      sjekkAdvarsel();
      if (motor.ferdig) avslutt();
    }

    if (motor) tegner.tegn(motor, spill, dt);
    requestAnimationFrame(ramme);
  }

  /* ---------------------------------------------------------
     Oppstart
     --------------------------------------------------------- */
  tegner.tilpassStorrelse();
  spill.brettNr = Math.min(lagret.apnet, TT.BRETT.length - 1);
  menyBakgrunn();
  byggBrettliste();
  visKort('kortStart');
  requestAnimationFrame(ramme);
})(window.TT);

/* =============================================================
   Trondheim Trafikk — tegning
   ============================================================= */

(function (TT) {
  'use strict';

  var S = TT.SKALA;

  function Kamera(canvas) {
    this.canvas = canvas;
    this.x = TT.WORLD.w / 2;
    this.y = TT.WORLD.h / 2;
    this.zoom = 1;
    this.basis = 1;
  }

  Kamera.prototype.tilpass = function (w, h) {
    this.basis = Math.min(w / (TT.WORLD.w + 40), h / (TT.WORLD.h + 40));
  };

  Kamera.prototype.skala = function () { return this.basis * this.zoom; };

  Kamera.prototype.tilSkjerm = function (x, y, w, h) {
    var s = this.skala();
    return [(x - this.x) * s + w / 2, (y - this.y) * s + h / 2];
  };

  Kamera.prototype.tilVerden = function (sx, sy, w, h) {
    var s = this.skala();
    return [(sx - w / 2) / s + this.x, (sy - h / 2) / s + this.y];
  };

  Kamera.prototype.begrens = function () {
    var m = 260;
    this.x = Math.max(-m, Math.min(TT.WORLD.w + m, this.x));
    this.y = Math.max(-m, Math.min(TT.WORLD.h + m, this.y));
    this.zoom = Math.max(0.65, Math.min(3.4, this.zoom));
  };

  /* ---------------------------------------------------------
     Tegner
     --------------------------------------------------------- */
  function Tegner(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.kamera = new Kamera(canvas);
    this.w = 0;
    this.h = 0;
    this.tid = 0;
  }

  Tegner.prototype.tilpassStorrelse = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rekt = this.canvas.getBoundingClientRect();
    this.w = rekt.width;
    this.h = rekt.height;
    this.canvas.width = Math.round(rekt.width * dpr);
    this.canvas.height = Math.round(rekt.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.kamera.tilpass(this.w, this.h);
  };

  Tegner.prototype.p = function (x, y) {
    return this.kamera.tilSkjerm(x, y, this.w, this.h);
  };

  Tegner.prototype.tegn = function (motor, tilstand, dt) {
    var ctx = this.ctx;
    this.tid += dt;
    ctx.clearRect(0, 0, this.w, this.h);

    this.bakgrunn();
    this.fjord();
    this.elva();
    this.veier(motor, tilstand);
    this.biler(motor);
    this.noder(motor, tilstand);
    this.lys(motor, tilstand);
  };

  /* -------------------- landskap -------------------- */
  Tegner.prototype.bakgrunn = function () {
    var ctx = this.ctx;
    var g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#131a26');
    g.addColorStop(1, '#0d121b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  };

  Tegner.prototype.fjord = function () {
    var ctx = this.ctx, self = this;
    ctx.save();
    ctx.beginPath();
    var venstre = -300 * S, hoyre = TT.WORLD.w + 300 * S, topp = -500 * S;
    var forst = TT.KYST[0], sist = TT.KYST[TT.KYST.length - 1];
    var p0 = this.p(venstre, topp);
    ctx.moveTo(p0[0], p0[1]);
    var pr = this.p(hoyre, topp);
    ctx.lineTo(pr[0], pr[1]);
    // Kystlinja forlenges rett ut til begge sider, ellers ville polygonet
    // lukket seg på skrå og latt hjørnene stå på tørt land.
    var ph = this.p(hoyre, sist[1]);
    ctx.lineTo(ph[0], ph[1]);
    for (var i = TT.KYST.length - 1; i >= 0; i--) {
      var pk = this.p(TT.KYST[i][0], TT.KYST[i][1]);
      ctx.lineTo(pk[0], pk[1]);
    }
    var pv = this.p(venstre, forst[1]);
    ctx.lineTo(pv[0], pv[1]);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, 0, 0, this.h * 0.4);
    g.addColorStop(0, '#0a2233');
    g.addColorStop(1, '#0d2c40');
    ctx.fillStyle = g;
    ctx.fill();

    // bølgestriper
    ctx.clip();
    ctx.strokeStyle = 'rgba(120, 190, 225, 0.09)';
    ctx.lineWidth = 1.2;
    var steg = 24 * S;
    for (var y = topp; y < 260 * S; y += 26 * S) {
      ctx.beginPath();
      for (var x = venstre; x <= hoyre; x += steg) {
        var by = y + Math.sin((x * 0.0075 / S) + this.tid * 0.5 + y * 0.03 / S) * 4 * S;
        var pp = self.p(x, by);
        if (x === venstre) ctx.moveTo(pp[0], pp[1]); else ctx.lineTo(pp[0], pp[1]);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Munkholmen
    var m = TT.MUNKHOLMEN, s = this.kamera.skala();
    var pm = this.p(m.x, m.y);
    ctx.beginPath();
    ctx.ellipse(pm[0], pm[1], m.r * s, m.r * 0.62 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1d2a30';
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,200,220,.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#c8d6e0';
    ctx.fillRect(pm[0] - 3 * s, pm[1] - 7 * s, 6 * s, 7 * s);
    if (s > 0.75) {
      ctx.fillStyle = 'rgba(190, 215, 232, .55)';
      ctx.font = Math.max(9, 9 * s) + 'px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Munkholmen', pm[0], pm[1] + m.r * 0.62 * s + 13);
    }
  };

  Tegner.prototype.elva = function () {
    var ctx = this.ctx, s = this.kamera.skala();
    ctx.save();
    ctx.beginPath();
    for (var i = 0; i < TT.NIDELVA.length; i++) {
      var p = this.p(TT.NIDELVA[i][0], TT.NIDELVA[i][1]);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f3247';
    ctx.lineWidth = 26 * S * s;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 195, 230, .22)';
    ctx.lineWidth = Math.max(1, 2 * S * s);
    ctx.stroke();
    ctx.restore();
  };

  /* -------------------- veier -------------------- */
  Tegner.prototype.veier = function (motor, tilstand) {
    var ctx = this.ctx, s = this.kamera.skala(), self = this;

    // inaktive veier som svak kontekst
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = Math.max(1, TT.FELT_BREDDE * 2 * s * 0.7);
    TT.VEIER.forEach(function (rad) {
      if (motor.aktivNode[rad[0]] && motor.aktivNode[rad[1]]) return;
      var a = TT.NODE_BY_ID[rad[0]], b = TT.NODE_BY_ID[rad[1]];
      var pa = self.p(a.x, a.y), pb = self.p(b.x, b.y);
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
    });

    motor.veier.forEach(function (v) {
      self.veiBane(v, tilstand, s);
    });

    if (tilstand && tilstand.byggModus && s > 0.55) {
      motor.veier.forEach(function (v) {
        self.feltMerke(v, s);
      });
    }

    // veinavn ved god zoom
    if (s > 0.95) {
      ctx.save();
      ctx.font = '600 ' + (9.5) + 'px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(190, 205, 225, .42)';
      motor.veier.forEach(function (v) {
        if (v.len * s < 96) return;
        var a = TT.NODE_BY_ID[v.a], b = TT.NODE_BY_ID[v.b];
        var pa = self.p(a.x, a.y), pb = self.p(b.x, b.y);
        var vinkel = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]);
        if (vinkel > Math.PI / 2 || vinkel < -Math.PI / 2) vinkel += Math.PI;
        ctx.save();
        ctx.translate((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2);
        ctx.rotate(vinkel);
        ctx.fillText(v.navn, 0, -TT.FELT_BREDDE * v.felt * s - 4);
        ctx.restore();
      });
      ctx.restore();
    }
  };

  /** Tegner én vei — bredden vokser når spilleren bygger ut flere felt. */
  Tegner.prototype.veiBane = function (v, tilstand, s) {
    var ctx = this.ctx;
    var a = TT.NODE_BY_ID[v.a], b = TT.NODE_BY_ID[v.b];
    var pa = this.p(a.x, a.y), pb = this.p(b.x, b.y);
    var bredde = TT.FELT_BREDDE * v.felt * 2 * s;
    var byggModus = tilstand && tilstand.byggModus;
    var valgt = byggModus && tilstand.valgtVei === v.id;
    var hover = byggModus && tilstand.hoverVei === v.id;

    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pa[0], pa[1]);
    ctx.lineTo(pb[0], pb[1]);

    ctx.strokeStyle = '#1b2534';
    ctx.lineWidth = bredde + 6 * s;
    ctx.stroke();

    ctx.strokeStyle = '#333e4f';
    ctx.lineWidth = bredde;
    ctx.stroke();

    // midtstiplet linje
    if (s > 0.5) {
      ctx.save();
      ctx.setLineDash([7 * s, 9 * s]);
      ctx.strokeStyle = 'rgba(226, 214, 160, .30)';
      ctx.lineWidth = Math.max(0.8, 1.3 * s);
      ctx.stroke();
      ctx.restore();
    }

    // skillelinjer mellom feltene i samme retning
    if (v.felt > 1 && s > 0.55) {
      ctx.save();
      ctx.setLineDash([4 * s, 6 * s]);
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = Math.max(0.6, 1 * s);
      var hx = -(pb[1] - pa[1]), hy = (pb[0] - pa[0]);
      var l = Math.hypot(hx, hy) || 1;
      hx /= l; hy /= l;
      for (var i = 1; i < v.felt; i++) {
        [1, -1].forEach(function (fortegn) {
          var off = fortegn * i * TT.FELT_BREDDE * s;
          ctx.beginPath();
          ctx.moveTo(pa[0] + hx * off, pa[1] + hy * off);
          ctx.lineTo(pb[0] + hx * off, pb[1] + hy * off);
          ctx.stroke();
        });
      }
      ctx.restore();
    }

    if (valgt || hover) {
      ctx.save();
      ctx.setLineDash([]);
      ctx.strokeStyle = valgt ? 'rgba(120, 200, 255, .95)' : 'rgba(255,255,255,.45)';
      ctx.lineWidth = Math.max(1.4, (valgt ? 3 : 1.6) * s);
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
      ctx.restore();
    }
  };

  /** Liten «N/maks felt»-merkelapp midt på veien — bare i veibygger-modus. */
  Tegner.prototype.feltMerke = function (v, s) {
    var ctx = this.ctx;
    var a = TT.NODE_BY_ID[v.a], b = TT.NODE_BY_ID[v.b];
    var pa = this.p(a.x, a.y), pb = this.p(b.x, b.y);
    var mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
    var kanUtvides = v.felt < v.feltMaks;
    var tekst = v.felt + '/' + v.feltMaks;

    ctx.save();
    ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var bredde = ctx.measureText(tekst).width;
    ctx.fillStyle = kanUtvides ? 'rgba(61,220,132,.88)' : 'rgba(20,26,36,.85)';
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 1;
    rundetRekt(ctx, mx - bredde / 2 - 5, my - 9, bredde + 10, 18, 9);
    ctx.fill();
    ctx.fillStyle = kanUtvides ? '#06231a' : '#93a1b6';
    ctx.fillText(tekst, mx, my + 0.5);
    ctx.restore();
  };

  /* -------------------- biler -------------------- */
  Tegner.prototype.biler = function (motor) {
    var ctx = this.ctx, s = this.kamera.skala();
    for (var i = 0; i < motor.biler.length; i++) {
      var bil = motor.biler[i];
      var vei = bil.vei;
      var t = Math.max(0, Math.min(vei.len, bil.s));
      var bx, by;
      if (bil.retning === 0) { bx = TT.NODE_BY_ID[vei.a].x + vei.dx * t; by = TT.NODE_BY_ID[vei.a].y + vei.dy * t; }
      else { bx = TT.NODE_BY_ID[vei.b].x - vei.dx * t; by = TT.NODE_BY_ID[vei.b].y - vei.dy * t; }

      var hx = Math.cos(bil.visVinkel), hy = Math.sin(bil.visVinkel);
      var offsetFelt = (bil.lane + 0.5) * TT.FELT_BREDDE;
      bx += -hy * offsetFelt;
      by += hx * offsetFelt;

      var p = this.p(bx, by);
      if (p[0] < -40 || p[1] < -40 || p[0] > this.w + 40 || p[1] > this.h + 40) continue;

      var L = bil.lengde * s, B = bil.bredde * s;
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(bil.visVinkel);

      if (bil.sint) {
        ctx.shadowColor = 'rgba(255, 86, 86, .9)';
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = bil.sint ? '#ff6b6b' : bil.farge;
      rundetRekt(ctx, -L / 2, -B / 2, L, B, Math.min(2.5 * s, B / 2.4));
      ctx.fill();
      ctx.shadowBlur = 0;

      if (s > 0.9) {
        ctx.fillStyle = 'rgba(10,16,24,.45)';
        rundetRekt(ctx, -L * 0.12, -B / 2 + 0.8 * s, L * 0.38, B - 1.6 * s, 1 * s);
        ctx.fill();
        if (bil.bremser) {
          ctx.fillStyle = '#ff5252';
          ctx.fillRect(-L / 2, -B / 2, Math.max(1, 1.6 * s), B);
        }
      }
      ctx.restore();
    }
  };

  function rundetRekt(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* -------------------- steder -------------------- */
  Tegner.prototype.noder = function (motor, tilstand) {
    var ctx = this.ctx, s = this.kamera.skala();
    for (var i = 0; i < TT.NODES.length; i++) {
      var n = TT.NODES[i];
      var aktiv = !!motor.aktivNode[n.id];
      var p = this.p(n.x, n.y);
      var r = (n.kind === 'port' ? 13 : 12) * S * s;

      ctx.globalAlpha = aktiv ? 1 : 0.22;

      // sokkel
      ctx.beginPath();
      ctx.arc(p[0], p[1], r + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 15, 22, .78)';
      ctx.fill();
      ctx.strokeStyle = motor.lys[n.id] ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.10)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ikon(ctx, n.ikon, p[0], p[1], Math.max(7, r * 1.25), aktiv);

      if (s > 0.42 && aktiv) {
        var tekst = n.navn;
        ctx.font = '600 ' + Math.max(9.5, Math.min(13, 10 * s)) + 'px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        var bredde = ctx.measureText(tekst).width;
        var ty = p[1] + r + 15;
        ctx.fillStyle = 'rgba(8, 12, 18, .68)';
        rundetRekt(ctx, p[0] - bredde / 2 - 5, ty - 10, bredde + 10, 14, 5);
        ctx.fill();
        ctx.fillStyle = n.kind === 'port' ? '#8fd3b0' : '#dbe6f5';
        ctx.fillText(tekst, p[0], ty);
      }
      ctx.globalAlpha = 1;
    }
  };

  /* -------------------- trafikklys -------------------- */
  Tegner.prototype.lys = function (motor, tilstand) {
    var ctx = this.ctx, s = this.kamera.skala(), self = this;

    Object.keys(motor.lys).forEach(function (id) {
      var lys = motor.lys[id];
      var n = lys.node;
      var p = self.p(n.x, n.y);
      var valgt = tilstand.valgt === id;
      var hover = tilstand.hover === id;

      // fase-ring
      var r = 17 * S * s;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - lys.t / lys.periode));
      ctx.strokeStyle = lys.erGult() ? 'rgba(255, 190, 60, .95)' : 'rgba(120, 230, 170, .55)';
      ctx.lineWidth = Math.max(1.6, 2.4 * s);
      ctx.stroke();

      if (valgt || hover) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], r + 5 * s, 0, Math.PI * 2);
        ctx.strokeStyle = valgt ? 'rgba(120, 200, 255, .95)' : 'rgba(255,255,255,.35)';
        ctx.lineWidth = valgt ? 2.2 : 1.2;
        ctx.stroke();
      }

      // en liten lysklump per tilfartsvei
      (motor.naboer[id] || []).forEach(function (kob) {
        var annen = TT.NODE_BY_ID[kob.til];
        var vx = annen.x - n.x, vy = annen.y - n.y;
        var l = Math.hypot(vx, vy) || 1;
        vx /= l; vy /= l;
        var d = 21 * S;
        var q = self.p(n.x + vx * d, n.y + vy * d);
        var gronn = lys.gruppe[kob.vei.id] === lys.fase;
        var farge = gronn ? (lys.erGult() ? '#ffbe3c' : '#3ddc84') : '#ff5a5a';
        ctx.save();
        ctx.translate(q[0], q[1]);
        ctx.rotate(Math.atan2(vy, vx));
        ctx.fillStyle = farge;
        ctx.shadowColor = farge;
        ctx.shadowBlur = 8 * Math.max(0.6, s);
        rundetRekt(ctx, -1.8 * s, -4.5 * s, 3.6 * s, 9 * s, 1.6 * s);
        ctx.fill();
        ctx.restore();
      });
    });
  };

  /* -------------------- ikoner -------------------- */
  function ikon(ctx, type, x, y, r, aktiv) {
    var lys = aktiv ? '#e8eef8' : '#7d8798';
    var aks = aktiv ? '#7fd4ff' : '#5f6c7d';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r / 10, r / 10);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = lys;
    ctx.fillStyle = lys;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    switch (type) {
      case 'katedral':
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(3, -1); ctx.lineTo(3, 6); ctx.lineTo(-3, 6);
        ctx.lineTo(-3, -1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = aks;
        ctx.fillRect(-5.5, 1, 2, 5); ctx.fillRect(3.5, 1, 2, 5);
        break;
      case 'bybro':
        ctx.beginPath(); ctx.moveTo(-7, 4); ctx.quadraticCurveTo(0, -6, 7, 4); ctx.stroke();
        ctx.fillStyle = aks; ctx.fillRect(-7.5, 3.5, 2, 4); ctx.fillRect(5.5, 3.5, 2, 4);
        break;
      case 'bru':
        ctx.beginPath(); ctx.moveTo(-7, 2); ctx.lineTo(7, 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(-4, 6); ctx.moveTo(4, 2); ctx.lineTo(4, 6); ctx.stroke();
        ctx.strokeStyle = aks;
        ctx.beginPath(); ctx.moveTo(-7, 2); ctx.quadraticCurveTo(0, -6, 7, 2); ctx.stroke();
        break;
      case 'stadion':
        ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = aks;
        ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.4, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'taarn':
        ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(-1, -2); ctx.lineTo(1, -2); ctx.lineTo(2, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = aks;
        ctx.beginPath(); ctx.ellipse(0, -3.5, 4.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'stasjon':
        ctx.fillRect(-6, -3, 12, 8);
        ctx.fillStyle = '#0d131c'; ctx.fillRect(-4, -1, 3, 3); ctx.fillRect(1, -1, 3, 3);
        ctx.fillStyle = aks; ctx.fillRect(-7, -5, 14, 2);
        break;
      case 'tog':
        ctx.fillRect(-6, -2, 12, 7);
        ctx.fillStyle = aks; ctx.fillRect(-6, -5, 12, 3);
        break;
      case 'universitet':
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(8, -2); ctx.lineTo(0, 2); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = aks;
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-4, 6); ctx.lineTo(4, 6); ctx.lineTo(4, 0); ctx.stroke();
        break;
      case 'sykehus':
        ctx.fillRect(-6, -6, 12, 12);
        ctx.fillStyle = '#e2483f';
        ctx.fillRect(-1.6, -4, 3.2, 8); ctx.fillRect(-4.5, -1.6, 9, 3.2);
        break;
      case 'festning':
        ctx.beginPath();
        ctx.moveTo(-7, 6); ctx.lineTo(-7, -3); ctx.lineTo(-4.5, -3); ctx.lineTo(-4.5, -5.5);
        ctx.lineTo(-1.5, -5.5); ctx.lineTo(-1.5, -3); ctx.lineTo(1.5, -3); ctx.lineTo(1.5, -5.5);
        ctx.lineTo(4.5, -5.5); ctx.lineTo(4.5, -3); ctx.lineTo(7, -3); ctx.lineTo(7, 6);
        ctx.closePath(); ctx.fill();
        break;
      case 'arena':
        ctx.beginPath(); ctx.moveTo(-8, 5); ctx.quadraticCurveTo(0, -8, 8, 5); ctx.closePath(); ctx.fill();
        break;
      case 'museum':
        ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(0, -7); ctx.lineTo(7, -2); ctx.closePath(); ctx.fill();
        ctx.fillRect(-6, -1, 12, 7);
        ctx.fillStyle = aks; ctx.fillRect(-1, 1, 2, 5);
        break;
      case 'basseng':
        ctx.strokeStyle = aks;
        for (var i = -3; i <= 3; i += 3) {
          ctx.beginPath();
          ctx.moveTo(-7, i + 1);
          ctx.quadraticCurveTo(-3.5, i - 2, 0, i + 1);
          ctx.quadraticCurveTo(3.5, i + 4, 7, i + 1);
          ctx.stroke();
        }
        break;
      case 'fisk':
        ctx.beginPath();
        ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, -5.5, 6, 0);
        ctx.quadraticCurveTo(0, 5.5, -7, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(9, -3.5); ctx.lineTo(9, 3.5); ctx.closePath(); ctx.fill();
        break;
      case 'torg':
        ctx.fillStyle = aks;
        ctx.fillRect(-1, -8, 2, 10);
        ctx.fillStyle = lys;
        ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(8, 3); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
        break;
      case 'trehus':
        ctx.beginPath(); ctx.moveTo(-7, 6); ctx.lineTo(-7, -1); ctx.lineTo(-3.5, -5); ctx.lineTo(0, -1);
        ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = aks;
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -1); ctx.lineTo(3.5, -5); ctx.lineTo(7, -1);
        ctx.lineTo(7, 6); ctx.closePath(); ctx.fill();
        break;
      case 'restaurant':
        ctx.strokeStyle = lys; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(-4, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6.5, -7); ctx.lineTo(-6.5, -2); ctx.moveTo(-1.5, -7); ctx.lineTo(-1.5, -2); ctx.stroke();
        ctx.strokeStyle = aks;
        ctx.beginPath(); ctx.moveTo(4.5, 7); ctx.lineTo(4.5, -1); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(4.5, -4, 2.6, 3.2, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'kran':
        ctx.strokeStyle = aks; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-1, 7); ctx.lineTo(-1, -6); ctx.lineTo(7, -6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-1, -6); ctx.lineTo(-6, -6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, -6); ctx.lineTo(5, -1); ctx.stroke();
        break;
      case 'handel':
        ctx.fillRect(-7, -2, 14, 8);
        ctx.fillStyle = aks;
        ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-6, -6); ctx.lineTo(6, -6); ctx.lineTo(8, -2); ctx.closePath(); ctx.fill();
        break;
      case 'studentby':
        ctx.fillRect(-7, -4, 5, 10);
        ctx.fillStyle = aks; ctx.fillRect(0, -7, 5, 13);
        break;
      case 'samfundet':   // det runde røde huset
        ctx.beginPath(); ctx.arc(0, 1, 5.6, 0, Math.PI * 2);
        ctx.fillStyle = aktiv ? '#a8392e' : '#5c3a36'; ctx.fill();
        ctx.strokeStyle = lys; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 1, 5.6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -4.6); ctx.lineTo(0, -8); ctx.stroke();
        break;
      case 'nabolag':
        ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(-6, 0); ctx.lineTo(-2.5, -4); ctx.lineTo(1, 0);
        ctx.lineTo(1, 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = aks; ctx.fillRect(2.5, -1, 4.5, 7);
        break;
      case 'port':
        ctx.strokeStyle = '#7fe0ac'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#7fe0ac';
        ctx.beginPath(); ctx.moveTo(-2.5, -3.5); ctx.lineTo(3.5, 0); ctx.lineTo(-2.5, 3.5); ctx.closePath(); ctx.fill();
        break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  TT.Tegner = Tegner;
})(window.TT);

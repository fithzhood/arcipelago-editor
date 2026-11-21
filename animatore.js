// Le animazioni senza grafica: trasforma gli eventi delle regole in pose (posizione, rotazione, scala)
// di caselle, coniglio, glifi e schegge. Ogni stile legge queste pose e le disegna a modo suo.
// Coordinate: x e z sono quelle della griglia (z = riga), y è l'altezza.

const morbido = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const frena = (t) => 1 - Math.pow(1 - t, 3);

export class Animatore {
  constructor(gioco, opz = {}) {
    this.gioco = gioco; this.opz = opz;
    this.coda = []; this.corrente = null; this.tempo = 0; this.scossa = 0; this.zoom = 1.45;
    // quanto dura un passo: il coniglio saltella svelto, un quadrupede cammina un po' più piano
    this.durate = { coniglio: 0.15, gatto: 0.26, volpe: 0.26 };
    this.celle = new Map();
    for (const l of gioco.liv.iniziale.lastre) for (const c of l.celle)
      this.celle.set(c.id, { id: c.id, lastra: l.id, colore: l.colore, alt: (c.x + c.y) % 2, x: c.x, y: 0, z: c.y, rx: 0, ry: 0, rz: 0, s: 1, vis: true, brucia: 0 });
    // cammino: caselle percorse, per un'andatura che non riparte da zero a ogni passo
    this.pers = gioco.stato.personaggi.map((p) => ({ chi: p.chi, x: 0, y: 0, z: 0, ry: 0, rz: 0, vis: true, passo: 0, cammino: 0, salto: 0 }));
    this.glifi = [...gioco.liv.glifi.values()].map((g, i) => ({ g, cop: 0, imp: 0, fase: i * 1.7, alt: 0 }));
    this.schegge = [];
    this.mira = { x: 0, z: 0 };
    // i tratti scoperti, per le nuvole: si aprono quando arriva l'evento, non prima
    this.scoperti = new Set(gioco.esplorati);
    // le pietre: i sigilli (accesi finché il loro sottolivello non è risolto) e, nei sottolivelli,
    // l'uscita, la pietra gemella, incatenata finché resta una zona tratteggiata vuota
    this.pietre = [...gioco.liv.sigilli.values()].map((s) => ({ x: s.x, y: s.y, livello: s.livello, meta: false, luce: gioco.risolti.has(s.livello) ? 0 : 1, imp: 0 }));
    // le zone tratteggiate: `piena` cambia quando la lastra entra o esce (a fine animazione, non prima)
    this.sagome = gioco.liv.sagome.map(() => ({ piena: 0, luce: 0 }));
    // l'uscita è sempre accesa
    if (gioco.liv.meta) this.pietre.push({ x: gioco.liv.meta[0], y: gioco.liv.meta[1], meta: true, luce: 1, imp: 0 });
    // le catene di ogni pietra, una per zona tratteggiata (il suo lucchetto): `chiusa` 1 = incatenata,
    // scende a 0 quando la sua zona è riempita
    for (const p of this.pietre) p.catene = gioco.liv.catene.filter((c) => c.x === p.x && c.y === p.y).map((c) => ({ zona: c.zona, chiusa: 1 }));
    // nel mondo che si richiude le pose restano continue durante le animazioni (una lastra che passa
    // il bordo va da 47 a 49, non salta a 1): `dw` dà la distanza più corta, e il pittore disegna
    // ogni cosa nella copia del mondo più vicina alla telecamera
    const L = gioco.liv;
    this.dx = (d) => L.dw(d, L.W); this.dz = (d) => L.dw(d, L.H);
    this.sincronizza(true);
  }

  /** Il personaggio comandato in questo momento. */
  get con() { return this.pers[this.gioco.stato.attivo] || this.pers[0]; }
  get occupato() { return !!this.corrente || this.coda.length > 0; }

  sincronizza(camera = false) {
    const st = this.gioco.stato, vivi = new Map();
    st.lastre.forEach((l) => l.celle.forEach((c) => vivi.set(c.id, [c, l.id])));
    for (const [id, a] of this.celle) {
      const [c, lastra] = vivi.get(id) || [];
      a.vis = !!c; a.brucia = 0;
      // con fusione e divisione una casella può cambiare lastra
      if (c) Object.assign(a, { x: c.x, y: 0, z: c.y, rx: 0, ry: 0, rz: 0, s: 1, lastra });
    }
    st.personaggi.forEach((co, i) => Object.assign(this.pers[i], { x: co.x, y: 0, z: co.y, ry: Math.atan2(co.verso[0], co.verso[1]), rz: 0, vis: !co.caduto, salto: 0 }));
    const piene = this.gioco.sagomeRiempite();
    this.sagome.forEach((z, i) => { z.piena = piene[i] ? 1 : 0; if (camera) z.luce = z.piena; });
    if (camera) for (const p of this.pietre) for (const c of p.catene) c.chiusa = piene[c.zona] ? 0 : 1;
    if (camera) { const co = this.con, m = this.miraPer(co.x, co.z); this.mira.x = m.x; this.mira.z = m.z; }
  }
  interrompi() { this.coda = []; this.corrente = null; this.trattieni = false; this.sincronizza(); }

  /**
   * La telecamera segue il coniglio. Su un quadro che sta tutto nello schermo resta tirata verso il
   * centro; su una mappa più grande (l'overworld) il centro è lontano e lo segue e basta.
   */
  miraPer(x, z) {
    const L = this.gioco.liv, cx = L.W / 2 - 0.5, cz = L.H / 2 - 0.5, k = L.W > 24 || L.H > 16 ? 1 : 0.6;
    return { x: cx + (x - cx) * k, z: cz + (z - cz) * k };
  }

  celleDi(lastra) { return [...this.celle.values()].filter((a) => a.lastra === lastra && a.vis); }

  scheggia(a, n, tipo, forza = 1) {
    for (let i = 0; i < n; i++) this.schegge.push({
      x: a.x + (Math.random() - 0.5) * 0.7, y: a.y, z: a.z + (Math.random() - 0.5) * 0.7, tipo, vita: 0.7, giro: Math.random() * 6,
      vx: (Math.random() - 0.5) * 2 * forza, vy: (1.5 + Math.random() * 2) * forza, vz: (Math.random() - 0.5) * 2 * forza,
    });
  }

  riproduci(eventi) {
    for (const e of eventi) { const f = this['a_' + e.tipo.replace('-', '_')]; if (f) this.coda.push(f.call(this, e)); }
  }

  a_cammina(e) {
    const k = this.pers[e.chi], [x0, z0] = e.da, x1 = x0 + this.dx(e.a[0] - x0), z1 = z0 + this.dz(e.a[1] - z0);
    let c0;
    return { dur: this.durate[k.chi] ?? 0.2, cammina: true, chi: e.chi, inizio: () => { k.ry = Math.atan2(x1 - x0, z1 - z0); c0 = k.cammino; },
      passo: (t) => { k.x = x0 + (x1 - x0) * t; k.z = z0 + (z1 - z0) * t; k.y = Math.sin(Math.PI * t) * 0.22; k.passo = t; k.cammino = c0 + t; } };
  }
  a_urto(e) {
    const k = this.pers[e.chi]; let x0, z0;
    return { dur: 0.14, inizio: () => { x0 = k.x; z0 = k.z; k.ry = Math.atan2(e.d[0], e.d[1]); if (e.catene) { const p = this.pietre.find((q) => q.x === e.catene[0] && q.y === e.catene[1]); if (p) p.scuoti = 1; } },
      passo: (t) => { const s = Math.sin(Math.PI * t) * 0.14; k.x = x0 + e.d[0] * s; k.z = z0 + e.d[1] * s; } };
  }
  a_glifo(e) {
    return { dur: 0, inizio: () => { const g = this.glifi.find((q) => q.g.x === e.x && q.g.y === e.y); if (g) g.imp = 1; } };
  }
  /** Oggetti che si muovono insieme: le caselle della lastra e i personaggi che ci stanno sopra. */
  insieme(lastra, passeggeri = []) {
    const ogg = [...this.celleDi(lastra), ...passeggeri.map((i) => this.pers[i])];
    return { ogg, p0: ogg.map((o) => ({ x: o.x, y: o.y, z: o.z, ry: o.ry })) };
  }
  a_trasla(e) {
    let I; const dx = e.d[0] * e.passi, dz = e.d[1] * e.passi;
    return { dur: Math.min(0.12 * e.passi + 0.14, 1.1), inizio: () => { I = this.insieme(e.lastra, e.passeggeri); },
      passo: (t) => { const m = morbido(t); I.ogg.forEach((o, i) => { o.x = I.p0[i].x + dx * m; o.z = I.p0[i].z + dz * m; }); },
      fine: () => { this.scossa = 0.05; } };
  }
  a_trasla_urto(e) {
    let I;
    return { dur: 0.22, inizio: () => { I = this.insieme(e.lastra, e.passeggeri); this.scossa = 0.06; },
      passo: (t) => { const s = Math.sin(Math.PI * t) * 0.13; I.ogg.forEach((o, i) => { o.x = I.p0[i].x + e.d[0] * s; o.z = I.p0[i].z + e.d[1] * s; }); } };
  }
  ruotaA(I, px, pz, a) {
    const co = Math.cos(a), si = Math.sin(a);
    I.ogg.forEach((o, i) => {
      const dx = this.dx(I.p0[i].x - px), dz = this.dz(I.p0[i].z - pz);
      o.x = px + dx * co - dz * si; o.z = pz + dx * si + dz * co; o.ry = I.p0[i].ry - a;
    });
  }
  a_ruota(e) {
    let I; const [px, pz] = e.perno;
    return { dur: 0.2 + Math.abs(e.angolo) * 0.17, inizio: () => { I = this.insieme(e.lastra, e.passeggeri); },
      passo: (t) => this.ruotaA(I, px, pz, e.angolo * morbido(t)), fine: () => { this.scossa = 0.04; } };
  }
  a_ruota_urto(e) {
    let I; const [px, pz] = e.perno, s = Math.sign(e.angolo);
    const picco = s * Math.max(0.12, Math.abs(e.angolo) - 0.13);
    return { dur: 0.55, inizio: () => { I = this.insieme(e.lastra, e.passeggeri); },
      passo: (t) => {
        let a;
        if (t < 0.4) a = picco * frena(t / 0.4);
        else { const k = (t - 0.4) / 0.6; a = picco * (1 - morbido(k)) + Math.sin(k * 30) * 0.05 * (1 - k); if (k < 0.05) this.scossa = 0.08; }
        this.ruotaA(I, px, pz, a);
      } };
  }
  a_specchia(e) {
    const mob = e.mappa.filter((m) => m.da[0] !== e.perno[0] || m.da[1] !== e.perno[1])
      .map((m) => ({ a: this.celle.get(m.id), da: m.da, ar: [m.da[0] + this.dx(m.a[0] - m.da[0]), m.da[1] + this.dz(m.a[1] - m.da[1])], g: [Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3] }));
    let rifatte = false;
    return { dur: 0.8,
      inizio: () => mob.forEach((m) => this.scheggia(m.a, 3, 'lastra')),
      passo: (t) => {
        for (const m of mob) {
          const a = m.a; let x = m.da[0], z = m.da[1], y, s, sp;
          if (t < 0.25) { const k = t / 0.25; s = 1 - 0.55 * k; y = 0.35 * k; sp = k; }
          else if (t < 0.75) { const k = (t - 0.25) / 0.5, q = morbido(k); x += (m.ar[0] - x) * q; z += (m.ar[1] - z) * q; y = 0.35 + Math.sin(Math.PI * k) * 0.6; s = 0.45; sp = 1 + k; }
          else { const k = (t - 0.75) / 0.25; x = m.ar[0]; z = m.ar[1]; y = 0.35 * (1 - frena(k)); s = 0.45 + 0.55 * frena(k); sp = 2 * (1 - k); }
          Object.assign(a, { x, y, z, s, rx: m.g[0] * sp * 0.3, ry: m.g[1] * sp * 0.3, rz: m.g[2] * sp * 0.3 });
        }
        if (t >= 0.75 && !rifatte) { rifatte = true; mob.forEach((m) => this.scheggia(m.a, 2, 'lastra', 0.5)); }
      },
      fine: () => mob.forEach((m) => Object.assign(m.a, { x: m.ar[0], y: 0, z: m.ar[1], s: 1, rx: 0, ry: 0, rz: 0 })) };
  }
  a_specchia_urto(e) {
    const mob = this.celleDi(e.lastra).filter((a) => Math.round(a.x) !== e.perno[0] || Math.round(a.z) !== e.perno[1]);
    return { dur: 0.6, inizio: () => mob.forEach((a) => this.scheggia(a, 2, 'lastra')),
      passo: (t) => mob.forEach((a, i) => {
        const su = t < 0.4 ? frena(t / 0.4) : 1 - morbido((t - 0.4) / 0.6);
        Object.assign(a, { y: su * 0.32, s: 1 - su * 0.4, rx: Math.sin(t * 40 + i) * 0.15 * su, rz: Math.cos(t * 37 + i) * 0.15 * su });
        if (t > 0.95) this.scossa = 0.06;
      }),
      fine: () => mob.forEach((a) => Object.assign(a, { y: 0, s: 1, rx: 0, rz: 0 })) };
  }
  a_brucia(e) {
    const ogg = e.celle.map((id) => this.celle.get(id));
    return { dur: 0.7, inizio: () => ogg.forEach((a) => this.scheggia(a, 6, 'fuoco', 0.8)),
      passo: (t) => ogg.forEach((a) => { a.y = -t * t * 3; a.s = 1 - t * 0.6; a.rx = t * 1.2; a.brucia = t; }),
      fine: () => ogg.forEach((a) => { a.vis = false; }) };
  }
  /**
   * Fusione: le lastre si spingono l'una verso l'altra lungo i lati in comune (ognuna ancora blocco a
   * sé), poi diventano un blocco solo che fa un piccolo sobbalzo, come pasta schiacciata insieme.
   */
  a_fonde(e) {
    let M;
    return { dur: 0.5,
      inizio: () => { M = e.membri.map((m) => ({ ...m, ogg: m.celle.map((id) => this.celle.get(id)), p0: m.celle.map((id) => { const a = this.celle.get(id); return [a.x, a.z]; }) })); },
      passo: (t) => {
        if (t < 0.45) {
          const s = Math.sin((Math.PI * t) / 0.45) * 0.09;
          for (const m of M) m.ogg.forEach((a, i) => { a.x = m.p0[i][0] + m.verso[0] * s; a.z = m.p0[i][1] + m.verso[1] * s; });
          return;
        }
        if (!M.fuse) {
          M.fuse = true; this.scossa = 0.05;
          for (const m of M) m.ogg.forEach((a, i) => { a.lastra = e.lastra; a.x = m.p0[i][0]; a.z = m.p0[i][1]; });
          // qualche briciola dove si sono toccate
          for (const m of M) if (m.verso[0] || m.verso[1]) m.ogg.slice(0, 2).forEach((a) => this.scheggia(a, 2, 'lastra', 0.4));
        }
        const k = (t - 0.45) / 0.55, y = Math.sin(Math.PI * k) * 0.08 * (1 - k * 0.5);
        for (const m of M) m.ogg.forEach((a) => { a.y = y; });
      },
      fine: () => { for (const m of M) m.ogg.forEach((a) => { a.y = 0; a.lastra = e.lastra; }); } };
  }
  /** Divisione: ogni pezzo diventa una lastra a sé e trema un attimo. */
  a_divide(e) {
    let P;
    return { dur: 0.3,
      inizio: () => { P = e.pezzi.map((p) => p.celle.map((id) => { const a = this.celle.get(id); a.lastra = p.lastra; return a; })); },
      passo: (t) => P.forEach((ogg, i) => { const y = Math.sin(Math.PI * t * 2 + i) * 0.04 * (1 - t); ogg.forEach((a) => { a.y = y; }); }),
      fine: () => P.forEach((ogg) => ogg.forEach((a) => { a.y = 0; })) };
  }
  /** Passaggio all'altro personaggio: un saltello, così si vede chi si comanda ora. */
  a_cambia(e) {
    const k = this.pers[e.chi];
    return { dur: 0.28, passo: (t) => { k.salto = Math.sin(Math.PI * t) * 0.3; }, fine: () => { k.salto = 0; } };
  }
  /** Si scopre un tratto: le sue nuvole si aprono (le disegna il pittore leggendo `scoperti`). */
  a_scopre(e) { return { dur: 0, inizio: () => { this.scoperti.add(e.tratto); } }; }
  /**
   * Si sale su un sigillo chiuso: il personaggio ci salta sopra e ci resta (`trattieni`: a fine
   * animazione non torna dove lo vuole la logica) mentre la pagina chiude il sipario.
   */
  a_entra(e) {
    const k = this.pers[e.chi], [x0, z0] = e.da, x1 = x0 + this.dx(e.a[0] - x0), z1 = z0 + this.dz(e.a[1] - z0);
    const p = this.pietre.find((q) => q.x === e.a[0] && q.y === e.a[1]);
    return { dur: 0.32, inizio: () => { k.ry = Math.atan2(x1 - x0, z1 - z0); this.trattieni = true; },
      passo: (t) => { k.x = x0 + (x1 - x0) * t; k.z = z0 + (z1 - z0) * t; k.y = Math.sin(Math.PI * t) * 0.4 + 0.06 * t; k.passo = t; },
      fine: () => { if (p) p.imp = 1; this.opz.suEntra?.(e.sigillo); } };
  }
  /** Tornati dal sottolivello risolto: il sigillo si spegne (la luce scende da sola in aggiorna). */
  a_risolto() {
    const k = this.con;
    return { dur: 0.5, passo: (t) => { k.salto = Math.sin(Math.PI * t) * 0.35; }, fine: () => { k.salto = 0; } };
  }
  /** Una lastra entra in una zona tratteggiata o ne esce: la zona cambia colore, la sua catena si apre o si richiude. */
  a_sagome(e) {
    return { dur: 0, inizio: () => {
      e.piene.forEach((v, i) => {
        if (v && !this.sagome[i].piena) for (const p of this.pietre) if (p.catene.some((c) => c.zona === i)) p.imp = 1;
        this.sagome[i].piena = v ? 1 : 0;
      });
    } };
  }
  /** Arrivati all'uscita accesa: due saltelli sulla pietra, poi la pagina riporta nell'overworld. */
  a_vince(e) {
    const k = this.pers[e.chi], p = this.pietre.find((q) => q.meta);
    return { dur: 0.75, inizio: () => { this.trattieni = true; if (p) p.imp = 1; },
      passo: (t) => { k.salto = Math.abs(Math.sin(Math.PI * 2 * t)) * 0.32 * (1 - t * 0.4); },
      fine: () => { k.salto = 0; this.opz.suVince?.(); } };
  }
  a_cade(e) {
    const k = this.pers[e.chi ?? 0]; let y0;
    return { dur: 0.9, inizio: () => { y0 = k.y; }, passo: (t) => { k.y = y0 - t * t * 7; k.rz = t * 2.5; },
      fine: () => { k.vis = false; this.opz.suCaduta?.(k.chi); } };
  }

  aggiorna(dt) {
    this.tempo += dt;
    for (let giri = 0; giri < 20; giri++) {
      if (!this.corrente) {
        if (!this.coda.length) break;
        this.corrente = this.coda.shift(); this.corrente.t = 0; this.corrente.inizio?.();
        if (!this.corrente.dur) { this.corrente.fine?.(); this.corrente = null; if (!this.coda.length) this.finito(); continue; }
      }
      const a = this.corrente;
      a.t = Math.min(1, a.t + dt / a.dur); a.passo?.(a.t);
      if (a.t >= 1) { a.fine?.(); this.corrente = null; if (!this.coda.length) this.finito(); }
      break;
    }
    // un glifo si accende quando una casella lo copre
    const vis = [...this.celle.values()].filter((a) => a.vis);
    for (const q of this.glifi) {
      const cop = vis.some((a) => Math.abs(this.dx(a.x - q.g.x)) < 0.35 && Math.abs(this.dz(a.z - q.g.y)) < 0.35 && Math.abs(a.y) < 0.2) ? 1 : 0;
      q.cop += (cop - q.cop) * Math.min(1, dt * 10);
      q.imp = Math.max(0, q.imp - dt * 2.5);
      q.alt = (1 - q.cop) * (0.06 + 0.05 * Math.sin(this.tempo * 1.8 + q.fase));
    }
    for (const z of this.sagome) z.luce += (z.piena - z.luce) * Math.min(1, dt * 5);
    for (const p of this.pietre) {
      p.scuoti = Math.max(0, (p.scuoti || 0) - dt * 2.2);
      for (const c of p.catene) { const v = 1 - this.sagome[c.zona].piena, d = v - c.chiusa; c.chiusa += Math.sign(d) * Math.min(Math.abs(d), dt * 1.4); }
      const vuole = p.meta || !this.gioco.risolti.has(p.livello) ? 1 : 0;
      p.luce += (vuole - p.luce) * Math.min(1, dt * 2.5);
      p.imp = Math.max(0, p.imp - dt * 1.5);
    }
    for (let i = this.schegge.length - 1; i >= 0; i--) {
      const s = this.schegge[i];
      s.vy -= 9 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.giro += dt * 6; s.vita -= dt;
      if (s.vita <= 0) this.schegge.splice(i, 1);
    }
    if (this.con.vis) {
      // la telecamera segue chi si comanda; dopo un cambio scivola sull'altro
      const m = this.miraPer(this.con.x, this.con.z), k = 1 - Math.exp(-dt * 4);
      this.mira.x += this.dx(m.x - this.mira.x) * k; this.mira.z += this.dz(m.z - this.mira.z) * k;
      // la mira resta dentro il mondo: tutto il resto si disegna attorno a lei
      if (this.gioco.liv.toroide) { const { W, H } = this.gioco.liv; this.mira.x = ((this.mira.x % W) + W) % W; this.mira.z = ((this.mira.z % H) + H) % H; }
    }
    this.scossa *= Math.exp(-dt * 12);
  }

  finito() { if (!this.trattieni) this.sincronizza(); this.opz.suFine?.(); }
}
